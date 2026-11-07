// Instagram via the Graph API with Facebook Login (tokens that start with "EAA").
// Connecting turns a short-lived user token into a Page token that never expires, and finds the
// Instagram professional account linked to that Facebook Page. Saved to secrets/instagram.json.
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { reelsBucket, stageVideo } from "./gcs";
import { deleteSecret, readSecret, writeSecret } from "./secrets";

const GRAPH = "https://graph.facebook.com/v24.0";
const SECRET = "instagram";
// Needed to find the account and publish to it; business_management only when the Page sits in a Business portfolio.
const REQUIRED = ["instagram_basic", "instagram_content_publish", "pages_show_list"];

type Saved = {
  appId: string;
  appSecret: string;
  pageId: string;
  pageName: string;
  pageToken: string; // never expires; used for reading the account
  userToken?: string; // long-lived user token; used for publishing (Page token as fallback)
  userTokenExpiresAt?: number | null; // ms
  igUserId: string;
  username: string;
  scopes: string[];
  expiresAt: number | null; // ms; null = never
  connectedAt: string;
};

export type InstagramStatus =
  | { connected: false }
  | {
      connected: true;
      ok: boolean; // false when Meta rejects the saved token
      error?: string;
      username: string;
      pageName: string;
      igUserId: string;
      profilePicture?: string;
      followers?: number;
      posts?: number;
      missingScopes: string[];
      expiresAt: number | null;
      canUpload: boolean; // the video bucket is set up (tools/setup_reels_bucket.sh)
      bucket: string | null;
      uploadTokenExpiresAt: number | null;
      connectedAt: string;
      quota?: { used: number; total: number }; // API posts in the last 24 h
    };

export class GraphError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

async function graph<T>(path: string, params: Record<string, string>, appSecret?: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  const form = new URLSearchParams(params);
  const token = params.access_token;
  if (token && appSecret && !token.includes("|")) {
    form.set("appsecret_proof", createHmac("sha256", appSecret).update(token).digest("hex"));
  }
  if (method === "GET") url.search = form.toString();
  const r = await fetch(url, method === "POST" ? { method, body: form } : undefined);
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) {
    const e = body.error ?? {};
    throw new GraphError(`Meta: ${e.message ?? `HTTP ${r.status}`}`, e.code);
  }
  return body as T;
}

export async function connectInstagram(
  root: string,
  input: { userToken: string; appId: string; appSecret: string },
  preferredUsername?: string,
): Promise<InstagramStatus> {
  const userToken = input.userToken.trim();
  const appId = input.appId.trim();
  const appSecret = input.appSecret.trim();
  if (!userToken.startsWith("EAA")) throw new GraphError("This needs a Facebook Login user token (it starts with EAA).");
  if (!/^\d+$/.test(appId)) throw new GraphError("App ID is the number shown in App settings → Basic.");
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) throw new GraphError("App Secret is the 32-character code in App settings → Basic.");

  // 1. Short-lived (1 h) user token → long-lived (60 days). Page tokens made from it never expire.
  const long = await graph<{ access_token: string }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userToken,
  });

  const perms = await graph<{ data: { permission: string; status: string }[] }>(
    "me/permissions", { access_token: long.access_token }, appSecret,
  );
  const scopes = perms.data.filter((p) => p.status === "granted").map((p) => p.permission);
  const missing = REQUIRED.filter((s) => !scopes.includes(s));
  if (missing.includes("instagram_basic") || missing.includes("pages_show_list")) {
    throw new GraphError(`The token is missing: ${missing.join(", ")}. Tick them in Graph API Explorer and generate a new token.`);
  }

  // 2. Pages this user manages, with the Instagram account linked to each.
  const pages = await findPages(long.access_token, appId, appSecret);
  const linked = pages.data.filter((p) => p.instagram_business_account);
  if (!pages.data.length) {
    throw new GraphError(
      "Meta returned no Facebook Pages for this token" +
        (pages.grantedIds.length ? ` (it was granted IDs ${pages.grantedIds.join(", ")}, but none could be opened as a Page)` : "") +
        ". In Graph API Explorer, click Get User Access Token again, choose \"Opt in to current Pages only\" → tick your Page, " +
        "and tick your Instagram account on the next screen. If the Page is in Meta Business Suite, also add business_management.",
    );
  }
  if (!linked.length) {
    throw new GraphError(
      `Found ${pages.data.map((p) => `"${p.name}"`).join(", ")}, but no Instagram professional account is linked to it. ` +
        "Link it in the Page's settings → Linked accounts, and make sure Instagram is a Business or Creator account.",
    );
  }
  const want = preferredUsername?.replace(/^@/, "").toLowerCase();
  const page = linked.find((p) => p.instagram_business_account!.username.toLowerCase() === want) ?? linked[0];

  // 3. Confirm the Page token's lifetime with Meta rather than assuming it.
  const debug = await graph<{ data: { expires_at?: number; is_valid: boolean } }>("debug_token", {
    input_token: page.access_token,
    access_token: `${appId}|${appSecret}`,
  });
  if (!debug.data.is_valid) throw new GraphError("Meta says the Page token is not valid. Generate a new user token and try again.");
  const userDebug = await graph<{ data: { expires_at?: number } }>("debug_token", {
    input_token: long.access_token,
    access_token: `${appId}|${appSecret}`,
  });

  await writeSecret(root, SECRET, {
    appId,
    appSecret,
    pageId: page.id,
    pageName: page.name,
    pageToken: page.access_token,
    userToken: long.access_token,
    userTokenExpiresAt: userDebug.data.expires_at ? userDebug.data.expires_at * 1000 : null,
    igUserId: page.instagram_business_account!.id,
    username: page.instagram_business_account!.username,
    scopes,
    expiresAt: debug.data.expires_at ? debug.data.expires_at * 1000 : null,
    connectedAt: new Date().toISOString(),
  } satisfies Saved);
  return instagramStatus(root);
}

type Page = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } };
const PAGE_FIELDS = "id,name,access_token,instagram_business_account{id,username}";

// me/accounts misses Pages owned by a Business portfolio, so also open the Page IDs the token was granted.
async function findPages(userToken: string, appId: string, appSecret: string) {
  const listed = await graph<{ data: Page[] }>("me/accounts", { access_token: userToken, fields: PAGE_FIELDS, limit: "100" }, appSecret);
  if (listed.data.length) return { data: listed.data, grantedIds: [] as string[] };

  const debug = await graph<{ data: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>("debug_token", {
    input_token: userToken,
    access_token: `${appId}|${appSecret}`,
  });
  const grantedIds = [...new Set(
    (debug.data.granular_scopes ?? [])
      .filter((g) => g.scope.startsWith("pages_") || g.scope === "business_management")
      .flatMap((g) => g.target_ids ?? []),
  )];
  const data = (
    await Promise.all(grantedIds.map((id) => graph<Page>(id, { access_token: userToken, fields: PAGE_FIELDS }, appSecret).catch(() => null)))
  ).filter((p): p is Page => !!p?.access_token);
  return { data, grantedIds };
}

export async function instagramStatus(root: string): Promise<InstagramStatus> {
  const s = await readSecret<Saved>(root, SECRET);
  if (!s) return { connected: false };
  await extendUserToken(root, s);
  const base = {
    connected: true as const,
    username: s.username,
    pageName: s.pageName,
    igUserId: s.igUserId,
    missingScopes: REQUIRED.filter((x) => !s.scopes.includes(x)),
    expiresAt: s.expiresAt,
    connectedAt: s.connectedAt,
    canUpload: !!(await reelsBucket(root)),
    bucket: await reelsBucket(root),
    uploadTokenExpiresAt: s.userTokenExpiresAt ?? null,
  };
  try {
    const [me, limit] = await Promise.all([
      graph<{ username: string; profile_picture_url?: string; followers_count?: number; media_count?: number }>(
        s.igUserId, { access_token: s.pageToken, fields: "username,profile_picture_url,followers_count,media_count" }, s.appSecret,
      ),
      graph<{ data: { quota_usage: number; config?: { quota_total: number } }[] }>(
        `${s.igUserId}/content_publishing_limit`, { access_token: s.pageToken, fields: "quota_usage,config" }, s.appSecret,
      ).catch(() => null),
    ]);
    const q = limit?.data[0];
    return {
      ...base,
      ok: true,
      username: me.username,
      profilePicture: me.profile_picture_url,
      followers: me.followers_count,
      posts: me.media_count,
      quota: q?.config ? { used: q.quota_usage, total: q.config.quota_total } : undefined,
    };
  } catch (e) {
    return { ...base, ok: false, error: (await appBlocked(s)) ?? (e instanceof Error ? e.message : String(e)) };
  }
}

// When Meta restricts the app itself, every token fails with misleading permission errors; say so plainly.
async function appBlocked(s: Saved) {
  try {
    await graph(s.appId, { access_token: `${s.appId}|${s.appSecret}`, fields: "id" });
    return null;
  } catch (e) {
    if (!(e instanceof GraphError) || !/API access blocked/i.test(e.message)) return null;
    return `Meta has blocked API access for your Meta app (${s.appId}), so reconnecting won't help yet. ` +
      `Open developers.facebook.com/apps/${s.appId} and follow the alert on the dashboard, then reconnect here.`;
  }
}

// Ask Meta for a fresh 60-day user token once the saved one is past the halfway mark. If Meta
// declines, the card shows the expiry date and asks for a reconnect when it gets close.
async function extendUserToken(root: string, s: Saved) {
  if (!s.userToken || !s.userTokenExpiresAt || s.userTokenExpiresAt - Date.now() > 30 * 86_400_000) return;
  try {
    const next = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
      grant_type: "fb_exchange_token", client_id: s.appId, client_secret: s.appSecret, fb_exchange_token: s.userToken,
    });
    s.userToken = next.access_token;
    s.userTokenExpiresAt = next.expires_in ? Date.now() + next.expires_in * 1000 : s.userTokenExpiresAt;
    await writeSecret(root, SECRET, s);
  } catch {
    // keep the old token until it expires
  }
}

export const disconnectInstagram = (root: string) => deleteSecret(root, SECRET);

export type PublishJob = {
  status: "running" | "done" | "error";
  stage: string;
  error?: string;
  mediaId?: string;
  permalink?: string;
};

// Instagram (with Facebook Login) only fetches videos from a URL, so the file is copied to a private
// bucket and Meta gets a signed link that expires in an hour. The copy is deleted once Meta has it.
// prepareReel stops before anything is posted; publishReel then makes it public.
export async function prepareReel(
  root: string,
  input: { video: string; caption: string; coverMs: number; name: string },
  job: PublishJob,
) {
  const s = await readSecret<Saved>(root, SECRET);
  if (!s) throw new GraphError("Instagram isn't connected. Connect it under Channel & captions → Connections.");
  const auth = { access_token: s.userToken ?? s.pageToken };

  const bytes = await readFile(input.video);
  job.stage = `Uploading video (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`;
  const staged = await stageVideo(root, input.name, bytes);
  try {
    job.stage = "Sending to Instagram";
    const container = await graph<{ id: string }>(`${s.igUserId}/media`, {
      ...auth,
      media_type: "REELS",
      video_url: staged.url,
      caption: input.caption,
      share_to_feed: "true",
      thumb_offset: String(input.coverMs),
    }, s.appSecret, "POST");

    // Processing usually takes 10–60 s; containers expire after 24 h, so give up well before that.
    job.stage = "Instagram is processing the video";
    const started = Date.now();
    for (;;) {
      const st = await graph<{ status_code: string; status?: string }>(container.id, { ...auth, fields: "status_code,status" }, s.appSecret);
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        throw new GraphError(`Meta couldn't process the video: ${st.status ?? st.status_code}`);
      }
      if (Date.now() - started > 15 * 60_000) throw new GraphError("Instagram is still processing after 15 minutes. Try again later.");
      await new Promise((r) => setTimeout(r, 5000));
    }
    return { containerId: container.id, s, auth };
  } finally {
    await staged.remove();
  }
}

export async function publishReel(
  root: string,
  input: { video: string; caption: string; coverMs: number; name: string },
  job: PublishJob,
): Promise<{ mediaId: string; permalink: string }> {
  const { containerId, s, auth } = await prepareReel(root, input, job);
  job.stage = "Publishing";
  const published = await graph<{ id: string }>(`${s.igUserId}/media_publish`, { ...auth, creation_id: containerId }, s.appSecret, "POST");
  const media = await graph<{ permalink?: string }>(published.id, { ...auth, fields: "permalink" }, s.appSecret).catch(() => ({ permalink: undefined }));
  return { mediaId: published.id, permalink: media.permalink ?? `https://www.instagram.com/${s.username}/` };
}

// YouTube via the Data API v3 (DEC-15 step 4). The owner connects once with Google sign-in;
// the refresh token stays in secrets/youtube.json and never reaches the browser.
// OAuth client: secrets/youtube-client.json — Google's downloaded JSON ({"installed": {...}})
// or just { client_id, client_secret }.
import { randomBytes } from "node:crypto";
import { open, stat } from "node:fs/promises";
import { deleteSecret, readSecret, writeSecret } from "./secrets";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
const CHUNK = 8 * 1024 * 1024; // resumable upload chunk (a multiple of 256 KiB)

type Client = { client_id: string; client_secret: string };
type Saved = { refresh_token: string; channelId: string; channelTitle: string; connectedAt: string };

export type YouTubeStatus =
  | { configured: false; connected: false }
  | { configured: true; connected: false }
  | { configured: true; connected: true; channelId: string; channelTitle: string; ok: boolean; error?: string };

async function readClient(root: string): Promise<Client | null> {
  const raw = await readSecret<Record<string, any>>(root, "youtube-client");
  const c = raw?.installed ?? raw?.web ?? raw;
  if (!c?.client_id || !c?.client_secret || String(c.client_id).startsWith("YOUR_")) return null;
  return { client_id: c.client_id, client_secret: c.client_secret };
}

// One sign-in at a time: the state value ties Google's redirect back to the request that started it.
const pending = new Map<string, { redirectUri: string; at: number }>();

export async function youtubeAuthUrl(root: string, redirectUri: string) {
  const client = await readClient(root);
  if (!client) throw new Error("add the Google OAuth client to secrets/youtube-client.json first");
  const state = randomBytes(16).toString("hex");
  pending.set(state, { redirectUri, at: Date.now() });
  const q = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? r.status}`);
  return body as { access_token: string; refresh_token?: string };
}

async function myChannel(accessToken: string) {
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`YouTube: ${body.error?.message ?? r.status}`);
  const ch = body.items?.[0];
  if (!ch) throw new Error("this Google account has no YouTube channel");
  return { channelId: ch.id as string, channelTitle: ch.snippet.title as string };
}

export async function finishYoutubeAuth(root: string, code: string, state: string) {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || Date.now() - p.at > 15 * 60 * 1000) throw new Error("this sign-in link expired; start again from Connections");
  const client = (await readClient(root))!;
  const t = await token({ code, client_id: client.client_id, client_secret: client.client_secret, redirect_uri: p.redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("Google didn't return a refresh token; remove the app's access in your Google account and connect again");
  const ch = await myChannel(t.access_token);
  await writeSecret(root, "youtube", { refresh_token: t.refresh_token, ...ch, connectedAt: new Date().toISOString() } satisfies Saved);
  return ch;
}

async function accessToken(root: string) {
  const client = await readClient(root);
  const saved = await readSecret<Saved>(root, "youtube");
  if (!client || !saved) throw new Error("YouTube isn't connected");
  return (await token({ refresh_token: saved.refresh_token, client_id: client.client_id, client_secret: client.client_secret, grant_type: "refresh_token" })).access_token;
}

export async function youtubeStatus(root: string): Promise<YouTubeStatus> {
  if (!(await readClient(root))) return { configured: false, connected: false };
  const saved = await readSecret<Saved>(root, "youtube");
  if (!saved) return { configured: true, connected: false };
  try {
    const ch = await myChannel(await accessToken(root));
    return { configured: true, connected: true, ...ch, ok: true };
  } catch (e) {
    return { configured: true, connected: true, channelId: saved.channelId, channelTitle: saved.channelTitle, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function disconnectYoutube(root: string) {
  const saved = await readSecret<Saved>(root, "youtube");
  if (saved) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(saved.refresh_token)}`, { method: "POST" }).catch(() => {});
  await deleteSecret(root, "youtube");
}

export type UploadInput = { file: string; title: string; description: string; tags: string[]; privacy: "private" | "unlisted" | "public" };

// Resumable upload in 8 MB chunks, so progress can be shown and a dropped chunk is retried.
export async function uploadVideo(root: string, input: UploadInput, onProgress: (fraction: number) => void) {
  const size = (await stat(input.file)).size;
  const meta = {
    snippet: { title: input.title.slice(0, 100), description: input.description.slice(0, 5000), tags: input.tags, categoryId: "27" }, // Education
    status: { privacyStatus: input.privacy, selfDeclaredMadeForKids: false },
  };
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(root)}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(meta),
  });
  if (!start.ok) throw new Error(`YouTube refused the upload: ${(await start.json().catch(() => ({}))).error?.message ?? start.status}`);
  const session = start.headers.get("location")!;

  // After a dropped connection, ask Google how much of the file it already has.
  const received = async () => {
    const r = await fetch(session, { method: "PUT", headers: { "Content-Length": "0", "Content-Range": `bytes */${size}` } });
    const range = r.headers.get("range");
    return range ? Number(range.split("-")[1]) + 1 : 0;
  };

  const fh = await open(input.file, "r");
  try {
    let offset = 0;
    let retries = 0;
    for (;;) {
      const length = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(length);
      await fh.read(buf, 0, length, offset);
      let r: Response;
      try {
        r = await fetch(session, {
          method: "PUT",
          headers: { "Content-Length": String(length), "Content-Range": `bytes ${offset}-${offset + length - 1}/${size}` },
          body: new Uint8Array(buf),
        });
      } catch (e) {
        if (++retries > 5) throw e;
        await new Promise((res) => setTimeout(res, 2000 * retries));
        offset = await received().catch(() => offset); // network hiccup: resume from what arrived
        continue;
      }
      if (r.status === 200 || r.status === 201) {
        onProgress(1);
        return ((await r.json()) as { id: string }).id;
      }
      if (r.status === 308) {
        // Google says how much it has; continue from there.
        const range = r.headers.get("range"); // "bytes=0-8388607"
        offset = range ? Number(range.split("-")[1]) + 1 : offset + length;
        retries = 0;
        onProgress(offset / size);
        continue;
      }
      if (r.status >= 500 && ++retries <= 5) {
        await new Promise((res) => setTimeout(res, 2000 * retries));
        offset = await received().catch(() => offset);
        continue;
      }
      throw new Error(`YouTube upload failed: ${(await r.json().catch(() => ({}))).error?.message ?? r.status}`);
    }
  } finally {
    await fh.close();
  }
}

// Custom thumbnails need a phone-verified channel; failure here is a warning, not an error.
export async function setThumbnail(root: string, videoId: string, png: Buffer) {
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(root)}`, "Content-Type": "image/png" },
    body: new Uint8Array(png),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message ?? `HTTP ${r.status}`);
}

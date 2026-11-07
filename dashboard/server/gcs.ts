// Private Google Cloud Storage bucket used as a short-lived handoff for Instagram, which only
// fetches videos from a URL. Files are reachable only through V4 signed URLs that expire;
// the bucket itself is never public. Set up by tools/setup_reels_bucket.sh → secrets/gcs-reels.json.
import { createHash, createSign } from "node:crypto";
import { readSecret } from "./secrets";

type Key = { client_email: string; private_key: string; bucket: string };

export const reelsBucket = async (root: string) => (await readSecret<Key>(root, "gcs-reels"))?.bucket ?? null;

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function signedUrl(key: Key, method: "GET" | "PUT" | "DELETE", object: string, seconds: number) {
  const host = "storage.googleapis.com";
  const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""); // 20261106T093000Z
  const scope = `${now.slice(0, 8)}/auto/storage/goog4_request`;
  const path = `/${key.bucket}/${object.split("/").map(enc).join("/")}`;
  const query = Object.entries({
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": `${key.client_email}/${scope}`,
    "X-Goog-Date": now,
    "X-Goog-Expires": String(seconds),
    "X-Goog-SignedHeaders": "host",
  })
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .sort()
    .join("&");
  const request = [method, path, query, `host:${host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["GOOG4-RSA-SHA256", now, scope, createHash("sha256").update(request).digest("hex")].join("\n");
  const signature = createSign("RSA-SHA256").update(toSign).sign(key.private_key, "hex");
  return `https://${host}${path}?${query}&X-Goog-Signature=${signature}`;
}

// Upload the file and return a link Meta can fetch for the next hour, plus a cleanup function.
export async function stageVideo(root: string, name: string, bytes: Buffer<ArrayBuffer>) {
  const key = await readSecret<Key>(root, "gcs-reels");
  if (!key?.bucket) throw new Error("The video bucket isn't set up yet. Run tools/setup_reels_bucket.sh once.");
  const object = `reels/${name}`;
  const put = await fetch(signedUrl(key, "PUT", object, 900), { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: bytes });
  if (!put.ok) throw new Error(`Couldn't upload to the bucket: HTTP ${put.status} ${(await put.text()).slice(0, 300)}`);
  return {
    url: signedUrl(key, "GET", object, 3600),
    remove: async () => {
      await fetch(signedUrl(key, "DELETE", object, 300), { method: "DELETE" }).catch(() => {});
    },
  };
}

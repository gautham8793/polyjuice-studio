// Media for team sync (DEC-15): every image / audio file is stored once, named by its SHA-256, and
// never changes, so media never conflicts. Cloudflare R2 for the team (secrets/r2.json); a plain
// folder for tests or a shared drive (.studio/sync.json → { "blobStore": { "type": "folder", "path": … } }).
import { createHash, createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { localDir } from "./paths";
import { readSecret } from "./secrets";

export interface BlobStore {
  label: string;
  has(hash: string): Promise<boolean>;
  put(hash: string, file: string): Promise<void>;
  get(hash: string, dest: string): Promise<void>;
}

const HASH = /^[0-9a-f]{64}$/;
const check = (hash: string) => {
  if (!HASH.test(hash)) throw new Error(`bad blob hash: ${hash}`);
};

// Write to a temp name, then rename, so a half-finished download never looks like a real file.
const writeAtomic = async (dest: string, data: Buffer | Uint8Array) => {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part-${process.pid}`;
  await writeFile(tmp, data);
  await rename(tmp, dest);
};

class FolderStore implements BlobStore {
  constructor(private dir: string) {}
  get label() {
    return `folder ${this.dir}`;
  }
  private file(hash: string) {
    check(hash);
    return path.join(this.dir, hash.slice(0, 2), hash);
  }
  async has(hash: string) {
    return existsSync(this.file(hash));
  }
  async put(hash: string, file: string) {
    const dest = this.file(hash);
    if (existsSync(dest)) return;
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(file, `${dest}.part`);
    await rename(`${dest}.part`, dest);
  }
  async get(hash: string, dest: string) {
    await writeAtomic(dest, await readFile(this.file(hash)));
  }
}

type R2Key = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string; prefix?: string };

// Cloudflare R2 through its S3 API, signed with AWS Signature V4 (region "auto"). No SDK needed.
class R2Store implements BlobStore {
  private host: string;
  constructor(private key: R2Key) {
    this.host = `${key.accountId}.r2.cloudflarestorage.com`;
  }
  get label() {
    return `R2 bucket ${this.key.bucket}`;
  }
  private object(hash: string) {
    check(hash);
    return `/${this.key.bucket}/${this.key.prefix ?? "blobs"}/${hash.slice(0, 2)}/${hash}`;
  }
  private async request(method: "GET" | "PUT" | "HEAD", hash: string, body?: Buffer) {
    const pathName = this.object(hash);
    const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20261109T104800Z
    const day = now.slice(0, 8);
    const payloadHash = createHash("sha256").update(body ?? "").digest("hex");
    const headers: Record<string, string> = { host: this.host, "x-amz-content-sha256": payloadHash, "x-amz-date": now };
    const names = Object.keys(headers).sort();
    const canonical = [method, pathName, "", ...names.map((h) => `${h}:${headers[h]}`), "", names.join(";"), payloadHash].join("\n");
    const scope = `${day}/auto/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", now, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
    let k: Buffer = createHmac("sha256", `AWS4${this.key.secretAccessKey}`).update(day).digest();
    for (const part of ["auto", "s3", "aws4_request"]) k = createHmac("sha256", k).update(part).digest();
    const signature = createHmac("sha256", k).update(toSign).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${this.key.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
    const { host: _host, ...sent } = headers;
    return fetch(`https://${this.host}${pathName}`, { method, headers: { ...sent, Authorization: auth }, body: body ? new Uint8Array(body) : undefined });
  }
  async has(hash: string) {
    const r = await this.request("HEAD", hash);
    if (r.status === 404) return false;
    if (!r.ok) throw new Error(`R2 check failed: ${r.status}`);
    return true;
  }
  async put(hash: string, file: string) {
    const body = await readFile(file);
    // Re-hash what is actually sent, so a file changed mid-sync is never stored under the wrong name.
    if (createHash("sha256").update(body).digest("hex") !== hash) throw new Error(`file changed while uploading: ${file}`);
    const r = await this.request("PUT", hash, body);
    if (!r.ok) throw new Error(`R2 upload failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  async get(hash: string, dest: string) {
    const r = await this.request("GET", hash);
    if (!r.ok) throw new Error(`R2 download failed: ${r.status}`);
    const data = Buffer.from(await r.arrayBuffer());
    if (createHash("sha256").update(data).digest("hex") !== hash) throw new Error(`download damaged: ${hash}`);
    await writeAtomic(dest, data);
  }
}

// The team's store, or null when sync media isn't set up on this computer.
// An explicit choice for this computer (.studio/sync.json) wins; otherwise the team's R2 key.
export async function blobStore(root: string): Promise<BlobStore | null> {
  const cfgFile = path.join(localDir(root), "sync.json");
  if (existsSync(cfgFile)) {
    const cfg = JSON.parse(await readFile(cfgFile, "utf8"));
    if (cfg.blobStore?.type === "folder" && cfg.blobStore.path) return new FolderStore(path.resolve(root, cfg.blobStore.path));
  }
  const r2 = await readSecret<R2Key>(root, "r2");
  // Placeholder values ("YOUR_…") mean the key hasn't been filled in yet.
  const filled = (v?: string) => !!v && !v.startsWith("YOUR_");
  if (r2 && filled(r2.accountId) && filled(r2.bucket) && filled(r2.accessKeyId) && filled(r2.secretAccessKey)) return new R2Store(r2);
  return null;
}

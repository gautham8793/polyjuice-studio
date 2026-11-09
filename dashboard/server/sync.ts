// Async team sync, stage 1 (DEC-15): the content folder is a Git repo for text (scripts, reviews,
// team files) and every media file is stored by SHA-256 in a blob store, listed in media.json
// manifests. Sync = record my media → upload blobs → commit → pull + merge by key → push →
// download what others added. Members never see Git; conflicts are merged by rules, not markers.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { blobStore, type BlobStore } from "./blobs";
import { contentRoot, localDir } from "./paths";
import { logActivity, readMe, readMembers, readTeam, writeTeam } from "./team";
import { hasRole, type Member } from "../src/team";

const MEDIA = /\.(png|jpe?g|webp|gif|avif|wav|mp3|m4a|aac|ogg|flac|aiff?|webm|mp4|mov)$/i;
const SKIP_DIRS = new Set([".git", "voice-samples", "renders", "captions", "node_modules", "__pycache__"]);
const STALE_LOCK_MS = 48 * 3600 * 1000;
const MERGE_BY_KEY = new Set(["media.json", "review.json", "team.json", "workspace.json", "members.json"]);

// The content repo's own ignore file: media goes through the blob store, caches stay local.
const CONTENT_GITIGNORE = `# Polyjuice channel content. Media files sync through the blob store (see media.json files),
# not Git. Written by the studio; edit with care.
*.png
*.jpg
*.jpeg
*.webp
*.gif
*.avif
*.wav
*.mp3
*.m4a
*.aac
*.ogg
*.flac
*.aif
*.aiff
*.webm
*.mp4
*.mov
library/voice-samples/
projects/*/captions/
projects/*/renders/
*.part-*
*.conflict-*
.DS_Store
Thumbs.db
__pycache__/
*.pyc
`;

type Entry = { sha256: string; size: number; at: string; by: string };
type Manifest = { files: Record<string, Entry> };
type IndexEntry = { size: number; mtimeMs: number; sha256: string };

export type SyncReport = {
  ok: boolean;
  committed: string | null;
  pulled: number; // commits received from others
  uploaded: number;
  downloaded: number;
  removed: number;
  conflicts: string[]; // files where someone else's version won; mine saved as *.conflict-<me>.*
  log: string[];
};

export type SyncStatus = {
  configured: boolean; // the content folder is a Git repo
  remote: string | null;
  store: string | null;
  me: Member | null;
  pending: number; // local text changes not yet sent (media is counted at sync time)
  behind: number | null; // commits from others not yet pulled (after the last fetch)
  lastSyncedAt: string | null;
  running: boolean;
};

// ── Git ─────────────────────────────────────────────────────────────────────────────────────
// One git process at a time per folder: two at once (a status check during a sync) collide on
// .git/index.lock. --no-optional-locks keeps read-only commands from taking that lock at all.
const queues = new Map<string, Promise<unknown>>();
function git(cwd: string, args: string[], allowFail = false) {
  const run = () => gitNow(cwd, args, allowFail);
  const next = (queues.get(cwd) ?? Promise.resolve()).then(run, run);
  queues.set(cwd, next.catch(() => {}));
  return next;
}

function gitNow(cwd: string, args: string[], allowFail: boolean) {
  return new Promise<{ code: number; out: string }>((resolve, reject) => {
    // GIT_TERMINAL_PROMPT=0: fail instead of hanging on a password prompt nobody can see.
    const child = spawn("git", ["--no-optional-locks", ...args], { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    let out = "";
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (out += b));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !allowFail) reject(new Error(`git ${args[0]} failed: ${out.trim().slice(-600)}`));
      else resolve({ code: code ?? 1, out });
    });
  });
}

const authorArgs = (me: Member) => ["-c", `user.name=${me.name}`, "-c", `user.email=${me.id}@members.polyjuice.local`];
const remoteUrl = async (cwd: string) => {
  const r = await git(cwd, ["remote", "get-url", "origin"], true);
  return r.code === 0 ? r.out.trim() : null;
};
// symbolic-ref also works on a new repo with no commits yet (rev-parse HEAD doesn't)
const branch = async (cwd: string) => (await git(cwd, ["symbolic-ref", "--short", "HEAD"])).out.trim();

// ── Local state (.studio) ─────────────────────────────────────────────────────────────────
const stateFile = (root: string, name: string) => path.join(localDir(root), name);
const readState = async <T>(root: string, name: string, fallback: T): Promise<T> =>
  existsSync(stateFile(root, name)) ? JSON.parse(await readFile(stateFile(root, name), "utf8")) : fallback;
const writeState = async (root: string, name: string, data: unknown) => {
  await mkdir(localDir(root), { recursive: true });
  await writeFile(stateFile(root, name), JSON.stringify(data, null, 2) + "\n");
};

// ── Media manifests ───────────────────────────────────────────────────────────────────────
const posix = (p: string) => p.split(path.sep).join("/");

// projects/<slug>/x.png → projects/<slug>/media.json · library/… → library/media.json · else media.json
const manifestOf = (rel: string) => {
  const parts = rel.split("/");
  if (parts[0] === "projects" && parts.length > 2) return `projects/${parts[1]}/media.json`;
  if (parts.length > 1) return `${parts[0]}/media.json`;
  return "media.json";
};
const keyIn = (manifest: string, rel: string) => {
  const dir = path.posix.dirname(manifest);
  return dir === "." ? rel : rel.slice(dir.length + 1);
};
const relOf = (manifest: string, key: string) => {
  const dir = path.posix.dirname(manifest);
  return dir === "." ? key : `${dir}/${key}`;
};

async function walkMedia(content: string, dir = "", out: string[] = []) {
  for (const d of await readdir(path.join(content, dir), { withFileTypes: true })) {
    if (d.name.startsWith(".") && d.name !== ".") continue;
    const rel = dir ? `${dir}/${d.name}` : d.name;
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) await walkMedia(content, rel, out);
    } else if (d.isFile() && MEDIA.test(d.name) && !d.name.includes(".part-") && !d.name.includes(".conflict-")) {
      out.push(rel);
    }
  }
  return out;
}

const sha256File = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });

async function listManifests(content: string) {
  const found = ["media.json", "library/media.json", "brand/media.json"].filter((m) => existsSync(path.join(content, m)));
  const projects = path.join(content, "projects");
  if (existsSync(projects)) {
    for (const d of await readdir(projects, { withFileTypes: true })) {
      if (d.isDirectory() && existsSync(path.join(projects, d.name, "media.json"))) found.push(`projects/${d.name}/media.json`);
    }
  }
  return found;
}

async function readManifests(content: string) {
  const all = new Map<string, Manifest>();
  for (const m of await listManifests(content)) all.set(m, JSON.parse(await readFile(path.join(content, m), "utf8")));
  return all;
}

const writeManifest = async (content: string, name: string, m: Manifest) => {
  const files = Object.fromEntries(Object.entries(m.files).sort(([a], [b]) => a.localeCompare(b)));
  await mkdir(path.dirname(path.join(content, name)), { recursive: true });
  await writeFile(path.join(content, name), JSON.stringify({ files }, null, 2) + "\n");
};

// Record my media: new or changed files get a manifest entry, files I deleted lose theirs.
// A listed file that never existed here is a download still to come, not a deletion.
async function recordMedia(root: string, content: string, me: Member) {
  const index = await readState<Record<string, IndexEntry>>(root, "media-index.json", {});
  const manifests = await readManifests(content);
  const local = new Set(await walkMedia(content));
  const now = new Date().toISOString();
  let changed = 0;

  for (const rel of local) {
    const s = await stat(path.join(content, rel));
    const cached = index[rel];
    const sha256 = cached && cached.size === s.size && cached.mtimeMs === s.mtimeMs ? cached.sha256 : await sha256File(path.join(content, rel));
    index[rel] = { size: s.size, mtimeMs: s.mtimeMs, sha256 };
    const name = manifestOf(rel);
    const m = manifests.get(name) ?? { files: {} };
    const key = keyIn(name, rel);
    if (m.files[key]?.sha256 !== sha256) {
      m.files[key] = { sha256, size: s.size, at: now, by: me.id };
      manifests.set(name, m);
      changed++;
    }
  }
  for (const [name, m] of manifests) {
    for (const key of Object.keys(m.files)) {
      const rel = relOf(name, key);
      if (!local.has(rel) && index[rel]) {
        delete m.files[key]; // I had it and deleted it
        delete index[rel];
        changed++;
      }
    }
  }
  for (const [name, m] of manifests) await writeManifest(content, name, m);
  await writeState(root, "media-index.json", index);
  return changed;
}

async function uploadMedia(root: string, content: string, store: BlobStore, log: string[]) {
  const uploaded = new Set(await readState<string[]>(root, "uploaded.json", []));
  const index = await readState<Record<string, IndexEntry>>(root, "media-index.json", {});
  let count = 0;
  for (const [rel, e] of Object.entries(index)) {
    if (uploaded.has(e.sha256)) continue;
    if (!(await store.has(e.sha256))) {
      await store.put(e.sha256, path.join(content, rel));
      count++;
    }
    uploaded.add(e.sha256);
  }
  await writeState(root, "uploaded.json", [...uploaded]);
  if (count) log.push(`uploaded ${count} media file${count > 1 ? "s" : ""} to ${store.label}`);
  return count;
}

// Make the media on disk match the (merged) manifests: fetch new or changed files, remove ones
// others deleted. `before` is what my manifests said before the merge.
async function applyMedia(root: string, content: string, store: BlobStore | null, before: Map<string, Manifest>, me: Member, report: SyncReport) {
  const index = await readState<Record<string, IndexEntry>>(root, "media-index.json", {});
  const after = await readManifests(content);
  for (const [name, m] of after) {
    for (const [key, e] of Object.entries(m.files)) {
      const rel = relOf(name, key);
      const file = path.join(content, rel);
      if (existsSync(file) && index[rel]?.sha256 === e.sha256) continue;
      if (!store) {
        report.log.push(`missing media (no blob store set up): ${rel}`);
        continue;
      }
      const mine = before.get(name)?.files[key];
      if (existsSync(file) && mine && mine.by === me.id && mine.sha256 !== e.sha256) {
        // Both changed the same file and theirs won: keep mine next to it.
        const ext = path.extname(file);
        await copyFile(file, `${file.slice(0, -ext.length)}.conflict-${me.id}${ext}`);
        report.conflicts.push(rel);
      }
      await store.get(e.sha256, file);
      const s = await stat(file);
      index[rel] = { size: s.size, mtimeMs: s.mtimeMs, sha256: e.sha256 };
      report.downloaded++;
    }
  }
  for (const [name, m] of before) {
    for (const [key, e] of Object.entries(m.files)) {
      if (after.get(name)?.files[key]) continue;
      const rel = relOf(name, key);
      if (existsSync(path.join(content, rel)) && index[rel]?.sha256 === e.sha256) {
        await rm(path.join(content, rel));
        delete index[rel];
        report.removed++;
      }
    }
  }
  await writeState(root, "media-index.json", index);
}

// ── Merging ───────────────────────────────────────────────────────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Three-way merge by key. When both sides changed the same value, the one with the later `at` wins
// (reviews, approvals, media entries and publish records all carry one); otherwise theirs, which
// reached the shared repo first.
export function merge3(base: unknown, ours: unknown, theirs: unknown): unknown {
  if (same(ours, theirs)) return ours;
  if (same(base, ours)) return theirs;
  if (same(base, theirs)) return ours;
  // Changed on one side, deleted on the other: keep the change.
  if (ours === undefined) return theirs;
  if (theirs === undefined) return ours;
  // A record with its own time (a review, an approval, a media entry, a lock) is kept whole.
  if (isObj(ours) && isObj(theirs) && typeof ours.at === "string" && typeof theirs.at === "string") {
    return ours.at > theirs.at ? ours : theirs;
  }
  if (isObj(ours) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      const v = merge3(b[k], ours[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return theirs;
}

const mergeJsonl = (ours: string, theirs: string) => {
  const lines = new Set([...ours.split("\n"), ...theirs.split("\n")].filter((l) => l.trim()));
  const at = (l: string) => {
    try {
      return JSON.parse(l).at ?? "";
    } catch {
      return "";
    }
  };
  return [...lines].sort((a, b) => at(a).localeCompare(at(b))).join("\n") + "\n";
};

const showStage = async (cwd: string, stage: 1 | 2 | 3, file: string) => {
  const r = await git(cwd, ["show", `:${stage}:${file}`], true);
  return r.code === 0 ? r.out : null;
};

async function resolveConflicts(content: string, me: Member, report: SyncReport) {
  const files = (await git(content, ["diff", "--name-only", "--diff-filter=U"])).out.split("\n").filter(Boolean);
  for (const f of files) {
    const [base, ours, theirs] = await Promise.all([showStage(content, 1, f), showStage(content, 2, f), showStage(content, 3, f)]);
    const target = path.join(content, f);
    const name = path.posix.basename(f);
    if (ours === null || theirs === null) {
      // Deleted on one side, changed on the other: keep the changed file.
      await writeFile(target, (ours ?? theirs)!);
    } else if (f.endsWith(".jsonl")) {
      await writeFile(target, mergeJsonl(ours, theirs));
    } else if (MERGE_BY_KEY.has(name)) {
      const merged = merge3(base ? JSON.parse(base) : undefined, JSON.parse(ours), JSON.parse(theirs));
      await writeFile(target, JSON.stringify(merged, null, 2) + "\n");
      report.log.push(`merged ${f}`);
    } else {
      // Scripts and research shouldn't collide (one editor per video); if they do, theirs stays
      // and mine is kept beside it for a person to compare.
      const ext = path.extname(f);
      await writeFile(path.join(content, `${f.slice(0, f.length - ext.length)}.conflict-${me.id}${ext}`), ours);
      await writeFile(target, theirs);
      report.conflicts.push(f);
    }
    await git(content, ["add", "--", f]);
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────────────────
let running = false;

const commitMessage = async (content: string, me: Member) => {
  const files = (await git(content, ["diff", "--cached", "--name-only"])).out.split("\n").filter(Boolean);
  const inVideo = (f: string) => f.startsWith("projects/") && f.split("/").length > 2; // not projects/.gitkeep
  const slugs = [...new Set(files.filter(inVideo).map((f) => f.split("/")[1]))];
  const other = files.length - files.filter(inVideo).length;
  const parts = [
    slugs.length ? `${slugs.length} video${slugs.length > 1 ? "s" : ""} (${slugs.slice(0, 4).join(", ")}${slugs.length > 4 ? ", …" : ""})` : "",
    other ? `${other} shared file${other > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return `${me.name}: updated ${parts.join(" and ") || "content"}`;
};

async function pullMerge(content: string, me: Member, report: SyncReport) {
  const br = await branch(content);
  await git(content, ["fetch", "origin"]);
  const remoteRef = `origin/${br}`;
  if ((await git(content, ["rev-parse", "--verify", remoteRef], true)).code !== 0) return; // nothing pushed yet
  const behind = Number((await git(content, ["rev-list", "--count", `HEAD..${remoteRef}`])).out.trim());
  if (!behind) return;
  report.pulled += behind;
  // Fast-forward when I have nothing new; a merge commit only when both sides changed.
  const r = await git(content, [...authorArgs(me), "merge", "--no-edit", remoteRef], true);
  if (r.code !== 0) {
    await resolveConflicts(content, me, report);
    await git(content, [...authorArgs(me), "commit", "--no-edit"]);
  }
}

export async function runSync(root: string): Promise<SyncReport> {
  const report: SyncReport = { ok: false, committed: null, pulled: 0, uploaded: 0, downloaded: 0, removed: 0, conflicts: [], log: [] };
  if (running) throw new Error("a sync is already running");
  running = true;
  try {
    const content = contentRoot(root);
    const me = await readMe(root);
    if (!me) throw new Error("pick who you are first (Team & activity)");
    if (!existsSync(path.join(content, ".git"))) throw new Error("sync isn't set up on this computer yet");
    const store = await blobStore(root);

    const changedMedia = await recordMedia(root, content, me);
    if (changedMedia) report.log.push(`${changedMedia} media change${changedMedia > 1 ? "s" : ""} recorded`);
    if (store) report.uploaded = await uploadMedia(root, content, store, report.log);
    else report.log.push("no blob store set up: media stays on this computer");

    await git(content, ["add", "-A"]);
    if ((await git(content, ["diff", "--cached", "--quiet"], true)).code !== 0) {
      report.committed = await commitMessage(content, me);
      await git(content, [...authorArgs(me), "commit", "-q", "-m", report.committed]);
    }

    const before = await readManifests(content);
    if (await remoteUrl(content)) {
      const br = await branch(content);
      for (let attempt = 0; ; attempt++) {
        await pullMerge(content, me, report);
        const push = await git(content, ["push", "-u", "origin", br], true);
        if (push.code === 0) break;
        if (attempt === 2) throw new Error(`couldn't send changes: ${push.out.trim().slice(-400)}`);
        report.log.push("someone synced at the same moment; merging again");
      }
    } else {
      report.log.push("no shared repo set: changes saved on this computer only");
    }
    await applyMedia(root, content, store, before, me, report);
    await writeState(root, "sync-state.json", { lastSyncedAt: new Date().toISOString() });
    report.ok = true;
    return report;
  } finally {
    running = false;
  }
}

export async function syncStatus(root: string, fetch = false): Promise<SyncStatus> {
  const content = contentRoot(root);
  const configured = existsSync(path.join(content, ".git"));
  const store = await blobStore(root);
  const { lastSyncedAt = null } = await readState<{ lastSyncedAt?: string }>(root, "sync-state.json", {});
  const base = { configured, store: store?.label ?? null, me: await readMe(root), lastSyncedAt, running };
  if (!configured) return { ...base, remote: null, pending: 0, behind: null };
  const remote = await remoteUrl(content);
  const pending = (await git(content, ["status", "--porcelain"])).out.split("\n").filter(Boolean).length;
  let behind: number | null = null;
  if (remote) {
    if (fetch) await git(content, ["fetch", "origin"], true);
    const br = await branch(content);
    const r = await git(content, ["rev-list", "--count", `HEAD..origin/${br}`], true);
    behind = r.code === 0 ? Number(r.out.trim()) : null;
  }
  return { ...base, remote, pending, behind };
}

// Turn this computer's content folder into the shared content repo (first member), optionally
// with the shared remote. Media is recorded and uploaded by the first sync.
export async function initContent(root: string, remote?: string) {
  const content = contentRoot(root);
  if (!existsSync(path.join(content, ".git"))) {
    await git(content, ["init", "-q", "-b", "main"]);
  }
  if (!existsSync(path.join(content, ".gitignore"))) await writeFile(path.join(content, ".gitignore"), CONTENT_GITIGNORE);
  if (remote && !(await remoteUrl(content))) await git(content, ["remote", "add", "origin", remote]);
  return syncStatus(root);
}

// A new member's computer: clone the shared content repo into an empty content folder, then the
// first sync downloads the media.
export async function joinContent(root: string, remote: string) {
  const content = contentRoot(root);
  if (existsSync(content) && (await readdir(content)).length) throw new Error(`the content folder isn't empty: ${content}`);
  await mkdir(path.dirname(content), { recursive: true });
  await git(path.dirname(content), ["clone", "-q", remote, path.basename(content)]);
  return syncStatus(root);
}

// Upload, check and download a tiny test file, so a member knows the media store works before syncing.
export async function testStore(root: string) {
  const store = await blobStore(root);
  if (!store) return { ok: false, store: null, steps: ["no media store set up (secrets/r2.json)"] };
  const steps: string[] = [];
  const dir = await mkdtemp(path.join(tmpdir(), "polyjuice-store-test-"));
  try {
    const data = Buffer.from("Polyjuice Video Studio — media store test\n");
    const hash = createHash("sha256").update(data).digest("hex");
    await writeFile(path.join(dir, "up"), data);
    let t = Date.now();
    await store.put(hash, path.join(dir, "up"));
    steps.push(`upload ok (${Date.now() - t} ms)`);
    t = Date.now();
    if (!(await store.has(hash))) throw new Error("uploaded file not found");
    steps.push(`check ok (${Date.now() - t} ms)`);
    t = Date.now();
    await store.get(hash, path.join(dir, "down"));
    if (!(await readFile(path.join(dir, "down"))).equals(data)) throw new Error("downloaded file differs");
    steps.push(`download ok (${Date.now() - t} ms)`);
    return { ok: true, store: store.label, steps };
  } catch (e) {
    steps.push(e instanceof Error ? e.message : String(e));
    return { ok: false, store: store.label, steps };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ── Check-out locks ───────────────────────────────────────────────────────────────────────
// With more than one member and a shared repo, editing a video (project.json, research) needs its
// lock. Taking it is a sync + commit + push, so if two people try at once only one push lands.
export async function editAllowed(root: string, slug: string): Promise<{ ok: boolean; reason?: string }> {
  const content = contentRoot(root);
  if (!existsSync(path.join(content, ".git"))) return { ok: true };
  if ((await readMembers(root)).members.length < 2) return { ok: true };
  const me = await readMe(root);
  const lock = (await readTeam(root, slug)).lock;
  if (lock && me && lock.by === me.id) return { ok: true };
  return { ok: false, reason: lock ? `${lock.by} is editing this video` : "check out the video to edit it" };
}

export async function setLock(root: string, slug: string, take: boolean) {
  const content = contentRoot(root);
  const me = await readMe(root);
  if (!me) throw new Error("pick who you are first");
  for (let attempt = 0; attempt < 2; attempt++) {
    await runSync(root); // start from everyone's latest, with my work already sent
    const team = await readTeam(root, slug);
    const lock = team.lock;
    if (take) {
      if (lock?.by === me.id) return team;
      const stale = lock && Date.now() - Date.parse(lock.at) > STALE_LOCK_MS;
      if (lock && !(stale && hasRole(me, "admin"))) throw new Error(`${lock.by} is editing this video since ${new Date(lock.at).toLocaleString()}`);
      team.lock = { by: me.id, at: new Date().toISOString(), scope: "script" };
    } else {
      if (!lock) return team;
      if (lock.by !== me.id && !hasRole(me, "admin")) throw new Error("only the person editing (or an admin) can release this video");
      team.lock = null;
    }
    const head = (await git(content, ["rev-parse", "HEAD"])).out.trim();
    await writeTeam(root, slug, team);
    await logActivity(root, { by: me.id, project: slug, type: take ? "edit.checkout" : "edit.release" });
    await git(content, ["add", "--", `projects/${slug}/team.json`, `activity/${me.id}.jsonl`]);
    await git(content, [...authorArgs(me), "commit", "-q", "-m", `${me.name}: ${take ? "editing" : "done editing"} ${slug}`]);
    if (!(await remoteUrl(content))) return team;
    const push = await git(content, ["push", "origin", await branch(content)], true);
    if (push.code === 0) return team;
    // Someone pushed first: undo my lock commit and look again.
    await git(content, ["reset", "-q", "--hard", head]);
  }
  throw new Error("couldn't record the check-out; try again");
}

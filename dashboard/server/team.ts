// Team files on disk (DEC-15 step 2) and their API: who I am, members, folders, per-project team
// and review, and the activity feed. Everything is keyed by member id so async sync can merge it.
import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Scene } from "../../remotion/src/types";
import { emptyReview, sceneHash, scriptHash, type ReviewFile } from "../src/review";
import { canApproveScript, hasRole, type Activity, type Member, type Members, type Role, type Team, type Workspace } from "../src/team";
import { contentRoot, localDir } from "./paths";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SCENE_ID = /^[a-z0-9]+$/;
const ROLES: Role[] = ["admin", "publisher", "editor", "reviewer"];

const readJson = async <T>(file: string, fallback: T): Promise<T> =>
  existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : fallback;
const writeJson = async (file: string, data: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
};

const projectDir = (root: string, slug: string) => path.join(contentRoot(root), "projects", slug);

export const readMembers = (root: string) => readJson<Members>(path.join(contentRoot(root), "members.json"), { members: [] });
export const readWorkspace = (root: string) =>
  readJson<Workspace>(path.join(contentRoot(root), "workspace.json"), { folders: [], projects: {} });
export const writeWorkspace = (root: string, ws: Workspace) => writeJson(path.join(contentRoot(root), "workspace.json"), ws);
export const readTeam = (root: string, slug: string) => readJson<Team>(path.join(projectDir(root, slug), "team.json"), {});
export const writeTeam = (root: string, slug: string, team: Team) => writeJson(path.join(projectDir(root, slug), "team.json"), team);
export const readReview = (root: string, slug: string) =>
  readJson<ReviewFile>(path.join(projectDir(root, slug), "review.json"), emptyReview());
const writeReview = (root: string, slug: string, r: ReviewFile) => writeJson(path.join(projectDir(root, slug), "review.json"), r);

// .studio/me.json lives with the code, not the content: it says which member this computer is.
const meFile = (root: string) => path.join(localDir(root), "me.json");
export const readMe = async (root: string): Promise<Member | null> => {
  const { member } = await readJson<{ member?: string }>(meFile(root), {});
  return (await readMembers(root)).members.find((m) => m.id === member) ?? null;
};

// activity/<member>.jsonl: append-only, one file per member, so it never conflicts.
export const logActivity = async (root: string, event: Omit<Activity, "at">) => {
  if (!SLUG.test(event.by)) return;
  const dir = path.join(contentRoot(root), "activity");
  await mkdir(dir, { recursive: true });
  await appendFile(path.join(dir, `${event.by}.jsonl`), JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n");
};

const readActivity = async (root: string, limit: number, project: string | null) => {
  const dir = path.join(contentRoot(root), "activity");
  if (!existsSync(dir)) return [];
  const events: Activity[] = [];
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    for (const line of (await readFile(path.join(dir, f), "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as Activity;
        if (!project || e.project === project) events.push(e);
      } catch {
        /* a half-written line from a crash: skip it */
      }
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
};

const json = (res: ServerResponse, code: number, body: unknown) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

// Handles /api/me, /api/members, /api/workspace, /api/activity and /api/projects/:slug/{review,approve,team}.
// Returns false for anything else.
export async function handleTeamApi(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  parts: string[],
  body: () => Promise<any>,
): Promise<boolean> {
  const method = req.method ?? "GET";
  const me = await readMe(root);
  const needMe = () => (me ? null : json(res, 409, { error: "pick-member" }));

  if (parts[0] === "me" && parts.length === 1) {
    if (method === "GET") return json(res, 200, { me, members: (await readMembers(root)).members }), true;
    if (method === "PUT") {
      const { member } = await body();
      if (!(await readMembers(root)).members.some((m) => m.id === member)) return json(res, 400, { error: "no such member" }), true;
      await writeJson(meFile(root), { member });
      return json(res, 200, { me: await readMe(root) }), true;
    }
  }

  if (parts[0] === "members" && parts.length === 1 && method === "PUT") {
    if (needMe()) return true;
    if (!hasRole(me, "admin")) return json(res, 403, { error: "only an admin can change members" }), true;
    const { members } = await body();
    const ids = new Set<string>();
    const clean: Member[] = [];
    for (const m of members ?? []) {
      const id = String(m.id ?? "");
      if (!SLUG.test(id) || ids.has(id) || !String(m.name ?? "").trim()) return json(res, 400, { error: `bad member: ${id}` }), true;
      ids.add(id);
      clean.push({ id, name: String(m.name).trim().slice(0, 40), roles: (m.roles ?? []).filter((r: Role) => ROLES.includes(r)) });
    }
    if (!clean.some((m) => m.roles.includes("admin"))) return json(res, 400, { error: "keep at least one admin" }), true;
    await writeJson(path.join(contentRoot(root), "members.json"), { members: clean });
    return json(res, 200, { members: clean }), true;
  }

  if (parts[0] === "workspace" && parts.length === 1) {
    if (method === "GET") return json(res, 200, await readWorkspace(root)), true;
    if (method === "PUT") {
      const input = await body();
      if (!Array.isArray(input?.folders) || typeof input.projects !== "object") return json(res, 400, { error: "bad workspace" }), true;
      const ids = new Set<string>();
      const ws: Workspace = { folders: [], projects: {} };
      for (const f of input.folders) {
        if (!SLUG.test(String(f.id)) || ids.has(f.id) || !String(f.name ?? "").trim()) return json(res, 400, { error: "bad folder" }), true;
        ids.add(f.id);
        ws.folders.push({ id: f.id, name: String(f.name).trim().slice(0, 60) });
      }
      const before = await readWorkspace(root);
      for (const [slug, p] of Object.entries<{ folder?: string }>(input.projects)) {
        if (SLUG.test(slug) && p.folder && ids.has(p.folder)) ws.projects[slug] = { folder: p.folder };
      }
      await writeWorkspace(root, ws);
      if (me) {
        for (const slug of new Set([...Object.keys(ws.projects), ...Object.keys(before.projects)])) {
          if (ws.projects[slug]?.folder !== before.projects[slug]?.folder) {
            const name = ws.folders.find((f) => f.id === ws.projects[slug]?.folder)?.name ?? "Unfiled";
            await logActivity(root, { by: me.id, project: slug, type: "project.moved", note: name });
          }
        }
      }
      return json(res, 200, ws), true;
    }
  }

  if (parts[0] === "activity" && parts.length === 1 && method === "GET") {
    const limit = Math.min(200, Number(url.searchParams.get("limit")) || 50);
    return json(res, 200, await readActivity(root, limit, url.searchParams.get("project"))), true;
  }

  if (parts[0] !== "projects" || !SLUG.test(parts[1] ?? "") || parts.length !== 3) return false;
  const slug = parts[1];
  const action = parts[2];
  if (!["review", "approve", "team"].includes(action) || method !== "POST") return false;
  const projectFile = path.join(projectDir(root, slug), "project.json");
  if (!existsSync(projectFile)) return json(res, 404, { error: "no such project" }), true;
  if (needMe()) return true;
  const project = JSON.parse(await readFile(projectFile, "utf8"));
  const team = await readTeam(root, slug);
  const review = await readReview(root, slug);
  const reply = async () => json(res, 200, { team: await readTeam(root, slug), review: await readReview(root, slug) });

  // My review of one scene: { scene, status: "approved" | "changes" | null, comment? }
  if (action === "review") {
    const { scene: sid, status, comment } = await body();
    const scene = project.scenes.find((s: { id: string }) => s.id === sid);
    if (!SCENE_ID.test(String(sid)) || !scene) return json(res, 400, { error: "no such scene" }), true;
    const mine = { ...review.scenes[sid] };
    if (status === "approved" || status === "changes") {
      const note = String(comment ?? "").trim().slice(0, 1000);
      if (status === "changes" && !note) return json(res, 400, { error: "say what should change" }), true;
      mine[me!.id] = { status, hash: sceneHash(scene), at: new Date().toISOString(), ...(note ? { comment: note } : {}) };
    } else {
      delete mine[me!.id];
    }
    review.scenes[sid] = mine;
    // A change request (or clearing a review) withdraws the whole-script approval.
    if (status !== "approved") review.approval = null;
    await writeReview(root, slug, review);
    const type = status === "approved" ? "review.approved" : status === "changes" ? "review.changes" : "review.cleared";
    await logActivity(root, { by: me!.id, project: slug, type, scene: sid, ...(comment ? { note: String(comment).slice(0, 200) } : {}) });
    return await reply(), true;
  }

  // Approve or revoke the whole script: the owner only (an admin when there is no owner).
  if (action === "approve") {
    const { approve } = await body();
    if (!canApproveScript(me, team)) return json(res, 403, { error: "only the video's owner can approve the script" }), true;
    if (approve) {
      const openRequest = project.scenes.some((s: Scene) =>
        Object.values(review.scenes[s.id] ?? {}).some((r) => r.status === "changes" && r.hash === sceneHash(s)),
      );
      if (openRequest) {
        return json(res, 409, { error: "resolve the requested changes first" }), true;
      }
      const at = new Date().toISOString();
      for (const s of project.scenes) {
        const mine = review.scenes[s.id]?.[me!.id];
        if (!mine || mine.hash !== sceneHash(s) || mine.status !== "approved") {
          review.scenes[s.id] = { ...review.scenes[s.id], [me!.id]: { status: "approved", hash: sceneHash(s), at } };
        }
      }
      review.approval = { by: me!.id, at, scriptHash: scriptHash(project) };
    } else {
      review.approval = null;
    }
    await writeReview(root, slug, review);
    await logActivity(root, { by: me!.id, project: slug, type: approve ? "script.approved" : "script.revoked" });
    return await reply(), true;
  }

  // Team changes: { owner } (owner or admin) and { uploaded: true | false } (the manual YouTube mark).
  if (action === "team") {
    const input = await body();
    const isAdmin = hasRole(me, "admin");
    if ("owner" in input) {
      if (!(isAdmin || !team.owner || team.owner === me!.id)) return json(res, 403, { error: "only the owner or an admin can hand over a video" }), true;
      if (!(await readMembers(root)).members.some((m) => m.id === input.owner)) return json(res, 400, { error: "no such member" }), true;
      team.owner = input.owner;
      await logActivity(root, { by: me!.id, project: slug, type: "team.owner", note: input.owner });
    }
    if ("uploaded" in input) {
      const published = { ...team.published };
      if (input.uploaded) published.youtube = { ...published.youtube, at: published.youtube?.at ?? new Date().toISOString(), by: me!.id };
      else delete published.youtube;
      team.published = published;
      await logActivity(root, { by: me!.id, project: slug, type: input.uploaded ? "published.marked" : "published.unmarked" });
    }
    await writeTeam(root, slug, team);
    return await reply(), true;
  }
  return false;
}

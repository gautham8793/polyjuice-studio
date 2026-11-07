// Local API for the dashboard, mounted into the Vite dev server as middleware.
// Everything is file-based: projects/<slug>/project.json is the source of truth.
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import type { Plugin } from "vite";
import { compositionFor } from "../../remotion/src/templates/SceneVideo";
import { buildPublish, type MusicCredit } from "../src/publish";
import { contentRoot, python, remotionCli, reveal } from "./paths";
import { reviewSummary } from "../src/review";
import { connectInstagram, disconnectInstagram, GraphError, instagramStatus, prepareReel, publishReel, type PublishJob } from "./instagram";
import { previewTimeline } from "../src/timeline";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SCENE_ID = /^[a-z0-9]+$/;
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const DOWNLOAD_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org", "images.pexels.com"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "aiff", "aif", "webm", "flac"]);
const MAX_UPLOAD = 50 * 1024 * 1024;
const CONTENT_ROOTS = ["projects", "library", "brand"]; // served from the content root
const STATIC_ROOTS = [...CONTENT_ROOTS, "out"];
const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  svg: "image/svg+xml", wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
  ogg: "audio/ogg", flac: "audio/flac", aiff: "audio/aiff", aif: "audio/aiff", webm: "audio/webm",
  mp4: "video/mp4", json: "application/json", md: "text/markdown; charset=utf-8",
};
const VOICE_ID = /^([a-z]{2}_[a-z]+|en-IN-Chirp3-HD-[A-Za-z]+)$/; // Kokoro or Google Indian English

// projects/_workspace.json: sidebar folders and the one status that can't be derived (uploaded).
export type Workspace = {
  folders: { id: string; name: string }[];
  projects: Record<string, { folder?: string; uploadedAt?: string; url?: string; instagram?: Published }>;
};
// Written by the server after a successful publish; the browser can't set or clear it.
export type Published = { id: string; url: string; at: string };

export type MusicTag = { file: string; title: string; artist: string; mood: string[]; attribution: string | null };

type Job = {
  status: "running" | "done" | "error";
  stage: string;
  progress: number;
  log: string;
  output?: string;
  folder?: string;
  warnings?: string[];
};
const renderJobs = new Map<string, Job>();
const instagramJobs = new Map<string, PublishJob>();

export const apiPlugin = (root: string, env: { PEXELS_API_KEY?: string }): Plugin => ({
  name: "video-dashboard-api",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      try {
        if (url.pathname.startsWith("/api/")) return await handleApi(root, env, req, res, url);
        const top = url.pathname.split("/")[1];
        if (STATIC_ROOTS.includes(top)) return await serveStatic(CONTENT_ROOTS.includes(top) ? contentRoot(root) : root, url.pathname, req, res);
      } catch (err) {
        return json(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      next();
    });
  },
});

async function handleApi(
  root: string,
  env: { PEXELS_API_KEY?: string },
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) {
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  const method = req.method ?? "GET";

  if (parts[0] === "projects" && parts.length === 1 && method === "GET") {
    return json(res, 200, await listProjects(root));
  }

  if (parts[0] === "workspace" && parts.length === 1) {
    if (method === "GET") return json(res, 200, { ...(await readWorkspace(root)), user: userInfo().username });
    if (method === "PUT") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      if (!Array.isArray(body?.folders) || typeof body.projects !== "object") return json(res, 400, { error: "bad workspace" });
      const ids = new Set<string>();
      const current = await readWorkspace(root);
      const ws: Workspace = { folders: [], projects: {} };
      for (const f of body.folders) {
        if (!SLUG.test(String(f.id)) || ids.has(f.id) || !String(f.name ?? "").trim()) return json(res, 400, { error: "bad folder" });
        ids.add(f.id);
        ws.folders.push({ id: f.id, name: String(f.name).trim().slice(0, 60) });
      }
      for (const [slug, p] of Object.entries<Workspace["projects"][string]>(body.projects)) {
        if (!SLUG.test(slug)) continue;
        const entry = {
          ...(p.folder && ids.has(p.folder) ? { folder: p.folder } : {}),
          ...(p.uploadedAt ? { uploadedAt: String(p.uploadedAt) } : {}),
          ...(p.url ? { url: String(p.url) } : {}),
          ...(current.projects[slug]?.instagram ? { instagram: current.projects[slug].instagram } : {}),
        };
        if (Object.keys(entry).length) ws.projects[slug] = entry;
      }
      await writeJson(path.join(contentRoot(root), "projects", "_workspace.json"), ws);
      return json(res, 200, { ...ws, user: userInfo().username });
    }
  }

  // Brand & theme library: brand/brand.json
  if (parts[0] === "brand" && parts.length === 1) {
    const brandFile = path.join(contentRoot(root), "brand", "brand.json");
    if (method === "GET") {
      return json(res, 200, JSON.parse(await readFile(brandFile, "utf8")));
    }
    if (method === "PUT") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      if (!body || typeof body !== "object" || !body.presets || !Object.keys(body.presets).length) {
        return json(res, 400, { error: "brand.presets must have at least one theme" });
      }
      if (!body.presets[body.active]) {
        body.active = Object.keys(body.presets)[0];
      }
      await writeJson(brandFile, body);
      return json(res, 200, body);
    }
  }

  // Connected accounts. Tokens stay in secrets/ on this machine; responses never include them.
  if (parts[0] === "instagram" && parts[1] === "connection" && parts.length === 2) {
    if (method === "GET") return json(res, 200, await instagramStatus(root));
    if (method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const brand = JSON.parse(await readFile(path.join(contentRoot(root), "brand", "brand.json"), "utf8"));
      try {
        const input = { userToken: String(body.userToken ?? ""), appId: String(body.appId ?? ""), appSecret: String(body.appSecret ?? "") };
        return json(res, 200, await connectInstagram(root, input, brand.handle));
      } catch (e) {
        if (e instanceof GraphError) return json(res, 400, { error: e.message });
        throw e;
      }
    }
    if (method === "DELETE") {
      await disconnectInstagram(root);
      return json(res, 200, { connected: false });
    }
  }

  // Upload the newest export as an unpublished draft to prove the pipeline works. Never publishes.
  if (parts[0] === "instagram" && parts[1] === "test-upload" && method === "POST") {
    const latest = (await listProjects(root)).filter((p) => p.exportedAt).sort((a, b) => b.exportedAt! - a.exportedAt!)[0];
    if (!latest) return json(res, 400, { error: "Export a video first." });
    const video = path.join(root, "out", latest.slug, `${latest.slug}.mp4`);
    const job: PublishJob = { status: "running", stage: "" };
    try {
      await prepareReel(root, { video, caption: "Upload test (not published)", coverMs: 2000, name: `test-${Date.now()}.mp4` }, job);
      return json(res, 200, { ok: true, video: `${latest.slug}.mp4` });
    } catch (e) {
      return json(res, 400, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (parts[0] === "search" && method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    if (parts[1] === "wikimedia") return json(res, 200, await searchWikimedia(q));
    if (parts[1] === "pexels") {
      if (!env.PEXELS_API_KEY) return json(res, 400, { error: "no-pexels-key" });
      return json(res, 200, await searchPexels(q, env.PEXELS_API_KEY));
    }
  }

  if (parts[0] === "music") {
    const musicDir = path.join(contentRoot(root), "library", "music");
    if (method === "GET") return json(res, 200, await listMusic(root));
    if (method === "POST") {
      const name = safeFileName(url.searchParams.get("filename") ?? "");
      if (!AUDIO_EXTS.has(extOf(name))) return json(res, 400, { error: "unsupported audio type" });
      await writeFile(path.join(musicDir, name), await readBody(req));
      return json(res, 200, await listMusic(root));
    }
    if (method === "PUT") {
      const tag: MusicTag = JSON.parse((await readBody(req)).toString("utf8"));
      if (!existsSync(path.join(musicDir, path.basename(tag.file)))) return json(res, 404, { error: "no such track" });
      const tags = await readTags(root);
      tags.tracks = [...tags.tracks.filter((t) => t.file !== tag.file), { ...tag, file: path.basename(tag.file) }];
      await writeJson(path.join(musicDir, "tags.json"), tags);
      return json(res, 200, await listMusic(root));
    }
  }

  // Character library: library/characters/<id>/character.json (+ reference sheet), styles.json
  if (parts[0] === "characters") {
    const charDir = path.join(contentRoot(root), "library", "characters");
    if (parts.length === 1 && method === "GET") return json(res, 200, await loadCharacters(root));
    const id = parts[1] ?? "";
    if (!SLUG.test(id) || !existsSync(path.join(charDir, id, "character.json"))) return json(res, 404, { error: "no such character" });
    const file = path.join(charDir, id, "character.json");
    const character = JSON.parse(await readFile(file, "utf8"));
    if (parts.length === 2 && method === "PUT") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      await writeJson(file, { ...character, name: String(body.name ?? character.name), description: String(body.description ?? character.description) });
      return json(res, 200, await loadCharacters(root));
    }
    if (parts[2] === "sheet" && method === "POST") {
      const ext = extOf(url.searchParams.get("filename") ?? "");
      if (!IMAGE_EXTS.has(ext)) return json(res, 400, { error: `unsupported image type: ${ext || "unknown"}` });
      const name = `sheet-${Date.now()}.${ext}`;
      await writeFile(path.join(charDir, id, name), await readBody(req));
      await writeJson(file, { ...character, sheet: `library/characters/${id}/${name}` });
      return json(res, 200, await loadCharacters(root));
    }
  }

  // Short cached sample of a voice (Kokoro or Google), for the voice picker.
  if (parts[0] === "voice-sample" && method === "POST") {
    const { voiceId, speed } = JSON.parse((await readBody(req)).toString("utf8"));
    const rate = Number(speed) || 1;
    if (!VOICE_ID.test(voiceId) || rate < 0.5 || rate > 2) return json(res, 400, { error: "bad voice" });
    const rel = `library/voice-samples/${voiceId}@${rate}.wav`;
    if (!existsSync(path.join(contentRoot(root), rel))) {
      await mkdir(path.join(contentRoot(root), "library/voice-samples"), { recursive: true });
      const text = "The blue whale is the largest animal that has ever lived. Its heart alone weighs as much as a piano.";
      const r = await run(python(root),
        ["tools/tts.py", text, path.join(contentRoot(root), rel), "--voice", voiceId, "--speed", String(rate)], root);
      if (r.code !== 0) return json(res, 500, { error: r.out.slice(-500) });
    }
    return json(res, 200, { url: `/${rel}` });
  }

  if (parts[0] !== "projects" || !SLUG.test(parts[1] ?? "")) return json(res, 404, { error: "not found" });
  const slug = parts[1];
  const dir = path.join(contentRoot(root), "projects", slug);
  if (!existsSync(path.join(dir, "project.json"))) return json(res, 404, { error: "no such project" });

  // /api/projects/:slug
  if (parts.length === 2) {
    if (method === "GET") return json(res, 200, await loadProject(root, slug));
    if (method === "PUT") {
      const project = JSON.parse((await readBody(req)).toString("utf8"));
      if (!Array.isArray(project?.scenes)) return json(res, 400, { error: "project.scenes missing" });
      // Refuse to overwrite edits made elsewhere (Claude Code, another tab) since this copy was loaded.
      const expected = Number(req.headers["if-match"]);
      const current = await projectVersion(dir);
      if (expected && expected !== current) return json(res, 409, { error: "changed-on-disk", version: current });
      await writeJson(path.join(dir, "project.json"), project);
      return json(res, 200, { ok: true, version: await projectVersion(dir) });
    }
  }

  const action = parts[2];

  if (action === "validate" && method === "POST") {
    const r = await run(python(root), ["tools/validate_project.py", slug], root);
    return json(res, 200, { ok: r.code === 0, log: r.out });
  }

  if (action === "voice" && method === "POST") {
    const r = await run(python(root), ["tools/prepare.py", slug], root);
    const log = r.out.split("\n").filter((l) => /^s\d+:|wrote|Error|error:/.test(l)).join("\n");
    return json(res, r.code === 0 ? 200 : 500, { ok: r.code === 0, log: log || r.out.slice(-2000) });
  }

  if (action === "reveal" && method === "POST") {
    const folder = path.join(root, "out", slug);
    if (!existsSync(folder)) return json(res, 404, { error: "not exported yet" });
    reveal(folder);
    return json(res, 200, { ok: true });
  }

  // /api/projects/:slug/instagram — what would be posted (GET), or publish the exported Reel (POST)
  if (action === "instagram" && parts.length === 3) {
    if (method === "GET") {
      const { video: _, ...pre } = await instagramPreflight(root, slug);
      return json(res, 200, { ...pre, job: instagramJobs.get(slug) ?? null });
    }
    if (method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      if (instagramJobs.get(slug)?.status === "running") return json(res, 409, { error: "already publishing" });
      const pre = await instagramPreflight(root, slug);
      if (pre.blockers.length) return json(res, 400, { error: pre.blockers.join(" ") });
      if (pre.published && !body.again) return json(res, 409, { error: `Already on Instagram: ${pre.published.url}` });
      if (body.confirm !== true) return json(res, 400, { error: "confirm required" });
      startInstagramPublish(root, slug, pre.video!, pre.caption!);
      return json(res, 202, instagramJobs.get(slug));
    }
  }

  if (action === "render") {
    if (method === "GET") return json(res, 200, renderJobs.get(slug) ?? null);
    if (method === "POST") {
      if (renderJobs.get(slug)?.status === "running") return json(res, 409, { error: "already rendering" });
      startRender(root, slug);
      return json(res, 202, renderJobs.get(slug));
    }
  }

  // /api/projects/:slug/recording/:sceneId — upload an own-voice take (or ?clear=1 to go back to AI voice)
  if (action === "recording" && method === "POST" && SCENE_ID.test(parts[3] ?? "")) {
    const sceneId = parts[3];
    const projectPath = path.join(dir, "project.json");
    const project = JSON.parse(await readFile(projectPath, "utf8"));
    const scene = project.scenes.find((s: { id: string }) => s.id === sceneId);
    if (!scene) return json(res, 404, { error: "no such scene" });
    if (url.searchParams.get("clear")) {
      scene.recording = null;
    } else {
      const ext = extOf(url.searchParams.get("filename") ?? "");
      if (!AUDIO_EXTS.has(ext)) return json(res, 400, { error: `unsupported audio type: ${ext || "unknown"}` });
      await mkdir(path.join(dir, "recordings"), { recursive: true });
      const file = `recordings/${sceneId}-${Date.now()}.${ext}`;
      await writeFile(path.join(dir, file), await readBody(req));
      scene.recording = file;
    }
    await writeJson(projectPath, project);
    return json(res, 200, { project, version: await projectVersion(dir) });
  }

  // /api/projects/:slug/assets/:sceneId[/from-url]
  if (action === "assets" && method === "POST" && SCENE_ID.test(parts[3] ?? "")) {
    const sceneId = parts[3];
    let data: Buffer;
    let ext: string;
    let meta: Record<string, string | null>;

    if (parts[4] === "from-url") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const src = new URL(body.url);
      if (src.protocol !== "https:" || !DOWNLOAD_HOSTS.has(src.hostname)) {
        return json(res, 400, { error: `downloads only allowed from ${[...DOWNLOAD_HOSTS].join(", ")}` });
      }
      const r = await fetch(src, { headers: { "User-Agent": "VideoDashboard/0.1 (local tool)" } });
      if (!r.ok) return json(res, 502, { error: `download failed: ${r.status}` });
      data = Buffer.from(await r.arrayBuffer());
      ext = extFromType(r.headers.get("content-type")) ?? extOf(src.pathname);
      meta = { source: body.pageUrl ?? body.url, license: body.license, credit: body.credit };
    } else {
      data = await readBody(req);
      ext = extOf(url.searchParams.get("filename") ?? "");
      meta = { source: "upload", license: url.searchParams.get("license"), credit: null };
    }
    if (!IMAGE_EXTS.has(ext)) return json(res, 400, { error: `unsupported image type: ${ext || "unknown"}` });
    if (data.length > 25 * 1024 * 1024) return json(res, 413, { error: "image larger than 25 MB" });

    await mkdir(path.join(dir, "assets"), { recursive: true });
    const file = `assets/${sceneId}-${Date.now()}.${ext}`;
    await writeFile(path.join(dir, file), data);

    const projectPath = path.join(dir, "project.json");
    const project = JSON.parse(await readFile(projectPath, "utf8"));
    const scene = project.scenes.find((s: { id: string }) => s.id === sceneId);
    if (!scene) return json(res, 404, { error: "no such scene" });
    scene.visual = { ...scene.visual, asset: file, ...meta };
    await writeJson(projectPath, project);
    return json(res, 200, { project, version: await projectVersion(dir) });
  }

  return json(res, 404, { error: "not found" });
}

async function listProjects(root: string) {
  const dirs = await readdir(path.join(contentRoot(root), "projects"), { withFileTypes: true });
  const out = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !SLUG.test(d.name)) continue;
    const p = path.join(contentRoot(root), "projects", d.name, "project.json");
    if (!existsSync(p)) continue;
    const project = JSON.parse(await readFile(p, "utf8"));
    const visuals = project.scenes.filter((s: { kind: string }) => s.kind !== "outro");
    const tl = path.join(contentRoot(root), "projects", d.name, "timeline.json");
    const timeline = existsSync(tl) ? JSON.parse(await readFile(tl, "utf8")) : null;
    const video = path.join(root, "out", d.name, `${d.name}.mp4`);
    out.push({
      slug: d.name,
      title: project.title,
      style: project.style,
      template: project.template,
      scenes: project.scenes.length,
      assetsFilled: visuals.filter((s: { visual?: { asset?: string } }) => s.visual?.asset).length,
      assetsTotal: visuals.length,
      modified: (await stat(p)).mtimeMs,
      format: project.format ?? null,
      series: project.series?.name ?? null,
      needsVoice: previewTimeline(project, timeline).stale.length,
      exportedAt: existsSync(video) ? (await stat(video)).mtimeMs : null,
      review: reviewSummary(project),
    });
  }
  return out.sort((a, b) => b.modified - a.modified);
}

async function readWorkspace(root: string): Promise<Workspace> {
  const p = path.join(contentRoot(root), "projects", "_workspace.json");
  return existsSync(p) ? JSON.parse(await readFile(p, "utf8")) : { folders: [], projects: {} };
}

async function loadCharacters(root: string) {
  const dir = path.join(contentRoot(root), "library", "characters");
  const stylesFile = path.join(dir, "styles.json");
  const styles = existsSync(stylesFile) ? JSON.parse(await readFile(stylesFile, "utf8")) : {};
  const characters = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, d.name, "character.json");
    if (d.isDirectory() && existsSync(f)) characters.push(JSON.parse(await readFile(f, "utf8")));
  }
  return { styles, characters };
}

async function readTags(root: string): Promise<{ tracks: MusicTag[] }> {
  const p = path.join(contentRoot(root), "library", "music", "tags.json");
  return existsSync(p) ? JSON.parse(await readFile(p, "utf8")) : { tracks: [] };
}

const durationCache = new Map<string, { mtime: number; seconds: number }>();

async function audioDuration(file: string) {
  const mtime = (await stat(file)).mtimeMs;
  const cached = durationCache.get(file);
  if (cached?.mtime === mtime) return cached.seconds;
  const r = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], path.dirname(file));
  const seconds = Number(r.out.trim()) || 0;
  durationCache.set(file, { mtime, seconds });
  return seconds;
}

// Every audio file in library/music, merged with its tags (untagged files get defaults).
async function listMusic(root: string) {
  const dir = path.join(contentRoot(root), "library", "music");
  const tags = new Map((await readTags(root)).tracks.map((t) => [t.file, t]));
  const files = (await readdir(dir)).filter((f) => AUDIO_EXTS.has(extOf(f))).sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      path: `library/music/${file}`,
      duration: await audioDuration(path.join(dir, file)),
      title: tags.get(file)?.title ?? file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      artist: tags.get(file)?.artist ?? "",
      mood: tags.get(file)?.mood ?? [],
      attribution: tags.get(file)?.attribution ?? null,
      tagged: tags.has(file),
    })),
  );
}

const projectVersion = async (dir: string) => (await stat(path.join(dir, "project.json"))).mtimeMs;

async function loadProject(root: string, slug: string) {
  const dir = path.join(contentRoot(root), "projects", slug);
  const read = async (f: string) => (existsSync(path.join(dir, f)) ? readFile(path.join(dir, f), "utf8") : null);
  const timeline = await read("timeline.json");
  return {
    slug,
    projectPath: `projects/${slug}`,
    project: JSON.parse((await read("project.json"))!),
    version: await projectVersion(dir),
    timeline: timeline ? JSON.parse(timeline) : null,
    research: await read("research.md"),
  };
}

// Export package: out/<slug>/<slug>.mp4 + cover.png + youtube.txt + instagram.txt + metadata.json
function startRender(root: string, slug: string) {
  const job: Job = { status: "running", stage: "Preparing", progress: 0, log: "" };
  renderJobs.set(slug, job);
  (async () => {
    const check = await run(python(root), ["tools/validate_project.py", slug], root);
    if (check.code !== 0) throw new Error(`Fix these before exporting:\n${check.out}`);
    const props = await run(python(root), ["tools/render_props.py", slug], root);
    if (props.code !== 0) throw new Error(props.out);
    const propsFile = path.join(tmpdir(), `video-props-${slug}.json`);
    await writeFile(propsFile, props.out);
    const folder = `out/${slug}`;
    await mkdir(path.join(root, folder), { recursive: true });
    const remotionDir = path.join(root, "remotion");
    const [node, cli] = remotionCli(root);
    const publicDir = `--public-dir=${contentRoot(root)}`;

    const composition = compositionFor(JSON.parse(props.out).project);

    job.stage = "Rendering video";
    const video = `${folder}/${slug}.mp4`;
    const r = await run(
      node,
      [...cli, "render", "src/index.ts", composition, path.join(root, video), `--props=${propsFile}`, publicDir],
      remotionDir,
      (chunk) => {
        const m = [...chunk.matchAll(/Rendered (\d+)\/(\d+)/g)].pop();
        if (m) job.progress = Number(m[1]) / Number(m[2]);
      },
    );
    job.log = r.out.slice(-3000);
    if (r.code !== 0) throw new Error("render failed");

    // Cover: the hook once its title has fully animated in (~2s).
    job.stage = "Making cover";
    const coverProps = path.join(tmpdir(), `video-props-${slug}-cover.json`);
    await writeFile(coverProps, JSON.stringify({ ...JSON.parse(props.out), coverMode: true }));
    const cover = await run(
      node,
      [...cli, "still", "src/index.ts", composition, path.join(root, folder, "cover.png"), "--frame=60", `--props=${coverProps}`, publicDir],
      remotionDir,
    );
    if (cover.code !== 0) throw new Error(`cover failed\n${cover.out.slice(-1500)}`);

    job.stage = "Writing texts";
    const { project, research } = await loadProject(root, slug);
    const text = buildPublish(project, research, await musicCredit(root, project.music?.track));
    await writeFile(path.join(root, folder, "youtube.txt"), `${text.youtubeTitle}\n\n${text.youtubeDescription}\n`);
    await writeFile(path.join(root, folder, "instagram.txt"), `${text.instagramCaption}\n`);
    if (text.tags) await writeFile(path.join(root, folder, "tags.txt"), `${text.tags}\n`);
    if (text.pinnedComment) await writeFile(path.join(root, folder, "pinned-comment.txt"), `${text.pinnedComment}\n`);
    await writeJson(path.join(root, folder, "metadata.json"), { exportedAt: new Date().toISOString(), ...text });

    job.status = "done";
    job.stage = "Done";
    job.progress = 1;
    job.output = `/${video}?t=${Date.now()}`;
    job.folder = folder;
    job.warnings = text.warnings;
  })().catch((err) => {
    job.status = "error";
    job.log = `${String(err)}\n${job.log}`;
  });
}

// Reels are posted from the Export package only, so what goes out is exactly what was reviewed.
async function instagramPreflight(root: string, slug: string) {
  const video = path.join(root, "out", slug, `${slug}.mp4`);
  const captionFile = path.join(root, "out", slug, "instagram.txt");
  const published = (await readWorkspace(root)).projects[slug]?.instagram ?? null;
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(video) || !existsSync(captionFile)) {
    return { ready: false, blockers: ["Export the video first."], warnings, published };
  }
  const caption = (await readFile(captionFile, "utf8")).trim();
  const { project } = await loadProject(root, slug);
  const exportedAt = (await stat(video)).mtimeMs;
  const sizeMb = (await stat(video)).size / 1024 / 1024;
  const probe = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], root);
  const seconds = Number(probe.out.trim()) || 0;
  const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;

  if (caption.length > 2200) blockers.push(`Caption is ${caption.length} characters; Instagram allows 2,200.`);
  if (hashtags > 30) blockers.push(`Caption has ${hashtags} hashtags; Instagram allows 30.`);
  if (seconds && (seconds < 3 || seconds > 15 * 60)) blockers.push(`Video is ${Math.round(seconds)} s; Reels must be 3 s to 15 min.`);
  if (sizeMb > 1000) blockers.push(`Video is ${Math.round(sizeMb)} MB; the upload limit is 1 GB.`);
  if ((project.format ?? "short-9x16") !== "short-9x16") warnings.push("This is a 16:9 video; Reels are 9:16, so it will show with bars.");
  if ((await projectVersion(path.join(contentRoot(root), "projects", slug))) > exportedAt) {
    warnings.push("The project was edited after the last Export. Export again if those edits should be in the post.");
  }
  if (published) warnings.push(`Already posted on ${new Date(published.at).toLocaleString()}: ${published.url}`);
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    published,
    video,
    caption,
    exportedAt,
    sizeMb: Math.round(sizeMb * 10) / 10,
    seconds: Math.round(seconds),
  };
}

function startInstagramPublish(root: string, slug: string, video: string, caption: string) {
  const job: PublishJob = { status: "running", stage: "Starting" };
  instagramJobs.set(slug, job);
  (async () => {
    // The cover is the same frame as cover.png (frame 60 at 30 fps).
    const { mediaId, permalink } = await publishReel(root, { video, caption, coverMs: 2000, name: `${slug}-${Date.now()}.mp4` }, job);
    const ws = await readWorkspace(root);
    const entry = ws.projects[slug] ?? {};
    ws.projects[slug] = { ...entry, uploadedAt: entry.uploadedAt ?? new Date().toISOString(), instagram: { id: mediaId, url: permalink, at: new Date().toISOString() } };
    await writeJson(path.join(contentRoot(root), "projects", "_workspace.json"), ws);
    Object.assign(job, { status: "done", stage: "Posted", mediaId, permalink });
  })().catch((err) => {
    Object.assign(job, { status: "error", stage: "Failed", error: err instanceof Error ? err.message : String(err) });
  });
}

async function musicCredit(root: string, track?: string): Promise<MusicCredit> {
  if (!track) return null;
  const tag = (await readTags(root)).tracks.find((t) => `library/music/${t.file}` === track);
  return { title: tag?.title ?? path.basename(track), attribution: tag?.attribution ?? null, artist: tag?.artist };
}

async function searchWikimedia(q: string) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrlimit: "24",
    gsrsearch: `${q} filetype:bitmap`, prop: "imageinfo", iiprop: "url|extmetadata|size",
    iiurlwidth: "1600", origin: "*",
  }).forEach(([k, v]) => api.searchParams.set(k, v));
  const r = await fetch(api, { headers: { "User-Agent": "VideoDashboard/0.1 (local tool)" } });
  const data = await r.json();
  const pages = Object.values<any>(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const strip = (html?: string) => (html ?? "").replace(/<[^>]+>/g, "").trim();
  return pages
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata ?? {};
      return {
        id: String(p.pageid),
        thumb: info.thumburl,
        full: info.thumburl ?? info.url,
        title: p.title.replace(/^File:/, ""),
        width: info.width,
        height: info.height,
        license: strip(meta.LicenseShortName?.value) || "See source",
        credit: strip(meta.Artist?.value) || "Unknown",
        pageUrl: info.descriptionurl,
      };
    })
    .filter(Boolean);
}

async function searchPexels(q: string, key: string) {
  const r = await fetch(`https://api.pexels.com/v1/search?per_page=24&orientation=portrait&query=${encodeURIComponent(q)}`, {
    headers: { Authorization: key },
  });
  if (!r.ok) throw new Error(`Pexels error ${r.status}`);
  const data = await r.json();
  return data.photos.map((p: any) => ({
    id: String(p.id),
    thumb: p.src.medium,
    full: p.src.large2x,
    title: p.alt || `Photo by ${p.photographer}`,
    width: p.width,
    height: p.height,
    license: "Pexels License",
    credit: `${p.photographer} / Pexels`,
    pageUrl: p.url,
  }));
}

async function serveStatic(root: string, pathname: string, req: IncomingMessage, res: ServerResponse) {
  const file = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!file.startsWith(root + path.sep) || !existsSync(file) || !(await stat(file)).isFile()) {
    res.statusCode = 404;
    return res.end();
  }
  const size = (await stat(file)).size;
  const type = MIME[extOf(file)] ?? "application/octet-stream";
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", end - start + 1);
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.setHeader("Content-Length", size);
  createReadStream(file).pipe(res);
}

function run(cmd: string, args: string[], cwd: string, onData?: (chunk: string) => void) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    // PYTHONUTF8: Python on Windows would otherwise read and write files as cp1252
    const child = spawn(cmd, args, { cwd, env: { ...process.env, PYTHONWARNINGS: "ignore", PYTHONUTF8: "1" } });
    let out = "";
    const collect = (b: Buffer) => {
      const s = b.toString();
      out += s;
      onData?.(s);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
    child.on("error", (err) => resolve({ code: 1, out: String(err) }));
  });
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_UPLOAD + 1024) reject(new Error("request too large"));
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const writeJson = (file: string, data: unknown) => writeFile(file, JSON.stringify(data, null, 2) + "\n");
const safeFileName = (name: string) => {
  const { name: stem, ext } = path.parse(path.basename(name).toLowerCase());
  return `${stem.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "track"}${ext.replace(/[^a-z0-9.]/g, "")}`;
};
const extOf = (p: string) => path.extname(p).slice(1).toLowerCase().split("?")[0];
const extFromType = (t: string | null) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[t?.split(";")[0] ?? ""];

function json(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

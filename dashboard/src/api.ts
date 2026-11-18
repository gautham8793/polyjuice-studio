import type { Brand, Project, Timeline } from "../../remotion/src/types";
import type { ReviewFile, ReviewSummary } from "./review";
import type { Activity, Member, Team, Workspace } from "./team";
import type { InstagramStatus, PublishJob } from "../server/instagram";
import type { SyncProgress, SyncReport, SyncStatus } from "../server/sync";
import type { YouTubeStatus } from "../server/youtube";
import type { CombinedJob, PublishCheck } from "../server/api";
import type { PublishedEntry } from "./team";

export type { CombinedJob, PublishCheck, SyncProgress, SyncReport, SyncStatus, YouTubeStatus };

export type PublishPreflight = {
  checks: PublishCheck[];
  ready: boolean;
  preview: { url: string; sizeMb: number | null; seconds: number | null; format: string } | null;
  text: { title: string; description: string; tags: string; pinnedComment: string } | null;
  youtube: { status: YouTubeStatus; published: PublishedEntry | null };
  instagram: { allowed: boolean; account: string | null; ready: boolean; blockers: string[]; warnings: string[]; published: PublishedEntry | null }; // allowed: false for long-form (YouTube only)
  job: CombinedJob | null;
};

export type { InstagramStatus, PublishJob, Workspace };

export type InstagramPreflight = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  published: { id: string; url: string; at: string } | null;
  caption?: string;
  exportedAt?: number;
  sizeMb?: number;
  seconds?: number;
  job: PublishJob | null;
};

export type ProjectSummary = {
  slug: string;
  title: string;
  style: string;
  template: string;
  scenes: number;
  assetsFilled: number;
  assetsTotal: number;
  modified: number;
  format: string | null;
  series: string | null;
  needsVoice: number; // scenes whose voice is missing or out of date
  exportedAt: number | null; // mtime of out/<slug>/<slug>.mp4
  review: ReviewSummary;
  owner: string | null; // member id
  uploadedAt: string | null; // first YouTube / Instagram publish in team.json
};

export type LoadedProject = {
  slug: string;
  projectPath: string;
  project: Project;
  timeline: Timeline | null;
  research: string | null;
  version: number;
  review: ReviewFile;
  team: Team;
};

export type TeamUpdate = { review: ReviewFile; team: Team };

export type SearchResult = {
  id: string;
  thumb: string;
  full: string;
  title: string;
  width: number;
  height: number;
  license: string;
  credit: string;
  pageUrl: string;
};

export type RenderJob = {
  status: "running" | "done" | "error";
  stage: string;
  progress: number;
  log: string;
  output?: string;
  folder?: string;
  warnings?: string[];
} | null;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const body = await r.json();
  if (!r.ok) throw new Error(body?.reason ?? body?.error ?? `HTTP ${r.status}`); // reason: why a video is locked
  return body as T;
}

const post = (body?: unknown): RequestInit =>
  ({ method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

export const api = {
  listProjects: () => call<ProjectSummary[]>("/api/projects"),
  me: () => call<{ me: Member | null; members: Member[] }>("/api/me"),
  setMe: (member: string) => call<{ me: Member }>("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member }) }),
  saveMembers: (members: Member[]) =>
    call<{ members: Member[] }>("/api/members", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ members }) }),
  activity: (project?: string, limit = 50) =>
    call<Activity[]>(`/api/activity?limit=${limit}${project ? `&project=${encodeURIComponent(project)}` : ""}`),
  reviewScene: (slug: string, scene: string, status: "approved" | "changes" | null, comment?: string) =>
    call<TeamUpdate>(`/api/projects/${slug}/review`, post({ scene, status, comment })),
  approveScript: (slug: string, approve: boolean) => call<TeamUpdate>(`/api/projects/${slug}/approve`, post({ approve })),
  setOwner: (slug: string, owner: string) => call<TeamUpdate>(`/api/projects/${slug}/team`, post({ owner })),
  setUploaded: (slug: string, uploaded: boolean) => call<TeamUpdate>(`/api/projects/${slug}/team`, post({ uploaded })),
  syncStatus: (fetchRemote = false) => call<SyncStatus>(`/api/sync${fetchRemote ? "?fetch=1" : ""}`),
  runSync: () => call<SyncReport>("/api/sync", post()),
  testStore: () => call<{ ok: boolean; store: string | null; steps: string[] }>("/api/sync/test-store", post()),
  initSync: (remote?: string) => call<SyncStatus>("/api/sync/init", post({ remote })),
  joinSync: (remote: string) => call<SyncStatus>("/api/sync/join", post({ remote })),
  lock: (slug: string, take: boolean) => call<{ team: Team; version: number }>(`/api/projects/${slug}/lock`, post({ take })),
  getWorkspace: () => call<Workspace>("/api/workspace"),
  saveWorkspace: (ws: Workspace) =>
    call<Workspace>("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ws),
    }),
  loadProject: (slug: string) => call<LoadedProject>(`/api/projects/${slug}`),
  saveProject: (slug: string, project: Project, version: number) =>
    call<{ ok: true; version: number }>(`/api/projects/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": String(version) },
      body: JSON.stringify(project),
    }),
  validate: (slug: string) => call<{ ok: boolean; log: string }>(`/api/projects/${slug}/validate`, post()),
  generateVoice: (slug: string) => call<{ ok: boolean; log: string }>(`/api/projects/${slug}/voice`, post()),
  startRender: (slug: string) => call<RenderJob>(`/api/projects/${slug}/render`, post()),
  renderStatus: (slug: string) => call<RenderJob>(`/api/projects/${slug}/render`),
  reveal: (slug: string) => call<{ ok: true }>(`/api/projects/${slug}/reveal`, post()),
  uploadAsset: (slug: string, sceneId: string, file: File) =>
    call<{ project: Project; version: number }>(`/api/projects/${slug}/assets/${sceneId}?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      body: file,
    }),
  assetFromUrl: (slug: string, sceneId: string, result: SearchResult) =>
    call<{ project: Project; version: number }>(
      `/api/projects/${slug}/assets/${sceneId}/from-url`,
      post({ url: result.full, pageUrl: result.pageUrl, license: result.license, credit: result.credit }),
    ),
  search: (provider: "wikimedia" | "pexels", q: string) =>
    call<SearchResult[]>(`/api/search/${provider}?q=${encodeURIComponent(q)}`),
  uploadRecording: (slug: string, sceneId: string, file: File) =>
    call<{ project: Project; version: number }>(`/api/projects/${slug}/recording/${sceneId}?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      body: file,
    }),
  clearRecording: (slug: string, sceneId: string) =>
    call<{ project: Project; version: number }>(`/api/projects/${slug}/recording/${sceneId}?clear=1`, post()),
  listMusic: () => call<MusicTrack[]>("/api/music"),
  uploadMusic: (file: File) =>
    call<MusicTrack[]>(`/api/music?filename=${encodeURIComponent(file.name)}`, { method: "POST", body: file }),
  tagMusic: (tag: Pick<MusicTrack, "file" | "title" | "artist" | "mood" | "attribution">) =>
    call<MusicTrack[]>("/api/music", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tag) }),
  voiceSample: (voiceId: string, speed: number) => call<{ url: string }>("/api/voice-sample", post({ voiceId, speed })),
  characters: () => call<CharacterLibrary>("/api/characters"),
  updateCharacter: (c: Pick<Character, "id" | "name" | "description">) =>
    call<CharacterLibrary>(`/api/characters/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    }),
  uploadSheet: (id: string, file: File) =>
    call<CharacterLibrary>(`/api/characters/${id}/sheet?filename=${encodeURIComponent(file.name)}`, { method: "POST", body: file }),
  instagramStatus: () => call<InstagramStatus>("/api/instagram/connection"),
  youtubeStatus: () => call<YouTubeStatus>("/api/youtube/connection"),
  disconnectYoutube: () => call<YouTubeStatus>("/api/youtube/disconnect", post()),
  publishPreflight: (slug: string) => call<PublishPreflight>(`/api/projects/${slug}/publish`),
  publish: (slug: string, to: { youtube: boolean; instagram: boolean; again?: boolean }) => call<CombinedJob>(`/api/projects/${slug}/publish`, post(to)),
  connectInstagram: (creds: { userToken: string; appId: string; appSecret: string }) =>
    call<InstagramStatus>("/api/instagram/connection", post(creds)),
  instagramPreflight: (slug: string) => call<InstagramPreflight>(`/api/projects/${slug}/instagram`),
  publishInstagram: (slug: string, again = false) =>
    call<PublishJob>(`/api/projects/${slug}/instagram`, post({ confirm: true, again })),
  testInstagramUpload: () => call<{ ok: true; video: string }>("/api/instagram/test-upload", post()),
  disconnectInstagram: () => call<InstagramStatus>("/api/instagram/connection", { method: "DELETE" }),
  getBrand: () => call<Brand>("/api/brand"),
  saveBrand: (brand: Brand) =>
    call<Brand>("/api/brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    }),
};

export type Character = {
  id: string;
  name: string;
  description: string; // fixed visual description, reused in every prompt
  sheet: string | null; // reference image, relative to the Video/ root
};

export type StylePreset = { label: string; prompt: string };

export type CharacterLibrary = { styles: Record<string, StylePreset>; characters: Character[] };

export type MusicTrack = {
  file: string;
  path: string;
  duration: number;
  title: string;
  artist: string;
  mood: string[];
  attribution: string | null;
  tagged: boolean;
};

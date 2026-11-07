import type { Project, Scene } from "../../remotion/src/types";

// FNV-1a (32-bit) over UTF-8, as hex. Mirrored by narration_hash() in tools/validate_project.py.
export const textHash = (text: string) => {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export const sceneHash = (scene: Scene) => textHash(scene.narration.trim());
export const scriptHash = (project: Project) =>
  textHash(project.scenes.map((s) => `${s.id}\n${s.narration.trim()}`).join("\n\n"));

// projects/<slug>/review.json. Every member keeps their own review per scene, so two reviewers
// never overwrite each other; only the owner's approval of the whole script counts (Q6).
export type SceneReview = {
  status: "approved" | "changes";
  comment?: string; // what to change (or a note on an approval)
  hash: string; // narration hash at the time of review — the review goes stale when it changes
  at: string; // ISO time
};
export type ReviewFile = {
  scenes: Record<string, Record<string, SceneReview>>; // scene id → member id → review
  approval?: { by: string; at: string; scriptHash: string } | null;
};
export const emptyReview = (): ReviewFile => ({ scenes: {}, approval: null });

// "edited": reviewed, but the narration changed since, so it needs another look.
export type SceneReviewState = "pending" | "approved" | "changes" | "edited";

// One member's view of a scene.
export const memberSceneState = (review: ReviewFile, scene: Scene, member: string): SceneReviewState => {
  const r = review.scenes[scene.id]?.[member];
  if (!r) return "pending";
  return r.hash === sceneHash(scene) ? r.status : "edited";
};

// The scene as a whole: any current change request wins, then any current approval.
export const sceneReviewState = (review: ReviewFile, scene: Scene): SceneReviewState => {
  const states = Object.keys(review.scenes[scene.id] ?? {}).map((m) => memberSceneState(review, scene, m));
  if (states.includes("changes")) return "changes";
  if (states.includes("approved")) return "approved";
  return states.length ? "edited" : "pending";
};

export type ReviewSummary = {
  // approved: whole script signed off for the current narration · stale: signed off, then edited
  state: "none" | "in-progress" | "changes" | "approved" | "stale";
  approved: number;
  changes: number;
  total: number;
  approvedBy: string | null;
};

export const reviewSummary = (project: Project, review: ReviewFile): ReviewSummary => {
  const states = project.scenes.map((s) => sceneReviewState(review, s));
  const approved = states.filter((s) => s === "approved").length;
  const changes = states.filter((s) => s === "changes").length;
  const a = review.approval;
  const state = a
    ? a.scriptHash === scriptHash(project) ? "approved" : "stale"
    : changes ? "changes" : approved || states.includes("edited") ? "in-progress" : "none";
  return { state, approved, changes, total: states.length, approvedBy: a?.by ?? null };
};

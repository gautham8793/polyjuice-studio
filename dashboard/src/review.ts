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

// "edited": reviewed, but the narration changed since, so it needs another look.
export type SceneReviewState = "pending" | "approved" | "changes" | "edited";

export const sceneReviewState = (project: Project, scene: Scene): SceneReviewState => {
  const r = project.review?.scenes?.[scene.id];
  if (!r) return "pending";
  return r.hash === sceneHash(scene) ? r.status : "edited";
};

export type ReviewSummary = {
  // approved: whole script signed off for the current narration · stale: signed off, then edited
  state: "none" | "in-progress" | "changes" | "approved" | "stale";
  approved: number;
  changes: number;
  total: number;
};

export const reviewSummary = (project: Project): ReviewSummary => {
  const states = project.scenes.map((s) => sceneReviewState(project, s));
  const approved = states.filter((s) => s === "approved").length;
  const changes = states.filter((s) => s === "changes").length;
  const r = project.review;
  const state = r?.approvedAt
    ? r.scriptHash === scriptHash(project) ? "approved" : "stale"
    : changes ? "changes" : approved || states.includes("edited") ? "in-progress" : "none";
  return { state, approved, changes, total: states.length };
};

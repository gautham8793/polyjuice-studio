import type { Project, Scene, Timeline } from "../../remotion/src/types";

const WORDS_PER_SECOND = 2.35; // same estimate as tools/validate_project.py

// Mirrors voice_key() in tools/prepare.py — what the scene's audio should be generated from.
export const voiceKey = (scene: Scene, project: Project) => {
  if (scene.recording) return `rec:${scene.recording}`;
  const speed = project.voice?.speed ?? 1;
  // Python writes floats as "1.0", JS as "1" — match Python so whole-number speeds aren't "stale"
  let key = `${project.voice?.voiceId}@${Number.isInteger(speed) ? speed.toFixed(1) : speed}`;
  const tempo = project.voice?.tempo;
  if (tempo && tempo !== 1) key += `~${Number.isInteger(tempo) ? tempo.toFixed(1) : tempo}`; // sped up afterwards
  // silent beats inside the line (prepare.py speak_with_pauses); Python writes 0.7 as "0.7", 1 as "1.0"
  if (scene.pauses?.length) key += "|p:" + scene.pauses.map((p) => `${p.after}+${Number.isInteger(p.seconds) ? p.seconds.toFixed(1) : p.seconds}`).join(",");
  return scene.ttsText ? `${key}|${scene.ttsText}` : key;
};

// Builds the timeline the preview plays: real voice + captions for scenes whose narration and
// voice still match what was generated, and a silent, estimated-length stand-in for the rest.
export const previewTimeline = (project: Project, timeline: Timeline | null) => {
  const voiced = new Map((timeline?.scenes ?? []).map((s) => [s.id, s]));
  const stale: string[] = [];
  const scenes = project.scenes.map((scene) => {
    const t = voiced.get(scene.id);
    const key = voiceKey(scene, project);
    // Timelines from before voiceKey existed only recorded narration.
    if (t && t.narration === scene.narration && (t.voiceKey ?? key) === key) return t;
    stale.push(scene.id);
    const words = scene.narration.trim().split(/\s+/).filter(Boolean).length;
    return { id: scene.id, audio: null, duration: Math.max(1.5, words / WORDS_PER_SECOND), words: [] };
  });
  return { timeline: { scenes } as Timeline, stale };
};

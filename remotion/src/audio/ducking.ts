// Background-music volume: ducks under the voice, fades in/out. Pure functions so the
// dashboard and tests can use them too.

export type Interval = { start: number; end: number }; // frames

const MERGE_GAP = 10; // frames — pauses shorter than this stay ducked
const RAMP = 8; // frames to ease between ducked and full volume
const FADE_IN = 15;
const FADE_OUT = 45;

// Speaking intervals for the whole video, from each scene's start frame + word timings (seconds).
export const speakingIntervals = (
  scenes: { start: number; words: { start: number; end: number }[] }[],
  fps: number,
): Interval[] => {
  const raw = scenes
    .flatMap((s) => s.words.map((w) => ({ start: s.start + w.start * fps, end: s.start + w.end * fps })))
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv.start - last.end <= MERGE_GAP) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  return merged;
};

// 0 = no voice nearby (full music), 1 = voice speaking (fully ducked), eased in between.
const duckAmount = (frame: number, intervals: Interval[]) => {
  let nearest = Infinity;
  for (const iv of intervals) {
    if (frame >= iv.start && frame <= iv.end) return 1;
    nearest = Math.min(nearest, Math.abs(frame - iv.start), Math.abs(frame - iv.end));
  }
  return Math.max(0, 1 - nearest / RAMP);
};

export const musicVolume = (
  frame: number,
  totalFrames: number,
  intervals: Interval[],
  volume: number,
  duckTo: number,
) => {
  const fade = Math.min(1, frame / FADE_IN, (totalFrames - frame) / FADE_OUT);
  const level = volume + (duckTo - volume) * duckAmount(frame, intervals);
  return Math.max(0, level * fade);
};

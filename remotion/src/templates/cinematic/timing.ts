// Shared timing helpers for the cinematic template.
import { Easing } from "remotion";
import type { ShotTiming, Word } from "../../types";

export const EASE = {
  inOut: Easing.inOut(Easing.cubic),
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
  linear: Easing.linear,
};

export const TONES = { blue: "#4FA8FF", red: "#FF4D6A", gold: "#F5B700", violet: "#B98CFF", white: "#FFFFFF" };

export const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

// Frame at which a timing starts: its cue word, else `start` seconds, else the fallback.
export const startFrame = (t: ShotTiming | undefined, words: Word[] | undefined, fps: number, fallback = 0) => {
  if (t?.cue) {
    const w = words?.find((x) => norm(x.text).startsWith(norm(t.cue!)));
    if (w) return Math.round(w.start * fps) - 4;
  }
  return t?.start !== undefined ? Math.round(t.start * fps) : fallback;
};

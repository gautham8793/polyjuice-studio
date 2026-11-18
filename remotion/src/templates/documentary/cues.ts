// Word-cue timing shared by every documentary layout: each scene's word timings (from the voice)
// are provided here, so a piece can appear when the narrator says its word (`cue`), falling back
// to its fixed start frame when the word isn't found.
import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import type { Word } from "./parts";

export const CueWords = createContext<Word[]>([]);
const normCue = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

export const useCue = () => {
  const words = useContext(CueWords);
  const { fps } = useVideoConfig();
  return (cue: string | undefined, fallback: number, lead = 4) => {
    if (!cue) return fallback;
    const c = normCue(cue.split(/\s+/)[0]);
    const w = c ? words.find((x) => normCue(x.text).startsWith(c)) : undefined;
    return w ? Math.max(0, Math.round(w.start * fps) - lead) : fallback;
  };
};

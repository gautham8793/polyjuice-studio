import { Audio, staticFile, useVideoConfig } from "remotion";
import { type Interval, musicVolume } from "../audio/ducking";
import type { Music } from "../types";

// Looping music bed for the whole video, ducked under the voice.
export const BackgroundMusic: React.FC<{ music: Music; speaking: Interval[] }> = ({ music, speaking }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <Audio
      src={staticFile(music.track)}
      loop
      trimBefore={Math.round((music.startAt ?? 0) * fps)}
      volume={(f) => musicVolume(f, durationInFrames, speaking, music.volume, music.duckTo)}
    />
  );
};

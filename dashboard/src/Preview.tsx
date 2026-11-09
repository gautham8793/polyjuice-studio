import { Player, type PlayerRef } from "@remotion/player";
import { forwardRef } from "react";
import { FPS, frameSize, SceneVideo, videoDurationInFrames, type VideoProps } from "../../remotion/src/templates/SceneVideo";
import type { Brand, Project, Timeline } from "../../remotion/src/types";

type Props = { project: Project; timeline: Timeline; projectPath: string; brand: Brand };

export const Preview = forwardRef<PlayerRef, Props>(({ project, timeline, projectPath, brand }, ref) => {
  const inputProps: VideoProps = {
    project,
    timeline,
    brand,
    projectPath,
    presetId: project.theme,
  };
  const { width, height } = frameSize(project);
  return (
    <Player
      ref={ref}
      component={SceneVideo}
      inputProps={inputProps}
      durationInFrames={Math.max(1, videoDurationInFrames(timeline))}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      controls
      clickToPlay
      // voice + music + several sound effects per shot, and two shots overlap during cinematic
      // crossfades: the default of 5 audio tags crashes the preview
      numberOfSharedAudioTags={16}
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: `${width} / ${height}`, borderRadius: 14, overflow: "hidden" }}
    />
  );
});

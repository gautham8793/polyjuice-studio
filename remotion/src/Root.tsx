import { Composition, staticFile, type CalculateMetadataFunction } from "remotion";
import { ChannelBanner } from "./brand/ChannelBanner";
import { SetupTest } from "./SetupTest";
import { DOC_SAMPLE_FRAMES, DocSample, docTimeline, VOICE_FILE, type DocSampleProps } from "./templates/documentary/DocSample";
import { FontBoard } from "./templates/documentary/FontBoard";
import { calculateVideoMetadata, FPS, SceneVideo, type VideoProps } from "./templates/SceneVideo";
import type { Brand, Project, Timeline } from "./types";

// Studio samples: only the project path is fixed here. The project, its timeline and the brand are
// fetched from the content root when Studio opens the composition, so the code builds without content.
// Real renders pass everything via --props and skip the fetch.
const sample = (slug: string) => ({ projectPath: `projects/${slug}` }) as VideoProps;

const loadJson = (file: string) => fetch(staticFile(file)).then((r) => r.json());

const withSample: CalculateMetadataFunction<VideoProps> = async (args) => {
  let props = args.props;
  if (!props.project) {
    const [project, timeline, brand] = await Promise.all([
      loadJson(`${props.projectPath}/project.json`) as Promise<Project>,
      loadJson(`${props.projectPath}/timeline.json`) as Promise<Timeline>,
      loadJson("brand/brand.json") as Promise<Brand>,
    ]);
    props = { ...props, project, timeline, brand };
  }
  return { ...(await calculateVideoMetadata({ ...args, props })), props };
};

// Documentary sample: load the sample voice (if generated) and size the composition to it.
const withDocVoice: CalculateMetadataFunction<DocSampleProps> = async ({ props }) => {
  const voice = props.voice ?? (await fetch(staticFile(VOICE_FILE)).then((r) => (r.ok ? r.json() : undefined)).catch(() => undefined));
  return { durationInFrames: docTimeline(voice).total, props: { ...props, voice } };
};

// Shorts / Reels: 1080x1920 @ 30fps. Both templates share one engine; the default props are
// samples for Studio — real renders pass a project via --props.
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Listicle"
        component={SceneVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={300}
        defaultProps={sample("2026-11-types-of-whales")}
        calculateMetadata={withSample}
      />
      <Composition
        id="Analogy"
        component={SceneVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={300}
        defaultProps={sample("2026-11-body-security-guards")}
        calculateMetadata={withSample}
      />
      <Composition
        id="Explainer"
        component={SceneVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={300}
        defaultProps={sample("2026-11-election-1-big-picture")}
        calculateMetadata={withSample}
      />
      <Composition
        id="Newsroom"
        component={SceneVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={300}
        defaultProps={sample("2026-11-election-1-big-picture")}
        calculateMetadata={withSample}
      />
      {/* Cinematic: 16:9 long-form (YouTube), 1920x1080 — and the same shots laid out for Shorts, 1080x1920 */}
      <Composition
        id="Cinematic"
        component={SceneVideo}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={300}
        defaultProps={sample("2026-11-car-t-cells")}
        calculateMetadata={withSample}
      />
      <Composition
        id="CinematicVertical"
        component={SceneVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={300}
        defaultProps={sample("2026-11-car-t-cells")}
        calculateMetadata={withSample}
      />
      {/* Documentary: paper-collage long-form (16:9) and its Shorts (9:16), project-driven */}
      <Composition id="Documentary" component={SceneVideo} width={1920} height={1080} fps={FPS} durationInFrames={300} defaultProps={sample("library/doc-template/sample-project")} calculateMetadata={withSample} />
      <Composition id="DocumentaryVertical" component={SceneVideo} width={1080} height={1920} fps={FPS} durationInFrames={300} defaultProps={sample("library/doc-template/sample-project")} calculateMetadata={withSample} />
      {/* Documentary template — look-development sample (M-Pesa beat), 16:9 and 9:16 */}
      <Composition id="DocSample" component={DocSample} width={1920} height={1080} fps={30} durationInFrames={DOC_SAMPLE_FRAMES} defaultProps={{}} calculateMetadata={withDocVoice} />
      <Composition id="DocFontBoard" component={FontBoard} width={1920} height={1080} fps={30} durationInFrames={1} />
      <Composition id="DocSampleVertical" component={DocSample} width={1080} height={1920} fps={30} durationInFrames={DOC_SAMPLE_FRAMES} defaultProps={{}} calculateMetadata={withDocVoice} />
      <Composition
        id="ChannelBanner"
        component={ChannelBanner}
        width={2048}
        height={1152}
        fps={30}
        durationInFrames={1}
        defaultProps={{ showSafeArea: false }}
      />
      <Composition
        id="SetupTest"
        component={SetupTest}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={60}
      />
    </>
  );
};

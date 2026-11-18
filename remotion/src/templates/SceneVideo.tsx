// The engine every template renders through: lays scenes out back-to-back by their voice
// length, adds captions, voice, ducked music and the persistent chrome. Templates differ only
// in which scene kinds they use (listicle: hook/item/outro, analogy: hook/character/beat/outro,
// explainer: hook/item/scoreboard/measure/beat/diagram/map/outro, newsroom: hook/beat/comment/outro
// drawn in the news layout).
import { AbsoluteFill, Audio, type CalculateMetadataFunction, getRemotionEnvironment, interpolate, prefetch, Sequence, staticFile, useCurrentFrame, CanvasImage } from "remotion";
import { useEffect } from "react";
import { speakingIntervals } from "../audio/ducking";
import { BackgroundMusic } from "../components/BackgroundMusic";
import { Captions } from "../components/Captions";
import { Chrome, PunchIn } from "../components/Chrome";
import { resolveTheme, ThemeProvider } from "../theme";
import type { Brand, Branding, Project, Timeline, TimelineScene } from "../types";
import { BeatScene, CharacterScene } from "./analogy/scenes";
import { DiagramScene } from "./explainer/diagram";
import { MapScene } from "./explainer/map";
import { ChartScene, CommentScene, MeasureScene, QuizScene, ScoreboardScene, StatsScene } from "./explainer/scenes";
import { ShotScene } from "./cinematic/shot";
import { HookScene, ItemScene, OutroScene } from "./listicle/scenes";
import { NewsBeatScene, NewsHookScene, NewsOutroScene } from "./newsroom/scenes";
import { ChannelCtx, DocCover, DocScene, docChapters } from "./documentary/scenes";
import { GraphGrid } from "./documentary/chips";
import { BeatFade, CHANNEL_LOGO, ChannelTag, Drift, Paper, TORN_SHEET, WordCaption } from "./documentary/parts";

export const FPS = 30;
const TAIL_SECONDS = 0.35; // breathing room after each scene's narration
const CROSSFADE = 12; // cinematic: frames each shot fades in over the end of the previous one

export type VideoProps = {
  project: Project;
  timeline: Timeline;
  brand: Brand;
  projectPath: string; // e.g. "projects/2026-11-types-of-whales"
  presetId?: string;
  coverMode?: boolean; // still frame for the cover image: no captions or progress bar
};

// Remotion composition id for each template
export const COMPOSITION_FOR_TEMPLATE: Record<string, string> = {
  listicle: "Listicle",
  analogy: "Analogy",
  explainer: "Explainer",
  cinematic: "Cinematic",
  newsroom: "Newsroom",
  documentary: "Documentary",
};

// Vertical (9:16) cinematic videos — Shorts cut from a long-form one — use their own composition.
export const compositionFor = (project: Pick<Project, "template" | "format" | "cut">) =>
  project.cut === "desk"
    ? "DeskCut"
    : (project.template === "cinematic" || project.template === "documentary") && project.format?.startsWith("short")
    ? `${COMPOSITION_FOR_TEMPLATE[project.template]}Vertical`
    : (COMPOSITION_FOR_TEMPLATE[project.template] ?? "Listicle");

// Frame size for a project: long-form is 16:9, everything else is 9:16.
export const frameSize = (project: Pick<Project, "format">) =>
  project.format?.startsWith("long") ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };

const sceneFrames = (s: TimelineScene) => Math.ceil((s.duration + (s.hold ?? 0) + TAIL_SECONDS) * FPS);

export const videoDurationInFrames = (timeline: Timeline) =>
  timeline.scenes.reduce((sum, s) => sum + sceneFrames(s), 0);

// Start frame of each scene, in timeline order — used by the dashboard to seek the preview.
export const sceneStarts = (timeline: Timeline): Record<string, number> => {
  const starts: Record<string, number> = {};
  let from = 0;
  for (const s of timeline.scenes) {
    starts[s.id] = from;
    from += sceneFrames(s);
  }
  return starts;
};

export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: videoDurationInFrames(props.timeline),
});

const SCENE_COMPONENTS = {
  hook: HookScene,
  item: ItemScene,
  character: CharacterScene,
  beat: BeatScene,
  scoreboard: ScoreboardScene,
  measure: MeasureScene,
  stats: StatsScene,
  chart: ChartScene,
  quiz: QuizScene,
  comment: CommentScene,
  diagram: DiagramScene,
  map: MapScene,
  shot: ShotScene,
  doc: DocScene,
  outro: OutroScene,
};

// The newsroom template redraws the hook and beats in its own layout; other kinds are shared.
const NEWSROOM_COMPONENTS = { ...SCENE_COMPONENTS, hook: NewsHookScene, beat: NewsBeatScene, outro: NewsOutroScene };

// When the "intro" channel card slides in: `introAt` seconds, or the start of scene `introAt` (+0.5 s).
// Short videos fall back to ~40% in so the card never runs past the end.
const introFrame = (branding: Branding, starts: Record<string, number>, total: number) => {
  const at = branding.introAt ?? 0;
  const frame = typeof at === "string" ? (starts[at] ?? 0) + Math.round(0.5 * FPS) : Math.max(8, Math.round(at * FPS));
  const length = Math.round((branding.introCta === "subscribe" ? 4.5 : 3) * FPS) + 20;
  return frame + length > total ? Math.round(total * 0.4) : frame;
};

// Fades a shot in over the tail of the previous one (instead of the punch-in cut).
const FadeIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: frames ? interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" }) : 1 }}>{children}</AbsoluteFill>;
};

/** Frames the designed cover is shown at the start of a Short (project.cover.inVideo). */
export const COVER_IN_VIDEO_FRAMES = 15;

// Documentary template: paper page, one layout per scene (scene.doc), word captions in the
// documentary style, chapter chrome carried from the last chapter card. Same scene timing as
// every other template, so the dashboard's seek positions still line up.
const DocumentaryVideo: React.FC<VideoProps> = ({ project, timeline, brand, projectPath, coverMode }) => {
  // In the browser player, load the paper sheet once up front, so cards don't flash while it loads
  useEffect(() => {
    if (!getRemotionEnvironment().isPlayer) return;
    const { free } = prefetch(staticFile(TORN_SHEET));
    return free;
  }, []);
  const channel = { name: brand?.channelName ?? "The Polyjuice Project", handle: brand?.handle ?? "", logo: CHANNEL_LOGO };
  const timing = new Map(timeline.scenes.map((s) => [s.id, s]));
  const starts = sceneStarts(timeline);
  const speaking = speakingIntervals(timeline.scenes.map((s) => ({ start: starts[s.id], words: s.words })), FPS);
  const chapters = docChapters(project);
  let from = 0;
  if (coverMode)
    // Export's cover still: a designed thumbnail, not whatever scene is on screen at that frame
    return (
      <AbsoluteFill>
        <Paper />
        {project.docBackground === "grid" && project.cover?.art !== "object" && <GraphGrid />}
        <DocCover project={project} />
      </AbsoluteFill>
    );
  // the channel tag stays on screen until the end card, which shows the channel in full
  const endStart = (() => {
    let f = 0;
    for (const sc of project.scenes) {
      const tt = timing.get(sc.id);
      if (!tt) continue;
      if (sc.doc?.layout === "end") return f;
      f += sceneFrames(tt);
    }
    return f;
  })();
  return (
    <ChannelCtx.Provider value={channel}>
    <AbsoluteFill>
      <Paper />
      {project.docBackground === "grid" && <GraphGrid />}
      {project.scenes.map((scene, index) => {
        const t = timing.get(scene.id);
        if (!t) return null;
        const frames = sceneFrames(t);
        const start = from;
        from += frames;
        return (
          <Sequence key={scene.id} from={start} durationInFrames={frames} name={`${scene.id} · ${scene.doc?.layout ?? scene.kind}`}>
            <BeatFade dur={frames} last={index === project.scenes.length - 1}>
              <Drift dur={frames}>
                <DocScene scene={scene} projectPath={projectPath} index={index} words={t.words} project={project} chapter={chapters[index]} />
              </Drift>
              {!coverMode && scene.doc?.layout !== "end" && <WordCaption words={t.words} offset={0} />}
            </BeatFade>
            {t.audio && <Audio src={`${staticFile(t.audio)}?v=${t.hash ?? ""}`} />}
          </Sequence>
        );
      })}
      {project.music && <BackgroundMusic music={project.music} speaking={speaking} />}
      {!coverMode && (
        <Sequence durationInFrames={Math.max(1, endStart)} name="channel tag">
          <ChannelTag channel={channel} />
        </Sequence>
      )}
      {!coverMode && project.cover?.inVideo && (
        // Shorts: the designed cover is the video's first half second, so Instagram's cover
        // (thumb_offset) and YouTube's Shorts frame picker can use it; the hook's voice runs underneath
        <Sequence durationInFrames={COVER_IN_VIDEO_FRAMES} name="cover">
          <AbsoluteFill>
            <Paper />
            <DocCover project={project} />
          </AbsoluteFill>
        </Sequence>
      )}
    </AbsoluteFill>
    </ChannelCtx.Provider>
  );
};

export const SceneVideo: React.FC<VideoProps> = (props) =>
  props.project.template === "documentary" ? <DocumentaryVideo {...props} /> : <ClassicVideo {...props} />;

const ClassicVideo: React.FC<VideoProps> = ({ project, timeline, brand, projectPath, presetId, coverMode }) => {
  const base = resolveTheme(brand, presetId ?? project.theme);
  const theme = { ...base, captions: { ...base.captions, ...project.captions } };
  const branding: Branding = { watermark: "footer", source: "footer", ...brand.branding, ...project.branding };
  const timing = new Map(timeline.scenes.map((s) => [s.id, s]));
  const starts = sceneStarts(timeline);
  const speaking = speakingIntervals(
    timeline.scenes.map((s) => ({ start: starts[s.id], words: s.words })),
    FPS,
  );
  const characterIds = project.scenes.filter((s) => s.kind === "character").map((s) => s.id);
  const cinematic = project.template === "cinematic";

  let from = 0;
  let outroStart: number | undefined;
  return (
    <>
      <ThemeProvider value={theme}>
        <AbsoluteFill style={{ backgroundColor: theme.background }}>
          {project.scenes.map((scene, index) => {
            const t = timing.get(scene.id);
            if (!t) return null;
            const frames = sceneFrames(t);
            const SceneComponent = (project.template === "newsroom" ? NEWSROOM_COMPONENTS : SCENE_COMPONENTS)[scene.kind];
            const start = from;
            from += frames;
            const Cut = project.template === "newsroom" ? AbsoluteFill : PunchIn; // newsroom: the glitch is drawn on the picture inside the scene
            if (scene.kind === "outro") outroStart = start;
            if (cinematic) {
              // every scene is a shot; the picture starts CROSSFADE frames early to dissolve in,
              // so its cue words are shifted by the same amount
              const lead = Math.min(CROSSFADE, start);
              const shifted = t.words.map((w) => ({ ...w, start: w.start + lead / FPS, end: w.end + lead / FPS }));
              return (
                <Sequence key={scene.id} from={start - lead} durationInFrames={frames + lead} name={`${scene.id} · ${scene.name ?? scene.kind}`}>
                  <FadeIn frames={lead}>
                    <ShotScene scene={scene} projectPath={projectPath} index={index} words={shifted} project={project} />
                  </FadeIn>
                  <Sequence from={lead}>
                    {/* the end card's title already says the line */}
                    {!coverMode && scene.kind !== "outro" && !scene.shot?.hideCaptions && <Captions words={t.words} />}
                    {t.audio && <Audio src={`${staticFile(t.audio)}?v=${t.hash ?? ""}`} />}
                  </Sequence>
                </Sequence>
              );
            }
            return (
              <Sequence key={scene.id} from={start} durationInFrames={frames} name={`${scene.id} · ${scene.name ?? scene.kind}`}>
                {/* back-to-back diagram (or map) scenes continue one camera move, so no punch-in cut between them */}
                {(scene.kind === "diagram" || scene.kind === "map") && project.scenes[index - 1]?.kind === scene.kind ? (
                  <SceneComponent scene={scene} projectPath={projectPath} index={index} words={t.words} project={project} />
                ) : (
                  <Cut>
                    <SceneComponent
                      scene={scene}
                      projectPath={projectPath}
                      index={index}
                      number={characterIds.indexOf(scene.id) + 1}
                      words={t.words}
                      project={project}
                    />
                  </Cut>
                )}
                {(scene.kind !== "outro" || scene.argon) && !coverMode && <Captions words={t.words} />}
                {/* ?v= busts the browser cache when a scene's voice is regenerated under the same filename */}
                {t.audio && <Audio src={`${staticFile(t.audio)}?v=${t.hash ?? ""}`} />}
              </Sequence>
            );
          })}
          {project.music && <BackgroundMusic music={project.music} speaking={speaking} />}
          {!coverMode && (
            <Chrome hideWatermarkFrom={outroStart} series={project.series} branding={branding} progressBar={!cinematic} introFrom={introFrame(branding, starts, videoDurationInFrames(timeline))} />
          )}
        </AbsoluteFill>
      </ThemeProvider>
    </>
  );
};

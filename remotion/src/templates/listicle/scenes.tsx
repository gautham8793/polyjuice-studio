import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ArgonScene } from "../../components/ArgonArt";
import { EmphasisText } from "../../components/EmphasisText";
import { ReadabilityGradient, SceneVisual } from "../../components/SceneVisual";
import { useTheme } from "../../theme";
import { cueFrame, Portraits } from "../../components/Portraits";
import { HookArt } from "../../components/BlueprintArt";
import { BrandCard } from "../cinematic/overlays";
import type { Project, Scene, Word } from "../../types";

export type SceneProps = { scene: Scene; projectPath: string; index: number; number?: number; words?: Word[]; project?: Project };

const useEnter = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 13, mass: 0.7 } });
};

export const HookScene: React.FC<SceneProps> = ({ scene, projectPath, words: spoken }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  if (scene.argon) return <ArgonScene scene={scene} projectPath={projectPath} words={spoken} />;
  const words = scene.onScreenText.split(" ");
  // blueprint theme with no photo: a drawn building instead of a darkened image
  const drawn = theme.pattern === "blueprint" && scene.visual.type === "graphic" && !scene.visual.asset;

  return (
    <AbsoluteFill>
      <SceneVisual visual={scene.visual} projectPath={projectPath} label="Hook" mapPlacement="background" />
      {drawn ? <HookArt questions={scene.scribbles} /> : <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.45)" }} />}
      {scene.portraits?.length ? <Portraits portraits={scene.portraits} words={spoken} top={300} size={330} /> : null}
      <AbsoluteFill
        style={
          drawn
            ? { justifyContent: "flex-start", alignItems: "center", padding: "330px 70px 0" }
            : scene.titlePosition === "lower"
              ? { justifyContent: "flex-start", alignItems: "center", padding: "1060px 70px 0" }
              : { justifyContent: "center", alignItems: "center", padding: "0 70px", paddingBottom: 260, paddingTop: scene.portraits?.length ? 640 : 0 }
        }
      >
        <div
          style={{
            fontFamily: theme.headlineFont,
            fontSize: 190,
            lineHeight: 1.0,
            textAlign: "center",
            textTransform: "uppercase",
            color: theme.text,
            textShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {words.map((w, i) => {
            const enter = spring({ frame: frame - i * 4, fps: 30, config: { damping: 12, mass: 0.6 } });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 14px",
                  transform: `translateY(${(1 - enter) * 80}px) scale(${0.6 + 0.4 * enter})`,
                  opacity: enter,
                }}
              >
                <EmphasisText text={w} />
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ItemScene: React.FC<SceneProps> = ({ scene, projectPath, index, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const badge = useEnter(0);
  const name = useEnter(5);
  const fact = useEnter(12);
  const card = scene.factStyle === "card";
  const portraits = scene.portraits ?? [];
  // The map flip lands with the winner's "✓ WON" — when the narration names them.
  const winner = portraits.find((p) => p.winner);
  const flipAt = winner ? cueFrame(winner, words, fps, 40) : 40;

  const badgeEl = (
    <div
      style={{
        backgroundColor: theme.accent,
        color: theme.textOnAccent,
        fontFamily: theme.headlineFont,
        fontSize: scene.rank != null ? (card ? 150 : 170) : 100,
        lineHeight: 1,
        padding: "18px 40px 10px",
        borderRadius: 18,
        transform: `scale(${interpolate(badge, [0, 1], [2.2, 1])}) rotate(${interpolate(badge, [0, 1], [-12, -3])}deg)`,
        transformOrigin: "left center",
        opacity: Math.min(1, badge * 2),
        boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
        alignSelf: "flex-start",
      }}
    >
      {scene.rank != null ? `#${scene.rank}` : scene.tag}
    </div>
  );
  const nameEl = (
    <div
      style={{
        marginTop: card ? 26 : 36,
        fontFamily: theme.headlineFont,
        fontSize: card ? 128 : 150,
        lineHeight: 0.95,
        textTransform: "uppercase",
        color: theme.text,
        textShadow: "0 8px 30px rgba(0,0,0,0.6)",
        transform: `translateX(${(1 - name) * -120}px)`,
        opacity: name,
      }}
    >
      {scene.name}
    </div>
  );

  return (
    <AbsoluteFill>
      <SceneVisual
        visual={scene.visual}
        projectPath={projectPath}
        label={scene.name ?? scene.id}
        direction={index % 2 === 0 ? 1 : -1}
        mapPlacement={scene.visual.mapZoom ? "zoom" : portraits.length ? "compact" : "lower"}
        flipAt={flipAt}
      />
      <ReadabilityGradient />
      {portraits.length ? (
        // no map in the scene → portraits move up into the open space
        <Portraits portraits={portraits} words={words} top={card ? 1090 : scene.visual.map ? 1050 : 700} />
      ) : null}
      {card ? (
        // Calm variant: fact in a dark card beside the badge + name
        <AbsoluteFill style={{ padding: "140px 56px 0", flexDirection: "row", alignItems: "flex-start", gap: 34 }}>
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {badgeEl}
            {nameEl}
          </div>
          <div
            style={{
              marginTop: 18,
              flex: 1,
              backgroundColor: `${theme.surface}D9`,
              border: `2px solid ${theme.text}22`,
              borderLeft: `8px solid ${theme.accent}`,
              borderRadius: 18,
              padding: "22px 26px",
              color: theme.text,
              fontFamily: theme.bodyFont,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1.2,
              textWrap: "balance",
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              transform: `translateX(${(1 - fact) * 140}px)`,
              opacity: fact,
            }}
          >
            <EmphasisText text={scene.onScreenText} emphasisColor={theme.accent} />
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ alignItems: "flex-start", padding: "150px 70px 0" }}>
          {badgeEl}
          {nameEl}
          <div
            style={{
              marginTop: 30,
              backgroundColor: theme.secondary,
              color: theme.textOnSecondary,
              textWrap: "balance",
              fontFamily: theme.bodyFont,
              fontWeight: 900,
              fontSize: 50,
              lineHeight: 1.15,
              padding: "14px 26px",
              borderRadius: 12,
              maxWidth: 900,
              transform: `translateX(${(1 - fact) * -120}px)`,
              opacity: fact,
            }}
          >
            <EmphasisText
              text={scene.onScreenText}
              emphasisColor={theme.textOnSecondary === theme.text ? theme.textOnAccent : theme.textOnSecondary}
            />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const OutroScene: React.FC<SceneProps> = ({ scene, projectPath, words }) => {
  const theme = useTheme();
  const enter = useEnter(0);
  const frame = useCurrentFrame();
  if (scene.argon) return <ArgonScene scene={scene} projectPath={projectPath} words={words} />;
  if (scene.outroStyle === "channel") return <ChannelOutro line={scene.onScreenText} />;
  const pulse = 1 + 0.03 * Math.sin(frame / 4);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.accent, justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: theme.headlineFont,
          fontSize: 200,
          lineHeight: 0.95,
          textAlign: "center",
          textTransform: "uppercase",
          color: theme.textOnAccent,
          transform: `scale(${enter * pulse})`,
        }}
      >
        <EmphasisText text={scene.onScreenText} emphasisColor={theme.secondary} />
      </div>
      <div
        style={{
          marginTop: 50,
          fontFamily: theme.bodyFont,
          fontWeight: 900,
          fontSize: 56,
          color: theme.textOnAccent,
          opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {theme.handle}
      </div>
    </AbsoluteFill>
  );
};

// Calm end card: channel logo, name and handle over a dark glow, with the scene's line under it.
const ChannelOutro: React.FC<{ line?: string }> = ({ line }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${theme.surface} 0%, ${theme.background} 70%)` }}>
      <BrandCard data={{ line: line || undefined, start: 0.15 }} words={[]} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.35 + 0.1 * Math.sin(frame / 25), background: "radial-gradient(circle at 50% 40%, rgba(124, 92, 255, 0.25), transparent 55%)" }} />
    </AbsoluteFill>
  );
};

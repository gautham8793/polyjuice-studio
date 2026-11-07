import { Portraits } from "../../components/Portraits";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ArgonScene } from "../../components/ArgonArt";
import { HemicycleView, PhonePriceArt, QuoteCards } from "../../components/BlueprintArt";
import { EmphasisText } from "../../components/EmphasisText";
import { ReadabilityGradient, SceneVisual } from "../../components/SceneVisual";
import { useTheme } from "../../theme";
import type { SceneProps } from "../listicle/scenes";

const useEnter = (delay: number, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
};

// A cast member introduced as a security-staff ID badge: role, real name, "ON DUTY" stamp.
export const CharacterScene: React.FC<SceneProps> = ({ scene, projectPath, index, number = 1 }) => {
  const theme = useTheme();
  const badge = useEnter(0, 14);
  const stamp = useEnter(14, 10);
  const fact = useEnter(20);

  return (
    <AbsoluteFill>
      <SceneVisual
        visual={scene.visual}
        projectPath={projectPath}
        label={scene.name ?? scene.id}
        direction={index % 2 === 0 ? 1 : -1}
      />
      <ReadabilityGradient />
      <AbsoluteFill style={{ alignItems: "center", padding: "130px 60px 0" }}>
        <div
          style={{
            position: "relative",
            width: 900,
            backgroundColor: `${theme.surface}EE`,
            border: `6px solid ${theme.accent}`,
            borderRadius: 30,
            overflow: "visible",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            transform: `translateY(${(1 - badge) * -420}px) rotate(${interpolate(badge, [0, 1], [-8, -2])}deg)`,
          }}
        >
          <div
            style={{
              backgroundColor: theme.accent,
              color: theme.textOnAccent,
              fontFamily: theme.bodyFont,
              fontWeight: 900,
              fontSize: 34,
              letterSpacing: 6,
              padding: "14px 30px",
              borderRadius: "22px 22px 0 0",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>SECURITY ID</span>
            <span>#{String(number).padStart(2, "0")}</span>
          </div>
          <div style={{ padding: "22px 34px 30px" }}>
            <div
              style={{
                fontFamily: theme.headlineFont,
                fontSize: 128,
                lineHeight: 0.95,
                textTransform: "uppercase",
                color: theme.text,
              }}
            >
              {scene.name}
            </div>
            {scene.realName && (
              <div style={{ marginTop: 18, fontFamily: theme.bodyFont, fontWeight: 900, color: theme.text }}>
                <div style={{ fontSize: 28, letterSpacing: 4, opacity: 0.6 }}>REAL NAME</div>
                <div style={{ fontSize: 54, color: theme.accent, lineHeight: 1.1 }}>{scene.realName}</div>
              </div>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              right: -18,
              bottom: -36,
              padding: "10px 26px",
              border: `7px solid ${theme.secondary}`,
              borderRadius: 16,
              color: theme.secondary,
              fontFamily: theme.headlineFont,
              fontSize: 64,
              letterSpacing: 3,
              backgroundColor: `${theme.background}CC`,
              transform: `rotate(-12deg) scale(${interpolate(stamp, [0, 1], [2.6, 1])})`,
              opacity: Math.min(1, stamp * 1.5),
            }}
          >
            ON DUTY
          </div>
        </div>
        <div
          style={{
            marginTop: 70,
            alignSelf: "flex-start",
            backgroundColor: theme.secondary,
            color: theme.textOnSecondary,
            fontFamily: theme.bodyFont,
            fontWeight: 900,
            fontSize: 50,
            lineHeight: 1.15,
            padding: "14px 26px",
            borderRadius: 12,
            maxWidth: 900,
            textWrap: "balance",
            transform: `translateX(${(1 - fact) * -140}px)`,
            opacity: fact,
          }}
        >
          <EmphasisText
            text={scene.onScreenText}
            emphasisColor={theme.textOnSecondary === theme.text ? theme.textOnAccent : theme.textOnSecondary}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// A story beat between characters: one big statement over the illustration.
export const BeatScene: React.FC<SceneProps> = ({ scene, projectPath, words: spoken }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (scene.argon) return <ArgonScene scene={scene} projectPath={projectPath} words={spoken} />;
  const words = scene.onScreenText.split(" ");
  const drawn = theme.pattern === "blueprint" && scene.visual.type === "graphic" && !scene.visual.asset;

  return (
    <AbsoluteFill>
      <SceneVisual visual={scene.visual} projectPath={projectPath} label={scene.name ?? "Beat"} mapPlacement="background" />
      {!drawn && <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.5)" }} />}
      {scene.portraits?.length ? <Portraits portraits={scene.portraits} words={spoken} top={330} size={280} /> : null}
      {scene.quotes?.length ? <QuoteCards quotes={scene.quotes} words={spoken} /> : null}
      {scene.priceTag ? <PhonePriceArt label={scene.priceTag.label} cue={scene.priceTag.cue} words={spoken} /> : null}
      {scene.hemicycle && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 820 }}>
          <HemicycleView hemicycle={scene.hemicycle} words={spoken} />
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={
          scene.hemicycle || scene.quotes?.length || scene.priceTag
            ? { justifyContent: "flex-start", alignItems: "center", padding: `${scene.quotes?.length ? 220 : 330}px 80px 0` }
            : { justifyContent: "center", alignItems: "center", padding: "0 80px", paddingBottom: 300, paddingTop: scene.portraits?.length ? 560 : 0 }
        }
      >
        <div
          style={{
            fontFamily: theme.headlineFont,
            fontSize: 150,
            lineHeight: 1.0,
            textAlign: "center",
            textTransform: "uppercase",
            color: theme.text,
            textShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {words.map((w, i) => {
            const enter = spring({ frame: frame - i * 3, fps, config: { damping: 12, mass: 0.6 } });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 12px",
                  transform: `translateY(${(1 - enter) * 60}px)`,
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

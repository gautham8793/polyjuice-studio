import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import type { Scene } from "../types";
import { BlueprintBackground } from "./Blueprint";
import { assetSrc } from "./SceneVisual";

// Background for template-drawn scenes (stats, chart, quiz, comment): the theme's radial glow,
// optionally over a faded, blurred photo (the scene's visual), plus an optional photo strip.
export const Stage: React.FC<{ scene: Scene; projectPath: string; children: React.ReactNode }> = ({ scene, projectPath, children }) => {
  const theme = useTheme();
  const v = scene.visual;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {theme.pattern === "blueprint" && !v.asset && <BlueprintBackground />}
      {v.asset && (
        <Img
          src={staticFile(assetSrc(v.asset, projectPath))}
          style={{ position: "absolute", inset: -30, width: "calc(100% + 60px)", height: "calc(100% + 60px)", objectFit: "cover", filter: "blur(5px) brightness(0.42) saturate(0.9)" }}
        />
      )}
      <AbsoluteFill
        style={{
          background: v.asset
            ? `linear-gradient(180deg, ${theme.background}E6 0%, ${theme.background}88 45%, ${theme.background}E6 100%)`
            : theme.pattern === "blueprint"
              ? "transparent"
              : `radial-gradient(circle at 50% 45%, ${theme.surface} 0%, ${theme.background} 75%)`,
        }}
      />
      <AbsoluteFill style={{ padding: "170px 70px 0" }}>
        {children}
        {scene.strip?.length ? <PhotoStrip scene={scene} projectPath={projectPath} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// One or two labelled photos right under the scene's content (scenes with a strip draw compactly).
export const PhotoStrip: React.FC<{ scene: Scene; projectPath: string }> = ({ scene, projectPath }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ marginTop: 56, height: 270, flexShrink: 0, display: "flex", gap: 24 }}>
      {scene.strip!.map((p, i) => {
        const enter = spring({ frame: frame - 16 - i * 8, fps, config: { damping: 14, mass: 0.7 } });
        return (
          <div
            key={p.asset ?? i}
            style={{
              position: "relative",
              flex: 1,
              borderRadius: 24,
              overflow: "hidden",
              border: `4px solid ${theme.text}26`,
              boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
              transform: `translateY(${(1 - enter) * 120}px)`,
              opacity: enter,
            }}
          >
            {p.asset && (
              <Img
                src={staticFile(assetSrc(p.asset, projectPath))}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${p.focus?.x ?? 50}% ${p.focus?.y ?? 50}%` }}
              />
            )}
            {p.label && (
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 14,
                  backgroundColor: `${theme.background}E6`,
                  color: theme.text,
                  borderRadius: 10,
                  padding: "6px 14px",
                  fontFamily: theme.bodyFont,
                  fontWeight: 900,
                  fontSize: 28,
                  letterSpacing: 1,
                }}
              >
                {p.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

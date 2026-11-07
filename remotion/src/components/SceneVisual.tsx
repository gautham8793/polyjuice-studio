import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import type { Visual } from "../types";
import { BlueprintBackground } from "./Blueprint";
import { MAP_H, MAP_W, MapLegend, StateGrid, TILE, GAP, TILES } from "./StateGrid";

// Assets under library/ are shared across projects; everything else is per-project.
export const assetSrc = (asset: string, projectPath: string) =>
  asset.startsWith("library/") ? asset : `${projectPath}/${asset}`;

type Props = {
  visual: Visual;
  projectPath: string;
  label: string; // shown on the placeholder until an image is added
  direction?: 1 | -1;
  // map visuals: "lower" sits under the scene's title block; "background" is a dim texture
  // behind centered text (hook / beat)
  // "compact" is a smaller map that leaves room for portraits underneath
  mapPlacement?: "lower" | "background" | "compact" | "zoom";
  flipAt?: number; // frame at which "R>D" / "D>R" states flip
};

// Full-bleed background: the scene's image with a slow Ken Burns move, or a branded placeholder.
export const SceneVisual: React.FC<Props> = ({ visual, projectPath, label, direction = 1, mapPlacement = "lower", flipAt }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = useTheme();
  const progress = frame / durationInFrames;
  const scale = interpolate(progress, [0, 1], [1.08, 1.22]);
  const shift = interpolate(progress, [0, 1], [0, 40 * direction]);

  if (visual.asset && visual.fit === "pan" && visual.pan && visual.size) {
    // Camera move across a full-screen photo: eased so it starts and settles gently.
    const { from, to, zoom = 1.1 } = visual.pan;
    const t = interpolate(progress, [0.06, 0.94], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = zoom * interpolate(progress, [0, 1], [1, 1.05]);
    const H = 1920 * z;
    const W = H * (visual.size.width / visual.size.height);
    const coverW = Math.max(W, 1080);
    const coverH = coverW === W ? H : 1080 * (visual.size.height / visual.size.width);
    // put the point of interest in the open area between the title block and the captions
    const left = Math.min(0, Math.max(1080 - coverW, 540 - x * coverW));
    // The photo may slide down by up to 560px (the title zone) when its subject sits high in the
    // frame; a blurred copy fills that band so it never shows as empty.
    const top = Math.min(560, Math.max(1920 - coverH, 1030 - y * coverH));
    const src = staticFile(assetSrc(visual.asset, projectPath));
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: theme.background }}>
        {top > 0 && (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.45)", transform: "scale(1.2)" }} />
        )}
        <Img src={src} style={{ position: "absolute", left, top, width: coverW, height: coverH }} />
        {top > 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: top - 2, height: 160, background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)" }} />
        )}
      </AbsoluteFill>
    );
  }

  if (visual.asset && visual.fit === "contain") {
    const src = staticFile(assetSrc(visual.asset, projectPath));
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: theme.background }}>
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.45)", transform: "scale(1.2)" }}
        />
        {/* the whole photo, between the title block and the captions */}
        <div style={{ position: "absolute", top: 560, height: 880, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: `scale(${interpolate(progress, [0, 1], [1, 1.08])})`,
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  if (visual.asset) {
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: theme.background }}>
        <Img
          src={staticFile(assetSrc(visual.asset, projectPath))}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale}) translateX(${shift}px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (visual.map && mapPlacement === "zoom") {
    return <ZoomMap states={visual.map} flipAt={flipAt} />;
  }

  if (visual.map) {
    const background = mapPlacement === "background";
    const compact = mapPlacement === "compact";
    return (
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 60%, ${theme.surface} 0%, ${theme.background} 75%)` }}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            paddingTop: background ? 560 : compact ? 600 : 650,
            opacity: background ? 0.35 : 1,
            transform: `scale(${background ? scale : compact ? 0.56 : 1})`,
            transformOrigin: compact ? "50% 600px" : undefined,
          }}
        >
          <StateGrid states={visual.map} flipAt={flipAt} />
          {!background && !compact && (
            <div style={{ marginTop: 36 }}>
              <MapLegend states={visual.map} />
            </div>
          )}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // template-drawn scenes on the blueprint theme sit on the drafting grid, not a placeholder
  if (visual.type === "graphic" && theme.pattern === "blueprint") return <BlueprintBackground />;

  const isGraphic = visual.type === "graphic";
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 55%, ${theme.surface} 0%, ${theme.background} 70%)`,
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, ${theme.text}08 0 2px, transparent 2px 40px)`,
          transform: `scale(${scale}) translateX(${shift}px)`,
        }}
      />
      {!isGraphic && <div
        style={{
          position: "absolute",
          top: 1220, // below hook/title text, above captions
          padding: "22px 36px",
          border: `4px dashed ${theme.text}40`,
          borderRadius: 24,
          color: `${theme.text}80`,
          fontFamily: theme.bodyFont,
          fontWeight: 800,
          fontSize: 38,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Image · {label}
      </div>}
    </AbsoluteFill>
  );
};

// Darkens top and bottom so text stays readable over any photo.
export const ReadabilityGradient: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 38%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.8) 100%)",
    }}
  />
);

// Full map that zooms into the colored / flipped states inside a window under the title block.
const WINDOW = { top: 470, height: 600 };
const ZoomMap: React.FC<{ states: Record<string, string>; flipAt?: number }> = ({ states, flipAt }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const focus = Object.keys(states).filter((c) => TILES[c]);
  const step = TILE + GAP;
  const cx = focus.reduce((s, c) => s + TILES[c][0] * step + TILE / 2, 0) / Math.max(1, focus.length);
  const cy = focus.reduce((s, c) => s + TILES[c][1] * step + TILE / 2, 0) / Math.max(1, focus.length);
  // hold on the full map briefly, then ease in
  const z = interpolate(frame, [8, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const scale = interpolate(z, [0, 1], [0.74, 1.9]);
  // keep the camera inside the map horizontally so edge states (ME, AK, FL) still have neighbors
  const clamp = (v: number, half: number, size: number) => (size > 2 * half ? Math.min(size - half, Math.max(half, v)) : size / 2);
  const px = clamp(interpolate(z, [0, 1], [MAP_W / 2, cx]), 540 / scale, MAP_W);
  const py = interpolate(z, [0, 1], [MAP_H / 2, cy]); // vertical: always center the state
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${theme.surface} 0%, ${theme.background} 75%)` }}>
      <div
        style={{
          position: "absolute",
          top: WINDOW.top,
          left: 0,
          right: 0,
          height: WINDOW.height,
          overflow: "hidden",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 540 - px * scale,
            top: WINDOW.height / 2 - py * scale,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <StateGrid states={states as never} flipAt={flipAt} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

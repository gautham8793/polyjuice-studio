import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import type { Portrait, Word } from "../types";
import { PARTY } from "./StateGrid";

const PARTY_COLOR = { D: PARTY.D, R: PARTY.R, I: "#8A8FA8" };

// Frame at which a portrait pops in: when its cue word is spoken, else a gentle stagger.
export const cueFrame = (p: Portrait, words: Word[] | undefined, fps: number, fallback: number) => {
  const cue = p.cue?.toLowerCase().replace(/[^a-z]/g, "");
  const w = cue ? words?.find((x) => x.text.toLowerCase().replace(/[^a-z]/g, "").startsWith(cue)) : undefined;
  return w ? Math.round(w.start * fps) - 3 : fallback;
};

export const Badge: React.FC<{ p: Portrait; size: number; at: number }> = ({ p, size, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const pop = spring({ frame: frame - at, fps, config: { damping: 12, mass: 0.6 } });
  const check = spring({ frame: frame - at - 8, fps, config: { damping: 10 } });
  const ring = PARTY_COLOR[p.party];

  // Scale the photo so the focus square fills the circle, centered on the face.
  const hasPhoto = !!(p.photo && p.width && p.height && p.focus);
  const scale = hasPhoto ? size / (p.focus!.size * Math.min(p.width!, p.height!)) : 1;
  const w = hasPhoto ? p.width! * scale : size;
  const h = hasPhoto ? p.height! * scale : size;
  const left = hasPhoto ? Math.min(0, Math.max(size - w, size / 2 - (p.focus!.x / 100) * w)) : 0;
  const top = hasPhoto ? Math.min(0, Math.max(size - h, size / 2 - (p.focus!.y / 100) * h)) : 0;
  const initials = p.name.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        transform: `scale(${pop}) translateY(${(1 - pop) * 40}px)`,
        opacity: Math.min(1, pop * 1.5),
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            overflow: "hidden",
            position: "relative",
            border: `9px solid ${ring}`,
            boxShadow: `0 0 0 5px ${theme.background}, 0 18px 40px rgba(0,0,0,0.5)`,
            backgroundColor: theme.surface,
            boxSizing: "content-box",
          }}
        >
          {hasPhoto ? (
            <Img src={staticFile(p.photo!)} style={{ position: "absolute", left, top, width: w, height: h }} />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `radial-gradient(circle at 35% 30%, ${ring}, ${theme.background})`,
                color: "#fff",
                fontFamily: theme.headlineFont,
                fontSize: size * 0.42,
              }}
            >
              {initials}
            </div>
          )}
        </div>
        {p.winner && (
          <div
            style={{
              position: "absolute",
              right: -10,
              top: -6,
              backgroundColor: theme.accent,
              color: theme.textOnAccent,
              borderRadius: 999,
              padding: "6px 16px",
              fontFamily: theme.bodyFont,
              fontWeight: 900,
              fontSize: 28,
              letterSpacing: 2,
              boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
              transform: `scale(${interpolate(check, [0, 1], [0.3, 1])})`,
              opacity: check,
            }}
          >
            ✓ WON
          </div>
        )}
      </div>
      <div
        style={{
          backgroundColor: `${theme.background}E6`,
          border: `2px solid ${theme.text}22`,
          borderRadius: 12,
          padding: "6px 14px",
          fontFamily: theme.bodyFont,
          fontWeight: 900,
          fontSize: size > 220 ? 30 : 25,
          color: theme.text,
          whiteSpace: "nowrap",
        }}
      >
        {p.name} <span style={{ color: ring }}>({p.party})</span>
      </div>
    </div>
  );
};

// A row of official-style round portraits. Two portraits = a head-to-head at equal size;
// more = a row of winners. Each pops in as the narration names them.
export const Portraits: React.FC<{ portraits: Portrait[]; words?: Word[]; top?: number; size?: number }> = ({ portraits, words, top = 1050, size: fixed }) => {
  const { fps } = useVideoConfig();
  const n = portraits.length;
  const size = fixed ?? (n <= 2 ? 250 : n === 3 ? 215 : n === 4 ? 175 : 165);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: n >= 5 ? "wrap" : "nowrap", // 5+ portraits wrap into two rows
        justifyContent: "center",
        alignItems: "flex-start",
        gap: n <= 2 ? 110 : 36,
        rowGap: 28,
        padding: n >= 5 ? "0 40px" : 0,
      }}
    >
      {portraits.map((p, i) => (
        <Badge key={p.name} p={p} size={size} at={cueFrame(p, words, fps, 12 + i * 6)} />
      ))}
    </div>
  );
};

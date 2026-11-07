import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import type { StateMap } from "../types";

// Tile-grid map of the US (one equal square per state + DC) — reads cleanly on a phone and
// treats every state the same size, which keeps maps neutral.
export const TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

// Conventional US party colors, so viewers read the map instantly.
export const PARTY = { D: "#2F6BFF", R: "#E5383B", pending: "#8A8FA8" };

export const TILE = 84;
export const GAP = 8;
export const MAP_W = 11 * (TILE + GAP) - GAP;
export const MAP_H = 8 * (TILE + GAP) - GAP;

type Props = { states: StateMap; tile?: number; gap?: number; delay?: number; flipAt?: number };

// "R>D": red until flipAt, then a card-flip to blue (and vice versa for "D>R").
const flipColors = (status: string, frame: number, flipAt: number) => {
  const [from, to] = status.split(">") as ("D" | "R")[];
  const t = Math.min(1, Math.max(0, (frame - flipAt) / 12));
  return { fill: t < 0.5 ? PARTY[from] : PARTY[to], squash: Math.abs(Math.cos(Math.PI * t)), done: t >= 1, t };
};

export const StateGrid: React.FC<Props> = ({ states, tile = TILE, gap = GAP, delay = 0, flipAt = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const step = tile + gap;

  return (
    <div style={{ position: "relative", width: 11 * step - gap, height: 8 * step - gap }}>
      {Object.entries(TILES).map(([code, [col, row]]) => {
        const status = states[code];
        const colored = !!status;
        // colored states pop in after the base map, left to right
        const enter = spring({ frame: frame - delay - (colored ? 10 + col * 1.5 : col * 0.6), fps, config: { damping: 14 } });
        const flip = status?.includes(">") ? flipColors(status, frame, flipAt) : null;
        const fill = flip
          ? flip.fill
          : status === "highlight"
            ? theme.accent
            : status
              ? PARTY[status as "D" | "R" | "pending"]
              : `${theme.text}14`;
        const flash = flip ? spring({ frame: frame - flipAt - 10, fps, config: { damping: 9 } }) : 0;
        const pulse = status === "pending" ? 0.75 + 0.25 * Math.sin(frame / 6) : 1;
        return (
          <div
            key={code}
            style={{
              position: "absolute",
              left: col * step,
              top: row * step,
              width: tile,
              height: tile,
              borderRadius: 12,
              backgroundColor: fill,
              backgroundImage:
                status === "pending"
                  ? `repeating-linear-gradient(135deg, ${theme.text}33 0 6px, transparent 6px 14px)`
                  : undefined,
              opacity: (colored ? 1 : 0.9) * pulse,
              transform: `scale(${(colored ? 0.5 + 0.5 * enter : enter) * (1 + 0.18 * flash * (1 - flash))}) scaleX(${flip ? Math.max(0.04, flip.squash) : 1})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: theme.bodyFont,
              fontWeight: 900,
              fontSize: 26,
              color: colored ? "#fff" : `${theme.text}55`,
              boxShadow: colored
                ? `0 0 ${status === "highlight" || flip?.done ? 34 : 18}px ${fill}${flip?.done ? "CC" : "88"}`
                : undefined,
              zIndex: flip ? 2 : 1,
            }}
          >
            {code}
            {flip && (
              <div
                style={{
                  position: "absolute",
                  top: -34,
                  left: "50%",
                  transform: `translateX(-50%) scale(${flash})`,
                  backgroundColor: theme.accent,
                  color: theme.textOnAccent,
                  borderRadius: 8,
                  padding: "2px 8px",
                  fontSize: 18,
                  letterSpacing: 1,
                  whiteSpace: "nowrap",
                }}
              >
                FLIP
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const MapLegend: React.FC<{ states: StateMap }> = ({ states }) => {
  const theme = useTheme();
  const used = new Set(Object.values(states).flatMap((v) => v.split(">")));
  const items = [
    used.has("D") && { color: PARTY.D, label: "Democrat" },
    used.has("R") && { color: PARTY.R, label: "Republican" },
    used.has("pending") && { color: PARTY.pending, label: "Too close to call" },
  ].filter(Boolean) as { color: string; label: string }[];
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", gap: 30, justifyContent: "center", fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 30, color: theme.text }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
};

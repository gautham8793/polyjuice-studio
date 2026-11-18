// Documentary template: markets and chips pieces (first used by "The Chip Chokepoint").
// · ChartLayout: a real share-price line inked onto graph paper, with a red-pen loop on the peak
//   and a ticker-tape strip of paper running underneath.
// · StackTracker: the AI stack (Apps · Cloud · Chip designers · Factory · Machine) as small torn
//   paper strips in the corner, the current chapter's layer pulled out in red (like the bank tracker).
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import type { DocSpec } from "../../types";
import { InkIcon, Kicker, paperShadow, prog, useLayout } from "./parts";
import { DOC } from "./theme";

const GRID = "rgba(70, 110, 140, 0.16)"; // faint blue graph-paper rules
const GRID_BOLD = "rgba(70, 110, 140, 0.28)";

const fmt = (v: number, decimals = 0) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** A slightly uneven ink path: real data points, nudged a hair so it reads as drawn by hand. */
const inkPath = (pts: [number, number][], seed: string) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${(x + (random(`${seed}x${i}`) - 0.5) * 0.6).toFixed(1)},${(y + (random(`${seed}y${i}`) - 0.5) * 1.2).toFixed(1)}`).join(" ");

export const ChartLayout: React.FC<{ d: DocSpec; start?: number }> = ({ d, start = 8 }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const c = d.chart!;
  const W = (vertical ? 940 : 1320) * u;
  const H = (vertical ? 760 : 560) * u;
  const pad = { l: 30 * u, r: 150 * u, t: 50 * u, b: 60 * u };
  const n = c.values.length;
  const lo = Math.min(...c.values) * 0.9;
  const hi = Math.max(...c.values) * 1.06;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const pts = c.values.map((v, i) => [x(i), y(v)] as [number, number]);
  const draw = interpolate(frame, [start, start + (c.draw ?? 70)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shown = Math.max(2, Math.round(draw * n));
  const head = pts[shown - 1];
  const peakI = c.values.indexOf(Math.max(...c.values));
  const loopAt = start + (c.draw ?? 70) * (peakI / (n - 1)) + 6;
  const loop = prog(frame, loopAt, 18);
  const sheet = prog(frame, 0, 14);
  const years = Array.from(new Set(c.dates.map((dt) => dt.slice(0, 4))))
    .map((yr) => ({ yr, i: c.dates.findIndex((dt) => dt.startsWith(yr)) }))
    .filter((a) => a.i > 3);
  const cellsX = Math.round((W - pad.l - pad.r) / (36 * u));
  const cellsY = Math.round((H - pad.t - pad.b) / (36 * u));
  const value = (v: number) => `${c.prefix ?? ""}${fmt(v, c.decimals ?? 0)}${c.suffix ?? ""}`;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `${(vertical ? 260 : 120) * u}px ${60 * u}px ${(vertical ? 420 : 190) * u}px`, gap: 18 * u, flexDirection: "column" }}>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ position: "relative", width: W, height: H, opacity: sheet, transform: `translateY(${(1 - sheet) * 40 * u}px) rotate(${-0.6 * sheet}deg)`, filter: paperShadow(u) }}>
        {/* graph paper: cream sheet, faint blue rules, a bolder rule every 5 squares */}
        <div style={{ position: "absolute", inset: 0, background: "#F7F1E4" }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: cellsX + 1 }, (_, i) => {
            const gx = pad.l + (i / cellsX) * (W - pad.l - pad.r);
            return <line key={`x${i}`} x1={gx} x2={gx} y1={pad.t} y2={H - pad.b} stroke={i % 5 ? GRID : GRID_BOLD} strokeWidth={1.2 * u} />;
          })}
          {Array.from({ length: cellsY + 1 }, (_, i) => {
            const gy = pad.t + (i / cellsY) * (H - pad.t - pad.b);
            return <line key={`y${i}`} x1={pad.l} x2={W - pad.r} y1={gy} y2={gy} stroke={i % 5 ? GRID : GRID_BOLD} strokeWidth={1.2 * u} />;
          })}
          {/* the inked price line, drawn left to right */}
          <path d={inkPath(pts.slice(0, shown), "ink")} fill="none" stroke={DOC.ink} strokeWidth={4.2 * u} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={head[0]} cy={head[1]} r={7 * u} fill={draw >= 1 ? DOC.accent : DOC.ink} />
          {/* red-pen loop around the peak, once the line gets there */}
          {loop > 0 && (
            <ellipse
              cx={pts[peakI][0]}
              cy={pts[peakI][1]}
              rx={46 * u}
              ry={30 * u}
              fill="none"
              stroke={DOC.accent}
              strokeWidth={3.5 * u}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - loop}
              transform={`rotate(-12 ${pts[peakI][0]} ${pts[peakI][1]})`}
            />
          )}
          {years.map(({ yr, i }) => (
            <text key={yr} x={x(i)} y={H - pad.b + 34 * u} fill={DOC.inkSoft} fontFamily={DOC.fonts.mono} fontWeight={600} fontSize={20 * u} textAnchor="middle">
              {yr}
            </text>
          ))}
        </svg>
        {/* handwritten notes: the peak, and where the line ends now */}
        {loop > 0 && (
          // the note sits beside the loop, on the side with more room, so it never runs off the sheet
          <div style={{ position: "absolute", left: pts[peakI][0] > W / 2 ? pts[peakI][0] - 420 * u : pts[peakI][0] + 60 * u, top: pts[peakI][1] - 24 * u, width: 360 * u, textAlign: pts[peakI][0] > W / 2 ? "right" : "left", fontFamily: DOC.fonts.hand, fontSize: 40 * u, color: DOC.accent, opacity: loop, lineHeight: 1 }}>
            peak {value(c.values[peakI])} · {shortDate(c.dates[peakI])}
          </div>
        )}
        <div style={{ position: "absolute", left: head[0] + 18 * u, top: head[1] - 22 * u, fontFamily: DOC.fonts.mono, fontWeight: 700, fontSize: 26 * u, color: draw >= 1 ? DOC.accent : DOC.ink, whiteSpace: "nowrap" }}>
          {value(c.values[shown - 1])}
        </div>
        <div style={{ position: "absolute", left: pad.l, top: 12 * u, fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 22 * u, letterSpacing: 3 * u, color: DOC.ink, textTransform: "uppercase" }}>{c.label}</div>
      </div>
      {c.ticker?.length ? <TickerTape items={c.ticker} start={start + 10} /> : null}
    </AbsoluteFill>
  );
};

/** A strip of kraft ticker tape, typed in mono, sliding slowly left. */
export const TickerTape: React.FC<{ items: { symbol: string; price: string; change?: string; down?: boolean }[]; start: number }> = ({ items, start }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const o = prog(frame, start, 14);
  const W = (vertical ? 980 : 1400) * u;
  const run = [...items, ...items, ...items, ...items];
  const shift = -((frame * 1.6 * u) % (W * 0.5));
  return (
    <div style={{ width: W, height: 54 * u, overflow: "hidden", position: "relative", opacity: o, transform: `rotate(0.8deg)`, filter: paperShadow(u) }}>
      <div style={{ position: "absolute", inset: 0, background: DOC.kraft, clipPath: "polygon(0 6%, 2% 0, 30% 4%, 60% 0, 98% 5%, 100% 0, 100% 94%, 97% 100%, 65% 95%, 33% 100%, 3% 95%, 0 100%)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: shift, display: "flex", alignItems: "center", gap: 46 * u, whiteSpace: "nowrap", fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 24 * u, color: DOC.ink, paddingLeft: 30 * u }}>
        {run.map((it, i) => (
          <span key={i}>
            {it.symbol} <span style={{ fontWeight: 700 }}>{it.price}</span>{" "}
            {it.change && <span style={{ color: it.down ? DOC.accent : "#3F6B3A" }}>{it.down ? "▼" : "▲"} {it.change}</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

export const STACK_LAYERS = ["Apps", "Cloud", "Chip designers", "Factory", "Machine"];
const STACK_ICONS = ["smartphone", "server", "chip", "factory", "machine"] as const;

/** The AI stack in the corner: the five engraved objects in a column on a thin ink line. The
 *  current chapter's layer is bigger, circled in red pen and named; the others are small and faded. */
export const StackTracker: React.FC<{ active: number }> = ({ active }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const bob = interpolate(Math.sin(frame / 20), [-1, 1], [0, -3 * u]);
  const small = 34 * u;
  const big = 62 * u;
  return (
    <div style={{ position: "absolute", right: 46 * u, top: (vertical ? 100 : 34) * u, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 * u }}>
      {/* the thin line the layers hang on */}
      <div style={{ position: "absolute", top: small / 2, bottom: small / 2, left: "50%", width: 2 * u, background: DOC.inkSoft, opacity: 0.35 }} />
      {STACK_LAYERS.map((name, i) => {
        const on = i === active;
        const s = on ? big : small;
        return (
          <div key={name} style={{ position: "relative", width: big, height: s, display: "flex", alignItems: "center", justifyContent: "center", transform: on ? `translateY(${bob}px)` : undefined }}>
            <div style={{ opacity: on ? 1 : active < 0 ? 0.8 : 0.42, filter: on || active < 0 ? undefined : "grayscale(1)" }}>
              <InkIcon kind={STACK_ICONS[i]} size={s} />
            </div>
            {on && (
              <>
                <svg width={big * 1.5} height={big * 1.2} style={{ position: "absolute", overflow: "visible" }}>
                  <ellipse cx={big * 0.75} cy={big * 0.6} rx={big * 0.68} ry={big * 0.5} fill="none" stroke={DOC.accent} strokeWidth={2.5 * u} transform={`rotate(-8 ${big * 0.75} ${big * 0.6})`} />
                </svg>
                <div style={{ position: "absolute", right: big + 12 * u, whiteSpace: "nowrap", fontFamily: DOC.fonts.hand, fontSize: 30 * u, color: DOC.accent }}>{name.toLowerCase()}</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Faint blue graph-paper rules over the whole page (project.docBackground = "grid"). */
export const GraphGrid: React.FC = () => {
  const { u } = useLayout();
  const cell = 48 * u;
  const lw = Math.max(1, 1.6 * u); // line width scales with the frame, so the grid stays visible at any render size
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: `linear-gradient(${GRID} ${lw}px, transparent ${lw}px), linear-gradient(90deg, ${GRID} ${lw}px, transparent ${lw}px), linear-gradient(${GRID_BOLD} ${lw * 1.4}px, transparent ${lw * 1.4}px), linear-gradient(90deg, ${GRID_BOLD} ${lw * 1.4}px, transparent ${lw * 1.4}px)`,
        backgroundSize: `${cell}px ${cell}px, ${cell}px ${cell}px, ${cell * 5}px ${cell * 5}px, ${cell * 5}px ${cell * 5}px`,
        opacity: 0.32, // faint: texture, not lines to read across
      }}
    />
  );
};

/** Cover art for chips videos (project.cover.art = "chips"): a wafer, the chip cut from it with a
 *  red-pen loop, and the machine that prints it, as engraved paper cut-outs. Static. */
export const ChipCoverArt: React.FC<{ width: number }> = ({ width: W }) => {
  const { u } = useLayout();
  const H = W * 0.66;
  const loop = W * 0.36;
  return (
    <div style={{ position: "relative", width: W, height: H + 60 * u, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: W * 0.02, top: 0, transform: "rotate(-8deg)" }}>
        <InkIcon kind="wafer" size={W * 0.62} />
      </div>
      <div style={{ position: "absolute", left: W * 0.3, top: H * 0.5, transform: "rotate(4deg)" }}>
        <InkIcon kind="machine" size={W * 0.58} />
      </div>
      <div style={{ position: "absolute", left: W * 0.5, top: H * 0.06, transform: "rotate(7deg)" }}>
        <InkIcon kind="chip" size={W * 0.46} />
      </div>
      {/* red-pen loop around the chip, and a handwritten note */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <ellipse cx={W * 0.73} cy={H * 0.3} rx={loop * 0.72} ry={loop * 0.5} fill="none" stroke={DOC.accent} strokeWidth={5 * u} transform={`rotate(-10 ${W * 0.73} ${H * 0.3})`} />
      </svg>
      <div style={{ position: "absolute", left: W * 0.5, top: -42 * u, width: W * 0.5, textAlign: "center", fontFamily: DOC.fonts.hand, fontSize: 44 * u, color: DOC.accent, transform: "rotate(-4deg)" }}>made on one island</div>
    </div>
  );
};

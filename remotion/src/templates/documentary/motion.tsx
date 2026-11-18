// Documentary template: motion graphics for the AI / chips / markets videos (first used by
// "The Chip Chokepoint"). Same paper-and-ink look as the rest of the template, calm motion only.
// · StackLayout   the AI stack as big torn paper strips (build-up, one layer pulled out, or cost pressure)
// · CircuitTraces copper circuit lines drawn behind a scene, with small pulses running along them
// · PrintLayout   "printing with light": a beam through a stencil prints a wafer row by row, then zooms on one chip
// · QueueLayout   logos waiting on a conveyor at a gate (the CoWoS packaging queue)
// · RouteLayout   two places joined by a dashed arc, a paper plane flying it (and back)
// · ReceiptLayout a receipt printing out line by line
// · DollarLayout  paper banknotes, the share each company keeps shaded in ink
// · StatFlap      a big number on a split-flap board
import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { DocLogo, DocSpec } from "../../types";
import { useCue } from "./cues";
import { InkIcon, type InkKind, Kicker, LogoBadge, paperShadow, prog, TornSheetBg, useLayout } from "./parts";
import { DOC } from "./theme";

const COPPER = "#B07A4A";
const TORN = "polygon(0 8%, 3% 0, 30% 5%, 62% 0, 97% 6%, 100% 0, 100% 92%, 97% 100%, 66% 94%, 34% 100%, 3% 95%, 0 100%)";
const asset = (src: string, projectPath: string) => (src.startsWith("library/") ? src : `${projectPath}/${src}`);

/** Centre stage with room for the chrome above and the captions below. */
const Frame: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 34 }) => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: gap * u, padding: `${(vertical ? 260 : 120) * u}px ${(vertical ? 60 : 120) * u}px ${(vertical ? 400 : 180) * u}px` }}>
      {children}
    </AbsoluteFill>
  );
};

const Title: React.FC<{ text?: string; start?: number }> = ({ text, start = 6 }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  if (!text) return null;
  const a = prog(frame, start, 16);
  return <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 66 : 60) * u, lineHeight: 1.1, color: DOC.ink, textAlign: "center", opacity: a, transform: `translateY(${(1 - a) * 16 * u}px)` }}>{text}</div>;
};

// ---------------------------------------------------------------- the AI stack

export const STACK: { name: string; who: string; icon: InkKind }[] = [
  { name: "Apps", who: "what you use", icon: "smartphone" },
  { name: "Cloud", who: "Amazon · Microsoft · Google · Meta", icon: "server" },
  { name: "Chip designers", who: "Nvidia · AMD", icon: "chip" },
  { name: "Factory", who: "TSMC", icon: "factory" },
  { name: "Machine", who: "ASML", icon: "machine" },
];

/** build: strips drop in one by one (on `cues`) · active: one layer pulled out in red ·
 *  pressure: the bottom glows red and arrows push cost up through every layer. */
export const StackLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const cue = useCue();
  const s = d.stack ?? { mode: "build" as const };
  const W = (vertical ? 760 : 980) * u;
  const H = (vertical ? 96 : 86) * u;
  const GAP = (vertical ? 34 : 28) * u; // breathing room between the strips
  const starts = STACK.map((_, i) => cue(s.cues?.[i], 6 + i * 14));
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 6);
  const lift = interpolate(Math.sin(frame / 16), [-1, 1], [0, -6 * u]);
  const pressure = s.mode === "pressure";
  const up = prog(frame, 30, 50);
  return (
    <Frame gap={22}>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: GAP }}>
        {STACK.map((layer, i) => {
          const a = prog(frame, starts[i], 14);
          const on = s.active === i || (pressure && i === STACK.length - 1);
          const dim = s.active !== undefined && s.active >= 0 && !on;
          return (
            <div
              key={layer.name}
              style={{
                position: "relative",
                width: W,
                height: H,
                opacity: a * (dim ? 0.55 : 1),
                transform: `translateY(${(1 - a) * -60 * u}px) translateX(${on ? -34 * u : 0}px) translateY(${on ? lift : 0}px) rotate(${((i * 37) % 5 - 2) * 0.35}deg)`,
                filter: paperShadow(u * 0.7),
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: on ? DOC.accent : i % 2 ? "#EFE6D4" : "#F6F0E3", clipPath: TORN }} />
              {/* the layer's engraved object, tucked against the strip's left end */}
              <div style={{ position: "absolute", left: -H * 1.25, top: H * 0.0, width: H * 1.05, height: H, opacity: a, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <InkIcon kind={layer.icon} size={H} />
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${40 * u}px` }}>
                <span style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 34 * u, letterSpacing: 4 * u, textTransform: "uppercase", color: on ? DOC.paper : DOC.ink }}>{layer.name}</span>
                <span style={{ fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 22 * u, color: on ? DOC.paper : DOC.inkSoft }}>{layer.who}</span>
              </div>
            </div>
          );
        })}
        {/* cost pressure: red arrows rising from the bottom layer, one per layer above it */}
        {pressure &&
          [0, 1, 2, 3].map((k) => {
            const p = prog(frame, 30 + k * 10, 30);
            const y = (STACK.length - 1) * (H + GAP) - k * (H + GAP);
            return (
              <svg key={k} width={60 * u} height={H + GAP} style={{ position: "absolute", right: -80 * u, top: y - (H + GAP) * p * 0.9 + H / 2, opacity: p * (1 - up * 0.2), overflow: "visible" }}>
                <path d={`M${30 * u},${H} L${30 * u},${10 * u} M${16 * u},${26 * u} L${30 * u},${10 * u} L${44 * u},${26 * u}`} stroke={DOC.accent} strokeWidth={4 * u} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            );
          })}
      </div>
      {d.sub && <div style={{ fontFamily: DOC.fonts.body, fontWeight: 500, fontSize: 30 * u, color: DOC.inkSoft, opacity: prog(frame, 40, 14) }}>{d.sub}</div>}
    </Frame>
  );
};

// ---------------------------------------------------------------- circuit traces

/** Copper traces drawn in from the edges behind a scene, small pulses running along them. */
export const CircuitTraces: React.FC<{ seed?: string }> = ({ seed = "c" }) => {
  const frame = useCurrentFrame();
  const { vertical } = useLayout();
  // drawn in a fixed 16:9 or 9:16 box, scaled to the frame
  const VW = vertical ? 1080 : 1920;
  const VH = vertical ? 1920 : 1080;
  const traces = Array.from({ length: 10 }, (_, i) => {
    const left = i % 2 === 0;
    const y0 = 120 + random(`${seed}y${i}`) * (VH - 300);
    const x0 = left ? -10 : VW + 10;
    const run1 = 120 + random(`${seed}a${i}`) * 260;
    const x1 = left ? x0 + run1 : x0 - run1;
    const dy = (random(`${seed}d${i}`) - 0.5) * 220;
    const x2 = left ? x1 + Math.abs(dy) : x1 - Math.abs(dy);
    const y2 = y0 + dy;
    const x3 = left ? x2 + 60 + random(`${seed}b${i}`) * 160 : x2 - 60 - random(`${seed}b${i}`) * 160;
    return { pts: [[x0, y0], [x1, y0], [x2, y2], [x3, y2]] as [number, number][], end: [x3, y2] as [number, number] };
  });
  const draw = prog(frame, 0, 40);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
        {traces.map((t, i) => {
          const d = "M" + t.pts.map((p) => p.join(",")).join(" L");
          // a pulse: a short bright dash travelling along the trace, on a slow loop
          const loop = ((frame + i * 23) % 120) / 120;
          return (
            <g key={i} opacity={0.42}>
              <path d={d} fill="none" stroke={COPPER} strokeWidth={3} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <circle cx={t.end[0]} cy={t.end[1]} r={7} fill="none" stroke={COPPER} strokeWidth={3} opacity={draw} />
              {draw >= 1 && <path d={d} fill="none" stroke="#E8B27A" strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray="0.06 0.94" strokeDashoffset={-loop} />}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- printing with light

/** A beam of light passes through a circuit stencil and prints the wafer row by row; then the
 *  view closes in on one chip. Timed to the scene: print 24→200, zoom 210→260 (frames). */
export const PrintLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const S = (vertical ? 860 : 760) * u; // drawing size
  const beam = prog(frame, 10, 16);
  const print = interpolate(frame, [24, 200], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [210, 262], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const R = 250; // wafer radius in the 1000-unit drawing
  const cx = 500;
  const cy = 700;
  const cell = 46;
  const dies: { x: number; y: number; row: number }[] = [];
  for (let gy = -6; gy <= 5; gy++)
    for (let gx = -6; gx <= 5; gx++) {
      const x = cx + gx * cell;
      const y = cy + gy * cell;
      const corners = [[x, y], [x + cell, y], [x, y + cell], [x + cell, y + cell]];
      if (corners.every(([px, py]) => Math.hypot(px - cx, py - cy) < R - 6)) dies.push({ x, y, row: gy + 6 });
    }
  const rowsDone = print * 12;
  const scanY = cy - 6 * cell + rowsDone * cell;
  const target = dies[Math.floor(dies.length / 2)];
  const z = 1 + zoom * 6;
  const tx = (cx - (target.x + cell / 2)) * zoom;
  const ty = (500 - (target.y + cell / 2)) * zoom;
  return (
    <Frame gap={18}>
      <Title text={d.text} />
      <div style={{ position: "relative", width: S, height: S * 0.84, overflow: "hidden" }}>
        <svg width={S} height={S * 0.84} viewBox="0 130 1000 840">
          <g transform={`translate(500 500) scale(${z}) translate(${-500 + tx} ${-500 + ty})`}>
            {/* lamp, stencil plate and beam */}
            <g opacity={1 - zoom}>
              <rect x={420} y={150} width={160} height={60} rx={8} fill={DOC.ink} />
              <text x={500} y={188} fill={DOC.paper} fontFamily={DOC.fonts.mono} fontSize={22} textAnchor="middle" fontWeight={700}>LIGHT</text>
              <polygon points={`470,210 530,210 ${560},300 ${440},300`} fill="#F2C14E" opacity={0.35 * beam} />
              <rect x={380} y={300} width={240} height={26} fill="#E9DFCB" stroke={DOC.ink} strokeWidth={3} />
              {Array.from({ length: 9 }, (_, i) => (
                <rect key={i} x={392 + i * 25} y={306} width={i % 3 === 1 ? 14 : 8} height={14} fill={DOC.ink} />
              ))}
              <text x={640} y={320} fill={DOC.inkSoft} fontFamily={DOC.fonts.mono} fontSize={20}>stencil</text>
              <polygon points={`440,326 560,326 ${520 + 0},${scanY} ${480},${scanY}`} fill="#F2C14E" opacity={0.3 * beam * (1 - print * 0.2)} />
            </g>
            {/* the wafer */}
            <circle cx={cx} cy={cy} r={R} fill="#D9D4CC" stroke={DOC.ink} strokeWidth={4} />
            <circle cx={cx} cy={cy} r={R - 10} fill="none" stroke={DOC.inkSoft} strokeWidth={1.5} strokeDasharray="4 6" />
            {dies.map((dd, i) => {
              const done = Math.max(0, Math.min(1, rowsDone - dd.row));
              const hot = dd === target && zoom > 0;
              return (
                <g key={i}>
                  <rect x={dd.x + 2} y={dd.y + 2} width={cell - 4} height={cell - 4} fill={done > 0 ? (hot ? "#F6EFE1" : "#9A8F7E") : "#E7E2D8"} opacity={0.35 + done * 0.65} stroke={DOC.inkSoft} strokeWidth={1} />
                  {done >= 1 &&
                    [8, 16, 24, 32].map((o) => <line key={o} x1={dd.x + 6} x2={dd.x + cell - 6} y1={dd.y + o + 2} y2={dd.y + o + 2} stroke={hot ? DOC.ink : "#5E574C"} strokeWidth={hot ? 0.5 : 1.2} />)}
                </g>
              );
            })}
            {/* the chip up close: fine circuit lines appear as we zoom in */}
            {zoom > 0.6 &&
              Array.from({ length: 12 }, (_, i) => (
                <line key={i} x1={target.x + 4 + i * 3.2} x2={target.x + 4 + i * 3.2} y1={target.y + 4} y2={target.y + cell - 4} stroke={DOC.accent} strokeWidth={0.35} opacity={(zoom - 0.6) * 2.5} />
              ))}
          </g>
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 8 * u, textAlign: "center", fontFamily: DOC.fonts.hand, fontSize: 40 * u, color: DOC.accent, opacity: prog(frame, 214, 16) }}>one chip, billions of lines</div>
      </div>
      {d.sub && <div style={{ fontFamily: DOC.fonts.body, fontWeight: 500, fontSize: 28 * u, color: DOC.inkSoft, opacity: prog(frame, 60, 16) }}>{d.sub}</div>}
    </Frame>
  );
};

// ---------------------------------------------------------------- the queue

/** The packaging queue: logos roll in from the right on a conveyor, each with a numbered ticket,
 *  and bump up against each other at a paper gate. When the narrator reaches the cue word the
 *  barrier lifts, the front one goes through with a red PACKED stamp, and the rest shuffle up. */
export const QueueLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const cue = useCue();
  const q = d.queue!;
  const W = (vertical ? 980 : 1560) * u;
  const slot = (vertical ? 118 : 205) * u;
  const gateX = (vertical ? 120 : 250) * u;
  const badge = (vertical ? 108 : 150) * u;
  const beltY = 286 * u;
  const n = q.logos.length;
  const passAt = cue(q.passCue, 80);
  const lift = spring({ frame: frame - passAt, fps, config: { damping: 14 } }) - spring({ frame: frame - passAt - 34, fps, config: { damping: 14 } });
  const moved = spring({ frame: frame - passAt - 6, fps, config: { damping: 18, mass: 0.9 } }); // the line shuffles up by one
  const beltRun = frame < passAt ? frame * 1.4 * u : passAt * 1.4 * u + moved * slot;
  return (
    <Frame gap={26}>
      <Title text={d.text} />
      <div style={{ position: "relative", width: W, height: 380 * u }}>
        {/* conveyor: belt with rollers underneath */}
        <div style={{ position: "absolute", left: 0, right: 0, top: beltY, height: 22 * u, background: `repeating-linear-gradient(90deg, #2F2B25 0 ${16 * u}px, #4A443B ${16 * u}px ${32 * u}px)`, backgroundPositionX: -beltRun, borderRadius: 11 * u }} />
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: (i + 0.5) * (W / 16) - 9 * u, top: beltY + 26 * u, width: 18 * u, height: 18 * u, borderRadius: "50%", border: `${3 * u}px solid ${DOC.ink}`, transform: `rotate(${-beltRun / u}deg)`, opacity: 0.7 }}>
            <div style={{ position: "absolute", left: "45%", top: 0, bottom: 0, width: 2 * u, background: DOC.ink }} />
          </div>
        ))}
        {/* the logos in line, front first */}
        {q.logos.map((l: DocLogo, i) => {
          const arrive = spring({ frame: frame - (4 + i * 7), fps, config: { damping: 15, mass: 0.8 } });
          const through = i === 0 ? moved : 0;
          const pos = i - (i === 0 ? 0 : moved); // slots from the gate
          const x = gateX + (vertical ? 150 : 240) * u + pos * slot + (1 - arrive) * (W - gateX) - through * (gateX + 380 * u);
          const bump = Math.sin(Math.min(1, arrive) * Math.PI) * 6 * u;
          const o = i === 0 ? 1 - interpolate(moved, [0.55, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
          return (
            <div key={l.name + i} style={{ position: "absolute", left: x, top: 64 * u - bump, width: badge + 14 * u, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * u, opacity: o * Math.min(1, arrive * 1.5) }}>
              <LogoBadge name={l.name} src={l.src ? asset(l.src, projectPath) : undefined} zoom={l.zoom} color={l.color ?? DOC.ink} size={badge} start={0} />
              {/* queue ticket, hung under each one */}
              <div style={{ fontFamily: DOC.fonts.mono, fontWeight: 700, fontSize: 18 * u, color: DOC.ink, background: "#F6F0E3", border: `${1.5 * u}px dashed ${DOC.inkSoft}`, padding: `${3 * u}px ${10 * u}px`, transform: `rotate(${i % 2 ? 3 : -3}deg)` }}>
                No. {i + 1}
              </div>
              {i === 0 && moved > 0.5 && (
                <div style={{ position: "absolute", top: 30 * u, fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 28 * u, letterSpacing: 3 * u, color: DOC.accent, border: `${3 * u}px solid ${DOC.accent}`, padding: `${2 * u}px ${10 * u}px`, transform: "rotate(-10deg)", opacity: interpolate(moved, [0.5, 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>PACKED</div>
              )}
            </div>
          );
        })}
        {/* the gate: a torn paper booth and a striped barrier that lifts */}
        <div style={{ position: "absolute", left: gateX - (vertical ? 60 : 80) * u, top: beltY - 196 * u, width: (vertical ? 120 : 160) * u, height: 196 * u, filter: paperShadow(u * 0.6) }}>
          <TornSheetBg />
          <div style={{ paddingTop: 22 * u, textAlign: "center", fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 30 * u, letterSpacing: 2 * u, color: DOC.accent }}>{q.gate}</div>
          <div style={{ textAlign: "center", fontFamily: DOC.fonts.mono, fontSize: 15 * u, color: DOC.inkSoft, marginTop: 6 * u }}>packaging</div>
        </div>
        <div style={{ position: "absolute", left: gateX + (vertical ? 64 : 86) * u, top: beltY - 150 * u, width: 12 * u, height: 150 * u, background: DOC.ink }} />
        <div style={{ position: "absolute", left: gateX + (vertical ? 70 : 92) * u, top: beltY - 150 * u, width: (vertical ? 80 : 130) * u, height: 14 * u, background: `repeating-linear-gradient(90deg, ${DOC.accent} 0 ${20 * u}px, ${DOC.paper} ${20 * u}px ${40 * u}px)`, border: `${2 * u}px solid ${DOC.ink}`, transformOrigin: "0 50%", transform: `rotate(${-78 * lift}deg)` }} />
        <div style={{ position: "absolute", right: 0, top: beltY + 56 * u, fontFamily: DOC.fonts.hand, fontSize: 36 * u, color: DOC.inkSoft, opacity: prog(frame, 40, 14) }}>{n} waiting · one at a time</div>
      </div>
      {d.sub && <div style={{ fontFamily: DOC.fonts.body, fontWeight: 500, fontSize: 30 * u, color: DOC.inkSoft }}>{d.sub}</div>}
    </Frame>
  );
};

// ---------------------------------------------------------------- route with a paper plane

const PaperPlane: React.FC<{ size: number; angle: number }> = ({ size, angle }) => (
  <svg width={size} height={size} viewBox="-20 -20 40 40" style={{ overflow: "visible", transform: `rotate(${angle}deg)` }}>
    <path d="M18,0 L-16,-12 L-8,0 L-16,12 Z" fill="#F6F0E3" stroke={DOC.ink} strokeWidth={2} strokeLinejoin="round" />
    <path d="M18,0 L-8,0" stroke={DOC.ink} strokeWidth={1.5} />
  </svg>
);

/** Two place tags joined by a dashed arc; a paper plane flies it, and back below when roundTrip. */
export const RouteLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const r = d.route!;
  const W = (vertical ? 940 : 1400) * u;
  const H = (vertical ? 520 : 440) * u;
  const ax = 150 * u;
  const bx = W - 150 * u;
  const ay = H * 0.55;
  const out = interpolate(frame, [16, 96], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const back = interpolate(frame, [110, 190], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arc = (t: number, dir: 1 | -1) => {
    const x = dir === 1 ? ax + (bx - ax) * t : bx - (bx - ax) * t;
    const y = ay - Math.sin(Math.PI * t) * H * (dir === 1 ? 0.46 : 0.22);
    return [x, y] as const;
  };
  const path = (dir: 1 | -1, upto: number) =>
    Array.from({ length: 41 }, (_, i) => arc((i / 40) * upto, dir))
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  const plane = (dir: 1 | -1, t: number) => {
    const [x, y] = arc(Math.max(0.001, t), dir);
    const [x2, y2] = arc(Math.min(1, t + 0.02), dir);
    return { x, y, a: (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI };
  };
  const tag = (p: { label: string; sub?: string }, x: number, start: number, accent?: boolean) => {
    const a = prog(frame, start, 14);
    return (
      <div style={{ position: "absolute", left: x - 140 * u, top: ay + 30 * u, width: 280 * u, padding: `${16 * u}px ${18 * u}px`, opacity: a, transform: `translateY(${(1 - a) * 20 * u}px) rotate(${accent ? 1.5 : -1.5}deg)`, filter: paperShadow(u * 0.6), textAlign: "center" }}>
        <TornSheetBg />
        <div style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 30 * u, letterSpacing: 3 * u, textTransform: "uppercase", color: accent ? DOC.accent : DOC.ink }}>{p.label}</div>
        {p.sub && <div style={{ fontFamily: DOC.fonts.mono, fontSize: 19 * u, color: DOC.inkSoft, marginTop: 6 * u }}>{p.sub}</div>}
      </div>
    );
  };
  const p1 = plane(1, out);
  const p2 = plane(-1, back);
  return (
    <Frame gap={10}>
      <Title text={d.text} />
      <div style={{ position: "relative", width: W, height: H + 120 * u }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d={path(1, out)} fill="none" stroke={DOC.ink} strokeWidth={3 * u} strokeDasharray={`${10 * u} ${10 * u}`} />
          {r.roundTrip && back > 0 && <path d={path(-1, back)} fill="none" stroke={DOC.accent} strokeWidth={3 * u} strokeDasharray={`${10 * u} ${10 * u}`} />}
          <circle cx={ax} cy={ay} r={9 * u} fill={DOC.ink} />
          <circle cx={bx} cy={ay} r={9 * u} fill={DOC.accent} />
        </svg>
        {out > 0 && out < 1 && <div style={{ position: "absolute", left: p1.x - 30 * u, top: p1.y - 30 * u }}><PaperPlane size={60 * u} angle={p1.a} /></div>}
        {r.roundTrip && back > 0 && back < 1 && <div style={{ position: "absolute", left: p2.x - 30 * u, top: p2.y - 30 * u }}><PaperPlane size={60 * u} angle={p2.a} /></div>}
        {r.outLabel && <div style={{ position: "absolute", left: 0, right: 0, top: ay - H * 0.46 - 54 * u, textAlign: "center", fontFamily: DOC.fonts.hand, fontSize: 38 * u, color: DOC.ink, opacity: prog(frame, 40, 14) }}>{r.outLabel}</div>}
        {r.roundTrip && r.backLabel && <div style={{ position: "absolute", left: 0, right: 0, top: ay - H * 0.22 + 14 * u, textAlign: "center", fontFamily: DOC.fonts.hand, fontSize: 38 * u, color: DOC.accent, opacity: prog(frame, 140, 14) }}>{r.backLabel}</div>}
        {tag(r.from, ax, 4)}
        {tag(r.to, bx, 12, true)}
      </div>
    </Frame>
  );
};

// ---------------------------------------------------------------- receipt

/** A receipt printing out of a slot, one line at a time (on cues), with a total at the bottom. */
export const ReceiptLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const cue = useCue();
  const rc = d.receipt!;
  const W = (vertical ? 760 : 640) * u;
  const starts = rc.lines.map((l, i) => cue(l.cue, 14 + i * 22));
  const totalAt = cue(rc.total?.cue, (starts[starts.length - 1] ?? 14) + 26);
  const last = rc.total ? totalAt : starts[starts.length - 1] ?? 0;
  const grow = interpolate(frame, [4, last + 16], [0.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = (label: string, value: string, at: number, bold?: boolean) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 * u, opacity: prog(frame, at, 8), fontFamily: DOC.fonts.mono, fontWeight: bold ? 700 : 500, fontSize: (bold ? 30 : 25) * u, color: bold ? DOC.accent : DOC.ink }}>
      <span>{label}</span>
      <span style={{ flex: 1, borderBottom: `${2 * u}px dotted ${DOC.inkSoft}`, transform: `translateY(${-6 * u}px)` }} />
      <span>{value}</span>
    </div>
  );
  return (
    <Frame gap={0}>
      {/* the printer slot */}
      <div style={{ width: W + 80 * u, height: 34 * u, background: DOC.ink, borderRadius: 8 * u, zIndex: 2 }} />
      <div style={{ width: W, overflow: "hidden", maxHeight: 700 * u * grow, filter: paperShadow(u) }}>
        <div style={{ background: "#FBF8F1", padding: `${30 * u}px ${36 * u}px ${46 * u}px`, display: "flex", flexDirection: "column", gap: 18 * u, clipPath: "polygon(0 0, 100% 0, 100% 97%, 95% 100%, 90% 97%, 85% 100%, 80% 97%, 75% 100%, 70% 97%, 65% 100%, 60% 97%, 55% 100%, 50% 97%, 45% 100%, 40% 97%, 35% 100%, 30% 97%, 25% 100%, 20% 97%, 15% 100%, 10% 97%, 5% 100%, 0 97%)" }}>
          <div style={{ textAlign: "center", fontFamily: DOC.fonts.mono, fontWeight: 700, fontSize: 26 * u, letterSpacing: 4 * u, color: DOC.ink }}>{rc.title}</div>
          <div style={{ borderTop: `${2 * u}px dashed ${DOC.inkSoft}` }} />
          {rc.lines.map((l, i) => (
            <React.Fragment key={i}>{line(l.label, l.value, starts[i])}</React.Fragment>
          ))}
          {rc.total && (
            <>
              <div style={{ borderTop: `${2 * u}px dashed ${DOC.inkSoft}`, opacity: prog(frame, totalAt, 8) }} />
              {line(rc.total.label, rc.total.value, totalAt, true)}
            </>
          )}
        </div>
      </div>
    </Frame>
  );
};

// ---------------------------------------------------------------- banknotes

/** One paper dollar per company: the share it keeps is shaded in ink, the rest left blank. */
export const DollarLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const cue = useCue();
  const W = (vertical ? 820 : 640) * u;
  const H = W * 0.43;
  return (
    <Frame gap={30}>
      <Title text={d.text} />
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 60 * u }}>
        {d.dollars!.map((b, i) => {
          const start = cue(b.cue, 16 + i * 30);
          const a = prog(frame, start - 10, 14);
          const fill = prog(frame, start, 30) * (b.share / 100);
          const color = b.accent ? DOC.accent : DOC.ink;
          return (
            <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * u, opacity: a, transform: `translateY(${(1 - a) * 24 * u}px) rotate(${i % 2 ? 1.2 : -1.2}deg)` }}>
              <div style={{ position: "relative", width: W, height: H, background: "#D9DEC9", border: `${3 * u}px solid #4E5A43`, filter: paperShadow(u * 0.7), overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 10 * u, border: `${1.5 * u}px solid #4E5A43` }} />
                <div style={{ position: "absolute", left: 24 * u, top: 18 * u, fontFamily: DOC.fonts.headline, fontSize: 54 * u, color: "#4E5A43" }}>$1</div>
                <div style={{ position: "absolute", right: 24 * u, bottom: 14 * u, fontFamily: DOC.fonts.headline, fontSize: 54 * u, color: "#4E5A43" }}>$1</div>
                <div style={{ position: "absolute", left: "50%", top: "50%", width: H * 0.62, height: H * 0.62, transform: "translate(-50%, -50%)", borderRadius: "50%", border: `${2 * u}px solid #4E5A43` }} />
                {/* the share kept: hatched ink from the left */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: `repeating-linear-gradient(135deg, ${color}CC 0 ${5 * u}px, ${color}55 ${5 * u}px ${10 * u}px)` }} />
                {fill > 0 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${fill * 100}% - ${2 * u}px)`, width: 4 * u, background: color }} />}
              </div>
              <div style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 32 * u, letterSpacing: 3 * u, textTransform: "uppercase", color }}>{b.label}</div>
              <div style={{ fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 26 * u, color: DOC.inkSoft }}>keeps ~{Math.round(fill * 100)}¢ of every $1 {b.note ?? ""}</div>
            </div>
          );
        })}
      </div>
      {d.sub && <div style={{ fontFamily: DOC.fonts.body, fontWeight: 500, fontSize: 28 * u, color: DOC.inkSoft }}>{d.sub}</div>}
    </Frame>
  );
};

// ---------------------------------------------------------------- split-flap number

const FLAP_CHARS = "0123456789$€.,+~–%BTM";

/** A big number on an old split-flap board: each tile flips through characters, then settles. */
export const StatFlap: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const cue = useCue();
  const st = d.stat!;
  const text = `${st.prefix ?? ""}${st.value.toLocaleString("en-US", { minimumFractionDigits: st.decimals ?? 0, maximumFractionDigits: st.decimals ?? 0 })}${st.suffix ?? ""}`;
  const start = cue(st.cue, 10, 6);
  const tile = (vertical ? 120 : 132) * u;
  return (
    <Frame gap={30}>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ display: "flex", gap: 10 * u, padding: 22 * u, background: "#2A2621", borderRadius: 14 * u, filter: paperShadow(u) }}>
        {[...text].map((ch, i) => {
          const settle = start + 8 + i * 5;
          const flipping = frame < settle;
          const shown = frame < start ? " " : flipping ? FLAP_CHARS[Math.floor(random(`f${i}${Math.floor(frame / 2)}`) * FLAP_CHARS.length)] : ch;
          const half = (frame % 2) * 0.5;
          return (
            <div key={i} style={{ position: "relative", width: ch === "." || ch === "," ? tile * 0.42 : tile * 0.72, height: tile, background: "#3A352E", borderRadius: 8 * u, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <span style={{ fontFamily: DOC.fonts.mono, fontWeight: 700, fontSize: tile * 0.74, color: flipping ? "#CFC6B5" : "#F4EEE1", transform: flipping ? `scaleY(${1 - half})` : undefined }}>{shown}</span>
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2 * u, background: "#1C1A17" }} />
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: DOC.fonts.headline, fontSize: 46 * u, color: DOC.ink, textAlign: "center", maxWidth: 1200 * u, opacity: prog(frame, start + 20, 14) }}>{st.label}</div>
      {d.sub && <div style={{ fontFamily: DOC.fonts.body, fontWeight: 500, fontSize: 30 * u, color: DOC.inkSoft, opacity: prog(frame, start + 30, 14) }}>{d.sub}</div>}
    </Frame>
  );
};

// ---------------------------------------------------------------- icon grid

/** Ten engraved objects in two rows (a share you can count): `lit` of them in full ink, popping in
 *  one by one; the rest faded and grey. Used for "~90% of advanced chips", "7 in 10 dollars". */
export const IconGrid: React.FC<{ kind: InkKind; lit: number; start: number }> = ({ kind, lit, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const cell = (vertical ? 150 : 128) * u;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(5, ${cell}px)`, gap: `${22 * u}px ${18 * u}px` }}>
      {Array.from({ length: 10 }, (_, i) => {
        const on = i < lit;
        const pop = spring({ frame: frame - (start + i * 4), fps, config: { damping: 12, mass: 0.6 } });
        const tilt = ((i * 53) % 9) - 4;
        return (
          <div key={i} style={{ width: cell, height: cell, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.6 + 0.4 * pop}) rotate(${tilt}deg)`, opacity: Math.min(1, pop * 1.4) * (on ? 1 : 0.28), filter: on ? undefined : "grayscale(1)" }}>
            <InkIcon kind={kind} size={cell} />
          </div>
        );
      })}
    </div>
  );
};

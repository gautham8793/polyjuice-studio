// Documentary template — reusable building blocks. Every part reads colours/fonts from DOC
// (theme.ts) and sizes itself from the frame, so the same part works in 16:9 and 9:16.
import { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DOC } from "./theme";

// ---------- helpers ----------
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const prog = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Frame layout facts: vertical or not, and a unit that is 1px at 1080 on the short side. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return { width, height, vertical, u };
};

// ---------- paper world ----------
/** Warm paper with flickering grain and a soft vignette. */
export const Paper: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 5; // grain "boils" like film
  return (
    <AbsoluteFill style={{ background: dark ? DOC.ink : DOC.paper }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: DOC.grain, mixBlendMode: "multiply" }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
      {/* large, slow paper fibres */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.08, mixBlendMode: "multiply" }}>
        <filter id="fibre">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="3" seed={7} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#fibre)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(60,40,20,0.22) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Slow push-in for a whole beat (documentary "rostrum camera"). */
export const Drift: React.FC<{ dur: number; from?: number; to?: number; children: React.ReactNode }> = ({ dur, from = 1, to = 1.035, children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, dur], [from, to], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>;
};

/** Fade a beat in and out. */
export const BeatFade: React.FC<{ dur: number; last?: boolean; children: React.ReactNode }> = ({ dur, last, children }) => {
  const frame = useCurrentFrame();
  const o = Math.min(prog(frame, 0, 10), last ? 1 : 1 - prog(frame, dur - 10, 10));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

// ---------- text pieces ----------
export const Kicker: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = DOC.inkSoft, size = 26 }) => {
  const { u } = useLayout();
  return (
    <div style={{ fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: size * u, letterSpacing: 4 * u, textTransform: "uppercase", color }}>{children}</div>
  );
};

/** A highlighter stroke that sweeps across inline text. */
export const Highlight: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, start, 18);
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${DOC.highlight}, ${DOC.highlight})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${p * 100}% 78%`,
        backgroundPosition: "0 70%",
        padding: "0 0.1em",
        margin: "0 -0.1em", // the marker overruns the word without pushing the words apart
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
};

/** Small "SOURCE · …" chip, so every number on screen shows where it came from. */
export const SourceChip: React.FC<{ text: string; start: number }> = ({ text, start }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 14);
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: DOC.fonts.mono,
        fontSize: 20 * u,
        letterSpacing: 2 * u,
        color: DOC.inkSoft,
        border: `${1.5 * u}px solid ${DOC.inkSoft}`,
        padding: `${6 * u}px ${12 * u}px`,
        opacity: p,
        transform: `translateY(${(1 - p) * 8 * u}px)`,
      }}
    >
      SOURCE · {text}
    </div>
  );
};

/** The scene's source as a quiet footnote in one fixed place: bottom-left (16:9) or under the
 *  chapter tag (9:16). Same style in every scene. */
export const Footnote: React.FC<{ text: string; start?: number }> = ({ text, start = 24 }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const o = prog(frame, start, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: 64 * u,
        ...(vertical ? { top: 200 * u } : { bottom: 150 * u }),
        maxWidth: (vertical ? 700 : 560) * u,
        display: "flex",
        alignItems: "baseline",
        gap: 10 * u,
        opacity: 0.8 * o,
        fontFamily: DOC.fonts.serif,
        fontStyle: "italic",
        fontSize: (vertical ? 24 : 22) * u,
        color: DOC.inkSoft,
        lineHeight: 1.3,
      }}
    >
      <span style={{ fontFamily: DOC.fonts.mono, fontStyle: "normal", fontSize: (vertical ? 16 : 15) * u, letterSpacing: 2 * u, color: DOC.accent }}>SOURCE</span>
      <span>{text}</span>
    </div>
  );
};

/** Counts up to a value; keeps the formatting of the final string (commas, %). */
export const Counter: React.FC<{ to: number; start: number; dur?: number; suffix?: string; decimals?: number; style?: React.CSSProperties }> = ({ to, start, dur = 36, suffix = "", decimals = 0, style }) => {
  const frame = useCurrentFrame();
  const v = to * prog(frame, start, dur);
  // hidden until the narrator reaches the number (no "$0.0T" waiting on screen)
  return <span style={{ opacity: prog(frame, start - 2, 8), ...style }}>{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
};

// ---------- old paper ----------
/** CSS for an old, yellowed sheet: warm base, a lighter centre, two faint stains and burnt edges. */
export const agedPaper = (u: number, extraShadow = ""): React.CSSProperties => ({
  backgroundColor: DOC.oldPaper,
  backgroundImage: [
    "radial-gradient(ellipse at 32% 28%, rgba(255,247,226,0.55), transparent 62%)",
    "radial-gradient(circle at 84% 74%, rgba(150,100,40,0.16), transparent 16%)",
    "radial-gradient(circle at 10% 88%, rgba(150,100,40,0.12), transparent 12%)",
    "radial-gradient(circle at 63% 12%, rgba(150,100,40,0.08), transparent 9%)",
    "radial-gradient(ellipse at center, transparent 58%, rgba(120,80,30,0.26) 100%)",
  ].join(","),
  boxShadow: [`inset 0 0 ${38 * u}px ${DOC.oldPaperEdge}`, extraShadow].filter(Boolean).join(","),
});

/** Paper fibres and foxing specks over an old sheet (place as the first child of the sheet). */
export const AgedGrain: React.FC<{ seed?: number }> = ({ seed = 11 }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.35 }}>
    <filter id={`aged-${seed}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.7 0.25" numOctaves="3" seed={seed} />
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0 0 0 0.9 -0.2" />
    </filter>
    <rect width="100%" height="100%" filter={`url(#aged-${seed})`} />
  </svg>
);

// ---------- paper sheets ----------
export const TORN_SHEET = "library/doc-template/paper/torn-sheet.png";
/** The torn paper sheet (Figma), stretched behind a container's content.
 *  No negative z-index: in the browser player a z-index -1 sheet sometimes painted over the text
 *  (channel name vanishing, cards flickering). Instead the sheet sits at z 0 and everything after it
 *  in the same container is lifted to z 1 (absolutely positioned content keeps its own position). */
const TORN_RULE = ".torn-sheet-bg ~ * { position: relative; z-index: 1; }";
export const TornSheetBg: React.FC = () => (
  <>
    <style>{TORN_RULE}</style>
    <Img className="torn-sheet-bg" src={staticFile(TORN_SHEET)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />
  </>
);
export const paperShadow = (u: number) => `drop-shadow(0 ${10 * u}px ${14 * u}px rgba(40,25,10,0.22))`;

export type PaperStyle = "aged" | "torn" | "tornAged" | "figma" | "manila";

/** A rough, hand-torn outline as a CSS polygon (deterministic per seed). */
const tornPolygon = (seed: number, amp = 1) => {
  const r = (i: number) => {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const pts: string[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${r(i) * 1.6 * amp}%`);
  for (let i = 0; i <= 14; i++) pts.push(`${100 - r(i + 40) * 1.1 * amp}% ${(i / 14) * 100}%`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n) * 100}% ${100 - r(i + 80) * 1.6 * amp}%`);
  for (let i = 14; i >= 0; i--) pts.push(`${r(i + 120) * 1.1 * amp}% ${(i / 14) * 100}%`);
  return `polygon(${pts.join(",")})`;
};

const SHEETS: Record<Exclude<PaperStyle, "aged" | "figma">, { rim: string; face: string; stains: boolean }> = {
  torn: { rim: "#FBF8F0", face: "#F1EADB", stains: false }, // cream, like the paper the icons are printed on
  tornAged: { rim: "#F6EEDC", face: "#EADFC4", stains: true }, // the same, older: ivory with faint foxing
  manila: { rim: "#EBDDBB", face: "#DCC79C", stains: true }, // manila / file-folder card
};

/**
 * A sheet of paper that holds content. `variant` picks the paper; the content sits above it.
 * Torn variants get a lighter fibrous rim and a rough edge on every side, like the Figma icons.
 */
export const Sheet: React.FC<{ variant?: PaperStyle; seed?: number; padding: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ variant = DOC.paperStyle, seed = 5, padding, style, children }) => {
  const { u } = useLayout();
  const shadow = `drop-shadow(0 ${10 * u}px ${14 * u}px rgba(40,25,10,0.22))`;
  if (variant === "aged") {
    return (
      <div style={{ position: "relative", padding, ...agedPaper(u, `0 ${12 * u}px ${30 * u}px rgba(40,25,10,0.22)`), ...style }}>
        <AgedGrain seed={seed} />
        {children}
      </div>
    );
  }
  if (variant === "figma") {
    return (
      <div style={{ position: "relative", padding, filter: shadow, ...style }}>
        <TornSheetBg />
        {children}
      </div>
    );
  }
  const c = SHEETS[variant];
  return (
    <div style={{ position: "relative", padding, filter: shadow, ...style }}>
      <div style={{ position: "absolute", inset: 0, zIndex: -1, background: c.rim, clipPath: tornPolygon(seed, 1.2) }} />
      <div
        style={{
          position: "absolute",
          inset: `${6 * u}px`,
          zIndex: -1,
          backgroundColor: c.face,
          backgroundImage: c.stains
            ? "radial-gradient(ellipse at 35% 30%, rgba(255,250,235,0.45), transparent 60%), radial-gradient(circle at 80% 76%, rgba(150,105,45,0.12), transparent 14%), radial-gradient(ellipse at center, transparent 62%, rgba(120,85,35,0.16) 100%)"
            : "radial-gradient(ellipse at 35% 30%, rgba(255,252,242,0.5), transparent 65%)",
          clipPath: tornPolygon(seed + 3, 0.9),
        }}
      >
        <AgedGrain seed={seed} />
      </div>
      {children}
    </div>
  );
};

// ---------- channel brand ----------
export type ChannelInfo = { name: string; handle: string; logo: string };
export const CHANNEL_LOGO = "brand/logo/polyjuice-logo-round-transparent.png";

/** Small channel tag that stays on screen: logo + name + handle on a strip of the torn paper.
 *  Shorts: top-left (they have no chapter tag). Long-form: bottom-right corner, clear of captions. */
export const ChannelTag: React.FC<{ channel: ChannelInfo; opacity?: number }> = ({ channel, opacity = 1 }) => {
  const { u, vertical } = useLayout();
  return (
    <div
      style={{
        position: "absolute",
        ...(vertical ? { left: 56 * u, top: 96 * u } : { right: 48 * u, bottom: 44 * u }),
        display: "flex",
        alignItems: "center",
        gap: 12 * u,
        padding: `${10 * u}px ${20 * u}px ${10 * u}px ${12 * u}px`,
        filter: paperShadow(u),
        opacity,
        transform: "rotate(-1.5deg)",
      }}
    >
      <TornSheetBg />
      <Img src={staticFile(channel.logo)} style={{ width: (vertical ? 56 : 44) * u, height: (vertical ? 56 : 44) * u }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 30 : 24) * u, color: DOC.ink }}>{channel.name}</span>
        <span style={{ fontFamily: DOC.fonts.mono, fontSize: (vertical ? 17 : 14) * u, letterSpacing: 1 * u, color: DOC.inkSoft }}>{channel.handle}</span>
      </div>
    </div>
  );
};

/** The channel block on end cards: big logo, name and handle. */
export const ChannelBlock: React.FC<{ channel: ChannelInfo; start?: number }> = ({ channel, start = 0 }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const p = prog(frame, start, 16);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 * u, opacity: p, transform: `translateY(${(1 - p) * 16 * u}px)` }}>
      <Img src={staticFile(channel.logo)} style={{ width: (vertical ? 130 : 110) * u, height: (vertical ? 130 : 110) * u }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 * u }}>
        <span style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 58 : 52) * u, lineHeight: 1, color: DOC.ink }}>{channel.name}</span>
        <span style={{ fontFamily: DOC.fonts.mono, fontSize: (vertical ? 26 : 22) * u, letterSpacing: 2 * u, color: DOC.accent }}>{channel.handle}</span>
      </div>
    </div>
  );
};

// ---------- chrome ----------
/** Top-left chapter tag: "1 · THEY TOOK PAYMENTS". */
export const ChapterTag: React.FC<{ n: number; title: string }> = ({ n, title }) => {
  const { u, vertical } = useLayout();
  return (
    <div style={{ position: "absolute", top: (vertical ? 120 : 56) * u, left: 64 * u, display: "flex", alignItems: "center", gap: 14 * u }}>
      <div style={{ width: 40 * u, height: 40 * u, background: DOC.ink, color: DOC.paper, fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: 30 * u, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
      <div style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 22 * u, letterSpacing: 3 * u, color: DOC.ink, textTransform: "uppercase" }}>{title}</div>
    </div>
  );
};

export const PILLARS = ["Payments", "Customer", "Deposits", "Lending"];

// The bank illustration (Figma "Video Studio — Character Sheets", node 164:11), cut into five
// torn-paper pieces by tools/cutout_pieces.py. Boxes are in the cut-out's own pixels (922×543).
const BANK_DIR = "library/doc-template/bank/";
const BANK_W = 922;
const BANK_H = 543;
const BANK_PIECES: Record<string, { x: number; y: number; w: number; h: number }> = {
  "pillar-1": { x: -3, y: 39, w: 155, h: 507 },
  "pillar-2": { x: 151, y: 39, w: 132, h: 501 },
  bank: { x: 290, y: -3, w: 341, h: 532 },
  "pillar-3": { x: 640, y: 38, w: 130, h: 501 },
  "pillar-4": { x: 769, y: 36, w: 156, h: 508 },
};
const PILLAR_PIECES = ["pillar-1", "pillar-2", "pillar-3", "pillar-4"]; // payments, customer, deposits, lending

/** How one pillar is drawn: hidden behind a dashed "gone" slot, lifted, carried off, or marked in red. */
export type PillarLook = { opacity?: number; dx?: number; dy?: number; rot?: number; ghost?: boolean; accent?: boolean; underline?: boolean };

/** Extra space pushed between the pieces: pillar-1 −2, pillar-2 −1, bank 0, pillar-3 +1, pillar-4 +2 gaps. */
const SPREAD: Record<string, number> = { "pillar-1": -2, "pillar-2": -1, bank: 0, "pillar-3": 1, "pillar-4": 2 };

/** Horizontal centre of pillar i in px, for a bank drawn `width` wide with `gap` px between pieces. */
export const pillarCenter = (i: number, width: number, gap = 0) => {
  const name = PILLAR_PIECES[i];
  const p = BANK_PIECES[name];
  return ((p.x + p.w / 2) / BANK_W) * width + (SPREAD[name] + 2) * gap;
};

/** The bank front and its four pillars, each a separate paper cut-out. */
export const BankArt: React.FC<{ width: number; look?: (i: number) => PillarLook; bankOpacity?: number; outline?: number; gap?: number }> = ({ width, look, bankOpacity = 1, outline = 3, gap = 0 }) => {
  const k = width / BANK_W;
  const piece = (name: string, l: PillarLook = {}) => {
    const b = BANK_PIECES[name];
    const box = { position: "absolute" as const, left: b.x * k + (SPREAD[name] + 2) * gap, top: b.y * k, width: b.w * k, height: b.h * k };
    if (l.ghost) {
      // a pillar that was taken: still there as a faint, greyed paper piece (never an empty box)
      return <Img key={name} src={staticFile(BANK_DIR + name + ".png")} style={{ ...box, opacity: 0.22 * (l.opacity ?? 1), filter: `grayscale(1) ${DOC.agedFilter}` }} />;
    }
    const o = Math.max(1, outline * k * 2);
    const red = l.accent ? `drop-shadow(${o}px 0 0 ${DOC.accent}) drop-shadow(-${o}px 0 0 ${DOC.accent}) drop-shadow(0 ${o}px 0 ${DOC.accent}) drop-shadow(0 -${o}px 0 ${DOC.accent}) ` : "";
    return (
      <Img
        key={name}
        src={staticFile(BANK_DIR + name + ".png")}
        style={{
          ...box,
          opacity: l.opacity ?? 1,
          transform: `translate(${l.dx ?? 0}px, ${l.dy ?? 0}px) rotate(${l.rot ?? 0}deg)`,
          filter: `${DOC.agedFilter} ${red}drop-shadow(0 ${3 * k * 2}px ${4 * k * 2}px rgba(50,32,12,0.25))`,
        }}
      />
    );
  };
  const bar = (name: string, l: PillarLook = {}) => {
    if (!l.underline) return null;
    const b = BANK_PIECES[name];
    return <div key={`${name}-bar`} style={{ position: "absolute", left: (b.x + b.w * 0.15) * k + (SPREAD[name] + 2) * gap, width: b.w * 0.7 * k, top: (b.y + b.h) * k + 4 * k * 2, height: Math.max(3, 5 * k * 2), background: DOC.accent, transform: `translateY(${l.dy ?? 0}px)` }} />;
  };
  return (
    <div style={{ position: "relative", width: width + 4 * gap, height: BANK_H * k }}>
      <div style={{ position: "absolute", inset: 0, opacity: bankOpacity }}>{piece("bank")}</div>
      {PILLAR_PIECES.map((name, i) => piece(name, look?.(i)))}
      {PILLAR_PIECES.map((name, i) => bar(name, look?.(i)))}
    </div>
  );
};

/** Corner tracker: the bank illustration, small. The chapter's pillar is outlined in red and
 *  bobs; pillars earlier chapters took are dashed outlines. */
export const PillarTracker: React.FC<{ active: number; taken?: number[] }> = ({ active, taken = [] }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const lift = interpolate(Math.sin(frame / 18), [-1, 1], [0, -5 * u]);
  const W = 140 * u;
  return (
    <div style={{ position: "absolute", right: 56 * u, top: (vertical ? 100 : 40) * u, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * u }}>
      <BankArt width={W} look={(i) => (taken.includes(i) ? { ghost: true } : i === active ? { underline: true, dy: lift } : {})} />
      {active >= 0 && (
        <div style={{ fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 13 * u, letterSpacing: 2 * u, color: DOC.accent, textTransform: "uppercase" }}>{PILLARS[active]}</div>
      )}
    </div>
  );
};

/** Narration line, shown as a caption until the real voice + word captions are wired in. */
export const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const o = prog(frame, 4, 12);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: (vertical ? 260 : 58) * u, display: "flex", justifyContent: "center", opacity: o, padding: `0 ${64 * u}px` }}>
      <div style={{ maxWidth: (vertical ? 920 : 1400) * u, background: "rgba(28,26,23,0.86)", color: DOC.paper, fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: (vertical ? 36 : 32) * u, lineHeight: 1.35, padding: `${12 * u}px ${22 * u}px`, textAlign: "center" }}>
        {text}
      </div>
    </div>
  );
};

export type Word = { text: string; start: number; end: number };

/** Word-timed caption: groups of up to 7 words, the spoken word in the accent colour. */
export const WordCaption: React.FC<{ words: Word[]; offset: number; perGroup?: number }> = ({ words, offset, perGroup = 7 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const t = (frame - offset) / fps;
  if (t < 0 || !words.length) return null;
  let idx = words.findIndex((w) => t < w.end);
  if (idx === -1) idx = words.length - 1;
  const g = Math.floor(idx / perGroup);
  const group = words.slice(g * perGroup, g * perGroup + perGroup);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: (vertical ? 260 : 58) * u, display: "flex", justifyContent: "center", padding: `0 ${64 * u}px` }}>
      <div style={{ maxWidth: (vertical ? 920 : 1400) * u, background: "rgba(28,26,23,0.86)", fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: (vertical ? 40 : 34) * u, lineHeight: 1.35, padding: `${12 * u}px ${22 * u}px`, textAlign: "center" }}>
        {group.map((w, i) => {
          const active = g * perGroup + i === idx && t >= w.start - 0.05;
          return (
            <span key={i} style={{ color: active ? "#F6B49B" : DOC.paper }}>
              {w.text}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** "IN INDIA" stamp with tricolour stripes — the recurring India-beat marker. */
export const IndiaTag: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 12);
  const s = interpolate(p, [0, 1], [1.6, 1]);
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", border: `${3 * u}px solid ${DOC.ink}`, background: DOC.stickerEdge, transform: `scale(${s}) rotate(-2deg)`, opacity: p }}>
      <div style={{ display: "flex", flexDirection: "column", width: 16 * u }}>
        <div style={{ flex: 1, background: DOC.saffron }} />
        <div style={{ flex: 1, background: "#FFFFFF" }} />
        <div style={{ flex: 1, background: DOC.indiaGreen }} />
      </div>
      <div style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 34 * u, letterSpacing: 4 * u, color: DOC.ink, padding: `${4 * u}px ${18 * u}px` }}>IN INDIA</div>
    </div>
  );
};

// ---------- collage ----------
/**
 * A photo print taped to the page. `src` is optional: without it the print shows a labelled
 * placeholder (sample stage, before real images exist).
 */
export const PhotoPrint: React.FC<{ label: string; src?: string; credit?: string; w: number; h: number; x: number; y: number; rot: number; start: number; from?: "left" | "right" | "top" | "bottom"; tint?: string }> = ({
  label,
  src,
  credit,
  w,
  h,
  x,
  y,
  rot,
  start,
  from = "bottom",
  tint = "#7A6A55",
}) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 22);
  const off = (1 - p) * 140 * u;
  const dx = from === "left" ? -off : from === "right" ? off : 0;
  const dy = from === "top" ? -off : from === "bottom" ? off : 0;
  const drift = interpolate(frame, [start, start + 300], [0, -10 * u], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const border = 16 * u;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: `translate(${dx}px, ${dy + drift}px) rotate(${rot * (0.4 + 0.6 * p)}deg)`,
        opacity: p,
        filter: paperShadow(u),
        padding: border * 1.4,
      }}
    >
      <TornSheetBg />
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: src ? undefined : `linear-gradient(160deg, ${tint} 0%, #3B3127 100%)`,
          position: "relative",
          filter: "sepia(0.25) contrast(1.05)",
        }}
      >
        {src ? (
          <img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 * u }}>
            <svg width={64 * u} height={52 * u} viewBox="0 0 64 52" style={{ opacity: 0.55 }}>
              <rect x="2" y="8" width="60" height="42" rx="4" fill="none" stroke="#F1ECE2" strokeWidth="3" />
              <circle cx="32" cy="29" r="11" fill="none" stroke="#F1ECE2" strokeWidth="3" />
              <rect x="20" y="2" width="20" height="8" fill="#F1ECE2" />
            </svg>
            <div style={{ fontFamily: DOC.fonts.mono, fontSize: 20 * u, color: "#F1ECE2", opacity: 0.85, textAlign: "center", padding: `0 ${16 * u}px`, letterSpacing: 1 * u }}>PHOTO · {label}</div>
          </div>
        )}
      </div>
      {credit && (
        <div style={{ position: "absolute", left: border, right: border, bottom: 0, height: border, display: "flex", alignItems: "center", justifyContent: "flex-end", fontFamily: DOC.fonts.mono, fontSize: 11 * u, color: DOC.inkSoft, letterSpacing: 0.5 * u }}>
          {credit}
        </div>
      )}
      {/* masking tape */}
      <div style={{ position: "absolute", top: -14 * u, left: "50%", width: 120 * u, height: 32 * u, marginLeft: -60 * u, background: "rgba(230,215,175,0.78)", transform: "rotate(-3deg)", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }} />
    </div>
  );
};

// ---------- red pen ----------
/** A hand-drawn red-pen cross that draws itself over whatever it sits on. */
export const PenCross: React.FC<{ start: number; size: number }> = ({ start, size }) => {
  const frame = useCurrentFrame();
  const a = prog(frame, start, 8);
  const b = prog(frame, start + 6, 8);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, margin: "auto", overflow: "visible" }}>
      <path d="M12,14 C35,38 62,66 90,88" pathLength={1} stroke={DOC.accent} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={1} strokeDashoffset={1 - a} />
      <path d="M88,10 C64,36 38,62 10,90" pathLength={1} stroke={DOC.accent} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={1} strokeDashoffset={1 - b} />
    </svg>
  );
};

/** Line icons drawn in ink, for "No branch / No account / No smartphone" style beats. */
export type InkKind = "bank" | "card" | "smartphone" | "phone" | "house" | "cash" | "shop" | "sms" | "person" | "coin" | "vault" | "lock" | "newspaper" | "chart" | "globe" | "office" | "antenna" | "document" | "briefcase" | "people" | "qr" | "laptop" | "gavel" | "piggy" | "thumbtack" | "paperclip" | "scale" | "chip" | "wafer" | "machine" | "factory" | "plane" | "server" | "lens";
/** Icons that exist as engraved torn-paper art (Figma, same look as the bank illustration),
 *  cut out by tools/cutout_pieces.py into library/doc-template/icons/. The rest are still line icons. */
export const ENGRAVED: Partial<Record<InkKind, string>> = {
  bank: "library/doc-template/bank/bank.png", // the bank front from the bank illustration
  piggy: "library/doc-template/icons/piggy.png",
  briefcase: "library/doc-template/icons/briefcase.png",
  coin: "library/doc-template/icons/coin.png",
  smartphone: "library/doc-template/icons/smartphone.png",
  card: "library/doc-template/icons/card.png",
  phone: "library/doc-template/icons/phone.png",
  house: "library/doc-template/icons/house.png",
  cash: "library/doc-template/icons/cash.png",
  shop: "library/doc-template/icons/shop.png",
  sms: "library/doc-template/icons/sms.png",
  person: "library/doc-template/icons/person.png",
  vault: "library/doc-template/icons/vault.png",
  lock: "library/doc-template/icons/lock.png",
  newspaper: "library/doc-template/icons/newspaper.png",
  chart: "library/doc-template/icons/chart.png",
  globe: "library/doc-template/icons/globe.png",
  office: "library/doc-template/icons/office.png",
  antenna: "library/doc-template/icons/antenna.png",
  document: "library/doc-template/icons/document.png",
  people: "library/doc-template/icons/people.png",
  qr: "library/doc-template/icons/qr.png",
  laptop: "library/doc-template/icons/laptop.png",
  gavel: "library/doc-template/icons/gavel.png",
  thumbtack: "library/doc-template/icons/thumbtack.png",
  paperclip: "library/doc-template/icons/paperclip.png",
  scale: "library/doc-template/icons/scale.png",
  // chips set (17 Nov 2026, The Chip Chokepoint)
  chip: "library/doc-template/icons/chip.png",
  wafer: "library/doc-template/icons/wafer.png",
  machine: "library/doc-template/icons/machine.png",
  factory: "library/doc-template/icons/factory.png",
  plane: "library/doc-template/icons/plane.png",
  server: "library/doc-template/icons/server.png",
  lens: "library/doc-template/icons/lens.png",
};

export const InkIcon: React.FC<{ kind: InkKind; size: number; color?: string }> = ({ kind, size, color = DOC.ink }) => {
  const art = ENGRAVED[kind];
  if (art) {
    // engraved art keeps its ink; the accent becomes a red underline instead of a recolour
    const accent = false; // emphasis is carried by the label colour now (less clutter)
    return (
      <div style={{ width: size * 1.25, height: size * 1.25, margin: -size * 0.125, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Img src={staticFile(art)} style={{ maxWidth: "100%", maxHeight: accent ? "88%" : "100%", objectFit: "contain", filter: `${DOC.agedFilter} drop-shadow(0 3px 4px rgba(50,32,12,0.22))` }} />
        {accent && <div style={{ width: "55%", height: Math.max(3, size * 0.04), background: DOC.accent, marginTop: size * 0.04 }} />}
      </div>
    );
  }
  const sw = 4;
  const common = { fill: "none", stroke: color, strokeWidth: sw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {kind === "bank" && (
        <g {...common}>
          <polygon points="50,10 92,32 8,32" />
          <line x1="18" y1="40" x2="18" y2="78" />
          <line x1="38" y1="40" x2="38" y2="78" />
          <line x1="62" y1="40" x2="62" y2="78" />
          <line x1="82" y1="40" x2="82" y2="78" />
          <line x1="8" y1="88" x2="92" y2="88" />
        </g>
      )}
      {kind === "card" && (
        <g {...common}>
          <rect x="8" y="24" width="84" height="54" rx="6" />
          <line x1="8" y1="40" x2="92" y2="40" strokeWidth={8} />
          <line x1="18" y1="64" x2="44" y2="64" />
        </g>
      )}
      {kind === "smartphone" && (
        <g {...common}>
          <rect x="28" y="6" width="44" height="88" rx="8" />
          <rect x="34" y="16" width="32" height="62" rx="2" />
          <line x1="46" y1="86" x2="54" y2="86" />
        </g>
      )}
      {kind === "phone" && (
        <g {...common}>
          <rect x="30" y="8" width="40" height="84" rx="8" />
          <rect x="36" y="16" width="28" height="22" rx="2" />
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={40 + c * 10} cy={50 + r * 11} r={2.5} fill={color} />))}
        </g>
      )}
      {kind === "cash" && (
        <g {...common}>
          <rect x="6" y="26" width="76" height="44" rx="3" />
          <rect x="18" y="34" width="76" height="44" rx="3" fill="#FBF8F2" />
          <circle cx="56" cy="56" r="10" />
          <line x1="28" y1="56" x2="34" y2="56" />
          <line x1="78" y1="56" x2="84" y2="56" />
        </g>
      )}
      {kind === "shop" && (
        <g {...common}>
          <path d="M10,36 L18,14 L82,14 L90,36 Z" />
          <path d="M10,36 Q20,46 30,36 Q40,46 50,36 Q60,46 70,36 Q80,46 90,36" />
          <rect x="16" y="44" width="68" height="44" />
          <rect x="40" y="60" width="20" height="28" />
        </g>
      )}
      {kind === "sms" && (
        <g {...common}>
          <path d="M12,18 H88 V66 H44 L26,84 V66 H12 Z" />
          <line x1="26" y1="36" x2="74" y2="36" />
          <line x1="26" y1="50" x2="60" y2="50" />
        </g>
      )}
      {kind === "person" && (
        <g {...common}>
          <circle cx="50" cy="30" r="16" />
          <path d="M18,90 C18,64 32,54 50,54 C68,54 82,64 82,90" />
        </g>
      )}
      {kind === "coin" && (
        <g {...common}>
          <circle cx="50" cy="50" r="38" />
          <circle cx="50" cy="50" r="28" strokeDasharray="4 5" />
          <path d="M56,36 C52,33 42,33 42,41 C42,49 58,47 58,56 C58,65 46,66 42,62 M50,28 V34 M50,66 V72" />
        </g>
      )}
      {kind === "vault" && (
        <g {...common}>
          <rect x="10" y="12" width="80" height="72" rx="4" />
          <circle cx="50" cy="48" r="18" />
          <line x1="50" y1="30" x2="50" y2="66" />
          <line x1="32" y1="48" x2="68" y2="48" />
          <line x1="20" y1="84" x2="20" y2="92" />
          <line x1="80" y1="84" x2="80" y2="92" />
        </g>
      )}
      {kind === "lock" && (
        <g {...common}>
          <rect x="20" y="44" width="60" height="46" rx="5" />
          <path d="M32,44 V30 C32,10 68,10 68,30 V44" />
          <circle cx="50" cy="64" r="5" />
          <line x1="50" y1="69" x2="50" y2="78" />
        </g>
      )}
      {kind === "newspaper" && (
        <g {...common}>
          <rect x="10" y="14" width="80" height="72" rx="2" />
          <line x1="20" y1="28" x2="80" y2="28" strokeWidth={7} />
          <rect x="20" y="40" width="26" height="22" />
          <line x1="54" y1="42" x2="80" y2="42" />
          <line x1="54" y1="52" x2="80" y2="52" />
          <line x1="54" y1="62" x2="80" y2="62" />
          <line x1="20" y1="74" x2="80" y2="74" />
        </g>
      )}
      {kind === "chart" && (
        <g {...common}>
          <polyline points="8,10 8,90 92,90" />
          <polyline points="16,76 36,60 52,66 70,40 88,22" />
          <polyline points="76,22 88,22 88,34" />
        </g>
      )}
      {kind === "globe" && (
        <g {...common}>
          <circle cx="50" cy="50" r="40" />
          <ellipse cx="50" cy="50" rx="18" ry="40" />
          <line x1="10" y1="50" x2="90" y2="50" />
          <path d="M16,30 H84 M16,70 H84" />
        </g>
      )}
      {kind === "office" && (
        <g {...common}>
          <rect x="24" y="8" width="52" height="84" />
          {[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={32 + c * 13} y={16 + r * 13} width={7} height={7} />))}
          <rect x="42" y="78" width="16" height="14" />
        </g>
      )}
      {kind === "antenna" && (
        <g {...common}>
          <path d="M50,30 L30,92 M50,30 L70,92 M37,70 H63 M42,52 H58" />
          <circle cx="50" cy="26" r="4" fill={color} />
          <path d="M34,14 Q26,26 34,38 M66,14 Q74,26 66,38 M24,6 Q12,26 24,46 M76,6 Q88,26 76,46" />
        </g>
      )}
      {kind === "document" && (
        <g {...common}>
          <path d="M20,6 H62 L82,26 V94 H20 Z" />
          <path d="M62,6 V26 H82" />
          <line x1="30" y1="42" x2="72" y2="42" />
          <line x1="30" y1="54" x2="72" y2="54" />
          <line x1="30" y1="66" x2="72" y2="66" />
          <line x1="30" y1="78" x2="56" y2="78" />
        </g>
      )}
      {kind === "briefcase" && (
        <g {...common}>
          <rect x="8" y="30" width="84" height="58" rx="5" />
          <path d="M36,30 V20 H64 V30" />
          <line x1="8" y1="54" x2="92" y2="54" />
          <rect x="44" y="48" width="12" height="12" />
        </g>
      )}
      {kind === "people" && (
        <g {...common}>
          <circle cx="34" cy="34" r="12" />
          <circle cx="66" cy="34" r="12" />
          <path d="M10,84 C10,62 22,54 34,54 C46,54 58,62 58,84" />
          <path d="M50,58 C54,55 60,54 66,54 C78,54 90,62 90,84" />
        </g>
      )}
      {kind === "qr" && (
        <g {...common}>
          <rect x="10" y="10" width="30" height="30" />
          <rect x="60" y="10" width="30" height="30" />
          <rect x="10" y="60" width="30" height="30" />
          <rect x="19" y="19" width="12" height="12" fill={color} />
          <rect x="69" y="19" width="12" height="12" fill={color} />
          <rect x="19" y="69" width="12" height="12" fill={color} />
          <path d="M60,60 H72 V72 M84,60 V90 M60,84 H72 V90 M48,10 V40 M48,50 H90" />
        </g>
      )}
      {kind === "laptop" && (
        <g {...common}>
          <rect x="18" y="20" width="64" height="44" rx="3" />
          <path d="M6,76 H94 L86,64 H14 Z" />
        </g>
      )}
      {kind === "gavel" && (
        <g {...common}>
          <rect x="30" y="12" width="40" height="22" rx="3" transform="rotate(-35 50 23)" />
          <line x1="52" y1="34" x2="80" y2="74" strokeWidth={6} />
          <rect x="12" y="80" width="48" height="10" rx="2" />
        </g>
      )}
      {kind === "piggy" && (
        <g {...common}>
          <ellipse cx="48" cy="54" rx="34" ry="26" />
          <path d="M80,50 H90 V62 H80" />
          <path d="M28,74 V88 M60,76 V88" />
          <line x1="40" y1="30" x2="56" y2="30" strokeWidth={5} />
          <circle cx="68" cy="46" r="2.5" fill={color} />
        </g>
      )}
      {kind === "house" && (
        <g {...common}>
          <polygon points="50,12 90,46 10,46" />
          <rect x="20" y="46" width="60" height="42" />
          <rect x="42" y="62" width="16" height="26" />
        </g>
      )}
    </svg>
  );
};

// ---------- company logos ----------
/**
 * A company logo on a white tile. With `src` (a logo file under the content root, e.g.
 * library/logos/mpesa.svg) it shows the real logo; without it, a placeholder wordmark in the
 * brand colour so layouts can be judged before logo files exist.
 */
export const LogoBadge: React.FC<{ name: string; color: string; size: number; src?: string; start: number; caption?: string; zoom?: number }> = ({ name, color, size, src, start, caption, zoom = 1 }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 16);
  const rise = (1 - p) * 14 * u;
  const o = 4.5 * u; // white sticker edge
  const e = DOC.stickerEdge;
  const sticker = `drop-shadow(${o}px 0 0 ${e}) drop-shadow(-${o}px 0 0 ${e}) drop-shadow(0 ${o}px 0 ${e}) drop-shadow(0 -${o}px 0 ${e})`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u, opacity: p, transform: `translateY(${rise}px)` }}>
      <div style={{ width: size, height: size * 0.62, display: "flex", alignItems: "center", justifyContent: "center", padding: size * 0.06 }}>
        {src ? (
          <img src={staticFile(src)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transform: `scale(${zoom})`, filter: sticker }} />
        ) : (
          <div style={{ fontFamily: DOC.fonts.body, fontWeight: 800, fontSize: size * 0.26, color, letterSpacing: -0.5 * u, textAlign: "center", lineHeight: 1, filter: sticker }}>{name}</div>
        )}
      </div>
      {caption && <Kicker size={20}>{caption}</Kicker>}
    </div>
  );
};

/** Arrow that draws itself between flow steps. */
export const FlowArrow: React.FC<{ start: number; length: number; vertical?: boolean; seed?: number }> = ({ start, length, vertical, seed = 1 }) => {
  // a hand-drawn ink arrow: an almost straight shaft with one soft bow (direction set by seed),
  // and a loose two-stroke head. Calm on purpose: no S-curves or wobble.
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 16);
  const head = prog(frame, start + 12, 8);
  const L = length;
  const bow = Math.min(5 * u, L * 0.03) * (seed % 2 ? 1 : -1);
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const along = 4 + t * (L - 12);
    const off = Math.sin(t * Math.PI) * bow;
    pts.push(vertical ? `${(off + 20 * u).toFixed(1)},${along.toFixed(1)}` : `${along.toFixed(1)},${(off + 20 * u).toFixed(1)}`);
  }
  const end = vertical ? [20 * u, L - 6] : [L - 6, 20 * u];
  const hs = 14 * u;
  const headPath = vertical
    ? `M${end[0] - hs},${end[1] - hs * 1.1} Q${end[0] - 3 * u},${end[1] - 4 * u} ${end[0]},${end[1]} M${end[0] + hs * 0.9},${end[1] - hs * 1.2} Q${end[0] + 2 * u},${end[1] - 5 * u} ${end[0]},${end[1]}`
    : `M${end[0] - hs * 1.1},${end[1] - hs} Q${end[0] - 4 * u},${end[1] - 3 * u} ${end[0]},${end[1]} M${end[0] - hs * 1.2},${end[1] + hs * 0.9} Q${end[0] - 5 * u},${end[1] + 2 * u} ${end[0]},${end[1]}`;
  const w = vertical ? 40 * u : L;
  const h = vertical ? L : 40 * u;
  const stroke = { stroke: DOC.accent, strokeWidth: 3.5 * u, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <path d={"M" + pts.join("L")} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} {...stroke} />
      <path d={headPath} opacity={head} {...stroke} />
    </svg>
  );
};

// ---------- data ----------
/** 10×10 dot grid that fills up to `value` dots (a percentage you can see). */
export const DotGrid: React.FC<{ value: number; start: number; size: number }> = ({ value, start, size }) => {
  const frame = useCurrentFrame();
  const filled = Math.round(value * prog(frame, start, 40));
  const gap = size / 10;
  const r = gap * 0.34;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: 100 }, (_, i) => {
        const row = Math.floor(i / 10);
        const col = i % 10;
        const on = i < filled;
        return <circle key={i} cx={col * gap + gap / 2} cy={row * gap + gap / 2} r={r} fill={on ? DOC.data : "none"} stroke={on ? DOC.data : DOC.inkSoft} strokeWidth={on ? 0 : 1.5} />;
      })}
    </svg>
  );
};

// ---------- maps ----------
export type Geo = { features: { geometry: { type: string; coordinates: number[][][][] | number[][][] } }[] };

/** Loads a GeoJSON file from the content root once (delayRender until it arrives). */
export const useGeo = (file: string) => {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [handle] = useState(() => delayRender(`load ${file}`));
  useEffect(() => {
    fetch(staticFile(file))
      .then((r) => r.json())
      .then((g: Geo) => {
        setGeo(g);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [file, handle]);
  return geo;
};

/** Draws a country outline that inks itself in, then fills. Equirectangular, outer rings only. */
export const OutlineMap: React.FC<{ file: string; size: number; start: number; bbox: [number, number, number, number] }> = ({ file, size, start, bbox }) => {
  const frame = useCurrentFrame();
  const geo = useGeo(file);
  if (!geo) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const gw = (maxLon - minLon) * k;
  const gh = maxLat - minLat;
  const s = size / Math.max(gw, gh);
  const W = gw * s;
  const H = gh * s;
  const px = (lon: number, lat: number) => `${((lon - minLon) * k * s).toFixed(1)},${((maxLat - lat) * s).toFixed(1)}`;
  const polys: number[][][][] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === "Polygon") polys.push(g.coordinates as number[][][]);
    if (g.type === "MultiPolygon") polys.push(...(g.coordinates as number[][][][]));
  }
  const d = polys
    .filter((p) => p[0].length > 20) // skip tiny islands
    .map((p) => "M" + p[0].map(([lon, lat]) => px(lon, lat)).join("L") + "Z")
    .join("");
  const draw = prog(frame, start, 40);
  const fill = prog(frame, start + 34, 20);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <path d={d} fill={DOC.data} fillOpacity={0.18 * fill} stroke={DOC.ink} strokeWidth={2.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} strokeLinejoin="round" />
    </svg>
  );
};

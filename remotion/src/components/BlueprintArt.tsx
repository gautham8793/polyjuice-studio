// Drawn artwork for hook / beat scenes on the blueprint theme, used instead of a photo.
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { LineIcon } from "../templates/explainer/diagram";
import { useTheme } from "../theme";
import type { Hemicycle, Quote, Word } from "../types";
import { EmphasisText } from "./EmphasisText";

// Hook: a big line drawing of the building with handwritten questions popping around it.
export const HookArt: React.FC<{ questions?: string[] }> = ({ questions = [] }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 6, fps, config: { damping: 15 } });
  const spots = [
    { left: 70, top: 1010, rot: -8 },
    { right: 70, top: 1080, rot: 6 },
    { left: 140, top: 1500, rot: 4 },
    { right: 120, top: 1470, rot: -5 },
  ];
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1080, display: "flex", justifyContent: "center", opacity: enter, transform: `translateY(${(1 - enter) * 60}px) scale(${2.2 + 0.2 * enter})`, transformOrigin: "center top" }}>
        <LineIcon kind="parliament" />
      </div>
      {questions.map((q, i) => {
        const pop = spring({ frame: frame - 18 - i * 10, fps, config: { damping: 11, mass: 0.6 } });
        const { rot, ...pos } = spots[i % spots.length];
        return (
          <div
            key={q}
            style={{
              position: "absolute",
              ...pos,
              fontFamily: theme.handFont,
              fontWeight: 700,
              fontSize: 76,
              color: theme.accent,
              opacity: pop,
              transform: `rotate(${rot}deg) scale(${0.5 + 0.5 * pop})`,
              textShadow: "0 3px 12px rgba(0,20,60,0.5)",
            }}
          >
            {q}
          </div>
        );
      })}
    </>
  );
};

// Parliament seating chart: every seat a dot, `highlight` seats light up in the accent color,
// with the majority line marked through the middle.
export const HemicycleView: React.FC<{ hemicycle: Hemicycle; words?: Word[] }> = ({ hemicycle, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { total, highlight, label, cue } = hemicycle;
  const cueWord = cue?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = cueWord ? words?.find((w) => w.text.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(cueWord)) : undefined;
  const startAt = hit ? Math.round(hit.start * fps) : 10;
  const ROWS = 11;
  const R0 = 190;
  const R1 = 450;
  const radii = Array.from({ length: ROWS }, (_, i) => R0 + ((R1 - R0) * i) / (ROWS - 1));
  const sumR = radii.reduce((a, b) => a + b, 0);
  const perRow = radii.map((r) => Math.round((total * r) / sumR));
  perRow[ROWS - 1] += total - perRow.reduce((a, b) => a + b, 0);
  const seats = radii.flatMap((r, row) =>
    Array.from({ length: perRow[row] }, (_, k) => {
      const a = Math.PI - (Math.PI * (k + 0.5)) / perRow[row];
      return { x: Math.cos(a) * r, y: -Math.sin(a) * r, a };
    }),
  );
  seats.sort((p, q) => q.a - p.a); // fill left to right like a seat count
  const lit = Math.round(highlight * interpolate(frame, [startAt, startAt + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const dot = Math.max(5, Math.min(11, 2600 / total));
  const W = 2 * R1 + 60;
  return (
    <div style={{ position: "relative", width: W, height: R1 + 150 }}>
      <svg width={W} height={R1 + 40} viewBox={`${-W / 2} ${-R1 - 20} ${W} ${R1 + 40}`}>
        {seats.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={dot} fill={i < lit ? theme.accent : "#FFFFFF"} fillOpacity={i < lit ? 1 : 0.35} />
        ))}
        <path d={`M 0 ${-R1 - 16} L 0 ${-R0 + 30}`} stroke="#FFFFFF" strokeWidth={4} strokeDasharray="10 8" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: R1 - 120, textAlign: "center", fontFamily: theme.headlineFont, fontSize: 120, lineHeight: 1, color: theme.accent }}>
        {lit}
        <span style={{ fontSize: 56, color: theme.text }}> / {total}</span>
      </div>
      {label && (
        <div style={{ position: "absolute", left: 0, right: 0, top: R1 + 20, textAlign: "center", fontFamily: theme.handFont, fontWeight: 700, fontSize: 60, color: theme.text }}>
          {label}
        </div>
      )}
    </div>
  );
};

const wordFrame = (cue: string | undefined, words: Word[] | undefined, fps: number, fallback: number) => {
  const c = cue?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const w = c ? words?.find((x) => x.text.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(c)) : undefined;
  return w ? Math.round(w.start * fps) - 3 : fallback;
};

// Quote cards stacked down the frame; each slides in on its cue, earlier ones dim a little.
export const QuoteCards: React.FC<{ quotes: Quote[]; words?: Word[] }> = ({ quotes, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = quotes.map((q, i) => wordFrame(q.cue, words, fps, 8 + i * 40));
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 560, display: "flex", flexDirection: "column", gap: 40 }}>
      {quotes.map((q, i) => {
        const enter = spring({ frame: frame - starts[i], fps, config: { damping: 14, mass: 0.7 } });
        const later = starts.slice(i + 1).some((s) => frame >= s);
        return (
          <div
            key={i}
            style={{
              opacity: enter * (later ? 0.55 : 1),
              transform: `translateX(${(1 - enter) * (i % 2 ? 300 : -300)}px) rotate(${(i % 2 ? 1.5 : -1.5) * enter}deg) scale(${later ? 0.94 : 1})`,
            }}
          >
            <QuoteCard quote={q} startAt={starts[i]} />
          </div>
        );
      })}
    </div>
  );
};

const QuoteCard: React.FC<{ quote: Quote; startAt: number }> = ({ quote, startAt }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const dark = quote.kind === "podcast";
  const fg = dark ? "#FFFFFF" : "#0F1419";
  return (
    <div
      style={{
        backgroundColor: dark ? "#111827" : "#FFFFFF",
        borderRadius: 28,
        padding: "30px 34px",
        boxShadow: "0 24px 50px rgba(0,10,40,0.45)",
        border: dark ? `3px solid ${theme.accent}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {quote.photo && (
          <Img src={staticFile(quote.photo)} style={{ width: 92, height: 92, borderRadius: 46, objectFit: "cover", objectPosition: "50% 25%", border: `4px solid ${dark ? theme.accent : "#E5E7EB"}` }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 36, color: fg }}>{quote.who}</div>
          <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 26, color: dark ? theme.accent : "#536471" }}>{quote.where}</div>
        </div>
        {dark ? (
          <svg width={110} height={60} viewBox="0 0 110 60">
            {Array.from({ length: 11 }, (_, i) => {
              const h = 10 + 40 * Math.abs(Math.sin((frame - startAt) / 4 + i * 0.9));
              return <rect key={i} x={i * 10} y={30 - h / 2} width={6} height={h} rx={3} fill={theme.accent} />;
            })}
          </svg>
        ) : (
          <div style={{ fontFamily: theme.headlineFont, fontSize: 56, color: fg, lineHeight: 1 }}>𝕏</div>
        )}
      </div>
      <div style={{ marginTop: 22, fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 44, lineHeight: 1.25, color: fg }}>
        <EmphasisText text={quote.text} emphasisColor={dark ? theme.accent : theme.secondary} />
      </div>
    </div>
  );
};

// A big line-drawn phone with a glowing RAM chip inside and a price tag that grows on its cue.
export const PhonePriceArt: React.FC<{ label: string; cue?: string; words?: Word[] }> = ({ label, cue, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 15 } });
  const at = wordFrame(cue, words, fps, 24);
  const grow = spring({ frame: frame - at, fps, config: { damping: 9, mass: 0.8 } });
  const m = label.match(/^([+-]?)(\d+)(%?)$/);
  const counted = m ? `${m[1]}${Math.round(Number(m[2]) * interpolate(frame, [at, at + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}${m[3]}` : label;
  const glow = 0.6 + 0.4 * Math.sin(frame / 7);
  const s = { fill: "none", stroke: "#FFFFFF", strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    // shifted left so the swinging tag stays inside the frame
    <div style={{ position: "absolute", left: 0, right: 0, top: 620, display: "flex", justifyContent: "center", opacity: enter, transform: `translate(-130px, ${(1 - enter) * 80}px)` }}>
      <div style={{ position: "relative", width: 420, height: 800 }}>
        <svg width={420} height={800} viewBox="0 0 420 800">
          <rect x="20" y="10" width="380" height="780" rx="56" {...s} />
          <rect x="44" y="70" width="332" height="640" rx="14" {...s} strokeOpacity={0.6} />
          <path d="M170 40 H250" {...s} />
          <circle cx="210" cy="750" r="16" {...s} />
          {/* circuit traces to the chip */}
          <path d="M80 300 H150 M80 340 H150 M270 300 H340 M270 340 H340 M190 220 V260 M230 220 V260 M190 380 V420 M230 420 V380" {...s} strokeWidth={4} strokeOpacity={0.5} />
          <rect x="140" y="250" width="140" height="140" rx="12" fill={theme.accent} fillOpacity={glow} stroke="#FFFFFF" strokeWidth={6} />
          <text x="210" y="335" textAnchor="middle" fontFamily={theme.headlineFont} fontSize="56" fill="#0A2A5E">RAM</text>
        </svg>
        {/* price tag on a string from the top-right corner */}
        <div style={{ position: "absolute", left: 330, top: 40, transformOrigin: "0 0", transform: `rotate(${18 + 5 * Math.sin(frame / 10)}deg) scale(${0.6 + 0.7 * grow})` }}>
          <svg width={300} height={150} viewBox="0 0 300 150" style={{ overflow: "visible" }}>
            <path d="M0 0 C 20 20, 30 40, 40 55" stroke="#FFFFFF" strokeWidth={4} fill="none" />
            <path d="M40 55 L 85 20 H285 A15 15 0 0 1 300 35 V130 A15 15 0 0 1 285 145 H85 L40 110 Z" fill={theme.secondary} stroke="#FFFFFF" strokeWidth={5} />
            <circle cx="70" cy="82" r="10" fill="#FFFFFF" />
          </svg>
          <div style={{ position: "absolute", left: 95, top: 22, width: 200, height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.headlineFont, fontSize: 88, color: "#FFFFFF", whiteSpace: "nowrap" }}>
            ₹ {counted}
          </div>
        </div>
      </div>
    </div>
  );
};

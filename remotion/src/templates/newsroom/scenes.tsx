// Newsroom template (AI News series), terminal look: every scene carries a top bar (tag · date ·
// scene count) over a full-screen photo with scanlines; beats add a headline and one data widget.
// Widgets are filled from project.json, so a new story needs no code — only `widget` per scene.
// Scenes cut in with a glitch on the picture (never the text) and drift slowly while they play.
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EmphasisText } from "../../components/EmphasisText";
import { SceneVisual } from "../../components/SceneVisual";
import { type Theme, useTheme } from "../../theme";
import type { ChartSeries, NewsNumber, NewsTone, NewsWidget, Project, Word } from "../../types";
import { OutroScene, type SceneProps } from "../listicle/scenes";
import * as INDIA_MAP from "./maps/india";

const UP = "#2BD576";
const CARD_BORDER = "#1F4A2A";

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

// Captions often write spoken numbers as digits ("nine hundred forty eight" → "948"), so a
// number-word cue also matches a word starting with its digits: "nine" ↔ "948", "eighty" ↔ "80%".
const NUMBER_CUES: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  twenty: "2", thirty: "3", forty: "4", fifty: "5", sixty: "6", seventy: "7", eighty: "8", ninety: "9",
};

// Frame the narration reaches `cue` (scene-relative), or `fallback` when there's no cue / no match.
const cueFrame = (cue: string | undefined, words: Word[] | undefined, fps: number, fallback: number) => {
  const c = cue ? norm(cue) : "";
  const digits = NUMBER_CUES[c];
  const w = c ? words?.find((x) => norm(x.text).startsWith(c) || (digits !== undefined && /\d/.test(x.text) && norm(x.text).startsWith(digits))) : undefined;
  return w ? Math.round(w.start * fps) : fallback;
};

const toneColor = (tone: NewsTone | undefined, theme: Theme) =>
  tone === "danger" ? theme.secondary : tone === "up" ? (theme.up ?? UP) : tone === "neutral" ? theme.text : theme.accent;

const useSpringAt = (at: number, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, mass: 0.7 } });
};

// 0 → 1 over `frames` from `at`, eased — for counting numbers and drawing bars.
const useRamp = (at: number, frames = 26) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

const fmt = (n: number, decimals = 0) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ── chrome ────────────────────────────────────────────────────────────────────────────────────

// hideCount: end cards drop the "n/total" counter (the outro isn't one of the counted scenes)
export const NewsBar: React.FC<{ project?: Project; index: number; hideCount?: boolean }> = ({ project, index, hideCount }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const news = project?.news;
  const total = project?.scenes.filter((s) => s.kind !== "outro").length ?? 0;
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin(frame / 9));
  const tagBg = theme.tag ?? theme.secondary;
  const tagInk = theme.textOnTag ?? theme.textOnSecondary;
  const label = { fontFamily: theme.headlineFont, fontWeight: 800, fontSize: 30, letterSpacing: 2 } as const;
  // series episodes: "THE ANTHROPIC IPO · DAY 1" on the bar, "OVERVIEW · NOV 10, 2026" under it
  const series = news?.day != null;
  return (
    <div style={{ position: "absolute", top: 70, left: 56, right: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ ...label, display: "flex", alignItems: "center", gap: 12, backgroundColor: tagBg, color: tagInk, padding: "8px 18px", borderRadius: 10 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: series ? theme.accent : "#FFFFFF", opacity: pulse }} />
          {news?.tag ?? "AI NEWS"}
        </div>
        {series && <div style={{ ...label, backgroundColor: theme.accent, color: theme.textOnAccent, padding: "8px 16px", borderRadius: 10 }}>DAY {news!.day}</div>}
        {!series && news?.date && <div style={{ ...label, color: theme.text, opacity: 0.75 }}>{news.date}</div>}
        <div style={{ flex: 1 }} />
        {total > 0 && !hideCount && (
          <div style={{ ...label, fontSize: 28, color: theme.text, opacity: 0.6 }}>
            {index + 1}/{total}
          </div>
        )}
      </div>
      {series && (
        <div style={{ marginTop: 12, fontFamily: theme.monoFont, fontWeight: 600, fontSize: 24, letterSpacing: 2, color: theme.text, opacity: 0.7 }}>
          {[news!.episode, news!.date].filter(Boolean).join(" · ").toUpperCase()}
        </div>
      )}
    </div>
  );
};

const Headline: React.FC<{ text: string; size: number }> = ({ text, size }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // *emphasis* may span several words ("*MASTER KEY*"): carry it across the word split
  let open = false;
  const words = text.split(" ").map((raw) => {
    const starts = raw.startsWith("*");
    const ends = raw.endsWith("*") && raw.length > (starts ? 1 : 0);
    const bare = raw.replace(/^\*|\*$/g, "");
    const on = open || starts;
    open = (open || starts) && !ends;
    return on && !bare.includes("*") ? `*${bare}*` : raw;
  });
  return (
    <div style={{ fontFamily: theme.headlineFont, fontWeight: 800, fontSize: size, lineHeight: 1.05, letterSpacing: -2, textTransform: "uppercase", color: theme.text, textWrap: "balance", textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>
      {words.map((w, i) => {
        const enter = spring({ frame: frame - 2 - i * 3, fps, config: { damping: 13, mass: 0.6 } });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.4, transform: `translateY(${(1 - enter) * 40}px)`, opacity: enter }}>
            <EmphasisText text={w} />
            {/* the cursor always takes its space and only blinks, so the headline never re-wraps */}
            {i === words.length - 1 ? <span style={{ color: theme.accent, opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0 }}>_</span> : null}
          </span>
        );
      })}
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode; padding?: number }> = ({ children, padding = 36 }) => {
  const theme = useTheme();
  const enter = useSpringAt(4, 15);
  return (
    <div
      style={{
        backgroundColor: theme.card ?? `${theme.surface}D9`,
        backdropFilter: "blur(10px)",
        border: `2px solid ${(theme.cardBorder ?? CARD_BORDER)}`,
        borderRadius: 24,
        padding,
        opacity: enter,
        transform: `scale(${0.94 + 0.06 * enter})`,
      }}
    >
      {children}
    </div>
  );
};

// ── widgets ───────────────────────────────────────────────────────────────────────────────────

type WidgetProps<T extends NewsWidget["type"]> = { widget: Extract<NewsWidget, { type: T }>; words?: Word[] };

// Narrowing stages (2,308 → 1,724 → 948): bars scaled to the first row, each counting up on its cue.
const FunnelRow: React.FC<{ row: Extract<NewsWidget, { type: "funnel" }>["rows"][number]; max: number; at: number; last: boolean }> = ({ row, max, at, last }) => {
  const theme = useTheme();
  const t = useRamp(at, 30);
  const color = toneColor(row.tone ?? (last ? "danger" : "accent"), theme);
  return (
    <div style={{ opacity: t > 0 ? 1 : 0.25 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: theme.bodyFont, fontWeight: 800, color: theme.text }}>
        <span style={{ fontSize: 36, opacity: 0.85 }}>{row.label}</span>
        <span style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize: 84, color }}>{fmt(Math.round(row.value * t))}</span>
      </div>
      <div style={{ height: 22, borderRadius: 11, backgroundColor: "#FFFFFF14", marginTop: 6 }}>
        <div style={{ height: "100%", width: `${(row.value / max) * 100 * t}%`, borderRadius: 11, backgroundColor: color }} />
      </div>
    </div>
  );
};

const Funnel: React.FC<WidgetProps<"funnel">> = ({ widget, words }) => {
  const { fps } = useVideoConfig();
  const max = Math.max(...widget.rows.map((r) => r.value));
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {widget.rows.map((row, i) => (
          <FunnelRow key={i} row={row} max={max} at={cueFrame(row.cue, words, fps, 10 + i * 18)} last={i === widget.rows.length - 1} />
        ))}
      </div>
    </Card>
  );
};

// size: font size of the number (default 220 alone, 150 stacked); small sizes shrink the label too.
const CounterItem: React.FC<{ item: NewsNumber; at: number; big: boolean; size?: number }> = ({ item, at, big, size }) => {
  const theme = useTheme();
  const t = useRamp(at, 30);
  const pop = useSpringAt(at, 11);
  const fontSize = size ?? (big ? 220 : 150);
  return (
    <div style={{ opacity: Math.min(1, pop * 1.4), transform: `scale(${0.8 + 0.2 * pop})`, transformOrigin: "left center" }}>
      <div style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize, lineHeight: 0.95, color: toneColor(item.tone, theme), whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {item.text ?? `${item.prefix ?? ""}${fmt(item.value * t, item.decimals ?? 0)}${item.suffix ?? ""}`}
      </div>
      <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: fontSize < 120 ? 30 : 38, lineHeight: 1.15, color: theme.text, opacity: 0.85, marginTop: 8 }}>{item.label}</div>
    </div>
  );
};

const Counter: React.FC<WidgetProps<"counter">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {widget.items.map((item, i) => (
          <div key={i} style={i ? { borderTop: `2px solid ${(theme.cardBorder ?? CARD_BORDER)}`, paddingTop: 26 } : undefined}>
            <CounterItem item={item} at={cueFrame(item.cue, words, fps, 8 + i * 24)} big={widget.items.length === 1} />
          </div>
        ))}
      </div>
    </Card>
  );
};

// Company logos on white tiles (so dark wordmarks stay readable), popping in as each name is said.
const LogoTile: React.FC<{ item: Extract<NewsWidget, { type: "logos" }>["items"][number]; at: number }> = ({ item, at }) => {
  const theme = useTheme();
  const pop = useSpringAt(at, 12);
  return (
    <div style={{ height: 118, borderRadius: 18, backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 20px", opacity: Math.min(1, pop * 1.4), transform: `scale(${0.7 + 0.3 * pop})` }}>
      {item.src ? (
        <Img src={staticFile(item.src)} alt={item.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ fontFamily: theme.headlineFont, fontWeight: 800, fontSize: 34, letterSpacing: 1, color: "#14130F", textAlign: "center", lineHeight: 1.05 }}>{item.name}</span>
      )}
    </div>
  );
};

const Logos: React.FC<WidgetProps<"logos">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const cols = widget.items.length > 4 ? 4 : widget.items.length;
  return (
    <Card padding={30}>
      {widget.title && <div style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 28, color: theme.text, opacity: 0.6, marginBottom: 18 }}>{widget.title}</div>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
        {widget.items.map((item, i) => (
          <LogoTile key={i} item={item} at={cueFrame(item.cue, words, fps, 6 + i * 8)} />
        ))}
      </div>
      {widget.totals?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${widget.totals.length}, 1fr)`, gap: 22, borderTop: `2px solid ${(theme.cardBorder ?? CARD_BORDER)}`, marginTop: 26, paddingTop: 22 }}>
          {widget.totals.map((it, i) => (
            <CounterItem key={i} item={it} at={cueFrame(it.cue, words, fps, 6 + (widget.items.length + i) * 10)} big={false} size={widget.totals!.length > 2 ? 72 : 96} />
          ))}
        </div>
      ) : null}
      {/* the big single number comes last, so it can sum up the row above */}
      {widget.total && (
        <div style={{ borderTop: `2px solid ${(theme.cardBorder ?? CARD_BORDER)}`, marginTop: 26, paddingTop: 22 }}>
          <CounterItem item={widget.total} at={cueFrame(widget.total.cue, words, fps, 6 + widget.items.length * 8)} big={false} />
        </div>
      )}
    </Card>
  );
};

// One company's price since its IPO: a line that draws itself over a dashed IPO-price line.
const StockRow: React.FC<{ item: Extract<NewsWidget, { type: "stocks" }>["items"][number]; at: number; last: boolean }> = ({ item, at, last }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const W = 860;
  const H = 230;
  const pad = { t: 16, b: 34 };
  const t = interpolate(frame, [at, at + 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const vals = item.values;
  const lo = Math.min(item.ipo, ...vals);
  const hi = Math.max(item.ipo, ...vals);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const x = (i: number) => (i / Math.max(1, vals.length - 1)) * W;
  const head = Math.max(1, Math.round((vals.length - 1) * t));
  const pts = vals.slice(0, head + 1).map((v, i) => [x(i), y(v)] as [number, number]);
  const lastV = vals[head];
  const change = ((lastV - item.ipo) / item.ipo) * 100;
  const color = change < 0 ? theme.secondary : (theme.up ?? UP);
  const line = linePath(pts);
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - pad.b} L0,${H - pad.b} Z`;
  const pf = item.prefix ?? "$";
  const year = (d: string) => d.slice(0, 4);
  return (
    <div style={{ paddingBottom: last ? 0 : 22, marginBottom: last ? 0 : 22, borderBottom: last ? undefined : `2px solid ${theme.cardBorder ?? CARD_BORDER}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
        <span style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 40, color: theme.text }}>{item.label}</span>
        {item.ticker && <span style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 26, color: theme.text, opacity: 0.55 }}>{item.ticker}</span>}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: theme.numberFont, fontWeight: 800, fontSize: 60, color, fontVariantNumeric: "tabular-nums", opacity: t > 0 ? 1 : 0 }}>
          {change < 0 ? "−" : "+"}
          {Math.abs(Math.round(change))}%
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <path d={area} fill={color} fillOpacity={0.12} />
        <line x1={0} x2={W} y1={y(item.ipo)} y2={y(item.ipo)} stroke={theme.text} strokeOpacity={0.55} strokeWidth={3} strokeDasharray="10 10" />
        <path d={line} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        {/* key for the dashed line, in the axis row so it never collides with the price line */}
        <line x1={W / 2 - 150} x2={W / 2 - 110} y1={H - 12} y2={H - 12} stroke={theme.text} strokeOpacity={0.7} strokeWidth={3} strokeDasharray="8 6" />
        <text x={W / 2 - 100} y={H - 4} fill={theme.text} fillOpacity={0.8} fontFamily={theme.monoFont} fontWeight={600} fontSize={22}>
          {item.ipoLabel ?? `IPO ${pf}${item.ipo}`}
        </text>
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={9} fill={color} />
        <text x={0} y={H - 4} fill={theme.text} fillOpacity={0.55} fontFamily={theme.monoFont} fontWeight={600} fontSize={22}>{year(item.dates[0])}</text>
        <text x={W} y={H - 4} textAnchor="end" fill={theme.text} fillOpacity={0.55} fontFamily={theme.monoFont} fontWeight={600} fontSize={22}>
          {year(item.dates[head])} · {pf}{fmt(lastV, 2)}
        </text>
      </svg>
    </div>
  );
};

const Stocks: React.FC<WidgetProps<"stocks">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  return (
    <Card padding={30}>
      {widget.items.map((it, i) => (
        <StockRow key={i} item={it} at={cueFrame(it.cue, words, fps, 8 + i * 40)} last={i === widget.items.length - 1} />
      ))}
      {widget.note && <div style={{ fontFamily: theme.monoFont, fontSize: 22, color: theme.text, opacity: 0.55, marginTop: 12 }}>{widget.note}</div>}
    </Card>
  );
};

const FILL_MAPS = { india: INDIA_MAP };

// Height (0–1, from the bottom) at which the filled part covers `share` of the map's area.
const fillHeight = (below: number[], share: number) => {
  for (let k = 1; k < below.length; k++) {
    if (below[k] >= share) {
      const a = below[k - 1];
      return (k - 1 + (share - a) / (below[k] - a || 1)) / (below.length - 1);
    }
  }
  return 1;
};

// The country fills up from the bottom like a glass, stopping where the fill covers `share` of its area.
const MapFill: React.FC<WidgetProps<"mapfill">> = ({ widget, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = FILL_MAPS[widget.map];
  const wholeAt = cueFrame(widget.whole.cue, words, fps, 6);
  const partAt = cueFrame(widget.part.cue, words, fps, wholeAt + 30);
  const enter = useSpringAt(wholeAt, 14);
  const rise = interpolate(frame, [partAt, partAt + 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const partIn = useSpringAt(partAt + 20, 12);
  const color = toneColor(widget.part.tone, theme);
  const level = m.height * (1 - fillHeight(m.below, widget.share) * rise); // svg y of the fill's top edge
  const clipId = `mapfill-${widget.map}`;
  return (
    <Card padding={30}>
      {widget.title && <div style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 26, color: theme.text, opacity: 0.6, marginBottom: 12 }}>{widget.title}</div>}
      {/* the whole, on one line above the map */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, opacity: Math.min(1, enter * 1.4), marginBottom: 34 }}>
        <span style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 34, color: theme.text, whiteSpace: "nowrap" }}>{widget.whole.label}</span>
        <span style={{ fontFamily: theme.numberFont, fontWeight: 800, fontSize: 50, color: theme.text, whiteSpace: "nowrap" }}>{widget.whole.value}</span>
      </div>
      {/* map centred in the card, as big as the card allows; the part's label is centred under it */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox={m.viewBox} style={{ width: 660, flexShrink: 0, overflow: "visible", opacity: Math.min(1, enter * 1.4), transform: `scale(${0.92 + 0.08 * Math.min(1, enter)})` }}>
          <defs>
            <clipPath id={clipId}>
              <path d={m.path} fillRule="evenodd" />
            </clipPath>
          </defs>
          <path d={m.path} fillRule="evenodd" fill={theme.text} fillOpacity={0.1} />
          <g clipPath={`url(#${clipId})`}>
            <rect x={0} y={level} width={m.width} height={m.height - level + 2} fill={color} />
          </g>
          <path d={m.path} fillRule="evenodd" fill="none" stroke={theme.text} strokeOpacity={0.75} strokeWidth={3} strokeLinejoin="round" />
          {rise > 0 && <line x1={-60} x2={m.width + 60} y1={level} y2={level} stroke={color} strokeWidth={4} strokeDasharray="12 10" />}
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 18, marginTop: 18, opacity: Math.min(1, partIn * 1.4) }}>
        <span style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 34, color }}>{widget.part.label}</span>
        <span style={{ fontFamily: theme.numberFont, fontWeight: 800, fontSize: 64, lineHeight: 1, color }}>{widget.part.value}</span>
        {widget.part.note && <span style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 26, color: theme.text, opacity: 0.85 }}>{widget.part.note}</span>}
      </div>
    </Card>
  );
};

// Nested circles, area-true: the inner circle's radius is R·√share, sitting on the outer circle's floor.
const Circles: React.FC<WidgetProps<"circles">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const outerAt = cueFrame(widget.outer.cue, words, fps, 6);
  const innerAt = cueFrame(widget.inner.cue, words, fps, outerAt + 24);
  const outer = useSpringAt(outerAt, 13);
  const inner = useSpringAt(innerAt, 11);
  const color = toneColor(widget.inner.tone, theme);
  const S = 600; // svg size
  const R = 290;
  const r = R * Math.sqrt(Math.max(0, Math.min(1, widget.inner.share)));
  const cx = S / 2;
  const cy = S / 2;
  const icy = cy + R - r; // inner circle rests on the bottom of the outer one
  return (
    <Card padding={30}>
      {widget.title && <div style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 28, color: theme.text, opacity: 0.6, marginBottom: 10 }}>{widget.title}</div>}
      <svg width="100%" viewBox={`0 0 ${S} ${S}`} style={{ display: "block", maxHeight: 620, margin: "0 auto" }}>
        <g transform={`translate(${cx} ${cy}) scale(${Math.max(0.001, outer)}) translate(${-cx} ${-cy})`} opacity={Math.min(1, outer * 1.4)}>
          <circle cx={cx} cy={cy} r={R} fill={theme.text} fillOpacity={0.08} stroke={theme.text} strokeOpacity={0.6} strokeWidth={4} />
          <text x={cx} y={cy - R + 100} textAnchor="middle" fill={theme.text} fontFamily={theme.bodyFont} fontWeight={800} fontSize={32}>{widget.outer.label}</text>
          <text x={cx} y={cy - R + 160} textAnchor="middle" fill={theme.text} fontFamily={theme.numberFont} fontWeight={800} fontSize={50}>{widget.outer.value}</text>
        </g>
        <g transform={`translate(${cx} ${icy}) scale(${Math.max(0.001, inner)}) translate(${-cx} ${-icy})`} opacity={Math.min(1, inner * 1.4)}>
          <circle cx={cx} cy={icy} r={r} fill={color} />
          <text x={cx} y={icy - 34} textAnchor="middle" fill={theme.textOnAccent} fontFamily={theme.bodyFont} fontWeight={800} fontSize={32}>{widget.inner.label}</text>
          <text x={cx} y={icy + 34} textAnchor="middle" fill={theme.textOnAccent} fontFamily={theme.numberFont} fontWeight={800} fontSize={66}>{widget.inner.value}</text>
          {widget.inner.note && <text x={cx} y={icy + 84} textAnchor="middle" fill={theme.textOnAccent} fontFamily={theme.monoFont} fontWeight={600} fontSize={26}>{widget.inner.note}</text>}
        </g>
      </svg>
    </Card>
  );
};

// A donut chart: the whole ring dim, the share sweeping in bright on its cue, the number in the middle.
const Pie: React.FC<WidgetProps<"pie">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const at = cueFrame(widget.cue, words, fps, 10);
  const sweep = useRamp(at, 40);
  const pop = useSpringAt(at + 12, 10);
  const color = toneColor(widget.tone, theme);
  const R = 150;
  const C = 2 * Math.PI * R;
  // small shares are hard to see, so the slice is drawn at least 2% wide
  const share = Math.max(2, widget.value) / 100;
  return (
    <Card padding={34}>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <svg width={380} height={380} viewBox="0 0 380 380" style={{ flexShrink: 0 }}>
          <circle cx={190} cy={190} r={R} fill="none" stroke={`${theme.text}1F`} strokeWidth={56} />
          <circle
            cx={190}
            cy={190}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={64}
            strokeDasharray={`${C * share * sweep} ${C}`}
            transform="rotate(-90 190 190)"
          />
          <text x={190} y={190} textAnchor="middle" dominantBaseline="central" fill={theme.text} fontFamily={theme.numberFont} fontWeight={800} fontSize={86} opacity={Math.min(1, pop * 1.4)}>
            {widget.center ?? `${widget.value}%`}
          </text>
        </svg>
        <div style={{ opacity: Math.min(1, pop * 1.4) }}>
          <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 40, lineHeight: 1.15, color: theme.text }}>{widget.label}</div>
          {widget.note && <div style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 26, color: theme.text, opacity: 0.65, marginTop: 14 }}>{widget.note}</div>}
        </div>
      </div>
    </Card>
  );
};

// A paper price tag on a string that swings in: the old price gets struck through on its cue,
// then the new price counts up from the old one and settles with a little bounce.
const PriceTag: React.FC<WidgetProps<"pricetag">> = ({ widget, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inAt = 4;
  const enter = useSpringAt(inAt, 9);
  const wasAt = cueFrame(widget.was.cue, words, fps, 14);
  const strike = interpolate(frame, [wasAt + 6, wasAt + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const now = widget.now;
  const nowAt = cueFrame(now.cue, words, fps, wasAt + 24);
  const t = useRamp(nowAt, 34);
  const pop = useSpringAt(nowAt, 8);
  const from = now.from ?? 0;
  const value = from + (now.value - from) * t;
  // size the new price from its final text so it always fits inside the tag (≈$1.02T is 7 glyphs),
  // and never let the pop overshoot past full size
  const TAG_W = 760;
  const PAD_X = 56;
  const finalText = now.text ?? `${now.prefix ?? ""}${fmt(now.value, now.decimals ?? 0)}${now.suffix ?? ""}`;
  const nowSize = Math.min(190, Math.floor((TAG_W - 2 * PAD_X) / (finalText.length * 0.7)));
  const nowScale = Math.min(1, 0.75 + 0.25 * pop);
  // the tag hangs from its hole and sways, damping out over ~2 s
  const sway = (1 - enter) * -24 + Math.sin(frame / 7) * 5 * Math.exp(-Math.max(0, frame - inAt) / 60) + Math.sin(frame / 30) * 0.8;
  const PAPER = "#F3EBD7";
  const INK = "#14130F";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: Math.min(1, enter * 1.5) }}>
      {/* string */}
      <div style={{ width: 4, height: 70, backgroundColor: theme.text, opacity: 0.55 }} />
      <div style={{ transform: `rotate(${sway}deg)`, transformOrigin: "50% 0%", marginTop: -14 }}>
        <div
          style={{
            position: "relative",
            boxSizing: "border-box",
            width: TAG_W,
            padding: `120px ${PAD_X}px 46px`,
            backgroundColor: PAPER,
            clipPath: "polygon(50% 0%, 100% 14%, 100% 100%, 0% 100%, 0% 14%)",
            boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}
        >
          {/* hole */}
          <div style={{ position: "absolute", left: "50%", top: 52, width: 40, height: 40, marginLeft: -20, borderRadius: 20, backgroundColor: theme.background, boxShadow: `inset 0 0 0 5px ${theme.accent}` }} />
          <div style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 30, color: INK, opacity: 0.6 }}>{widget.was.label ?? "WAS"}</div>
          <div style={{ position: "relative", display: "inline-block", fontFamily: theme.numberFont, fontWeight: 900, fontSize: 104, lineHeight: 1, color: INK, opacity: 1 - 0.45 * strike }}>
            {widget.was.text}
            <div style={{ position: "absolute", left: -10, top: "52%", height: 12, width: `calc(${strike * 100}% + 20px)`, backgroundColor: theme.secondary, transform: "rotate(-6deg)", borderRadius: 6 }} />
          </div>
          <div style={{ height: 3, backgroundColor: INK, opacity: 0.15, margin: "30px 0 24px" }} />
          <div style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 30, color: INK, opacity: 0.6 * Math.min(1, pop * 1.5) }}>{now.label}</div>
          <div
            style={{
              fontFamily: theme.headlineFont,
              fontWeight: 900,
              fontSize: nowSize,
              lineHeight: 1,
              color: "#0F7A3D",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
              opacity: Math.min(1, pop * 1.5),
              transform: `scale(${nowScale})`,
            }}
          >
            {now.text ?? `${now.prefix ?? ""}${fmt(value, now.decimals ?? 0)}${now.suffix ?? ""}`}
          </div>
        </div>
      </div>
      {widget.note && <div style={{ fontFamily: theme.monoFont, fontSize: 24, color: theme.text, opacity: 0.6, marginTop: 22 }}>{widget.note}</div>}
    </div>
  );
};

// A market line that draws itself (falling or rising), with % change chips popping in on cue.
const Ticker: React.FC<WidgetProps<"ticker">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const at = cueFrame(widget.cue, words, fps, 6);
  const t = useRamp(at, 45);
  const down = widget.trend === "down";
  const color = widget.tone ? toneColor(widget.tone, theme) : down ? theme.secondary : (theme.up ?? UP);
  const W = 900;
  const H = 300;
  const N = 40;
  // gentle noise, then the move: flat-ish for the first 55%, then the drop (or climb)
  const pts = Array.from({ length: N }, (_, i) => {
    const x = (i / (N - 1)) * W;
    const k = i / (N - 1);
    const move = k < 0.55 ? 0 : Math.pow((k - 0.55) / 0.45, 1.4);
    const base = down ? 70 + move * 190 : 230 - move * 190;
    return [x, base + (random(`tick-${i}`) - 0.5) * 34] as const;
  });
  const shown = Math.max(2, Math.round(t * N));
  const line = pts.slice(0, shown).map(([x, y]) => `${x},${y}`).join(" ");
  const [hx, hy] = pts[shown - 1];
  return (
    <Card padding={30}>
      {widget.label && <div style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 30, color: theme.text, opacity: 0.7, marginBottom: 10 }}>{widget.label}</div>}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={2} />
        ))}
        <polygon points={`0,${H} ${line} ${hx},${H}`} fill={color} fillOpacity={0.14} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={hx} cy={hy} r={13} fill={color} />
      </svg>
      {widget.items?.length ? (
        <div style={{ display: "flex", gap: 18, marginTop: 20, flexWrap: "wrap" }}>
          {widget.items.map((it, i) => (
            <TickerChip key={i} label={it.label} change={it.change} at={cueFrame(it.cue, words, fps, at + 20 + i * 14)} />
          ))}
        </div>
      ) : null}
    </Card>
  );
};

const TickerChip: React.FC<{ label: string; change: number; at: number }> = ({ label, change, at }) => {
  const theme = useTheme();
  const pop = useSpringAt(at, 11);
  const color = change < 0 ? theme.secondary : (theme.up ?? UP);
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "baseline",
        padding: "10px 22px",
        borderRadius: 14,
        backgroundColor: `${color}22`,
        border: `2px solid ${color}`,
        opacity: Math.min(1, pop * 1.4),
        transform: `scale(${0.7 + 0.3 * pop})`,
      }}
    >
      <span style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 34, color: theme.text }}>{label}</span>
      <span style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize: 60, color }}>
        {change < 0 ? "−" : "+"}
        {fmt(Math.abs(change), 1)}%
      </span>
    </div>
  );
};

// Side-by-side numbers as horizontal bars (33 of 41, 10% vs 16%).
const CompareRow: React.FC<{ item: Extract<NewsWidget, { type: "compare" }>["items"][number]; max: number; prefix: string; unit: string; decimals: number; at: number }> = ({ item, max, prefix, unit, decimals, at }) => {
  const theme = useTheme();
  const t = useRamp(at, 30);
  const color = toneColor(item.tone, theme);
  return (
    <div style={{ opacity: t > 0 ? 1 : 0.25 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: theme.bodyFont, fontWeight: 800, color: theme.text }}>
        <span style={{ fontSize: 40 }}>{item.label}</span>
        <span style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize: 96, color }}>
          {prefix}
          {fmt(decimals ? item.value * t : Math.round(item.value * t), decimals)}
          {unit}
          {item.max ? <span style={{ fontSize: 48, color: theme.text, opacity: 0.6 }}> / {fmt(item.max)}</span> : null}
        </span>
      </div>
      <div style={{ height: 30, borderRadius: 15, backgroundColor: "#FFFFFF14", marginTop: 6 }}>
        <div style={{ height: "100%", width: `${((item.value * t) / (item.max ?? max)) * 100}%`, borderRadius: 15, backgroundColor: color }} />
      </div>
    </div>
  );
};

const Compare: React.FC<WidgetProps<"compare">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const max = Math.max(...widget.items.map((i) => i.max ?? i.value));
  return (
    <Card>
      {/* title: what the numbers are in, e.g. "₹ lakh crore" */}
      {widget.title && <div style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 28, color: theme.text, opacity: 0.6, marginBottom: 18 }}>{widget.title}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {widget.items.map((item, i) => (
          <CompareRow key={i} item={item} max={max} prefix={widget.prefix ?? ""} unit={widget.unit ?? ""} decimals={widget.decimals ?? 0} at={cueFrame(item.cue, words, fps, 8 + i * 20)} />
        ))}
      </div>
    </Card>
  );
};

// A terminal window; each line types itself out when the narration reaches its cue.
const Terminal: React.FC<WidgetProps<"terminal">> = ({ widget, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const CPS = 1.6; // characters per frame
  let fallback = 8;
  const lines = widget.lines.map((l) => {
    const at = cueFrame(l.cue, words, fps, fallback);
    fallback = at + Math.ceil(l.text.length / CPS) + 6;
    return { ...l, at };
  });
  const typing = [...lines].reverse().find((l) => frame >= l.at);
  return (
    <Card padding={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 26px", borderBottom: `2px solid ${(theme.cardBorder ?? CARD_BORDER)}` }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c }} />
        ))}
        <span style={{ marginLeft: 14, fontFamily: theme.monoFont, fontSize: 26, color: theme.text, opacity: 0.55 }}>{widget.title ?? "terminal"}</span>
      </div>
      <div style={{ padding: "24px 30px 30px", fontFamily: theme.monoFont, fontWeight: 700, fontSize: 40, lineHeight: 1.5 }}>
        {lines.map((l, i) => {
          const n = Math.max(0, Math.min(l.text.length, Math.floor((frame - l.at) * CPS)));
          if (frame < l.at) return <div key={i} style={{ height: 60 }} />;
          return (
            <div key={i} style={{ color: l.tone ? toneColor(l.tone, theme) : theme.text, whiteSpace: "pre-wrap" }}>
              {l.text.slice(0, n)}
              {typing === l && Math.floor(frame / 8) % 2 === 0 ? <span style={{ color: theme.accent }}>▌</span> : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// Columns of boxes ticked off on cue — "finished 10% of the checklist" vs "16%".
const ChecklistColumn: React.FC<{ col: Extract<NewsWidget, { type: "checklist" }>["columns"][number]; at: number }> = ({ col, at }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const color = toneColor(col.tone, theme);
  const ticked = Math.max(0, Math.min(col.done, Math.floor((frame - at) / 3)));
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 34, letterSpacing: 2, textTransform: "uppercase", color: theme.text, opacity: 0.85 }}>{col.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 16 }}>
        {Array.from({ length: col.total }, (_, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              borderRadius: 8,
              border: `3px solid ${i < ticked ? color : "#FFFFFF33"}`,
              backgroundColor: i < ticked ? `${color}33` : "transparent",
              color,
              fontSize: 34,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i < ticked ? "✓" : ""}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize: 110, color, marginTop: 10 }}>{Math.round((ticked / col.total) * 100)}%</div>
    </div>
  );
};

const Checklist: React.FC<WidgetProps<"checklist">> = ({ widget, words }) => {
  const { fps } = useVideoConfig();
  return (
    <Card>
      <div style={{ display: "flex", gap: 40 }}>
        {widget.columns.map((col, i) => (
          <ChecklistColumn key={i} col={col} at={cueFrame(col.cue, words, fps, 10 + i * 20)} />
        ))}
      </div>
    </Card>
  );
};

// ── charts (real data) ────────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
// minus goes before the prefix: −$567M, not $-567M
const fmtValue = (v: number, s: ChartSeries) => `${v < 0 ? "−" : ""}${s.prefix ?? ""}${fmt(Math.abs(v), s.decimals ?? 0)}${s.suffix ?? ""}`;

// Indices kept after `from` and `step` (the last point is always kept, so the line ends on the newest close).
const keptIndices = (dates: string[], from?: string, step = 1) => {
  const out: number[] = [];
  dates.forEach((d, i) => {
    if (from && d < from) return;
    if (out.length === 0 || (i - out[0]) % Math.max(1, step) === 0 || i === dates.length - 1) out.push(i);
  });
  return out;
};

// SVG path through the points, broken where a value is missing (holidays, no close that day).
const linePath = (pts: ([number, number] | null)[]) => {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)} `;
    pen = true;
  }
  return d.trim();
};

const lastPoint = (pts: ([number, number] | null)[], upTo: number) => {
  for (let i = Math.min(upTo, pts.length - 1); i >= 0; i--) if (pts[i]) return { p: pts[i]!, i };
  return null;
};

// Two real series on one plot (each on its own scale), drawn along the narration.
const LineChart: React.FC<WidgetProps<"linechart">> = ({ widget, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 900;
  const H = 560;
  const pad = { l: 10, r: 10, t: 30, b: 50 };
  const idx = keptIndices(widget.dates, widget.from, widget.step);
  const n = idx.length;
  const x = (k: number) => pad.l + (k / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const at = cueFrame(widget.cue, words, fps, 8);
  const t = interpolate(frame, [at, at + (widget.draw ?? 60)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const pos = (date: string | undefined, fallback: number) => {
    if (!date) return fallback;
    const k = idx.findIndex((i) => widget.dates[i] > date);
    return k === -1 ? n - 1 : Math.max(0, k - 1);
  };
  // revealFrom: everything up to that date is already there; the rest draws in
  const start = widget.revealFrom ? pos(widget.revealFrom, 0) : 0;
  const end = pos(widget.revealTo, n - 1);
  const head = Math.round(start + (end - start) * t);
  const colors = widget.series.map((s, i) => (s.tone ? toneColor(s.tone, theme) : i === 0 ? (theme.up ?? UP) : theme.secondary));
  const lines = widget.series.map((s) => {
    const vals = idx.map((i) => s.values[i]).filter((v): v is number => v != null);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1;
    // each series keeps its own band so the two lines don't sit on top of each other's labels
    return idx.map((i, k) => {
      const v = s.values[i];
      return v == null ? null : ([x(k), pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b)] as [number, number]);
    });
  });
  const ticks = [0, Math.round((n - 1) / 2), n - 1];
  return (
    <Card padding={30}>
      {/* one fixed column per series, label above value, so the legend never re-wraps while the numbers change */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${widget.series.length}, 1fr)`, gap: 18, marginBottom: 14 }}>
        {widget.series.map((s, si) => {
          const lp = lastPoint(lines[si], head);
          const v = lp ? s.values[idx[lp.i]] : null;
          return (
            <div key={si} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4, padding: "10px 18px", borderRadius: 14, backgroundColor: `${colors[si]}22`, border: `2px solid ${colors[si]}` }}>
              <span style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 28, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              <span style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize: 56, lineHeight: 1, color: colors[si], whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{v != null ? fmtValue(v, s) : "–"}</span>
            </div>
          );
        })}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={pad.t + (H - pad.t - pad.b) * g} y2={pad.t + (H - pad.t - pad.b) * g} stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={2} />
        ))}
        {lines.map((pts, si) => {
          const lp = lastPoint(pts, head);
          return (
            <g key={si}>
              <path d={linePath(pts.slice(0, head + 1))} fill="none" stroke={colors[si]} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
              {lp && <circle cx={lp.p[0]} cy={lp.p[1]} r={11} fill={colors[si]} />}
            </g>
          );
        })}
        {(widget.markers ?? []).map((m, mi) => {
          const k = pos(m.date, -1);
          if (k < 0 || k > head) return null;
          const c = toneColor(m.tone, theme);
          return (
            <g key={mi}>
              <line x1={x(k)} x2={x(k)} y1={pad.t} y2={H - pad.b} stroke={c} strokeWidth={3} strokeDasharray="8 8" />
              <text x={x(k)} y={pad.t - 6} fill={c} fontFamily={theme.monoFont} fontWeight={700} fontSize={24} textAnchor="middle">{m.label}</text>
            </g>
          );
        })}
        {ticks.map((k, ti) => (
          <text key={ti} x={x(k)} y={H - 10} fill={theme.text} fillOpacity={0.6} fontFamily={theme.monoFont} fontWeight={700} fontSize={26} textAnchor={ti === 0 ? "start" : ti === 2 ? "end" : "middle"}>
            {widget.labels?.[idx[k]] ?? shortDate(widget.dates[idx[k]])}
          </text>
        ))}
      </svg>
      {widget.note && <div style={{ fontFamily: theme.monoFont, fontSize: 24, color: theme.text, opacity: 0.55, marginTop: 8 }}>{widget.note}</div>}
    </Card>
  );
};

// Weekdays between two ISO dates (a close-enough count of trading days).
const weekdaysBetween = (a: string, b: string) => {
  const d0 = new Date(`${a}T00:00:00Z`).getTime();
  const d1 = new Date(`${b}T00:00:00Z`).getTime();
  let n = 0;
  for (let t = d0 + 86400000; t <= d1; t += 86400000) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
};

// Long history on a log scale, then past falls replayed from today's peak as dashed paths.
const PathsChart: React.FC<WidgetProps<"pathschart">> = ({ widget, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 900;
  const H = 700;
  const pad = { l: 10, r: 120, t: 30, b: 50 };
  const split = 0.5; // share of the width for the history; the future gets the rest ("zoomed in")
  const xs = pad.l + (W - pad.l - pad.r) * split;
  const s0 = widget.series[0];
  const idx = keptIndices(widget.dates, widget.from, widget.step);
  const hist = idx.filter((i) => widget.dates[i] <= widget.baseDate);
  const since = widget.dates.map((d, i) => [d, i] as const).filter(([d, i]) => d > widget.baseDate && s0.values[i] != null);
  const baseIdx = hist[hist.length - 1];
  const base = s0.values[baseIdx] ?? widget.paths[0]?.values[0] ?? 1;
  const maxDays = Math.max(20, ...widget.paths.map((p) => p.days[p.days.length - 1] ?? 0));
  const all = [
    ...hist.map((i) => s0.values[i]).filter((v): v is number => v != null && v > 0),
    ...widget.paths.flatMap((p) => p.values),
  ];
  const lo = Math.log(Math.min(...all) * 0.9);
  const hi = Math.log(Math.max(...all) * 1.08);
  const y = (v: number) => pad.t + (1 - (Math.log(v) - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const xh = (k: number) => pad.l + (k / Math.max(1, hist.length - 1)) * (xs - pad.l);
  const xf = (day: number) => xs + (day / maxDays) * (W - pad.r - xs);
  const t = interpolate(frame, [4, 4 + (widget.draw ?? 40)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const shown = Math.max(1, Math.round(t * hist.length));
  const histPts = hist.slice(0, shown).map((i, k) => (s0.values[i] == null ? null : ([xh(k), y(s0.values[i]!)] as [number, number])));
  const sincePts = since.map(([d, i]) => [xf(weekdaysBetween(widget.baseDate, d)), y(s0.values[i]!)] as [number, number]);
  const after = 4 + (widget.draw ?? 40);
  const pathStarts = widget.paths.map((p, pi) => Math.max(after, cueFrame(p.cue, words, fps, after + 10 + pi * 30)));
  const years = [1996, 2000, 2005, 2010, 2015, 2020, 2025].map((yr) => ({ yr, k: hist.findIndex((i) => widget.dates[i] >= `${yr}-01-01`) })).filter((a) => a.k > 0 && a.k < hist.length - 30);
  return (
    <Card padding={30}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10 }}>
        <span style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 30, color: theme.text }}>{s0.label}</span>
        <span style={{ fontFamily: theme.numberFont, fontWeight: 900, fontSize: 48, color: (theme.up ?? UP) }}>{fmtValue(base, s0)}</span>
        <span style={{ fontFamily: theme.monoFont, fontWeight: 700, fontSize: 26, color: theme.text, opacity: 0.6 }}>peak · {shortDate(widget.baseDate)}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <rect x={xs} y={pad.t} width={W - pad.r - xs} height={H - pad.t - pad.b} fill="#FFFFFF" fillOpacity={0.05} />
        <line x1={xs} x2={xs} y1={pad.t} y2={H - pad.b} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="6 8" />
        <text x={xs + 12} y={pad.t + 28} fill={theme.text} fillOpacity={0.6} fontFamily={theme.monoFont} fontWeight={700} fontSize={24}>next ~{Math.round(maxDays / 250)} yrs, zoomed in</text>
        <path d={linePath(histPts)} fill="none" stroke={(theme.up ?? UP)} strokeWidth={5} strokeLinejoin="round" />
        {t >= 1 && (
          <>
            <path d={linePath([[xs, y(base)], ...sincePts])} fill="none" stroke={theme.text} strokeWidth={6} strokeLinejoin="round" />
            <circle cx={xs} cy={y(base)} r={10} fill={theme.text} />
          </>
        )}
        {widget.paths.map((p, pi) => {
          const k = interpolate(frame, [pathStarts[pi], pathStarts[pi] + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          if (k <= 0) return null;
          const color = p.color ?? toneColor(p.tone, theme);
          const m = Math.max(2, Math.round(k * p.days.length));
          const pts = p.days.slice(0, m).map((d, j) => [xf(d), y(p.values[j])] as [number, number]);
          const [ex, ey] = pts[pts.length - 1];
          const change = (p.values[p.values.length - 1] / base - 1) * 100;
          return (
            <g key={pi}>
              <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={5} strokeDasharray="14 10" strokeLinecap="round" />
              <circle cx={ex} cy={ey} r={9} fill={color} />
              {k >= 1 && (
                <text x={ex + 14} y={ey + 9} fill={color} fontFamily={theme.monoFont} fontWeight={800} fontSize={26}>
                  {p.label} {change < 0 ? "−" : "+"}
                  {fmt(Math.abs(change))}%
                </text>
              )}
            </g>
          );
        })}
        {years.map(({ yr, k }) => (
          <text key={yr} x={xh(k)} y={H - 10} fill={theme.text} fillOpacity={0.6} fontFamily={theme.monoFont} fontWeight={700} fontSize={24} textAnchor="middle">{yr}</text>
        ))}
        <text x={xs} y={H - 10} fill={theme.text} fontFamily={theme.monoFont} fontWeight={700} fontSize={24} textAnchor="middle">{shortDate(widget.baseDate)}</text>
      </svg>
      {widget.note && <div style={{ fontFamily: theme.monoFont, fontSize: 24, color: theme.text, opacity: 0.55, marginTop: 8 }}>{widget.note}</div>}
    </Card>
  );
};

export const Widget: React.FC<{ widget: NewsWidget; words?: Word[] }> = ({ widget, words }) => {
  switch (widget.type) {
    case "funnel":
      return <Funnel widget={widget} words={words} />;
    case "counter":
      return <Counter widget={widget} words={words} />;
    case "ticker":
      return <Ticker widget={widget} words={words} />;
    case "compare":
      return <Compare widget={widget} words={words} />;
    case "terminal":
      return <Terminal widget={widget} words={words} />;
    case "checklist":
      return <Checklist widget={widget} words={words} />;
    case "linechart":
      return <LineChart widget={widget} words={words} />;
    case "pathschart":
      return <PathsChart widget={widget} words={words} />;
    case "logos":
      return <Logos widget={widget} words={words} />;
    case "pricetag":
      return <PriceTag widget={widget} words={words} />;
    case "pie":
      return <Pie widget={widget} words={words} />;
    case "circles":
      return <Circles widget={widget} words={words} />;
    case "mapfill":
      return <MapFill widget={widget} words={words} />;
    case "stocks":
      return <Stocks widget={widget} words={words} />;
  }
};

// ── scenes ────────────────────────────────────────────────────────────────────────────────────

// Faint CRT scanlines and a vignette over the photo, for the terminal look.
const Scanlines: React.FC = () => (
  <>
    <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 2px, transparent 2px, transparent 5px)" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.65) 100%)" }} />
  </>
);

// Slow push-in and drift on the scene's content, so nothing sits perfectly still.
const Drift: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const dir = index % 2 ? -1 : 1;
  return <AbsoluteFill style={{ transform: `scale(${1 + 0.035 * t}) translate(${dir * 14 * t}px, ${-10 * t}px)` }}>{children}</AbsoluteFill>;
};

// Scene cut on the background picture: it tears into offset strips with a green flash for ~9
// frames, then settles. Text is never wrapped in this.
export const GlitchIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const N = 9;
  if (frame >= N) return <AbsoluteFill>{children}</AbsoluteFill>;
  const k = 1 - frame / N;
  const strips = 7;
  return (
    <AbsoluteFill>
      {Array.from({ length: strips }, (_, i) => {
        const top = (i / strips) * 100;
        const off = (random(`glitch-${i}-${Math.floor(frame / 2)}`) - 0.5) * 180 * k;
        return (
          <AbsoluteFill key={i} style={{ clipPath: `inset(${top}% 0 ${100 - top - 100 / strips}% 0)`, transform: `translateX(${off}px)` }}>
            {children}
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill style={{ backgroundColor: theme.accent, opacity: 0.22 * k, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

const PhotoBackground: React.FC<SceneProps & { dim: string }> = ({ scene, projectPath, index, dim }) => {
  const theme = useTheme();
  // only the picture glitches on the cut — headlines, cards and captions come in clean
  return (
    <GlitchIn>
      <SceneVisual visual={scene.visual} projectPath={projectPath} label={scene.name ?? scene.id} direction={index % 2 ? -1 : 1} mapPlacement="background" />
      <AbsoluteFill style={{ background: dim.replaceAll("BG", theme.background) }} />
      <Scanlines />
    </GlitchIn>
  );
};

// Hook: full-screen photo, the top bar, and the headline low in the frame like a breaking-news card.
export const NewsHookScene: React.FC<SceneProps> = (props) => {
  const theme = useTheme();
  const { project, index, scene, words } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <PhotoBackground {...props} dim="linear-gradient(180deg, BGCC 0%, transparent 22%, transparent 42%, BGEE 72%, BG 100%)" />
      <Drift index={index}>
        {/* stays clear of the captions, wherever the project puts them; an optional widget sits above the headline */}
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: `0 76px ${theme.captions.style === "none" ? 520 : theme.captions.bottomOffset + 190}px`, gap: 26 }}>
          {scene.widget && (
            <div style={{ marginBottom: 20 }}>
              <Widget widget={scene.widget} words={words} />
            </div>
          )}
          <div style={{ fontFamily: theme.headlineFont, fontWeight: 800, fontSize: 34, color: theme.accent }}>{project?.news?.kicker ?? "> breaking"}</div>
          <Headline text={scene.onScreenText} size={112} />
        </AbsoluteFill>
      </Drift>
      <NewsBar project={project} index={index} />
    </AbsoluteFill>
  );
};

// Beat: full-screen photo behind a headline and the data widget, centred vertically.
export const NewsBeatScene: React.FC<SceneProps> = (props) => {
  const theme = useTheme();
  const { project, index, scene, words } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <PhotoBackground
        {...props}
        dim={
          project?.news?.dim === "strong"
            ? "linear-gradient(180deg, BGF2 0%, BGC7 22%, BGD1 50%, BGC7 78%, BGF7 96%)"
            : "linear-gradient(180deg, BGE6 0%, BG8C 22%, BGA6 50%, BG8C 78%, BGF2 96%)"
        }
      />
      <Drift index={index}>
        {/* headline + widget sit in the middle of the frame, between the top bar and the captions */}
        {/* 76px sides: the slow drift (scale + sideways move) must not push headlines to the screen edge.
            With captions off, only the platform's own buttons need clearing at the bottom. */}
        <AbsoluteFill style={{ padding: `170px 76px ${theme.captions.style === "none" ? 330 : Math.max(330, theme.captions.bottomOffset + 160)}px`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>
          <Headline text={scene.onScreenText} size={84} />
          {scene.widget && <Widget widget={scene.widget} words={words} />}
        </AbsoluteFill>
      </Drift>
      <NewsBar project={project} index={index} />
    </AbsoluteFill>
  );
};

// Series end card (projects with `news.day`): channel logo, the follow line, a strip of days with
// today ticked and the next days waiting, and a follow button with the channel handle.
// Projects without a day keep the shared outro.
export const NewsOutroScene: React.FC<SceneProps> = (props) =>
  props.project?.news?.day == null ? <OutroScene {...props} /> : <SeriesOutro {...props} day={props.project.news.day} />;

const SeriesOutro: React.FC<SceneProps & { day: number }> = ({ project, index, scene, day }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const logo = useSpringAt(2, 12);
  const days = [0, 1, 2, 3, 4].map((k) => day + k);
  const line = interpolate(frame, [26, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const button = useSpringAt(54, 11);
  const breathe = 1 + 0.025 * Math.sin(Math.max(0, frame - 70) / 9);
  const glow = 0.5 + 0.12 * Math.sin(frame / 22);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {/* soft warm glow + faint ruled lines, so the card isn't a flat fill */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${theme.accent}33 0%, transparent 55%)`, opacity: glow }} />
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(180deg, ${theme.text}08 0px, ${theme.text}08 2px, transparent 2px, transparent 64px)` }} />
      <AbsoluteFill style={{ padding: "230px 64px 260px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 56 }}>
        <Img
          src={staticFile("brand/logo/polyjuice-logo-round-transparent.png")}
          style={{ width: 170, height: 170, opacity: logo, transform: `scale(${0.7 + 0.3 * logo})`, filter: `drop-shadow(0 10px 30px ${theme.accent}55)` }}
        />
        <div style={{ textAlign: "center", width: "100%" }}>
          <Headline text={scene.onScreenText} size={100} />
        </div>
        {/* day strip: today ticked, the next days outlined, joined by a dashed line drawing out from today */}
        <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ position: "absolute", left: 75, top: 44, height: 4, width: `calc((100% - 150px) * ${line})`, backgroundImage: `repeating-linear-gradient(90deg, ${theme.text}55 0px, ${theme.text}55 14px, transparent 14px, transparent 26px)` }} />
          {days.map((d, k) => (
            <DayChip key={d} day={d} today={k === 0} at={14 + k * 8} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(1, button * 1.4), transform: `scale(${(0.85 + 0.15 * Math.min(1, button)) * breathe})` }}>
          <div style={{ fontFamily: theme.headlineFont, fontWeight: 800, fontSize: 52, letterSpacing: 1, color: theme.textOnAccent, backgroundColor: theme.accent, padding: "20px 64px", borderRadius: 999, boxShadow: `0 16px 40px ${theme.accent}55` }}>
            + FOLLOW
          </div>
          <div style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 30, color: theme.text, opacity: 0.75 }}>{theme.handle}</div>
        </div>
      </AbsoluteFill>
      <NewsBar project={project} index={index} hideCount />
    </AbsoluteFill>
  );
};

const DayChip: React.FC<{ day: number; today: boolean; at: number }> = ({ day, today, at }) => {
  const theme = useTheme();
  const pop = useSpringAt(at, 12);
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: 150, opacity: Math.min(1, pop * 1.4), transform: `translateY(${(1 - Math.min(1, pop)) * 24}px)` }}>
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: theme.numberFont,
          fontWeight: 800,
          fontSize: 44,
          backgroundColor: today ? theme.accent : theme.background,
          color: today ? theme.textOnAccent : theme.text,
          border: `4px solid ${today ? theme.accent : `${theme.text}44`}`,
          opacity: today ? 1 : 0.8,
        }}
      >
        {today ? "✓" : day}
      </div>
      <div style={{ fontFamily: theme.monoFont, fontWeight: 600, fontSize: 24, letterSpacing: 2, color: today ? theme.accent : theme.text, opacity: today ? 1 : 0.55 }}>DAY {day}</div>
    </div>
  );
};


// Newsroom template (AI News series), terminal look: every scene carries a top bar (tag · date ·
// scene count) over a full-screen photo with scanlines; beats add a headline and one data widget.
// Widgets are filled from project.json, so a new story needs no code — only `widget` per scene.
// Scenes cut in with a glitch and drift slowly while they play.
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { EmphasisText } from "../../components/EmphasisText";
import { SceneVisual } from "../../components/SceneVisual";
import { type Theme, useTheme } from "../../theme";
import type { NewsTone, NewsWidget, Project, Word } from "../../types";
import type { SceneProps } from "../listicle/scenes";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const UP = "#2BD576";
const CARD_BORDER = "#1F4A2A";

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

// Frame the narration reaches `cue` (scene-relative), or `fallback` when there's no cue / no match.
const cueFrame = (cue: string | undefined, words: Word[] | undefined, fps: number, fallback: number) => {
  const c = cue ? norm(cue) : "";
  const w = c ? words?.find((x) => norm(x.text).startsWith(c)) : undefined;
  return w ? Math.round(w.start * fps) : fallback;
};

const toneColor = (tone: NewsTone | undefined, theme: Theme) =>
  tone === "danger" ? theme.secondary : tone === "up" ? UP : tone === "neutral" ? theme.text : theme.accent;

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

export const NewsBar: React.FC<{ project?: Project; index: number }> = ({ project, index }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const total = project?.scenes.filter((s) => s.kind !== "outro").length ?? 0;
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin(frame / 9));
  const label = { fontFamily: theme.headlineFont, fontWeight: 800, fontSize: 30, letterSpacing: 2 } as const;
  return (
    <div style={{ position: "absolute", top: 70, left: 56, right: 56, display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ ...label, display: "flex", alignItems: "center", gap: 12, backgroundColor: theme.secondary, color: theme.textOnSecondary, padding: "8px 18px", borderRadius: 10 }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", opacity: pulse }} />
        {project?.news?.tag ?? "AI NEWS"}
      </div>
      {project?.news?.date && <div style={{ ...label, color: theme.text, opacity: 0.75 }}>{project.news.date}</div>}
      <div style={{ flex: 1 }} />
      {total > 0 && (
        <div style={{ ...label, fontSize: 28, color: theme.text, opacity: 0.6 }}>
          {index + 1}/{total}
        </div>
      )}
    </div>
  );
};

const Headline: React.FC<{ text: string; size: number }> = ({ text, size }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: theme.headlineFont, fontWeight: 800, fontSize: size, lineHeight: 1.05, letterSpacing: -2, textTransform: "uppercase", color: theme.text, textWrap: "balance", textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>
      {words.map((w, i) => {
        const enter = spring({ frame: frame - 2 - i * 3, fps, config: { damping: 13, mass: 0.6 } });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.4, transform: `translateY(${(1 - enter) * 40}px)`, opacity: enter }}>
            <EmphasisText text={w} />
            {i === words.length - 1 && Math.floor(frame / 15) % 2 === 0 ? <span style={{ color: theme.accent }}>_</span> : null}
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
        backgroundColor: `${theme.surface}D9`,
        backdropFilter: "blur(10px)",
        border: `2px solid ${CARD_BORDER}`,
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
        <span style={{ fontFamily: theme.headlineFont, fontWeight: 900, fontSize: 84, color }}>{fmt(Math.round(row.value * t))}</span>
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

const CounterItem: React.FC<{ item: Extract<NewsWidget, { type: "counter" }>["items"][number]; at: number; big: boolean }> = ({ item, at, big }) => {
  const theme = useTheme();
  const t = useRamp(at, 30);
  const pop = useSpringAt(at, 11);
  return (
    <div style={{ opacity: Math.min(1, pop * 1.4), transform: `scale(${0.8 + 0.2 * pop})`, transformOrigin: "left center" }}>
      <div style={{ fontFamily: theme.headlineFont, fontWeight: 900, fontSize: big ? 220 : 150, lineHeight: 0.95, color: toneColor(item.tone, theme) }}>
        {item.prefix ?? ""}
        {fmt(item.value * t, item.decimals ?? 0)}
        {item.suffix ?? ""}
      </div>
      <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 38, color: theme.text, opacity: 0.85, marginTop: 6 }}>{item.label}</div>
    </div>
  );
};

const Counter: React.FC<WidgetProps<"counter">> = ({ widget, words }) => {
  const { fps } = useVideoConfig();
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {widget.items.map((item, i) => (
          <div key={i} style={i ? { borderTop: `2px solid ${CARD_BORDER}`, paddingTop: 26 } : undefined}>
            <CounterItem item={item} at={cueFrame(item.cue, words, fps, 8 + i * 24)} big={widget.items.length === 1} />
          </div>
        ))}
      </div>
    </Card>
  );
};

// A market line that draws itself (falling or rising), with % change chips popping in on cue.
const Ticker: React.FC<WidgetProps<"ticker">> = ({ widget, words }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const at = cueFrame(widget.cue, words, fps, 6);
  const t = useRamp(at, 45);
  const down = widget.trend === "down";
  const color = down ? theme.secondary : UP;
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
      {widget.label && <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, color: theme.text, opacity: 0.7, marginBottom: 10 }}>{widget.label}</div>}
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
  const color = change < 0 ? theme.secondary : UP;
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
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 34, color: theme.text }}>{label}</span>
      <span style={{ fontFamily: theme.headlineFont, fontWeight: 900, fontSize: 60, color }}>
        {change < 0 ? "−" : "+"}
        {fmt(Math.abs(change), 1)}%
      </span>
    </div>
  );
};

// Side-by-side numbers as horizontal bars (33 of 41, 10% vs 16%).
const CompareRow: React.FC<{ item: Extract<NewsWidget, { type: "compare" }>["items"][number]; max: number; unit: string; at: number }> = ({ item, max, unit, at }) => {
  const theme = useTheme();
  const t = useRamp(at, 30);
  const color = toneColor(item.tone, theme);
  return (
    <div style={{ opacity: t > 0 ? 1 : 0.25 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: theme.bodyFont, fontWeight: 800, color: theme.text }}>
        <span style={{ fontSize: 40 }}>{item.label}</span>
        <span style={{ fontFamily: theme.headlineFont, fontWeight: 900, fontSize: 96, color }}>
          {fmt(Math.round(item.value * t))}
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
  const { fps } = useVideoConfig();
  const max = Math.max(...widget.items.map((i) => i.max ?? i.value));
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {widget.items.map((item, i) => (
          <CompareRow key={i} item={item} max={max} unit={widget.unit ?? ""} at={cueFrame(item.cue, words, fps, 8 + i * 20)} />
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 26px", borderBottom: `2px solid ${CARD_BORDER}` }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c }} />
        ))}
        <span style={{ marginLeft: 14, fontFamily: MONO, fontSize: 26, color: theme.text, opacity: 0.55 }}>{widget.title ?? "terminal"}</span>
      </div>
      <div style={{ padding: "24px 30px 30px", fontFamily: MONO, fontWeight: 700, fontSize: 40, lineHeight: 1.5 }}>
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
      <div style={{ fontFamily: theme.headlineFont, fontWeight: 900, fontSize: 110, color, marginTop: 10 }}>{Math.round((ticked / col.total) * 100)}%</div>
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

// Scene cut: the frame tears into offset strips with a green flash for ~9 frames, then settles.
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
  return (
    <>
      <SceneVisual visual={scene.visual} projectPath={projectPath} label={scene.name ?? scene.id} direction={index % 2 ? -1 : 1} mapPlacement="background" />
      <AbsoluteFill style={{ background: dim.replaceAll("BG", theme.background) }} />
      <Scanlines />
    </>
  );
};

// Hook: full-screen photo, the top bar, and the headline low in the frame like a breaking-news card.
export const NewsHookScene: React.FC<SceneProps> = (props) => {
  const theme = useTheme();
  const { project, index, scene } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <PhotoBackground {...props} dim="linear-gradient(180deg, BGCC 0%, transparent 22%, transparent 42%, BGEE 72%, BG 100%)" />
      <Drift index={index}>
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 56px 400px", gap: 26 }}>
          <div style={{ fontFamily: theme.headlineFont, fontWeight: 800, fontSize: 34, color: theme.accent }}>&gt; breaking</div>
          <Headline text={scene.onScreenText} size={112} />
        </AbsoluteFill>
      </Drift>
      <NewsBar project={project} index={index} />
    </AbsoluteFill>
  );
};

// Beat: full-screen photo behind a headline and the data widget; the photo shows through below.
export const NewsBeatScene: React.FC<SceneProps> = (props) => {
  const theme = useTheme();
  const { project, index, scene, words } = props;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <PhotoBackground {...props} dim="linear-gradient(180deg, BGF2 0%, BGCC 34%, BG55 58%, BG55 74%, BGEE 92%)" />
      <Drift index={index}>
        <AbsoluteFill style={{ padding: "180px 56px 360px", display: "flex", flexDirection: "column", gap: 34 }}>
          <Headline text={scene.onScreenText} size={84} />
          {scene.widget && <Widget widget={scene.widget} words={words} />}
        </AbsoluteFill>
      </Drift>
      <NewsBar project={project} index={index} />
    </AbsoluteFill>
  );
};

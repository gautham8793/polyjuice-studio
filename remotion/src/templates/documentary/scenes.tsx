// Documentary template — project-driven scenes. Each scene's `doc` spec picks a layout and
// carries its data; the parts (parts.tsx, maps.tsx) and theme (theme.ts) give the paper-collage
// look. Every layout sizes itself from the frame, so one project renders in 16:9 and 9:16.
import { createContext, useContext } from "react";
export const ChannelCtx = createContext<ChannelInfo | null>(null);
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { DocIcon, DocLogo, DocPhoto, DocSide, DocSpec, Project, Scene, Word } from "../../types";
import { AtlasMap } from "./maps";
import {
  BankArt,
  ChannelBlock,
  type ChannelInfo,
  paperShadow,
  ChapterTag,
  Counter,
  DotGrid,
  FlowArrow,
  Highlight,
  IndiaTag,
  InkIcon,
  Kicker,
  LogoBadge,
  PenCross,
  PhotoPrint,
  Sheet,
  TornSheetBg,
  type PillarLook,
  PillarTracker,
  PILLARS,
  pillarCenter,
  prog,
  Footnote,
  useLayout,
} from "./parts";
import { ChartLayout, ChipCoverArt, StackTracker } from "./chips";
import { CueWords, useCue } from "./cues";
import { CircuitTraces, DollarLayout, IconGrid, PrintLayout, QueueLayout, ReceiptLayout, RouteLayout, StackLayout, StatFlap } from "./motion";
import { DOC } from "./theme";

type Props = { scene: Scene; projectPath: string; index: number; words: Word[]; project: Project };

// ---- one set of text styles for every layout ----
/** The line that explains a number or headline: serif, ink. */
const labelText = (u: number): React.CSSProperties => ({ fontFamily: DOC.fonts.headline, fontSize: 46 * u, lineHeight: 1.15, color: DOC.ink });
/** A quieter second line: plain sans, soft ink. */
const subText = (u: number): React.CSSProperties => ({ fontFamily: DOC.fonts.body, fontWeight: 500, fontSize: 30 * u, lineHeight: 1.35, color: DOC.inkSoft });
/** Small caption under an icon or logo: typewriter caps, well spaced. */
const tagText = (u: number): React.CSSProperties => ({ fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 20 * u, letterSpacing: 2 * u, lineHeight: 1.3, textTransform: "uppercase" });

/** Asset path relative to the content root: "library/…" as is, else inside the project folder. */
const assetPath = (src: string, projectPath: string) => (src.startsWith("library/") ? src : `${projectPath}/${src}`);

// ---- timing to the narration ----
// Each scene's word timings (from the voice) are shared here, so a piece can appear when the
// narrator says its word (`cue`), falling back to its fixed start frame when the word isn't found.
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Start frames for a row of pieces, in order: each at least `gap` frames after the one before,
 *  and a piece cued late pulls the ones before it no later than itself (no piece arrives after
 *  the arrow that points to it). */
const orderedStarts = (raw: number[], gap: number) => {
  const out = [...raw];
  for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - gap);
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  return out.map((v) => Math.max(0, v));
};

/** Main text with an optional highlighter phrase; the sweep starts when the phrase is spoken. */
const Marked: React.FC<{ text: string; highlight?: string; start: number }> = ({ text, highlight, start }) => {
  const cue = useCue();
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const [a, ...rest] = text.split(highlight);
  return (
    <>
      {a}
      <Highlight start={cue(highlight, start, 0)}>{highlight}</Highlight>
      {rest.join(highlight)}
    </>
  );
};

/** Centre stage for a layout, leaving room for the chrome above and captions below. */
const Stage: React.FC<{ children: React.ReactNode; dir?: "row" | "column"; gap?: number }> = ({ children, dir, gap = 60 }) => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: dir ?? (vertical ? "column" : "row"),
        gap: gap * u,
        padding: `${(vertical ? 260 : 120) * u}px ${(vertical ? 60 : 120) * u}px ${(vertical ? 380 : 170) * u}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Headline: React.FC<{ size: number; color?: string; align?: "left" | "center"; children: React.ReactNode; start?: number }> = ({ size, color = DOC.ink, align, children, start = 4 }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const a = prog(frame, start, 18);
  return (
    <div
      style={{
        fontFamily: DOC.fonts.headline,
        fontWeight: DOC.headWeight,
        fontSize: size * u,
        lineHeight: 1.05,
        color,
        textAlign: align ?? (vertical ? "center" : "left"),
        opacity: a,
        transform: `translateY(${(1 - a) * 20 * u}px)`,
      }}
    >
      {children}
    </div>
  );
};

const Logos: React.FC<{ logos: DocLogo[]; connectors?: string[]; size: number; start: number; projectPath: string }> = ({ logos, connectors = [], size, start, projectPath }) => {
  const { u } = useLayout();
  const cue = useCue();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: (logos.length > 4 ? 40 : 24) * u, flexWrap: "wrap", justifyContent: "center" }}>
      {logos.map((l, i) => (
        <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
          {i > 0 && connectors[i - 1] && <Kicker size={22}>{connectors[i - 1]}</Kicker>}
          <LogoBadge name={l.name} src={l.src ? assetPath(l.src, projectPath) : undefined} zoom={l.zoom} color={l.color ?? DOC.ink} caption={l.caption} size={(i === 0 && connectors.length ? size * 1.4 : logos.length > 4 ? size * 0.72 : size) * u} start={cue(l.cue, start + i * 10)} />
        </div>
      ))}
    </div>
  );
};

// ---------------- layouts ----------------

const TitleCard: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const rule = prog(frame, 14, 20);
  return (
    <Stage dir="column" gap={18}>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <Headline size={vertical ? 120 : 150} align="center">
        {d.text}
      </Headline>
      <div style={{ width: (vertical ? 500 : 700) * u * rule, height: 8 * u, background: DOC.accent }} />
      {d.sub && <div style={{ fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: 38 * u, color: DOC.inkSoft, textAlign: "center" }}>{d.sub}</div>}
    </Stage>
  );
};

const ChapterCard: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const c = d.chapter ?? { n: 1, title: d.text ?? "" };
  const n = prog(frame, 0, 16);
  return (
    <Stage dir="column" gap={22}>
      <div style={{ width: 120 * u, height: 120 * u, background: DOC.ink, color: DOC.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DOC.fonts.headline, fontSize: 90 * u, transform: `scale(${interpolate(n, [0, 1], [1.4, 1])})`, opacity: n }}>{c.n}</div>
      <Kicker>Chapter {c.n}</Kicker>
      <Headline size={vertical ? 110 : 140} align="center" start={10}>
        {c.title}
      </Headline>
    </Stage>
  );
};

const DateLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, u, vertical } = useLayout();
  const rule = prog(frame, 16, 20);
  const b = prog(frame, 24, 16);
  const c = prog(frame, 34, 16);
  const text = (
    <>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <Headline size={d.map ? (vertical ? 120 : 130) : 170} align={d.map ? "left" : "center"}>
        {d.date}
      </Headline>
      <div style={{ width: (d.map ? 420 : 640) * u * rule, height: 8 * u, background: DOC.accent }} />
      {d.place && <div style={{ fontFamily: DOC.fonts.headline, fontSize: (d.map ? 80 : 110) * u, color: DOC.ink, opacity: b, marginTop: 4 * u }}>{d.place}</div>}
      {d.coords && (
        <div style={{ opacity: c }}>
          <Kicker size={22}>{d.coords}</Kicker>
        </div>
      )}
    </>
  );
  if (!d.map) {
    return (
      <Stage dir="column" gap={10}>
        {text}
      </Stage>
    );
  }
  const f = mapFrame(vertical, true);
  return (
    <AbsoluteFill>
      <AtlasMap view={d.map.view} focus={d.map.focus} lit={d.map.lit} marks={d.map.marks} w={W} h={H} region={f.region} start={0} />
      {f.card && <MapCard box={f.card}>{text}</MapCard>}
    </AbsoluteFill>
  );
};

const PhotosLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const { width: W, height: H, u, vertical } = useLayout();
  const photos = (d.photos ?? []).slice(0, 3);
  // positions per count: [x, y, w, h, rot] as fractions of the frame (w/h in u-units)
  const slots: Record<number, [number, number, number, number, number][]> = vertical
    ? { 1: [[0.5, 0.42, 940, 700, -2]], 2: [[0.45, 0.29, 820, 560, -4], [0.62, 0.57, 640, 470, 4]], 3: [[0.42, 0.25, 700, 480, -4], [0.62, 0.45, 640, 440, 3], [0.42, 0.63, 640, 440, -2]] }
    : { 1: [[0.5, 0.47, 1100, 700, -2]], 2: [[0.34, 0.47, 780, 540, -4], [0.7, 0.48, 560, 420, 5]], 3: [[0.24, 0.45, 600, 420, -4], [0.52, 0.5, 560, 400, 3], [0.79, 0.44, 540, 380, -3]] };
  const pos = slots[Math.max(1, photos.length)] ?? slots[1];
  return (
    <AbsoluteFill>
      {photos.map((p, i) => {
        const [x, y, w, h, rot] = pos[i];
        return <PhotoPrint key={p.src} label={p.label ?? ""} src={assetPath(p.src, projectPath)} credit={p.credit} w={w * u} h={h * u} x={W * x} y={H * y} rot={rot} start={i * 20} from={i % 2 ? "right" : "left"} />;
      })}
      {d.text && (
        <div style={{ position: "absolute", left: 0, right: 0, top: (vertical ? 1260 : 800) * u, display: "flex", justifyContent: "center" }}>
          <div style={{ ...labelText(u), fontSize: 40 * u, textAlign: "center" }}>{d.text}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const LogosLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const { u, vertical } = useLayout();
  const cue = useCue();
  const steps = d.steps ?? [];
  const stepStarts = orderedStarts(steps.map((st, i) => cue(st.cue, 40 + i * 16)), 14);
  const icon = (vertical ? 110 : 130) * u;
  const labelW = (vertical ? 190 : 230) * u;
  return (
    <Stage dir="column" gap={vertical ? 70 : 60}>
      {d.india && <IndiaTag start={0} />}
      {d.photo && <SidePhoto photo={d.photo} projectPath={projectPath} />}
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      {d.logos && <Logos logos={d.logos} connectors={d.connectors} size={250} start={0} projectPath={projectPath} />}
      {steps.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ display: "flex", alignItems: "flex-start" }}>
              <Step icon={s.icon} label={s.label} size={icon} width={labelW} start={stepStarts[i]} accent={i === steps.length - 2} />
              {i < steps.length - 1 && (
                <div style={{ height: icon, display: "flex", alignItems: "center" }}>
                  <FlowArrow start={stepStarts[i + 1] - 8} length={(vertical ? 40 : 80) * u} seed={i + 2} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Stage>
  );
};

const Step: React.FC<{ icon: DocIcon; label: string; size: number; width: number; start: number; accent?: boolean }> = ({ icon, label, size, width, start, accent }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const o = prog(frame, start, 12);
  return (
    <div style={{ width, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 * u, opacity: o, transform: `translateY(${(1 - o) * 14 * u}px)` }}>
      <InkIcon kind={icon} size={size} color={accent ? DOC.accent : DOC.ink} />
      <div style={{ ...tagText(u), color: accent ? DOC.accent : DOC.ink, textAlign: "center", lineHeight: 1.1 }}>{label}</div>
    </div>
  );
};

const CrossedLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const tick = d.layout === "ticks";
  const size = (vertical ? 190 : tick ? 200 : 240) * u;
  return (
    <Stage dir="column" gap={tick ? 46 : 0}>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: vertical ? "flex-start" : "flex-start", gap: (vertical ? 40 : tick ? 90 : 110) * u }}>
      {(d.items ?? []).map((it, i) => {
        const t0 = cue(it.cue, i * 14);
        const o = prog(frame, t0, 12);
        return (
          <div key={it.label} style={{ display: "flex", flexDirection: vertical ? "row" : "column", alignItems: "center", gap: 22 * u, opacity: o }}>
            <div style={{ position: "relative", width: size, height: size }}>
              <InkIcon kind={it.icon} size={size} />
              {tick ? <PenTick start={t0 + 12} size={size * 0.6} /> : <PenCross start={t0 + 14} size={size * 0.95} />}
            </div>
            <div style={{ fontFamily: DOC.fonts.headline, fontSize: (tick ? 44 : 52) * u, lineHeight: 1.1, color: DOC.ink, textAlign: vertical ? "left" : "center", width: vertical ? 520 * u : tick ? 340 * u : undefined }}>{it.label}</div>
          </div>
        );
      })}
      </div>
    </Stage>
  );
};

/** The number as text, counting up. */
const StatNumber: React.FC<{ st: NonNullable<DocSpec["stat"]>; start?: number }> = ({ st, start = 6 }) => (
  <span style={{ opacity: prog(useCurrentFrame(), start - 2, 8) }}>
    {st.prefix}
    <Counter to={st.value} start={start} dur={40} decimals={st.decimals} />
    {st.suffix}
  </span>
);

/** A hand-drawn loop that draws itself around a box of size w×h. */
const PenLoop: React.FC<{ w: number; h: number; start: number }> = ({ w, h, start }) => {
  // a loose hand-drawn loop around a w×h box (in px), drawn from a gap at the top-left
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 22);
  if (p <= 0) return null;
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (i / 52) * Math.PI * 2 - 2.4;
    const j = 1 + 0.035 * Math.sin(i * 1.3) + (i / 60) * 0.05;
    pts.push(`${(w / 2 + Math.cos(t) * w * 0.52 * j).toFixed(1)},${(h / 2 + Math.sin(t) * h * 0.5 * j).toFixed(1)}`);
  }
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <path d={"M" + pts.join("L")} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} stroke={DOC.accent} strokeWidth={5 * u} strokeLinecap="round" fill="none" />
    </svg>
  );
};

/** Rough on-screen size of a number in the headline serif (for the pen loop around it). */
const numberBox = (st: NonNullable<DocSpec["stat"]>, fontSize: number) => {
  const text = `${st.prefix ?? ""}${st.value.toLocaleString("en-US", { minimumFractionDigits: st.decimals ?? 0, maximumFractionDigits: st.decimals ?? 0 })}${st.suffix ?? ""}`;
  return { w: text.length * fontSize * 0.47 + fontSize * 0.3, h: fontSize * 1.05 };
};

/** What holds an index card to the page (under review: thumbtack · paperclip · tape · tapeCorners). */
const Pin: React.FC<{ kind: NonNullable<DocSpec["pin"]> }> = ({ kind }) => {
  const { u } = useLayout();
  const tape = (style: React.CSSProperties) => (
    <div
      style={{
        position: "absolute",
        width: 150 * u,
        height: 40 * u,
        background: "rgba(214,196,150,0.82)",
        boxShadow: `0 ${2 * u}px ${3 * u}px rgba(60,40,10,0.18)`,
        clipPath: "polygon(2% 8%, 98% 0, 100% 46%, 97% 92%, 3% 100%, 0 54%)",
        ...style,
      }}
    />
  );
  if (kind === "thumbtack") return <div style={{ position: "absolute", top: -34 * u, left: "50%", marginLeft: -48 * u }}><InkIcon kind="thumbtack" size={96 * u} /></div>;
  if (kind === "paperclip") return <div style={{ position: "absolute", top: -70 * u, left: 90 * u, transform: "rotate(-8deg)" }}><InkIcon kind="paperclip" size={150 * u} /></div>;
  if (kind === "tape") return tape({ top: -16 * u, left: "50%", marginLeft: -75 * u, transform: "rotate(-3deg)" });
  return (
    <>
      {tape({ top: -6 * u, left: -40 * u, transform: "rotate(-34deg)" })}
      {tape({ top: -6 * u, right: -40 * u, transform: "rotate(34deg)" })}
    </>
  );
};

/** (A) A pinned index card: number in ink, a red-pen loop around it, a handwritten note. */
const StatCard: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const st = d.stat!;
  const p = prog(frame, 0, 20);
  const note = prog(frame, cue(d.highlight ?? d.sub, 50, 0), 16);
  const W = (vertical ? 900 : 1100) * u;
  return (
    <Stage dir="column" gap={30}>
      <Sheet
        variant={d.paper ?? DOC.paperStyle}
        seed={3}
        padding={`${70 * u}px ${70 * u}px ${56 * u}px`}
        style={{
          width: W,
          transform: `translateY(${(1 - p) * 90 * u}px) rotate(${-1.5 * p}deg)`,
          opacity: p,
        }}
      >
        {/* faded ruled lines and margin of an old index card */}
        <div style={{ position: "absolute", inset: `${16 * u}px`, zIndex: -1, backgroundImage: `repeating-linear-gradient(transparent 0 ${58 * u}px, rgba(90,110,130,0.16) ${58 * u}px ${60 * u}px)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 16 * u, bottom: 16 * u, left: 54 * u, width: 2 * u, background: "rgba(170,60,40,0.3)" }} />
        <Pin kind={d.pin ?? DOC.pinStyle} />
        {(d.india || d.kicker) && (
          <div style={{ display: "flex", gap: 16 * u, alignItems: "center", marginBottom: 10 * u }}>
            {d.india && <IndiaTag start={0} />}
            {d.kicker && <Kicker>{d.kicker}</Kicker>}
          </div>
        )}
        <div style={{ position: "relative", display: "inline-block", padding: `0 ${24 * u}px` }}>
          <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 190 : 220) * u, lineHeight: 1, color: DOC.ink }}>
            <StatNumber st={st} start={6} />
          </div>
          <PenLoop {...numberBox(st, (vertical ? 190 : 220) * u)} start={cue(st.cue, 6) + 24} />
        </div>
        <div style={{ ...labelText(u), marginTop: 16 * u }}>{st.label}</div>
        {d.sub && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 * u, marginTop: 14 * u, marginLeft: 30 * u, opacity: note, transform: "rotate(-2deg)", transformOrigin: "left center" }}>
            <svg width={70 * u} height={40 * u} viewBox="0 0 70 40" style={{ overflow: "visible", transform: "scaleY(-1)" }}>
              <path d="M66,8 C44,2 22,10 6,32 M6,32 L8,18 M6,32 L20,30" stroke={DOC.accent} strokeWidth={3} fill="none" strokeLinecap="round" />
            </svg>
            <div style={{ fontFamily: DOC.fonts.hand, fontWeight: 700, fontSize: (vertical ? 44 : 50) * u, color: DOC.accent, maxWidth: 820 * u, lineHeight: 1 }}>{d.sub}</div>
          </div>
        )}
      </Sheet>
    </Stage>
  );
};

/** (B) A newspaper clipping: the source as masthead, the number as the headline. */
const StatClipping: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const st = d.stat!;
  const p = prog(frame, 0, 22);
  const torn = Array.from({ length: 24 }, (_, i) => `${100 - (i / 23) * 100}% ${95 + ((i * 37) % 7) * 0.7}%`).join(",");
  return (
    <Stage dir="column" gap={30}>
      <div
        style={{
          position: "relative",
          width: (vertical ? 920 : 1250) * u,
          filter: paperShadow(u),
          padding: `${40 * u}px ${56 * u}px ${74 * u}px`,
          transform: `translateY(${(1 - p) * 100 * u}px) rotate(${1.2 * p}deg)`,
          opacity: p,
        }}
      >
        <TornSheetBg />
        <div style={{ position: "relative", textAlign: "center", fontFamily: DOC.fonts.headline, fontSize: 46 * u, color: DOC.ink, borderBottom: `${4 * u}px double ${DOC.ink}`, paddingBottom: 8 * u }}>{d.source ?? "The Daily Ledger"}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: DOC.fonts.mono, fontSize: 18 * u, color: DOC.inkSoft, padding: `${8 * u}px 0`, borderBottom: `${1.5 * u}px solid ${DOC.ink}`, marginBottom: 24 * u }}>
          <span>{d.india ? "INDIA EDITION" : "FINANCE"}</span>
          <span>{d.kicker ?? ""}</span>
        </div>
        <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 120 : 150) * u, lineHeight: 0.95, color: DOC.ink, textAlign: "center" }}>
          <StatNumber st={st} />
        </div>
        <div style={{ fontFamily: DOC.fonts.serif, fontWeight: 600, fontSize: (vertical ? 46 : 52) * u, lineHeight: 1.15, color: DOC.ink, textAlign: "center", marginTop: 14 * u }}>{st.label}</div>
        {d.sub && (
          <div style={{ fontFamily: DOC.fonts.serif, fontStyle: "italic", fontSize: 32 * u, color: DOC.inkSoft, textAlign: "center", marginTop: 16 * u }}>
            <Marked text={d.sub} highlight={d.highlight ?? d.sub} start={50} />
          </div>
        )}
      </div>
    </Stage>
  );
};

/** (C) The number beside a big engraved object that pops in and grows as the number counts. */
const StatObject: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const st = d.stat!;
  const grow = prog(frame, 4, 44);
  const size = (vertical ? 420 : 460) * u;
  return (
    <Stage gap={vertical ? 30 : 80}>
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${interpolate(grow, [0, 1], [0.55, 1])}) rotate(${interpolate(grow, [0, 1], [-6, -2])}deg)`, opacity: prog(frame, 0, 10) }}>
        <InkIcon kind={st.object ?? "coin"} size={size * 0.8} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 * u, alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "left", maxWidth: 760 * u }}>
        {d.india && <IndiaTag start={0} />}
        {d.kicker && <Kicker color={DOC.accent}>{d.kicker}</Kicker>}
        <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 200 : 230) * u, lineHeight: 0.95, color: DOC.accent }}>
          <StatNumber st={st} />
        </div>
        <div style={{ ...labelText(u) }}>{st.label}</div>
        {d.sub && <div style={{ ...subText(u) }}>{d.sub}</div>}
      </div>
    </Stage>
  );
};

/** Ten engraved people; the share that applies is in full ink with a red underline, the rest faded. */
const PeopleRow: React.FC<{ value: number; start: number }> = ({ value, start }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const on = Math.round(value / 10);
  const size = (vertical ? 86 : 100) * u;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${vertical ? 5 : 5}, ${size}px)`, gap: `${26 * u}px ${18 * u}px` }}>
      {Array.from({ length: 10 }, (_, i) => {
        const o = prog(frame, start + i * 3, 10);
        const lit = i < on && frame >= start + 24 + i * 4;
        return (
          <div key={i} style={{ opacity: o * (lit ? 1 : 0.32), filter: lit ? undefined : "grayscale(1)" }}>
            <InkIcon kind="person" size={size} color={lit ? DOC.accent : DOC.ink} />
          </div>
        );
      })}
    </div>
  );
};

/** Two engraved coin stacks sized by share: [the value's side, the rest]. The percentage sits
 *  right on top of each stack and the label clear below it; the stacks share one baseline. */
const CoinStacks: React.FC<{ value: number; split?: [string, string]; start: number }> = ({ value, split, start }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const MIN = 70 * u;
  const MAX = (vertical ? 260 : 280) * u;
  const parts = [
    { label: split?.[0] ?? "", v: value, accent: true },
    { label: split?.[1] ?? "", v: 100 - value, accent: false },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 60 * u }}>
      {parts.map((p, i) => {
        const g = prog(frame, start + i * 10, 30);
        const size = (MIN + (MAX - MIN) * (p.v / 100)) * interpolate(g, [0, 1], [0.6, 1]);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 230 * u }}>
            {/* one bottom-aligned box per stack: the percentage rides directly on top of the coins */}
            <div style={{ width: MAX, height: MAX + 70 * u, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
              <div style={{ fontFamily: DOC.fonts.headline, fontSize: 44 * u, lineHeight: 1, color: p.accent ? DOC.accent : DOC.inkSoft, opacity: g, marginBottom: 14 * u }}>{p.v}%</div>
              <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", opacity: Math.min(1, g * 3) }}>
                <InkIcon kind="coin" size={size * 0.8} />
              </div>
            </div>
            <div style={{ ...tagText(u), textAlign: "center", color: p.accent ? DOC.accent : DOC.inkSoft, marginTop: 30 * u }}>{p.label}</div>
          </div>
        );
      })}
    </div>
  );
};

/** The engraved balance scale: the value's side ([1]) is the heavier, lower pan. */
const ScaleSplit: React.FC<{ value: number; split?: [string, string]; start: number }> = ({ value, split, start }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const W = (vertical ? 720 : 640) * u;
  const tip = prog(frame, start + 10, 30);
  const side = (text: string, pct: number, accent: boolean, delay: number) => (
    <div style={{ width: W * 0.42, textAlign: "center", opacity: prog(frame, start + delay, 14) }}>
      <div style={{ fontFamily: DOC.fonts.headline, fontSize: 52 * u, lineHeight: 1, color: accent ? DOC.accent : DOC.inkSoft }}>{pct}%</div>
      <div style={{ ...tagText(u), color: accent ? DOC.accent : DOC.inkSoft, marginTop: 6 * u }}>{text}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * u, opacity: prog(frame, start, 12) }}>
      <div style={{ transform: `rotate(${interpolate(tip, [0, 1], [-4, 0])}deg)`, transformOrigin: "50% 30%" }}>
        <InkIcon kind="scale" size={W * 0.8} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", width: W }}>
        {side(split?.[0] ?? "", 100 - value, false, 30)}
        {side(split?.[1] ?? "", value, true, 40)}
      </div>
    </div>
  );
};

const StatLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const st = d.stat ?? { value: 0, label: "" };
  const grid = st.grid;
  const houses = 50;
  const hot = Math.max(1, Math.round(st.gridValue ?? 1));
  const icon = (vertical ? 58 : 54) * u;
  const cue = useCue();
  return (
    <Stage gap={vertical ? 40 : 100}>
      {d.photo && !grid && <SidePhoto photo={d.photo} projectPath={projectPath} />}
      {grid === "dots" && <DotGrid value={st.gridValue ?? st.value} start={6} size={560 * u} />}
      {grid === "icons" && <IconGrid kind={st.object ?? "chip"} lit={Math.round(st.gridValue ?? st.value / 10)} start={cue(st.cue, 6)} />}
      {grid === "houses" && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(10, ${icon}px)`, gap: `${(vertical ? 18 : 22) * u}px ${(vertical ? 14 : 20) * u}px` }}>
          {Array.from({ length: houses }, (_, i) => {
            const o = prog(frame, 4 + i * 0.8, 8);
            const isHot = i >= 27 && i < 27 + hot;
            return (
              <div key={i} style={{ position: "relative", opacity: isHot ? o : o * 0.55 }}>
                <InkIcon kind="house" size={icon} />
                {isHot && (
                  <>
                    <PenLoop w={icon} h={icon} start={cue(st.cue, 56)} />
                    <div style={{ position: "absolute", left: "50%", top: "100%", marginTop: 10 * u, transform: "translateX(-50%) rotate(-4deg)", whiteSpace: "nowrap", fontFamily: DOC.fonts.hand, fontWeight: 700, fontSize: 34 * u, color: DOC.accent, opacity: prog(frame, cue(st.cue, 56) + 18, 12) }}>1 in 50</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {grid === "people" && <PeopleRow value={st.gridValue ?? st.value} start={cue(st.cue, 8)} />}
      {grid === "stacks" && <CoinStacks value={st.gridValue ?? st.value} split={st.split} start={cue(st.cue, 8)} />}
      {grid === "scale" && <ScaleSplit value={st.gridValue ?? st.value} split={st.split} start={cue(st.cue, 8)} />}
      <div style={{ display: "flex", flexDirection: "column", alignItems: vertical || !(grid || d.photo) ? "center" : "flex-start", gap: 12 * u, textAlign: vertical || !(grid || d.photo) ? "center" : "left" }}>
        {d.india && <IndiaTag start={0} />}
        {d.kicker && <Kicker color={DOC.accent}>{d.kicker}</Kicker>}
        <div style={{ fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: (grid ? 210 : 260) * u, lineHeight: 0.95, color: DOC.accent }}>
          {st.prefix}
          <Counter to={st.value} start={6} dur={40} decimals={st.decimals} />
          {st.suffix}
        </div>
        <div style={{ ...labelText(u), maxWidth: 640 * u }}>{st.label}</div>
        {d.sub && (
          <div style={{ ...subText(u), maxWidth: 640 * u }}>
            <Marked text={d.sub} highlight={d.highlight} start={60} />
          </div>
        )}
      </div>
    </Stage>
  );
};

const StatementLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const { u, vertical } = useLayout();
  if (d.photo) {
    return (
      <Stage gap={vertical ? 40 : 80}>
        <SidePhoto photo={d.photo} projectPath={projectPath} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 * u, alignItems: vertical ? "center" : "flex-start", maxWidth: (vertical ? 900 : 760) * u }}>
          {d.india && <IndiaTag start={0} />}
          {d.kicker && <Kicker>{d.kicker}</Kicker>}
          <Headline size={vertical ? 80 : 84}>
            <Marked text={d.text ?? ""} highlight={d.highlight} start={30} />
          </Headline>
          {d.sub && <div style={{ ...subText(u) }}>{d.sub}</div>}
        </div>
      </Stage>
    );
  }
  return (
    <Stage dir="column" gap={24}>
      {d.india && <IndiaTag start={0} />}
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ maxWidth: (vertical ? 920 : 1450) * u }}>
        <Headline size={vertical ? 96 : 110} align="center">
          <Marked text={d.text ?? ""} highlight={d.highlight} start={30} />
        </Headline>
      </div>
      {d.sub && <div style={{ ...subText(u), textAlign: "center", maxWidth: 1100 * u }}>{d.sub}</div>}
    </Stage>
  );
};

const ShareBar: React.FC<{ bars: NonNullable<DocSpec["bars"]>; start: number }> = ({ bars, start }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const p = prog(frame, start, 30);
  const fills = [DOC.ink, DOC.data, DOC.paperShade];
  return (
    <div style={{ display: "flex", width: "100%", height: 54 * u, border: `${2 * u}px solid ${DOC.ink}` }}>
      {bars.map((b, i) => (
        <div key={b.label} style={{ width: `${b.value * p}%`, background: b.accent ? DOC.accent : fills[i % 3], color: i % 3 === 2 && !b.accent ? DOC.ink : DOC.paper, fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 22 * u, display: "flex", alignItems: "center", paddingLeft: 12 * u, overflow: "hidden", whiteSpace: "nowrap" }}>
          {b.display ?? b.label}
        </div>
      ))}
    </div>
  );
};

/** Where a full-bleed map fits its view, and where the paper card with the text sits. */
const mapFrame = (vertical: boolean, withCard: boolean) =>
  !withCard
    ? { region: { x: 0.06, y: vertical ? 0.14 : 0.1, w: 0.88, h: vertical ? 0.6 : 0.8 }, card: null }
    : vertical
      ? { region: { x: 0.04, y: 0.1, w: 0.92, h: 0.42 }, card: { left: 0.05, top: 0.55, width: 0.9 } }
      : { region: { x: 0.03, y: 0.08, w: 0.56, h: 0.84 }, card: { left: 0.6, top: 0.5, width: 0.36 } };

/** A paper card stuck onto a full-bleed map (taped, slightly tilted), holding the scene's text. */
const MapCard: React.FC<{ box: { left: number; top: number; width: number }; children: React.ReactNode }> = ({ box, children }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, u, vertical } = useLayout();
  const p = prog(frame, 10, 20);
  return (
    <div
      style={{
        position: "absolute",
        left: W * box.left,
        top: H * box.top,
        width: W * box.width,
        transform: `translateY(${vertical ? 0 : "-50%"}) translateY(${(1 - p) * 60 * u}px) rotate(${1.2 * p}deg)`,
        opacity: p,
          filter: paperShadow(u),
        padding: `${34 * u}px ${40 * u}px`,
        display: "flex",
        flexDirection: "column",
        gap: 16 * u,
        alignItems: "flex-start",
      }}
    >
      <TornSheetBg />
      <div style={{ position: "absolute", top: -14 * u, left: "50%", width: 130 * u, height: 32 * u, marginLeft: -65 * u, background: "rgba(230,215,175,0.8)", transform: "rotate(-3deg)" }} />
      {children}
    </div>
  );
};

const MapLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const { width: W, height: H, u, vertical } = useLayout();
  const panel = !!(d.text || d.logos || d.bars || d.india || d.kicker);
  const f = mapFrame(vertical, panel);
  return (
    <AbsoluteFill>
      {d.map && <AtlasMap view={d.map.view} focus={d.map.focus} lit={d.map.lit} marks={d.map.marks} w={W} h={H} region={f.region} start={0} tilt={-1.5} />}
      {f.card && (
        <MapCard box={f.card}>
          {d.india && <IndiaTag start={0} />}
          {d.kicker && <Kicker>{d.kicker}</Kicker>}
          {d.text && <Headline size={vertical ? 64 : 60} align="left">{d.text}</Headline>}
          {d.sub && <div style={{ ...subText(u) }}>{d.sub}</div>}
          {d.logos && <Logos logos={d.logos} size={170} start={30} projectPath={projectPath} />}
          {d.bars && <ShareBar bars={d.bars} start={50} />}
        </MapCard>
      )}
    </AbsoluteFill>
  );
};

/** Horizontal comparison bars ("FedNow, all of 2025" vs "UPI, one day"). */
const BarsLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const bars = d.bars ?? [];
  const max = Math.max(...bars.map((b) => b.value), 1);
  const W = (vertical ? 860 : 1300) * u;
  return (
    <Stage dir="column" gap={30}>
      <div style={{ width: W, display: "flex", flexDirection: "column", gap: 18 * u, alignItems: "flex-start" }}>
        {d.india && <IndiaTag start={0} />}
        {d.text && <Headline size={vertical ? 72 : 80} align="left">{d.text}</Headline>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 * u, width: W }}>
        {bars.map((b, i) => {
          const p = prog(frame, cue(b.cue, 16 + i * 14), 30);
          return (
            <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: 8 * u }}>
              <Kicker size={22}>{b.label}</Kicker>
              <div style={{ display: "flex", alignItems: "center", gap: 18 * u }}>
                <div style={{ height: 56 * u, width: Math.max(4 * u, (W - 260 * u) * (b.value / max) * p), background: b.accent ? DOC.accent : DOC.data }} />
                <div style={{ fontFamily: DOC.fonts.headline, fontSize: 52 * u, color: b.accent ? DOC.accent : DOC.ink, opacity: p, whiteSpace: "nowrap" }}>{b.display ?? b.value.toLocaleString("en-US")}</div>
              </div>
            </div>
          );
        })}
      </div>
      {d.sub && <div style={{ ...subText(u), textAlign: "center" }}>{d.sub}</div>}
    </Stage>
  );
};

/** A red-pen tick that draws itself (the "good" counterpart of PenCross). */
const PenTick: React.FC<{ start: number; size: number }> = ({ start, size }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, start, 12);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", right: -size * 0.15, bottom: -size * 0.1, overflow: "visible" }}>
      <path d="M8,56 C18,62 28,74 36,88 C50,58 70,30 96,8" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} stroke={DOC.accent} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
};

/** "One option among many": the bank front in the middle, the new players' logos stuck around it. */
const ConstellationLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, u, vertical } = useLayout();
  const logos = d.logos ?? [];
  const bankW = (vertical ? 300 : 340) * u;
  const rx = (vertical ? 400 : 640) * u;
  const ry = (vertical ? 480 : 250) * u;
  const cx = W / 2;
  const cy = H * (vertical ? 0.43 : 0.42);
  const bankIn = prog(frame, 0, 16);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: cx - bankW / 2, top: cy - bankW * 0.62, opacity: bankIn, transform: `scale(${interpolate(bankIn, [0, 1], [0.9, 1])})` }}>
        <InkIcon kind="bank" size={bankW} />
      </div>
      {logos.map((l, i) => {
        const a = (i / logos.length) * Math.PI * 2 - Math.PI / 2 + 0.3;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        const t0 = 10 + i * 6;
        return (
          <div key={l.name} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${((i * 37) % 9) - 4}deg)` }}>
            <LogoBadge name={l.name} src={l.src ? assetPath(l.src, projectPath) : undefined} zoom={l.zoom} color={l.color ?? DOC.ink} size={(vertical ? 200 : 210) * u} start={t0} />
          </div>
        );
      })}
      {(d.kicker || d.text) && (
        <div style={{ position: "absolute", left: 0, right: 0, top: H * (vertical ? 0.74 : 0.79), display: "flex", justifyContent: "center", opacity: prog(frame, 30, 16) }}>
          <div style={{ ...labelText(u), fontSize: 50 * u, textAlign: "center" }}>
            <Marked text={d.text ?? d.kicker ?? ""} highlight={d.highlight} start={40} />
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** The closing question: the bank and the phone, a big red-pen question mark between them. */
const QuestionLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const q = prog(frame, cue(d.highlight, 30, 6), 14);
  const art = (vertical ? 220 : 260) * u;
  return (
    <Stage dir="column" gap={40}>
      <div style={{ display: "flex", alignItems: "center", gap: (vertical ? 30 : 80) * u, opacity: prog(frame, 0, 16) }}>
        <InkIcon kind="bank" size={art} />
        <div style={{ fontFamily: DOC.fonts.hand, fontWeight: 700, fontSize: (vertical ? 220 : 260) * u, lineHeight: 0.8, color: DOC.accent, opacity: q, transform: `scale(${interpolate(q, [0, 1], [1.4, 1])}) rotate(-6deg)` }}>?</div>
        <InkIcon kind="smartphone" size={art} />
      </div>
      <div style={{ maxWidth: (vertical ? 920 : 1500) * u }}>
        <Headline size={vertical ? 80 : 88} align="center" start={6}>
          <Marked text={d.text ?? ""} highlight={d.highlight} start={40} />
        </Headline>
      </div>
    </Stage>
  );
};

/** Cold open: the bank, money pouring onto its steps, the year's profit landing on its word. */
const OpenerLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const st = d.stat ?? { value: 0, label: "" };
  const W = (vertical ? 760 : 940) * u;
  const bankH = W * (543 / 922);
  const numAt = cue(st.cue, 70);
  // engraved coins and cash bundles falling onto the steps, settling into a loose pile
  const drops = Array.from({ length: 16 }, (_, i) => {
    const r = (k: number) => {
      const x = Math.sin(i * 91.7 + k * 13.3) * 43758.5453;
      return x - Math.floor(x);
    };
    const t0 = 4 + i * 3.2;
    const p = prog(frame, t0, 18);
    const x = W * (0.12 + r(1) * 0.76);
    const restY = bankH - (r(2) * 0.08 + 0.02) * bankH - Math.floor(i / 6) * 22 * u;
    const y = interpolate(p, [0, 1], [-bankH * 0.9 - r(3) * 200 * u, restY], { extrapolateRight: "clamp" });
    const bounce = p >= 1 ? 0 : 0;
    return { kind: (i % 3 === 0 ? "cash" : "coin") as DocIcon, x, y: y + bounce, rot: interpolate(p, [0, 1], [r(4) * 160 - 80, r(5) * 30 - 15]), size: (i % 3 === 0 ? 130 : 100) * u, o: prog(frame, t0, 4) };
  });
  const n = prog(frame, numAt, 12);
  return (
    <Stage gap={vertical ? 60 : 90}>
      <div style={{ position: "relative", width: W, height: bankH + 40 * u }}>
        <BankArt width={W} />
        {drops.map((dp, i) => (
          <div key={i} style={{ position: "absolute", left: dp.x - dp.size / 2, top: dp.y - dp.size / 2, opacity: dp.o, transform: `rotate(${dp.rot}deg)` }}>
            <InkIcon kind={dp.kind} size={dp.size} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 * u, alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "left", maxWidth: 620 * u }}>
        {d.kicker && <Kicker>{d.kicker}</Kicker>}
        <div style={{ position: "relative", display: "inline-block", opacity: n, transform: `scale(${interpolate(n, [0, 0.7, 1], [1.5, 0.96, 1])})`, transformOrigin: vertical ? "center" : "left center" }}>
          <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 200 : 230) * u, lineHeight: 1, color: DOC.accent }}>
            <StatNumber st={st} start={numAt} />
          </div>
          <PenLoop {...numberBox(st, (vertical ? 200 : 230) * u)} start={numAt + 20} />
        </div>
        <div style={{ ...labelText(u), opacity: prog(frame, numAt + 8, 12) }}>{st.label}</div>
      </div>
    </Stage>
  );
};

/** End card: the players from the video stuck around the page, the question, comments + subscribe. */
const EndCard: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const channel = useContext(ChannelCtx);
  const { width: W, height: H, u, vertical } = useLayout();
  const logos = d.logos ?? [];
  // logos in two loose rows across the top half (16:9) or the top third (9:16)
  const cols = vertical ? 4 : Math.ceil(logos.length / 2);
  const comments = prog(frame, cue("comments", 24, 6), 14);
  const sub = prog(frame, cue("subscribe", 30, 6), 12);
  return (
    <AbsoluteFill>
      {logos.map((l, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const n = Math.min(cols, logos.length - row * cols);
        const x = W * ((col + 0.5) / n) * 0.84 + W * 0.08;
        const y = H * ((vertical ? 0.15 : 0.15) + row * (vertical ? 0.085 : 0.17));
        return (
          <div key={l.name} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${((i * 53) % 9) - 4}deg)` }}>
            <LogoBadge name={l.name} src={l.src ? assetPath(l.src, projectPath) : undefined} zoom={l.zoom} color={l.color ?? DOC.ink} size={(vertical ? 160 : 180) * u} start={4 + i * 4} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: H * (vertical ? 0.43 : 0.5), padding: `0 ${50 * u}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 * u }}>
        <Headline size={vertical ? 76 : 100} align="center" start={10}>
          <Marked text={d.text ?? ""} highlight={d.highlight} start={30} />
        </Headline>
        {d.sub && (
          <div style={{ display: "flex", alignItems: "center", gap: 16 * u, opacity: comments, transform: `translateY(${(1 - comments) * 12 * u}px)` }}>
            <InkIcon kind="sms" size={70 * u} />
            <div style={{ fontFamily: DOC.fonts.hand, fontWeight: 700, fontSize: 52 * u, color: DOC.accent }}>{d.sub}</div>
          </div>
        )}
        {channel && (
          <div style={{ marginTop: 18 * u }}>
            <ChannelBlock channel={channel} start={cue("subscribe", 16, 18)} />
          </div>
        )}
        <div style={{ marginTop: 10 * u, fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 32 * u, letterSpacing: 4 * u, color: DOC.paper, background: DOC.accent, padding: `${14 * u}px ${34 * u}px`, opacity: sub, transform: `scale(${interpolate(sub, [0, 0.7, 1], [0.8, 1.05, 1])})` }}>SUBSCRIBE</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------- shared extras ----------------

/** A taped photo print that sits beside a layout's content (stat / statement / logos / flow). */
const SidePhoto: React.FC<{ photo: DocPhoto; projectPath: string; start?: number }> = ({ photo, projectPath, start = 0 }) => {
  const { u, vertical } = useLayout();
  const w = (vertical ? 760 : 640) * u;
  const h = (vertical ? 500 : 460) * u;
  return (
    <div style={{ position: "relative", width: w, height: h, flexShrink: 0 }}>
      <PhotoPrint label={photo.label ?? ""} src={assetPath(photo.src, projectPath)} credit={photo.credit} w={w} h={h} x={w / 2} y={h / 2} rot={-3} start={start} from="left" />
    </div>
  );
};

/** A rubber stamp slammed onto the thing it marks ("HALTED", "SHUT", "STOP"). `at` is its centre
 *  as fractions of the frame (one value per ratio); default: upper right of the content. */
const StampOnCue: React.FC<{ d: DocSpec }> = ({ d }) => {
  const cue = useCue();
  return <Stamp text={d.stamp ?? ""} at={d.stampAt} start={cue(d.stampCue, 40, 0)} />;
};

const Stamp: React.FC<{ text: string; at?: { h?: [number, number]; v?: [number, number] }; start?: number }> = ({ text, at, start = 40 }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, u, vertical } = useLayout();
  const p = prog(frame, start, 8);
  if (p <= 0) return null;
  const [x, y] = (vertical ? at?.v : at?.h) ?? (vertical ? [0.7, 0.3] : [0.74, 0.3]);
  return (
    <div style={{ position: "absolute", left: W * x, top: H * y, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
      <div
        style={{
          border: `${4 * u}px solid ${DOC.accent}`,
          color: DOC.accent,
          fontFamily: DOC.fonts.label,
          fontWeight: DOC.labelWeight,
          fontSize: (vertical ? 44 : 48) * u,
          letterSpacing: 5 * u,
          padding: `${2 * u}px ${16 * u}px`,
          transform: `rotate(-9deg) scale(${interpolate(p, [0, 1], [1.8, 1])})`,
          opacity: 0.9 * p,
          mixBlendMode: "multiply",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ---------------- more layouts ----------------

/** The series device, drawn with the bank illustration. intro: the four pillars drop in one by
 *  one · take: one pillar lifts, turns red and is carried off · standing: the bank front still
 *  stands with every pillar gone. */
const PillarsLayout: React.FC<{ d: DocSpec }> = ({ d }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const pl = d.pillars ?? { mode: "intro" as const };
  const W = (vertical ? 760 : 820) * u;
  const gap = (vertical ? 20 : 34) * u; // extra space between the pillars
  const taken = pl.mode === "standing" ? [0, 1, 2, 3] : (pl.taken ?? []);
  // intro: each pillar drops in when the narrator names its job (else one by one)
  const introAt = (i: number) => cue(pl.cues?.[i], 8 + i * 16, 2);
  const look = (i: number): PillarLook => {
    if (taken.includes(i)) return { ghost: true };
    if (pl.mode === "intro") {
      const a = prog(frame, introAt(i), 16);
      return { opacity: a, dy: (1 - a) * -80 * u, accent: a > 0 && a < 1 };
    }
    if (pl.mode === "wobble" && pl.take === i) {
      // the first sign of trouble: one pillar shudders, then settles slightly askew
      const t0 = cue(pl.cues?.[0], 24, 0);
      const t = frame - t0;
      const decay = t < 0 ? 0 : Math.max(0, 1 - t / 40);
      return { rot: t < 0 ? 0 : Math.sin(t / 2.2) * 5 * decay + 2.5 * prog(frame, t0, 30), dx: t < 0 ? 0 : Math.sin(t / 2.2) * 4 * u * decay };
    }
    if (pl.mode === "take" && pl.take === i) {
      const lift = prog(frame, 20, 20);
      const away = prog(frame, 44, 30);
      const out = i < 2 ? -1 : 1; // carried off outward, away from the bank front
      return { accent: true, dy: -lift * 40 * u - away * 120 * u, dx: out * away * W * 0.45, rot: out * away * 14, opacity: 1 - away };
    }
    return {};
  };
  const bankIn = prog(frame, 0, 18);
  return (
    <Stage dir="column" gap={26}>
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ position: "relative", opacity: bankIn }}>
        {pl.mode === "take" && pl.take !== undefined && (
          // the faded pillar that stays behind once the real one is carried off
          <div style={{ position: "absolute", inset: 0, opacity: prog(frame, 50, 20) }}>
            <BankArt width={W} gap={gap} bankOpacity={0} look={(i) => (i === pl.take ? { ghost: true } : { opacity: 0 })} />
          </div>
        )}
        <BankArt width={W} gap={gap} look={look} />
        {/* the job each pillar stands for */}
        {PILLARS.map((name, i) => {
          const isTake = pl.mode === "take" && pl.take === i;
          const gone = taken.includes(i);
          const a = pl.mode === "intro" ? prog(frame, introAt(i), 16) : 1;
          return (
            <div
              key={name}
              style={{
                position: "absolute",
                left: pillarCenter(i, W, gap) - 120 * u,
                width: 240 * u,
                top: "100%",
                marginTop: 14 * u,
                textAlign: "center",
                fontFamily: DOC.fonts.label,
                fontWeight: DOC.labelWeight,
                fontSize: (vertical ? 22 : 24) * u,
                letterSpacing: 2 * u,
                textTransform: "uppercase",
                color: isTake ? DOC.accent : gone ? DOC.inkSoft : DOC.ink,
                textDecoration: gone ? "line-through" : undefined,
                opacity: a,
              }}
            >
              {name}
            </div>
          );
        })}
      </div>
      {d.text && (
        <div style={{ marginTop: 56 * u, maxWidth: (vertical ? 900 : 1500) * u }}>
          <Headline size={vertical ? 60 : 62} align="center" start={30}>
            <Marked text={d.text} highlight={d.highlight} start={50} />
          </Headline>
        </div>
      )}
    </Stage>
  );
};

/** A paper clipping: masthead, a quoted line with a highlighter sweep, torn bottom edge. */
const DocumentLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const p = prog(frame, 0, 22);
  // torn bottom edge, walked right → left so the polygon closes back to the top-left corner
  const torn = Array.from({ length: 24 }, (_, i) => `${100 - (i / 23) * 100}% ${95 + ((i * 37) % 7) * 0.7}%`).join(",");
  return (
    <Stage dir="column" gap={30}>
      {d.india && <IndiaTag start={0} />}
      <div
        style={{
          position: "relative",
          width: (vertical ? 900 : 1200) * u,
          filter: paperShadow(u),
          padding: `${46 * u}px ${60 * u}px ${70 * u}px`,
          transform: `translateY(${(1 - p) * 120 * u}px) rotate(${-1.4 * p}deg)`,
          opacity: p,
        }}
      >
        <TornSheetBg />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `${3 * u}px solid ${DOC.ink}`, paddingBottom: 12 * u, marginBottom: 26 * u, gap: 20 * u }}>
          <Kicker size={24} color={DOC.ink}>{d.kicker ?? "Document"}</Kicker>
          {d.logos?.[0] && <LogoBadge name={d.logos[0].name} src={d.logos[0].src ? assetPath(d.logos[0].src, projectPath) : undefined} zoom={d.logos[0].zoom} color={d.logos[0].color ?? DOC.ink} size={180 * u} start={6} />}
        </div>
        <div style={{ fontFamily: DOC.fonts.serif, fontSize: (vertical ? 58 : 64) * u, lineHeight: 1.3, color: DOC.ink }}>
          <Marked text={d.text ?? ""} highlight={d.highlight} start={34} />
        </div>
        {d.sub && <div style={{ marginTop: 22 * u, fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: 28 * u, color: DOC.inkSoft }}>{d.sub}</div>}
      </div>
    </Stage>
  );
};

/** Nodes (icons or logos) joined by drawing arrows: how money or control moves. */
const FlowLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { u, vertical } = useLayout();
  const nodes = d.nodes ?? [];
  const stack = vertical && nodes.length > 3;
  const starts = orderedStarts(nodes.map((n, i) => cue(n.cue, 10 + i * 18)), 14);
  const icon = (stack ? 120 : vertical ? 120 : 150) * u;
  return (
    <Stage dir="column" gap={40}>
      {d.india && <IndiaTag start={0} />}
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      {d.text && (
        <div style={{ maxWidth: (vertical ? 900 : 1400) * u }}>
          <Headline size={vertical ? 72 : 80} align="center">
            <Marked text={d.text} highlight={d.highlight} start={40} />
          </Headline>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: stack ? "column" : "row", alignItems: "center" }}>
        {nodes.map((n, i) => {
          const t0 = starts[i];
          const o = prog(frame, t0, 14);
          return (
            <div key={n.label} style={{ display: "flex", flexDirection: stack ? "column" : "row", alignItems: "center" }}>
              <div style={{ width: (stack ? 520 : vertical ? 240 : 280) * u, display: "flex", flexDirection: stack ? "row" : "column", alignItems: "center", gap: 24 * u, opacity: o, transform: `translateY(${(1 - o) * 14 * u}px)` }}>
                {n.logo ? (
                  <LogoBadge name={n.logo.name} src={n.logo.src ? assetPath(n.logo.src, projectPath) : undefined} zoom={n.logo.zoom} color={n.logo.color ?? DOC.ink} size={icon * 1.3} start={t0} />
                ) : (
                  <InkIcon kind={n.icon ?? "coin"} size={icon} color={n.accent ? DOC.accent : DOC.ink} />
                )}
                {!(n.logo && norm(n.label) === norm(n.logo.name)) && (
                  <div style={{ ...tagText(u), color: n.accent ? DOC.accent : DOC.ink, textAlign: stack ? "left" : "center", lineHeight: 1.1 }}>{n.label}</div>
                )}
              </div>
              {i < nodes.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: stack ? 70 * u : icon, padding: stack ? 0 : `0 ${6 * u}px` }}>
                  <FlowArrow start={starts[i + 1] - 10} length={(stack ? 60 : vertical ? 40 : 70) * u} vertical={stack} seed={i + 1} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {d.sub && <div style={{ ...subText(u), textAlign: "center", maxWidth: 1200 * u }}>{d.sub}</div>}
    </Stage>
  );
};

/** Two sides face off: icon / logo, title, line underneath. */
const VersusLayout: React.FC<{ d: DocSpec; projectPath: string }> = ({ d, projectPath }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const vs = prog(frame, 20, 12);
  const side = (sd: DocSide, i: number) => {
    const o = prog(frame, i * 16, 16);
    return (
      <div style={{ width: (vertical ? 860 : 620) * u, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u, opacity: o, transform: `translateX(${(1 - o) * (i ? 60 : -60) * u}px)` }}>
        {sd.logo ? (
          <LogoBadge name={sd.logo.name} src={sd.logo.src ? assetPath(sd.logo.src, projectPath) : undefined} zoom={sd.logo.zoom} color={sd.logo.color ?? DOC.ink} size={260 * u} start={i * 16} />
        ) : sd.icon ? (
          <InkIcon kind={sd.icon} size={(vertical ? 150 : 180) * u} color={sd.accent ? DOC.accent : DOC.ink} />
        ) : null}
        {sd.title && <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 80 : 88) * u, color: sd.accent ? DOC.accent : DOC.ink, textAlign: "center", lineHeight: 1.05 }}>{sd.title}</div>}
        {sd.sub && <div style={{ ...subText(u), textAlign: "center", maxWidth: 560 * u }}>{sd.sub}</div>}
      </div>
    );
  };
  return (
    <Stage dir="column" gap={30}>
      {d.india && <IndiaTag start={0} />}
      {d.kicker && <Kicker>{d.kicker}</Kicker>}
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: (vertical ? 24 : 50) * u }}>
        {d.versus && side(d.versus.left, 0)}
        <div style={{ fontFamily: DOC.fonts.headline, fontStyle: "italic", fontSize: 90 * u, color: DOC.accent, opacity: vs, transform: `scale(${interpolate(vs, [0, 1], [1.6, 1])})` }}>vs</div>
        {d.versus && side(d.versus.right, 1)}
      </div>
    </Stage>
  );
};

/** Minimal cover (project.cover.art = "object"): one engraved object and a few big words, lots of
 *  paper around them. The highlight words are set in red, nothing else competes. Static. */
const MinimalCover: React.FC<{ project: Project }> = ({ project }) => {
  const { u, vertical } = useLayout();
  const c = project.cover ?? { text: project.title };
  const hit = !!c.highlight && c.text.includes(c.highlight);
  const art = (vertical ? 500 : 460) * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: (vertical ? 50 : 80) * u, padding: `${(vertical ? 200 : 90) * u}px ${(vertical ? 60 : 110) * u}px` }}>
      <div style={{ transform: "rotate(-4deg)", flexShrink: 0 }}>
        <InkIcon kind={c.object ?? "chip"} size={art} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 * u, alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "left", maxWidth: (vertical ? 980 : 900) * u }}>
        {c.kicker && <div style={{ ...tagText(u), fontSize: 30 * u, color: DOC.accent, letterSpacing: 4 * u }}>{c.kicker}</div>}
        <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 112 : 96) * u, lineHeight: 0.98, color: DOC.ink }}>
          {hit ? c.text.split(c.highlight!)[0] : c.text}
          {hit && <span style={{ color: DOC.accent, backgroundImage: `linear-gradient(${DOC.highlight}, ${DOC.highlight})`, backgroundSize: "100% 40%", backgroundPosition: "0 85%", backgroundRepeat: "no-repeat" }}>{c.highlight}</span>}
          {hit && c.text.split(c.highlight!).slice(1).join(c.highlight!)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The video's cover / thumbnail (Export renders one still in coverMode): the bank with one pillar
 *  being pulled away and money on its steps, plus the title in big type. Static: nothing animates. */
export const DocCover: React.FC<{ project: Project }> = ({ project }) => {
  const { u, vertical } = useLayout();
  const c = project.cover ?? { text: project.title };
  if (c.art === "object") return <MinimalCover project={project} />;
  const W = (vertical ? 860 : 820) * u;
  const k = W / 922;
  const pile = Array.from({ length: 11 }, (_, i) => ({
    kind: (i % 3 === 0 ? "cash" : "coin") as DocIcon,
    x: W * (0.1 + ((i * 0.37) % 1) * 0.8),
    y: 543 * k - (i % 2 ? 40 : 10) * u,
    rot: ((i * 47) % 30) - 15,
    size: (i % 3 === 0 ? 150 : 115) * u,
  }));
  const title = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 * u, alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "left", maxWidth: (vertical ? 980 : 860) * u }}>
      {c.kicker && <div style={{ ...tagText(u), fontSize: 30 * u, color: DOC.accent, letterSpacing: 4 * u }}>{c.kicker}</div>}
      <div style={{ fontFamily: DOC.fonts.headline, fontSize: (vertical ? 132 : 128) * u, lineHeight: 0.98, color: DOC.ink }}>
        {c.highlight && c.text.includes(c.highlight) ? (
          <>
            {c.text.split(c.highlight)[0]}
            <span style={{ color: DOC.accent, backgroundImage: `linear-gradient(${DOC.highlight}, ${DOC.highlight})`, backgroundSize: "100% 40%", backgroundPosition: "0 85%", backgroundRepeat: "no-repeat" }}>{c.highlight}</span>
            {c.text.split(c.highlight).slice(1).join(c.highlight)}
          </>
        ) : (
          c.text
        )}
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: (vertical ? 70 : 60) * u, padding: `${(vertical ? 160 : 80) * u}px ${(vertical ? 60 : 110) * u}px` }}>
      {vertical && title}
      {c.art === "chips" ? <ChipCoverArt width={W} /> : (
      <div style={{ position: "relative", width: W, height: 543 * k + 60 * u, flexShrink: 0 }}>
        <BankArt width={W} look={(i) => (i === 0 ? { accent: true, dx: -26 * u, dy: -50 * u, rot: -12 } : {})} />
        {pile.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: p.x - p.size / 2, top: p.y - p.size / 2, transform: `rotate(${p.rot}deg)` }}>
            <InkIcon kind={p.kind} size={p.size} />
          </div>
        ))}
      </div>
      )}
      {!vertical && title}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10 * u, background: DOC.accent }} />
    </AbsoluteFill>
  );
};

/** One documentary scene: its layout, plus the corner chrome for the current chapter. */
export const DocScene: React.FC<Props & { chapter?: { n: number; title: string; pillar?: number; stack?: number } }> = (props) => (
  <CueWords.Provider value={props.words}>
    <DocSceneInner {...props} />
  </CueWords.Provider>
);

const DocSceneInner: React.FC<Props & { chapter?: { n: number; title: string; pillar?: number; stack?: number } }> = ({ scene, projectPath, chapter }) => {
  const fallback: DocSpec = scene.visual?.asset
    ? { layout: "photos", photos: [{ src: scene.visual.asset, credit: scene.visual.credit ?? undefined }] }
    : { layout: "statement", text: scene.onScreenText.replace(/\*/g, "") };
  const d = scene.doc ?? fallback;
  const chrome = chapter && !["title", "chapter", "end", "pillars", "constellation", "question", "stack"].includes(d.layout);
  return (
    <AbsoluteFill>
      {d.circuit && <CircuitTraces seed={scene.id} />}
      {d.layout === "title" && <TitleCard d={d} />}
      {d.layout === "chapter" && <ChapterCard d={d} />}
      {d.layout === "date" && <DateLayout d={d} />}
      {d.layout === "photos" && <PhotosLayout d={d} projectPath={projectPath} />}
      {d.layout === "logos" && <LogosLayout d={d} projectPath={projectPath} />}
      {d.layout === "crossed" && <CrossedLayout d={d} />}
      {d.layout === "stat" && !d.stat?.grid && d.stat?.style === "card" && <StatCard d={d} />}
      {d.layout === "stat" && !d.stat?.grid && d.stat?.style === "clipping" && <StatClipping d={d} />}
      {d.layout === "stat" && !d.stat?.grid && d.stat?.style === "object" && <StatObject d={d} />}
      {d.layout === "stat" && (d.stat?.grid || !d.stat?.style) && <StatLayout d={d} projectPath={projectPath} />}
      {d.layout === "statement" && <StatementLayout d={d} projectPath={projectPath} />}
      {d.layout === "map" && <MapLayout d={d} projectPath={projectPath} />}
      {d.layout === "bars" && <BarsLayout d={d} />}
      {d.layout === "end" && <EndCard d={d} projectPath={projectPath} />}
      {d.layout === "ticks" && <CrossedLayout d={d} />}
      {d.layout === "constellation" && <ConstellationLayout d={d} projectPath={projectPath} />}
      {d.layout === "question" && <QuestionLayout d={d} />}
      {d.layout === "opener" && <OpenerLayout d={d} />}
      {d.layout === "pillars" && <PillarsLayout d={d} />}
      {d.layout === "document" && <DocumentLayout d={d} projectPath={projectPath} />}
      {d.layout === "flow" && <FlowLayout d={d} projectPath={projectPath} />}
      {d.layout === "versus" && <VersusLayout d={d} projectPath={projectPath} />}
      {d.layout === "chart" && d.chart && <ChartLayout d={d} />}
      {d.layout === "stack" && <StackLayout d={d} />}
      {d.layout === "print" && <PrintLayout d={d} />}
      {d.layout === "queue" && d.queue && <QueueLayout d={d} projectPath={projectPath} />}
      {d.layout === "route" && d.route && <RouteLayout d={d} />}
      {d.layout === "receipt" && d.receipt && <ReceiptLayout d={d} />}
      {d.layout === "dollar" && d.dollars && <DollarLayout d={d} />}
      {d.layout === "stat" && !d.stat?.grid && d.stat?.style === "flap" && <StatFlap d={d} />}
      {d.stamp && <StampOnCue d={d} />}
      {d.source && d.layout !== "photos" && <Footnote text={d.source} />}
      {chrome && (
        <>
          <ChapterTag n={chapter.n} title={chapter.title} />
          {/* the bank tracker belongs to videos whose chapters carry a pillar (the banking series) */}
          {chapter.stack !== undefined && <StackTracker active={chapter.stack} />}
          {chapter.pillar !== undefined && <PillarTracker active={chapter.pillar} taken={[0, 1, 2, 3].filter((i) => chapter.pillar! < 0 || i < chapter.pillar!)} />}
        </>
      )}
    </AbsoluteFill>
  );
};

/** Chapter in force at each scene: set by "chapter" layouts, carried forward. */
export const docChapters = (project: Project) => {
  let current: { n: number; title: string; pillar?: number; stack?: number } | undefined;
  return project.scenes.map((s) => {
    if (s.doc?.layout === "chapter" && s.doc.chapter) current = s.doc.chapter;
    return current;
  });
};

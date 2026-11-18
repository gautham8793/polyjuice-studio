// Documentary template — sample: the M-Pesa beat (script rows 9–13) plus one "In India" beat
// (row 19a), to judge the look in 16:9 and 9:16. Voice + word timings come from
// library/doc-template/voice.json (Google TTS + Whisper); each beat lasts as long as its line.
// Once the look is approved these parts move into the project-driven engine.
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import {
  BeatFade,
  Caption,
  ChapterTag,
  Counter,
  DotGrid,
  Drift,
  FlowArrow,
  Highlight,
  IndiaTag,
  InkIcon,
  type InkKind,
  Kicker,
  LogoBadge,
  Paper,
  PenCross,
  PhotoPrint,
  PillarTracker,
  prog,
  SourceChip,
  useLayout,
  WordCaption,
  type Word,
} from "./parts";
import { AtlasMap } from "./maps";
import { DOC } from "./theme";

export type VoiceBeat = { file: string; seconds: number; text: string; words: Word[] };
export type DocSampleProps = { voice?: Record<string, VoiceBeat> };

const ORDER = ["date", "collage", "flow", "none", "stat", "houses", "india"] as const;
type BeatKey = (typeof ORDER)[number];
const MIN: Record<BeatKey, number> = { date: 90, collage: 120, flow: 150, none: 100, stat: 140, houses: 150, india: 160 }; // room for each beat's animation
const LEAD = 8; // frames of picture before the voice starts
const TAIL = 15; // frames held after the line ends (~0.5 s)
const FPS = 30;
export const VOICE_FILE = "library/doc-template/voice.json";

/** Beat start/length from the voice lengths (falls back to the minimums without voice). */
export const docTimeline = (voice?: Record<string, VoiceBeat>) => {
  let from = 0;
  const beats = {} as Record<BeatKey, { from: number; dur: number }>;
  for (const k of ORDER) {
    const sec = voice?.[k]?.seconds ?? 0;
    const dur = Math.max(MIN[k], Math.round(sec * FPS) + LEAD + TAIL);
    beats[k] = { from, dur };
    from += dur;
  }
  return { beats, total: from };
};
export const DOC_SAMPLE_FRAMES = docTimeline().total;

const Beat: React.FC<{ b: { from: number; dur: number }; v?: VoiceBeat; caption: string; children: React.ReactNode }> = ({ b, v, caption, children }) => (
  <Sequence from={b.from} durationInFrames={b.dur}>
    <BeatFade dur={b.dur}>
      <Drift dur={b.dur}>{children}</Drift>
      {v ? <WordCaption words={v.words} offset={LEAD} /> : <Caption text={caption} />}
    </BeatFade>
    {v && (
      <Sequence from={LEAD}>
        <Audio src={staticFile(v.file)} />
      </Sequence>
    )}
  </Sequence>
);

// ---- beat 1: date card + Kenya atlas ----
const DateCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const a = prog(frame, 6, 18);
  const rule = prog(frame, 16, 20);
  const b = prog(frame, 24, 16);
  const c = prog(frame, 34, 16);
  const map = vertical ? { w: 980 * u, h: 860 * u } : { w: 820 * u, h: 860 * u };
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: (vertical ? 0 : 40) * u, paddingBottom: (vertical ? 260 : 60) * u }}>
      <AtlasMap view={[29, -6.5, 46, 7]} focus="KEN" w={map.w} h={map.h} start={0} marks={[{ lon: 36.82, lat: -1.29, label: "Nairobi", labelSide: "left" }]} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", gap: 10 * u }}>
        <Kicker>Case file 01 · Mobile money</Kicker>
        <div style={{ fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: (vertical ? 170 : 170) * u, lineHeight: 0.95, color: DOC.ink, opacity: a, transform: `translateY(${(1 - a) * 24 * u}px)` }}>March 2007</div>
        <div style={{ width: (vertical ? 600 : 640) * u * rule, height: 8 * u, background: DOC.accent }} />
        <div style={{ fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: 110 * u, color: DOC.ink, opacity: b, marginTop: 6 * u }}>Kenya</div>
        <div style={{ opacity: c }}>
          <Kicker size={24}>1.29° S · 36.82° E · Nairobi</Kicker>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- beat 2: photo collage ----
const Collage: React.FC = () => {
  const { width: W, height: H, u, vertical } = useLayout();
  return vertical ? (
    <AbsoluteFill>
      <PhotoPrint label="Market street, Nairobi" src="library/doc-template/photos/nairobi-mpesa-agent.jpg" credit="Fiona Graham · CC BY-SA 2.0" w={820 * u} h={560 * u} x={W * 0.45} y={H * 0.29} rot={-4} start={0} from="left" tint="#8A6F4E" />
      <PhotoPrint label="Basic button phone" src="library/doc-template/photos/mpesa-nokia-1100.jpg" credit="Rosenfeld Media · CC BY 2.0" w={560 * u} h={420 * u} x={W * 0.64} y={H * 0.58} rot={5} start={22} from="right" tint="#5D6B63" />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill>
      <PhotoPrint label="Market street, Nairobi" src="library/doc-template/photos/nairobi-mpesa-agent.jpg" credit="Fiona Graham · CC BY-SA 2.0" w={780 * u} h={540 * u} x={W * 0.34} y={H * 0.47} rot={-4} start={0} from="left" tint="#8A6F4E" />
      <PhotoPrint label="Basic button phone" src="library/doc-template/photos/mpesa-nokia-1100.jpg" credit="Rosenfeld Media · CC BY 2.0" w={520 * u} h={390 * u} x={W * 0.7} y={H * 0.48} rot={5} start={22} from="right" tint="#5D6B63" />
    </AbsoluteFill>
  );
};

// ---- beat 3: who launched it (company logos) + how it works (icon flow) ----
const CompanyFlow: React.FC = () => {
  const { u, vertical } = useLayout();
  const steps: { kind: InkKind; label: string }[] = [
    { kind: "cash", label: "Hand over cash" },
    { kind: "shop", label: "At a local shop" },
    { kind: "sms", label: "Send by text" },
    { kind: "person", label: "Anyone receives it" },
  ];
  const icon = (vertical ? 110 : 130) * u;
  const labelW = (vertical ? 190 : 230) * u;
  const arrow = (vertical ? 40 : 80) * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: (vertical ? 70 : 60) * u, paddingBottom: (vertical ? 240 : 80) * u }}>
      {/* who */}
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: (vertical ? 26 : 40) * u }}>
        <LogoBadge name="M-PESA" src="library/logos/mpesa.svg" color="#3FA535" size={(vertical ? 420 : 380) * u} start={0} caption="Launched March 2007" />
        <div style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
          <Kicker size={22}>by</Kicker>
          <LogoBadge name="Safaricom" src="library/logos/safaricom.svg" zoom={2.1} color="#2E9E44" size={250 * u} start={14} />
          <Kicker size={22}>part-owned by</Kicker>
          <LogoBadge name="Vodafone" src="library/logos/vodafone.svg" color="#E60000" size={250 * u} start={24} />
        </div>
      </div>
      {/* how */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {steps.map((s, i) => (
          <div key={s.kind} style={{ display: "flex", alignItems: "flex-start" }}>
            <Step kind={s.kind} label={s.label} icon={icon} width={labelW} start={44 + i * 16} accent={i === 2} />
            {i < steps.length - 1 && (
              <div style={{ height: icon, display: "flex", alignItems: "center" }}>
                <FlowArrow start={52 + i * 16} length={arrow} />
              </div>
            )}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Step: React.FC<{ kind: InkKind; label: string; icon: number; width: number; start: number; accent?: boolean }> = ({ kind, label, icon, width, start, accent }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const o = prog(frame, start, 12);
  return (
    <div style={{ width, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * u, opacity: o, transform: `translateY(${(1 - o) * 14 * u}px)` }}>
      <InkIcon kind={kind} size={icon} color={accent ? DOC.accent : DOC.ink} />
      <div style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 26 * u, letterSpacing: 1 * u, textTransform: "uppercase", color: DOC.ink, textAlign: "center", lineHeight: 1.05 }}>{label}</div>
    </div>
  );
};

// ---- beat 4: crossed-out icons ----
const NoneNeeded: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const items: { kind: "bank" | "card" | "smartphone"; label: string }[] = [
    { kind: "bank", label: "No branch" },
    { kind: "card", label: "No bank account" },
    { kind: "smartphone", label: "No smartphone" },
  ];
  const size = (vertical ? 210 : 240) * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: (vertical ? 240 : 70) * u }}>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: (vertical ? 40 : 110) * u }}>
        {items.map((it, i) => {
          const o = prog(frame, i * 14, 12);
          return (
            <div key={it.kind} style={{ display: "flex", flexDirection: vertical ? "row" : "column", alignItems: "center", gap: 22 * u, opacity: o }}>
              <div style={{ position: "relative", width: size, height: size }}>
                <InkIcon kind={it.kind} size={size} />
                <PenCross start={i * 14 + 14} size={size * 0.95} />
              </div>
              <div style={{ fontFamily: DOC.fonts.label, fontWeight: DOC.labelWeight, fontSize: 40 * u, letterSpacing: 1 * u, color: DOC.ink, textTransform: "uppercase", width: vertical ? 480 * u : undefined }}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---- beat 5: 82% stat with dot grid ----
const Stat82: React.FC = () => {
  const { u, vertical } = useLayout();
  const grid = (vertical ? 560 : 560) * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: (vertical ? 260 : 70) * u }}>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: (vertical ? 40 : 100) * u }}>
        <DotGrid value={82} start={6} size={grid} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", gap: 12 * u, textAlign: vertical ? "center" : "left" }}>
          <Counter to={82} start={6} dur={40} suffix="%" style={{ fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: 240 * u, lineHeight: 0.9, color: DOC.accent }} />
          <div style={{ fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: 44 * u, color: DOC.ink, maxWidth: 620 * u, lineHeight: 1.2 }}>of Kenyan adults use mobile money</div>
          <div style={{ fontFamily: DOC.fonts.serif, fontSize: 36 * u, color: DOC.inkSoft, maxWidth: 620 * u }}>
            and over <Highlight start={60}>half use it every day</Highlight>
          </div>
          <div style={{ marginTop: 10 * u }}>
            <SourceChip text="FinAccess 2024 · CBK / KNBS" start={70} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- beat 6: 194,000 households ----
const Households: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const cols = 10;
  const icon = (vertical ? 78 : 74) * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: (vertical ? 260 : 70) * u }}>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: (vertical ? 40 : 90) * u }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${icon}px)`, gap: 8 * u }}>
          {Array.from({ length: 50 }, (_, i) => {
            const o = prog(frame, 4 + i * 0.8, 8);
            const hot = i === 27;
            const pulse = hot ? prog(frame, 60, 12) : 0;
            return (
              <div key={i} style={{ opacity: o, transform: `scale(${1 + pulse * 0.25})` }}>
                <InkIcon kind="house" size={icon} color={hot && pulse > 0 ? DOC.accent : DOC.inkSoft} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", gap: 10 * u, textAlign: vertical ? "center" : "left" }}>
          <Kicker color={DOC.accent}>About 1 in 50 households</Kicker>
          <Counter to={194000} start={10} dur={46} style={{ fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: 190 * u, lineHeight: 0.9, color: DOC.ink }} />
          <div style={{ fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: 42 * u, color: DOC.ink, maxWidth: 600 * u, lineHeight: 1.2 }}>Kenyan households lifted out of extreme poverty</div>
          <div style={{ marginTop: 10 * u }}>
            <SourceChip text="Suri & Jack · Science 2016" start={66} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- beat 7: In India ----
const InIndia: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const bar = prog(frame, 50, 30);
  const seg = (label: string, pct: number, color: string, text: string) => (
    <div style={{ width: `${pct * bar}%`, background: color, color: text, fontFamily: DOC.fonts.mono, fontWeight: 600, fontSize: 22 * u, display: "flex", alignItems: "center", paddingLeft: 12 * u, overflow: "hidden", whiteSpace: "nowrap" }}>
      {label}
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: (vertical ? 260 : 70) * u }}>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: (vertical ? 30 : 100) * u }}>
        <AtlasMap view={[63, 5, 99, 37.5]} focus="IND" w={(vertical ? 860 : 700) * u} h={(vertical ? 520 : 760) * u} start={0} tilt={-1.5} seed={9} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 * u, width: (vertical ? 860 : 760) * u, alignItems: vertical ? "center" : "flex-start" }}>
          <IndiaTag start={0} />
          <div style={{ fontFamily: DOC.fonts.headline, fontWeight: DOC.headWeight, fontSize: 92 * u, lineHeight: 1, color: DOC.ink, textAlign: vertical ? "center" : "left" }}>
            <div style={{ fontSize: (vertical ? 76 : 68) * u }}>PhonePe + Google Pay</div>
            <div style={{ fontSize: 150 * u, color: DOC.accent }}>≈ 4 in 5</div>
          </div>
          <div style={{ fontFamily: DOC.fonts.body, fontWeight: 600, fontSize: 36 * u, color: DOC.inkSoft }}>of all UPI payments</div>
          <div style={{ display: "flex", gap: 22 * u }}>
            <LogoBadge name="PhonePe" src="library/logos/phonepe.svg" color="#5F259F" size={200 * u} start={30} caption="46%" />
            <LogoBadge name="Google Pay" src="library/logos/googlepay.svg" color="#1A73E8" size={200 * u} start={38} caption="32%" />
            <LogoBadge name="Paytm" src="library/logos/paytm.svg" zoom={1.7} color="#00B9F1" size={200 * u} start={46} caption="~8%" />
          </div>
          <div style={{ display: "flex", width: "100%", height: 54 * u, border: `${2 * u}px solid ${DOC.ink}` }}>
            {seg("PHONEPE 46%", 45.6, DOC.ink, DOC.paper)}
            {seg("GPAY 32%", 32.3, DOC.data, DOC.paper)}
            {seg("OTHERS", 22.1, DOC.paperShade, DOC.ink)}
          </div>
          <SourceChip text="NPCI data via Outlook Business · 2026" start={80} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const DocSample: React.FC<DocSampleProps> = ({ voice }) => {
  const { beats: B } = docTimeline(voice);
  const v = (k: BeatKey) => voice?.[k];
  return (
    <AbsoluteFill>
      <Paper />
      <Beat b={B.date} v={v("date")} caption="March 2007. Kenya.">
        <DateCard />
      </Beat>
      <Beat b={B.collage} v={v("collage")} caption="Most people don't have a bank account. But many of them have a basic mobile phone.">
        <Collage />
      </Beat>
      <Beat b={B.flow} v={v("flow")} caption="So the phone company Safaricom launches M-Pesa. You hand cash to a local shopkeeper, and send money to anyone, by text message.">
        <CompanyFlow />
      </Beat>
      <Beat b={B.none} v={v("none")} caption="No branch. No bank account. Not even a smartphone.">
        <NoneNeeded />
      </Beat>
      <Beat b={B.stat} v={v("stat")} caption="Today, more than eight in ten Kenyan adults use mobile money, and over half use it every day.">
        <Stat82 />
      </Beat>
      <Beat b={B.houses} v={v("houses")} caption="Economists at MIT found that access to mobile money lifted about 194,000 Kenyan households out of extreme poverty.">
        <Households />
      </Beat>
      <Beat b={B.india} v={v("india")} caption="In India, the apps on top of UPI are PhonePe and Google Pay, handling about four in five UPI payments.">
        <InIndia />
      </Beat>
      {/* chrome stays on through the chapter */}
      <Sequence from={B.collage.from}>
        <ChapterTag n={1} title="They took payments" />
        <PillarTracker active={0} />
      </Sequence>
    </AbsoluteFill>
  );
};

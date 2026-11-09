import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EmphasisText } from "../../components/EmphasisText";
import { Badge, cueFrame } from "../../components/Portraits";
import { Icon } from "../../components/Icon";
import { Stage } from "../../components/Stage";
import { PARTY } from "../../components/StateGrid";
import { useTheme } from "../../theme";
import type { Measure } from "../../types";
import type { SceneProps } from "../listicle/scenes";

const useEnter = (delay: number, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
};

const Title: React.FC<{ text?: string; sub?: string }> = ({ text, sub }) => {
  const theme = useTheme();
  const enter = useEnter(0);
  return (
    <div style={{ transform: `translateY(${(1 - enter) * -60}px)`, opacity: enter }}>
      <div style={{ fontFamily: theme.headlineFont, fontSize: 140, lineHeight: 0.95, textTransform: "uppercase", color: theme.text }}>
        {text}
      </div>
      {sub && (
        <div style={{ marginTop: 14, fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 48, color: theme.accent }}>
          <EmphasisText text={sub} />
        </div>
      )}
    </div>
  );
};

// Seat count as one stacked bar with the majority line marked — e.g. the House: 218 to win.
export const ScoreboardScene: React.FC<SceneProps> = ({ scene }) => {
  const theme = useTheme();
  const board = scene.scoreboard!;
  const frame = useCurrentFrame();
  const grow = useEnter(10, 20);
  const line = useEnter(30);
  const BAR = 940;
  const px = (v: number) => (v / board.total) * BAR;
  let x = 0;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${theme.surface} 0%, ${theme.background} 75%)`, padding: "170px 70px 0" }}>
      <Title text={scene.name} sub={scene.onScreenText} />

      <div style={{ marginTop: 110, display: "flex", flexDirection: "column", gap: 44 }}>
        {board.segments.map((seg, i) => {
          const n = Math.round(seg.value * spring({ frame: frame - 14 - i * 6, fps: 30, config: { damping: 20 } }));
          return (
            <div key={seg.label} style={{ display: "flex", alignItems: "baseline", gap: 24, fontFamily: theme.bodyFont, fontWeight: 900, color: theme.text }}>
              <span style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: PARTY[seg.party], alignSelf: "center" }} />
              <span style={{ fontFamily: theme.headlineFont, fontSize: 120, lineHeight: 1, color: seg.party === "pending" ? `${theme.text}AA` : theme.text, minWidth: 220 }}>
                {n}
              </span>
              <span style={{ fontSize: 44, opacity: 0.85 }}>{seg.label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative", marginTop: 90, width: BAR, height: 110 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, backgroundColor: `${theme.text}14`, overflow: "hidden", display: "flex" }}>
          {board.segments.map((seg) => {
            const w = px(seg.value) * grow;
            x += px(seg.value);
            return (
              <div
                key={seg.label}
                style={{
                  width: w,
                  height: "100%",
                  backgroundColor: PARTY[seg.party],
                  backgroundImage: seg.party === "pending" ? `repeating-linear-gradient(135deg, ${theme.text}33 0 8px, transparent 8px 18px)` : undefined,
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            left: px(board.majority) - 3,
            top: -30,
            bottom: -30,
            width: 6,
            backgroundColor: theme.text,
            opacity: line,
            boxShadow: "0 0 18px rgba(0,0,0,0.6)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: px(board.majority),
            top: 150,
            transform: "translateX(-50%)",
            fontFamily: theme.bodyFont,
            fontWeight: 900,
            fontSize: 38,
            color: theme.text,
            whiteSpace: "nowrap",
            opacity: line,
          }}
        >
          {board.majority} TO WIN ▲
        </div>
      </div>

      {board.note && (
        <div style={{ marginTop: 130, fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 30, color: `${theme.text}99`, letterSpacing: 1 }}>
          {board.note}
        </div>
      )}
    </AbsoluteFill>
  );
};

const RESULT = {
  passed: { label: "PASSED", mark: "✓" },
  rejected: { label: "REJECTED", mark: "✗" },
  counting: { label: "STILL COUNTING", mark: "…" },
};

const BallotCard: React.FC<{ measure: Measure; delay: number }> = ({ measure, delay }) => {
  const theme = useTheme();
  const card = useEnter(delay, 14);
  const stamp = useEnter(delay + 14, 10);
  const r = RESULT[measure.result];
  const stampColor = measure.result === "passed" ? theme.accent : measure.result === "rejected" ? theme.secondary : `${theme.text}AA`;

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: "#F4F1E8",
        color: "#14182E",
        borderRadius: 22,
        padding: "30px 36px 86px", // room for the result stamp below the text
        boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        transform: `translateX(${(1 - card) * 700}px) rotate(${interpolate(card, [0, 1], [6, -1])}deg)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: theme.bodyFont, fontWeight: 900 }}>
        <span style={{ backgroundColor: "#14182E", color: "#F4F1E8", borderRadius: 10, padding: "6px 14px", fontSize: 36 }}>{measure.state}</span>
        <span style={{ fontSize: 40 }}>{measure.name}</span>
      </div>
      <div style={{ marginTop: 16, fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 38, lineHeight: 1.25, maxWidth: 760 }}>
        {measure.about}
      </div>
      <div
        style={{
          position: "absolute",
          right: 26,
          bottom: -26,
          border: `7px solid ${stampColor}`,
          color: stampColor,
          backgroundColor: theme.background,
          borderRadius: 16,
          padding: "8px 22px",
          fontFamily: theme.headlineFont,
          fontSize: 58,
          letterSpacing: 2,
          transform: `rotate(-8deg) scale(${interpolate(stamp, [0, 1], [2.4, 1])})`,
          opacity: Math.min(1, stamp * 1.5),
          whiteSpace: "nowrap",
        }}
      >
        {r.mark} {measure.resultLabel ?? r.label}
        {measure.detail && <span style={{ fontSize: 36, marginLeft: 14, opacity: 0.85 }}>{measure.detail}</span>}
      </div>
    </div>
  );
};

// One or two ballot measures as paper ballot cards with a result stamp.
export const MeasureScene: React.FC<SceneProps> = ({ scene }) => {
  const theme = useTheme();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${theme.surface} 0%, ${theme.background} 75%)`, padding: "170px 70px 0" }}>
      <Title text={scene.name} sub={scene.onScreenText} />
      <div style={{ marginTop: 80, display: "flex", flexDirection: "column", gap: 90 }}>
        {(scene.measures ?? []).map((m, i) => (
          <BallotCard key={`${m.state}-${m.name}`} measure={m} delay={8 + i * 12} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TONE = (theme: ReturnType<typeof useTheme>, tone?: string) =>
  tone === "D" ? PARTY.D : tone === "R" ? PARTY.R : tone === "text" ? theme.text : theme.accent;

// 1–3 big-number tiles ("4 YEARS · 2 YEARS · 6 YEARS"), each popping in a beat apart.
export const StatsScene: React.FC<SceneProps> = ({ scene, projectPath }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stats = scene.stats ?? [];
  const compact = !!scene.strip?.length; // leave room for the photo strip
  return (
    <Stage scene={scene} projectPath={projectPath}>
      <Title text={scene.name} sub={scene.onScreenText} />
      <div style={{ marginTop: compact ? 60 : 90, display: "flex", flexDirection: "column", gap: compact ? 22 : 34 }}>
        {stats.map((st, i) => {
          const pop = spring({ frame: frame - 10 - i * 14, fps, config: { damping: 12, mass: 0.7 } });
          const color = TONE(theme, st.tone);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 34,
                padding: compact ? "14px 28px" : "22px 30px",
                borderRadius: 22,
                backgroundColor: `${theme.surface}CC`,
                borderLeft: `10px solid ${color}`,
                transform: `translateX(${(1 - pop) * 300}px)`,
                opacity: pop,
              }}
            >
              {st.icon ? (
                <span style={{ display: "flex", alignItems: "center", gap: 22, minWidth: 300 }}>
                  <span style={{ fontFamily: theme.headlineFont, fontSize: 110, lineHeight: 1, color }}>{st.value}</span>
                  <Icon name={st.icon} size={130} color={color} />
                </span>
              ) : (
                <span style={{ fontFamily: theme.headlineFont, fontSize: compact ? 116 : 150, lineHeight: 1, color, minWidth: compact ? 250 : 300 }}>{st.value}</span>
              )}
              <span style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: compact ? 40 : 46, lineHeight: 1.15, color: theme.text }}>
                <EmphasisText text={st.label} />
              </span>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

// Animated bar chart: bars grow from a zero line (up for gains, down for losses).
export const ChartScene: React.FC<SceneProps> = ({ scene, projectPath }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chart = scene.chart!;
  const bars = chart.bars;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const min = Math.min(0, ...bars.map((b) => b.value));
  const H = scene.strip?.length ? 520 : 820; // plot height (shorter to make room for a photo strip)
  const W = 940;
  const span = max - min || 1;
  const zeroY = (max / span) * H;
  const slot = W / bars.length;
  const barW = Math.min(150, slot * 0.72);
  const showAll = chart.showValues === "all" || bars.length <= 6;

  return (
    <Stage scene={scene} projectPath={projectPath}>
      <Title text={scene.name} sub={scene.onScreenText} />
      <div style={{ position: "relative", marginTop: 70, width: W, height: H }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: zeroY - 2, height: 4, backgroundColor: `${theme.text}55` }} />
        {bars.map((b, i) => {
          const grow = spring({ frame: frame - 12 - i * (bars.length > 10 ? 2 : 6), fps, config: { damping: 18 } });
          const h = (Math.abs(b.value) / span) * H * grow;
          const up = b.value >= 0;
          const color = b.party ? PARTY[b.party] : theme.accent;
          const x = i * slot + (slot - barW) / 2;
          const labelEvery = bars.length > 10 ? 4 : 1;
          return (
            <div key={b.label}>
              <div
                style={{
                  position: "absolute",
                  left: x,
                  width: barW,
                  top: up ? zeroY - h : zeroY,
                  height: Math.max(2, h),
                  backgroundColor: color,
                  borderRadius: up ? "8px 8px 2px 2px" : "2px 2px 8px 8px",
                  opacity: b.highlight || !chart.bars.some((x) => x.highlight) ? 1 : 0.55,
                  boxShadow: b.highlight ? `0 0 24px ${color}` : undefined,
                  outline: b.highlight ? `4px solid ${theme.text}` : undefined,
                }}
              />
              {(showAll || b.highlight) && grow > 0.6 && (
                <div
                  style={{
                    position: "absolute",
                    left: x + barW / 2,
                    top: up ? zeroY - h - 56 : zeroY + h + 10,
                    transform: "translateX(-50%)",
                    fontFamily: theme.bodyFont,
                    fontWeight: 900,
                    fontSize: bars.length > 10 ? 30 : 46,
                    color: theme.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.value > 0 && min < 0 ? "+" : ""}
                  {b.value}
                  {chart.unit ?? ""}
                </div>
              )}
              {(i % labelEvery === 0 || b.highlight || showAll) && (
                <div
                  style={{
                    position: "absolute",
                    left: x + barW / 2,
                    top: up ? zeroY + 14 : zeroY - 46,
                    transform: "translateX(-50%)",
                    fontFamily: theme.bodyFont,
                    fontWeight: 800,
                    fontSize: bars.length > 10 ? 24 : 34,
                    color: b.highlight ? theme.text : `${theme.text}AA`,
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  {b.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {chart.note && (
        <div style={{ marginTop: min < 0 ? 26 : 80, fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 28, color: `${theme.text}99` }}>{chart.note}</div>
      )}
    </Stage>
  );
};

// Countdown ring for the quiz pause: 3 · 2 · 1 over `seconds`, starting at frame `from`.
const Countdown: React.FC<{ from: number; seconds: number }> = ({ from, seconds }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - from;
  if (t < 0) return null;
  const left = Math.max(1, Math.ceil(seconds - t / fps));
  const tick = spring({ frame: t % fps, fps, config: { damping: 9, mass: 0.5 } });
  const progress = Math.min(1, t / (seconds * fps));
  const R = 118;
  const C = 2 * Math.PI * R;
  const done = t >= seconds * fps;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 1150, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 280, height: 280 }}>
        <svg width={280} height={280} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={140} cy={140} r={R} stroke={`${theme.text}22`} strokeWidth={18} fill={`${theme.background}CC`} />
          <circle cx={140} cy={140} r={R} stroke={theme.accent} strokeWidth={18} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * progress} />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: theme.headlineFont,
            fontSize: 170,
            color: theme.text,
            transform: `scale(${interpolate(tick, [0, 1], [1.6, 1])})`,
          }}
        >
          {done ? "?" : left}
        </div>
      </div>
      <div style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 40, letterSpacing: 6, color: theme.accent }}>⏸ PAUSE &amp; GUESS</div>
    </div>
  );
};

// Multiple-choice quiz. "ask": options pop in, then a countdown while the voice pauses.
// "reveal": same layout with no entrance, so the cut feels like the answer landing.
export const QuizScene: React.FC<SceneProps> = ({ scene, projectPath, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const quiz = scene.quiz!;
  const reveal = quiz.phase === "reveal";
  const lit = spring({ frame: frame - 6, fps, config: { damping: 11, mass: 0.6 } });
  const portraits = quiz.options.some((o) => o.portrait);
  const lastWord = words?.length ? words[words.length - 1].end : 2;
  const countFrom = Math.round(lastWord * fps) + 4;

  return (
    <Stage scene={scene} projectPath={projectPath}>
      {reveal ? (
        <div style={{ fontFamily: theme.headlineFont, fontSize: 140, lineHeight: 0.95, textTransform: "uppercase", color: theme.text }}>{scene.name}</div>
      ) : (
        <Title text={scene.name} />
      )}
      <div style={{ marginTop: 34, fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 64, lineHeight: 1.15, color: theme.text }}>
        <EmphasisText text={quiz.question} />
      </div>

      {portraits ? (
        <div style={{ marginTop: 90, display: "flex", justifyContent: "space-between" }}>
          {quiz.options.map((o, i) => {
            const right = i === quiz.answer;
            const at = reveal ? -60 : cueFrame(o.portrait!, words, fps, 14 + i * 10);
            return (
              <div
                key={o.label}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 22,
                  opacity: reveal && !right ? interpolate(lit, [0, 1], [1, 0.45]) : 1,
                  filter: reveal && !right ? `grayscale(${lit})` : undefined,
                }}
              >
                <Badge p={o.portrait!} size={230} at={at} />
                {reveal && o.reveal && (
                  <div
                    style={{
                      fontFamily: theme.headlineFont,
                      fontSize: right ? 110 : 84,
                      lineHeight: 1,
                      color: right ? theme.accent : theme.text,
                      transform: `scale(${lit})`,
                      textShadow: right ? `0 0 30px ${theme.accent}88` : undefined,
                    }}
                  >
                    {o.reveal}
                  </div>
                )}
                {reveal && right && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      right: -6,
                      backgroundColor: theme.accent,
                      color: theme.textOnAccent,
                      borderRadius: 999,
                      padding: "8px 20px",
                      fontFamily: theme.bodyFont,
                      fontWeight: 900,
                      fontSize: 34,
                      transform: `scale(${lit})`,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 80, display: "flex", flexDirection: "column", gap: 30 }}>
          {quiz.options.map((o, i) => {
            const right = i === quiz.answer;
            const pop = reveal ? 1 : spring({ frame: frame - 14 - i * 10, fps, config: { damping: 13, mass: 0.7 } });
            const on = reveal && right ? lit : 0;
            return (
              <div
                key={o.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 30,
                  padding: "24px 30px",
                  borderRadius: 24,
                  backgroundColor: on ? theme.accent : `${theme.surface}CC`,
                  border: `4px solid ${on ? theme.accent : `${theme.text}22`}`,
                  color: on ? theme.textOnAccent : theme.text,
                  transform: `translateX(${(1 - pop) * 300}px) scale(${1 + on * 0.04})`,
                  opacity: reveal && !right ? interpolate(lit, [0, 1], [1, 0.35]) : pop,
                  boxShadow: on ? `0 0 40px ${theme.accent}88` : undefined,
                }}
              >
                <span
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? theme.textOnAccent : `${theme.text}1A`,
                    color: on ? theme.accent : theme.text,
                    fontFamily: theme.headlineFont,
                    fontSize: 54,
                  }}
                >
                  {"ABCD"[i]}
                </span>
                <span style={{ fontFamily: theme.headlineFont, fontSize: 84, lineHeight: 1, textTransform: "uppercase" }}>{o.label}</span>
                {reveal && right && <span style={{ marginLeft: "auto", fontFamily: theme.headlineFont, fontSize: 84, opacity: lit }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {!reveal && scene.hold ? <Countdown from={countFrom} seconds={scene.hold} /> : null}
    </Stage>
  );
};

// "Comment below": the question as a big card, answer chips that wiggle, and an arrow
// bouncing toward the comments.
export const CommentScene: React.FC<SceneProps> = ({ scene, projectPath }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = scene.comment!;
  const card = useEnter(4, 12);
  const bounce = Math.abs(Math.sin((frame / fps) * Math.PI * 1.6)) * 26;

  return (
    <Stage scene={scene} projectPath={projectPath}>
      <Title text={scene.name ?? "Your turn"} />
      <div
        style={{
          position: "relative",
          marginTop: 70,
          padding: "50px 46px",
          borderRadius: 40,
          backgroundColor: `${theme.surface}EE`,
          border: `6px solid ${theme.accent}`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.45)`,
          transform: `scale(${interpolate(card, [0, 1], [0.7, 1])})`,
          opacity: card,
        }}
      >
        <div style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 40, letterSpacing: 6, color: theme.accent }}>💬 COMMENT</div>
        <div style={{ marginTop: 18, fontFamily: theme.headlineFont, fontSize: 104, lineHeight: 1.0, textTransform: "uppercase", color: theme.text }}>
          <EmphasisText text={c.prompt} />
        </div>
        {/* speech-bubble tail */}
        <div
          style={{
            position: "absolute",
            left: 90,
            bottom: -44,
            width: 0,
            height: 0,
            borderLeft: "34px solid transparent",
            borderRight: "34px solid transparent",
            borderTop: `44px solid ${theme.accent}`,
          }}
        />
      </div>

      <div style={{ marginTop: 100, display: "flex", justifyContent: "center", gap: 40 }}>
        {c.choices.map((choice, i) => {
          const pop = spring({ frame: frame - 18 - i * 8, fps, config: { damping: 9, mass: 0.6 } });
          const wiggle = Math.sin((frame + i * 11) / 6) * 3;
          const face = c.faces?.[i];
          return (
            <div key={choice} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              {face && <Face face={face} pop={pop} ring={i % 2 ? theme.secondary : theme.accent} />}
            <div
              style={{
                padding: Math.max(...c.choices.map((x) => x.length)) > 9 ? "24px 34px" : "26px 46px",
                borderRadius: 999,
                backgroundColor: i % 2 ? theme.secondary : theme.accent,
                color: i % 2 ? theme.textOnSecondary : theme.textOnAccent,
                fontFamily: theme.headlineFont,
                // long choices ("😬 MISSING OUT") shrink so the pair still fits across the frame
                fontSize: Math.max(...c.choices.map((x) => x.length)) > 9 ? 60 : 84,
                lineHeight: 1,
                whiteSpace: "nowrap",
                transform: `scale(${pop}) rotate(${wiggle * pop}deg)`,
                boxShadow: "0 16px 36px rgba(0,0,0,0.45)",
              }}
            >
              {choice}
            </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 70,
          textAlign: "center",
          fontFamily: theme.bodyFont,
          fontWeight: 900,
          fontSize: 46,
          letterSpacing: 4,
          color: theme.text,
          transform: `translateY(${bounce}px)`,
          opacity: useEnter(30),
        }}
      >
        TELL US BELOW 👇
      </div>
    </Stage>
  );
};

// Who a comment choice stands for: a round photo, or a person icon when there's no photo.
const Face: React.FC<{ face: { photo?: string; label: string }; pop: number; ring: string }> = ({ face, pop, ring }) => {
  const theme = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${pop})` }}>
      <div style={{ width: 190, height: 190, borderRadius: 95, overflow: "hidden", border: `8px solid ${ring}`, backgroundColor: theme.surface, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px rgba(0,0,0,0.4)" }}>
        {face.photo ? (
          <Img src={staticFile(face.photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 25%" }} />
        ) : (
          <svg width={120} height={120} viewBox="0 0 20 20">
            <circle cx="10" cy="5.5" r="3.8" fill="#FFFFFF" />
            <path d="M3.5 19 v-5 a6.5 6.5 0 0 1 13 0 V19 z" fill="#FFFFFF" />
          </svg>
        )}
      </div>
      <div style={{ marginTop: 10, fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 30, color: theme.text, whiteSpace: "nowrap" }}>{face.label}</div>
    </div>
  );
};

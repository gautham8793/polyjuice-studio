// Cinematic overlays drawn in code: chapter / date / callout cards, stat tiles, a bar chart, a
// corner step tracker, a timeline, quote cards, and the shot's sound effects.
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../theme";
import type { Shot, ShotCard, ShotSound, ShotStat, Word } from "../../types";
import { EASE, startFrame, TONES } from "./timing";

type Props<T> = { data: T; words?: Word[] };

const fadeWindow = (frame: number, s0: number, end: number | undefined) =>
  Math.min(
    interpolate(frame, [s0, s0 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    end === undefined ? 1 : interpolate(frame, [end, end + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

const untilFrame = (until: number | string | undefined, words: Word[] | undefined, fps: number) =>
  until === undefined ? undefined : startFrame(typeof until === "string" ? { cue: until } : { start: until }, words, fps, Math.round(Number(until) * fps) || 0);

export const Card: React.FC<Props<ShotCard>> = ({ data, words }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(data, words, fps, 4);
  const end = untilFrame(data.until, words, fps);
  const o = fadeWindow(frame, s0, end);
  if (o <= 0) return null;
  const k = interpolate(frame, [s0, s0 + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });

  if (data.kind === "chapter") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 170px 130px", opacity: o }}>
        <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 30, letterSpacing: 10, color: theme.accent, textTransform: "uppercase", transform: `translateY(${(1 - k) * 16}px)` }}>
          {data.kicker}
        </div>
        <div style={{ height: 4, width: 260 * k, background: theme.accent, margin: "14px 0 18px", boxShadow: `0 0 14px ${theme.accent}` }} />
        <div
          style={{
            fontFamily: theme.headlineFont,
            fontSize: 112,
            lineHeight: 1,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: interpolate(k, [0, 1], [18, 3]),
            filter: `blur(${(1 - k) * 8}px)`,
            textShadow: "0 8px 30px rgba(0,0,0,0.7)",
          }}
        >
          {data.text}
        </div>
      </AbsoluteFill>
    );
  }
  if (data.kind === "date") {
    // typed out like a case file stamp; on tall (Shorts) frames it sits below the top UI
    const tall = H > W;
    const chars = Math.floor(interpolate(frame, [s0, s0 + data.text.length * 2], [0, data.text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    return (
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start", padding: tall ? "280px 90px" : "120px 130px", opacity: o }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FF4D6A", boxShadow: "0 0 14px #FF4D6A", opacity: 0.5 + 0.5 * Math.sin(frame / 5) }} />
          <div style={{ fontFamily: theme.headlineFont, fontSize: 72, letterSpacing: 6, color: "#fff", textShadow: "0 6px 24px rgba(0,0,0,0.7)" }}>{data.text.slice(0, chars)}</div>
        </div>
        {data.sub && (
          <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 32, letterSpacing: 8, color: "#cfd6e6", marginTop: 10, marginLeft: 32, opacity: interpolate(frame, [s0 + 18, s0 + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            {data.sub}
          </div>
        )}
      </AbsoluteFill>
    );
  }
  // callout: one huge statement in the middle
  const pop = spring({ frame: frame - s0, fps, config: { damping: 12, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ textAlign: "center", transform: `scale(${0.7 + 0.3 * pop})` }}>
        <div style={{ fontFamily: theme.headlineFont, fontSize: 190, lineHeight: 1, color: "#fff", textShadow: "0 0 50px rgba(255,77,106,0.55), 0 10px 40px rgba(0,0,0,0.7)" }}>{data.text}</div>
        {data.sub && <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 44, color: theme.accent, marginTop: 16 }}>{data.sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

export const Stats: React.FC<Props<ShotStat[]>> = ({ data, words }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const theme = useTheme();
  const tall = H > W; // Shorts: tiles stack, a little above the middle so captions stay clear
  return (
    <AbsoluteFill style={{ justifyContent: tall ? "flex-start" : "center", alignItems: "center", paddingTop: tall ? 520 : 0 }}>
      <div style={{ display: "flex", flexDirection: tall ? "column" : "row", gap: tall ? 40 : 60 }}>
        {data.map((st, i) => {
          const s0 = startFrame(st, words, fps, 8 + i * 20);
          const pop = spring({ frame: frame - s0, fps, config: { damping: 14, mass: 0.7 } });
          if (frame < s0) return <div key={i} style={{ width: tall ? 760 : 520 }} />;
          const n = st.count !== undefined ? Math.round(interpolate(frame, [s0, s0 + 36], [0, st.count], { extrapolateRight: "clamp", easing: EASE.out })) : undefined;
          const color = TONES[st.tone ?? "gold"];
          return (
            <div
              key={i}
              style={{
                width: tall ? 760 : 520,
                padding: "40px 30px",
                borderRadius: 24,
                backgroundColor: "rgba(8, 8, 20, 0.78)",
                border: `2px solid ${color}`,
                boxShadow: `0 0 40px ${color}44`,
                textAlign: "center",
                opacity: pop,
                transform: `translateY(${(1 - pop) * 30}px)`,
              }}
            >
              <div style={{ fontFamily: theme.headlineFont, fontSize: (st.value?.length ?? 0) > 7 ? 92 : 120, lineHeight: 1, whiteSpace: "nowrap", color, textShadow: `0 0 30px ${color}88` }}>
                {n !== undefined ? `${st.prefix ?? ""}${n}${st.suffix ?? ""}` : st.value}
              </div>
              <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 34, color: "#E8ECF5", marginTop: 18, lineHeight: 1.25 }}>{st.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Cytokine levels: every bar rises a little, the highlighted one shoots off the chart.
export const Bars: React.FC<Props<NonNullable<Shot["bars"]>>> = ({ data, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(data, words, fps, 10);
  const H = 420;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", padding: "0 160px" }}>
      <div style={{ padding: "30px 40px 26px", borderRadius: 22, backgroundColor: "rgba(8, 8, 20, 0.8)", border: "2px solid #ffffff22" }}>
        {data.title && <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: "#cfd6e6", textTransform: "uppercase", marginBottom: 20 }}>{data.title}</div>}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 34, height: H }}>
          {data.items.map((b, i) => {
            const grow = interpolate(frame, [s0 + i * 4, s0 + i * 4 + (b.highlight ? 40 : 20)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
            const color = b.highlight ? "#FF4D6A" : "#4FA8FF";
            const shake = b.highlight && grow > 0.95 ? Math.sin(frame * 1.7) * 2 : 0;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 74,
                    height: Math.max(4, H * 0.9 * b.value * grow),
                    borderRadius: "10px 10px 4px 4px",
                    background: `linear-gradient(180deg, ${color}, ${color}66)`,
                    boxShadow: b.highlight ? `0 0 30px ${color}` : "none",
                    transform: `translateX(${shake}px)`,
                  }}
                />
                <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 28, color: b.highlight ? color : "#E8ECF5" }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Tracker: React.FC<{ data: NonNullable<Shot["tracker"]> }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const theme = useTheme();
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const tall = H > W; // Shorts: centered below the top UI
  return (
    <div style={{ position: "absolute", top: tall ? 220 : 60, left: tall ? 0 : 70, right: tall ? 0 : undefined, justifyContent: "center", display: "flex", gap: 14, opacity: fade }}>
      {data.items.map((it, i) => {
        const active = i === data.active;
        const done = i < data.active;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              backgroundColor: active ? `${theme.accent}30` : "rgba(8, 8, 20, 0.7)",
              border: `2px solid ${active ? theme.accent : done ? "#4FA8FF" : "#ffffff30"}`,
              boxShadow: active ? `0 0 20px ${theme.accent}88` : "none",
              fontFamily: theme.bodyFont,
              fontWeight: 800,
              fontSize: 26,
              color: active ? "#fff" : done ? "#cfe3ff" : "#ffffff80",
            }}
          >
            <span style={{ fontFamily: theme.headlineFont, color: active ? theme.accent : "inherit" }}>{done ? "✓" : i + 1}</span>
            {it}
          </div>
        );
      })}
    </div>
  );
};

export const Timeline: React.FC<Props<NonNullable<Shot["timeline"]>>> = ({ data, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(data, words, fps, 6);
  const n = data.points.length;
  const line = interpolate(frame, [s0, s0 + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 160px 200px" }}>
      <div style={{ position: "relative", height: 200 }}>
        <div style={{ position: "absolute", left: 0, top: 96, height: 4, width: `${line * 100}%`, background: `linear-gradient(90deg, #4FA8FF, ${theme.accent})`, boxShadow: `0 0 14px ${theme.accent}88` }} />
        {data.points.map((p, i) => {
          const x = n === 1 ? 50 : (i / (n - 1)) * 100;
          const at = s0 + (x / 100) * 30;
          const pop = spring({ frame: frame - at, fps, config: { damping: 14 } });
          const active = i === data.active;
          return (
            <div key={i} style={{ position: "absolute", left: `${x}%`, top: 0, transform: "translateX(-50%)", textAlign: "center", opacity: pop, width: 380 }}>
              <div style={{ fontFamily: theme.headlineFont, fontSize: active ? 76 : 54, color: active ? theme.accent : "#fff", lineHeight: 1, height: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>{p.year}</div>
              <div style={{ width: active ? 30 : 20, height: active ? 30 : 20, borderRadius: "50%", margin: `${active ? 3 : 8}px auto`, backgroundColor: active ? theme.accent : "#4FA8FF", boxShadow: `0 0 18px ${active ? theme.accent : "#4FA8FF"}` }} />
              <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 28, color: "#E8ECF5", marginTop: 6 }}>{p.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const QuoteCard: React.FC<Props<NonNullable<Shot["quote"]>>> = ({ data, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(data, words, fps, 10);
  const pop = spring({ frame: frame - s0, fps, config: { damping: 16, mass: 0.8 } });
  if (frame < s0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: "0 150px" }}>
      <div style={{ maxWidth: 860, padding: "40px 48px", borderRadius: 24, backgroundColor: "rgba(8, 8, 20, 0.8)", borderLeft: `8px solid ${theme.accent}`, opacity: pop, transform: `translateX(${(1 - pop) * -40}px)` }}>
        <div style={{ fontFamily: theme.headlineFont, fontSize: 120, lineHeight: 0.6, color: theme.accent, height: 50 }}>“</div>
        <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 56, lineHeight: 1.2, color: "#fff" }}>{data.text}</div>
        <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 28, color: "#cfd6e6", marginTop: 24 }}>
          — {data.who}
          {data.where ? <span style={{ color: "#8f98ad" }}> · {data.where}</span> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Calm end card: the channel's logo, name and handle, with an optional line under it.
export const BrandCard: React.FC<Props<NonNullable<Shot["brand"]>>> = ({ data, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(data, words, fps, 6);
  const k = (d: number) => interpolate(frame, [s0 + d, s0 + d + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const breathe = 1 + 0.015 * Math.sin(frame / 20);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 26 }}>
      <Img
        src={staticFile("brand/logo/polyjuice-logo-round-transparent.png")}
        style={{ width: 260, height: 260, opacity: k(0), transform: `scale(${(0.9 + 0.1 * k(0)) * breathe})`, filter: "drop-shadow(0 0 40px rgba(124, 92, 255, 0.45))" }}
      />
      <div style={{ fontFamily: theme.headlineFont, fontSize: 84, color: "#fff", textTransform: "uppercase", letterSpacing: interpolate(k(8), [0, 1], [16, 4]), opacity: k(8), filter: `blur(${(1 - k(8)) * 8}px)`, textAlign: "center", lineHeight: 1.05 }}>
        {theme.channelName}
      </div>
      <div style={{ height: 4, width: 240 * k(14), background: theme.accent, boxShadow: `0 0 14px ${theme.accent}` }} />
      <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 38, color: "#cfd6e6", letterSpacing: 2, opacity: k(18) }}>{theme.handle}</div>
      {data.line && <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 42, color: theme.accent, marginTop: 30, opacity: k(30), textAlign: "center", padding: "0 80px" }}>{data.line}</div>}
    </AbsoluteFill>
  );
};

export const ShotSfx: React.FC<Props<ShotSound[]>> = ({ data, words }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <>
      {data.map((s, i) => {
        const from = Math.max(0, startFrame(s, words, fps, 0));
        const dur = s.duration !== undefined ? Math.round(s.duration * fps) : durationInFrames - from;
        if (dur <= 0) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Audio src={staticFile(`library/sfx/${s.sound}.wav`)} volume={s.volume ?? 0.5} loop={s.loop} />
          </Sequence>
        );
      })}
    </>
  );
};

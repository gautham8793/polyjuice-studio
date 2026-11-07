// Cinematic template (16:9): every scene is one camera shot over stacked image layers — a
// background plate, cut-out cells that drift, move and glow, effects drawn in code (flowing
// blood cells, particle streams, pores, light blooms) and callout labels that point at things.
// Depth gives parallax: far layers barely move with the camera, near ones move a lot.
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { assetSrc } from "../../components/SceneVisual";
import { useTheme } from "../../theme";
import type { Pt, Shot, ShotFx, ShotLabel, ShotLayer, Word } from "../../types";
import type { SceneProps } from "../listicle/scenes";
import { Bars, BrandCard, Card, QuoteCard, ShotSfx, Stats, Timeline, Tracker } from "./overlays";
import { EASE, startFrame, TONES } from "./timing";

type Cam = { zoom: number; x: number; y: number };

// How a layer at `depth` sees the camera: near layers get the full move, far ones a fraction.
const camFor = (cam: Cam, depth: number): Cam => {
  const k = 0.3 + 0.7 * depth;
  return { zoom: 1 + (cam.zoom - 1) * k, x: 0.5 + (cam.x - 0.5) * k, y: 0.5 + (cam.y - 0.5) * k };
};

// world point (frame fractions) → screen pixels, through the camera at that depth
const toScreen = (p: Pt, cam: Cam, depth: number, W: number, H: number): Pt => {
  const c = camFor(cam, depth);
  return [W / 2 + (p[0] - c.x) * W * c.zoom, H / 2 + (p[1] - c.y) * H * c.zoom];
};

const DepthPlane: React.FC<{ cam: Cam; depth: number; children: React.ReactNode }> = ({ cam, depth, children }) => {
  const { width: W, height: H } = useVideoConfig();
  const c = camFor(cam, depth);
  return (
    <AbsoluteFill
      style={{ transformOrigin: "0 0", transform: `translate(${W / 2}px, ${H / 2}px) scale(${c.zoom}) translate(${-c.x * W}px, ${-c.y * H}px)` }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Where a layer is (and how big/faded) at this frame.
const layerState = (layer: ShotLayer, frame: number, fps: number, total: number, words?: Word[]) => {
  const from = startFrame(layer.move, words, fps, 0);
  const dur = layer.move?.duration !== undefined ? Math.round(layer.move.duration * fps) : Math.max(1, total - from);
  const t = interpolate(frame, [from, from + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE[layer.move?.ease ?? "inOut"],
  });
  const at = layer.at ?? [0.5, 0.5];
  const to = layer.to ?? {};
  const end = to.at ?? at;
  let x = at[0] + (end[0] - at[0]) * t;
  let y = at[1] + (end[1] - at[1]) * t;
  const scale = 1 + ((to.scale ?? 1) - 1) * t;
  const opacityBase = (layer.opacity ?? 1) + ((to.opacity ?? layer.opacity ?? 1) - (layer.opacity ?? 1)) * t;
  const blur = (layer.blur ?? 0) + ((to.blur ?? layer.blur ?? 0) - (layer.blur ?? 0)) * t;
  const rotate = (to.rotate ?? 0) * t + (layer.spin ?? 0) * (frame / total);

  // arrival
  let enterK = 1;
  if (layer.enter) {
    const e0 = startFrame(layer.enter, words, fps, 0);
    const edur = Math.round((layer.enter.duration ?? 1.2) * fps);
    enterK = interpolate(frame, [e0, e0 + edur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
    const dist = 0.45 * (1 - enterK);
    if (layer.enter.from === "left") x -= dist;
    if (layer.enter.from === "right") x += dist;
    if (layer.enter.from === "below") y += dist;
  }
  // bobbing in the flow, with a per-layer phase
  const phase = random(`${layer.src}${at.join()}`) * Math.PI * 2;
  const bob = layer.float ?? 0;
  const dx = Math.sin(frame / 41 + phase) * bob;
  const dy = Math.cos(frame / 53 + phase) * bob * 0.8;
  return { x, y, dx, dy, scale, opacity: opacityBase * enterK, blur, rotate, t };
};

const Layer: React.FC<{ layer: ShotLayer; cam: Cam; projectPath: string; words?: Word[] }> = ({ layer, cam, projectPath, words }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: W, height: H } = useVideoConfig();
  const s = layerState(layer, frame, fps, durationInFrames, words);
  const depth = layer.depth ?? (layer.fill ? 0 : 0.5);

  let filter = s.blur > 0.2 ? `blur(${s.blur.toFixed(1)}px)` : "";
  if (layer.glow) {
    const g0 = layer.glow.cue || layer.glow.start !== undefined ? startFrame(layer.glow, words, fps, 0) : -1000;
    const on = interpolate(frame, [g0, g0 + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const pulse = layer.glow.pulse ? 0.65 + 0.35 * Math.sin(frame / 9) : 1;
    const size = (layer.glow.size ?? 40) * on * pulse * (layer.glow.strength ?? 1);
    if (size > 0.5) filter += ` drop-shadow(0 0 ${size.toFixed(1)}px ${layer.glow.color}) drop-shadow(0 0 ${(size / 2.5).toFixed(1)}px ${layer.glow.color})`;
  }

  const images = [layer.src, ...(layer.stages ?? [])];
  // cross-fade through the stages as the move progresses
  const stageOpacity = (i: number) => {
    if (images.length === 1) return 1;
    const pos = s.t * (images.length - 1);
    return interpolate(Math.abs(pos - i), [0, 1], [1, 0], { extrapolateRight: "clamp" });
  };

  const imgs = images.map((src, i) => {
    const o = stageOpacity(i);
    if (o <= 0.001) return null;
    return (
      <Img
        key={src}
        src={staticFile(assetSrc(src, projectPath))}
        style={
          layer.fill
            ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: o }
            : { position: i === 0 ? "relative" : "absolute", left: 0, top: i === 0 ? 0 : "50%", width: "100%", transform: i === 0 ? undefined : "translateY(-50%)", opacity: o, display: "block" }
        }
      />
    );
  });

  if (layer.fill) {
    // plates sit a little oversized so camera moves never show an edge
    return (
      <DepthPlane cam={cam} depth={depth}>
        <AbsoluteFill style={{ transform: `scale(${1.12 * s.scale})`, opacity: s.opacity, filter: filter || undefined, mixBlendMode: layer.blend }}>
          {imgs}
        </AbsoluteFill>
      </DepthPlane>
    );
  }
  return (
    <DepthPlane cam={cam} depth={depth}>
      <div
        style={{
          position: "absolute",
          left: s.x * W + s.dx,
          top: s.y * H + s.dy,
          width: (layer.width ?? 0.3) * W,
          transform: `translate(-50%, -50%) scale(${s.scale}) rotate(${s.rotate}deg)`,
          opacity: s.opacity,
          filter: filter || undefined,
          mixBlendMode: layer.blend,
        }}
      >
        {imgs}
      </div>
    </DepthPlane>
  );
};

// ── effects ───────────────────────────────────────────────────────────────────

const Drift: React.FC<{ fx: Extract<ShotFx, { type: "drift" }>; cam: Cam; projectPath: string }> = ({ fx, cam, projectPath }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const [min, max] = fx.size ?? [0.06, 0.16];
  const speed = fx.speed ?? 0.06; // frame widths per second
  const dir = fx.dir ?? -1;
  const seed = fx.seed ?? 1;
  return (
    <DepthPlane cam={cam} depth={fx.depth ?? (fx.back ? 0.2 : 0.9)}>
      {Array.from({ length: fx.count }, (_, i) => {
        const r = (k: string) => random(`drift-${seed}-${i}-${k}`);
        const size = min + (max - min) * r("s");
        // bigger = closer: faster and more out of focus
        const near = (size - min) / Math.max(0.0001, max - min);
        const v = speed * (0.6 + 0.8 * near);
        const span = 1.4;
        const x = ((((r("x") * span + dir * v * (frame / fps)) % span) + span) % span) - 0.2;
        const y = r("y") * 1.1 - 0.05 + Math.sin(frame / 37 + r("p") * 6) * 0.01;
        const blur = (fx.blur ?? (fx.back ? 6 : 10)) * (fx.back ? 1 - near * 0.5 : 0.4 + near);
        return (
          <Img
            key={i}
            src={staticFile(assetSrc(fx.src, projectPath))}
            style={{
              position: "absolute",
              left: x * W,
              top: y * H,
              width: size * W,
              transform: `translate(-50%, -50%) rotate(${r("r") * 360 + frame * (r("w") - 0.5) * 0.8}deg)`,
              filter: `blur(${blur.toFixed(1)}px)`,
              opacity: (fx.opacity ?? 0.9) * (fx.back ? 0.55 + 0.45 * near : 1),
            }}
          />
        );
      })}
    </DepthPlane>
  );
};

const Particles: React.FC<{ fx: Extract<ShotFx, { type: "particles" }>; cam: Cam }> = ({ fx, cam }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const color = fx.color ?? "#ffd7e6";
  return (
    <DepthPlane cam={cam} depth={0.4}>
      {Array.from({ length: fx.count }, (_, i) => {
        const r = (k: string) => random(`pt-${fx.seed ?? 3}-${i}-${k}`);
        const size = (fx.size ?? 5) * (0.4 + r("s"));
        const x = (r("x") + frame * 0.0004 * (r("v") - 0.7) + 1) % 1;
        const y = (r("y") - frame * 0.0006 * r("u") + 1) % 1;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(frame / (14 + r("t") * 30) + r("p") * 6));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * W,
              top: y * H,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: twinkle * 0.8,
              boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </DepthPlane>
  );
};

const Stream: React.FC<{ fx: Extract<ShotFx, { type: "stream" }>; cam: Cam; words?: Word[] }> = ({ fx, cam, words }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const s0 = startFrame(fx, words, fps, 0);
  const emit = Math.round((fx.duration ?? 2) * fps); // frames over which particles leave
  const travel = Math.round(0.9 * fps);
  const colors = fx.colors ?? ["#F5B700", "#B98CFF"];
  const spread = fx.spread ?? 0.05;
  return (
    <DepthPlane cam={cam} depth={fx.depth ?? 0.6}>
      {Array.from({ length: fx.count }, (_, i) => {
        const r = (k: string) => random(`st-${fx.seed ?? 5}-${i}-${k}`);
        const born = s0 + r("b") * emit;
        const t = (frame - born) / travel;
        if (t < 0 || t > 1.6) return null;
        const k = Easing.inOut(Easing.quad)(Math.min(1, t));
        // a slight arc so the stream looks organic, ending scattered around the target
        const arc = Math.sin(k * Math.PI) * (r("a") - 0.5) * spread * 2;
        const ex = fx.to[0] + (r("ex") - 0.5) * spread;
        const ey = fx.to[1] + (r("ey") - 0.5) * spread * 1.6;
        const sx = fx.from[0] + (r("sx") - 0.5) * spread * 0.6;
        const sy = fx.from[1] + (r("sy") - 0.5) * spread * 1.2;
        const x = sx + (ex - sx) * k;
        const y = sy + (ey - sy) * k + arc;
        const size = (fx.size ?? 14) * (0.6 + r("s") * 0.8);
        const color = colors[i % colors.length];
        const fade = interpolate(t, [0, 0.1, 1.1, 1.6], [0, 1, 1, 0], { extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * W,
              top: y * H,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, #fff8, ${color} 45%, ${color}88 100%)`,
              boxShadow: `0 0 ${size}px ${color}`,
              opacity: fade,
            }}
          />
        );
      })}
    </DepthPlane>
  );
};

const Pores: React.FC<{ fx: Extract<ShotFx, { type: "pores" }>; cam: Cam; words?: Word[] }> = ({ fx, cam, words }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const s0 = startFrame(fx, words, fps, 0);
  return (
    <DepthPlane cam={cam} depth={fx.depth ?? 0.6}>
      {fx.points.map((p, i) => {
        const open = spring({ frame: frame - s0 - i * 5, fps, config: { damping: 18, mass: 0.6 } });
        const size = (fx.size ?? 34) * open * (0.8 + random(`pore-${i}`) * 0.5);
        if (size < 1) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p[0] * W - size / 2,
              top: p[1] * H - size * 0.4,
              width: size,
              height: size * 0.8,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at 50% 45%, #0a0005 0%, #1a020a 55%, #5a1020 80%, transparent 100%)",
              boxShadow: "inset 0 0 6px #000, 0 0 10px #ff6a8a88",
            }}
          />
        );
      })}
    </DepthPlane>
  );
};

const Flash: React.FC<{ fx: Extract<ShotFx, { type: "flash" }>; cam: Cam; words?: Word[] }> = ({ fx, cam, words }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const s0 = startFrame(fx, words, fps, 0);
  const f = frame - s0;
  if (f < 0) return null;
  const burst = interpolate(f, [0, 5, 30], [0, 1, fx.hold ? 0.55 : 0], { extrapolateRight: "clamp" });
  const pulse = fx.hold && f > 30 ? 0.55 + 0.25 * Math.sin((f - 30) / 7) : burst;
  const size = fx.size ?? 260;
  const ring = interpolate(f, [0, 24], [0.2, 1.6], { extrapolateRight: "clamp" });
  const ringO = interpolate(f, [0, 24], [0.9, 0], { extrapolateRight: "clamp" });
  return (
    <DepthPlane cam={cam} depth={fx.depth ?? 0.6}>
      <div
        style={{
          position: "absolute",
          left: fx.at[0] * W - size / 2,
          top: fx.at[1] * H - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle, #ffffff 0%, ${fx.color} 22%, ${fx.color}55 48%, transparent 70%)`,
          opacity: pulse,
          mixBlendMode: "screen",
        }}
      />
      {fx.ring !== false && (
        <div
          style={{
            position: "absolute",
            left: fx.at[0] * W - (size * ring) / 2,
            top: fx.at[1] * H - (size * ring) / 2,
            width: size * ring,
            height: size * ring,
            borderRadius: "50%",
            border: `3px solid ${fx.color}`,
            boxShadow: `0 0 20px ${fx.color}`,
            opacity: ringO,
          }}
        />
      )}
    </DepthPlane>
  );
};

const Fx: React.FC<{ fx: ShotFx; cam: Cam; projectPath: string; words?: Word[] }> = ({ fx, cam, projectPath, words }) => {
  switch (fx.type) {
    case "drift":
      return <Drift fx={fx} cam={cam} projectPath={projectPath} />;
    case "particles":
      return <Particles fx={fx} cam={cam} />;
    case "stream":
      return <Stream fx={fx} cam={cam} words={words} />;
    case "pores":
      return <Pores fx={fx} cam={cam} words={words} />;
    case "flash":
      return <Flash fx={fx} cam={cam} words={words} />;
  }
};

// ── labels and the end title ──────────────────────────────────────────────────

const Label: React.FC<{ label: ShotLabel; index: number; target?: Pt; words?: Word[] }> = ({ label, index, target, words }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(label, words, fps, Math.round((0.5 + index * 0.6) * fps));
  const line = interpolate(frame, [s0, s0 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const box = spring({ frame: frame - s0 - 8, fps, config: { damping: 16, mass: 0.7 } });
  // `until`: seconds, or a narration word at which the label leaves
  const end =
    label.until === undefined
      ? undefined
      : startFrame(typeof label.until === "string" ? { cue: label.until } : { start: label.until }, words, fps, Math.round(Number(label.until) * fps) || 0);
  const out = end === undefined ? 1 : interpolate(frame, [end, end + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < s0 || out <= 0) return null;
  const color = TONES[label.tone ?? "white"];
  const bx = label.box[0] * W;
  const by = label.box[1] * H;
  // leader line from the dot on the target to the box (no target: just the box)
  const dot = 0.8 + 0.2 * Math.sin(frame / 6);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {target && (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <line x1={target[0]} y1={target[1]} x2={target[0] + (bx - target[0]) * line} y2={target[1] + (by - target[1]) * line} stroke={color} strokeWidth={2.5} strokeOpacity={0.9} />
          <circle cx={target[0]} cy={target[1]} r={7 * dot} fill={color} />
          <circle cx={target[0]} cy={target[1]} r={16 * dot} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={2} />
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left: bx,
          top: by,
          transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * box})`,
          opacity: box,
          padding: "12px 22px",
          borderRadius: 14,
          backgroundColor: "rgba(8, 8, 20, 0.82)",
          border: `2px solid ${color}`,
          boxShadow: `0 0 24px ${color}55, 0 10px 30px rgba(0,0,0,0.5)`,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 38, color: "#fff", lineHeight: 1.15 }}>{label.text}</div>
        {label.sub && <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 27, color, marginTop: 2 }}>{label.sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Title: React.FC<{ title: NonNullable<Shot["title"]>; words?: Word[] }> = ({ title, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const s0 = startFrame(title, words, fps, 6);
  const f = frame - s0;
  const head = interpolate(f, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const rule = interpolate(f, [14, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const sub = interpolate(f, [26, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const q0 = title.question ? startFrame(title.question, words, fps, s0 + 60) : 0;
  const ask = spring({ frame: frame - q0, fps, config: { damping: 15, mass: 0.7 } });
  const { width: W, height: H } = useVideoConfig();
  const right = title.side === "right";
  const center = title.side === "center";
  const [line1, ...rest] = title.subtitle?.split(". ") ?? [];
  return (
    <AbsoluteFill
      style={{
        justifyContent: center && H > W ? "flex-start" : "center",
        alignItems: center ? "center" : right ? "flex-end" : "flex-start",
        padding: center && H > W ? "300px 80px 0" : `0 ${H > W ? 90 : 150}px`,
      }}
    >
      <div style={{ maxWidth: center ? W - 160 : 900, textAlign: center ? "center" : right ? "right" : "left" }}>
        <div
          style={{
            fontFamily: theme.headlineFont,
            fontSize: title.size ?? 138,
            lineHeight: 1,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: interpolate(head, [0, 1], [24, 4]),
            opacity: head,
            filter: `blur(${(1 - head) * 12}px)`,
            textShadow: "0 0 40px rgba(79,168,255,0.45), 0 8px 30px rgba(0,0,0,0.6)",
          }}
        >
          {title.text}
        </div>
        <div
          style={{
            height: 6,
            width: 420 * rule,
            margin: center ? "34px auto" : right ? "34px 0 34px auto" : "34px 0",
            borderRadius: 3,
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}00)`,
            boxShadow: `0 0 18px ${theme.accent}`,
          }}
        />
        {title.subtitle && (
          <div style={{ fontFamily: theme.bodyFont, fontWeight: 700, fontSize: 50, lineHeight: 1.3, color: "#E8ECF5", opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>
            {line1}
            {rest.length ? "." : ""}
            {rest.length > 0 && <br />}
            {rest.join(". ")}
          </div>
        )}
        {title.question && frame >= q0 && (
          <div
            style={{
              display: "inline-block",
              marginTop: 44,
              padding: "14px 26px",
              borderRadius: 14,
              border: `2px solid ${theme.accent}`,
              backgroundColor: "rgba(8, 8, 20, 0.75)",
              fontFamily: theme.bodyFont,
              fontWeight: 800,
              fontSize: 40,
              color: theme.accent,
              opacity: ask,
              transform: `translateY(${(1 - ask) * 24}px)`,
            }}
          >
            {title.question.text}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// A color wash over the shot; `pulse` makes it breathe (warnings).
const Tint: React.FC<{ tint: NonNullable<Shot["tint"]> }> = ({ tint }) => {
  const frame = useCurrentFrame();
  const t = typeof tint === "string" ? { color: tint } : tint;
  const breathe = t.pulse ? 0.75 + 0.25 * Math.sin(frame / 12) : 1;
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: t.color, mixBlendMode: "multiply", opacity: (t.strength ?? 0.35) * breathe }} />
      {t.pulse && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 45%, ${t.color} 120%)`, opacity: 0.8 * breathe }} />}
    </>
  );
};

// A numbered list (a process), each step lighting up when the narration reaches it.
const Steps: React.FC<{ steps: NonNullable<Shot["steps"]>; words?: Word[] }> = ({ steps, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const starts = steps.items.map((it, i) => startFrame(it, words, fps, Math.round((0.4 + i * 0.9) * fps)));
  const current = starts.filter((s) => frame >= s).length - 1;
  const right = steps.side === "right";
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: right ? "flex-end" : "flex-start", padding: "0 130px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {steps.title && (
          <div style={{ fontFamily: theme.headlineFont, fontSize: 60, color: "#fff", textTransform: "uppercase", letterSpacing: 3, marginBottom: 10, opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }) }}>
            {steps.title}
          </div>
        )}
        {steps.items.map((it, i) => {
          const enter = spring({ frame: frame - starts[i], fps, config: { damping: 15, mass: 0.7 } });
          const active = i === current;
          const done = i < current;
          const color = active ? theme.accent : "#4FA8FF";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                opacity: frame < starts[i] ? 0.22 : 0.55 + 0.45 * (active ? 1 : done ? 0.6 : 0),
                transform: `translateX(${(1 - enter) * (right ? 40 : -40)}px) scale(${active ? 1 + 0.04 * enter : 1})`,
                transformOrigin: right ? "right center" : "left center",
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  border: `3px solid ${color}`,
                  backgroundColor: active ? `${theme.accent}26` : "rgba(8, 8, 20, 0.7)",
                  boxShadow: active ? `0 0 26px ${theme.accent}` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: theme.headlineFont,
                  fontSize: 42,
                  color: "#fff",
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 48, color: "#fff", textShadow: "0 4px 20px rgba(0,0,0,0.7)" }}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── the shot ──────────────────────────────────────────────────────────────────

export const ShotScene: React.FC<SceneProps> = ({ scene, projectPath, words }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: W, height: H } = useVideoConfig();
  const shot = scene.shot;
  if (!shot) return <AbsoluteFill style={{ backgroundColor: "#07040c" }} />;

  const c = shot.camera ?? {};
  const ct = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: EASE[c.ease ?? "inOut"] });
  const a = { zoom: 1, x: 0.5, y: 0.5, ...c.from };
  const b = { ...a, ...c.to };
  const cam: Cam = { zoom: a.zoom + (b.zoom - a.zoom) * ct, x: a.x + (b.x - a.x) * ct, y: a.y + (b.y - a.y) * ct };

  const back = (shot.fx ?? []).filter((f) => f.type === "drift" && f.back);
  const front = (shot.fx ?? []).filter((f) => !(f.type === "drift" && f.back));

  // label targets in screen pixels — a followed layer's current position, through the camera
  const targetOf = (l: ShotLabel): Pt | undefined => {
    if (!l.follow && !l.at) return undefined;
    const layer = l.follow ? shot.layers.find((x) => x.id === l.follow) : undefined;
    if (layer) {
      const s = layerState(layer, frame, fps, durationInFrames, words);
      const off = l.offset ?? [0, 0];
      const p = toScreen([s.x + off[0] * s.scale, s.y + off[1] * s.scale], cam, layer.depth ?? 0.5, W, H);
      return [p[0] + s.dx, p[1] + s.dy];
    }
    return toScreen(l.at ?? [0.5, 0.5], cam, l.depth ?? 0.5, W, H);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#07040c", overflow: "hidden" }}>
      {/* the picture: layers and effects, optionally color-graded */}
      <AbsoluteFill style={{ filter: shot.grade }}>
        {back.map((f, i) => (
          <Fx key={`b${i}`} fx={f} cam={cam} projectPath={projectPath} words={words} />
        ))}
        {shot.layers.map((l, i) => (
          <Layer key={i} layer={l} cam={cam} projectPath={projectPath} words={words} />
        ))}
        {front.map((f, i) => (
          <Fx key={`f${i}`} fx={f} cam={cam} projectPath={projectPath} words={words} />
        ))}
      </AbsoluteFill>
      {shot.tint && <Tint tint={shot.tint} />}
      {/* cinematic vignette, plus a soft dark band under the subtitles */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 78%, rgba(0,0,0,0.5) 100%)" }} />
      {shot.labels?.map((l, i) => (
        <Label key={i} label={l} index={i} target={targetOf(l)} words={words} />
      ))}
      {shot.steps && <Steps steps={shot.steps} words={words} />}
      {shot.tracker && <Tracker data={shot.tracker} />}
      {shot.card && <Card data={shot.card} words={words} />}
      {shot.stats && <Stats data={shot.stats} words={words} />}
      {shot.bars && <Bars data={shot.bars} words={words} />}
      {shot.timeline && <Timeline data={shot.timeline} words={words} />}
      {shot.quote && <QuoteCard data={shot.quote} words={words} />}
      {shot.sfx && <ShotSfx data={shot.sfx} words={words} />}
      {shot.title && <Title title={shot.title} words={words} />}
      {shot.brand && <BrandCard data={shot.brand} words={words} />}
    </AbsoluteFill>
  );
};

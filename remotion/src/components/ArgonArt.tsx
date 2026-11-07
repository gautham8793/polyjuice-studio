import { AbsoluteFill, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EmphasisText } from "./EmphasisText";
import { assetSrc } from "./SceneVisual";
import { useTheme } from "../theme";
import type { Scene, Word } from "../types";

const cueFrame = (cue: string | undefined, words: Word[] | undefined, fps: number, fallback: number) => {
  const c = cue?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const w = c ? words?.find((x) => x.text.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(c)) : undefined;
  return w ? Math.round(w.start * fps) : fallback;
};

// Subtle CRT dot-grid + scanline overlay used across all 5 Argon scenes.
const CrtOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)",
      backgroundSize: "24px 24px",
    }}
  />
);

// 3D perspective glowing red code web (used in Scene 1 Hook and at the end of Scene 5 for the seamless loop).
const RedCodeWeb: React.FC<{ progress: number; intensity?: number }> = ({ progress, intensity = 1 }) => {
  const zoom = interpolate(progress, [0, 1], [1, 1.24]);
  const nodes = [
    { x: 180, y: 360, label: "core::alloc" },
    { x: 860, y: 320, label: "ffi::bridge" },
    { x: 540, y: 520, label: "legacy_monolith.cpp" },
    { x: 230, y: 780, label: "unsafe_ptr*" },
    { x: 830, y: 820, label: "thread_pool" },
    { x: 520, y: 1060, label: "segfault_0x7f" },
    { x: 260, y: 1320, label: "heap_overflow" },
    { x: 820, y: 1280, label: "race_cond" },
  ];
  const edges = [
    [0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5], [3, 6], [4, 7], [5, 6], [5, 7], [0, 3], [1, 4],
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060812",
        backgroundImage: "radial-gradient(circle at 50% 48%, rgba(229, 56, 59, 0.28) 0%, rgba(6, 8, 18, 0.96) 72%)",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 48%", opacity: intensity }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          {/* Perspective grid lines */}
          {Array.from({ length: 12 }, (_, i) => {
            const x = i * 100 - 40;
            return (
              <line
                key={`v-${i}`}
                x1={540 + (x - 540) * 0.25}
                y1={180}
                x2={x}
                y2={1820}
                stroke="#FF2E4C"
                strokeOpacity={0.14}
                strokeWidth={2}
              />
            );
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const y = 240 + i * 150;
            return <line key={`h-${i}`} x1={60} y1={y} x2={1020} y2={y} stroke="#FF2E4C" strokeOpacity={0.12} strokeWidth={2} />;
          })}
          {/* Glowing web edges */}
          {edges.map(([a, b], i) => {
            const na = nodes[a];
            const nb = nodes[b];
            const pulse = 0.45 + 0.45 * Math.sin(progress * Math.PI * 6 + i * 0.9);
            return (
              <g key={i}>
                <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#FF2E4C" strokeWidth={5} strokeOpacity={pulse} />
                <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#FF99A8" strokeWidth={1.5} strokeOpacity={pulse * 0.8} />
              </g>
            );
          })}
          {/* Glowing code nodes */}
          {nodes.map((n, i) => {
            const r = i === 2 ? 22 : 14;
            return (
              <g key={n.label}>
                <circle cx={n.x} cy={n.y} r={r * 2.4} fill="#FF2E4C" fillOpacity={0.22} />
                <circle cx={n.x} cy={n.y} r={r} fill="#FF2E4C" stroke="#FFFFFF" strokeWidth={3} />
                <text
                  x={n.x}
                  y={n.y - r - 14}
                  textAnchor="middle"
                  fill="#FFB3BE"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontWeight={700}
                  fontSize={24}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Optional background asset helper (supports both video clips via OffthreadVideo and images via Img with Ken Burns motion)
const BrollLayer: React.FC<{ scene: Scene; projectPath: string; opacity?: number }> = ({ scene, projectPath, opacity = 0.48 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!scene.visual.asset) return null;
  const src = staticFile(assetSrc(scene.visual.asset, projectPath));
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.15]);
  const isVideo = scene.visual.type === "clip" || /\.(mp4|webm|mov)$/i.test(scene.visual.asset);

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity }}>
      {isVideo ? (
        <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      ) : (
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      )}
    </AbsoluteFill>
  );
};

// [0:00 – 0:04] Scene 1: 3D glowing red code web + an "output limit reached" error card at trigger frame.
// Facts for every scene: projects/2026-11-gemini-argon/research.md (Google blog + model card).
const CrashHookScene: React.FC<{ scene: Scene; projectPath: string; words?: Word[] }> = ({ scene, projectPath, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const triggerFrame = cueFrame("room", words, fps, Math.min(54, Math.floor(durationInFrames * 0.48)));
  const cardPop = spring({ frame: frame - triggerFrame, fps, config: { damping: 12, mass: 0.7 } });
  const glitch = frame >= triggerFrame - 5 && frame <= triggerFrame + 6 ? Math.sin(frame * 19) * 18 : 0;

  return (
    <AbsoluteFill>
      <RedCodeWeb progress={frame / durationInFrames} />
      <BrollLayer scene={scene} projectPath={projectPath} opacity={0.42} />

      {/* Top headline hook */}
      <div style={{ position: "absolute", top: 140, left: 60, right: 60, textAlign: "center", transform: `translateX(${glitch}px)` }}>
        <div
          style={{
            display: "inline-block",
            padding: "8px 22px",
            borderRadius: 999,
            backgroundColor: "rgba(255, 46, 76, 0.22)",
            border: "2px solid #FF2E4C",
            color: "#FF8FA0",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 3,
            marginBottom: 20,
          }}
        >
          ● LEGACY C++ CODEBASE · REWRITE REQUEST
        </div>
        <div
          style={{
            fontFamily: theme.headlineFont,
            fontSize: 136,
            lineHeight: 0.95,
            textTransform: "uppercase",
            color: theme.text,
            textShadow: "0 12px 40px rgba(0,0,0,0.8)",
          }}
        >
          <EmphasisText text={scene.onScreenText} />
        </div>
      </div>

      {/* Glitch scanline bars around triggerFrame */}
      {glitch !== 0 && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 680, left: 0, right: 0, height: 28, backgroundColor: "#FF2E4C", opacity: 0.65 }} />
          <div style={{ position: "absolute", top: 1020, left: 0, right: 0, height: 18, backgroundColor: "#00E5FF", opacity: 0.5 }} />
        </AbsoluteFill>
      )}

      {/* "Output limit reached" error card */}
      {frame >= triggerFrame - 2 && (
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            top: 630,
            backgroundColor: "#1E222B",
            borderRadius: 28,
            border: "3px solid #FF4D5E",
            boxShadow: "0 36px 90px rgba(0,0,0,0.85), 0 0 50px rgba(255, 46, 76, 0.35)",
            overflow: "hidden",
            transform: `scale(${0.7 + 0.3 * cardPop}) translateY(${(1 - cardPop) * 90}px) translateX(${glitch * 0.5}px)`,
            opacity: cardPop,
          }}
        >
          {/* Browser window bar */}
          <div style={{ backgroundColor: "#14171F", padding: "18px 26px", display: "flex", alignItems: "center", gap: 14, borderBottom: "2px solid #2C313E" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#FF5F56" }} />
            <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
            <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#27C93F" }} />
            <div
              style={{
                marginLeft: 16,
                flex: 1,
                backgroundColor: "#0D0F14",
                borderRadius: 10,
                padding: "8px 18px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 22,
                color: "#9CA3AF",
              }}
            >
              ai-model · rewrite legacy_core/ → rust/
            </div>
          </div>

          <div style={{ padding: "44px 48px 50px", display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Sad tab icon */}
            <svg width={88} height={88} viewBox="0 0 88 88">
              <rect x="8" y="12" width="72" height="64" rx="10" fill="none" stroke="#FF4D5E" strokeWidth="6" />
              <path d="M26 34 L36 44 M36 34 L26 44 M52 34 L62 44 M62 34 L52 44" stroke="#FF4D5E" strokeWidth="6" strokeLinecap="round" />
              <path d="M28 60 C34 52, 54 52, 60 60" fill="none" stroke="#FF4D5E" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <div style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 54, color: "#FFFFFF", lineHeight: 1.05 }}>
              Output limit reached
            </div>
            <div style={{ fontFamily: theme.bodyFont, fontWeight: 600, fontSize: 30, color: "#9CA3AF", lineHeight: 1.35 }}>
              The answer stopped at 64,000 tokens. The rewrite was cut off halfway.
            </div>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#12151C",
                padding: "16px 22px",
                borderRadius: 14,
                border: "1px solid #2E3444",
              }}
            >
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 24, color: "#FF6B7A", fontWeight: 700 }}>
                MAX_OUTPUT_TOKENS · TRUNCATED
              </span>
              <span
                style={{
                  backgroundColor: "#3B82F6",
                  color: "#FFFFFF",
                  fontFamily: theme.bodyFont,
                  fontWeight: 800,
                  fontSize: 24,
                  padding: "10px 26px",
                  borderRadius: 10,
                }}
              >
                Retry
              </span>
            </div>
          </div>
        </div>
      )}
      <CrtOverlay />
    </AbsoluteFill>
  );
};

// [0:04 – 0:15] Scene 2: Split-screen top AI image/video + bottom 800K-line migration counter (Fuchsia Zircon kernel)
// & the libgav1 decoder badge: 2.7x faster than the earlier Rust port.
const RefactorSplitScene: React.FC<{ scene: Scene; projectPath: string; words?: Word[] }> = ({ scene, projectPath, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const slowZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.15]);
  const rustCue = cueFrame("rust", words, fps, 45);
  const speedCue = cueFrame("two", words, fps, 70);

  const sliceProgress = interpolate(frame, [12, Math.max(rustCue + 35, 95)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const LINES = 800_000; // "up to 800K+ lines for the Fuchsia Zircon kernel"
  const legacyRemaining = Math.round(LINES * (1 - sliceProgress));
  const rustConverted = LINES - legacyRemaining;
  const speedPop = spring({ frame: frame - speedCue, fps, config: { damping: 11, mass: 0.7 } });
  const speedValue = interpolate(frame, [speedCue, speedCue + 28], [1.0, 2.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#080B14" }}>
      {/* Top Half: Legacy Code Monolith / Stressed Dev Visual with Ken Burns Zoom */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 830, overflow: "hidden", borderBottom: `4px solid ${theme.accent}` }}>
        <AbsoluteFill style={{ transform: `scale(${slowZoom})` }}>
          {scene.visual.asset ? (
            <BrollLayer scene={scene} projectPath={projectPath} opacity={0.82} />
          ) : (
            <RedCodeWeb progress={frame / durationInFrames} intensity={0.75} />
          )}
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,11,20,0.75) 0%, rgba(8,11,20,0.15) 45%, rgba(8,11,20,0.92) 100%)" }} />

        <div style={{ position: "absolute", top: 120, left: 60, right: 60 }}>
          <div style={{ fontFamily: theme.headlineFont, fontSize: 118, lineHeight: 0.95, textTransform: "uppercase", color: "#FFFFFF" }}>
            <EmphasisText text={scene.onScreenText} />
          </div>
        </div>

        {/* Floating migration status pill on the split boundary */}
        <div
          style={{
            position: "absolute",
            bottom: 26,
            left: 60,
            right: 60,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              backgroundColor: "rgba(14, 18, 30, 0.9)",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              padding: "10px 20px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontWeight: 800,
              fontSize: 24,
              color: "#E2E8F0",
            }}
          >
            C/C++ → MEMORY-SAFE RUST
          </span>
          <span
            style={{
              backgroundColor: "#22C55E",
              color: "#052E16",
              borderRadius: 12,
              padding: "10px 20px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontWeight: 900,
              fontSize: 24,
            }}
          >
            {Math.round(sliceProgress * 100)}% REFACTORED
          </span>
        </div>
      </div>

      {/* Bottom Half: Live Telemetry Counter + 2.7x Speedup Badge */}
      <div style={{ position: "absolute", top: 850, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 26 }}>
        <div
          style={{
            backgroundColor: "#111624",
            borderRadius: 26,
            padding: "30px 36px",
            border: "2px solid #232D45",
            boxShadow: "0 24px 50px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontSize: 25, color: "#94A3B8" }}>
              ZIRCON KERNEL · C/C++ LINES LEFT
            </span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 25, color: "#38BDF8" }}>
              +{rustConverted.toLocaleString("en-US")} rs
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: theme.headlineFont,
              fontSize: 124,
              lineHeight: 1,
              color: legacyRemaining === 0 ? "#22C55E" : "#FFFFFF",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {legacyRemaining.toLocaleString("en-US")} <span style={{ fontSize: 52, color: "#94A3B8" }}>LOC</span>
          </div>
          {/* Slicing progress bar */}
          <div style={{ marginTop: 20, height: 22, borderRadius: 999, backgroundColor: "#1E293B", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${sliceProgress * 100}%`, height: "100%", backgroundColor: "#22C55E" }} />
            <div style={{ width: `${(1 - sliceProgress) * 100}%`, height: "100%", backgroundColor: "#EF4444", opacity: 0.45 }} />
          </div>
        </div>

        {/* 2.7x Speed Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(34, 197, 94, 0.14)",
            border: "3px solid #22C55E",
            borderRadius: 26,
            padding: "26px 36px",
            transform: `scale(${0.82 + 0.18 * speedPop}) translateY(${(1 - speedPop) * 50}px)`,
            opacity: Math.max(0.25, speedPop),
            boxShadow: speedPop > 0.5 ? "0 0 44px rgba(34, 197, 94, 0.28)" : undefined,
          }}
        >
          <div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 24, color: "#4ADE80", letterSpacing: 2 }}>
              ▲ libgav1 VIDEO DECODER
            </div>
            <div style={{ marginTop: 6, fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 36, color: "#FFFFFF" }}>
              vs the earlier Rust port · identical output
            </div>
          </div>
          <div
            style={{
              backgroundColor: "#22C55E",
              color: "#052E16",
              fontFamily: theme.headlineFont,
              fontSize: 104,
              lineHeight: 0.95,
              padding: "16px 32px 10px",
              borderRadius: 20,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {speedValue.toFixed(1)}× FASTER
          </div>
        </div>
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

// [0:15 – 0:26] Scene 3: output limit, previous models 64K vs Argon 1M tokens + a code editor typing the request.
const TokenEditorScene: React.FC<{ scene: Scene; words?: Word[] }> = ({ scene, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stdSpring = spring({ frame: frame - 10, fps, config: { damping: 15 } });
  const millionCue = cueFrame("million", words, fps, 36);
  const argonSpring = spring({ frame: frame - millionCue, fps, config: { damping: 11, mass: 0.75 } });
  const thinkCue = cueFrame("thinking", words, fps, 68);

  const codeTarget = `const response = await ai.models.generateContent({\n  model: "gemini-4-argon",\n  contents: entireCodebase,\n  config: { maxOutputTokens: 1_000_000 }\n});`;
  const charsShown = Math.floor(
    interpolate(frame, [Math.max(18, thinkCue - 25), thinkCue + 55], [0, codeTarget.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const typed = codeTarget.slice(0, charsShown);

  const tokenCount = Math.round(
    interpolate(argonSpring, [0, 1], [64_000, 1_000_000], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#090D16", padding: "130px 64px 0" }}>
      <div style={{ fontFamily: theme.headlineFont, fontSize: 118, lineHeight: 0.95, textTransform: "uppercase", color: "#FFFFFF" }}>
        <EmphasisText text={scene.onScreenText} />
      </div>

      {/* 64K vs 1,000,000 Token Bar Chart Card */}
      <div
        style={{
          marginTop: 38,
          backgroundColor: "#111726",
          borderRadius: 26,
          padding: "32px 36px",
          border: "2px solid #243049",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* Standard LLM 64K bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 30, color: "#94A3B8" }}>
            <span>Previous Gemini models</span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#EF4444" }}>64,000 TOKEN OUTPUT</span>
          </div>
          <div style={{ marginTop: 12, height: 42, borderRadius: 12, backgroundColor: "#1E293B", overflow: "hidden" }}>
            <div style={{ width: `${12 * stdSpring}%`, height: "100%", backgroundColor: "#EF4444", borderRadius: 12 }} />
          </div>
        </div>

        {/* Gemini Argon 1,000,000 Token bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 34, color: "#FFFFFF" }}>
            <span>Gemini 4 Argon</span>
            <span style={{ fontFamily: theme.headlineFont, fontSize: 78, lineHeight: 1, color: theme.accent }}>
              {tokenCount.toLocaleString("en-US")} TOKENS
            </span>
          </div>
          <div style={{ marginTop: 12, height: 64, borderRadius: 14, backgroundColor: "#1E293B", overflow: "hidden", position: "relative" }}>
            <div
              style={{
                width: `${Math.min(100, 100 * argonSpring)}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${theme.accent} 0%, #22C55E 100%)`,
                borderRadius: 14,
                boxShadow: `0 0 32px ${theme.accent}88`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Simulated dark-mode code editor typing the 1M-token request */}
      <div
        style={{
          marginTop: 34,
          backgroundColor: "#0D1117",
          borderRadius: 26,
          border: `3px solid ${frame >= thinkCue ? theme.accent : "#262F40"}`,
          boxShadow: "0 28px 60px rgba(0,0,0,0.65)",
          overflow: "hidden",
        }}
      >
        <div style={{ backgroundColor: "#161B22", padding: "16px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #21262D" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FF5F56" }} />
            <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
            <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#27C93F" }} />
            <span style={{ marginLeft: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 24, fontWeight: 700, color: "#E6EDF3" }}>
              argon_config.ts
            </span>
          </div>
          <span
            style={{
              backgroundColor: frame >= thinkCue ? theme.accent : "#21262D",
              color: frame >= thinkCue ? theme.textOnAccent : "#8B949E",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontWeight: 900,
              fontSize: 22,
              padding: "6px 16px",
              borderRadius: 8,
            }}
          >
            1M-TOKEN OUTPUT
          </span>
        </div>

        <pre
          style={{
            margin: 0,
            padding: "30px 34px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 31,
            lineHeight: 1.52,
            color: "#E6EDF3",
            whiteSpace: "pre-wrap",
          }}
        >
          {typed.split("\n").map((line, i) => {
            const isThinking = line.includes("maxOutputTokens");
            return (
              <div
                key={i}
                style={{
                  backgroundColor: isThinking ? "rgba(245, 183, 0, 0.16)" : "transparent",
                  borderLeft: isThinking ? `6px solid ${theme.accent}` : "6px solid transparent",
                  paddingLeft: 14,
                  marginLeft: -14,
                  color: isThinking ? theme.accent : "#E6EDF3",
                  fontWeight: isThinking ? 900 : 600,
                }}
              >
                <span style={{ color: "#484F58", marginRight: 20, userSelect: "none" }}>{i + 1}</span>
                {line}
                {i === typed.split("\n").length - 1 && (
                  <span style={{ display: "inline-block", width: 16, height: 32, backgroundColor: theme.accent, marginLeft: 4, verticalAlign: "middle" }} />
                )}
              </div>
            );
          })}
        </pre>
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

// [0:26 – 0:48] Scene 4: security agent terminal (find → validate → patch) + a checklist of bugs flipping to PATCHED.
// The logs and files are an illustrative demo, labelled on screen; Google describes the capability, not this run.
const AutonomousIdeScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const routes = [
    { file: "src/parser.c", err: "Heap Overflow", ms: "verified" },
    { file: "src/auth.c", err: "Use-After-Free", ms: "verified" },
    { file: "src/net/http.c", err: "Int Overflow", ms: "verified" },
    { file: "src/codec/frame.c", err: "OOB Read", ms: "verified" },
    { file: "src/session.c", err: "Race Cond", ms: "verified" },
  ];

  const logs = [
    "$ argon-agent audit ./src --find --validate --patch",
    "[FIND]   Scanning parser.c for memory bugs...",
    "[FOUND]  Heap overflow in parse_header() !",
    "[CHECK]  Reproduced with a crafted input",
    "[PATCH]  Bounds check added to parse_header()",
    "[TEST]   ✓ parser fuzz suite passed",
    "[FOUND]  Use-after-free in auth.c session_end()",
    "[PATCH]  Ownership fixed, pointer cleared",
    "[TEST]   ✓ auth suite passed",
    "[DONE]   ✓ 5 vulnerabilities found, verified, patched",
  ];

  const visibleLogs = Math.max(2, Math.min(logs.length, Math.floor(interpolate(frame, [6, durationInFrames * 0.78], [2, logs.length], { extrapolateRight: "clamp" }))));

  return (
    <AbsoluteFill style={{ backgroundColor: "#080B12", padding: "126px 52px 0" }}>
      <div style={{ fontFamily: theme.headlineFont, fontSize: 108, lineHeight: 0.95, textTransform: "uppercase", color: "#FFFFFF" }}>
        <EmphasisText text={scene.onScreenText} />
      </div>

      {/* Top Panel: security agent terminal */}
      <div
        style={{
          marginTop: 28,
          backgroundColor: "#0D1117",
          borderRadius: 22,
          border: "2px solid #232C3D",
          overflow: "hidden",
          boxShadow: "0 20px 44px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ backgroundColor: "#161B22", padding: "12px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #21262D" }}>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 22, color: "#94A3B8" }}>
            ● SECURITY AGENT · FIND → VALIDATE → PATCH
          </span>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 22, color: "#22C55E" }}>
            ILLUSTRATIVE DEMO
          </span>
        </div>
        <div style={{ padding: "20px 26px", height: 320, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8 }}>
          {logs.slice(Math.max(0, visibleLogs - 6), visibleLogs).map((line, i) => {
            const isPass = line.includes("✓");
            const isPatch = line.includes("[PATCH]");
            const isTrace = line.includes("[FOUND]");
            return (
              <div
                key={line + i}
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 24,
                  fontWeight: 700,
                  color: isPass ? "#4ADE80" : isPatch ? theme.accent : isTrace ? "#F87171" : "#CBD5E1",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Panel: checklist flipping from red bug to green PATCHED with spring() physics */}
      <div
        style={{
          marginTop: 26,
          backgroundColor: "#111724",
          borderRadius: 24,
          border: "2px solid #26324B",
          padding: "22px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 24, color: "#94A3B8" }}>
            SECURITY AUDIT · src/
          </span>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 24, color: theme.accent }}>
            AUTO-PATCH
          </span>
        </div>

        {routes.map((r, i) => {
          const flipAt = Math.round(durationInFrames * 0.18) + i * Math.round((durationInFrames * 0.54) / routes.length);
          const flipped = frame >= flipAt;
          const flipSpring = spring({ frame: frame - flipAt, fps, config: { damping: 14, mass: 0.65 } });
          return (
            <div
              key={r.file}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 22px",
                borderRadius: 16,
                backgroundColor: flipped ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `2px solid ${flipped ? "#22C55E" : "#EF4444"}`,
                transform: `scale(${flipped ? 0.96 + 0.04 * flipSpring : 1})`,
              }}
            >
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800, fontSize: 27, color: "#F8FAFC" }}>
                {r.file}
              </span>
              {flipped ? (
                <span
                  style={{
                    backgroundColor: "#22C55E",
                    color: "#052E16",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontWeight: 900,
                    fontSize: 23,
                    padding: "6px 18px",
                    borderRadius: 999,
                    transform: `scale(${flipSpring})`,
                  }}
                >
                  ✓ PATCHED · {r.ms}
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: "#EF4444",
                    color: "#FFFFFF",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontWeight: 900,
                    fontSize: 23,
                    padding: "6px 18px",
                    borderRadius: 999,
                  }}
                >
                  ✗ {r.err}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

// [0:48 – 1:00] Scene 5: DeepSWE v1.1 results card (Google model card, Oct 2026) slams on, then the camera zooms into
// frame 0 of the glowing red code web for the seamless loop.
const DeepSweLoopScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const slam = spring({ frame: frame - 6, fps, config: { damping: 11, mass: 0.8 } });
  const loopStart = Math.max(durationInFrames - 42, Math.floor(durationInFrames * 0.78));
  const loopProgress = interpolate(frame, [loopStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * t,
  });
  const cameraScale = interpolate(loopProgress, [0, 1], [1, 9.5]);
  const cardOpacity = interpolate(loopProgress, [0, 0.72], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const entries = [
    { rank: "#1", model: "Gemini 4 Argon", score: 77.9, highlight: true },
    { rank: "#2", model: "Claude Opus 5.5", score: 74.2, highlight: false },
    { rank: "#3", model: "GPT-6 Astra", score: 74.1, highlight: false },
    { rank: "#4", model: "Claude Fable 5.1", score: 67.4, highlight: false },
  ];

  return (
    <AbsoluteFill>
      {/* Background is the exact frame-0 RedCodeWeb so zooming through the card loops seamlessly into Scene 1 */}
      <RedCodeWeb progress={loopProgress * 0.15} intensity={0.55 + 0.45 * loopProgress} />

      <AbsoluteFill
        style={{
          padding: "135px 60px 0",
          transform: `scale(${cameraScale})`,
          transformOrigin: "50% 48%",
          opacity: cardOpacity,
        }}
      >
        <div style={{ fontFamily: theme.headlineFont, fontSize: 118, lineHeight: 0.95, textTransform: "uppercase", color: "#FFFFFF", textAlign: "center" }}>
          <EmphasisText text={scene.onScreenText} />
        </div>

        {/* DeepSWE v1.1 results card (Google model card) */}
        <div
          style={{
            marginTop: 42,
            backgroundColor: "#101522",
            borderRadius: 30,
            border: `4px solid ${theme.accent}`,
            padding: "34px 36px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
            transform: `scale(${interpolate(slam, [0, 1], [1.45, 1])})`,
            opacity: slam,
            display: "flex",
            flexDirection: "column",
            gap: 26,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #232E47", paddingBottom: 18 }}>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 900, fontSize: 28, color: theme.accent, letterSpacing: 2 }}>
              ★ DEEPSWE v1.1 RESULTS
            </span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontSize: 22, color: "#94A3B8" }}>
              GOOGLE-REPORTED
            </span>
          </div>

          {entries.map((e, i) => {
            const barGrow = spring({ frame: frame - 14 - i * 6, fps, config: { damping: 16 } });
            return (
              <div
                key={e.model}
                style={{
                  backgroundColor: e.highlight ? "rgba(245, 183, 0, 0.14)" : "#161E31",
                  border: `3px solid ${e.highlight ? theme.accent : "#26334D"}`,
                  borderRadius: 20,
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span
                      style={{
                        backgroundColor: e.highlight ? theme.accent : "#26334D",
                        color: e.highlight ? theme.textOnAccent : "#94A3B8",
                        fontFamily: theme.headlineFont,
                        fontSize: 44,
                        lineHeight: 1,
                        padding: "6px 14px 4px",
                        borderRadius: 10,
                      }}
                    >
                      {e.rank}
                    </span>
                    <span style={{ fontFamily: theme.bodyFont, fontWeight: 900, fontSize: 31, color: "#FFFFFF" }}>{e.model}</span>
                  </div>
                  <span style={{ fontFamily: theme.headlineFont, fontSize: 54, lineHeight: 1, color: e.highlight ? theme.accent : "#CBD5E1" }}>
                    {(e.score * barGrow).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 18, borderRadius: 999, backgroundColor: "#0B0F19", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${e.score * barGrow}%`,
                      height: "100%",
                      backgroundColor: e.highlight ? theme.accent : "#475569",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

export const ArgonScene: React.FC<{ scene: Scene; projectPath: string; words?: Word[] }> = ({ scene, projectPath, words }) => {
  switch (scene.argon) {
    case "crash-hook":
      return <CrashHookScene scene={scene} projectPath={projectPath} words={words} />;
    case "refactor-split":
      return <RefactorSplitScene scene={scene} projectPath={projectPath} words={words} />;
    case "token-editor":
      return <TokenEditorScene scene={scene} words={words} />;
    case "autonomous-ide":
      return <AutonomousIdeScene scene={scene} />;
    case "deepswe-loop":
      return <DeepSweLoopScene scene={scene} />;
    default:
      return null;
  }
};

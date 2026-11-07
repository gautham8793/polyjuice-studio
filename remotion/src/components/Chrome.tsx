import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import type { Branding, Series } from "../types";

// Persistent overlay for the whole video: progress bar, series badge, channel name, source line.
// How the channel name and source appear is set by `branding` (channel default + per-video override).
export const Chrome: React.FC<{
  hideWatermarkFrom?: number;
  series?: Series;
  branding: Branding;
  progressBar?: boolean;
  introFrom?: number; // frame the intro card slides in (resolved from branding.introAt by the engine)
}> = ({ hideWatermarkFrom = Infinity, series, branding, progressBar = true, introFrom = 8 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const theme = useTheme();
  const progress = frame / durationInFrames;
  const beforeOutro = frame < hideWatermarkFrom;
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const sourceText = series?.source
    ? `Source: ${series.source}${series.asOf ? ` · as of ${series.asOf}` : ""}`
    : branding.sourceText?.trim() || "";
  const small = { fontFamily: theme.bodyFont, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" as const };

  // "intro": a lower-third card that slides in at `introFrom` for ~3 s, or ~4.5 s with the Subscribe callout
  const cta = branding.introCta === "subscribe";
  const introLength = Math.round((cta ? 4.5 : 3) * fps);
  const introIn = spring({ frame: frame - introFrom, fps, config: { damping: 16 } });
  const introOut = spring({ frame: frame - introFrom - introLength, fps, config: { damping: 16 } });
  const intro = introIn - introOut;
  // Subscribe button: pops in, gets "tapped" ~1.6 s later and flips to Subscribed
  const tapAt = introFrom + Math.round(1.6 * fps);
  const tapped = frame >= tapAt;
  const press = interpolate(frame, [tapAt - 4, tapAt, tapAt + 6], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ripple = interpolate(frame, [tapAt, tapAt + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tall = height > width; // Shorts: keep clear of YouTube's bottom UI

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {series && (
        <div style={{ position: "absolute", top: 44, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: fadeIn }}>
          <div
            style={{
              ...small,
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 999,
              backgroundColor: `${theme.background}CC`,
              border: `2px solid ${theme.text}33`,
              fontWeight: 900,
              fontSize: 28,
              color: theme.text,
            }}
          >
            <span>{series.name}</span>
            <span style={{ color: theme.accent }}>
              Part {series.part}/{series.total}
            </span>
          </div>
        </div>
      )}

      {/* source line */}
      {sourceText && beforeOutro && branding.source === "footer" && (
        <div style={{ ...small, position: "absolute", bottom: 120, width: "100%", textAlign: "center", fontSize: 24, color: theme.text, opacity: 0.55 }}>
          {sourceText}
        </div>
      )}
      {sourceText && beforeOutro && branding.source === "chip" && (
        <div
          style={{
            ...small,
            position: "absolute",
            bottom: 110,
            right: 40,
            fontSize: 22,
            letterSpacing: 2,
            color: theme.text,
            padding: "8px 14px",
            borderRadius: 10,
            backgroundColor: `${theme.background}D0`,
            borderLeft: `5px solid ${theme.accent}`,
            opacity: 0.9 * fadeIn,
          }}
        >
          {sourceText}
        </div>
      )}

      {progressBar && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, backgroundColor: `${theme.text}22` }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: theme.accent }} />
        </div>
      )}

      {/* channel name */}
      {beforeOutro && branding.watermark === "footer" && (
        <div style={{ ...small, position: "absolute", bottom: 70, width: "100%", textAlign: "center", fontSize: 30, letterSpacing: 4, color: theme.text, opacity: 0.6 * fadeIn }}>
          {theme.handle}
        </div>
      )}
      {beforeOutro && branding.watermark === "pill" && (
        <div
          style={{
            ...small,
            position: "absolute",
            bottom: 56,
            left: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 20px 10px 14px",
            borderRadius: 999,
            backgroundColor: `${theme.background}D9`,
            border: `2px solid ${theme.text}26`,
            fontSize: 26,
            letterSpacing: 2,
            color: theme.text,
            opacity: fadeIn,
          }}
        >
          <span style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: theme.accent }} />
          {theme.channelName}
        </div>
      )}
      {beforeOutro && branding.watermark === "corner" && (
        <div
          style={{
            ...small,
            position: "absolute",
            top: series ? 104 : 44,
            right: 40,
            fontSize: 24,
            letterSpacing: 2,
            color: theme.text,
            opacity: 0.55 * fadeIn,
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
          }}
        >
          {theme.handle}
        </div>
      )}
      {branding.watermark === "intro" && intro > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 40,
            bottom: tall ? 430 : 200,
            transform: `translateX(${(1 - intro) * -760}px)`,
            opacity: intro,
            display: "flex",
            alignItems: "stretch",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ width: 12, backgroundColor: theme.accent, borderRadius: "10px 0 0 10px" }} />
          <div style={{ backgroundColor: `${theme.background}F0`, padding: "14px 26px", borderRadius: "0 10px 10px 0", display: "flex", alignItems: "center", gap: 20 }}>
            {cta && <Img src={staticFile("brand/logo/polyjuice-logo-round-transparent.png")} style={{ width: 84, height: 84 }} />}
            <div>
              <div style={{ fontFamily: theme.headlineFont, fontSize: 52, lineHeight: 1, color: theme.text, textTransform: "uppercase" }}>
                {theme.channelName}
              </div>
              <div style={{ ...small, fontSize: 24, color: theme.accent, marginTop: 6 }}>{theme.handle}</div>
            </div>
            {cta && (
              <div style={{ position: "relative", marginLeft: 10 }}>
                <div
                  style={{
                    ...small,
                    letterSpacing: 1.5,
                    fontSize: 26,
                    padding: "14px 24px",
                    borderRadius: 999,
                    backgroundColor: tapped ? "#3A3A3A" : "#FF0033",
                    color: tapped ? "#E5E5E5" : "#FFFFFF",
                    transform: `scale(${press})`,
                    whiteSpace: "nowrap",
                    boxShadow: tapped ? "none" : "0 0 24px rgba(255, 0, 51, 0.55)",
                  }}
                >
                  {tapped ? "✓ Subscribed" : "🔔 Subscribe"}
                </div>
                {ripple > 0 && ripple < 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: 160 * ripple,
                      height: 160 * ripple,
                      marginLeft: -80 * ripple,
                      marginTop: -80 * ripple,
                      borderRadius: "50%",
                      border: "4px solid rgba(255,255,255,0.8)",
                      opacity: 1 - ripple,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Quick accent flash + zoom-settle at the start of every scene — the "punch" cut.
export const PunchIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const scale = interpolate(frame, [0, 8], [1.1, 1], { extrapolateRight: "clamp" });
  const flash = interpolate(frame, [0, 6], [0.35, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: theme.accent, opacity: flash }} />
    </AbsoluteFill>
  );
};

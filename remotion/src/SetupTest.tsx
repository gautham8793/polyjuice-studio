import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Toolchain smoke test — replaced by real templates in Phase 1.
export const SetupTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B0F", justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          color: "#FFD60A",
          fontSize: 140,
          fontWeight: 900,
          fontFamily: "Helvetica, Arial, sans-serif",
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
        }}
      >
        SETUP
        <br />
        OK
      </div>
    </AbsoluteFill>
  );
};

import { AbsoluteFill } from "remotion";
import { useTheme } from "../theme";

// Drafting-paper background: the theme blue with a fine + coarse grid and a soft vignette.
// `offset` shifts the grid so it moves with a diagram's camera.
export const BlueprintBackground: React.FC<{ offset?: { x: number; y: number; scale: number } }> = ({ offset }) => {
  const theme = useTheme();
  const s = offset?.scale ?? 1;
  const fine = 36 * s;
  const coarse = fine * 5;
  const pos = `${offset?.x ?? 0}px ${offset?.y ?? 0}px`;
  const line = (a: number) => `rgba(255,255,255,${a})`;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <AbsoluteFill
        style={{
          backgroundImage: [
            `linear-gradient(${line(0.16)} 2px, transparent 2px)`,
            `linear-gradient(90deg, ${line(0.16)} 2px, transparent 2px)`,
            `linear-gradient(${line(0.07)} 1px, transparent 1px)`,
            `linear-gradient(90deg, ${line(0.07)} 1px, transparent 1px)`,
          ].join(","),
          backgroundSize: `${coarse}px ${coarse}px, ${coarse}px ${coarse}px, ${fine}px ${fine}px, ${fine}px ${fine}px`,
          backgroundPosition: `${pos}, ${pos}, ${pos}, ${pos}`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${theme.surface}66 0%, transparent 55%, rgba(0,10,40,0.45) 100%)` }} />
    </AbsoluteFill>
  );
};

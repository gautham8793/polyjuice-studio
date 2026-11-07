import { useTheme } from "../theme";

// Brand rule: words wrapped in *asterisks* in on-screen text are drawn in the emphasis color.
// e.g. "*5* WHALES THAT *BREAK* THE RULES"
export const EmphasisText: React.FC<{ text: string; emphasisColor?: string }> = ({ text, emphasisColor }) => {
  const theme = useTheme();
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <span key={i} style={{ color: emphasisColor ?? theme.accent }}>
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};

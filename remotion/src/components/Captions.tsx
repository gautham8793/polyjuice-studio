import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../theme";
import type { Word } from "../types";

const groupWords = (words: Word[], size: number): Word[][] => {
  const groups: Word[][] = [];
  let current: Word[] = [];
  for (const w of words) {
    current.push(w);
    if (current.length >= size || /[.,?!]$/.test(w.text)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
};

// Word-by-word captions: shows a few words at a time, current word in the accent color.
export const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const t = frame / fps;
  const { wordsPerGroup, fontSize, bottomOffset, strokeWidth } = theme.captions;

  const groups = groupWords(words, wordsPerGroup);
  const index = groups.findIndex((g, i) => {
    const next = groups[i + 1];
    return t >= g[0].start && (next ? t < next[0].start : t < g[g.length - 1].end + 0.4);
  });
  if (index === -1) return null;
  const group = groups[index];

  if (theme.captions.style === "lower-third") return <LowerThird group={group} />;

  const pop = spring({ frame: frame - Math.round(group[0].start * fps), fps, config: { damping: 14, mass: 0.6 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: bottomOffset,
        textAlign: "center",
        fontFamily: theme.bodyFont,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.1,
        textTransform: "uppercase",
        color: theme.text,
        WebkitTextStroke: `${strokeWidth}px #000`,
        paintOrder: "stroke fill",
        textShadow: "0 8px 24px rgba(0,0,0,0.6)",
        transform: `scale(${0.85 + 0.15 * pop})`,
      }}
    >
      {group.map((w, i) => {
        const active = t >= w.start && t < w.end;
        return (
          <span key={i} style={{ color: active ? theme.accent : theme.text }}>
            {w.text.replace(/[.,?!]$/, "")}
            {i < group.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

// Documentary-style subtitle: one short phrase, small and calm, no per-word highlight.
const LowerThird: React.FC<{ group: Word[] }> = ({ group }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const fade = spring({ frame: frame - Math.round(group[0].start * fps), fps, config: { damping: 20 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        bottom: theme.captions.bottomOffset,
        textAlign: "center",
        fontFamily: theme.bodyFont,
        fontWeight: 800,
        fontSize: theme.captions.fontSize,
        lineHeight: 1.2,
        color: theme.text,
        textShadow: "0 2px 10px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)",
        opacity: fade,
      }}
    >
      {/* non-breaking hyphens so "CAR-T" never splits across lines */}
      {group.map((w) => w.text.replace(/-/g, "\u2011")).join(" ")}
    </div>
  );
};

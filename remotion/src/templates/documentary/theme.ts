// Documentary template — the one place for its colours and fonts.
// Change values here and every documentary scene follows (no scene code needs editing).
import { loadFont as loadDMSerifDisplay } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";

const headline = loadDMSerifDisplay("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily; // editorial serif (font board #4)
const body = loadInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily;
const serif = loadNewsreader("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;
const mono = loadPlexMono("normal", { weights: ["500", "600"], subsets: ["latin"] }).fontFamily;
const hand = loadCaveat("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily; // red-pen notes

export const DOC = {
  // Paper world
  paper: "#F1ECE2", // warm off-white page
  paperShade: "#E2D9C7", // darker paper for cards / prints backing
  ink: "#1C1A17", // near-black text
  inkSoft: "#5E574C", // secondary text, rules
  // One strong accent (numbers, red-pen marks, active pillar)
  accent: "#D9482B", // coral red
  highlight: "rgba(217, 72, 43, 0.26)", // highlighter = accent, translucent
  // Data colour for neutral marks (dot grids, bars) — dark kraft, replaces the earlier teal
  data: "#8A6A44",
  // Handmade map pieces: kraft-paper cut-outs on a faint atlas
  kraft: "#C9A77C", // cut-out country paper
  kraftEdge: "#A8865C", // darker fibre tone inside the cut-out
  sea: "rgba(150, 128, 95, 0.16)", // atlas sea wash over the page
  land: "#EEE7DA", // neighbouring countries (pale paper)
  // India tag stripes
  saffron: "#E8862A",
  indiaGreen: "#1E7B3C",
  fonts: { headline, body, serif, mono, label: body, hand },
  headWeight: 400, // DM Serif Display has one weight; never fake-bold it
  labelWeight: 800, // short uppercase labels (steps, chapter tag, stamps) use Inter ExtraBold
  grain: 0.16, // paper grain strength 0..1
  // Paper: every card, clipping, map card and print border is the torn sheet from Figma
  // (library/doc-template/paper/torn-sheet.png, same paper as the icons)
  paperStyle: "figma" as const,
  pinStyle: "tapeCorners" as "thumbtack" | "paperclip" | "tape" | "tapeCorners", // how index cards are fixed: tape over both top corners (chosen)
  // Older aged-paper colours (kept for the "aged" option and the IN INDIA stamp)
  oldPaper: "#E8D8B2", // yellowed sheet
  oldPaperEdge: "rgba(110, 70, 25, 0.28)", // burnt / darkened edges
  stickerEdge: "#EFE2C0", // cream edge round logos and map cut-outs (instead of bright white)
  agedFilter: "sepia(0.35) saturate(0.85)", // tints the engraved art and bank pieces to the same old paper
};

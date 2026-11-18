// Documentary template — font board: six headline/body pairings on the same paper, same content,
// so they can be compared side by side. Pick one and copy its fonts into theme.ts.
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadBarlowCondensed } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadDMSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlexSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadSourceSans } from "@remotion/google-fonts/SourceSans3";
import { loadFont as loadWorkSans } from "@remotion/google-fonts/WorkSans";
import { AbsoluteFill } from "remotion";
import { Paper } from "./parts";
import { DOC } from "./theme";

const f = {
  barlow: loadBarlowCondensed("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  inter: loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily,
  oswald: loadOswald("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  sourceSans: loadSourceSans("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily,
  bebas: loadBebas("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  plexSans: loadPlexSans("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily,
  dmSerif: loadDMSerif("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  fraunces: loadFraunces("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  workSans: loadWorkSans("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily,
  archivo: loadArchivo("normal", { weights: ["400", "600", "900"], subsets: ["latin"] }).fontFamily,
};

const PAIRS = [
  { n: 1, name: "Barlow Condensed + Inter", mood: "Current · clean, compact", head: f.barlow, headWeight: 800, body: f.inter, upper: true },
  { n: 2, name: "Oswald + Source Sans 3", mood: "Newsroom · classic TV news", head: f.oswald, headWeight: 700, body: f.sourceSans, upper: true },
  { n: 3, name: "Bebas Neue + IBM Plex Sans", mood: "Poster · loud, very tall", head: f.bebas, headWeight: 400, body: f.plexSans, upper: true },
  { n: 4, name: "DM Serif Display + Inter", mood: "Editorial · magazine, serious", head: f.dmSerif, headWeight: 400, body: f.inter, upper: false },
  { n: 5, name: "Fraunces + Work Sans", mood: "Warm · storybook documentary", head: f.fraunces, headWeight: 800, body: f.workSans, upper: false },
  { n: 6, name: "Archivo Black + Archivo", mood: "Modern · tech / finance", head: f.archivo, headWeight: 900, body: f.archivo, upper: true },
];

export const FontBoard: React.FC = () => (
  <AbsoluteFill>
    <Paper />
    <AbsoluteFill style={{ padding: 44, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, minmax(0, 1fr))", gap: 28 }}>
      {PAIRS.map((p) => (
        <div key={p.n} style={{ background: "#FBF8F2", boxShadow: "0 8px 24px rgba(40,25,10,0.15)", padding: "28px 34px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: DOC.fonts.mono, fontSize: 18, letterSpacing: 2, color: DOC.inkSoft, textTransform: "uppercase" }}>
            {p.n} · {p.name}
          </div>
          <div style={{ fontFamily: DOC.fonts.mono, fontSize: 15, letterSpacing: 1, color: DOC.accent, textTransform: "uppercase" }}>{p.mood}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 10 }}>
            <div style={{ fontFamily: p.head, fontWeight: p.headWeight, fontSize: 76, lineHeight: 1, whiteSpace: "nowrap", color: DOC.ink }}>{p.upper ? "MARCH 2007" : "March 2007"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <div style={{ fontFamily: p.head, fontWeight: p.headWeight, fontSize: 64, lineHeight: 1, color: DOC.accent }}>82%</div>
            <div style={{ fontFamily: p.head, fontWeight: p.headWeight, fontSize: 34, lineHeight: 1.05, color: DOC.ink }}>{p.upper ? "THEY TOOK PAYMENTS" : "They took payments"}</div>
          </div>
          <div style={{ fontFamily: p.body, fontWeight: 400, fontSize: 22, lineHeight: 1.4, color: DOC.ink, marginTop: 8 }}>
            Most people don't have a bank account. But many of them have a <span style={{ fontWeight: 600 }}>basic mobile phone</span>.
          </div>
        </div>
      ))}
    </AbsoluteFill>
  </AbsoluteFill>
);

import { createContext, useContext } from "react";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadBarlowCondensed } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadBricolageGrotesque } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadDMSerifDisplay } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as loadFjallaOne } from "@remotion/google-fonts/FjallaOne";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadIBMPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadLeagueSpartan } from "@remotion/google-fonts/LeagueSpartan";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPlusJakartaSans } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRubik } from "@remotion/google-fonts/Rubik";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadSyne } from "@remotion/google-fonts/Syne";
import type { Brand, BrandPreset } from "./types";

const FONT_LOADERS: Record<string, () => string> = {
  // Headline / Display fonts
  Anton: () => loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  BebasNeue: () => loadBebas("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  Oswald: () => loadOswald("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  BarlowCondensed: () => loadBarlowCondensed("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  FjallaOne: () => loadFjallaOne("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  ArchivoBlack: () => loadArchivoBlack("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  LeagueSpartan: () => loadLeagueSpartan("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  BricolageGrotesque: () => loadBricolageGrotesque("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  Syne: () => loadSyne("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  Fraunces: () => loadFraunces("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  DMSerifDisplay: () => loadDMSerifDisplay("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  JetBrainsMono: () => loadJetBrainsMono("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  // Body & Caption fonts (also usable as headlines)
  SpaceGrotesk: () => loadSpaceGrotesk("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  PlusJakartaSans: () => loadPlusJakartaSans("normal", { weights: ["700", "800"], subsets: ["latin"] }).fontFamily,
  DMSans: () => loadDMSans("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  Rubik: () => loadRubik("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  Montserrat: () => loadMontserrat("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  Poppins: () => loadPoppins("normal", { weights: ["700", "800"], subsets: ["latin"] }).fontFamily,
  Inter: () => loadInter("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily,
  InterTight: () => loadInterTight("normal", { weights: ["600", "700", "800"], subsets: ["latin"] }).fontFamily,
  // Numbers / labels
  Newsreader: () => loadNewsreader("normal", { weights: ["600", "700", "800"], subsets: ["latin"] }).fontFamily,
  IBMPlexMono: () => loadIBMPlexMono("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily,
  // Handwritten (diagram notes)
  Caveat: () => loadCaveat("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
};

const loadedFonts = new Map<string, string>();
const getFontFamily = (name: string): string => {
  const cached = loadedFonts.get(name);
  if (cached) return cached;
  const loader = FONT_LOADERS[name];
  if (!loader) return name;
  const family = loader();
  loadedFonts.set(name, family);
  return family;
};

export const HEADLINE_FONT_OPTIONS: { id: string; label: string }[] = [
  { id: "BarlowCondensed", label: "Barlow Condensed · Broadcast & Vox documentary" },
  { id: "Oswald", label: "Oswald · Tall editorial condensed" },
  { id: "FjallaOne", label: "Fjalla One · Crisp news headline condensed" },
  { id: "Anton", label: "Anton · Heavy poster impact" },
  { id: "BebasNeue", label: "Bebas Neue · Classic tall display" },
  { id: "ArchivoBlack", label: "Archivo Black · Wide punchy grotesque" },
  { id: "LeagueSpartan", label: "League Spartan · Bold geometric display" },
  { id: "BricolageGrotesque", label: "Bricolage Grotesque · Characterful modern display" },
  { id: "Syne", label: "Syne · Art-house wide display" },
  { id: "SpaceGrotesk", label: "Space Grotesk · Tech & science explainer" },
  { id: "JetBrainsMono", label: "JetBrains Mono · Terminal / hacker monospace" },
  { id: "InterTight", label: "Inter Tight · Calm, compact modern sans" },
  { id: "Fraunces", label: "Fraunces · Warm editorial serif (NYT / Vox vibe)" },
  { id: "DMSerifDisplay", label: "DM Serif Display · High-contrast magazine serif" },
];

export const BODY_FONT_OPTIONS: { id: string; label: string }[] = [
  { id: "PlusJakartaSans", label: "Plus Jakarta Sans · Warm modern geometric" },
  { id: "DMSans", label: "DM Sans · Clean editorial sans" },
  { id: "Inter", label: "Inter · Crisp neutral UI & broadcast" },
  { id: "InterTight", label: "Inter Tight · Calm, compact modern sans" },
  { id: "SpaceGrotesk", label: "Space Grotesk · Quirky tech grotesque" },
  { id: "Rubik", label: "Rubik · Slightly rounded friendly sans" },
  { id: "Montserrat", label: "Montserrat · Wide geometric caption font" },
  { id: "Poppins", label: "Poppins · Round punchy sans" },
];

export const HEADLINE_FONTS = HEADLINE_FONT_OPTIONS.map((f) => f.id);
export const BODY_FONTS = BODY_FONT_OPTIONS.map((f) => f.id);

export type Theme = BrandPreset["colors"] & {
  headlineFont: string;
  bodyFont: string;
  handFont: string;
  monoFont: string; // small labels in the newsroom template
  numberFont: string; // big counting numbers (defaults to the headline font)
  pattern?: BrandPreset["pattern"];
  channelName: string;
  handle: string;
  captions: Brand["captions"];
};

export const resolveTheme = (brand: Brand, presetId?: string): Theme => {
  const preset = brand.presets[presetId ?? brand.active] ?? brand.presets[brand.active] ?? Object.values(brand.presets)[0];
  return {
    ...preset.colors,
    headlineFont: getFontFamily(preset.fonts.headline),
    bodyFont: getFontFamily(preset.fonts.body),
    handFont: getFontFamily(preset.fonts.hand ?? "Caveat"),
    monoFont: preset.fonts.mono ? getFontFamily(preset.fonts.mono) : "ui-monospace, SFMono-Regular, Menlo, monospace",
    numberFont: getFontFamily(preset.fonts.numbers ?? preset.fonts.headline),
    pattern: preset.pattern,
    channelName: brand.channelName,
    handle: brand.handle,
    captions: brand.captions,
  };
};

const ThemeContext = createContext<Theme | null>(null);
export const ThemeProvider = ThemeContext.Provider;

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme outside ThemeProvider");
  return theme;
};

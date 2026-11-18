// Review helper: bundle once, render stills at the given seconds.
// node src/desk/stills.mjs <outDir> <scale> <sec> [sec...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import { mkdirSync } from "node:fs";

const [outDir, scale, ...secs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const entry = path.resolve("src/desk/index.ts");
const serveUrl = await bundle({ entryPoint: entry, publicDir: path.resolve("../workspace") });
const composition = await selectComposition({ serveUrl, id: "DeskCut" });
for (const s of secs) {
  const frame = Math.round(Number(s) * 30);
  const output = path.join(outDir, `t${String(s).padStart(6, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, scale: Number(scale) });
  console.log(output);
}

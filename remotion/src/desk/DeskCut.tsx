import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadSpecialElite } from "@remotion/google-fonts/SpecialElite";
import { loadFont as loadMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadStaatliches } from "@remotion/google-fonts/Staatliches";
import { loadFont as loadCourier } from "@remotion/google-fonts/CourierPrime";
import { F, FPS, G, H, IMG, W, finish, handheld, initTextures, rr, sm, p, font } from "./engine";
import { HITS, Quad, camera, drawWorld, magnifier, wideWeight } from "./world";
import { outTime, worldTime } from "./remap";
import { OUT_DURATION } from "./remap-data";
import { drawOverlays } from "./overlay";
import { MEDIA_SRCS, drawMedia } from "./media";

const fonts = [
  ["hero", loadAnton("normal", { weights: ["400"], subsets: ["latin"] })],
  ["type", loadSpecialElite("normal", { weights: ["400"], subsets: ["latin"] })],
  ["marker", loadMarker("normal", { weights: ["400"], subsets: ["latin"] })],
  ["label", loadInter("normal", { weights: ["600", "700", "800"], subsets: ["latin"] })],
  ["stamp", loadStaatliches("normal", { weights: ["400"], subsets: ["latin"] })],
  ["mono", loadCourier("normal", { weights: ["700"], subsets: ["latin"] })],
] as const;

const LOGOS = { nvidia: "library/logos/nvidia.svg", anthropic: "library/logos/anthropic.svg", nasdaq: "library/logos/nasdaq.svg" };

async function loadAll() {
  for (const [key, f] of fonts) {
    (F as any)[key] = f.fontFamily;
    await f.waitUntilDone();
  }
  await Promise.all(
    Object.values(F).flatMap((fam) => ["400", "600", "700", "800"].map((w) => document.fonts.load(`${w} 40px "${fam}"`).catch(() => null))),
  );
  await Promise.all(
    Object.entries(LOGOS).map(
      ([k, src]) =>
        new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => res();
          img.onerror = () => res();
          img.src = staticFile(src);
          IMG[k] = img;
        }),
    ),
  );
  // real photos and clip frames (keyed by their path)
  await Promise.all(
    MEDIA_SRCS.map(
      (src) =>
        new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => res();
          img.onerror = () => res();
          img.src = staticFile(src);
          IMG[src] = img;
        }),
    ),
  );
}

const cv = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
let scene: HTMLCanvasElement;
let tmp: HTMLCanvasElement;
let mask: HTMLCanvasElement;
let maskBlur: HTMLCanvasElement;

function shake(t: number) {
  let x = 0;
  let y = 0;
  HITS.forEach((h, i) => {
    const e = t - h;
    if (e < 0 || e > 0.45) return;
    const a = 9 * Math.exp(-e * 11);
    x += a * Math.sin(e * 73 + i);
    y += a * Math.cos(e * 61 + i * 2);
  });
  return { x, y };
}

// t: world seconds (world.ts timing); real: output seconds, so the handheld drift never freezes
// while the world clock slows under an inserted line
function sample(ctx: CanvasRenderingContext2D, t: number, quads?: Quad[], real = t) {
  const cam = camera(t);
  const hh = handheld(real);
  const sh = shake(t);
  G.z = cam.z;
  G.t = t;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(W / 2 + hh.x + sh.x, H / 2 + hh.y + sh.y);
  ctx.rotate(hh.r);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.x, -cam.y);
  const hw = (W / 2 / cam.z) * 1.06;
  const hhh = (H / 2 / cam.z) * 1.1;
  drawWorld(ctx, t, { x0: cam.x - hw, y0: cam.y - hhh, x1: cam.x + hw, y1: cam.y + hhh }, quads);

  // magnifier with a real magnified lens
  const m = magnifier(t);
  if (m && m.a > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.R, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = m.a;
    ctx.translate(m.x, m.y);
    ctx.scale(m.mag, m.mag);
    ctx.translate(-m.x, -m.y);
    const r = m.R / m.mag + 40;
    G.z = cam.z * m.mag;
    drawWorld(ctx, t, { x0: m.x - r, y0: m.y - r, x1: m.x + r, y1: m.y + r });
    G.z = cam.z;
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = m.a;
    // glass sheen
    const g = ctx.createRadialGradient(m.x - m.R * 0.4, m.y - m.R * 0.4, 10, m.x, m.y, m.R);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(0.6, "rgba(255,255,255,0.03)");
    g.addColorStop(1, "rgba(255,255,255,0.12)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.R, 0, Math.PI * 2);
    ctx.fill();
    // handle
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(0.75);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 30 * cam.z;
    ctx.shadowOffsetY = 20 * cam.z;
    ctx.fillStyle = "#2b1a0f";
    rr(ctx, m.R + 10, -34, 360, 68, 30);
    ctx.fill();
    ctx.restore();
    // brass rim
    ctx.lineWidth = 34;
    const rg = ctx.createLinearGradient(m.x - m.R, m.y - m.R, m.x + m.R, m.y + m.R);
    rg.addColorStop(0, "#f0cf77");
    rg.addColorStop(0.5, "#9c7426");
    rg.addColorStop(1, "#e6c062");
    ctx.strokeStyle = rg;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.R + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function renderFrame(out: CanvasRenderingContext2D, frame: number) {
  const real = frame / FPS; // output seconds (8:30 voice)
  const t = worldTime(real); // the 6:23 world's clock
  initTextures(out);
  if (!scene) {
    scene = cv(W, H);
    tmp = cv(W, H);
    mask = cv(W / 4, H / 4);
    maskBlur = cv(W / 4, H / 4);
  }
  const sc = scene.getContext("2d")!;
  const tc = tmp.getContext("2d")!;

  // adaptive motion blur (180° shutter): more sub-frames when the camera moves fast
  const dt = 1 / FPS;
  const a = camera(worldTime(real - dt * 0.25));
  const b = camera(worldTime(real + dt * 0.25));
  const z = (a.z + b.z) / 2;
  const disp = Math.hypot((b.x - a.x) * z, (b.y - a.y) * z) + Math.abs(Math.log(b.z / a.z)) * W * 0.5;
  const n = disp < 2.5 ? 1 : Math.min(7, Math.ceil(disp / 3.5));
  const quads: Quad[] = [];
  if (n === 1) sample(sc, t, quads, real);
  else {
    for (let k = 0; k < n; k++) {
      const rs = real + dt * 0.5 * (k / (n - 1) - 0.5);
      sample(tc, worldTime(rs), k === Math.floor(n / 2) ? quads : undefined, rs);
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = "source-over";
      sc.globalAlpha = 1 / (k + 1);
      sc.drawImage(tmp, 0, 0);
    }
    sc.globalAlpha = 1;
  }

  // one hero: everything outside the lit objects dims back (soft, low-res mask)
  const mc = mask.getContext("2d")!;
  mc.setTransform(1, 0, 0, 1, 0, 0);
  mc.globalCompositeOperation = "source-over";
  mc.clearRect(0, 0, W / 4, H / 4);
  const dark = 0.62 * (1 - 0.75 * wideWeight(t));
  mc.fillStyle = `rgba(6,4,2,${dark})`;
  mc.fillRect(0, 0, W / 4, H / 4);
  mc.globalCompositeOperation = "destination-out";
  for (const q of quads) {
    mc.globalAlpha = Math.min(1, q.w);
    mc.fillStyle = "#000";
    mc.beginPath();
    q.pts.forEach(([x, y], i) => (i ? mc.lineTo(x / 4, y / 4) : mc.moveTo(x / 4, y / 4)));
    mc.closePath();
    mc.fill();
  }
  mc.globalAlpha = 1;
  const bc = maskBlur.getContext("2d")!;
  bc.globalCompositeOperation = "copy";
  bc.filter = "blur(9px)";
  bc.drawImage(mask, 0, 0);
  bc.filter = "none";
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalCompositeOperation = "source-over";
  sc.globalAlpha = 1;
  sc.imageSmoothingQuality = "high";
  sc.drawImage(maskBlur, 0, 0, W, H);

  out.setTransform(1, 0, 0, 1, 0, 0);
  finish(out, scene, real, frame);
  drawOverlays(out, real);
  drawMedia(out, real);

  // open from black, end on the channel card (timed from the end of the 8:30 cut)
  const E = OUT_DURATION;
  const inA = 1 - sm(p(real, 0, 0.7));
  const outA = 0.82 * sm(p(real, E - 2.43, E - 1.23));
  const k = Math.max(inA, outA);
  if (k > 0) {
    out.fillStyle = `rgba(0,0,0,${k})`;
    out.fillRect(0, 0, W, H);
  }
  const card = sm(p(real, E - 1.93, E - 1.13));
  if (card > 0) {
    out.save();
    out.globalAlpha = card;
    out.fillStyle = "#f4efe4";
    out.font = font(F.hero, 120);
    out.textAlign = "center";
    out.textBaseline = "middle";
    (out as any).letterSpacing = "6px";
    out.fillText("THE POLYJUICE PROJECT", W / 2, H / 2 - 50);
    (out as any).letterSpacing = "0px";
    out.fillStyle = "#d42a2a";
    rr(out, W / 2 - 190, H / 2 + 60, 380, 96, 48);
    out.fill();
    out.fillStyle = "#fff";
    out.font = font(F.label, 48, 800);
    out.fillText("SUBSCRIBE", W / 2, H / 2 + 110);
    out.restore();
  }
}

// Props match the template renders (the dashboard's Export passes the same --props); only the
// project path (for the soundtrack) and coverMode are used.
type DeskProps = { projectPath?: string; coverMode?: boolean };
const COVER_FRAME = Math.round(outTime(29.9) * FPS); // title card with the BLINKED stamp settled, before the camera leaves

export const DeskCut: React.FC<DeskProps> = ({ projectPath, coverMode }) => {
  const current = useCurrentFrame();
  const frame = coverMode ? COVER_FRAME : current;
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("Loading fonts and logos"));
  const [ready, setReady] = useState(false);
  const released = useRef(false);
  useEffect(() => {
    loadAll().then(() => setReady(true));
  }, []);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    renderFrame(ref.current.getContext("2d")!, frame);
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [frame, ready, handle]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
      {projectPath && !coverMode ? <Audio src={staticFile(`${projectPath}/soundtrack.flac`)} /> : null}
    </AbsoluteFill>
  );
};

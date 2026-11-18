// Real media on the desk (v4): credited photos and a few seconds of licensed video on taped Polaroids,
// newspaper clippings typeset with the outlets' real headlines, printed-out X posts. Screen space,
// drawn after the overlay cards. Content and timing come from remap-data.ts (MEDIA).
import { C, COL, F, G, H, IMG, W, back, clamp, eout, greyLines, lerp, measure, p, paper, rng, sm, text } from "./engine";
import { MEDIA, type MediaItem } from "./remap-data";

/** every image file the media layer needs (photos + clip frames), for DeskCut to preload */
export const MEDIA_SRCS: string[] = Array.from(
  new Set(
    MEDIA.flatMap((m) =>
      m.k === "photo" && m.src ? [m.src] : m.k === "clip" && m.src ? Array.from({ length: m.frames ?? 1 }, (_, i) => m.src!.replace("%03d", String(i + 1).padStart(3, "0"))) : [],
    ),
  ),
);

function cover(c: C, img: HTMLImageElement | undefined, x: number, y: number, w: number, h: number, focusY = 0.4) {
  if (!img || !img.naturalWidth) {
    c.fillStyle = "#333";
    c.fillRect(x, y, w, h);
    return;
  }
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) * focusY;
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// in / out progress for an item: slides in around its cue, leaves over the last 0.35 s
function life(t: number, m: MediaItem) {
  const inn = p(t, m.t - 0.25, m.t + 0.3);
  const out = p(t, m.t1 - 0.4, m.t1 - 0.05);
  return { inn, out, a: clamp(inn * 4) * (1 - sm(out)) };
}

function wrap(c: C, s: string, fam: string, size: number, maxW: number) {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const nxt = cur ? `${cur} ${w}` : w;
    if (cur && measure(c, nxt, { size, fam }) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = nxt;
  }
  if (cur) lines.push(cur);
  return lines;
}

function tape(c: C, x: number, y: number, w: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = "rgba(232,220,190,0.78)";
  c.shadowColor = "rgba(0,0,0,0.25)";
  c.shadowBlur = 6;
  c.fillRect(-w / 2, -22, w, 44);
  c.restore();
}

// ---- Polaroid: photo or clip ----
function polaroid(c: C, m: MediaItem, t: number) {
  const { inn, out, a } = life(t, m);
  if (a <= 0) return;
  const portrait = m.k === "photo" && /portrait/.test(m.src ?? "");
  const pw = 470;
  const ph = portrait ? 590 : 352;
  const fw = pw + 56;
  const fh = ph + 56 + 96;
  const dir = m.side === "left" ? -1 : 1;
  const cx = W / 2 + dir * W * 0.3 + dir * (1 - eout(inn)) * 700 + dir * sm(out) * 700;
  const cy = H * 0.47 + (portrait ? 0 : -20);
  const rot = dir * lerp(0.16, 0.045, back(inn, 1.2)) + Math.sin(t * 0.6) * 0.004;
  c.save();
  c.translate(cx, cy);
  c.rotate(rot);
  c.globalAlpha = a;
  paper(c, fw, fh, { fill: "#f7f4ec", radius: 3, lift: 0.9, shade: 0.1 });
  const x0 = -pw / 2;
  const y0 = -fh / 2 + 28;
  if (m.k === "clip") {
    const n = m.frames ?? 1;
    const k = Math.floor(Math.max(0, t - m.t) * (m.fps ?? 12)) % (2 * n - 2 || 1);
    const idx = k < n ? k : 2 * n - 2 - k; // ping-pong, so the loop never jumps
    cover(c, IMG[m.src!.replace("%03d", String(idx + 1).padStart(3, "0"))], x0, y0, pw, ph, 0.5);
    // a small "REC" tell: this one moves
    c.fillStyle = COL.red;
    c.globalAlpha = a * (0.6 + 0.4 * Math.round((Math.sin(t * 5) + 1) / 2));
    c.beginPath();
    c.arc(x0 + 30, y0 + 30, 9, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = a;
    text(c, "VIDEO", x0 + 48, y0 + 31, { size: 22, fam: F.label, weight: 800, color: "#fff", align: "left" });
  } else cover(c, IMG[m.src!], x0, y0, pw, ph, portrait ? 0.3 : 0.45);
  // inner shadow on the print
  c.strokeStyle = "rgba(0,0,0,0.25)";
  c.lineWidth = 2;
  c.strokeRect(x0, y0, pw, ph);
  const cap = m.caption ?? "";
  const capW = measure(c, cap, { size: 34, fam: F.marker });
  text(c, cap, 0, fh / 2 - 66, { size: capW > pw ? Math.floor((34 * pw) / capW) : 34, fam: F.marker, color: COL.ink });
  text(c, m.credit ?? "", 0, fh / 2 - 24, { size: 18, fam: F.label, weight: 600, color: "rgba(40,36,30,0.65)" });
  tape(c, 0, -fh / 2 + 4, 170, -dir * 0.06);
  c.restore();
}

// ---- newspaper clipping ----
function clipping(c: C, m: MediaItem, t: number) {
  const { inn, out, a } = life(t, m);
  if (a <= 0) return;
  const big = !m.matched && !m.withPost && !m.withCard;
  const s = big ? 1 : 0.7;
  const w = 1180;
  c.save();
  c.font = `400 72px "${F.hero}"`;
  const lines = wrap(c, (m.headline ?? "").toUpperCase(), F.hero, 72, w - 120);
  const h = 150 + lines.length * 84 + 120;
  const cx = m.withPost ? W * 0.68 : W / 2;
  const cy = (big ? H * 0.48 : H * 0.82 - (h * s) / 2 + 120 * s) + (1 - eout(inn)) * 500 + sm(out) * 600;
  if (big) {
    c.fillStyle = `rgba(6,4,2,${0.38 * a})`;
    c.fillRect(0, 0, W, H);
  }
  c.translate(cx, cy);
  c.rotate(lerp(-0.09, -0.02, back(inn, 1.3)) + (m.withPost ? 0.03 : 0));
  c.scale(s, s);
  c.globalAlpha = a;
  // torn top and bottom edges
  const r = rng(Math.round(w + h + m.t * 10));
  c.save();
  c.shadowColor = "rgba(0,0,0,0.55)";
  c.shadowBlur = 30 * G.z;
  c.shadowOffsetX = 10;
  c.shadowOffsetY = 22;
  c.beginPath();
  c.moveTo(-w / 2, -h / 2);
  for (let x = -w / 2; x <= w / 2; x += 16) c.lineTo(x, -h / 2 + (r() - 0.5) * 12);
  for (let y = -h / 2; y <= h / 2; y += 20) c.lineTo(w / 2 + (r() - 0.5) * 8, y);
  for (let x = w / 2; x >= -w / 2; x -= 16) c.lineTo(x, h / 2 + (r() - 0.5) * 14);
  for (let y = h / 2; y >= -h / 2; y -= 20) c.lineTo(-w / 2 + (r() - 0.5) * 8, y);
  c.closePath();
  c.fillStyle = "#e8e2d0";
  c.fill();
  c.restore();
  // masthead strip: outlet · date
  const top = -h / 2 + 50;
  text(c, (m.outlet ?? "").toUpperCase(), -w / 2 + 60, top, { size: 40, fam: F.stamp, color: COL.ink, align: "left", track: 4 });
  text(c, m.date ?? "", w / 2 - 60, top, { size: 28, fam: F.type, color: COL.inkSoft, align: "right" });
  c.fillStyle = COL.ink;
  c.fillRect(-w / 2 + 60, top + 34, w - 120, 4);
  c.fillRect(-w / 2 + 60, top + 44, w - 120, 1.5);
  // headline, word-by-word "inked in" after the strip lands
  lines.forEach((ln, i) => {
    const u = p(t, m.t + 0.05 + i * 0.12, m.t + 0.3 + i * 0.12);
    text(c, ln, -w / 2 + 60, top + 120 + i * 84, { size: 72, fam: F.hero, color: COL.ink, align: "left", alpha: u });
  });
  // body copy as grey lines (never readable words)
  const by = top + 120 + lines.length * 84 - 10;
  greyLines(c, -w / 2 + 60, by, (w - 160) / 2, 3, 26, 3, 0, "rgba(40,34,26,0.28)");
  greyLines(c, 30, by, (w - 160) / 2, 3, 26, 9, 0, "rgba(40,34,26,0.28)");
  c.restore();
}

// ---- printed-out X post ----
function post(c: C, m: MediaItem, t: number) {
  const { inn, out, a } = life(t, m);
  if (a <= 0) return;
  const w = 1000;
  const reply = !!m.replyTo;
  const h = reply ? 420 : 300;
  const cy = (m.withPost && reply ? H * 0.4 : H * 0.45) + (1 - eout(inn)) * 380 - sm(out) * 500;
  c.save();
  c.fillStyle = `rgba(6,4,2,${0.36 * a})`;
  c.fillRect(0, 0, W, H);
  c.translate(m.withPost && reply ? W * 0.42 : W / 2, cy);
  c.rotate(lerp(0.07, 0.015, back(inn, 1.4)));
  c.globalAlpha = a;
  paper(c, w, h, { fill: "#fbfaf6", radius: 10, lift: 0.8, shade: 0.08 });
  let y = -h / 2 + 50;
  if (reply) {
    const [who, said] = (m.replyTo ?? "").split(" · ");
    c.fillStyle = "rgba(0,0,0,0.05)";
    c.fillRect(-w / 2 + 50, y - 26, w - 100, 92);
    text(c, who, -w / 2 + 76, y, { size: 26, fam: F.label, weight: 700, color: "#6b6b6b", align: "left" });
    text(c, said ?? "", -w / 2 + 76, y + 38, { size: 32, fam: F.label, weight: 600, color: "#555", align: "left" });
    y += 120;
  }
  // avatar + handle
  const ax = -w / 2 + 92;
  c.fillStyle = "#2b2b2b";
  c.beginPath();
  c.arc(ax, y + 18, 38, 0, Math.PI * 2);
  c.fill();
  text(c, (m.handle ?? "@").slice(1, 2).toUpperCase(), ax, y + 20, { size: 38, fam: F.label, weight: 800, color: "#fff" });
  text(c, m.handle ?? "", ax + 60, y + 4, { size: 34, fam: F.label, weight: 800, color: "#14171a", align: "left" });
  text(c, "on X", ax + 60, y + 40, { size: 24, fam: F.label, weight: 600, color: "#7a7a7a", align: "left" });
  // the post, typed out as it's printed
  const s = m.text ?? "";
  const n = Math.round(s.length * clamp((t - m.t - 0.1) / Math.max(0.35, s.length * 0.035)));
  text(c, s.slice(0, n), -w / 2 + 54, y + 120, { size: reply ? 62 : 76, fam: F.label, weight: 700, color: "#14171a", align: "left" });
  c.restore();
}

export function drawMedia(c: C, t: number) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  const z = G.z;
  G.z = 1;
  // order: posts under clippings (a clipping beside a post sits on top), Polaroids last
  for (const k of ["post", "clipping", "photo", "clip"] as const)
    for (const m of MEDIA) if (m.k === k && t > m.t - 0.3 && t < m.t1 + 0.05) (k === "post" ? post : k === "clipping" ? clipping : polaroid)(c, m, t);
  G.z = z;
  c.restore();
}

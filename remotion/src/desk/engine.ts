// Drawing engine for the one-camera desk cut: easing, a smooth never-stopping camera, paper and
// marker primitives, and the film finish (motion blur, glow, grain, vignette). Everything is a pure
// function of time t (seconds) so Remotion can render frames in any order.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export type C = CanvasRenderingContext2D;

// ---------- math ----------
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const p = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const sm = (u: number) => u * u * (3 - 2 * u);
export const eio = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const eout = (u: number) => 1 - Math.pow(1 - u, 3);
export const ein = (u: number) => u * u * u;
export const back = (u: number, s = 1.7) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---------- fonts (family names are filled in once Google Fonts load) ----------
export const F = {
  hero: "Anton",
  type: "Special Elite",
  marker: "Permanent Marker",
  label: "Inter",
  stamp: "Staatliches",
  mono: "Courier Prime",
};
export const font = (fam: string, size: number, weight: number | string = 400) => `${weight} ${size}px "${fam}"`;

// ---------- palette ----------
export const COL = {
  ink: "#1c1a17",
  inkSoft: "#4a453d",
  grey: "rgba(60,52,40,0.22)",
  paper: "#ece4d0",
  paperWhite: "#f3efe6",
  card: "#f5f1e6",
  manila: "#d6b678",
  kraft: "#c49a5c",
  sticky: "#f2d24b",
  red: "#d42a2a",
  stampRed: "#c01f26",
  green: "#178a4c",
  blue: "#2a64b8",
  rule: "rgba(80,130,190,0.35)",
};

// ---------- shared state set per frame ----------
export const G = { z: 1, t: 0 };

// ---------- images ----------
export const IMG: Record<string, HTMLImageElement> = {};

// ---------- cached textures ----------
let woodPat: CanvasPattern | null = null;
let grainPat: CanvasPattern | null = null;
const noiseTiles: HTMLCanvasElement[] = [];
let vignette: HTMLCanvasElement | null = null;

const mk = (w: number, h: number) => {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return cv;
};

export function initTextures(c: C) {
  if (woodPat) return;
  // dark walnut desk
  const wt = mk(1024, 1024);
  const w = wt.getContext("2d")!;
  const r = rng(11);
  w.fillStyle = "#24180f";
  w.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) {
    const y0 = r() * 1024;
    const amp = 6 + r() * 26;
    const fr = 0.002 + r() * 0.006;
    const ph = r() * 6.28;
    const light = r() < 0.5;
    w.strokeStyle = light ? `rgba(120,80,45,${0.05 + r() * 0.1})` : `rgba(8,4,2,${0.08 + r() * 0.18})`;
    w.lineWidth = 0.6 + r() * 3.5;
    w.beginPath();
    for (let x = -10; x <= 1034; x += 8) {
      const y = y0 + Math.sin(x * fr * 6.28 + ph) * amp + Math.sin(x * 0.031 + ph) * 2;
      if (x < 0) w.moveTo(x, y);
      else w.lineTo(x, y);
    }
    w.stroke();
    // wrap vertically
    w.save();
    w.translate(0, y0 > 512 ? -1024 : 1024);
    w.stroke();
    w.restore();
  }
  const id = w.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    id.data[i] += n;
    id.data[i + 1] += n * 0.8;
    id.data[i + 2] += n * 0.6;
  }
  w.putImageData(id, 0, 0);
  woodPat = c.createPattern(wt, "repeat");

  // paper grain
  const gt = mk(256, 256);
  const g = gt.getContext("2d")!;
  const gd = g.createImageData(256, 256);
  for (let i = 0; i < gd.data.length; i += 4) {
    const v = r();
    gd.data[i] = 90;
    gd.data[i + 1] = 70;
    gd.data[i + 2] = 40;
    gd.data[i + 3] = v < 0.5 ? 0 : (v - 0.5) * 60;
  }
  g.putImageData(gd, 0, 0);
  grainPat = c.createPattern(gt, "repeat");

  // film grain tiles
  for (let k = 0; k < 6; k++) {
    const nt = mk(256, 256);
    const n = nt.getContext("2d")!;
    const nd = n.createImageData(256, 256);
    for (let i = 0; i < nd.data.length; i += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 120;
      nd.data[i] = nd.data[i + 1] = nd.data[i + 2] = v;
      nd.data[i + 3] = 255;
    }
    n.putImageData(nd, 0, 0);
    noiseTiles.push(nt);
  }

  // vignette + warm lamp pool
  vignette = mk(W, H);
  const v = vignette.getContext("2d")!;
  const rg = v.createRadialGradient(W * 0.5, H * 0.46, H * 0.25, W * 0.5, H * 0.5, H * 1.05);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(0.55, "rgba(0,0,0,0.18)");
  rg.addColorStop(1, "rgba(0,0,0,0.78)");
  v.fillStyle = rg;
  v.fillRect(0, 0, W, H);
}

// ---------- shapes ----------
export function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

export function desk(c: C, x0: number, y0: number, x1: number, y1: number) {
  c.fillStyle = woodPat!;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}

export type PaperOpts = { fill?: string; torn?: boolean; radius?: number; lift?: number; shade?: number };

export function paperPath(c: C, w: number, h: number, o: PaperOpts) {
  const r = o.radius ?? 6;
  if (!o.torn) return rr(c, -w / 2, -h / 2, w, h, r);
  const rnd = rng(Math.round(w * 7 + h));
  c.beginPath();
  c.moveTo(-w / 2, -h / 2);
  c.lineTo(w / 2, -h / 2);
  c.lineTo(w / 2, h / 2 - 10);
  for (let x = w / 2; x > -w / 2; x -= 18) c.lineTo(x, h / 2 - 14 + rnd() * 22);
  c.lineTo(-w / 2, h / 2 - 6);
  c.closePath();
}

export function paper(c: C, w: number, h: number, o: PaperOpts = {}) {
  const lift = o.lift ?? 0;
  c.save();
  c.shadowColor = `rgba(0,0,0,${0.55 + lift * 0.1})`;
  c.shadowBlur = (22 + lift * 40) * G.z;
  c.shadowOffsetX = (6 + lift * 20) * G.z;
  c.shadowOffsetY = (12 + lift * 40) * G.z;
  paperPath(c, w, h, o);
  c.fillStyle = o.fill ?? COL.paper;
  c.fill();
  c.restore();
  c.save();
  paperPath(c, w, h, o);
  c.clip();
  const lg = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  lg.addColorStop(0, "rgba(255,250,235,0.18)");
  lg.addColorStop(1, `rgba(60,40,20,${o.shade ?? 0.16})`);
  c.fillStyle = lg;
  c.fillRect(-w / 2, -h / 2, w, h);
  c.globalAlpha = 0.6;
  c.fillStyle = grainPat!;
  c.fillRect(-w / 2, -h / 2, w, h);
  c.restore();
}

export function indexCard(c: C, w: number, h: number, o: PaperOpts = {}) {
  paper(c, w, h, { fill: COL.card, ...o });
  c.save();
  c.strokeStyle = COL.rule;
  c.lineWidth = 2.2;
  for (let y = -h / 2 + h * 0.3; y < h / 2 - 20; y += h * 0.13) {
    c.beginPath();
    c.moveTo(-w / 2, y);
    c.lineTo(w / 2, y);
    c.stroke();
  }
  c.strokeStyle = "rgba(210,70,70,0.45)";
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(-w / 2, -h / 2 + h * 0.17);
  c.lineTo(w / 2, -h / 2 + h * 0.17);
  c.stroke();
  c.restore();
}

export function sticky(c: C, w: number, h: number, fill = COL.sticky) {
  paper(c, w, h, { fill, radius: 3, shade: 0.22 });
  c.save();
  const g = c.createLinearGradient(0, h / 2 - h * 0.25, 0, h / 2);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(80,50,0,0.16)");
  c.fillStyle = g;
  c.fillRect(-w / 2, h / 2 - h * 0.25, w, h * 0.25);
  c.restore();
}

// soft grey lines that read as body copy, never as words
export function greyLines(c: C, x: number, y: number, w: number, rows: number, lh: number, seed: number, th = 0, color = COL.grey) {
  const r = rng(seed);
  const t = th || lh * 0.34;
  c.fillStyle = color;
  for (let i = 0; i < rows; i++) {
    const last = i === rows - 1;
    const len = w * (last ? 0.35 + r() * 0.3 : 0.78 + r() * 0.22);
    rr(c, x, y + i * lh, len, t, t / 2);
    c.fill();
  }
}

// ---------- text ----------
export type TextOpts = { size: number; fam?: string; weight?: number | string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; alpha?: number; track?: number };

export function text(c: C, s: string, x: number, y: number, o: TextOpts) {
  c.save();
  c.font = font(o.fam ?? F.label, o.size, o.weight ?? 400);
  c.fillStyle = o.color ?? COL.ink;
  c.textAlign = o.align ?? "center";
  c.textBaseline = o.base ?? "middle";
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  if (o.track) (c as any).letterSpacing = `${o.track}px`;
  c.fillText(s, x, y);
  c.restore();
}

export function measure(c: C, s: string, o: TextOpts) {
  c.save();
  c.font = font(o.fam ?? F.label, o.size, o.weight ?? 400);
  if (o.track) (c as any).letterSpacing = `${o.track}px`;
  const w = c.measureText(s).width;
  c.restore();
  return w;
}

// typewriter: characters appear at cps from t0 (cursor-free, printed look)
export function typed(c: C, s: string, x: number, y: number, t: number, t0: number, o: TextOpts, cps = 22) {
  if (t < t0) return;
  const n = Math.min(s.length, Math.floor((t - t0) * cps) + 1);
  const full = measure(c, s, o);
  const align = o.align ?? "center";
  const left = align === "center" ? x - full / 2 : align === "right" ? x - full : x;
  text(c, s.slice(0, n), left, y, { ...o, align: "left" });
}

// marker handwriting: revealed left to right over dur, starting at t0
export function marker(c: C, s: string, x: number, y: number, t: number, t0: number, dur: number, o: Partial<TextOpts> & { size: number }) {
  if (t < t0) return;
  const u = eout(p(t, t0, t0 + dur));
  const oo: TextOpts = { fam: F.marker, color: COL.red, ...o };
  const w = measure(c, s, oo);
  const align = oo.align ?? "center";
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  c.save();
  c.beginPath();
  c.rect(left - 20, y - o.size * 1.2, (w + 40) * u, o.size * 2.4);
  c.clip();
  text(c, s, left, y, { ...oo, align: "left" });
  c.restore();
}

// ---------- marker strokes ----------
export function strokeReveal(c: C, pts: [number, number][], u: number, color = COL.red, width = 12, alpha = 0.92) {
  if (u <= 0 || pts.length < 2) return;
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let left = total * clamp(u);
  c.save();
  c.globalAlpha *= alpha;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = seg[i - 1];
    if (left >= d) c.lineTo(pts[i][0], pts[i][1]);
    else {
      const k = left / d;
      c.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
    }
    left -= d;
  }
  c.stroke();
  c.restore();
}

export const draw = (t: number, t0: number, dur: number) => eio(p(t, t0, t0 + dur));

export function circlePts(cx: number, cy: number, rx: number, ry: number, seed = 1, turns = 1.12): [number, number][] {
  const r = rng(seed);
  const a0 = -2.2 + r() * 0.6;
  const k1 = r() * 6;
  const pts: [number, number][] = [];
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 * turns;
    const wob = 1 + 0.035 * Math.sin(a * 3 + k1) + (i / n) * 0.06;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  return pts;
}

export function circle(c: C, cx: number, cy: number, rx: number, ry: number, t: number, t0: number, seed = 1, width = 12, dur = 0.5, color = COL.red) {
  strokeReveal(c, circlePts(cx, cy, rx, ry, seed), draw(t, t0, dur), color, width);
}

export function check(c: C, x: number, y: number, s: number, t: number, t0: number, color = COL.red, width = 14) {
  strokeReveal(c, [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.42], [x + s * 0.6, y - s * 0.55]], draw(t, t0, 0.3), color, width);
}

export function cross(c: C, x: number, y: number, s: number, t: number, t0: number, color = COL.red, width = 14) {
  strokeReveal(c, [[x - s / 2, y - s / 2], [x + s / 2, y + s / 2]], draw(t, t0, 0.18), color, width);
  strokeReveal(c, [[x + s / 2, y - s / 2], [x - s / 2, y + s / 2]], draw(t, t0 + 0.14, 0.18), color, width);
}

export function arrowHead(c: C, x: number, y: number, ang: number, s: number, color = COL.red, width = 12) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha *= 0.92;
  c.beginPath();
  c.moveTo(x + Math.cos(ang + 2.6) * s, y + Math.sin(ang + 2.6) * s);
  c.lineTo(x, y);
  c.lineTo(x + Math.cos(ang - 2.6) * s, y + Math.sin(ang - 2.6) * s);
  c.stroke();
  c.restore();
}

// quadratic arc as points
export function arcPts(x0: number, y0: number, x1: number, y1: number, bend: number, n = 40): [number, number][] {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend;
  const my = (y0 + y1) / 2 + (x1 - x0) * bend;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1]);
  }
  return pts;
}

export function arrow(c: C, pts: [number, number][], t: number, t0: number, dur: number, color = COL.red, width = 12, head = 40) {
  const u = draw(t, t0, dur);
  strokeReveal(c, pts, u, color, width);
  if (u >= 0.98) {
    const a = pts[pts.length - 1];
    const b = pts[Math.max(0, pts.length - 3)];
    arrowHead(c, a[0], a[1], Math.atan2(a[1] - b[1], a[0] - b[0]), head, color, width);
  }
}

// ---------- rubber stamp (cached, distressed) ----------
const stampCache = new Map<string, HTMLCanvasElement>();
function stampCanvas(s: string, size: number, color: string, box: boolean) {
  const key = `${s}|${size}|${color}|${box}`;
  const hit = stampCache.get(key);
  if (hit) return hit;
  const probe = mk(10, 10).getContext("2d")!;
  probe.font = font(F.stamp, size);
  (probe as any).letterSpacing = `${size * 0.06}px`;
  const tw = probe.measureText(s).width;
  const padX = size * 0.35;
  const padY = size * 0.18;
  const cw = Math.ceil(tw + padX * 2 + 20);
  const ch = Math.ceil(size * 1.1 + padY * 2 + 20);
  const cv = mk(cw, ch);
  const g = cv.getContext("2d")!;
  g.translate(10, 10);
  g.fillStyle = color;
  g.strokeStyle = color;
  if (box) {
    g.lineWidth = size * 0.09;
    rr(g, 0, 0, cw - 20, ch - 20, size * 0.08);
    g.stroke();
  }
  g.font = font(F.stamp, size);
  (g as any).letterSpacing = `${size * 0.06}px`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(s, (cw - 20) / 2, (ch - 20) / 2 + size * 0.04);
  // distress: knock out speckles and a few streaks
  const r = rng(s.length * 97 + size);
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < (cw * ch) / 90; i++) {
    g.globalAlpha = 0.3 + r() * 0.7;
    const rad = 0.6 + r() * size * 0.025;
    g.beginPath();
    g.arc(r() * cw, r() * ch, rad, 0, 6.28);
    g.fill();
  }
  g.globalAlpha = 0.25;
  for (let i = 0; i < 6; i++) {
    g.fillRect(0, r() * ch, cw, 1 + r() * 3);
  }
  stampCache.set(key, cv);
  return cv;
}

// lands exactly at t0 (scale 2.1 -> 1 over 0.14 s before), then sits
export function stamp(c: C, s: string, x: number, y: number, size: number, rot: number, t: number, t0: number, color = COL.stampRed, box = true) {
  if (t < t0 - 0.14) return;
  const u = p(t, t0 - 0.14, t0);
  const sc = lerp(2.1, 1, ein(u)) * (t > t0 ? 1 + 0.035 * Math.exp(-(t - t0) * 18) * Math.sin((t - t0) * 60) : 1);
  const cv = stampCanvas(s, size, color, box);
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(sc, sc);
  c.globalAlpha *= u * 0.9;
  c.globalCompositeOperation = "multiply";
  c.drawImage(cv, -cv.width / 2, -cv.height / 2);
  c.restore();
}

export function pin(c: C, x: number, y: number, t: number, t0: number, color = COL.red) {
  if (t < t0 - 0.2) return;
  const u = p(t, t0 - 0.2, t0);
  const s = lerp(1.8, 1, ein(u));
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.globalAlpha *= u;
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  c.ellipse(14, 18, 34, 22, 0, 0, 6.28);
  c.fill();
  const g = c.createRadialGradient(-10, -12, 4, 0, 0, 38);
  g.addColorStop(0, "#ff8a7a");
  g.addColorStop(0.5, color);
  g.addColorStop(1, "#6e0c0c");
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 36, 0, 6.28);
  c.fill();
  c.restore();
}

export function logo(c: C, key: string, cx: number, cy: number, h: number, alpha = 1) {
  const img = IMG[key];
  if (!img || !img.width) return;
  const w = (img.width / img.height) * h;
  c.save();
  c.globalAlpha *= alpha;
  c.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  c.restore();
}

// ---------- camera ----------
export type Hold = { ta: number; td: number; x: number; y: number; z: number };
type Key = { t: number; x: number; y: number; lz: number; vx: number; vy: number; vlz: number };

export function buildCamera(holds: Hold[]) {
  // drift: each hold slowly moves toward the next one (never a dead stop)
  const keys: Key[] = [];
  for (let i = 0; i < holds.length; i++) {
    const h = holds[i];
    const dur = Math.max(0.2, h.td - h.ta);
    // drift toward the next hold that is actually somewhere else (never a dead stop)
    let nx = h;
    for (let j = i + 1; j < holds.length; j++) {
      if (Math.hypot(holds[j].x - h.x, holds[j].y - h.y) > 60) {
        nx = holds[j];
        break;
      }
    }
    let dx = nx.x - h.x;
    let dy = nx.y - h.y;
    let d = Math.hypot(dx, dy);
    if (d < 1) {
      dx = 1;
      dy = 0.3;
      d = Math.hypot(dx, dy);
    }
    const drift = Math.min(d * 0.3, (30 + dur * 9) / h.z);
    dx = (dx / d) * drift;
    dy = (dy / d) * drift;
    const dlz = Math.log(1.035) * (dur > 2 ? 1 : 0.5); // slow push-in during holds
    const vx = dx / dur;
    const vy = dy / dur;
    const vlz = dlz / dur;
    const lz = Math.log(h.z);
    keys.push({ t: h.ta, x: h.x, y: h.y, lz, vx, vy, vlz });
    keys.push({ t: h.td, x: h.x + dx, y: h.y + dy, lz: lz + dlz, vx, vy, vlz });
    // long travel: add a pull-back key mid-way so we rise, travel, and dive in again
    if (i + 1 < holds.length) {
      const a = { x: h.x + dx, y: h.y + dy, z: Math.exp(lz + dlz) };
      const b = holds[i + 1];
      const T = b.ta - h.td;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const screen = dist * Math.min(a.z, b.z);
      if (screen > 1300 && T > 0.3) {
        const fitZ = (W * 0.95) / (dist + 1400);
        const mz = Math.min(a.z, b.z, Math.max(fitZ, Math.min(a.z, b.z) * 0.35));
        keys.push({
          t: h.td + T / 2,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          lz: Math.log(mz),
          vx: ((b.x - a.x) / T) * 1.45,
          vy: ((b.y - a.y) / T) * 1.45,
          vlz: 0,
        });
      }
    }
  }
  keys.sort((a, b) => a.t - b.t);
  return (t: number) => {
    if (t <= keys[0].t) {
      const k = keys[0];
      return { x: k.x, y: k.y, z: Math.exp(k.lz) };
    }
    if (t >= keys[keys.length - 1].t) {
      const k = keys[keys.length - 1];
      const e = t - k.t;
      return { x: k.x + k.vx * e, y: k.y + k.vy * e, z: Math.exp(k.lz + k.vlz * e) };
    }
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const dt = b.t - a.t;
    const u = (t - a.t) / dt;
    const h00 = 2 * u * u * u - 3 * u * u + 1;
    const h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u;
    const h11 = u * u * u - u * u;
    const f = (p0: number, m0: number, p1: number, m1: number) => h00 * p0 + h10 * dt * m0 + h01 * p1 + h11 * dt * m1;
    return { x: f(a.x, a.vx, b.x, b.vx), y: f(a.y, a.vy, b.y, b.vy), z: Math.exp(f(a.lz, a.vlz, b.lz, b.vlz)) };
  };
}

// handheld: layered slow sines (screen px / radians)
export function handheld(t: number) {
  const x = Math.sin(t * 0.71) * 3.2 + Math.sin(t * 1.93 + 1.2) * 1.6 + Math.sin(t * 4.1 + 0.4) * 0.5;
  const y = Math.sin(t * 0.83 + 2.1) * 2.6 + Math.sin(t * 2.27 + 0.3) * 1.3 + Math.sin(t * 3.7 + 2.4) * 0.5;
  const r = (Math.sin(t * 0.53 + 0.7) * 0.0011 + Math.sin(t * 1.61) * 0.0005);
  return { x, y, r };
}

// ---------- film finish ----------
let glowCv: HTMLCanvasElement | null = null;

export function finish(out: C, scene: HTMLCanvasElement, t: number, frame: number) {
  out.globalCompositeOperation = "source-over";
  out.globalAlpha = 1;
  out.drawImage(scene, 0, 0);
  // soft glow: blurred low-res copy screened on top
  if (!glowCv) glowCv = mk(W / 6, H / 6);
  const g = glowCv.getContext("2d")!;
  g.globalCompositeOperation = "copy";
  g.filter = "blur(5px)";
  g.drawImage(scene, 0, 0, W / 6, H / 6);
  g.filter = "none";
  out.globalCompositeOperation = "screen";
  out.globalAlpha = 0.2;
  out.imageSmoothingQuality = "high";
  out.drawImage(glowCv, 0, 0, W, H);
  // vignette
  out.globalCompositeOperation = "source-over";
  out.globalAlpha = 1;
  out.drawImage(vignette!, 0, 0);
  // grain
  const tile = noiseTiles[frame % noiseTiles.length];
  const r = rng(frame * 13 + 7);
  out.globalCompositeOperation = "overlay";
  out.globalAlpha = 0.11;
  const ox = Math.floor(r() * 256);
  const oy = Math.floor(r() * 256);
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) out.drawImage(tile, x, y);
  out.globalCompositeOperation = "source-over";
  out.globalAlpha = 1;
}

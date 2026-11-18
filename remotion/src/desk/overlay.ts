// Desk-style cards for the lines the 6:23 world never had (new jokes, polls, the quiz, Musk, the IPO
// size, the watch list). Drawn in screen space over the finished frame: an index card for the hero
// line / number / bars, sticky notes for short labels. Content and timing come from remap-data.ts.
import { C, COL, F, G, H, W, back, clamp, eout, font, indexCard, lerp, measure, p, sm, sticky, text } from "./engine";
import { OVERLAYS, type OverlayItem } from "./remap-data";

const STICKY: Record<string, string> = { red: "#f2a49b", gold: COL.sticky, green: "#b9dc8c", blue: "#a9cdf0", white: "#f5f1e6" };

function popScale(t: number, t0: number) {
  const u = p(t, t0 - 0.12, t0 + 0.14);
  return { a: clamp(u * 1.8), s: lerp(1.3, 1, back(u, 1.5)) };
}

const HERO = (size: number) => ({ size, fam: F.hero, color: COL.ink });
const TYPE = (size: number, color = COL.inkSoft) => ({ size, fam: F.type, color });

function fitSize(c: C, s: string, fam: string, size: number, maxW: number) {
  const w = measure(c, s, { size, fam });
  return w > maxW ? Math.floor((size * maxW) / w) : size;
}

function bars(c: C, sub: string, x: number, y: number, w: number, h: number, t: number, t0: number) {
  const items = sub.split(" | ").map((s) => {
    const [label, v] = s.split("§");
    return { label, v: parseFloat(v), hi: v.endsWith("*") };
  });
  const bw = w / items.length;
  items.forEach((it, i) => {
    const u = eout(p(t, t0 + i * 0.35, t0 + i * 0.35 + 0.7));
    const bh = (h - 70) * it.v * u;
    const cx = x + bw * (i + 0.5);
    c.fillStyle = it.hi ? COL.red : "#3c5f8a";
    c.globalAlpha *= 0.92;
    c.fillRect(cx - bw * 0.22, y + h - 70 - bh, bw * 0.44, bh);
    c.globalAlpha /= 0.92;
    text(c, it.label, cx, y + h - 30, { ...TYPE(fitSize(c, it.label, F.type, 34, bw - 20), it.hi ? COL.red : COL.ink) });
  });
}

function drawOverlay(c: C, o: (typeof OVERLAYS)[number], t: number) {
  const onCard = o.items.filter((i) => i.k !== "note");
  const notes = o.items.filter((i) => i.k === "note");
  const out = sm(p(t, o.t1 - 0.32, o.t1 - 0.02));
  const first = Math.min(...o.items.map((i) => i.t));
  const inn = sm(p(t, first - 0.3, first + 0.05));
  const a = inn * (1 - out);
  if (a <= 0) return;

  // the world steps back while the card is up
  c.fillStyle = `rgba(6,4,2,${0.42 * a})`;
  c.fillRect(0, 0, W, H);

  const z = G.z;
  G.z = 1;
  // ---- index card: hero line, stat, bars ----
  if (onCard.length) {
    const cw = o.shift ? 860 : 1060;
    const ox = o.shift * 250; // a Polaroid sits on the other side
    const rows = onCard.map((it) => (it.k === "bars" ? 360 : it.k === "stat" ? 230 : it.sub ? 230 : 180));
    const ch = Math.max(300, rows.reduce((s, r) => s + r, 0) + 110);
    const t0 = Math.min(...onCard.map((i) => i.t));
    const u = eout(p(t, t0 - 0.3, t0 + 0.1));
    const cy = (notes.length ? H * 0.43 : H * 0.5) + (1 - u) * 260 + out * 120;
    c.save();
    c.translate(W / 2 + ox, cy);
    c.rotate(lerp(-0.06, -0.018, u));
    c.globalAlpha = a;
    indexCard(c, cw, ch, { lift: 0.8 });
    let y = -ch / 2 + 75;
    onCard.forEach((it: OverlayItem, i) => {
      const ps = popScale(t, it.t);
      if (ps.a > 0) {
        c.save();
        c.translate(0, y + rows[i] / 2);
        c.scale(ps.s, ps.s);
        c.globalAlpha *= ps.a;
        const half = rows[i] / 2;
        if (it.k === "stat") {
          text(c, it.text, 0, -half + 95, { ...HERO(fitSize(c, it.text, F.hero, 150, cw - 120)), color: COL.red });
          text(c, it.sub, 0, half - 40, TYPE(fitSize(c, it.sub, F.type, 46, cw - 120)));
        } else if (it.k === "bars") {
          text(c, it.text.toUpperCase(), 0, -half + 30, { ...TYPE(34), track: 3 });
          bars(c, it.sub, -cw / 2 + 80, -half + 60, cw - 160, rows[i] - 60, t, it.t);
        } else {
          const size = fitSize(c, it.text, F.hero, 130, cw - 120);
          text(c, it.text, 0, it.sub ? -half + 85 : 0, HERO(size));
          if (it.sub) text(c, it.sub, 0, half - 45, TYPE(fitSize(c, it.sub, F.type, 48, cw - 120), COL.red));
        }
        c.restore();
      }
      y += rows[i];
    });
    c.restore();
  }

  // ---- sticky notes ----
  if (notes.length) {
    const sizes = notes.map((n) => Math.min(58, fitSize(c, n.text, F.marker, 58, 520)));
    const widths = notes.map((n, i) => measure(c, n.text, { size: sizes[i], fam: F.marker }) + 90);
    const gap = 46;
    const total = widths.reduce((s, w) => s + w, 0) + gap * (notes.length - 1);
    const room = o.shift ? W * 0.55 : W - 160;
    const scale = Math.min(1, room / total);
    let x = W / 2 + o.shift * 250 - (total * scale) / 2;
    const ny = onCard.length ? H * 0.82 : H * 0.5;
    notes.forEach((n, i) => {
      const w = widths[i] * scale;
      const ps = popScale(t, n.t);
      if (ps.a > 0) {
        c.save();
        c.translate(x + w / 2, ny + out * 80);
        c.rotate((i % 2 ? 1 : -1) * 0.04);
        c.scale(ps.s * scale, ps.s * scale);
        c.globalAlpha = a * ps.a;
        sticky(c, widths[i], 150, STICKY[n.sub] ?? COL.sticky);
        text(c, n.text, 0, 4, { size: sizes[i], fam: F.marker, color: COL.ink });
        c.restore();
      }
      x += w + gap * scale;
    });
  }
  G.z = z;
}

export function drawOverlays(c: C, t: number) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  for (const o of OVERLAYS) if (t > o.t0 - 0.5 && t < o.t1 + 0.1) drawOverlay(c, o, t);
  c.restore();
}

/** paper / pop cue times for the soundtrack (the card landing, each note) */
export const OVERLAY_CUES = OVERLAYS.flatMap((o) => {
  const first = Math.min(...o.items.map((i) => i.t));
  return [{ t: first - 0.1, k: "paper", v: 0.55 }, ...o.items.slice(1).map((i) => ({ t: i.t, k: "pop", v: 0.45 }))];
});

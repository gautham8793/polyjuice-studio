// The desk world for "The Week the AI Trade Blinked": every object, every on-the-word moment, and
// the camera beats. Times are absolute seconds in the final video (voiceover layout from
// timeline.json with the original 0.35 s tail per scene). See ../../../workspace/projects/
// 2026-11-ai-week-three-headlines/continuous-cut/BEATS.md for the beat table this implements.

import {
  C, COL, F, G, H, W, Hold, arcPts, arrow, back, buildCamera, check, circle, circlePts, clamp, cross, draw, eio, eout, greyLines,
  indexCard, lerp, logo, marker, measure, p, paper, pin, rng, rr, sm, stamp, sticky, strokeReveal, text, typed, desk,
} from "./engine";
import { NDX } from "./data";

export const DURATION = 383.433;

// ---------- cues (one source of truth for sound and shake) ----------
export type Cue = { t: number; k: string; v: number };
export const SFX: Cue[] = [];
export const HITS: number[] = [];
const cue = (k: string, t: number, v = 1) => (SFX.push({ t, k, v }), t);
const hit = (t: number, v = 1) => (HITS.push(t), cue("hit", t, v));
const mk = (t: number, dur = 0.45, v = 0.8) => (SFX.push({ t, k: "marker", v: dur * 10 + v * 0 }), t); // marker scribble
const ty = (t: number, chars: number, cps = 22) => (SFX.push({ t, k: "type", v: chars + cps / 1000 }), t);
const pop = (t: number, v = 0.6) => cue("pop", t, v);

// ---------- objects ----------
type Rect = [number, number, number, number];
export type Obj = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  t0: number;
  layer?: number;
  exit?: number;
  exitTo?: [number, number];
  noDrop?: boolean;
  silent?: boolean;
  draw: (c: C, t: number) => void;
  lit?: (t: number) => Rect; // local rect lit when hero (default: w x h)
  move?: (t: number) => { x: number; y: number; r: number };
};
const O: Obj[] = [];
const obj = (o: Obj) => {
  O.push(o);
  if (o.t0 > 0.6 && !o.silent && !o.noDrop) cue("paper", o.t0 - 0.06, 0.55);
  return o;
};

const ink = (t: number, tl: number) => sm(p(t, tl, tl + 0.35));
const mix = (a: string, b: string, u: number) => {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], u))).join(",")})`;
};
const popIn = (c: C, t: number, t0: number, fn: () => void, from = 1.25) => {
  if (t < t0 - 0.12) return;
  const u = p(t, t0 - 0.12, t0 + 0.08);
  c.save();
  c.globalAlpha *= clamp(u * 1.6);
  const s = lerp(from, 1, back(u, 1.4));
  c.scale(s, s);
  fn();
  c.restore();
};

// =====================================================================================
// TIMELINE STRIP (the spine)
// =====================================================================================
const STRIP_X = 3600;
const DX = { nov5: -2200, nov8: 0, nov19: 2200 };
const T = {
  lit5: pop(19.4, 0.4),
  lit8: pop(20.0, 0.4),
  lit19: pop(20.6, 0.4),
  circ5: mk(59.6),
  pin5: hit(104.1, 0.6),
  circ8: mk(108.3),
  arcBack: mk(211.3, 0.8),
  circ19: mk(223.2),
  one: mk(270.2, 0.3),
  two: mk(272.4, 0.3),
  xBack: mk(274.9, 0.35),
  pulse19: mk(372.7, 0.5),
};
obj({
  id: "strip",
  x: STRIP_X,
  y: 130,
  w: 7400,
  h: 360,
  r: 0,
  t0: -1,
  layer: 0,
  lit: () => [-3700, -460, 7400, 820],
  draw(c, t) {
    paper(c, 7400, 360, { fill: "#ebe2cb", radius: 4 });
    c.save();
    c.strokeStyle = COL.ink;
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(-3550, 110);
    c.lineTo(3550, 110);
    c.stroke();
    // faint day ticks between the three dates
    c.strokeStyle = "rgba(28,26,23,0.35)";
    c.lineWidth = 4;
    for (let x = -3500; x <= 3500; x += 100) {
      c.beginPath();
      c.moveTo(x, 110);
      c.lineTo(x, x % 500 === 0 ? 70 : 90);
      c.stroke();
    }
    c.restore();
    const dates: [string, number, number][] = [
      ["NOV 5", DX.nov5, T.lit5],
      ["NOV 8", DX.nov8, T.lit8],
      ["NOV 19", DX.nov19, T.lit19],
    ];
    for (const [s, x, tl] of dates) {
      const u = ink(t, tl);
      text(c, s, x, -40, { fam: F.hero, size: 230, color: mix("9c9384", "1c1a17", u) });
      c.fillStyle = mix("9c9384", "d42a2a", u);
      c.beginPath();
      c.arc(x, 110, 26, 0, 6.28);
      c.fill();
    }
    circle(c, DX.nov5, -40, 340, 165, t, T.circ5, 3, 14);
    circle(c, DX.nov8, -40, 330, 165, t, T.circ8, 5, 14);
    circle(c, DX.nov19, -40, 400, 165, t, T.circ19, 7, 14);
    if (t > T.pulse19) circle(c, DX.nov19, -40, 430, 190, t, T.pulse19, 9, 10, 0.5);
    pin(c, DX.nov5 + 330, -170, t, T.pin5);
    // order badges for clue one, written on the desk just above the strip
    for (const [n, x, tl] of [["1", DX.nov5, T.one], ["2", DX.nov8, T.two]] as [string, number, number][]) {
      if (t < tl) continue;
      circle(c, x, -330, 95, 95, t, tl, 11, 12, 0.35);
      marker(c, n, x, -325, t, tl + 0.1, 0.2, { size: 130 });
    }
  },
});

// backward arrow NOV 8 -> NOV 5 under the strip (fear priced in three days earlier), crossed out in clue one
const BACK = arcPts(3420, 340, 1580, 340, -0.075);
obj({
  id: "arcBack",
  x: 2500,
  y: 400,
  w: 2000,
  h: 220,
  r: 0,
  t0: -1,
  layer: 0.5,
  noDrop: true,
  draw(c, t) {
    if (t < T.arcBack) return;
    c.save();
    c.translate(-2500, -400);
    arrow(c, BACK, t, T.arcBack, 0.8, COL.red, 14, 46);
    cross(c, 2500, 455, 170, t, T.xBack, COL.red, 16);
    c.restore();
  },
});

// S-1 filing flag, pinned before NOV 5
const tFlag = hit(227.1, 0.5);
obj({
  id: "flag",
  x: 650,
  y: 60,
  w: 420,
  h: 230,
  r: -0.04,
  t0: tFlag,
  layer: 1,
  draw(c, t) {
    indexCard(c, 420, 230);
    text(c, "S-1", 20, 18, { fam: F.hero, size: 150 });
    pin(c, -165, -80, t, tFlag);
  },
});

// =====================================================================================
// STORY ZONE (above the strip)
// =====================================================================================
const tQ = mk(23.3, 0.4);
obj({
  id: "qnote",
  x: 1900,
  y: -560,
  w: 520,
  h: 520,
  r: -0.08,
  t0: 21.7,
  layer: 1,
  draw(c, t) {
    sticky(c, 520, 520);
    marker(c, "?", 0, 30, t, tQ, 0.35, { size: 400 });
  },
});

const tTitle1 = ty(28.1, 8, 26);
const tTitle2 = ty(28.55, 12, 26);
const tBlink = hit(29.2, 0.9);
obj({
  id: "title",
  x: 2900,
  y: -640,
  w: 1400,
  h: 620,
  r: 0.025,
  t0: 27.45,
  layer: 1,
  draw(c, t) {
    indexCard(c, 1400, 620);
    typed(c, "THE WEEK", 0, -170, t, tTitle1, { fam: F.type, size: 130 }, 26);
    typed(c, "THE AI TRADE", 0, -20, t, tTitle2, { fam: F.type, size: 130 }, 26);
    stamp(c, "BLINKED", 0, 175, 165, -0.05, t, tBlink);
  },
});

const tNmp = mk(32.7, 0.45);
const tNmp2 = mk(33.15, 0.3);
obj({
  id: "nmp",
  x: 4050,
  y: -470,
  w: 900,
  h: 460,
  r: 0.07,
  t0: 32.4,
  layer: 1,
  draw(c, t) {
    indexCard(c, 900, 460);
    marker(c, "NO MASTER", 0, -30, t, tNmp, 0.45, { size: 112, color: COL.ink });
    marker(c, "PLAN", 0, 110, t, tNmp2, 0.3, { size: 112, color: COL.ink });
  },
});

const tStory = ty(39.8, 10, 24);
const tAI = mk(42.4, 0.35);
const tCracks = [cue("crack", 52.8), cue("crack", 53.05), cue("crack", 53.3)];
const tPressure = mk(355.9, 0.55);
const tPriced = hit(370.4, 1);
const tFast = mk(370.8, 0.3);
const crackPaths: [number, number][][] = (() => {
  const r = rng(42);
  const starts: [number, number, number][] = [
    [-550, -120, 0.25],
    [550, 80, Math.PI + 0.15],
    [-120, -340, 1.45],
  ];
  return starts.map(([x, y, a]) => {
    const pts: [number, number][] = [[x, y]];
    let cx = x;
    let cy = y;
    for (let i = 0; i < 9; i++) {
      const ang = a + (r() - 0.5) * 1.1;
      cx += Math.cos(ang) * (55 + r() * 45);
      cy += Math.sin(ang) * (55 + r() * 45);
      pts.push([cx, cy]);
    }
    return pts;
  });
})();
obj({
  id: "aicard",
  x: 5100,
  y: -650,
  w: 1100,
  h: 680,
  r: -0.035,
  t0: 37.35,
  layer: 1,
  draw(c, t) {
    indexCard(c, 1100, 680);
    typed(c, "THE STORY:", -490, -228, t, tStory, { fam: F.type, size: 64, align: "left" }, 24);
    marker(c, "AI", 0, 70, t, tAI, 0.35, { size: 400, color: COL.ink });
    crackPaths.forEach((pts, i) => {
      const u = eout(p(t, tCracks[i], tCracks[i] + 0.22));
      if (u <= 0) return;
      c.save();
      c.translate(3, 4);
      strokeReveal(c, pts, u, "rgba(255,255,255,0.7)", 5, 1);
      c.restore();
      strokeReveal(c, pts, u, "#2a1c10", 7, 1);
    });
    circle(c, 0, 0, 650, 430, t, tPressure, 13, 16, 0.55);
    stamp(c, "PRICED IN", 250, -215, 118, -0.08, t, tPriced);
    marker(c, "FAST.", 340, 255, t, tFast, 0.3, { size: 110 });
  },
});

// =====================================================================================
// NOV 5: CRASH ZONE
// =====================================================================================
const tNum = pop(0.7, 0.8);
const tGone = mk(1.6, 0.3);
const tCircle25 = mk(66.4, 0.5);
const tPulse25 = cue("pop", 99.2, 0.4);
obj({
  id: "print25",
  x: 1050,
  y: 800,
  w: 960,
  h: 640,
  r: -0.07,
  t0: 0.25,
  layer: 1,
  draw(c, t) {
    paper(c, 960, 640, { torn: true, fill: COL.paperWhite });
    c.fillStyle = "rgba(28,26,23,0.85)";
    rr(c, -420, -275, 300, 34, 6);
    c.fill();
    greyLines(c, -420, -215, 840, 1, 30, 3);
    const pulse = t > tPulse25 ? 1 + 0.05 * Math.exp(-(t - tPulse25) * 5) * Math.sin((t - tPulse25) * 14) : 1;
    popIn(c, t, tNum, () => {
      c.save();
      c.scale(pulse, pulse);
      text(c, "$2.5", 0, -45, { fam: F.hero, size: 270 });
      text(c, "TRILLION", 0, 140, { fam: F.hero, size: 120, track: 6 });
      c.restore();
    });
    strokeReveal(c, [[-330, -40], [330, -60]], draw(t, tGone, 0.28), COL.red, 22);
    greyLines(c, -420, 225, 840, 2, 34, 9);
    circle(c, 0, 40, 420, 250, t, tCircle25, 21, 14);
  },
});

const PK = 132; // Oct 6 record close
const N5 = 154; // Nov 5
const tClimb0 = 43.5;
const tClimb1 = 45.3;
const tDrop0 = 60.75;
const tDrop1 = 61.85;
const tPct = hit(61.5, 0.8);
const tCorr = mk(64.0, 0.5);
const tCorrLbl = mk(64.6, 0.4);
obj({
  id: "chartN",
  x: 1900,
  y: 1420,
  w: 1100,
  h: 720,
  r: 0.045,
  t0: 42.65,
  layer: 1,
  draw(c, t) {
    paper(c, 1100, 720, { fill: COL.paperWhite });
    text(c, "NASDAQ 100", -500, -300, { size: 56, weight: 800, align: "left" });
    text(c, "daily close · 2026", 500, -300, { size: 34, weight: 600, align: "right", color: COL.inkSoft });
    const x0 = -480;
    const x1 = 480;
    const yTop = -220;
    const yBot = 260;
    const vmin = 22500;
    const vmax = 31800;
    const X = (i: number) => x0 + ((x1 - x0) * i) / (NDX.length - 1);
    const Y = (v: number) => yBot - ((v - vmin) / (vmax - vmin)) * (yBot - yTop);
    c.strokeStyle = "rgba(28,26,23,0.12)";
    c.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const y = yTop + ((yBot - yTop) * k) / 3;
      c.beginPath();
      c.moveTo(x0, y);
      c.lineTo(x1, y);
      c.stroke();
    }
    let idx = 0;
    if (t > tClimb0) idx = lerp(0, PK, eio(p(t, tClimb0, tClimb1)));
    if (t > tDrop0) idx = lerp(PK, N5, eio(p(t, tDrop0, tDrop1)));
    if (idx <= 0) return;
    const path = (from: number, to: number, color: string) => {
      c.strokeStyle = color;
      c.lineWidth = 8;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      for (let i = from; i <= Math.floor(to); i++) {
        if (i === from) c.moveTo(X(i), Y(NDX[i]));
        else c.lineTo(X(i), Y(NDX[i]));
      }
      const f = to - Math.floor(to);
      if (f > 0 && Math.floor(to) + 1 < NDX.length) {
        const i = Math.floor(to);
        c.lineTo(lerp(X(i), X(i + 1), f), lerp(Y(NDX[i]), Y(NDX[i + 1]), f));
      }
      c.stroke();
    };
    path(0, Math.min(idx, PK), COL.green);
    if (idx > PK) path(PK, idx, COL.red);
    if (idx >= PK - 0.5) {
      c.fillStyle = COL.ink;
      c.beginPath();
      c.arc(X(PK), Y(NDX[PK]), 13, 0, 6.28);
      c.fill();
    }
    // correction line: 10% below the record
    const yc = Y(NDX[PK] * 0.9);
    if (t > tCorr) {
      c.save();
      c.setLineDash([26, 18]);
      strokeReveal(c, [[x0, yc], [x1, yc]], draw(t, tCorr, 0.5), COL.red, 6);
      c.restore();
      if (t > tCorrLbl) {
        c.save();
        c.globalAlpha *= sm(p(t, tCorrLbl, tCorrLbl + 0.15));
        c.fillStyle = "rgba(243,239,230,0.94)";
        rr(c, -470, yc - 100, 420, 90, 12);
        c.fill();
        c.restore();
      }
      marker(c, "CORRECTION", -260, yc - 55, t, tCorrLbl, 0.4, { size: 58 });
    }
    popIn(c, t, tPct, () => {
      text(c, "−5.5%", 230, 150, { fam: F.hero, size: 160, color: COL.red });
      text(c, "Nasdaq Composite · Nov 5", 230, 240, { size: 32, weight: 600, color: COL.inkSoft });
    });
  },
});

// three suspects: not earnings, not a bank, an election
const tX1 = mk(71.1, 0.3);
const tX2 = mk(72.1, 0.3);
const tOk = mk(73.0, 0.45);
const cards: [string, string, number, number, number, number][] = [
  ["cardA", "BAD EARNINGS", 900, 2000, -0.05, 70.35],
  ["cardB", "BANK COLLAPSE", 1560, 2040, 0.035, 70.5],
  ["cardC", "ELECTION", 2220, 2000, -0.025, 70.65],
];
cards.forEach(([id, label, x, y, r, t0], i) =>
  obj({
    id,
    x,
    y,
    w: 640,
    h: 340,
    r,
    t0,
    layer: 1,
    draw(c, t) {
      indexCard(c, 640, 340);
      text(c, label, 0, 30, { size: i === 2 ? 92 : 70, weight: 800 });
      if (i === 0) cross(c, 0, 25, 230, t, tX1, COL.red, 18);
      if (i === 1) cross(c, 0, 25, 230, t, tX2, COL.red, 18);
      if (i === 2) circle(c, 0, 30, 270, 110, t, tOk, 17, 14);
    },
  }),
);

const tSwept = cue("pop", 74.5, 0.3);
obj({
  id: "ballot",
  x: 300,
  y: 1200,
  w: 480,
  h: 680,
  r: -0.12,
  t0: 73.55,
  layer: 1,
  draw(c, t) {
    paper(c, 480, 680, { fill: COL.paperWhite });
    text(c, "BALLOT", 0, -260, { size: 64, weight: 800, track: 6 });
    c.fillStyle = COL.ink;
    rr(c, -200, -210, 400, 8, 4);
    c.fill();
    for (let i = 0; i < 5; i++) {
      const y = -130 + i * 95;
      c.strokeStyle = COL.ink;
      c.lineWidth = 5;
      c.beginPath();
      c.ellipse(-150, y, 34, 22, 0, 0, 6.28);
      c.stroke();
      greyLines(c, -90, y - 10, 270, 1, 20, 30 + i, 18);
      const u = sm(p(t, tSwept + i * 0.14, tSwept + i * 0.14 + 0.12));
      if (u > 0) {
        c.fillStyle = COL.ink;
        c.globalAlpha = u;
        c.beginPath();
        c.ellipse(-150, y, 30 * u, 19 * u, 0, 0, 6.28);
        c.fill();
        c.globalAlpha = 1;
      }
    }
  },
});

const tRoll = cue("roll", 77.2, 0.7);
const rLines: [string, number][] = [
  ["+ AI RULES", ty(78.6, 10, 30)],
  ["+ CHIP CURBS", ty(80.5, 12, 30)],
  ["+ DATA-CENTRE", ty(82.7, 13, 30)],
  ["  PAUSE", ty(83.15, 7, 30)],
];
obj({
  id: "receipt",
  x: 300,
  y: 1950,
  w: 600,
  h: 700,
  r: 0.06,
  t0: 76.8,
  layer: 1,
  lit: () => [-300, -350, 600, 700],
  draw(c, t) {
    const L = lerp(150, 700, eio(p(t, tRoll, tRoll + 0.7)));
    c.save();
    c.translate(0, -350 + L / 2);
    paper(c, 600, L, { fill: "#f6f3ea", torn: true, radius: 2 });
    c.restore();
    c.save();
    c.beginPath();
    c.rect(-300, -350, 600, L);
    c.clip();
    rLines.forEach(([s, t0], i) => typed(c, s, -270, -250 + i * 105, t, t0, { fam: F.mono, size: 66, weight: 700, align: "left" }, 30));
    c.restore();
  },
});

// conveyor: build data centres, buy chips, ship them everywhere... forever
const tForever = mk(93.1, 0.5);
const tFreeze = 94.8;
const tImagine = mk(96.6, 0.7);
const tBreak = cue("crack", 97.2, 0.8);
const chipIcon = (c: C, x: number, y: number, s: number) => {
  c.fillStyle = "#2c3a2e";
  rr(c, x - s / 2, y - s / 2, s, s, s * 0.1);
  c.fill();
  c.fillStyle = "#c7a24a";
  for (let k = -2; k <= 2; k++) {
    c.fillRect(x + (k * s) / 6 - 2, y - s / 2 - 8, 4, 8);
    c.fillRect(x + (k * s) / 6 - 2, y + s / 2, 4, 8);
  }
  c.fillStyle = "#9aa1a8";
  rr(c, x - s * 0.28, y - s * 0.28, s * 0.56, s * 0.56, 3);
  c.fill();
};
obj({
  id: "conveyor",
  x: 1250,
  y: 2450,
  w: 1700,
  h: 380,
  r: -0.015,
  t0: 84.9,
  layer: 1,
  draw(c, t) {
    paper(c, 1700, 380, { fill: COL.paperWhite });
    // data centre rack
    c.strokeStyle = COL.ink;
    c.lineWidth = 7;
    rr(c, -790, -110, 150, 220, 10);
    c.stroke();
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(-770, -60 + k * 45);
      c.lineTo(-660, -60 + k * 45);
      c.stroke();
      c.fillStyle = COL.green;
      c.beginPath();
      c.arc(-750, -78 + k * 45, 6, 0, 6.28);
      c.fill();
    }
    // globe
    c.beginPath();
    c.arc(710, 0, 105, 0, 6.28);
    c.stroke();
    c.beginPath();
    c.ellipse(710, 0, 45, 105, 0, 0, 6.28);
    c.stroke();
    c.beginPath();
    c.moveTo(605, 0);
    c.lineTo(815, 0);
    c.stroke();
    // belt
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(-600, 80);
    c.lineTo(560, 80);
    c.stroke();
    for (let x = -580; x <= 560; x += 80) {
      c.beginPath();
      c.arc(x, 100, 14, 0, 6.28);
      c.stroke();
    }
    // chips moving, easing to a stop on "break"
    const v = 170;
    const tt = t < tFreeze - 0.5 ? t : tFreeze - 0.5 + 0.5 * eout(p(t, tFreeze - 0.5, tFreeze)) * 0.5;
    const off = (tt * v) % 160;
    c.save();
    c.beginPath();
    c.rect(-600, -100, 1160, 200);
    c.clip();
    for (let x = -680 + off; x < 600; x += 160) chipIcon(c, x, 40, 62);
    c.restore();
    marker(c, "FOREVER?", 420, -125, t, tForever, 0.5, { size: 96 });
    // imagined break: dashed thought-cloud, then a crack across the belt
    if (t > tImagine) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const bump = 1 + 0.07 * Math.abs(Math.sin(a * 7));
        pts.push([-20 + Math.cos(a) * 760 * bump, 10 + Math.sin(a) * 175 * bump]);
      }
      c.save();
      c.setLineDash([22, 16]);
      strokeReveal(c, pts, draw(t, tImagine, 0.7), COL.red, 7);
      c.restore();
      strokeReveal(c, [[-20, -80], [10, -30], [-25, 20], [15, 70], [-10, 130]], eout(p(t, tBreak, tBreak + 0.2)), COL.red, 12);
    }
  },
});

// =====================================================================================
// NOV 8: SCANDAL ZONE
// =====================================================================================
const tOpen = cue("flip", 7.8, 0.8);
const tClose = cue("flip", 190.6, 0.8);
const tAlleged = hit(10.6, 1);
const tTab = ty(110.0, 8, 24);
const tJacketNote = 112.0;
const tJacket = mk(112.4, 0.8);
const tNatSec = hit(207.9, 0.9);
const tQ8a = mk(334.8, 0.5);
const tQ8b = mk(335.5, 0.5);
const openAmt = (t: number) => eio(p(t, tOpen, tOpen + 0.6)) * (1 - eio(p(t, tClose, tClose + 0.6)));
const jacket = (c: C, u: number) => {
  // a leather-jacket sketch: body, lapels, zip, sleeves (one continuous-feeling marker drawing)
  const s = (pts: [number, number][], a: number, b: number) => strokeReveal(c, pts, clamp((u - a) / (b - a)), COL.ink, 7);
  s([[-70, -95], [-120, -80], [-150, 90], [-90, 100], [-80, -20]], 0, 0.25);
  s([[70, -95], [120, -80], [150, 90], [90, 100], [80, -20]], 0.2, 0.45);
  s([[-80, -20], [-75, 110], [75, 110], [80, -20]], 0.4, 0.6);
  s([[-70, -95], [-25, -40], [0, 20], [25, -40], [70, -95]], 0.55, 0.8);
  s([[0, 20], [0, 108]], 0.78, 0.9);
  s([[-45, -98], [-20, -70], [20, -70], [45, -98]], 0.88, 1);
};
obj({
  id: "dossier",
  x: 3400,
  y: 860,
  w: 2000,
  h: 800,
  r: 0.02,
  t0: 2.55,
  layer: 1,
  lit: (t) => (openAmt(t) > 0.5 ? [-1000, -440, 2000, 820] : [0, -440, 1000, 820]),
  draw(c, t) {
    const op = openAmt(t);
    // back panel (right half) + tab
    c.save();
    c.translate(500, 0);
    paper(c, 1000, 720, { fill: "#d8ba7e", radius: 10, shade: 0.25 });
    c.restore();
    c.save();
    c.fillStyle = "#d8ba7e";
    rr(c, 400, -440, 560, 110, 14);
    c.fill();
    c.restore();
    typed(c, "J. HUANG", 680, -392, t, tTab, { fam: F.type, size: 66 }, 24);
    // the page inside
    c.save();
    c.translate(500, 10);
    paper(c, 900, 640, { fill: COL.paperWhite, radius: 3 });
    logo(c, "nvidia", -230, -250, 52, 0.85);
    greyLines(c, -400, -170, 800, 3, 46, 61);
    c.fillStyle = "#111";
    const r = rng(77);
    for (let i = 0; i < 5; i++) {
      const y = -20 + i * 52;
      greyLines(c, -400, y, 800, 1, 40, 70 + i);
      rr(c, -400 + r() * 300, y - 6, 180 + r() * 240, 30, 3);
      c.fill();
    }
    stamp(c, "ALLEGED", 40, 110, 150, -0.17, t, tAlleged);
    // jacket sticky (Ch 3)
    if (t > tJacketNote - 0.3) {
      c.save();
      c.translate(270, -180);
      c.rotate(0.08);
      const u = p(t, tJacketNote - 0.3, tJacketNote);
      const sc = lerp(1.3, 1, eout(u));
      c.scale(sc, sc);
      c.globalAlpha *= u;
      sticky(c, 320, 320);
      c.translate(0, 10);
      jacket(c, p(t, tJacket, tJacket + 0.8));
      c.restore();
    }
    c.restore();
    // cover, flipping open around the spine (x = 0)
    const k = Math.cos(Math.PI * op);
    const lift = Math.sin(Math.PI * op);
    c.save();
    c.scale(k, 1);
    c.translate(500, 0);
    paper(c, 1000, 720, { fill: k > 0 ? "#d2ad6a" : "#dcc08a", radius: 10, lift, shade: 0.22 });
    if (k > 0) {
      logo(c, "nvidia", 0, -170, 92, 0.9);
      stamp(c, "NATIONAL SECURITY", 0, 110, 92, -0.07, t, tNatSec);
      if (t > 333.6) {
        c.save();
        c.translate(250, 170);
        c.rotate(-0.06);
        const u = p(t, 333.6, 333.9);
        c.globalAlpha *= u;
        sticky(c, 460, 330);
        marker(c, "1 PERSON =", 0, -60, t, tQ8a, 0.5, { size: 64, color: COL.ink });
        marker(c, "WHOLE SECTOR?", 0, 60, t, tQ8b, 0.5, { size: 56, color: COL.red });
        c.restore();
      }
    }
    c.restore();
  },
});

const tTrill = mk(47.0, 0.4);
obj({
  id: "cert",
  x: 4850,
  y: 760,
  w: 760,
  h: 500,
  r: 0.08,
  t0: 45.3,
  layer: 1,
  draw(c, t) {
    paper(c, 760, 500, { fill: "#efe8d2" });
    c.strokeStyle = "#5d7a5c";
    c.lineWidth = 6;
    rr(c, -350, -220, 700, 440, 10);
    c.stroke();
    c.lineWidth = 2.5;
    rr(c, -330, -200, 660, 400, 8);
    c.stroke();
    c.strokeStyle = "rgba(93,122,92,0.35)";
    c.lineWidth = 2;
    for (let k = 0; k < 10; k++) {
      c.beginPath();
      for (let x = -320; x <= 320; x += 8) {
        const y = 165 + Math.sin(x * 0.05 + k * 0.6) * 10 - k * 2;
        if (x === -320) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    text(c, "SHARE CERTIFICATE", 0, -150, { size: 34, weight: 700, track: 7, color: "#3f5a3f" });
    logo(c, "nvidia", 0, -40, 86);
    marker(c, "TRILLIONS", 0, 95, t, tTrill, 0.4, { size: 92 });
  },
});

obj({
  id: "tabloid",
  x: 2800,
  y: 1650,
  w: 620,
  h: 780,
  r: -0.12,
  t0: 115.45,
  exit: 117.9,
  exitTo: [-700, 500],
  layer: 1,
  draw(c) {
    paper(c, 620, 780, { fill: "#e9e4d8", torn: true });
    c.fillStyle = "#151515";
    rr(c, -260, -330, 520, 70, 6);
    c.fill();
    rr(c, -260, -240, 380, 70, 6);
    c.fill();
    c.fillStyle = "rgba(20,20,20,0.18)";
    rr(c, -260, -140, 250, 300, 6);
    c.fill();
    greyLines(c, 20, -140, 240, 8, 38, 91);
    greyLines(c, -260, 190, 520, 3, 40, 92);
  },
});

const tSg = mk(122.0, 0.35);
const tHazard = hit(166.3, 0.7);
obj({
  id: "mega",
  x: 3550,
  y: 1650,
  w: 760,
  h: 430,
  r: 0.09,
  t0: 119.8,
  layer: 1,
  draw(c, t) {
    paper(c, 760, 430, { fill: "#f7f5ef", radius: 10 });
    c.fillStyle = COL.ink;
    c.fillRect(-380, -215, 760, 22);
    text(c, "MEGASPEED", 0, -45, { fam: F.hero, size: 140, track: 4 });
    greyLines(c, -170, 45, 340, 1, 30, 101, 14);
    text(c, "SINGAPORE", 0, 125, { size: 50, weight: 700, track: 8, color: COL.inkSoft });
    strokeReveal(c, [[-165, 168], [165, 162]], draw(t, tSg, 0.35), COL.red, 10);
    if (t > tHazard - 0.12) {
      const u = p(t, tHazard - 0.12, tHazard + 0.05);
      c.save();
      c.globalAlpha *= clamp(u * 1.5);
      c.beginPath();
      c.rect(-380, -215, 760, 430);
      c.rect(-342, -177, 684, 354);
      c.clip("evenodd");
      c.fillStyle = "#f2c230";
      c.fillRect(-400, -240, 800, 480);
      c.fillStyle = "#151515";
      for (let x = -900; x < 900; x += 70) {
        c.beginPath();
        c.moveTo(x, -240);
        c.lineTo(x + 35, -240);
        c.lineTo(x + 35 + 480, 240);
        c.lineTo(x + 480, 240);
        c.closePath();
        c.fill();
      }
      c.restore();
      popIn(c, t, tHazard, () => {
        c.save();
        c.translate(330, -230);
        c.fillStyle = "#f2c230";
        c.strokeStyle = "#151515";
        c.lineWidth = 10;
        c.lineJoin = "round";
        c.beginPath();
        c.moveTo(0, -95);
        c.lineTo(100, 75);
        c.lineTo(-100, 75);
        c.closePath();
        c.fill();
        c.stroke();
        text(c, "!", 0, 15, { fam: F.hero, size: 110, color: "#151515" });
        c.restore();
      });
    }
  },
});

const tSmuggle = mk(127.7, 1.0);
const tChina = hit(130.6, 0.6);
const ROUTE = arcPts(-250, 150, 250, -90, -0.35);
obj({
  id: "map",
  x: 4350,
  y: 1650,
  w: 780,
  h: 520,
  r: -0.07,
  t0: 126.4,
  layer: 1,
  draw(c, t) {
    paper(c, 780, 520, { fill: "#e7ecee" });
    c.strokeStyle = "rgba(42,100,184,0.16)";
    c.lineWidth = 2;
    for (let x = -360; x <= 360; x += 60) {
      c.beginPath();
      c.moveTo(x, -240);
      c.lineTo(x, 240);
      c.stroke();
    }
    for (let y = -240; y <= 240; y += 60) {
      c.beginPath();
      c.moveTo(-370, y);
      c.lineTo(370, y);
      c.stroke();
    }
    c.fillStyle = COL.ink;
    c.beginPath();
    c.arc(-250, 150, 16, 0, 6.28);
    c.fill();
    chipIcon(c, -250, 210, 44);
    c.save();
    c.setLineDash([24, 16]);
    arrow(c, ROUTE, t, tSmuggle, 1.0, COL.red, 10, 38);
    c.restore();
    [129.3, 129.7, 130.1].forEach((tc, i) => {
      if (t < tc) return;
      const pt = ROUTE[10 + i * 9];
      popIn(c, t, tc, () => chipIcon(c, pt[0], pt[1] - 40, 40));
    });
    c.fillStyle = COL.red;
    c.beginPath();
    c.arc(250, -90, 18 * sm(p(t, tSmuggle + 0.9, tSmuggle + 1.1)), 0, 6.28);
    c.fill();
    popIn(c, t, tChina, () => text(c, "CHINA", 160, -175, { fam: F.hero, size: 110 }));
  },
});

const memos: [string, string, number, number, number, number][] = [
  ["memo1", "BOARD PROBE", 2480, 2090, -0.07, hit(133.6, 0.4)],
  ["memo2", "FEDERAL PROBE", 3050, 2110, 0.05, hit(135.2, 0.4)],
  ["memo3", "RESIGN?", 3640, 2090, -0.035, hit(137.0, 0.5)],
];
memos.forEach(([id, label, x, y, r, t0], i) =>
  obj({
    id,
    x,
    y,
    w: 540,
    h: 300,
    r,
    t0,
    layer: 1,
    silent: true,
    draw(c) {
      paper(c, 540, 300, { fill: i === 2 ? "#f6e3df" : COL.paperWhite });
      greyLines(c, -190, -105, 380, 1, 30, 120 + i, 12);
      text(c, label, 0, 25, { size: i === 2 ? 88 : 66, weight: 800, color: i === 2 ? COL.red : COL.ink });
      greyLines(c, -190, 95, 260, 1, 30, 130 + i, 12);
    },
  }),
);

const NV = [100, 100.8, 99.6, 97.2, 94.1, 92.4, 90.3];
const tNv = 138.4;
const tTen = hit(139.8, 0.7);
obj({
  id: "nvda",
  x: 4400,
  y: 2150,
  w: 760,
  h: 480,
  r: -0.05,
  t0: 138.1,
  layer: 1,
  draw(c, t) {
    paper(c, 760, 480, { fill: COL.paperWhite });
    text(c, "NVDA", -330, -175, { size: 58, weight: 800, align: "left" });
    text(c, "Nov 9–10", 330, -175, { size: 36, weight: 600, align: "right", color: COL.inkSoft });
    const X = (i: number) => -320 + (640 * i) / (NV.length - 1);
    const Y = (v: number) => -90 + ((101 - v) / 11) * 260;
    const pts = NV.map((v, i) => [X(i), Y(v)] as [number, number]);
    strokeReveal(c, pts, eio(p(t, tNv, tNv + 1.2)), COL.red, 8, 1);
    popIn(c, t, tTen, () => text(c, "−10%", -130, 120, { fam: F.hero, size: 150, color: COL.red }));
  },
});

const tMicLight = 142.5;
obj({
  id: "mic",
  x: 4950,
  y: 2850,
  w: 560,
  h: 470,
  r: 0.035,
  t0: 141.6,
  layer: 1,
  draw(c, t) {
    indexCard(c, 560, 470);
    const u = sm(p(t, tMicLight, tMicLight + 1.2));
    if (u > 0) {
      const g = c.createRadialGradient(0, -40, 10, 0, -40, 260);
      g.addColorStop(0, `rgba(255,214,140,${0.55 * u})`);
      g.addColorStop(1, "rgba(255,214,140,0)");
      c.fillStyle = g;
      c.fillRect(-280, -235, 560, 470);
    }
    c.strokeStyle = COL.ink;
    c.lineWidth = 8;
    c.lineCap = "round";
    rr(c, -50, -170, 100, 160, 50);
    c.stroke();
    c.lineWidth = 3;
    for (let y = -140; y < -30; y += 18) {
      c.beginPath();
      c.moveTo(-40, y);
      c.lineTo(40, y);
      c.stroke();
    }
    c.lineWidth = 8;
    c.beginPath();
    c.arc(0, -70, 80, 0.15, Math.PI - 0.15);
    c.stroke();
    c.beginPath();
    c.moveTo(0, 10);
    c.lineTo(0, 140);
    c.moveTo(-90, 150);
    c.lineTo(90, 150);
    c.stroke();
  },
});

// ---------- the roast ----------
const tGlint = cue("shimmer", 149.4, 0.5);
obj({
  id: "chip",
  x: 4150,
  y: 2800,
  w: 640,
  h: 640,
  r: -0.1,
  t0: 147.2,
  layer: 1,
  draw(c, t) {
    c.save();
    c.shadowColor = "rgba(0,0,0,0.6)";
    c.shadowBlur = 30 * G.z;
    c.shadowOffsetY = 18 * G.z;
    c.fillStyle = "#1d3524";
    rr(c, -300, -300, 600, 600, 26);
    c.fill();
    c.restore();
    c.fillStyle = "#c9a54d";
    for (let k = -8; k <= 8; k++) {
      c.fillRect(k * 32 - 6, -300, 12, 26);
      c.fillRect(k * 32 - 6, 274, 12, 26);
      c.fillRect(-300, k * 32 - 6, 26, 12);
      c.fillRect(274, k * 32 - 6, 26, 12);
    }
    const g = c.createLinearGradient(-200, -200, 200, 200);
    g.addColorStop(0, "#e2e5e9");
    g.addColorStop(0.5, "#9aa0a8");
    g.addColorStop(1, "#d3d6db");
    c.fillStyle = g;
    rr(c, -200, -200, 400, 400, 16);
    c.fill();
    logo(c, "nvidia", 0, 0, 58, 0.75);
    const u = p(t, tGlint, tGlint + 0.7);
    if (u > 0 && u < 1) {
      c.save();
      rr(c, -200, -200, 400, 400, 16);
      c.clip();
      const gx = lerp(-520, 520, eio(u));
      const gg = c.createLinearGradient(gx - 120, gx - 120, gx + 120, gx + 120);
      gg.addColorStop(0, "rgba(255,255,255,0)");
      gg.addColorStop(0.5, "rgba(255,255,255,0.85)");
      gg.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gg;
      c.fillRect(-200, -200, 400, 400);
      c.restore();
    }
  },
});

const t404 = hit(152.4, 1);
const tDone = mk(363.4, 0.3);
obj({
  id: "bgcheck",
  x: 3300,
  y: 2800,
  w: 800,
  h: 600,
  r: 0.035,
  t0: 150.65,
  layer: 1,
  draw(c, t) {
    paper(c, 800, 600, { fill: COL.paperWhite });
    text(c, "BACKGROUND CHECK", 0, -232, { size: 60, weight: 800 });
    c.fillStyle = COL.ink;
    rr(c, -340, -190, 680, 6, 3);
    c.fill();
    for (let i = 0; i < 3; i++) {
      const y = -110 + i * 100;
      greyLines(c, -340, y, 330, 1, 30, 140 + i, 20);
      c.strokeStyle = "rgba(28,26,23,0.5)";
      c.lineWidth = 3;
      c.strokeRect(20, y - 25, 320, 64);
    }
    c.strokeStyle = COL.ink;
    c.lineWidth = 6;
    c.strokeRect(255, 185, 90, 90);
    check(c, 300, 225, 95, t, tDone, COL.red, 16);
    stamp(c, "404", -70, 70, 230, -0.13, t, t404);
  },
});

const ticks = [mk(156.7, 0.3), mk(157.7, 0.3), mk(158.8, 0.3)];
const tDating = mk(161.3, 0.45);
const tDatingX = mk(161.65, 0.3);
obj({
  id: "checklist",
  x: 2450,
  y: 2800,
  w: 720,
  h: 820,
  r: -0.035,
  t0: 153.15,
  layer: 1,
  draw(c, t) {
    paper(c, 720, 820, { fill: COL.paperWhite });
    text(c, "EXPORT COMPLIANCE", 0, -330, { size: 52, weight: 800 });
    const rows = ["LAWYERS", "AUDITS", "PAPERWORK"];
    for (let i = 0; i < 4; i++) {
      const y = -190 + i * 135;
      c.strokeStyle = COL.ink;
      c.lineWidth = 6;
      c.strokeRect(-290, y - 38, 76, 76);
      if (i < 3) {
        text(c, rows[i], -180, y + 4, { size: 64, weight: 700, align: "left" });
        check(c, -248, y, 80, t, ticks[i], COL.red, 15);
      } else {
        marker(c, "DATING LIFE", -180, y + 4, t, tDating, 0.45, { size: 66, align: "left", color: COL.ink });
        cross(c, -252, y, 70, t, tDatingX, COL.red, 15);
      }
    }
  },
});

const tNeedle = cue("whoosh-s", 167.6, 0.4);
const tHeart = mk(171.1, 0.4);
obj({
  id: "speedo",
  x: 2500,
  y: 3550,
  w: 600,
  h: 480,
  r: 0.05,
  t0: 167.0,
  layer: 1,
  draw(c, t) {
    indexCard(c, 600, 480);
    const cx = 0;
    const cy = 120;
    c.lineCap = "round";
    c.strokeStyle = COL.ink;
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, 210, Math.PI, Math.PI * 1.72);
    c.stroke();
    c.strokeStyle = COL.red;
    c.beginPath();
    c.arc(cx, cy, 210, Math.PI * 1.72, Math.PI * 2);
    c.stroke();
    c.strokeStyle = COL.ink;
    c.lineWidth = 5;
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI + (k / 10) * Math.PI;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 175, cy + Math.sin(a) * 175);
      c.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200);
      c.stroke();
    }
    const u = p(t, tNeedle + 0.1, tNeedle + 0.7);
    const ang = Math.PI * 1.06 + (Math.PI * 0.86) * back(u, 2.2) + (u >= 1 ? Math.sin(t * 40) * 0.008 : 0);
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(ang) * 185, cy + Math.sin(ang) * 185);
    c.stroke();
    c.fillStyle = COL.ink;
    c.beginPath();
    c.arc(cx, cy, 22, 0, 6.28);
    c.fill();
    popIn(c, t, tHeart, () => {
      c.save();
      c.translate(190, -120);
      c.fillStyle = COL.red;
      c.beginPath();
      c.moveTo(0, 40);
      c.bezierCurveTo(-90, -20, -50, -85, 0, -40);
      c.bezierCurveTo(50, -85, 90, -20, 0, 40);
      c.fill();
      c.restore();
    }, 1.6);
  },
});

const tQuote = cue("pop", 174.0, 0.3);
const tSlap = hit(177.9, 0.5);
const tHide = mk(178.5, 0.35);
const tPay = mk(179.6, 0.35);
obj({
  id: "keynote",
  x: 3400,
  y: 3550,
  w: 980,
  h: 560,
  r: -0.025,
  t0: 172.25,
  layer: 1,
  draw(c, t) {
    paper(c, 980, 560, { fill: "#f4f2ee", radius: 4 });
    c.fillStyle = "#121417";
    c.fillRect(-466, -256, 932, 512);
    c.fillStyle = "#76b900";
    c.fillRect(-466, 236, 932, 20);
    const u = sm(p(t, tQuote, tQuote + 0.35));
    text(c, "“THE MORE YOU BUY,", -410, -140, { size: 70, weight: 800, color: "#ffffff", alpha: u, align: "left" });
    text(c, "THE MORE YOU SAVE”", -410, -50, { size: 70, weight: 800, color: "#ffffff", alpha: u, align: "left" });
    if (t > tSlap - 0.12) {
      c.save();
      c.translate(270, 165);
      c.rotate(0.06);
      const k = p(t, tSlap - 0.12, tSlap);
      const s = lerp(1.6, 1, eout(k));
      c.scale(s, s);
      c.globalAlpha *= k;
      sticky(c, 400, 300);
      marker(c, "HIDE", 0, -50, t, tHide, 0.35, { size: 110, color: COL.ink });
      marker(c, "→ PAY", 0, 70, t, tPay, 0.35, { size: 110, color: COL.red });
      c.restore();
    }
  },
});

const tBars = cue("pop", 183.8, 0.4);
const tCtrl = mk(185.9, 0.45);
obj({
  id: "control",
  x: 4300,
  y: 3550,
  w: 780,
  h: 580,
  r: 0.045,
  t0: 180.15,
  layer: 1,
  draw(c, t) {
    paper(c, 780, 580, { fill: COL.paperWhite });
    text(c, "DECISION QUALITY", 0, -235, { size: 42, weight: 800, color: COL.inkSoft, track: 4 });
    c.strokeStyle = COL.ink;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-330, 140);
    c.lineTo(330, 140);
    c.stroke();
    const u = eout(p(t, tBars, tBars + 0.6));
    c.fillStyle = COL.green;
    c.fillRect(-250, 140 - 300 * u, 170, 300 * u);
    c.fillStyle = "#9b9488";
    c.fillRect(80, 140 - 70 * u, 170, 70 * u);
    text(c, "WITH AI", -165, 195, { size: 44, weight: 700 });
    marker(c, "CONTROL GROUP", 165, 200, t, tCtrl, 0.45, { size: 52 });
  },
});

// ---------- why it matters ----------
const tSlice = cue("pop", 198.5, 0.5);
obj({
  id: "pie",
  x: 5150,
  y: 2000,
  w: 720,
  h: 720,
  r: -0.04,
  t0: 195.9,
  layer: 1,
  draw(c, t) {
    paper(c, 720, 720, { fill: COL.paperWhite });
    text(c, "INDEX WEIGHT", 0, -300, { size: 40, weight: 800, color: COL.inkSoft, track: 5 });
    const cx = 0;
    const cy = 40;
    const R = 230;
    const a0 = -Math.PI / 2;
    const a1 = a0 + Math.PI * 2 * 0.09;
    const shades = ["#d8d2c6", "#cbc4b6", "#bfb7a8", "#d2cbbe", "#c4bcae"];
    let a = a1;
    const rest = (Math.PI * 2 - (a1 - a0)) / shades.length;
    shades.forEach((s) => {
      c.fillStyle = s;
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, R, a, a + rest);
      c.closePath();
      c.fill();
      c.strokeStyle = COL.paperWhite;
      c.lineWidth = 4;
      c.stroke();
      a += rest;
    });
    const u = eout(p(t, tSlice, tSlice + 0.5));
    const mid = (a0 + a1) / 2;
    c.save();
    c.translate(Math.cos(mid) * 60 * u, Math.sin(mid) * 60 * u);
    c.fillStyle = "#76b900";
    c.beginPath();
    c.moveTo(cx, cy);
    c.arc(cx, cy, R * (1 + 0.06 * u), a0, a1);
    c.closePath();
    c.fill();
    c.restore();
    logo(c, "nvidia", 225, -120, 44, sm(u));
  },
});

const tSneeze = cue("hit", 201.5, 0.3);
const tCold = 203.3;
obj({
  id: "envelope",
  x: 5800,
  y: 2450,
  w: 720,
  h: 400,
  r: 0.05,
  t0: 200.6,
  layer: 1,
  move: (t) => {
    const k = t > tSneeze ? Math.exp(-(t - tSneeze) * 7) : 0;
    return { x: 5800 + Math.sin((t - tSneeze) * 55) * 14 * k, y: 2450, r: 0.05 + Math.sin((t - tSneeze) * 40) * 0.02 * k };
  },
  draw(c, t) {
    paper(c, 720, 400, { fill: "#f1ebdc" });
    c.strokeStyle = "rgba(60,50,35,0.25)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-360, -200);
    c.lineTo(0, 30);
    c.lineTo(360, -200);
    c.stroke();
    text(c, "RETIREMENT FUND", -320, -140, { size: 46, weight: 800, align: "left" });
    c.fillStyle = "rgba(255,255,255,0.7)";
    rr(c, -40, 40, 330, 120, 8);
    c.fill();
    greyLines(c, -20, 60, 290, 3, 30, 151, 12);
    // thermometer: it caught a cold
    const u = eout(p(t, tCold, tCold + 0.8));
    if (t > tCold - 0.1) {
      c.save();
      c.translate(-230, 70);
      c.rotate(-0.25);
      c.globalAlpha *= clamp((t - tCold + 0.1) * 5);
      c.fillStyle = "#fff";
      c.strokeStyle = COL.ink;
      c.lineWidth = 6;
      rr(c, -22, -120, 44, 200, 22);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(0, 95, 36, 0, 6.28);
      c.fill();
      c.stroke();
      c.fillStyle = COL.red;
      c.beginPath();
      c.arc(0, 95, 26, 0, 6.28);
      c.fill();
      c.fillRect(-10, 80 - 180 * u, 20, 180 * u);
      c.restore();
    }
  },
});

// =====================================================================================
// NOV 19: IPO ZONE
// =====================================================================================
const tRing = cue("bell", 17.45, 1);
obj({
  id: "bell",
  x: 6300,
  y: 650,
  w: 400,
  h: 420,
  r: 0,
  t0: 13.1,
  layer: 2,
  lit: () => [-220, -230, 440, 460],
  draw(c, t) {
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath();
    c.ellipse(30, 190, 190, 40, 0, 0, 6.28);
    c.fill();
    const e = t - tRing;
    const sw = e > -0.15 ? (e < 0 ? -0.18 * p(t, tRing - 0.15, tRing) : 0.32 * Math.exp(-e * 1.6) * Math.sin(e * 15)) : 0;
    c.save();
    c.translate(0, -170);
    c.rotate(sw);
    c.translate(0, 170);
    const g = c.createLinearGradient(-170, 0, 170, 0);
    g.addColorStop(0, "#7a5a1c");
    g.addColorStop(0.35, "#f1cf6b");
    g.addColorStop(0.6, "#c99a32");
    g.addColorStop(1, "#5d4212");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-60, -120);
    c.bezierCurveTo(-70, -10, -110, 90, -175, 150);
    c.lineTo(175, 150);
    c.bezierCurveTo(110, 90, 70, -10, 60, -120);
    c.bezierCurveTo(40, -165, -40, -165, -60, -120);
    c.fill();
    c.fillStyle = "#4a3410";
    c.beginPath();
    c.ellipse(0, 150, 175, 26, 0, 0, 6.28);
    c.fill();
    c.fillStyle = "#6b4a22";
    rr(c, -18, -230, 36, 90, 14);
    c.fill();
    c.fillStyle = "#3a2410";
    c.beginPath();
    c.arc(0, -238, 34, 0, 6.28);
    c.fill();
    c.restore();
    // sound rings
    for (let k = 0; k < 3; k++) {
      const e2 = t - tRing - k * 0.18;
      if (e2 < 0 || e2 > 1.4) continue;
      c.strokeStyle = `rgba(242,207,107,${0.7 * (1 - e2 / 1.4)})`;
      c.lineWidth = 8;
      c.beginPath();
      c.arc(0, 0, 220 + e2 * 260, -Math.PI * 0.9, -Math.PI * 0.1);
      c.stroke();
    }
  },
});

const tFiled = hit(218.1, 0.9);
obj({
  id: "prospectus",
  x: 5750,
  y: 1000,
  w: 820,
  h: 1060,
  r: -0.035,
  t0: 13.4,
  layer: 1,
  draw(c, t) {
    paper(c, 820, 1060, { fill: COL.paperWhite });
    text(c, "FORM S-1", 0, -465, { size: 40, weight: 700, track: 8, color: COL.inkSoft });
    logo(c, "anthropic", 0, -380, 50);
    c.fillStyle = "rgba(28,26,23,0.75)";
    rr(c, -330, -300, 660, 30, 6);
    c.fill();
    rr(c, -330, -250, 420, 30, 6);
    c.fill();
    greyLines(c, -330, -170, 660, 12, 48, 171);
    stamp(c, "FILED", 120, 300, 150, -0.15, t, tFiled);
  },
});

const tTag = mk(50.6, 0.35);
const tFlip = cue("flip", 232.7, 0.5);
const tEarly = mk(234.3, 0.5);
const tStrike = mk(237.6, 0.25);
const tNow = mk(237.9, 0.45);
const tShare = ty(240.9, 14, 30);
const tBubble = cue("pop", 345.6, 0.4);
obj({
  id: "tag",
  x: 4980,
  y: 1300,
  w: 620,
  h: 400,
  r: -0.2,
  t0: 47.45,
  layer: 0.9,
  lit: () => [-330, -220, 660, 440],
  draw(c, t) {
    // string up to the prospectus corner
    const corner = { x: 5380 - 4980, y: 960 - 1300 };
    const cr = Math.cos(0.2);
    const sr = Math.sin(0.2);
    const lx = corner.x * cr - corner.y * sr;
    const ly = corner.x * sr + corner.y * cr;
    c.strokeStyle = "#eae0c8";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(-250, 0);
    c.quadraticCurveTo(-150, ly * 0.2, lx, ly);
    c.stroke();
    const flip = eio(p(t, tFlip, tFlip + 0.5));
    const k = Math.cos(Math.PI * flip);
    c.save();
    c.scale(Math.abs(k) < 0.02 ? 0.02 : k, 1);
    c.save();
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = 22 * G.z;
    c.shadowOffsetY = 12 * G.z;
    c.fillStyle = "#d9bd84";
    c.beginPath();
    c.moveTo(-310, -60);
    c.lineTo(-230, -200);
    c.lineTo(310, -200);
    c.lineTo(310, 200);
    c.lineTo(-230, 200);
    c.lineTo(-310, 60);
    c.closePath();
    c.fill();
    c.restore();
    c.fillStyle = "#1b120a";
    c.beginPath();
    c.arc(-250, 0, 18, 0, 6.28);
    c.fill();
    c.restore();
    // writing (drawn unflipped so it reads correctly on each side)
    c.save();
    c.scale(Math.abs(k), 1);
    if (k > 0) {
      marker(c, "$1T", 40, 10, t, tTag, 0.35, { size: 170, color: COL.ink });
    } else {
      marker(c, "$1.5–2T", 40, -105, t, tEarly, 0.5, { size: 100, color: COL.ink });
      strokeReveal(c, [[-140, -100], [230, -110]], draw(t, tStrike, 0.25), COL.red, 12);
      marker(c, "$1.4T", 40, 35, t, tNow, 0.45, { size: 140, color: COL.red });
      typed(c, "$70–78 / SHARE", 40, 150, t, tShare, { fam: F.mono, size: 42, weight: 700 }, 30);
    }
    c.restore();
    // soap bubble (Ch 8): does the bubble have more air in it?
    if (t > tBubble) {
      const u = eout(p(t, tBubble, tBubble + 1.2));
      const R = lerp(240, 470, u) + Math.sin(t * 3) * 6;
      c.save();
      c.rotate(0.2);
      c.strokeStyle = "rgba(170,225,255,0.95)";
      c.lineWidth = 12;
      c.beginPath();
      c.arc(30, 0, R, 0, 6.28);
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = 12;
      c.beginPath();
      c.arc(30, 0, R * 0.82, -2.6, -1.9);
      c.stroke();
      c.restore();
    }
  },
});

const tAnt = [ty(225.2, 1), ty(225.3, 1), ty(225.4, 1)];
obj({
  id: "ticker",
  x: 6550,
  y: 1350,
  w: 640,
  h: 400,
  r: 0.07,
  t0: 224.3,
  layer: 1,
  draw(c, t) {
    indexCard(c, 640, 400);
    logo(c, "nasdaq", 0, -125, 56);
    const letters = ["A", "N", "T"];
    letters.forEach((L, i) => popIn(c, t, tAnt[i], () => text(c, L, -170 + i * 170, 60, { fam: F.hero, size: 240 })));
  },
});

const tSlide0 = cue("slide", 243.3, 0.6);
const tSlide1 = 245.3;
const t26 = mk(247.1, 0.4);
obj({
  id: "cheque",
  x: 5900,
  y: 1900,
  w: 880,
  h: 400,
  r: -0.04,
  t0: 243.0,
  layer: 0.95,
  move: (t) => {
    const u = eio(p(t, tSlide0, tSlide1));
    return { x: lerp(4850, 5900, u), y: lerp(780, 1900, u), r: lerp(0.08, -0.04, u) };
  },
  draw(c, t) {
    paper(c, 880, 400, { fill: "#e1e9d8", lift: Math.sin(Math.PI * p(t, tSlide0, tSlide1)) * 0.6 });
    c.strokeStyle = "rgba(60,110,70,0.18)";
    c.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      c.beginPath();
      for (let x = -430; x <= 430; x += 10) {
        const y = -180 + k * 26 + Math.sin(x * 0.03 + k) * 8;
        if (x === -430) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    logo(c, "nvidia", -230, -130, 50);
    text(c, "PAY TO", -390, -15, { size: 30, weight: 700, align: "left", color: COL.inkSoft, track: 4 });
    logo(c, "anthropic", -90, -15, 30);
    c.strokeStyle = COL.ink;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-270, 15);
    c.lineTo(110, 15);
    c.stroke();
    c.lineWidth = 5;
    c.strokeRect(150, -70, 260, 150);
    marker(c, "$26B", 280, 8, t, t26, 0.4, { size: 100, color: COL.ink });
    greyLines(c, -390, 120, 420, 1, 30, 181, 10);
  },
});

const tCancel = hit(254.2, 1);
obj({
  id: "badge",
  x: 6600,
  y: 2100,
  w: 460,
  h: 640,
  r: 0.1,
  t0: 249.65,
  layer: 1,
  draw(c, t) {
    paper(c, 460, 640, { fill: "#fbfaf6", radius: 18 });
    c.fillStyle = "#c9c4b8";
    rr(c, -60, -300, 120, 30, 12);
    c.fill();
    c.fillStyle = "#1f1f1e";
    c.fillRect(-230, -250, 460, 150);
    text(c, "CEO FORUM", 0, -175, { size: 60, weight: 800, color: "#ffffff" });
    logo(c, "anthropic", 0, -45, 30);
    text(c, "SPEAKER", 0, 40, { size: 50, weight: 800, track: 8 });
    greyLines(c, -150, 210, 300, 2, 40, 191, 16);
    stamp(c, "CANCELLED", 0, 175, 84, -0.32, t, tCancel);
  },
});

// a red marker line: the company in crisis is tied to the company going public
const tTie = mk(258.0, 0.7);
obj({
  id: "tieLine",
  x: 5300,
  y: 600,
  w: 1300,
  h: 500,
  r: 0,
  t0: -1,
  layer: 3,
  noDrop: true,
  draw(c, t) {
    if (t < tTie) return;
    c.save();
    c.translate(-5300, -600);
    const pts = arcPts(4850, 690, 5750, 600, -0.22);
    strokeReveal(c, pts, draw(t, tTie, 0.7), COL.red, 14);
    if (t > tTie + 0.7) {
      const a = pts[pts.length - 1];
      const b = pts[pts.length - 4];
      const s = pts[0];
      const s2 = pts[3];
      c.restore();
      c.save();
      c.translate(-5300, -600);
      const k = clamp((t - tTie - 0.7) * 6);
      c.globalAlpha *= k;
      // both ends: arrowheads
      const ah = (x: number, y: number, ang: number) => {
        c.strokeStyle = COL.red;
        c.lineWidth = 14;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x + Math.cos(ang + 2.6) * 44, y + Math.sin(ang + 2.6) * 44);
        c.lineTo(x, y);
        c.lineTo(x + Math.cos(ang - 2.6) * 44, y + Math.sin(ang - 2.6) * 44);
        c.stroke();
      };
      ah(a[0], a[1], Math.atan2(a[1] - b[1], a[0] - b[0]));
      ah(s[0], s[1], Math.atan2(s[1] - s2[1], s[0] - s2[0]));
    }
    c.restore();
  },
});

// =====================================================================================
// DETECTIVE NOTEPAD
// =====================================================================================
const NP = { x: 6800, y: -700 };
const tPillars = mk(289.3, 1.0);
const tPol = mk(290.6, 0.4);
const tTrust = mk(292.5, 0.4);
const tApp = mk(295.6, 0.45);
const tCr1 = cue("crack", 298.9, 0.7);
const tCr2 = cue("crack", 301.1, 0.7);
const tQ3 = mk(304.8, 0.4);
const tNodeN = cue("pop", 310.9, 0.4);
const tArr1 = mk(311.2, 0.6);
const tNodeL = cue("pop", 312.3, 0.4);
const tArr2 = mk(313.7, 0.6);
const tSales = mk(315.3, 0.4);
const tInv = mk(317.3, 0.6);
const tWobble = cue("wobble", 320.9, 0.6);
const NAVY = "#1d2b4f";
obj({
  id: "notepad",
  x: NP.x,
  y: NP.y,
  w: 2000,
  h: 1300,
  r: 0.015,
  t0: -1,
  layer: 1,
  draw(c, t) {
    paper(c, 2000, 1300, { fill: "#f3e389", radius: 4 });
    c.fillStyle = "#7b2a24";
    c.fillRect(-1000, -650, 2000, 90);
    c.strokeStyle = "rgba(60,110,170,0.35)";
    c.lineWidth = 2.5;
    for (let y = -480; y < 640; y += 72) {
      c.beginPath();
      c.moveTo(-1000, y);
      c.lineTo(1000, y);
      c.stroke();
    }
    c.strokeStyle = "rgba(200,60,60,0.45)";
    c.lineWidth = 3;
    for (const x of [-905, -893]) {
      c.beginPath();
      c.moveTo(x, -560);
      c.lineTo(x, 650);
      c.stroke();
    }
    // ---- three pillars
    const pu = p(t, tPillars, tPillars + 1.0);
    if (pu > 0) {
      const S = (pts: [number, number][], a: number, b: number) => strokeReveal(c, pts, clamp((pu - a) / (b - a)), NAVY, 10);
      S([[-970, -250], [-525, -430], [-80, -250], [-970, -250]], 0, 0.3);
      [-820, -525, -230].forEach((x, i) => {
        const a = 0.25 + i * 0.18;
        S([[x - 75, -220], [x + 75, -220], [x + 75, -190], [x - 75, -190], [x - 75, -220]], a, a + 0.06);
        S([[x - 42, -190], [x - 42, 270]], a + 0.04, a + 0.12);
        S([[x + 42, -190], [x + 42, 270]], a + 0.06, a + 0.14);
        S([[x - 75, 270], [x + 75, 270], [x + 75, 300], [x - 75, 300], [x - 75, 270]], a + 0.12, a + 0.18);
      });
      S([[-990, 320], [-60, 320]], 0.88, 1);
    }
    marker(c, "POLICY", -820, 400, t, tPol, 0.4, { size: 58, color: NAVY });
    marker(c, "TRUST", -525, 400, t, tTrust, 0.4, { size: 58, color: NAVY });
    marker(c, "APPETITE", -215, 400, t, tApp, 0.45, { size: 58, color: NAVY });
    const crack = (x: number, t0: number) =>
      strokeReveal(c, [[x - 70, -200], [x + 10, -110], [x - 30, -20], [x + 40, 70], [x - 10, 160], [x + 60, 260]], eout(p(t, t0, t0 + 0.25)), COL.red, 13);
    crack(-820, tCr1);
    crack(-525, tCr2);
    marker(c, "?", -230, 40, t, tQ3, 0.3, { size: 220 });
    // ---- the money loop
    const wob = t > tWobble ? Math.exp(-(t - tWobble) * 1.6) * Math.sin((t - tWobble) * 9) : 0;
    c.save();
    c.translate(550, 0);
    c.rotate(wob * 0.06);
    c.scale(1 + wob * 0.03, 1 - wob * 0.03);
    c.translate(-550 - 60, 0);
    const node = (x: number, y: number, w: number, h: number, t0: number, fill: () => void) => {
      const u = eout(p(t, t0, t0 + 0.35));
      if (u <= 0) return;
      c.save();
      c.globalAlpha *= u;
      c.strokeStyle = NAVY;
      c.lineWidth = 9;
      rr(c, x - w / 2, y - h / 2, w, h, 26);
      c.stroke();
      fill();
      c.restore();
    };
    node(220, -120, 330, 150, tNodeN, () => logo(c, "nvidia", 220, -120, 50));
    node(880, -120, 310, 150, tNodeL, () => marker(c, "AI LABS", 880, -115, t, tNodeL, 0.3, { size: 64, color: NAVY }));
    arrow(c, arcPts(400, -175, 715, -175, -0.42), t, tArr1, 0.6, COL.red, 12, 38);
    marker(c, "$", 557, -335, t, tArr1 + 0.3, 0.2, { size: 90 });
    arrow(c, arcPts(715, -60, 400, -60, -0.42), t, tArr2, 0.6, COL.red, 12, 38);
    marker(c, "CHIPS", 557, 115, t, tArr2 + 0.3, 0.3, { size: 58 });
    marker(c, "SALES ↑", 220, -250, t, tSales, 0.4, { size: 56, color: COL.green });
    node(550, 380, 420, 130, tInv, () => marker(c, "INVESTORS", 550, 385, t, tInv, 0.35, { size: 60, color: NAVY }));
    arrow(c, [[440, 312], [260, -30]], t, tInv + 0.3, 0.3, NAVY, 9, 30);
    arrow(c, [[660, 312], [840, -30]], t, tInv + 0.45, 0.3, NAVY, 9, 30);
    c.restore();
  },
});

// =====================================================================================
// CH 8 + EPILOGUE
// =====================================================================================
const tCreated = mk(327.3, 0.45);
const tPerm = mk(329.7, 0.5);
obj({
  id: "sticky5",
  x: 2680,
  y: 1520,
  w: 560,
  h: 520,
  r: 0.06,
  t0: 326.95,
  layer: 2,
  draw(c, t) {
    sticky(c, 560, 520);
    marker(c, "CREATED IT?", 0, -110, t, tCreated, 0.45, { size: 66, color: COL.ink });
    marker(c, "OR", 0, 0, t, tPerm - 0.25, 0.15, { size: 50, color: COL.inkSoft });
    marker(c, "PERMISSION?", 0, 110, t, tPerm, 0.5, { size: 64, color: COL.red });
  },
});

// pressure lines: the three files converge on the AI story
const tConv = [mk(354.6, 0.45), mk(354.85, 0.45), mk(355.1, 0.45)];
obj({
  id: "converge",
  x: 3600,
  y: 0,
  w: 5200,
  h: 1200,
  r: 0,
  t0: -1,
  layer: 9,
  noDrop: true,
  lit: () => [-2400, -700, 4800, 1400],
  draw(c, t) {
    if (t < tConv[0] || t > 359.6) return;
    c.save();
    c.globalAlpha *= 1 - sm(p(t, 358.6, 359.6));
    c.translate(-3600, 0);
    const target: [number, number] = [5100, -300];
    const from: [number, number][] = [
      [1300, 460],
      [3600, 470],
      [5600, 440],
    ];
    from.forEach((f, i) => {
      const pts = arcPts(f[0], f[1], target[0] + (i - 1) * 60, target[1], i === 0 ? 0.12 : i === 1 ? 0.05 : -0.1);
      arrow(c, pts, t, tConv[i], 0.45, COL.red, 16, 50);
    });
    c.restore();
  },
});

const tCoin = mk(374.8, 0.5);
const tPat = mk(375.5, 0.45);
const tComment = cue("pop", 376.9, 0.5);
obj({
  id: "finalcard",
  x: 5750,
  y: 560,
  w: 1350,
  h: 440,
  r: -0.05,
  t0: 374.55,
  layer: 3,
  draw(c, t) {
    indexCard(c, 1350, 440);
    marker(c, "COINCIDENCE", -90, -55, t, tCoin, 0.5, { size: 124, color: COL.ink });
    marker(c, "OR PATTERN?", -90, 95, t, tPat, 0.45, { size: 124, color: COL.red });
    popIn(c, t, tComment, () => {
      c.save();
      c.translate(520, 10);
      c.fillStyle = COL.ink;
      rr(c, -95, -80, 190, 130, 30);
      c.fill();
      c.beginPath();
      c.moveTo(-40, 45);
      c.lineTo(-70, 100);
      c.lineTo(10, 45);
      c.fill();
      c.fillStyle = COL.card;
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        c.arc(k * 45, -15, 13, 0, 6.28);
        c.fill();
      }
      c.restore();
    }, 1.5);
  },
});

// magnifier path (Ch 7): a world object drawn by DeskCut with a real magnified lens
const MAGK: [number, number, number][] = [
  [264.4, 6600, 160],
  [266.2, 4600, 120],
  [269.7, 1400, 20],
  [271.9, 3600, 20],
  [274.3, 2500, 420],
  [279.7, 5100, -630],
  [285.6, 5150, -620],
  [287.2, 5900, -1500],
];
export function magnifier(t: number) {
  if (t < MAGK[0][0] - 0.4 || t > MAGK[MAGK.length - 1][0]) return null;
  const a = clamp((t - (MAGK[0][0] - 0.4)) / 0.6) * (1 - clamp((t - 286.6) / 0.6));
  let i = 0;
  while (i < MAGK.length - 2 && MAGK[i + 1][0] <= t) i++;
  const k0 = MAGK[i];
  const k1 = MAGK[i + 1];
  const u = eio(p(t, k0[0], k1[0]));
  return { x: lerp(k0[1], k1[1], u), y: lerp(k0[2], k1[2], u), a, R: 270, mag: 1.55 };
}
cue("slide", 264.2, 0.5);

// =====================================================================================
// CAMERA + HERO BEATS
// =====================================================================================
type Beat = [number, number, number, number, string[], { arr?: number; lead?: number }?];
export const BEATS: Beat[] = [
  [0.0, 1050, 820, 1.38, ["print25"], { arr: -0.5 }],
  [3.0, 3920, 880, 1.28, ["dossier"]],
  [8.9, 3960, 880, 1.55, ["dossier"], { arr: 0.6 }],
  [13.7, 5980, 820, 1.22, ["prospectus", "bell"]],
  [19.1, 3700, 560, 0.35, ["*"]],
  [21.4, 1900, -560, 1.3, ["qnote"]],
  [27.7, 2900, -640, 1.08, ["title"], { lead: 0.6 }],
  [30.9, 4050, -470, 1.4, ["nmp"]],
  [37.1, 5100, -650, 1.2, ["aicard"]],
  [42.9, 1900, 1420, 1.2, ["chartN"], { lead: 0.3, arr: 1.0 }],
  [45.6, 4850, 760, 1.45, ["cert"], { lead: 0.6, arr: 0.6 }],
  [47.7, 4980, 1300, 1.55, ["tag"]],
  [52.1, 5100, -650, 1.15, ["aicard"], { lead: 0.5, arr: 0.55 }],
  [58.9, 1400, 110, 1.05, ["strip"], { lead: 1.1, arr: 0.6 }],
  [60.6, 1900, 1420, 1.2, ["chartN"]],
  [65.4, 1050, 820, 1.38, ["print25"]],
  [70.2, 1560, 2010, 0.86, ["cardA", "cardB", "cardC"]],
  [73.8, 320, 1200, 1.35, ["ballot"]],
  [77.0, 300, 1790, 1.4, ["receipt"]],
  [85.2, 1250, 2450, 1.08, ["conveyor"]],
  [94.0, 1250, 2440, 0.98, ["conveyor"]],
  [97.9, 1050, 820, 1.3, ["print25"], { lead: 0.3, arr: 1.0 }],
  [101.5, 1400, 110, 1.1, ["strip"]],
  [107.5, 3600, 110, 1.0, ["strip"], { lead: 0.8, arr: 0.6 }],
  [109.6, 3820, 700, 1.22, ["dossier"]],
  [115.6, 2800, 1650, 1.3, ["tabloid"]],
  [117.8, 3550, 1650, 1.5, ["mega"]],
  [123.0, 3960, 880, 1.55, ["dossier"]],
  [126.6, 4350, 1650, 1.45, ["map"]],
  [131.7, 3060, 2100, 1.05, ["memo1", "memo2", "memo3"]],
  [137.8, 4400, 2150, 1.4, ["nvda"]],
  [141.9, 4950, 2850, 1.5, ["mic"]],
  [147.5, 4150, 2800, 1.4, ["chip"]],
  [150.9, 3300, 2800, 1.4, ["bgcheck"]],
  [153.3, 2450, 2800, 1.2, ["checklist"]],
  [162.9, 3550, 1650, 1.5, ["mega"]],
  [167.3, 2500, 3550, 1.55, ["speedo"]],
  [172.4, 3400, 3550, 1.25, ["keynote"]],
  [180.4, 4300, 3550, 1.4, ["control"]],
  [187.0, 3760, 860, 1.05, ["dossier"]],
  [192.2, 4300, 1500, 0.55, ["*"]],
  [196.2, 5150, 2000, 1.4, ["pie"]],
  [200.9, 5800, 2450, 1.5, ["envelope"]],
  [204.3, 3920, 860, 1.3, ["dossier"]],
  [209.0, 2500, 240, 0.64, ["strip", "arcBack"]],
  [213.1, 5750, 1000, 1.05, ["prospectus"]],
  [220.1, 5800, 110, 1.1, ["strip"]],
  [224.4, 6550, 1350, 1.5, ["ticker"]],
  [226.1, 720, 90, 0.95, ["flag", "strip"], { lead: 0.5, arr: 1.2 }],
  [228.3, 2000, 160, 0.45, ["flag", "strip"]],
  [230.9, 4980, 1300, 1.55, ["tag"]],
  [242.8, 5380, 1340, 1.0, ["cheque", "cert"]],
  [245.6, 5900, 1900, 1.4, ["cheque"]],
  [249.8, 6600, 2100, 1.5, ["badge"]],
  [256.0, 5300, 850, 0.85, ["cert", "prospectus", "tieLine"]],
  [263.8, 5000, 160, 0.8, ["strip"]],
  [267.4, 2500, 120, 0.64, ["strip"]],
  [273.8, 2500, 330, 1.0, ["arcBack", "strip"]],
  [279.1, 5100, -650, 1.2, ["aicard"]],
  [286.5, 6275, -640, 1.15, ["notepad"]],
  [308.1, 7290, -680, 1.18, ["notepad"]],
  [324.4, 4500, 700, 0.42, ["*"]],
  [326.4, 2400, 1700, 1.0, ["sticky5", "cardC"]],
  [332.2, 3980, 880, 1.25, ["dossier"]],
  [339.9, 4980, 1300, 1.1, ["tag"]],
  [348.5, 3600, 800, 0.36, ["*"]],
  [354.3, 3500, -100, 0.42, ["converge", "aicard", "dossier", "prospectus", "print25", "chartN", "cardC", "tag", "cert"]],
  [358.7, 3300, 2800, 1.4, ["bgcheck"]],
  [364.9, 5100, -650, 1.2, ["aicard"]],
  [372.4, 5800, 330, 1.0, ["strip", "finalcard"]],
  [381.1, 3600, 900, 0.3, ["*"], { arr: 1.8 }],
];

export const HOLDS: Hold[] = BEATS.map((b, i) => {
  const next = BEATS[i + 1];
  const prev = BEATS[i - 1];
  const far = (a?: Beat, bb?: Beat) => (a && bb ? Math.hypot(a[1] - bb[1], a[2] - bb[2]) * Math.min(a[3], bb[3]) > 1300 : false);
  const arr = b[5]?.arr ?? (far(prev, b) ? 0.85 : 0.5);
  const lead = next ? next[5]?.lead ?? (far(b, next) ? 0.85 : 0.5) : 0;
  const ta = b[0] + arr;
  let td = next ? next[0] - lead : DURATION + 1;
  if (td < ta + 0.25) td = ta + 0.25;
  return { ta, td, x: b[1], y: b[2], z: b[3] };
});
export const camera = buildCamera(HOLDS);

// whooshes on the long travels
HOLDS.forEach((h, i) => {
  const n = HOLDS[i + 1];
  if (!n) return;
  const d = Math.hypot(n.x - h.x, n.y - h.y) * Math.min(h.z, n.z);
  if (d > 900) cue("whoosh", (h.td + n.ta) / 2 - 0.35, clamp(d / 3000, 0.25, 1));
});

// how much each object is lit (1 = hero) at time t
export function litWeight(id: string, t: number) {
  let w = 0;
  for (let i = 0; i < BEATS.length; i++) {
    const a = BEATS[i][0];
    const b = BEATS[i + 1]?.[0] ?? DURATION + 5;
    if (t < a - 0.4 || t > b + 0.4) continue;
    const ids = BEATS[i][4];
    if (!ids.includes(id) && !ids.includes("*")) continue;
    w += sm(p(t, a - 0.3, a + 0.3)) * (1 - sm(p(t, b - 0.3, b + 0.3)));
  }
  return clamp(w);
}
export const wideWeight = (t: number) => litWeight("__wide__", t); // "*" beats only

// =====================================================================================
// WORLD DRAW
// =====================================================================================
const SORTED = [...O].sort((a, b) => (a.layer ?? 1) - (b.layer ?? 1) || a.t0 - b.t0);
export type Quad = { pts: [number, number][]; w: number };

export function drawWorld(c: C, t: number, view: { x0: number; y0: number; x1: number; y1: number }, quads?: Quad[]) {
  desk(c, view.x0 - 50, view.y0 - 50, view.x1 + 50, view.y1 + 50);
  for (const o of SORTED) {
    if (o.t0 > 0 && t < o.t0 - 0.45) continue;
    let pos = o.move ? o.move(t) : { x: o.x, y: o.y, r: o.r };
    let alpha = 1;
    if (o.exit !== undefined && t > o.exit) {
      const e = eio(p(t, o.exit, o.exit + 0.8));
      if (e >= 1) continue;
      pos = { x: pos.x + (o.exitTo?.[0] ?? 0) * e, y: pos.y + (o.exitTo?.[1] ?? 0) * e, r: pos.r - 0.2 * e };
      alpha = 1 - e;
    }
    const rad = Math.hypot(o.w, o.h) * 0.75 + 200;
    if (pos.x + rad < view.x0 || pos.x - rad > view.x1 || pos.y + rad < view.y0 || pos.y - rad > view.y1) continue;
    const u = o.t0 > 0 && !o.noDrop ? p(t, o.t0 - 0.45, o.t0) : 1;
    const eu = eout(u);
    c.save();
    c.translate(pos.x, pos.y - (1 - eu) * 40);
    c.rotate(pos.r + (1 - eu) * 0.06);
    const s = lerp(1.16, 1, eu);
    c.scale(s, s);
    c.globalAlpha = alpha * (o.noDrop ? 1 : sm(p(t, o.t0 - 0.45, o.t0 - 0.22)) || (o.t0 <= 0 ? 1 : 0));
    if (o.t0 <= 0) c.globalAlpha = alpha;
    o.draw(c, t);
    if (quads) {
      const lw = litWeight(o.id, t);
      if (lw > 0.01) {
        const [rx, ry, rw, rh] = o.lit ? o.lit(t) : [-o.w / 2, -o.h / 2, o.w, o.h];
        const m = c.getTransform();
        const pad = 30;
        const corners: [number, number][] = [
          [rx - pad, ry - pad],
          [rx + rw + pad, ry - pad],
          [rx + rw + pad, ry + rh + pad],
          [rx - pad, ry + rh + pad],
        ];
        quads.push({ pts: corners.map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]), w: lw * alpha });
      }
    }
    c.restore();
  }
}

export { W, H };

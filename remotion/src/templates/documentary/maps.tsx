// Documentary template — handmade atlas maps.
// A faint printed atlas (sea wash, graticule, pale neighbours) with the story's country as a
// kraft-paper cut-out stuck on top (white sticker edge, wobbly scissor line, soft shadow), plus
// red-pen marks for places. Data: library/maps/world/countries.geojson (Natural Earth, with
// India's official outline — see tools/make_world_map.py).
import { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { prog, useGeo, useLayout } from "./parts";
import { DOC } from "./theme";

const WORLD = "library/maps/world/countries.geojson";

type Ring = number[][];
type Feature = { properties: { iso: string; name: string }; geometry: { type: string; coordinates: Ring[] | Ring[][] } };

export type MapMark = { lon: number; lat: number; label: string; labelSide?: "left" | "right" | "top" | "bottom" };

/** Polygons of a feature, as lists of rings. */
const polysOf = (f: Feature): Ring[][] => (f.geometry.type === "Polygon" ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][]));

const bboxOf = (f: Feature) => {
  let a = 180, b = 90, c = -180, d = -90;
  for (const poly of polysOf(f)) for (const [x, y] of poly[0]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
};

/** A hand-drawn loop around a point: an ellipse with a little jitter that overshoots its start. */
const penLoop = (cx: number, cy: number, rx: number, ry: number) => {
  const pts: string[] = [];
  const n = 48;
  for (let i = 0; i <= n * 1.12; i++) {
    const t = (i / n) * Math.PI * 2 - 2.2;
    const j = 1 + 0.06 * Math.sin(i * 1.7) + 0.03 * Math.cos(i * 3.1);
    const drift = 1 + (i / n) * 0.08; // the loop doesn't quite close on itself
    pts.push(`${(cx + Math.cos(t) * rx * j * drift).toFixed(1)},${(cy + Math.sin(t) * ry * j * drift).toFixed(1)}`);
  }
  return "M" + pts.join("L");
};

/**
 * Atlas map with one cut-out country.
 * view: [minLon, minLat, maxLon, maxLat] the area shown; focus: ISO-3 code of the cut-out country.
 */
/**
 * region (full-bleed maps): the box, as fractions of w/h, that `view` is fitted into; the atlas
 * still fills the whole frame around it and there is no faded edge.
 */
export const AtlasMap: React.FC<{ view: [number, number, number, number]; focus: string | string[]; lit?: string[]; w: number; h: number; start: number; marks?: MapMark[]; tilt?: number; seed?: number; region?: { x: number; y: number; w: number; h: number } }> = ({
  view,
  focus,
  lit = [],
  w,
  h,
  start,
  marks = [],
  tilt = -2,
  seed = 3,
  region,
}) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const geo = useGeo(WORLD);
  const [minLon, minLat, maxLon, maxLat] = view;

  const built = useMemo(() => {
    if (!geo) return null;
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const R = region ?? { x: 0, y: 0, w: 1, h: 1 };
    const s = Math.min((w * R.w) / ((maxLon - minLon) * k), (h * R.h) / (maxLat - minLat));
    const ox = w * R.x + (w * R.w - (maxLon - minLon) * k * s) / 2;
    const oy = h * R.y + (h * R.h - (maxLat - minLat) * s) / 2;
    // what the whole frame shows (wider than `view` on full-bleed maps)
    const visLon: [number, number] = [minLon - ox / (k * s), minLon + (w - ox) / (k * s)];
    const visLat: [number, number] = [maxLat - (h - oy) / s, maxLat + oy / s];
    const X = (lon: number) => ox + (lon - minLon) * k * s;
    const Y = (lat: number) => oy + (maxLat - lat) * s;
    const ringPath = (r: Ring) => "M" + r.map(([lon, lat]) => `${X(lon).toFixed(1)},${Y(lat).toFixed(1)}`).join("L") + "Z";
    const pathOf = (f: Feature, minPts = 0) =>
      polysOf(f)
        .filter((p) => p[0].length > minPts)
        .map((p) => p.map(ringPath).join(""))
        .join("");
    const pad = 4;
    const feats = (geo.features as unknown as Feature[]).filter((f) => {
      const [a, b, c, d] = bboxOf(f);
      return c > visLon[0] - pad && a < visLon[1] + pad && d > visLat[0] - pad && b < visLat[1] + pad;
    });
    const focusList = Array.isArray(focus) ? focus : [focus];
    // India last among neighbours, so its official boundary sits on top of overlapping claims.
    const others = feats.filter((f) => !focusList.includes(f.properties.iso)).sort((a, b) => (a.properties.iso === "IND" ? 1 : b.properties.iso === "IND" ? -1 : 0));
    const heroes = focusList.map((iso) => feats.find((f) => f.properties.iso === iso)).filter((f): f is Feature => !!f);
    const litPath = others.filter((f) => lit.includes(f.properties.iso)).map((f) => pathOf(f, 6)).join("");
    const grat: string[] = [];
    const step = maxLon - minLon > 40 ? 10 : 5;
    for (let lon = Math.ceil(visLon[0] / step) * step; lon <= visLon[1]; lon += step) grat.push(`M${X(lon).toFixed(1)},0L${X(lon).toFixed(1)},${h}`);
    for (let lat = Math.ceil(visLat[0] / step) * step; lat <= visLat[1]; lat += step) grat.push(`M0,${Y(lat).toFixed(1)}L${w},${Y(lat).toFixed(1)}`);
    return {
      X,
      Y,
      neighbours: others.map((f) => pathOf(f, 6)).join(""),
      lit: litPath,
      heroes: heroes.map((f) => {
        const b = bboxOf(f);
        return { iso: f.properties.iso, d: pathOf(f, 20), cx: X((b[0] + b[2]) / 2), cy: Y((b[1] + b[3]) / 2) };
      }),
      grat: grat.join(""),
    };
  }, [geo, w, h, minLon, minLat, maxLon, maxLat, JSON.stringify(focus), lit.join(), JSON.stringify(region)]);

  if (!built) return null;
  const bg = prog(frame, start, 18);
  const drop = prog(frame, start + 14, 20);
  const id = `${Array.isArray(focus) ? focus.join("") : focus}-${seed}`;
  const sticker = 7 * u;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        // printed onto the page: the atlas fades out toward its edges
        // printed onto the page: inset maps fade out toward their edges; full-bleed maps don't
        WebkitMaskImage: region ? undefined : "radial-gradient(closest-side, #000 70%, transparent 100%)",
        maskImage: region ? undefined : "radial-gradient(closest-side, #000 70%, transparent 100%)",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          {/* scissor-cut wobble + shadow for the cut-out */}
          <filter id={`cut-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={seed} result="wob" />
            <feDisplacementMap in="SourceGraphic" in2="wob" scale={6 * u} xChannelSelector="R" yChannelSelector="G" result="cut" />
            <feDropShadow in="cut" dx={0} dy={8 * u * drop} stdDeviation={7 * u} floodColor="#3C2A14" floodOpacity={0.32 * drop} />
          </filter>
          {/* kraft paper fibres inside the cut-out */}
          <filter id={`kraft-${id}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="3" seed={seed + 4} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.17  0 0 0 0.55 -0.12" result="fibre" />
            <feComposite in="fibre" in2="SourceGraphic" operator="in" result="tex" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="tex" />
            </feMerge>
          </filter>
          {/* pen wobble for borders */}
          <filter id={`ink-${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" seed={seed + 1} result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale={2.5 * u} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* atlas: sea wash, graticule, pale neighbours */}
        <g opacity={bg}>
          <rect width={w} height={h} fill={DOC.sea} />
          <path d={built.grat} stroke={DOC.inkSoft} strokeOpacity={0.28} strokeWidth={1.2 * u} strokeDasharray={`${4 * u} ${5 * u}`} fill="none" />
          <path d={built.neighbours} fill={DOC.land} stroke={DOC.inkSoft} strokeOpacity={0.55} strokeWidth={1.4 * u} strokeLinejoin="round" filter={`url(#ink-${id})`} />
          {built.lit && <path d={built.lit} fill={DOC.kraft} fillOpacity={0.55 * prog(frame, start + 20, 24)} stroke={DOC.kraftEdge} strokeWidth={1.2 * u} />}
        </g>

        {/* the cut-out countries (one sticker each, slightly staggered) */}
        {built.heroes.map((hero, i) => {
          const dI = prog(frame, start + 14 + i * 8, 20);
          const liftI = interpolate(dI, [0, 1], [1.08, 1]);
          return (
            <g
              key={hero.iso}
              opacity={dI}
              filter={`url(#cut-${id})`}
              transform={`translate(${hero.cx} ${hero.cy}) rotate(${tilt * dI * (i % 2 ? -1 : 1)}) scale(${liftI}) translate(${-hero.cx} ${-hero.cy})`}
            >
              <path d={hero.d} fill={DOC.stickerEdge} stroke={DOC.stickerEdge} strokeWidth={sticker * 2} strokeLinejoin="round" />
              <path d={hero.d} fill={DOC.kraft} filter={`url(#kraft-${id})`} />
              <path d={hero.d} fill="none" stroke={DOC.kraftEdge} strokeWidth={1.2 * u} strokeOpacity={0.6} />
            </g>
          );
        })}

        {/* red-pen marks */}
        {marks.map((m, i) => {
          const x = built.X(m.lon);
          const y = built.Y(m.lat);
          const p = prog(frame, start + 40 + i * 12, 16);
          const t = prog(frame, start + 50 + i * 12, 12);
          const r = 26 * u;
          const side = m.labelSide ?? "right";
          const lx = side === "left" ? x - r - 14 * u : side === "right" ? x + r + 14 * u : x;
          const ly = side === "top" ? y - r - 18 * u : side === "bottom" ? y + r + 34 * u : y + 9 * u;
          return (
            <g key={m.label}>
              <circle cx={x} cy={y} r={5 * u} fill={DOC.accent} opacity={p} />
              <path d={penLoop(x, y, r * 1.3, r)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} stroke={DOC.accent} strokeWidth={4 * u} strokeLinecap="round" fill="none" />
              <text
                x={lx}
                y={ly}
                textAnchor={side === "left" ? "end" : side === "right" ? "start" : "middle"}
                fontFamily={DOC.fonts.mono}
                fontWeight={600}
                fontSize={24 * u}
                letterSpacing={2 * u}
                fill={DOC.accent}
                opacity={t}
                style={{ textTransform: "uppercase" }}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

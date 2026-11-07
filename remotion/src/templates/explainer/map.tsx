// Satellite map scene: NASA Blue Marble imagery with state outlines from library/maps/<map>/,
// highlighted states (fill + orange label + big yellow number) and pins that pop in on cue words,
// and a slow camera move from the previous map scene's framing (or the whole country) to `focus`.
// Optionally cross-fades into the scene's photo at the end, like zooming down to the building.
import { useEffect, useState } from "react";
import { AbsoluteFill, Easing, Img, cancelRender, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EmphasisText } from "../../components/EmphasisText";
import { assetSrc } from "../../components/SceneVisual";
import { useTheme } from "../../theme";
import type { GeoMap, Word } from "../../types";
import type { SceneProps } from "../listicle/scenes";

const U = 100; // world units per degree (equirectangular)
const W = 1080;

type Bbox = [number, number, number, number]; // lonMin, latMin, lonMax, latMax
type Feature = {
  id: string;
  name: string;
  path: string;
  bbox: Bbox;
  center: [number, number];
};
type MapData = {
  images: { file: string; bbox: Bbox }[];
  states: Feature[];
  outline: string;
  neighbours: string;
  bbox: Bbox; // the country
  lat0: number; // top edge of the world space
  lon0: number;
};

type Ring = number[][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
type GeoJSON = {
  features: { properties: Record<string, string>; geometry: Geometry }[];
};

const polygons = (g: Geometry): Ring[][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

const toPath = (g: Geometry, lon0: number, lat0: number) =>
  polygons(g)
    .flatMap((poly) => poly.map((ring) => "M" + ring.map(([lon, lat]) => `${((lon - lon0) * U).toFixed(1)},${((lat0 - lat) * U).toFixed(1)}`).join("L") + "Z"))
    .join("");

const bboxOf = (g: Geometry): Bbox => {
  const pts = polygons(g).flatMap((p) => p[0]);
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
};

// Label anchor: the middle of the largest ring's bounding box (good enough for state labels).
const centerOf = (g: Geometry): [number, number] => {
  const rings = polygons(g).map((p) => p[0]);
  const big = rings.reduce((a, b) => (b.length > a.length ? b : a));
  const xs = big.map((p) => p[0]);
  const ys = big.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

const cache = new Map<string, Promise<MapData>>();
const loadMap = (id: string): Promise<MapData> => {
  if (!cache.has(id)) {
    const base = `library/maps/${id}`;
    const get = (f: string) => fetch(staticFile(`${base}/${f}`)).then((r) => r.json());
    cache.set(
      id,
      get("map.json").then(async (meta) => {
        const [states, outline, neighbours]: GeoJSON[] = await Promise.all([get(meta.layers.states), get(meta.layers.outline), get(meta.layers.neighbours)]);
        const lon0 = Math.min(...meta.images.map((i: { bbox: Bbox }) => i.bbox[0]));
        const lat0 = Math.max(...meta.images.map((i: { bbox: Bbox }) => i.bbox[3]));
        return {
          images: meta.images.map((i: { file: string; bbox: Bbox }) => ({
            file: `${base}/${i.file}`,
            bbox: i.bbox,
          })),
          states: states.features.map((f) => ({
            id: f.properties.id,
            name: f.properties.name,
            path: toPath(f.geometry, lon0, lat0),
            bbox: bboxOf(f.geometry),
            center: centerOf(f.geometry),
          })),
          outline: outline.features.map((f) => toPath(f.geometry, lon0, lat0)).join(""),
          neighbours: neighbours.features.map((f) => toPath(f.geometry, lon0, lat0)).join(""),
          bbox: outline.features.map((f) => bboxOf(f.geometry))[0],
          lon0,
          lat0,
        };
      }),
    );
  }
  return cache.get(id)!;
};

const useMap = (id: string) => {
  const [data, setData] = useState<MapData | null>(null);
  const [handle] = useState(() => delayRender(`map ${id}`));
  useEffect(() => {
    loadMap(id)
      .then((d) => {
        setData(d);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [id, handle]);
  return data;
};

type Camera = { scale: number; tx: number; ty: number };

const focusBbox = (geo: GeoMap, data: MapData): Bbox => {
  const f = geo.focus;
  if (!f?.length) return data.bbox;
  if (typeof f[0] === "number") return f as Bbox;
  const boxes = (f as string[]).map((id) => data.states.find((s) => s.id === id)?.bbox).filter((b): b is Bbox => !!b);
  if (!boxes.length) return data.bbox;
  return [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
};

const frameBbox = (b: Bbox, data: MapData, top: number, pad: number, bottom = 1600): Camera => {
  const x0 = (b[0] - data.lon0) * U;
  const x1 = (b[2] - data.lon0) * U;
  const y0 = (data.lat0 - b[3]) * U;
  const y1 = (data.lat0 - b[1]) * U;
  const scale = Math.min((W - 2 * pad) / (x1 - x0), (bottom - top - 2 * pad) / (y1 - y0));
  return {
    scale,
    tx: W / 2 - ((x0 + x1) / 2) * scale,
    ty: (top + bottom) / 2 - ((y0 + y1) / 2) * scale,
  };
};

// Zoom in log space so a 20× zoom feels even, like a camera dolly.
const mix = (a: Camera, b: Camera, t: number): Camera => {
  const scale = Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * t);
  // keep the point under the screen center moving smoothly between the two framings
  const ca = { x: (W / 2 - a.tx) / a.scale, y: (960 - a.ty) / a.scale };
  const cb = { x: (W / 2 - b.tx) / b.scale, y: (960 - b.ty) / b.scale };
  const k = Math.abs(b.scale - a.scale) < 1e-6 ? t : (scale - a.scale) / (b.scale - a.scale);
  const cx = ca.x + (cb.x - ca.x) * k;
  const cy = ca.y + (cb.y - ca.y) * k;
  return { scale, tx: W / 2 - cx * scale, ty: 960 - cy * scale };
};

const cueAt = (word: string | undefined, words: Word[] | undefined, fps: number, fallback: number) => {
  const cue = word?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const w = cue
    ? words?.find((x) =>
        x.text
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .startsWith(cue),
      )
    : undefined;
  return w ? Math.round(w.start * fps) - 3 : fallback;
};

// counters sit in the lower part of the frame, so the map is framed above them
const mapBottom = (geo: GeoMap) => (geo.counters?.length ? 1220 : 1600);
const cameraFor = (geo: GeoMap, data: MapData, title: boolean) => frameBbox(focusBbox(geo, data), data, title ? 330 : 200, geo.focus?.length ? 120 : 40, mapBottom(geo));

export const MapScene: React.FC<SceneProps> = ({ scene, project, index, words, projectPath }) => {
  const geo = scene.geo!;
  const data = useMap(geo.map);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useTheme();
  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;

  const title = !!scene.onScreenText;
  const target = cameraFor(geo, data, title);
  const prev = index > 0 ? project?.scenes[index - 1] : undefined;
  const from = prev?.kind === "map" && prev.geo?.map === geo.map ? cameraFor(prev.geo, data, !!prev.onScreenText) : frameBbox(data.bbox, data, title ? 330 : 200, 0, mapBottom(geo));
  const moveEnd = Math.max(30, Math.round(durationInFrames * 0.7));
  const t = interpolate(frame, [4, moveEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cam = mix(from, target, t);
  const counter = 1 / cam.scale; // keeps labels and strokes a constant size on screen

  const photoAt = geo.photo && scene.visual.asset ? cueAt(geo.photo.cue, words, fps, durationInFrames - 30) : null;
  const photo =
    photoAt == null
      ? 0
      : interpolate(frame, [photoAt, photoAt + 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const titleEnter = spring({ frame, fps, config: { damping: 14 } });
  const toXY = (lon: number, lat: number) => ({
    x: (lon - data.lon0) * U,
    y: (data.lat0 - lat) * U,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#06122A", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`,
        }}
      >
        {data.images.map((im) => {
          const a = toXY(im.bbox[0], im.bbox[3]);
          return (
            <Img
              key={im.file}
              src={staticFile(im.file)}
              style={{
                position: "absolute",
                left: a.x,
                top: a.y,
                width: (im.bbox[2] - im.bbox[0]) * U,
                height: (im.bbox[3] - im.bbox[1]) * U,
              }}
            />
          );
        })}
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          <path d={data.neighbours} fill="rgba(0,10,30,0.35)" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5 * counter} />
          {data.states.map((s) => (
            <path key={s.id} d={s.path} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.4 * counter} />
          ))}
          {(geo.highlight ?? []).map((h, i) => {
            const s = data.states.find((x) => x.id === h.state);
            if (!s) return null;
            const at = cueAt(h.cue, words, fps, 20 + i * 15);
            const on = interpolate(frame, [at, at + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const color = h.tone === "accent" ? theme.accent : theme.secondary;
            return <path key={h.state} d={s.path} fill={color} fillOpacity={0.6 * on} stroke={theme.accent} strokeOpacity={on} strokeWidth={4 * counter} />;
          })}
          <path d={data.outline} fill="none" stroke="#FFFFFF" strokeWidth={3 * counter} strokeOpacity={0.95} />
        </svg>
        {(geo.highlight ?? []).map((h, i) => {
          const s = data.states.find((x) => x.id === h.state);
          if (!s) return null;
          const at = cueAt(h.cue, words, fps, 20 + i * 15);
          const pop = spring({
            frame: frame - at - 4,
            fps,
            config: { damping: 12, mass: 0.6 },
          });
          const p = toXY(...s.center);
          // keep the label on screen: nudge it inward when the state sits near the frame edge
          const sx = p.x * cam.scale + cam.tx;
          const dx = (Math.min(Math.max(sx, 210), W - 210) - sx) * counter;
          // tiny states (Sikkim, Goa, Delhi) get a pulsing ring so the eye finds them
          const tiny = (s.bbox[2] - s.bbox[0]) * U * cam.scale < 90;
          const ring = 1 + 0.15 * Math.sin((frame - at) / 5);
          return (
            <div key={h.state}>
              {tiny && (
                <div
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    width: 0,
                    height: 0,
                    transform: `scale(${counter})`,
                    opacity: pop,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -60,
                      top: -60,
                      width: 120,
                      height: 120,
                      borderRadius: 60,
                      border: `6px solid ${theme.accent}`,
                      transform: `scale(${pop * ring})`,
                      boxShadow: "0 0 18px rgba(0,0,0,0.5)",
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  left: p.x + dx,
                  top: p.y + (tiny ? 110 * counter : 0),
                  transform: `scale(${counter}) translate(-50%, ${tiny ? "0" : "-50%"}) scale(${pop})`,
                  transformOrigin: "0 0",
                  opacity: pop,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: theme.secondary,
                      color: theme.textOnSecondary,
                      fontFamily: theme.bodyFont,
                      fontWeight: 900,
                      fontSize: 34,
                      padding: "8px 20px",
                      borderRadius: 6,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      boxShadow: "0 8px 18px rgba(0,0,0,0.4)",
                    }}
                  >
                    {h.label ?? s.name}
                  </div>
                  {h.value && (
                    <div
                      style={{
                        fontFamily: theme.headlineFont,
                        fontSize: 120,
                        lineHeight: 1,
                        color: theme.accent,
                        textShadow: "0 6px 16px rgba(0,0,0,0.6)",
                      }}
                    >
                      {h.value}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {(geo.pins ?? []).map((pin, i) => {
          const at = cueAt(pin.cue, words, fps, 20 + i * 15);
          const pop = spring({
            frame: frame - at,
            fps,
            config: { damping: 11, mass: 0.6 },
          });
          const p = toXY(pin.lon, pin.lat);
          if (pin.tag) return <PriceTag key={pin.label} x={p.x} y={p.y} scale={counter} pop={pop} text={pin.tag} bob={Math.sin((frame - at) / 9 + i)} />;
          return (
            <div
              key={pin.label}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                transform: `scale(${counter})`,
                transformOrigin: "0 0",
                opacity: Math.min(1, pop * 2),
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -18,
                  top: -18,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.accent,
                  border: "5px solid #FFFFFF",
                  transform: `scale(${pop})`,
                  boxShadow: "0 0 0 10px rgba(255,210,31,0.3)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 30,
                  top: -34,
                  fontFamily: theme.headlineFont,
                  fontSize: 64,
                  color: "#FFFFFF",
                  whiteSpace: "nowrap",
                  textShadow: "0 4px 14px rgba(0,0,0,0.8)",
                }}
              >
                {pin.label}
              </div>
            </div>
          );
        })}
      </div>
      {geo.counters?.length ? <Counters counters={geo.counters} words={words} /> : null}
      {photo > 0 && scene.visual.asset && (
        <AbsoluteFill style={{ opacity: photo }}>
          <Img
            src={staticFile(assetSrc(scene.visual.asset, projectPath))}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${interpolate(frame, [photoAt!, durationInFrames], [1.25, 1.08], { extrapolateLeft: "clamp" })})`,
            }}
          />
        </AbsoluteFill>
      )}
      {title && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 150,
            fontFamily: theme.headlineFont,
            fontSize: 92,
            lineHeight: 1,
            textTransform: "uppercase",
            color: theme.text,
            textShadow: "0 6px 20px rgba(0,0,0,0.7)",
            opacity: titleEnter,
          }}
        >
          <EmphasisText text={scene.onScreenText} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// Orange price tag hanging from a city, swinging gently.
const PriceTag: React.FC<{ x: number; y: number; scale: number; pop: number; text: string; bob: number }> = ({ x, y, scale, pop, text, bob }) => {
  const theme = useTheme();
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      <div style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF", opacity: pop }} />
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `rotate(${12 + 6 * bob}deg) scale(${pop})` }}>
        <svg width={170} height={90} viewBox="0 0 170 90" style={{ position: "absolute", left: 10, top: -10, overflow: "visible" }}>
          <path d="M-10 10 L 22 30" stroke="#FFFFFF" strokeWidth={3} />
          <path d="M22 10 L 50 0 H160 A10 10 0 0 1 170 10 V70 A10 10 0 0 1 160 80 H50 L22 70 Z" fill={theme.secondary} stroke="#FFFFFF" strokeWidth={4} />
          <circle cx="40" cy="40" r="7" fill="#FFFFFF" />
        </svg>
        <div style={{ position: "absolute", left: 66, top: -2, width: 110, height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.headlineFont, fontSize: 52, color: "#FFFFFF", whiteSpace: "nowrap" }}>
          {text}
        </div>
      </div>
    </div>
  );
};

// Big numbers under the map that count up when the narration reaches them.
const Counters: React.FC<{ counters: NonNullable<GeoMap["counters"]>; words?: Word[] }> = ({ counters, words }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1250, display: "flex", gap: 30 }}>
      {counters.map((c, i) => {
        const at = cueAt(c.cue, words, fps, 30 + i * 40);
        const enter = spring({ frame: frame - at, fps, config: { damping: 13 } });
        const n = Math.round(c.value * interpolate(frame, [at, at + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
        return (
          <div
            key={i}
            style={{
              flex: 1,
              backgroundColor: "rgba(6,18,42,0.82)",
              border: `3px solid ${theme.accent}`,
              borderRadius: 22,
              padding: "18px 22px",
              opacity: enter,
              transform: `translateY(${(1 - enter) * 60}px)`,
            }}
          >
            <div style={{ fontFamily: theme.headlineFont, fontSize: 104, lineHeight: 1, color: theme.accent }}>
              {c.prefix ?? ""}
              {n}
              {c.suffix ?? ""}
            </div>
            <div style={{ marginTop: 8, fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 28, lineHeight: 1.2, color: "#FFFFFF" }}>
              <EmphasisText text={c.label} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

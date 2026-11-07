// Blueprint org chart built up across consecutive "diagram" scenes. The whole tree is laid out
// once from `project.diagram` (plus every compare any scene adds, so nothing shifts later); each
// scene reveals nodes, glides the camera from the previous scene's framing to its own focus and
// draws this scene's handwritten notes. Back-to-back diagram scenes read as one continuous shot.
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BlueprintBackground } from "../../components/Blueprint";
import { EmphasisText } from "../../components/EmphasisText";
import { PhotoStrip } from "../../components/Stage";
import { assetSrc } from "../../components/SceneVisual";
import { useTheme } from "../../theme";
import type { DiagramCompare, DiagramNode, DiagramNote, DiagramTally, Project, Word } from "../../types";
import type { SceneProps } from "../listicle/scenes";

const W = 1080;
const NODE_W = 380;
const ICON_H = 170;
const LABEL_H = 74;
const VALUE_H = 118;
const PERSON = 30; // pictogram cell (node people grid)
const PEOPLE_COLS = 10;
const MAX_PEOPLE = 60;
const PER_ICON = 10; // node pictograms: one icon ≈ 10 members, so 543 and 245 look different
const CMP_PERSON = 24; // pictogram cell (compare columns)
const CMP_COLS = 10;
const CMP_GAP = 50;
const LEVEL_GAP = 130;
const SIBLING_GAP = 70;
const CAMERA_FRAMES = 26;
const TALLY_COLS = 5;
const TALLY_CELL = 96;

type Box = { x: number; y: number; w: number; h: number; core: number }; // x = center, core = height without compare

const rows = (n: number, cols: number) => Math.ceil(n / cols);
const peopleIcons = (n: number) => Math.min(Math.ceil(n / PER_ICON), MAX_PEOPLE);
const compareWidth = (c: DiagramCompare) =>
  c.items.reduce((sum, it) => sum + Math.min(it.value, CMP_COLS) * CMP_PERSON, 0) + CMP_GAP * (c.items.length - 1);
const compareHeight = (c: DiagramCompare) => 36 + Math.max(...c.items.map((it) => rows(Math.min(it.value, 100), CMP_COLS))) * CMP_PERSON + 110;

const coreHeight = (n: DiagramNode) =>
  (n.icon || n.image ? ICON_H : 0) +
  LABEL_H +
  (n.value ? VALUE_H : 0) +
  (n.people ? 16 + rows(peopleIcons(n.people), PEOPLE_COLS) * PERSON : 0);

// Tidy top-down tree: each subtree is as wide as its children (or itself), parents centered above.
const layout = (nodes: DiagramNode[], compares: Map<string, DiagramCompare>) => {
  const children = new Map<string, DiagramNode[]>();
  const roots: DiagramNode[] = [];
  for (const n of nodes) {
    if (n.parent && nodes.some((p) => p.id === n.parent)) children.set(n.parent, [...(children.get(n.parent) ?? []), n]);
    else roots.push(n);
  }
  const ownWidth = (n: DiagramNode) => Math.max(NODE_W, compares.has(n.id) ? compareWidth(compares.get(n.id)!) : 0);
  const fullHeight = (n: DiagramNode) => coreHeight(n) + (compares.has(n.id) ? compareHeight(compares.get(n.id)!) : 0);
  const subtree = new Map<string, number>();
  const measure = (n: DiagramNode): number => {
    const kids = children.get(n.id) ?? [];
    const kidsW = kids.reduce((s, k) => s + measure(k), 0) + SIBLING_GAP * Math.max(0, kids.length - 1);
    const w = Math.max(ownWidth(n), kidsW);
    subtree.set(n.id, w);
    return w;
  };
  const depth = new Map<string, number>();
  const levelH: number[] = [];
  const walkDepth = (n: DiagramNode, d: number) => {
    depth.set(n.id, d);
    levelH[d] = Math.max(levelH[d] ?? 0, fullHeight(n));
    for (const k of children.get(n.id) ?? []) walkDepth(k, d + 1);
  };
  roots.forEach((r) => {
    measure(r);
    walkDepth(r, 0);
  });
  const levelY: number[] = [];
  levelH.forEach((h, i) => (levelY[i] = i === 0 ? 0 : levelY[i - 1] + levelH[i - 1] + LEVEL_GAP));

  const boxes = new Map<string, Box>();
  const place = (n: DiagramNode, left: number) => {
    const w = subtree.get(n.id)!;
    boxes.set(n.id, { x: left + w / 2, y: levelY[depth.get(n.id)!], w: ownWidth(n), h: fullHeight(n), core: coreHeight(n) });
    const kids = children.get(n.id) ?? [];
    const kidsW = kids.reduce((s, k) => s + subtree.get(k.id)!, 0) + SIBLING_GAP * Math.max(0, kids.length - 1);
    let x = left + (w - kidsW) / 2;
    for (const k of kids) {
      place(k, x);
      x += subtree.get(k.id)! + SIBLING_GAP;
    }
  };
  let left = 0;
  for (const r of roots) {
    place(r, left);
    left += subtree.get(r.id)! + SIBLING_GAP * 2;
  }
  return boxes;
};

type Camera = { scale: number; tx: number; ty: number };

// Fit the focused boxes into the free area of the 9:16 frame (below the title, above captions).
const frameBoxes = (boxes: Box[], top: number, bottom = 1560): Camera => {
  const minX = Math.min(...boxes.map((b) => b.x - b.w / 2)) - 40;
  const maxX = Math.max(...boxes.map((b) => b.x + b.w / 2)) + 40;
  const minY = Math.min(...boxes.map((b) => b.y)) - 40;
  const maxY = Math.max(...boxes.map((b) => b.y + b.h)) + 40;
  const scale = Math.min(940 / (maxX - minX), (bottom - top) / (maxY - minY), 1.7);
  return { scale, tx: W / 2 - ((minX + maxX) / 2) * scale, ty: (top + bottom) / 2 - ((minY + maxY) / 2) * scale };
};

// Everything the chart looks like at a given diagram scene: cumulative reveals and compares.
const stateAt = (project: Project, sceneIndex: number) => {
  const revealed = new Set<string>();
  const compares = new Map<string, DiagramCompare>();
  for (let i = 0; i <= sceneIndex; i++) {
    const d = project.scenes[i].kind === "diagram" ? project.scenes[i].diagram : undefined;
    d?.reveal?.forEach((id) => revealed.add(id));
    if (d?.compare) compares.set(d.compare.at, d.compare);
  }
  return { revealed, compares };
};

const cameraFor = (project: Project, sceneIndex: number, boxes: Map<string, Box>) => {
  const scene = project.scenes[sceneIndex];
  const { revealed, compares } = stateAt(project, sceneIndex);
  const ids = scene.diagram?.focus?.length ? scene.diagram.focus : [...revealed];
  // frame what is on screen now: a compare that only appears later doesn't count yet
  const focus = ids
    .map((id) => {
      const b = boxes.get(id);
      return b && !compares.has(id) ? { ...b, h: b.core } : b;
    })
    .filter((b): b is Box => !!b);
  // keep this scene's handwritten notes in frame too
  for (const note of scene.diagram?.notes ?? []) {
    const b = boxes.get(note.at);
    if (!b) continue;
    const side = note.side ?? "right";
    const textW = note.text.length * 28 + 40; // Caveat at 58px is roughly 28px per character
    if (side === "below") focus.push({ x: b.x, y: b.y + b.h, w: Math.max(360, textW), h: 160, core: 0 });
    else focus.push({ x: b.x + (side === "right" ? 1 : -1) * (NODE_W / 2 + 80 + textW / 2), y: b.y + b.core / 2 - 60, w: textW + 40, h: 160, core: 0 });
  }
  const t = scene.diagram?.tally;
  const tb = t && boxes.get(t.at);
  if (tb) focus.push({ x: tb.x, y: tb.y + tb.core + 20, w: TALLY_COLS * TALLY_CELL, h: rows(t.total, TALLY_COLS) * TALLY_CELL + 90, core: 0 });
  // a photo strip takes the lower part of the frame
  return frameBoxes(focus.length ? focus : [...boxes.values()], scene.onScreenText ? 330 : 200, scene.strip?.length ? 1110 : 1560);
};

const cueAt = (word: string | undefined, words: Word[] | undefined, fps: number, fallback: number) => {
  const cue = word?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const w = cue ? words?.find((x) => x.text.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(cue)) : undefined;
  return w ? Math.round(w.start * fps) - 3 : fallback;
};

export const DiagramScene: React.FC<SceneProps> = ({ scene, project, index, words, projectPath }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  if (!project?.diagram) return <BlueprintBackground />;

  const nodes = project.diagram.nodes;
  const allCompares = new Map<string, DiagramCompare>();
  project.scenes.forEach((s) => s.diagram?.compare && allCompares.set(s.diagram.compare.at, s.diagram.compare));
  const boxes = layout(nodes, allCompares);

  const step = scene.diagram ?? {};
  const { revealed, compares } = stateAt(project, index);
  const fresh = new Set(step.reveal ?? []);
  const prevIsDiagram = index > 0 && project.scenes[index - 1].kind === "diagram";

  const target = cameraFor(project, index, boxes);
  const from = prevIsDiagram ? cameraFor(project, index - 1, boxes) : { ...target, scale: target.scale * 0.9, tx: target.tx + (W * target.scale * 0.05) };
  const p = interpolate(frame, [0, CAMERA_FRAMES], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const cam: Camera = {
    scale: from.scale + (target.scale - from.scale) * p,
    tx: from.tx + (target.tx - from.tx) * p,
    ty: from.ty + (target.ty - from.ty) * p,
  };

  // When each freshly revealed node pops in: its cue word, else staggered after the camera move
  const appearAt = new Map<string, number>();
  [...fresh].forEach((id, i) => appearAt.set(id, cueAt(step.cues?.[id], words, fps, 8 + i * 12)));
  const enter = (id: string) => (fresh.has(id) ? spring({ frame: frame - (appearAt.get(id) ?? 0), fps, config: { damping: 14, mass: 0.7 } }) : 1);

  const titleEnter = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill>
      <BlueprintBackground offset={{ x: cam.tx, y: cam.ty, scale: cam.scale }} />
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})` }}>
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          {nodes.map((n) => {
            if (!n.parent || !revealed.has(n.id) || !revealed.has(n.parent)) return null;
            const a = boxes.get(n.parent)!;
            const b = boxes.get(n.id)!;
            const [p0, p1, p2, p3] = connector(a, b);
            const d = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`;
            const len = polyLength([p0, p1, p2, p3]);
            const draw = Math.min(enter(n.id), enter(n.parent));
            return <path key={n.id} d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={4} strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />;
          })}
          {step.flow &&
            Object.entries(step.flow.to).map(([to, weight]) => {
              const a = boxes.get(step.flow!.from);
              const b = boxes.get(to);
              if (!a || !b || !revealed.has(to) || !revealed.has(step.flow!.from)) return null;
              const pts = connector(a, b);
              const start = Math.max(CAMERA_FRAMES, (appearAt.get(to) ?? 0) + 14);
              const every = Math.max(4, Math.round(28 / weight));
              const travel = 36;
              return Array.from({ length: Math.ceil(600 / every) }, (_, k) => {
                const age = frame - (start + k * every);
                if (age < 0 || age > travel) return null;
                const p = pointAt(pts, age / travel);
                return <Chip key={`${to}-${k}`} x={p.x} y={p.y} opacity={Math.min(1, (travel - age) / 6)} />;
              });
            })}
        </svg>
        {step.tally && boxes.has(step.tally.at) && (
          <Tally tally={step.tally} box={boxes.get(step.tally.at)!} at={cueAt(step.tally.cue, words, fps, CAMERA_FRAMES + 10)} />
        )}
        {nodes.map((n) =>
          revealed.has(n.id) ? (
            <NodeView
              key={n.id}
              node={n}
              box={boxes.get(n.id)!}
              enter={enter(n.id)}
              countFrom={fresh.has(n.id) ? appearAt.get(n.id)! : null}
              highlight={step.highlight?.includes(n.id) ?? false}
              compare={compares.get(n.id)}
              compareFresh={step.compare?.at === n.id}
              words={words}
              projectPath={projectPath}
            />
          ) : null,
        )}
        {(step.notes ?? []).map((note, i) =>
          boxes.has(note.at) ? <Note key={i} note={note} box={boxes.get(note.at)!} at={cueAt(note.cue, words, fps, CAMERA_FRAMES + 6 + i * 14)} /> : null,
        )}
      </div>
      {scene.strip?.length ? (
        <div style={{ position: "absolute", left: 70, right: 70, top: 1110 }}>
          <PhotoStrip scene={scene} projectPath={projectPath} />
        </div>
      ) : null}
      {scene.onScreenText && (
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
            textShadow: "0 6px 20px rgba(0,20,60,0.5)",
            opacity: titleEnter,
            transform: `translateY(${(1 - titleEnter) * -40}px)`,
          }}
        >
          <EmphasisText text={scene.onScreenText} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const NodeView: React.FC<{
  node: DiagramNode;
  box: Box;
  enter: number;
  countFrom: number | null;
  highlight: boolean;
  compare?: DiagramCompare;
  compareFresh: boolean;
  words?: Word[];
  projectPath: string;
}> = ({ node, box, enter, countFrom, highlight, compare, compareFresh, words, projectPath }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glow = highlight ? 0.6 + 0.4 * Math.sin(frame / 6) : 0;
  const numeric = node.value && /^\d+$/.test(node.value) ? Number(node.value) : null;
  const shown =
    numeric != null && countFrom != null
      ? Math.round(numeric * interpolate(frame, [countFrom, countFrom + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }))
      : node.value;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x - NODE_W / 2,
        top: box.y,
        width: NODE_W,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: Math.min(1, enter * 1.4),
        transform: `translateY(${(1 - enter) * 40}px) scale(${0.8 + 0.2 * enter})`,
      }}
    >
      {node.image ? (
        <Img src={staticFile(assetSrc(node.image, projectPath))} style={{ height: ICON_H - 10, objectFit: "contain", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))" }} />
      ) : node.icon ? (
        <LineIcon kind={node.icon} />
      ) : null}
      <div
        style={{
          height: LABEL_H - 8,
          padding: "0 26px",
          display: "flex",
          alignItems: "center",
          backgroundColor: theme.secondary,
          color: theme.textOnSecondary,
          fontFamily: theme.bodyFont,
          fontWeight: 900,
          fontSize: 34,
          letterSpacing: 1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          borderRadius: 6,
          boxShadow: `0 8px 18px rgba(0,0,0,0.3), 0 0 0 ${highlight ? 6 : 0}px ${theme.accent}${highlight ? Math.round(glow * 255).toString(16).padStart(2, "0") : "00"}`,
        }}
      >
        {node.label}
      </div>
      {node.people ? <People count={peopleIcons(node.people)} cell={PERSON} cols={PEOPLE_COLS} style={{ marginTop: 16 }} /> : null}
      {node.value && (
        <div style={{ height: VALUE_H, fontFamily: theme.headlineFont, fontWeight: 900, fontSize: 112, lineHeight: `${VALUE_H}px`, color: theme.accent, textShadow: "0 6px 0 rgba(0,20,60,0.35)" }}>
          {shown}
        </div>
      )}
      {compare && <CompareView compare={compare} fresh={compareFresh} words={words} fps={fps} />}
    </div>
  );
};

const CompareView: React.FC<{ compare: DiagramCompare; fresh: boolean; words?: Word[]; fps: number }> = ({ compare, fresh, words, fps }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  return (
    <div style={{ marginTop: 36, display: "flex", gap: CMP_GAP, alignItems: "flex-end" }}>
      {compare.items.map((it, i) => {
        const at = fresh ? cueAt(it.cue, words, fps, CAMERA_FRAMES + i * 18) : -100;
        const grow = interpolate(frame, [at, at + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const total = Math.min(it.value, 100);
        const visible = Math.max(fresh ? Math.round(total * grow) : total, grow > 0 || !fresh ? 1 : 0);
        return (
          <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: fresh ? Math.min(1, grow * 3) : 1 }}>
            <People count={visible} cell={CMP_PERSON} cols={Math.min(CMP_COLS, total)} color={theme.text} />
            <div style={{ marginTop: 8, fontFamily: theme.headlineFont, fontWeight: 900, fontSize: 64, lineHeight: 1, color: theme.accent }}>{Math.round(it.value * grow) || (fresh ? 0 : it.value)}</div>
            <div style={{ marginTop: 6, fontFamily: theme.bodyFont, fontWeight: 800, fontSize: 24, color: theme.text, whiteSpace: "nowrap" }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// Rows of little person icons, filled bottom-up like a seat count.
const People: React.FC<{ count: number; cell: number; cols: number; color?: string; style?: React.CSSProperties }> = ({ count, cell, cols, color = "#FFFFFF", style }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cell}px)`, ...style }}>
    {Array.from({ length: count }, (_, i) => (
      <svg key={i} width={cell} height={cell} viewBox="0 0 20 20">
        <circle cx="10" cy="5" r="3.6" fill={color} />
        <path d="M4.5 19 v-6.5 a5.5 5.5 0 0 1 11 0 V19 z" fill={color} />
      </svg>
    ))}
  </div>
);

// White line drawings that sit above a node's label (blueprint look, no photo licensing).
export const LineIcon: React.FC<{ kind: NonNullable<DiagramNode["icon"]> }> = ({ kind }) => {
  const s = { fill: "none", stroke: "#FFFFFF", strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg width={280} height={ICON_H - 14} viewBox="0 0 280 156" style={{ marginBottom: 10 }}>
      {kind === "parliament" && (
        <g {...s}>
          <path d="M30 146 H250" />
          <path d="M44 146 V96 H236 V146" />
          {[64, 92, 120, 160, 188, 216].map((x) => <path key={x} d={`M${x} 100 V146`} />)}
          <path d="M36 96 H244 L232 80 H48 Z" />
          <path d="M92 80 A48 40 0 0 1 188 80" />
          <path d="M140 40 V14 M140 14 L162 20 L140 26" />
        </g>
      )}
      {kind === "palace" && (
        <g {...s}>
          <path d="M14 146 H266" />
          <path d="M24 146 V100 H256 V146" />
          {[40, 62, 84, 196, 218, 240].map((x) => <path key={x} d={`M${x} 104 V146`} />)}
          <path d="M104 146 V86 H176 V146" />
          {[118, 140, 162].map((x) => <path key={x} d={`M${x} 92 V146`} />)}
          <path d="M98 86 H182" />
          <path d="M108 86 A32 34 0 0 1 172 86" />
          <path d="M140 52 V26" />
        </g>
      )}
      {kind === "people" && (
        <g fill="#FFFFFF">
          {[90, 140, 190].map((x, i) => (
            <g key={x} transform={`translate(${x - 26} ${i === 1 ? 20 : 40}) scale(2.6)`}>
              <circle cx="10" cy="5" r="3.6" />
              <path d="M4.5 19 v-6.5 a5.5 5.5 0 0 1 11 0 V19 z" />
            </g>
          ))}
        </g>
      )}
      {kind === "state" && (
        <g {...s}>
          <path d="M140 146 C 100 96, 96 76, 96 60 A44 44 0 0 1 184 60 C 184 76, 180 96, 140 146 Z" />
          <circle cx="140" cy="60" r="16" />
        </g>
      )}
      {kind === "factory" && (
        <g {...s}>
          <path d="M30 146 H250" />
          <path d="M40 146 V90 L90 64 V90 L140 64 V90 L190 64 V146" />
          <path d="M190 146 V40 H222 V146" />
          <path d="M200 26 C 196 18, 212 14, 208 4 M214 30 C 214 22, 228 20, 226 10" />
          {[62, 112, 162].map((x) => <path key={x} d={`M${x} 112 H${x + 16} V128 H${x} Z`} />)}
        </g>
      )}
      {kind === "server" && (
        <g {...s}>
          {[20, 62, 104].map((y) => (
            <g key={y}>
              <rect x="70" y={y} width="140" height="36" rx="6" />
              <circle cx="92" cy={y + 18} r="4" />
              <path d={`M150 ${y + 18} H192`} />
            </g>
          ))}
          <path d="M140 140 V150 M100 150 H180" />
        </g>
      )}
      {kind === "phone" && (
        <g {...s}>
          <rect x="104" y="8" width="72" height="140" rx="12" />
          <path d="M128 20 H152" />
          <rect x="114" y="30" width="52" height="96" rx="2" />
          <circle cx="140" cy="136" r="4" />
        </g>
      )}
    </svg>
  );
};

// Handwritten note with a hand-drawn arrow pointing at the node's label.
const Note: React.FC<{ note: DiagramNote; box: Box; at: number }> = ({ note, box, at }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - at, fps, config: { damping: 16 } });
  const side = note.side ?? "right";
  const labelY = box.y + (box.core - LABEL_H) / 2 + 20;
  const textStyle: React.CSSProperties = {
    position: "absolute",
    fontFamily: theme.handFont,
    fontWeight: 700,
    fontSize: 58,
    lineHeight: 1,
    color: theme.accent,
    whiteSpace: "nowrap",
    transform: `rotate(-6deg) scale(${0.7 + 0.3 * enter})`,
    opacity: enter,
    textShadow: "0 3px 10px rgba(0,20,60,0.5)",
  };
  const draw = interpolate(frame, [at, at + 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (side === "below") {
    const y = box.y + box.h + 20;
    return (
      <>
        <svg style={{ position: "absolute", left: box.x - 40, top: y - 8, overflow: "visible" }} width={80} height={60}>
          <path d="M40 56 C 30 36, 50 20, 40 4 M30 16 L40 4 L50 16" fill="none" stroke={theme.accent} strokeWidth={4} strokeLinecap="round" strokeDasharray={120} strokeDashoffset={120 * draw} />
        </svg>
        <div style={{ ...textStyle, left: box.x, top: y + 60, transform: `translateX(-50%) ${textStyle.transform}`, transformOrigin: "center" }}>{note.text}</div>
      </>
    );
  }
  const dir = side === "right" ? 1 : -1;
  const edge = box.x + dir * (NODE_W / 2 - 10);
  const arrow =
    dir === 1
      ? "M110 70 C 70 74, 40 60, 10 34 M10 34 L30 34 M10 34 L16 52"
      : "M10 70 C 50 74, 80 60, 110 34 M110 34 L90 34 M110 34 L104 52";
  return (
    <>
      <svg style={{ position: "absolute", left: dir === 1 ? edge : edge - 120, top: labelY - 40, overflow: "visible" }} width={120} height={90}>
        <path d={arrow} fill="none" stroke={theme.accent} strokeWidth={4} strokeLinecap="round" strokeDasharray={160} strokeDashoffset={160 * draw} />
      </svg>
      <div
        style={{
          ...textStyle,
          top: labelY + 30,
          ...(dir === 1 ? { left: edge + 90, transformOrigin: "left center" } : { right: -(edge - 90), transformOrigin: "right center" }),
        }}
      >
        {note.text}
      </div>
    </>
  );
};


type Pt = { x: number; y: number };

// Elbow line from a parent's bottom to a child's top.
const connector = (a: Box, b: Box): Pt[] => {
  const y0 = a.y + a.core + 8;
  const mid = b.y - LEVEL_GAP / 2;
  return [
    { x: a.x, y: y0 },
    { x: a.x, y: mid },
    { x: b.x, y: mid },
    { x: b.x, y: b.y - 6 },
  ];
};

const polyLength = (pts: Pt[]) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

const pointAt = (pts: Pt[], t: number): Pt => {
  let left = polyLength(pts) * t;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (left <= seg) return { x: pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * left) / (seg || 1), y: pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * left) / (seg || 1) };
    left -= seg;
  }
  return pts[pts.length - 1];
};

// A memory chip travelling down a line.
const Chip: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => {
  const theme = useTheme();
  return (
    <g transform={`translate(${x - 17} ${y - 11})`} opacity={opacity}>
      {[4, 12, 20, 28].map((px) => (
        <g key={px}>
          <rect x={px} y={-4} width={3} height={4} fill="#FFFFFF" />
          <rect x={px} y={22} width={3} height={4} fill="#FFFFFF" />
        </g>
      ))}
      <rect width={34} height={22} rx={3} fill={theme.accent} stroke="#0A2A5E" strokeWidth={2} />
    </g>
  );
};

// Row(s) of wafer / chip icons under a node, `lit` of them light up in the accent colour.
const Tally: React.FC<{ tally: DiagramTally; box: Box; at: number }> = ({ tally, box, at }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - at + 10, fps, config: { damping: 14 } });
  const lit = Math.round(tally.lit * interpolate(frame, [at, at + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const w = TALLY_COLS * TALLY_CELL;
  return (
    <div style={{ position: "absolute", left: box.x - w / 2, top: box.y + box.core + 20, width: w, opacity: enter }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${TALLY_COLS}, ${TALLY_CELL}px)` }}>
        {Array.from({ length: tally.total }, (_, i) => {
          const on = i < lit;
          return (
            <svg key={i} width={TALLY_CELL} height={TALLY_CELL} viewBox="0 0 100 100">
              {tally.icon === "wafer" ? (
                <g>
                  <circle cx="50" cy="50" r="40" fill={on ? theme.accent : "rgba(255,255,255,0.12)"} stroke="#FFFFFF" strokeWidth="4" />
                  <path d="M30 22 V78 M50 12 V88 M70 22 V78 M22 30 H78 M12 50 H88 M22 70 H78" stroke={on ? "#0A2A5E" : "#FFFFFF"} strokeOpacity={on ? 0.5 : 0.35} strokeWidth="2" />
                  <path d="M42 88 H58" stroke="#FFFFFF" strokeWidth="6" />
                </g>
              ) : (
                <rect x="20" y="30" width="60" height="40" rx="5" fill={on ? theme.accent : "rgba(255,255,255,0.12)"} stroke="#FFFFFF" strokeWidth="4" />
              )}
            </svg>
          );
        })}
      </div>
      {tally.label && (
        <div style={{ marginTop: 8, textAlign: "center", fontFamily: theme.handFont, fontWeight: 700, fontSize: 52, color: theme.accent }}>{tally.label}</div>
      )}
    </div>
  );
};

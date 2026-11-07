import { useEffect, useRef, useState } from "react";
import type { Project, Scene, Timeline } from "../../remotion/src/types";
import { reviewSummary, sceneHash, sceneReviewState, scriptHash, type SceneReviewState } from "./review";

type Props = {
  project: Project;
  timeline: Timeline; // preview timeline: real durations where voiced, estimates elsewhere
  stale: Set<string>;
  user: string;
  onChange: (p: Project) => void;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

// Every `cue` word anywhere in the scene (shot labels, diagram notes, portraits…).
const cuesOf = (scene: Scene) => {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if ((k === "cue" || k === "until") && typeof x === "string") out.add(norm(x));
        else walk(x);
      }
  };
  walk({ ...scene, visual: undefined });
  return [...out].filter(Boolean);
};

// On-screen words: title, labels, cards, stats, steps… (not image prompts or credits).
const labelsOf = (scene: Scene) => {
  const out: string[] = [];
  const add = (t: unknown) => typeof t === "string" && t.trim() && !out.includes(t.trim()) && out.push(t.trim());
  [scene.onScreenText, scene.name, scene.realName, scene.tag].forEach(add);
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (["text", "label", "kicker", "question", "subtitle"].includes(k) || (k === "title" && typeof x === "string")) add(x);
        else if (!["src", "stages", "photo", "image", "color", "sound"].includes(k)) walk(x);
      }
  };
  walk({ ...scene, visual: undefined, narration: undefined, ttsText: undefined, onScreenText: undefined, name: undefined });
  return out;
};

const Narration: React.FC<{ text: string; cues: string[] }> = ({ text, cues }) => (
  <p className="script-text">
    {text.split(/(\s+)/).map((w, i) =>
      cues.some((c) => norm(w).startsWith(c) && norm(w)) ? <mark key={i} title="Cue: something appears on this word">{w}</mark> : w,
    )}
  </p>
);

const STATE_LABEL: Record<SceneReviewState, string> = {
  pending: "Not reviewed",
  approved: "Approved",
  changes: "Change requested",
  edited: "Edited since review",
};

export const ScriptPanel: React.FC<Props> = ({ project, timeline, stale, user, onChange }) => {
  const [editing, setEditing] = useState<string | null>(null); // scene id with the comment box open
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const durations = new Map(timeline.scenes.map((t) => [t.id, t.duration + (t.hold ?? 0)]));
  const total = [...durations.values()].reduce((a, b) => a + b, 0);
  const words = project.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
  const summary = reviewSummary(project);
  const review = project.review ?? {};
  const now = () => new Date().toISOString();

  const setScene = (scene: Scene, status: "approved" | "changes" | null, comment?: string) => {
    const scenes = { ...review.scenes };
    if (status) scenes[scene.id] = { status, hash: sceneHash(scene), at: now(), ...(comment ? { comment } : {}) };
    else delete scenes[scene.id];
    // A change request (or clearing a scene) withdraws the whole-script approval.
    const { approvedAt, approvedBy, scriptHash: h, ...rest } = review;
    onChange({ ...project, review: status === "approved" ? { ...review, scenes } : { ...rest, scenes } });
  };

  const approveScript = () => {
    const scenes = { ...review.scenes };
    for (const s of project.scenes)
      if (sceneReviewState(project, s) !== "approved") scenes[s.id] = { status: "approved", hash: sceneHash(s), at: now() };
    onChange({ ...project, review: { scenes, approvedAt: now(), approvedBy: user, scriptHash: scriptHash(project) } });
  };
  const revoke = () => {
    const { approvedAt, approvedBy, scriptHash: h, ...rest } = review;
    onChange({ ...project, review: rest });
  };

  const play = (id: string, src: string) => {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const a = new Audio(`/${src}`);
    a.onended = () => setPlaying(null);
    a.play();
    audio.current = a;
    setPlaying(id);
  };

  let start = 0;
  return (
    <section className="script" aria-label="Script">
      <div className={`script-summary ${summary.state}`}>
        <div>
          <div className="script-stats">
            <strong>{fmt(total)}</strong> {stale.size ? "est. " : ""}total · {words} words · {project.scenes.length} scenes ·{" "}
            {summary.approved}/{summary.total} approved
            {summary.changes > 0 && <span className="warn-text"> · {summary.changes} change{summary.changes > 1 ? "s" : ""} requested</span>}
          </div>
          {summary.state === "approved" && (
            <div className="muted small">
              Approved by {review.approvedBy} · {new Date(review.approvedAt!).toLocaleString()} · version <code>{review.scriptHash}</code>
            </div>
          )}
          {summary.state === "stale" && (
            <div className="warn-text small">
              Narration changed after {review.approvedBy} approved it ({new Date(review.approvedAt!).toLocaleString()}). Re-approve when it reads right.
            </div>
          )}
        </div>
        <div className="actions">
          {(summary.state === "approved" || summary.state === "stale") && (
            <button className="btn small ghost" onClick={revoke}>Revoke</button>
          )}
          {summary.state !== "approved" && (
            <button
              className="btn primary"
              onClick={approveScript}
              disabled={summary.changes > 0}
              title={summary.changes ? "Resolve the requested changes first" : "Approves every scene and records this version of the script"}
            >
              {summary.state === "stale" ? "Re-approve script" : "Approve script"}
            </button>
          )}
        </div>
      </div>

      {project.scenes.map((scene, i) => {
        const d = durations.get(scene.id) ?? 0;
        const at = start;
        start += d;
        const state = sceneReviewState(project, scene);
        const r = review.scenes?.[scene.id];
        const t = timeline.scenes.find((x) => x.id === scene.id);
        const labels = labelsOf(scene);
        return (
          <article key={scene.id} className={`script-scene ${state}`}>
            <header className="script-scene-head">
              <span className="script-num">{i + 1}</span>
              <span className="script-name">{scene.name || scene.kind}</span>
              <span className="muted small">{scene.kind} · {fmt(at)} · {stale.has(scene.id) ? "~" : ""}{d.toFixed(1)}s</span>
              {t?.audio && !stale.has(scene.id) && (
                <button className="btn ghost small play" onClick={() => play(scene.id, t.audio!)} aria-label={playing === scene.id ? "Stop" : "Play voice"}>
                  {playing === scene.id ? "■ Stop" : "▶ Play"}
                </button>
              )}
              <span className={`review-state ${state}`}>{STATE_LABEL[state]}</span>
            </header>
            {scene.narration.trim() ? <Narration text={scene.narration} cues={cuesOf(scene)} /> : <p className="muted script-text silent">(no narration)</p>}
            {labels.length > 0 && <p className="script-labels">On screen: {labels.join(" · ")}</p>}
            {r?.comment && (state === "changes" || state === "edited") && (
              <p className={`script-comment ${state}`}>
                {state === "edited" ? "Earlier request: " : ""}“{r.comment}”
              </p>
            )}
            {editing === scene.id ? (
              <div className="script-request">
                <textarea
                  autoFocus
                  rows={2}
                  placeholder="What should change?"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Change request"
                />
                <div className="actions">
                  <button className="btn small" onClick={() => setEditing(null)}>Cancel</button>
                  <button className="btn small primary" disabled={!draft.trim()} onClick={() => { setScene(scene, "changes", draft.trim()); setEditing(null); }}>
                    Request change
                  </button>
                </div>
              </div>
            ) : (
              <div className="script-actions">
                {state !== "approved" && <button className="btn small" onClick={() => setScene(scene, "approved")}>✓ Approve</button>}
                <button className="btn small ghost" onClick={() => { setDraft(r?.status === "changes" ? r.comment ?? "" : ""); setEditing(scene.id); }}>
                  {state === "changes" ? "Edit request" : "Request change"}
                </button>
                {state !== "pending" && <button className="btn small ghost" onClick={() => setScene(scene, null)}>Clear</button>}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};

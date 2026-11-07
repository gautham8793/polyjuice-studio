import { useEffect, useRef, useState } from "react";
import type { Project, Scene, Timeline } from "../../remotion/src/types";
import { memberSceneState, reviewSummary, sceneReviewState, type ReviewFile, type SceneReviewState } from "./review";
import { canApproveScript, type Member, type Team } from "./team";

type Props = {
  project: Project;
  timeline: Timeline; // preview timeline: real durations where voiced, estimates elsewhere
  stale: Set<string>;
  review: ReviewFile;
  team: Team;
  me: Member | null;
  members: Member[];
  onReview: (scene: string, status: "approved" | "changes" | null, comment?: string) => void;
  onApprove: (approve: boolean) => void;
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

export const ScriptPanel: React.FC<Props> = ({ project, timeline, stale, review, team, me, members, onReview, onApprove }) => {
  const [editing, setEditing] = useState<string | null>(null); // scene id with the comment box open
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const durations = new Map(timeline.scenes.map((t) => [t.id, t.duration + (t.hold ?? 0)]));
  const total = [...durations.values()].reduce((a, b) => a + b, 0);
  const words = project.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
  const summary = reviewSummary(project, review);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const ownerName = team.owner ? name(team.owner) : null;
  const mayApprove = canApproveScript(me, team);
  const approval = review.approval;

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
          {summary.state === "approved" && approval && (
            <div className="muted small">
              Approved by {name(approval.by)} · {new Date(approval.at).toLocaleString()} · version <code>{approval.scriptHash}</code>
            </div>
          )}
          {summary.state === "stale" && approval && (
            <div className="warn-text small">
              Narration changed after {name(approval.by)} approved it ({new Date(approval.at).toLocaleString()}). The owner re-approves when it reads right.
            </div>
          )}
          {!mayApprove && summary.state !== "approved" && (
            <div className="muted small">{ownerName ? `${ownerName} owns this video and approves the script.` : "No owner yet: an admin approves the script."}</div>
          )}
        </div>
        {mayApprove && (
          <div className="actions">
            {approval && <button className="btn small ghost" onClick={() => onApprove(false)}>Revoke</button>}
            {summary.state !== "approved" && (
              <button
                className="btn primary"
                onClick={() => onApprove(true)}
                disabled={summary.changes > 0}
                title={summary.changes ? "Resolve the requested changes first" : "Approves every scene and records this version of the script"}
              >
                {summary.state === "stale" ? "Re-approve script" : "Approve script"}
              </button>
            )}
          </div>
        )}
      </div>

      {project.scenes.map((scene, i) => {
        const d = durations.get(scene.id) ?? 0;
        const at = start;
        start += d;
        const state = sceneReviewState(review, scene);
        const mine: SceneReviewState = me ? memberSceneState(review, scene, me.id) : "pending";
        const myReview = me ? review.scenes[scene.id]?.[me.id] : undefined;
        const others = Object.entries(review.scenes[scene.id] ?? {});
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
            {others.length > 0 && (
              <div className="reviewers">
                {others.map(([id, r]) => {
                  const st = memberSceneState(review, scene, id);
                  return (
                    <div key={id} className={`reviewer ${st}`}>
                      <span className="reviewer-name">{st === "approved" ? "✓" : st === "changes" ? "✎" : "↻"} {name(id)}</span>
                      {r.comment && (st === "changes" || st === "edited") && (
                        <span className="reviewer-comment">{st === "edited" ? "earlier: " : ""}“{r.comment}”</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!me ? null : editing === scene.id ? (
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
                  <button className="btn small primary" disabled={!draft.trim()} onClick={() => { onReview(scene.id, "changes", draft.trim()); setEditing(null); }}>
                    Request change
                  </button>
                </div>
              </div>
            ) : (
              <div className="script-actions">
                {mine !== "approved" && <button className="btn small" onClick={() => onReview(scene.id, "approved")}>✓ Approve</button>}
                <button className="btn small ghost" onClick={() => { setDraft(myReview?.status === "changes" ? myReview.comment ?? "" : ""); setEditing(scene.id); }}>
                  {mine === "changes" ? "Edit my request" : "Request change"}
                </button>
                {mine !== "pending" && <button className="btn small ghost" onClick={() => onReview(scene.id, null)}>Clear mine</button>}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};

import { useEffect, useMemo, useState } from "react";
import type { Project, Publish } from "../../remotion/src/types";
import { api, type MusicTrack, type RenderJob } from "./api";
import { InstagramPublish } from "./InstagramPublish";
import { buildPublish, LIMITS } from "./publish";

type Props = {
  project: Project;
  research: string | null;
  slug: string;
  job: RenderJob;
  onChange: (project: Project) => void;
  onPublished: () => void;
};

const Copy: React.FC<{ text: string; label?: string }> = ({ text, label = "Copy" }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn small"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
};

const Counter: React.FC<{ n: number; max: number }> = ({ n, max }) => (
  <span className={`counter ${n > max ? "over" : ""}`}>{n}/{max}</span>
);

// A collapsible card: the header shows the section name and a one-line status, the body opens on click.
const Accordion: React.FC<{ title: string; status?: React.ReactNode; defaultOpen?: boolean; tone?: "warn"; children: React.ReactNode }> = ({
  title,
  status,
  defaultOpen = false,
  tone,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={`card accordion ${tone === "warn" ? "warn-card" : ""}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <h3>{title}</h3>
        {status && <span className="accordion-status">{status}</span>}
        <span className="chevron" aria-hidden="true">▾</span>
      </summary>
      <div className="accordion-body">{children}</div>
    </details>
  );
};

// A list typed as text ("#a #b", "x, y"): keeps exactly what's typed while the list updates, so
// separators don't vanish mid-word. Resets when another video is opened.
const ListInput: React.FC<{ value: string[]; join: string; split: RegExp; multiline?: boolean; slug: string; onChange: (v: string[]) => void }> = ({
  value,
  join,
  split,
  multiline,
  slug,
  onChange,
}) => {
  const [draft, setDraft] = useState(value.join(join));
  useEffect(() => setDraft(value.join(join)), [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (v: string) => {
    setDraft(v);
    onChange(v.split(split).map((x) => x.trim()).filter(Boolean));
  };
  return multiline ? <textarea rows={3} value={draft} onChange={(e) => update(e.target.value)} /> : <input value={draft} onChange={(e) => update(e.target.value)} />;
};

export const PublishPanel: React.FC<Props> = ({ project, research, slug, job, onChange, onPublished }) => {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  useEffect(() => {
    api.listMusic().then(setTracks);
  }, []);

  const publish: Publish = project.publish ?? { title: project.title, description: "", hashtags: [] };
  const set = (patch: Partial<Publish>) => onChange({ ...project, publish: { ...publish, ...patch } });

  const track = tracks.find((t) => t.path === project.music?.track);
  const text = useMemo(
    () => buildPublish(project, research, track ? { title: track.title, attribution: track.attribution, artist: track.artist } : null),
    [project, research, track],
  );
  const exported = job?.status === "done" && job.folder;
  const tagsText = (publish.tags ?? []).join(", ");

  return (
    <div className="publish">
      {text.warnings.length > 0 && (
        <section className="card warn-card">
          <h3>Before you post</h3>
          <ul>{text.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}

      <Accordion
        title="YouTube"
        defaultOpen
        status={
          <>
            title <Counter n={publish.title.length} max={LIMITS.youtubeTitle} /> · description <Counter n={text.youtubeDescription.length} max={LIMITS.youtubeDescription} /> · tags{" "}
            <Counter n={tagsText.length} max={LIMITS.tags} />
          </>
        }
      >
        <label>
          <span className="label-row">
            <span>Title <Counter n={publish.title.length} max={LIMITS.youtubeTitle} /></span>
            <Copy text={text.youtubeTitle} />
          </span>
          <input value={publish.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          <span>
            Description <Counter n={publish.description.length} max={3000} />
            <em className="muted"> · hook, summary, key facts, glossary, FAQ. Sources, credits and hashtags are added below it</em>
          </span>
          <textarea rows={12} value={publish.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label>
          <span>Hashtags <em className="muted">· 5–8, space or comma separated</em></span>
          <ListInput slug={slug} value={publish.hashtags} join=" " split={/[\s,]+/} onChange={(hashtags) => set({ hashtags })} />
        </label>
        <label>
          <span className="label-row">
            <span>Tags <Counter n={tagsText.length} max={LIMITS.tags} /> <em className="muted">· YouTube Studio's Tags field, comma separated</em></span>
            <Copy text={text.tags} />
          </span>
          <ListInput slug={slug} value={publish.tags ?? []} join=", " split={/,/} multiline onChange={(tags) => set({ tags })} />
        </label>
        <label>
          <span className="label-row">
            <span>Pinned comment <em className="muted">· one question to pin under the video</em></span>
            <Copy text={text.pinnedComment} />
          </span>
          <input value={publish.pinnedComment ?? ""} onChange={(e) => set({ pinnedComment: e.target.value })} />
        </label>
        <details className="as-posted">
          <summary>As posted · description with sources, credits and hashtags</summary>
          <div className="card-head">
            <Counter n={text.youtubeDescription.length} max={LIMITS.youtubeDescription} />
            <Copy text={text.youtubeDescription} label="Copy description" />
          </div>
          <pre className="post-text">{text.youtubeDescription}</pre>
        </details>
      </Accordion>

      <Accordion title="Instagram Reels" status={<>caption <Counter n={text.instagramCaption.length} max={LIMITS.instagramCaption} /></>}>
        <div className="card-head">
          <span className="muted small">Same description, with sources and credits as names only (no links)</span>
          <Copy text={text.instagramCaption} label="Copy caption" />
        </div>
        <pre className="post-text">{text.instagramCaption}</pre>
        <InstagramPublish slug={slug} render={job} onPublished={onPublished} />
      </Accordion>

      <Accordion title="Export package" status={exported ? "Exported" : job?.status === "running" ? "Exporting…" : "Not exported yet"}>
        {exported && (
          <div className="row end">
            <button className="btn small" onClick={() => api.reveal(slug)}>Open folder</button>
          </div>
        )}
        {exported ? (
          <div className="export-row">
            <img className="cover" src={`/${job!.folder}/cover.png?t=${job!.output?.split("t=")[1] ?? ""}`} alt="Cover frame" />
            <div className="small">
              <p>Saved to <code>{job!.folder}/</code></p>
              <ul className="files">
                <li><a href={job!.output} target="_blank" rel="noreferrer">{slug}.mp4</a> — the video</li>
                <li>cover.png — cover frame for Reels / Shorts</li>
                <li>youtube.txt · instagram.txt · tags.txt · pinned-comment.txt — ready to paste</li>
                <li>metadata.json — everything above, for later automation</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="muted small">
            {job?.status === "running"
              ? `${job.stage}${job.stage === "Rendering video" ? ` ${Math.round(job.progress * 100)}%` : "…"}`
              : "Click “Export” at the top to render the video, cover and texts into out/" + slug + "/."}
          </p>
        )}
      </Accordion>
    </div>
  );
};

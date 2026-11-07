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

  return (
    <div className="publish">
      <section className="card">
        <h3>Post details</h3>
        <label>
          <span>Title <Counter n={publish.title.length} max={LIMITS.youtubeTitle} /></span>
          <input value={publish.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          <span>Opening lines <em className="muted">· the hook for the description and caption</em></span>
          <textarea rows={3} value={publish.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label>
          <span>Hashtags <em className="muted">· space or comma separated, 3–5 work best</em></span>
          <input
            value={publish.hashtags.join(" ")}
            onChange={(e) => set({ hashtags: e.target.value.split(/[\s,]+/).filter(Boolean) })}
          />
        </label>
        <p className="muted small">The countdown, sources (from research.md) and image/music credits are added automatically.</p>
      </section>

      {text.warnings.length > 0 && (
        <section className="card warn-card">
          <h3>Before you post</h3>
          <ul>{text.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3>YouTube Shorts</h3>
          <div className="row">
            <Copy text={text.youtubeTitle} label="Copy title" />
            <Copy text={text.youtubeDescription} label="Copy description" />
          </div>
        </div>
        <p className="post-title">{text.youtubeTitle}</p>
        <pre className="post-text">{text.youtubeDescription}</pre>
        <Counter n={text.youtubeDescription.length} max={LIMITS.youtubeDescription} />
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Instagram Reels</h3>
          <Copy text={text.instagramCaption} label="Copy caption" />
        </div>
        <pre className="post-text">{text.instagramCaption}</pre>
        <Counter n={text.instagramCaption.length} max={LIMITS.instagramCaption} />
        <InstagramPublish slug={slug} render={job} onPublished={onPublished} />
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Export package</h3>
          {exported && <button className="btn small" onClick={() => api.reveal(slug)}>Open folder</button>}
        </div>
        {exported ? (
          <div className="export-row">
            <img className="cover" src={`/${job!.folder}/cover.png?t=${job!.output?.split("t=")[1] ?? ""}`} alt="Cover frame" />
            <div className="small">
              <p>Saved to <code>{job!.folder}/</code></p>
              <ul className="files">
                <li><a href={job!.output} target="_blank" rel="noreferrer">{slug}.mp4</a> — the video</li>
                <li>cover.png — cover frame for Reels / Shorts</li>
                <li>youtube.txt · instagram.txt — ready to paste</li>
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
      </section>
    </div>
  );
};

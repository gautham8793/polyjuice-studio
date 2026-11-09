import { useEffect, useState } from "react";
import { api, type PublishPreflight, type RenderJob } from "./api";

type Props = {
  slug: string;
  render: RenderJob; // re-check when an Export finishes
  onPublished: () => void;
};

// Render & Publish (DEC-15 step 4): one checklist, the exported video to watch, and one confirmed
// Publish that sends it to YouTube (private) and/or Instagram, records the links and syncs.
export const PublishCard: React.FC<Props> = ({ slug, render, onPublished }) => {
  const [pre, setPre] = useState<PublishPreflight | null>(null);
  const [toYoutube, setToYoutube] = useState(true);
  const [toInstagram, setToInstagram] = useState(true);
  const [again, setAgain] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => api.publishPreflight(slug).then(setPre, (e) => setError(String(e.message ?? e)));
  useEffect(() => {
    setConfirming(false);
    setError(null);
    setAgain(false);
    load();
  }, [slug, render?.status]);

  const running = pre?.job?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(async () => {
      const p = await api.publishPreflight(slug);
      setPre(p);
      if (p.job?.status === "done") onPublished();
    }, 1500);
    return () => window.clearInterval(t);
  }, [slug, running]);

  if (!pre) return <p className="muted small">{error ?? "Checking…"}</p>;

  const yt = pre.youtube;
  const ig = pre.instagram;
  const ytReady = yt.status.connected && yt.status.ok;
  const sendYoutube = toYoutube && ytReady && (!yt.published || again);
  const sendInstagram = toInstagram && ig.ready && (!ig.published || again);
  const job = pre.job;

  const publish = async () => {
    setError(null);
    try {
      await api.publish(slug, { youtube: sendYoutube, instagram: sendInstagram, again });
      setConfirming(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="publish-card">
      <ul className="checklist">
        {pre.checks.map((c) => (
          <li key={c.id} className={c.ok ? "ok" : "todo"}>
            <span aria-hidden>{c.ok ? "✓" : "○"}</span> {c.label}
            {!c.ok && <span className="muted small"> — {c.detail}</span>}
          </li>
        ))}
      </ul>

      {pre.preview && (
        <div className="publish-preview">
          <video src={pre.preview.url} controls preload="metadata" className={pre.preview.format === "long-16x9" ? "wide" : "tall"} />
          {pre.text && (
            <div className="publish-text">
              <strong>{pre.text.title}</strong>
              <p className="muted small">{pre.text.description.split("\n").slice(0, 3).join(" ")}…</p>
              <p className="muted small">
                {pre.text.tags.split(",").filter((t) => t.trim()).length} tags · {pre.preview.seconds ?? "?"} s · {pre.preview.sizeMb ?? "?"} MB
              </p>
              {pre.text.pinnedComment && (
                <p className="small">
                  Pin this comment after posting: “{pre.text.pinnedComment}”{" "}
                  <button className="link inline small" onClick={() => navigator.clipboard.writeText(pre.text!.pinnedComment).then(() => setCopied(true))}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="destinations">
        <label className={`destination ${ytReady ? "" : "off"}`}>
          <input type="checkbox" checked={toYoutube && ytReady} disabled={!ytReady || running} onChange={(e) => setToYoutube(e.target.checked)} />
          <span>
            <strong>YouTube</strong> <span className="muted small">(uploads as Private)</span>
            {!yt.status.configured && <span className="note muted small">Set up the Google OAuth client first (Connections).</span>}
            {yt.status.configured && !yt.status.connected && <span className="note muted small">Connect YouTube under Channel &amp; captions → Connections.</span>}
            {yt.status.connected && !yt.status.ok && <span className="note warn-text small">Reconnect YouTube: {yt.status.error}</span>}
            {yt.published && (
              <span className="note small">
                Already uploaded {new Date(yt.published.at).toLocaleDateString()}
                {yt.published.url && <> · <a href={yt.published.url} target="_blank" rel="noreferrer">open</a></>}
              </span>
            )}
          </span>
        </label>
        <label className={`destination ${ig.ready ? "" : "off"}`}>
          <input type="checkbox" checked={toInstagram && ig.ready} disabled={!ig.ready || running} onChange={(e) => setToInstagram(e.target.checked)} />
          <span>
            <strong>Instagram</strong> {ig.account && <span className="muted small">{ig.account}</span>}
            {ig.blockers.map((b) => <span key={b} className="note warn-text small">{b}</span>)}
            {ig.published && (
              <span className="note small">
                Already posted {new Date(ig.published.at).toLocaleDateString()}
                {ig.published.url && <> · <a href={ig.published.url} target="_blank" rel="noreferrer">open</a></>}
              </span>
            )}
          </span>
        </label>
        {(yt.published || ig.published) && (
          <label className="again small">
            <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} disabled={running} /> Upload again (makes a second copy)
          </label>
        )}
      </div>

      {job?.status === "running" && (
        <div className="publish-progress small" aria-live="polite">
          <span className="spinner" /> {job.stage}
          {job.progress !== null && ` · ${Math.round(job.progress * 100)}%`}
          {job.progress !== null && (
            <span className="sync-bar">
              <span style={{ width: `${Math.round(job.progress * 100)}%` }} />
            </span>
          )}
        </div>
      )}
      {job?.status === "done" && (
        <p className="small">
          <span className="ok-text">Published ✓</span>
          {job.youtube?.url && <> · <a href={job.youtube.url} target="_blank" rel="noreferrer">YouTube (private: make it public in Studio)</a></>}
          {job.instagram?.url && <> · <a href={job.instagram.url} target="_blank" rel="noreferrer">Instagram</a></>}
        </p>
      )}
      {job?.status === "error" && <p className="warn-text small">Publishing stopped: {job.error}</p>}
      {job?.warnings.map((w) => <p key={w} className="warn-text small">{w}</p>)}
      {error && <p className="warn-text small">{error}</p>}

      {!running && (confirming ? (
        <div className="confirm-box">
          <p className="small">
            Publish now to {[sendYoutube && "YouTube (private)", sendInstagram && "Instagram"].filter(Boolean).join(" and ")}? You've watched the video above and approve it.
          </p>
          <div className="actions">
            <button className="btn small" onClick={() => setConfirming(false)}>Cancel</button>
            <button className="btn small primary" onClick={publish}>Publish now</button>
          </div>
        </div>
      ) : (
        <button
          className="btn primary"
          disabled={!pre.ready || !(sendYoutube || sendInstagram)}
          onClick={() => setConfirming(true)}
          title={pre.ready ? undefined : "Finish the checklist first"}
        >
          Publish…
        </button>
      ))}
    </div>
  );
};

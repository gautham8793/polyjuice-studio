import { useEffect, useState } from "react";
import { api, type InstagramPreflight, type InstagramStatus, type PublishJob, type RenderJob } from "./api";

type Props = {
  slug: string;
  render: RenderJob; // re-check when an Export finishes
  onPublished: () => void;
};

// Posts the Export package (out/<slug>/<slug>.mp4 + instagram.txt) as a Reel, only after an explicit confirm.
export const InstagramPublish: React.FC<Props> = ({ slug, render, onPublished }) => {
  const [account, setAccount] = useState<InstagramStatus | null>(null);
  const [pre, setPre] = useState<InstagramPreflight | null>(null);
  const [job, setJob] = useState<PublishJob | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.instagramStatus().then(setAccount, () => setAccount({ connected: false }));
  }, []);

  useEffect(() => {
    setConfirming(false);
    setError(null);
    api.instagramPreflight(slug).then((p) => {
      setPre(p);
      setJob(p.job);
    }, (e) => setError(String(e.message ?? e)));
  }, [slug, render?.status]);

  // Poll while publishing.
  useEffect(() => {
    if (job?.status !== "running") return;
    const t = window.setInterval(async () => {
      const p = await api.instagramPreflight(slug);
      setPre(p);
      setJob(p.job);
      if (p.job?.status === "done") onPublished();
    }, 2000);
    return () => window.clearInterval(t);
  }, [slug, job?.status]);

  const publish = async () => {
    setError(null);
    try {
      setJob(await api.publishInstagram(slug, !!pre?.published));
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!pre || !account) return <p className="muted small">Checking Instagram…</p>;

  const handle = account.connected ? `@${account.username}` : null;
  const blocked = !account.connected || (account.connected && (!account.ok || !account.canUpload || account.missingScopes.length > 0)) || !pre.ready;

  return (
    <div className="ig-publish">
      {job?.status === "running" && <p className="small"><span className="spinner" /> {job.stage}…</p>}
      {job?.status === "error" && <p className="warn-text small">Couldn't post: {job.error}</p>}

      {pre.published && job?.status !== "running" && (
        <p className="small">
          <span className="ok-text">Posted ✓</span> {new Date(pre.published.at).toLocaleString()} ·{" "}
          <a href={pre.published.url} target="_blank" rel="noreferrer">View on Instagram</a>
        </p>
      )}

      {!account.connected && <p className="muted small">Connect Instagram under Channel &amp; captions → Connections to post from here.</p>}
      {account.connected && !account.ok && <p className="warn-text small">Instagram needs reconnecting: {account.error}</p>}
      {account.connected && account.ok && !account.canUpload && (
        <p className="warn-text small">Posting needs the private video bucket. See Channel &amp; captions → Connections.</p>
      )}
      {pre.blockers.length > 0 && <ul className="warn-text small">{pre.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}

      {job?.status !== "running" && !confirming && (
        <div className="row">
          <button className={`btn small ${pre.published ? "" : "primary"}`} disabled={blocked} onClick={() => setConfirming(true)}>
            {pre.published ? "Post again…" : "Publish to Instagram…"}
          </button>
          {handle && <span className="muted small">as {handle}</span>}
        </div>
      )}

      {confirming && (
        <div className="confirm-box">
          <strong>Post this Reel to {handle} now?</strong>
          <p className="muted small">
            {slug}.mp4 · {pre.seconds} s · {pre.sizeMb} MB · exported {pre.exportedAt ? new Date(pre.exportedAt).toLocaleString() : ""}.
            Cover: the same frame as cover.png. It also appears on your profile grid. This can't be undone from here.
          </p>
          {pre.warnings.length > 0 && <ul className="warn-text small">{pre.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <span className="small muted">Caption (from out/{slug}/instagram.txt):</span>
          <pre className="post-text">{pre.caption}</pre>
          <div className="row">
            <button className="btn small primary" onClick={publish}>{pre.published ? "Yes, post it again" : "Post now"}</button>
            <button className="btn small ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="warn-text small">{error}</p>}
    </div>
  );
};

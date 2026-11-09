import { useState } from "react";
import { api, type SyncReport, type SyncStatus } from "./api";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
};

export const summarize = (r: SyncReport) => {
  const parts = [
    r.committed ? "sent your changes" : "",
    r.pulled ? `received ${r.pulled} update${r.pulled > 1 ? "s" : ""}` : "",
    r.uploaded ? `uploaded ${r.uploaded} media file${r.uploaded > 1 ? "s" : ""}` : "",
    r.downloaded ? `downloaded ${r.downloaded} media file${r.downloaded > 1 ? "s" : ""}` : "",
    r.removed ? `removed ${r.removed} deleted file${r.removed > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Already up to date";
};

// Sidebar: one button that exchanges work with the team, and how fresh this computer is.
export const SyncButton: React.FC<{
  status: SyncStatus | null;
  onStart: () => Promise<void>; // save pending edits first
  onDone: (r: SyncReport | null, error?: string) => void;
}> = ({ status, onStart, onDone }) => {
  const [busy, setBusy] = useState(false);
  if (!status?.configured) return null;
  const run = async () => {
    setBusy(true);
    try {
      await onStart();
      onDone(await api.runSync());
    } catch (e) {
      onDone(null, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const waiting = (status.behind ?? 0) > 0;
  return (
    <button className={`sync-button ${waiting || status.pending ? "attention" : ""}`} onClick={run} disabled={busy || status.running}>
      <span className={`sync-icon ${busy ? "spin" : ""}`} aria-hidden>⟳</span>
      <span>{busy ? "Syncing…" : "Sync"}</span>
      <span className="muted small">
        {waiting ? `${status.behind} new from the team · ` : ""}
        {status.pending ? `${status.pending} to send · ` : ""}
        {status.remote ? `synced ${ago(status.lastSyncedAt)}` : "no shared repo yet"}
      </span>
    </button>
  );
};

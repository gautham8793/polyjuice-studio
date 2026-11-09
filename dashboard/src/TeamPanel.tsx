import { useEffect, useState } from "react";
import { api, type SyncStatus } from "./api";
import { ACTIVITY_TEXT, hasRole, type Activity, type Member, type Role } from "./team";

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "admin", label: "Admin", hint: "manages members; can approve videos without an owner" },
  { id: "publisher", label: "Publisher", hint: "renders and publishes" },
  { id: "editor", label: "Editor", hint: "owns and edits videos" },
  { id: "reviewer", label: "Reviewer", hint: "comments and approves scenes" },
];

const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
};

const idFrom = (name: string, taken: string[]) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
};

// First run on a computer: which member is this?
export const WhoAreYou: React.FC<{ members: Member[]; onPick: (id: string) => void }> = ({ members, onPick }) => (
  <div className="modal-backdrop">
    <div className="modal team-modal" role="dialog" aria-label="Who are you?">
      <h2>Who are you?</h2>
      <p className="muted">Reviews, approvals and activity on this computer are recorded under your name.</p>
      <div className="who-list">
        {members.map((m) => (
          <button key={m.id} className="btn" onClick={() => onPick(m.id)}>
            <span className="avatar">{m.name.slice(0, 1)}</span> {m.name}
          </button>
        ))}
      </div>
      <p className="muted small">Not listed? Ask an admin to add you under Team &amp; activity.</p>
    </div>
  </div>
);

type Props = {
  sync: SyncStatus | null;
  onSyncChanged: () => void;
  me: Member | null;
  members: Member[];
  titles: Record<string, string>;
  onMembers: (m: Member[]) => void;
  onSwitch: (id: string) => void;
  onOpenProject: (slug: string) => void;
  onClose: () => void;
};

export const TeamPanel: React.FC<Props> = ({ sync, onSyncChanged, me, members, titles, onMembers, onSwitch, onOpenProject, onClose }) => {
  const [remote, setRemote] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [storeTest, setStoreTest] = useState<string | null>(null);
  const testStore = async () => {
    setStoreTest("Testing…");
    const r = await api.testStore().catch((e) => ({ ok: false, store: null, steps: [String(e)] }));
    setStoreTest(`${r.ok ? "✓ Works" : "✗ Failed"}: ${r.steps.join(" · ")}`);
  };
  const setupSync = async (join: boolean) => {
    setError(null);
    setSyncBusy(true);
    try {
      if (join) await api.joinSync(remote.trim());
      else await api.initSync(remote.trim() || undefined);
      setRemote("");
      onSyncChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncBusy(false);
    }
  };
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [draft, setDraft] = useState<Member[]>(members);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isAdmin = hasRole(me, "admin");
  const dirty = JSON.stringify(draft) !== JSON.stringify(members);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  useEffect(() => {
    api.activity(undefined, 60).then(setActivity).catch(() => setActivity([]));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const toggleRole = (id: string, role: Role) =>
    setDraft((d) => d.map((m) => (m.id === id ? { ...m, roles: m.roles.includes(role) ? m.roles.filter((r) => r !== role) : [...m.roles, role] } : m)));

  const save = async () => {
    setError(null);
    try {
      onMembers((await api.saveMembers(draft)).members);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal team-modal" role="dialog" aria-label="Team and activity">
        <div className="card-head">
          <h2>Team &amp; activity</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <section>
          <h3>On this computer</h3>
          <label className="who-switch">
            You are
            <select value={me?.id ?? ""} onChange={(e) => onSwitch(e.target.value)} aria-label="Which member you are">
              {!me && <option value="">Pick…</option>}
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </section>

        <section>
          <h3>Sync</h3>
          <p className="small">
            Media store: {sync?.store ? <code>{sync.store}</code> : <span className="warn-text">not set: fill in <code>secrets/r2.json</code></span>}{" "}
            {sync?.store && <button className="link inline small" onClick={testStore}>Test connection</button>}
            {storeTest && <><br /><span className={storeTest.startsWith("✓") ? "" : "warn-text"}>{storeTest}</span></>}
          </p>
          {!sync ? null : sync.configured ? (
            <div className="sync-setup">
              <p className="small">
                Shared repo: {sync.remote ? <code>{sync.remote}</code> : <span className="warn-text">not set: changes stay on this computer</span>}
              </p>
              {!sync.remote && isAdmin && (
                <div className="members-add">
                  <input value={remote} onChange={(e) => setRemote(e.target.value)} placeholder="https://github.com/…/polyjuice-channel.git" aria-label="Shared content repo address" />
                  <button className="btn small" disabled={!remote.trim() || syncBusy} onClick={() => setupSync(false)}>Connect</button>
                </div>
              )}
            </div>
          ) : (
            <div className="sync-setup">
              <p className="muted small">
                {isAdmin
                  ? "Turn this computer's content into the team's shared content (first member only), optionally with the shared repo's address."
                  : "New computer: paste the shared content repo's address to download the team's videos."}
              </p>
              <div className="members-add">
                <input value={remote} onChange={(e) => setRemote(e.target.value)} placeholder="https://github.com/…/polyjuice-channel.git" aria-label="Shared content repo address" />
                {isAdmin && <button className="btn small" disabled={syncBusy} onClick={() => setupSync(false)}>Set up sync</button>}
                <button className="btn small" disabled={!remote.trim() || syncBusy} onClick={() => setupSync(true)}>Join</button>
              </div>
            </div>
          )}
        </section>

        <section>
          <h3>Members</h3>
          <table className="members-table">
            <thead>
              <tr><th>Name</th>{ROLES.map((r) => <th key={r.id} title={r.hint}>{r.label}</th>)}</tr>
            </thead>
            <tbody>
              {draft.map((m) => (
                <tr key={m.id}>
                  <td><span className="avatar">{m.name.slice(0, 1)}</span> {m.name}{m.id === me?.id && <span className="muted"> (you)</span>}</td>
                  {ROLES.map((r) => (
                    <td key={r.id}>
                      <input
                        type="checkbox"
                        checked={m.roles.includes(r.id)}
                        disabled={!isAdmin}
                        onChange={() => toggleRole(m.id, r.id)}
                        aria-label={`${m.name}: ${r.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin ? (
            <div className="members-add">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New member's name"
                aria-label="New member's name"
                onKeyDown={(e) => e.key === "Enter" && newName.trim() && (setDraft((d) => [...d, { id: idFrom(newName, d.map((m) => m.id)), name: newName.trim(), roles: ["editor", "reviewer"] }]), setNewName(""))}
              />
              <button
                className="btn small"
                disabled={!newName.trim()}
                onClick={() => { setDraft((d) => [...d, { id: idFrom(newName, d.map((m) => m.id)), name: newName.trim(), roles: ["editor", "reviewer"] }]); setNewName(""); }}
              >
                Add
              </button>
              <button className="btn small primary" disabled={!dirty} onClick={save}>Save members</button>
            </div>
          ) : (
            <p className="muted small">Only an admin can change members.</p>
          )}
          {error && <p className="warn-text small">{error}</p>}
        </section>

        <section>
          <h3>Recent activity</h3>
          {!activity ? (
            <p className="muted small">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="muted small">Nothing yet. Reviews, approvals, voice, exports and uploads show up here.</p>
          ) : (
            <ul className="activity-list">
              {activity.map((a, i) => (
                <li key={i}>
                  <span className="avatar small">{name(a.by).slice(0, 1)}</span>
                  <span>
                    <strong>{name(a.by)}</strong> {ACTIVITY_TEXT[a.type] ?? a.type}
                    {a.scene && <> ({a.scene})</>}
                    {a.project && <> on <button className="link inline" onClick={() => onOpenProject(a.project!)}>{titles[a.project] ?? a.project}</button></>}
                    {a.type === "team.owner" && a.note && <> → {name(a.note)}</>}
                    {a.type === "project.moved" && a.note && <> → {a.note}</>}
                    {a.type === "review.changes" && a.note && <span className="muted"> — “{a.note}”</span>}
                  </span>
                  <span className="muted small">{ago(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

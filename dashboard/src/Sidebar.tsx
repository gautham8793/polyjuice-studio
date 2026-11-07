import { useEffect, useRef, useState } from "react";
import type { ProjectSummary, Workspace } from "./api";
import type { Member } from "./team";

// Draft → Script approved → Voiced → Exported → Uploaded. All derived except "uploaded".
export type Stage = "draft" | "approved" | "voiced" | "exported" | "uploaded";
export const STAGE_LABEL: Record<Stage, string> = {
  draft: "Draft",
  approved: "Script approved",
  voiced: "Voiced",
  exported: "Exported",
  uploaded: "Uploaded",
};

export const stageOf = (p: ProjectSummary): Stage =>
  p.uploadedAt ? "uploaded"
  : p.exportedAt ? "exported"
  : p.needsVoice === 0 ? "voiced"
  : p.review.state === "approved" ? "approved"
  : "draft";

type View = "all" | "unfiled" | "review" | "uploaded";
const VIEWS: { id: View; label: string; test: (p: ProjectSummary, ws: Workspace) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "unfiled", label: "Unfiled", test: (p, ws) => !ws.projects[p.slug]?.folder },
  { id: "review", label: "Needs review", test: (p) => p.review.state !== "approved" && !p.uploadedAt },
  { id: "uploaded", label: "Uploaded", test: (p) => !!p.uploadedAt },
];

const UNFILED = "";
const stored = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window: UI state just isn't remembered */
  }
};

const folderId = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "folder"}-${Math.random().toString(36).slice(2, 6)}`;

export const setProjectEntry = (ws: Workspace, slug: string, patch: Partial<Workspace["projects"][string]>): Workspace => {
  const entry = { ...ws.projects[slug], ...patch };
  for (const k of Object.keys(entry) as (keyof typeof entry)[]) if (!entry[k]) delete entry[k];
  return { ...ws, projects: { ...ws.projects, [slug]: entry } };
};

type Props = {
  projects: ProjectSummary[];
  workspace: Workspace;
  active: string | null;
  members: Member[];
  onUploaded: (slug: string, uploaded: boolean) => void;
  // Changes are functions of the latest saved workspace, so another tab's edits aren't overwritten.
  onWorkspace: (update: (ws: Workspace) => Workspace) => void;
};

export const Sidebar: React.FC<Props> = ({ projects, workspace: ws, active, members, onUploaded, onWorkspace }) => {
  const [view, setView] = useState<View>(() => stored("sidebar.view", "all"));
  const [collapsed, setCollapsed] = useState<string[]>(() => stored("sidebar.collapsed", []));
  const [menu, setMenu] = useState<{ kind: "project" | "folder"; id: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null); // folder id, or "new"
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => store("sidebar.view", view), [view]);
  useEffect(() => store("sidebar.collapsed", collapsed), [collapsed]);

  const viewTest = VIEWS.find((v) => v.id === view)!.test;
  const shown = projects.filter((p) => viewTest(p, ws));
  const folderOf = (slug: string) => {
    const f = ws.projects[slug]?.folder;
    return f && ws.folders.some((x) => x.id === f) ? f : UNFILED;
  };

  const moveTo = (slug: string, folder: string) => onWorkspace((w) => setProjectEntry(w, slug, { folder: folder || undefined }));
  const createFolder = (name: string, thenMove?: string) => {
    const id = folderId(name);
    onWorkspace((w) => {
      const next: Workspace = { ...w, folders: [...w.folders, { id, name }] };
      return thenMove ? setProjectEntry(next, thenMove, { folder: id }) : next;
    });
  };
  const renameFolder = (id: string, name: string) =>
    onWorkspace((w) => ({ ...w, folders: w.folders.map((f) => (f.id === id ? { ...f, name } : f)) }));
  const deleteFolder = (id: string) => {
    const name = ws.folders.find((f) => f.id === id)?.name;
    if (!confirm(`Delete the folder “${name}”? Its videos move to Unfiled.`)) return;
    onWorkspace((w) => ({
      folders: w.folders.filter((f) => f.id !== id),
      projects: Object.fromEntries(
        Object.entries(w.projects).map(([slug, e]) => [slug, e.folder === id ? { ...e, folder: undefined } : e]),
      ),
    }));
  };


  const groups = [
    ...ws.folders.map((f) => ({ id: f.id, name: f.name })),
    { id: UNFILED, name: "Unfiled" },
  ].filter((g) => view !== "unfiled" || g.id === UNFILED);

  const dropProps = (folder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("text/x-project")) return;
      e.preventDefault();
      setDropTarget(folder);
    },
    onDragLeave: () => setDropTarget((t) => (t === folder ? null : t)),
    onDrop: (e: React.DragEvent) => {
      const slug = e.dataTransfer.getData("text/x-project");
      setDropTarget(null);
      if (slug) moveTo(slug, folder);
    },
  });

  return (
    <>
      <div className="views" role="tablist" aria-label="Views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={`view ${view === v.id ? "active" : ""} ${dropTarget === UNFILED && v.id === "unfiled" ? "drop" : ""}`}
            onClick={() => setView(v.id)}
            {...(v.id === "unfiled" ? dropProps(UNFILED) : {})}
          >
            {v.label}
            <span className="count">{projects.filter((p) => v.test(p, ws)).length}</span>
          </button>
        ))}
      </div>

      <nav className="project-list" aria-label="Projects">
        <div className="folders-head">
          <span>Folders</span>
          <button className="link" onClick={() => setRenaming("new")} aria-label="New folder">+ New folder</button>
        </div>
        {renaming === "new" && (
          <NameInput initial="" onDone={(name) => { setRenaming(null); if (name) createFolder(name); }} />
        )}
        {groups.map((g) => {
          const items = shown.filter((p) => folderOf(p.slug) === g.id);
          const isFolder = g.id !== UNFILED;
          // Empty folders stay visible under "All" (as drop targets); smart views hide them.
          if (!items.length && !(isFolder && view === "all")) return null;
          const open = !collapsed.includes(g.id);
          return (
            <div key={g.id || "unfiled"} className="folder">
              <div className={`folder-head ${dropTarget === g.id ? "drop" : ""}`} {...dropProps(g.id)}>
                {renaming === g.id ? (
                  <NameInput initial={g.name} onDone={(name) => { setRenaming(null); if (name) renameFolder(g.id, name); }} />
                ) : (
                  <button
                    className="folder-toggle"
                    aria-expanded={open}
                    onClick={() => setCollapsed((c) => (open ? [...c, g.id] : c.filter((x) => x !== g.id)))}
                    onDoubleClick={() => isFolder && setRenaming(g.id)}
                  >
                    <span className={`caret ${open ? "open" : ""}`} aria-hidden>▸</span>
                    <span className={isFolder ? "" : "muted"}>{g.name}</span>
                    <span className="count">{items.length}</span>
                  </button>
                )}
                {isFolder && renaming !== g.id && (
                  <Menu
                    open={menu?.kind === "folder" && menu.id === g.id}
                    onOpen={() => setMenu({ kind: "folder", id: g.id })}
                    onClose={() => setMenu(null)}
                    label={`Folder ${g.name} options`}
                  >
                    <button onClick={() => { setMenu(null); setRenaming(g.id); }}>Rename</button>
                    <button className="danger" onClick={() => { setMenu(null); deleteFolder(g.id); }}>Delete folder</button>
                  </Menu>
                )}
              </div>
              {open && items.map((p) => {
                const stage = stageOf(p);
                const owner = members.find((m) => m.id === p.owner);
                return (
                  <div
                    key={p.slug}
                    className={`project-row ${p.slug === active ? "active" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-project", p.slug);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDropTarget(null)}
                  >
                    <a href={`#/${p.slug}`} className="project-link">
                      <span className="project-title">{p.title}</span>
                      <span className="project-meta">
                        <span className={`stage ${stage}`}>{STAGE_LABEL[stage]}</span>
                        <ReviewMark p={p} />
                        <span>{p.format === "long-16x9" ? "16:9" : "9:16"}</span>
                        {owner && members.length > 1 && <span className="owner-chip" title={`Owner: ${owner.name}`}>{owner.name}</span>}
                      </span>
                    </a>
                    <Menu
                      open={menu?.kind === "project" && menu.id === p.slug}
                      onOpen={() => setMenu({ kind: "project", id: p.slug })}
                      onClose={() => setMenu(null)}
                      label={`${p.title} options`}
                    >
                      <div className="menu-label">Move to</div>
                      {[...ws.folders, { id: UNFILED, name: "Unfiled" }].map((f) => (
                        <button key={f.id || "unfiled"} disabled={folderOf(p.slug) === f.id} onClick={() => { setMenu(null); moveTo(p.slug, f.id); }}>
                          {f.name}
                        </button>
                      ))}
                      <button onClick={() => {
                        setMenu(null);
                        const name = prompt("New folder name")?.trim();
                        if (name) createFolder(name, p.slug);
                      }}>New folder…</button>
                      <hr />
                      <button onClick={() => { setMenu(null); onUploaded(p.slug, !p.uploadedAt); }}>
                        {p.uploadedAt ? "Unmark uploaded" : "Mark as uploaded"}
                      </button>
                    </Menu>
                  </div>
                );
              })}
            </div>
          );
        })}
        {!shown.length && <p className="muted small empty-view">Nothing here.</p>}
      </nav>
    </>
  );
};

const ReviewMark: React.FC<{ p: ProjectSummary }> = ({ p }) => {
  const r = p.review;
  if (r.state === "approved") return <span className="review-mark ok" title="Script approved">✓ script</span>;
  if (r.state === "stale") return <span className="review-mark warn" title="Narration changed after the script was approved">edited since approval</span>;
  if (r.state === "changes") return <span className="review-mark warn" title="Changes requested">{r.changes} change{r.changes > 1 ? "s" : ""}</span>;
  if (r.state === "in-progress") return <span className="review-mark" title="Scenes approved">{r.approved}/{r.total} ok</span>;
  return null;
};

const NameInput: React.FC<{ initial: string; onDone: (name: string | null) => void }> = ({ initial, onDone }) => {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name?.trim() || null);
  };
  return (
    <input
      className="folder-name-input"
      autoFocus
      onFocus={(e) => e.target.select()}
      value={value}
      placeholder="Folder name"
      aria-label="Folder name"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value);
        if (e.key === "Escape") finish(null);
      }}
      onBlur={() => finish(value)}
    />
  );
};

const Menu: React.FC<{ open: boolean; onOpen: () => void; onClose: () => void; label: string; children: React.ReactNode }> = ({
  open, onOpen, onClose, label, children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="menu-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? onClose() : onOpen())}>
        ⋯
      </button>
      {open && <div className="menu" role="menu">{children}</div>}
    </div>
  );
};

import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sceneStarts } from "../../remotion/src/templates/SceneVideo";
import type { Brand, Project, Scene } from "../../remotion/src/types";
import { CharactersPanel } from "./CharactersPanel";
import { scenePrompt } from "./prompts";
import { api, type CharacterLibrary, type LoadedProject, type LoadedWorkspace, type ProjectSummary, type RenderJob, type Workspace } from "./api";
import { Preview } from "./Preview";
import { SceneCard } from "./SceneCard";
import { SearchModal } from "./SearchModal";
import { PublishPanel } from "./PublishPanel";
import { SoundPanel } from "./SoundPanel";
import { ChannelPanel } from "./ChannelPanel";
import { ThemePanel } from "./ThemePanel";
import { previewTimeline } from "./timeline";
import { ScriptPanel } from "./ScriptPanel";
import { setProjectEntry, Sidebar, STAGE_LABEL, stageOf } from "./Sidebar";

type SaveState = "saved" | "unsaved" | "saving" | "error";
type Log = { title: string; text: string; ok: boolean } | null;

const slugFromHash = () => decodeURIComponent(location.hash.replace(/^#\/?/, "")) || null;

export const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [slug, setSlug] = useState<string | null>(slugFromHash());
  const [loaded, setLoaded] = useState<LoadedProject | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [searchFor, setSearchFor] = useState<Scene | null>(null);
  const [busy, setBusy] = useState<"validate" | "voice" | null>(null);
  const [render, setRender] = useState<RenderJob>(null);
  const [log, setLog] = useState<Log>(null);
  const [tab, setTab] = useState<"scenes" | "script" | "publish">("scenes");
  const [workspace, setWorkspace] = useState<LoadedWorkspace>({ folders: [], projects: {}, user: "" });
  const [characterLib, setCharacterLib] = useState<CharacterLibrary | null>(null);
  useEffect(() => {
    api.characters().then(setCharacterLib).catch(() => setCharacterLib(null));
    api.getBrand().then(setBrand).catch(() => setBrand(null));
  }, []);
  const player = useRef<PlayerRef>(null);
  const saveTimer = useRef<number>(undefined);

  const refreshList = useCallback(() => api.listProjects().then(setProjects), []);
  useEffect(() => {
    refreshList();
    api.getWorkspace().then(setWorkspace).catch(() => {});
  }, [refreshList]);

  const updateWorkspace = async (update: (ws: Workspace) => Workspace) => {
    setWorkspace((w) => ({ ...w, ...update(w) }));
    try {
      // Apply the change to the file's latest state: another tab or dashboard may have changed it.
      setWorkspace(await api.saveWorkspace(update(await api.getWorkspace())));
    } catch (e) {
      setLog({ title: "Folders", text: `Couldn't save projects/_workspace.json: ${e}`, ok: false });
      api.getWorkspace().then(setWorkspace).catch(() => {});
    }
  };

  useEffect(() => {
    const onHash = () => setSlug(slugFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Open the most recent project if none is selected.
  useEffect(() => {
    if (!slug && projects.length) location.hash = `/${projects[0].slug}`;
  }, [slug, projects]);

  // mtime of project.json when we last loaded/saved it — saves are refused if the file moved on.
  const version = useRef(0);

  const reload = useCallback(async (s: string) => {
    const p = await api.loadProject(s);
    version.current = p.version;
    setLoaded(p);
    setProject(p.project);
    setSaveState("saved");
  }, []);

  // Pick up edits made outside the dashboard (e.g. Claude Code) when the window regains focus.
  useEffect(() => {
    const onFocus = async () => {
      refreshList();
      api.getWorkspace().then(setWorkspace).catch(() => {});
      if (!slug || saveState !== "saved") return;
      const p = await api.loadProject(slug);
      if (p.version !== version.current) reload(slug);
      api.getBrand().then(setBrand).catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [slug, saveState, reload, refreshList]);

  useEffect(() => {
    if (!slug) return;
    setLoaded(null);
    setProject(null);
    setLog(null);
    setRender(null);
    reload(slug);
    api.renderStatus(slug).then(setRender);
  }, [slug, reload]);

  const save = useCallback(async (s: string, p: Project) => {
    setSaveState("saving");
    try {
      version.current = (await api.saveProject(s, p, version.current)).version;
      setSaveState("saved");
      refreshList(); // sidebar status and review badges
    } catch (e) {
      if (e instanceof Error && e.message === "changed-on-disk") {
        await reload(s);
        setLog({
          title: "Reloaded",
          text: "This project was changed outside the dashboard (e.g. by Claude Code), so the latest version was loaded. Re-do your last edit if it's missing.",
          ok: false,
        });
      } else {
        setSaveState("error");
      }
    }
  }, [reload]);

  const updateProject = (next: Project) => {
    setProject(next);
    setSaveState("unsaved");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => slug && save(slug, next), 700);
  };

  const flushSave = async () => {
    window.clearTimeout(saveTimer.current);
    if (slug && project && saveState !== "saved") await save(slug, project);
  };

  const updateScene = (scene: Scene) =>
    project && updateProject({ ...project, scenes: project.scenes.map((s) => (s.id === scene.id ? scene : s)) });

  const preview = useMemo(
    () => (project && loaded ? previewTimeline(project, loaded.timeline) : null),
    [project, loaded],
  );
  const starts = useMemo(() => (preview ? sceneStarts(preview.timeline) : {}), [preview]);

  const focusScene = (id: string) => {
    if (id === activeScene) return;
    setActiveScene(id);
    player.current?.pause();
    // ~0.7s in, so the scene's title and badge have finished animating in
    player.current?.seekTo((starts[id] ?? 0) + 20);
  };

  const runValidate = async () => {
    if (!slug) return;
    await flushSave();
    setBusy("validate");
    try {
      const r = await api.validate(slug);
      setLog({ title: "Check", text: r.log, ok: r.ok });
    } finally {
      setBusy(null);
    }
  };

  const runVoice = async () => {
    if (!slug) return;
    await flushSave();
    setBusy("voice");
    try {
      const r = await api.generateVoice(slug);
      setLog({ title: "Voice + captions", text: r.log, ok: r.ok });
      await reload(slug);
    } catch (e) {
      setLog({ title: "Voice + captions", text: String(e), ok: false });
    } finally {
      setBusy(null);
    }
  };

  const runRender = async () => {
    if (!slug) return;
    await flushSave();
    try {
      setRender(await api.startRender(slug));
    } catch (e) {
      setLog({ title: "Render", text: String(e), ok: false });
    }
  };

  // Poll while a render is running.
  useEffect(() => {
    if (!slug || render?.status !== "running") return;
    const t = window.setInterval(async () => {
      const job = await api.renderStatus(slug);
      setRender(job);
      if (job?.status === "error") setLog({ title: "Render failed", text: job.log, ok: false });
      if (job?.status === "done") refreshList();
    }, 1000);
    return () => window.clearInterval(t);
  }, [slug, render?.status]);

  const assetUpdated = (p: Project, v: number) => {
    version.current = v;
    setProject(p);
    setLoaded((l) => (l ? { ...l, project: p } : l));
    refreshList();
  };

  const stale = new Set(preview?.stale ?? []);
  const filled = project?.scenes.filter((s) => s.kind !== "outro" && s.visual.asset).length ?? 0;
  const total = project?.scenes.filter((s) => s.kind !== "outro").length ?? 0;
  const summary = projects.find((p) => p.slug === slug);
  const stage = summary ? stageOf(summary, workspace) : null;
  const uploadedAt = slug ? workspace.projects[slug]?.uploadedAt : undefined;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="dot" /> Video Studio
        </div>
        <Sidebar projects={projects} workspace={workspace} active={slug} onWorkspace={updateWorkspace} />
        <div className="sidebar-hint">
          New video: ask Claude Code <code>/new-video &lt;topic&gt;</code>
        </div>
      </aside>

      <main className="main">
        {!project || !loaded || !preview ? (
          <div className="empty-state">{projects.length ? "Loading…" : "No projects yet. Run /new-video in Claude Code."}</div>
        ) : (
          <>
            <header className="topbar">
              <div className="title-block">
                <input
                  className="title-input"
                  value={project.title}
                  onChange={(e) => updateProject({ ...project, title: e.target.value })}
                  aria-label="Video title"
                />
                <div className="meta-row">
                  {stage && <span className={`chip stage ${stage}`}>{STAGE_LABEL[stage]}</span>}
                  {summary?.review.state === "approved" && <span className="chip ok">Script approved</span>}
                  {summary?.review.state === "stale" && <span className="chip warn">Script edited since approval</span>}
                  {summary?.review.state === "changes" && (
                    <button className="chip warn as-button" onClick={() => setTab("script")}>
                      {summary.review.changes} script change{summary.review.changes > 1 ? "s" : ""} requested
                    </button>
                  )}
                  <span className="chip">{project.template}</span>
                  <span className="chip">{project.style}</span>
                  <span className="chip">{filled}/{total} images</span>
                  {stale.size > 0 && <span className="chip warn">{stale.size} scene{stale.size > 1 ? "s" : ""} need voice</span>}
                  {(stage === "exported" || stage === "uploaded") && (
                    <button
                      className="link inline small"
                      onClick={() => updateWorkspace((w) => setProjectEntry(w, slug!, { uploadedAt: uploadedAt ? undefined : new Date().toISOString() }))}
                      title={uploadedAt ? `Marked uploaded ${new Date(uploadedAt).toLocaleDateString()}` : undefined}
                    >
                      {uploadedAt ? "Unmark uploaded" : "Mark as uploaded"}
                    </button>
                  )}
                  <span className={`save-state ${saveState}`}>
                    {{ saved: "Saved", unsaved: "Editing…", saving: "Saving…", error: "Save failed" }[saveState]}
                  </span>
                </div>
              </div>
              <div className="actions">
                <button className="btn" onClick={runValidate} disabled={!!busy}>
                  {busy === "validate" ? "Checking…" : "Check"}
                </button>
                <button className={`btn ${stale.size ? "primary" : ""}`} onClick={runVoice} disabled={!!busy}>
                  {busy === "voice" ? "Generating voice…" : "Generate voice"}
                </button>
                <button
                  className={`btn ${stale.size ? "" : "primary"}`}
                  onClick={runRender}
                  disabled={!!busy || render?.status === "running"}
                >
                  {render?.status === "running"
                    ? render.stage === "Rendering video" ? `Rendering ${Math.round(render.progress * 100)}%` : `${render.stage}…`
                    : "Export"}
                </button>
              </div>
            </header>

            {render?.status === "done" && render.output && (
              <div className="banner ok">
                Exported — <a href={render.output} target="_blank" rel="noreferrer">open MP4</a>
                {" · "}
                <button className="link inline" onClick={() => setTab("publish")}>titles &amp; captions</button>
                {" · "}
                <button className="link inline" onClick={() => api.reveal(slug!)}>open folder</button>
                <span className="muted"> · {render.folder}/</span>
              </div>
            )}
            {log && (
              <div className={`banner ${log.ok ? "ok" : "error"}`}>
                <div className="banner-head">
                  <strong>{log.title}</strong>
                  <button className="btn ghost small" onClick={() => setLog(null)} aria-label="Dismiss">✕</button>
                </div>
                <pre>{log.text}</pre>
              </div>
            )}

            <div className="tabs view-tabs" role="tablist">
              <button role="tab" aria-selected={tab === "scenes"} className={`tab ${tab === "scenes" ? "active" : ""}`} onClick={() => setTab("scenes")}>
                Scenes
              </button>
              <button role="tab" aria-selected={tab === "script"} className={`tab ${tab === "script" ? "active" : ""}`} onClick={() => setTab("script")}>
                Script
              </button>
              <button role="tab" aria-selected={tab === "publish"} className={`tab ${tab === "publish" ? "active" : ""}`} onClick={() => setTab("publish")}>
                Publish
              </button>
            </div>

            <div className={`workspace ${tab === "script" ? "reading" : ""}`}>
              {tab === "publish" ? (
                <PublishPanel project={project} research={loaded.research} slug={slug!} job={render} onChange={updateProject} onPublished={() => api.getWorkspace().then(setWorkspace)} />
              ) : tab === "script" ? (
                <ScriptPanel project={project} timeline={preview.timeline} stale={stale} user={workspace.user} onChange={updateProject} />
              ) : (
              <section className="scenes" aria-label="Scenes">
                {brand && (
                  <ThemePanel
                    brand={brand}
                    project={project}
                    onBrandChange={setBrand}
                    onProjectChange={updateProject}
                  />
                )}
                {brand && (
                  <ChannelPanel brand={brand} project={project} onBrandChange={setBrand} onProjectChange={updateProject} />
                )}
                <SoundPanel project={project} onChange={updateProject} />
                {project.style === "illustrated" && characterLib && (
                  <CharactersPanel project={project} library={characterLib} onLibrary={setCharacterLib} />
                )}
                {project.scenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    projectPath={loaded.projectPath}
                    stale={stale.has(scene.id)}
                    active={scene.id === activeScene}
                    onChange={updateScene}
                    onFocus={() => focusScene(scene.id)}
                    onSearch={() => setSearchFor(scene)}
                    onUpload={async (file) => {
                      await flushSave();
                      const r = await api.uploadAsset(slug!, scene.id, file);
                      assetUpdated(r.project, r.version);
                    }}
                    onUploadRecording={async (file) => {
                      await flushSave();
                      const r = await api.uploadRecording(slug!, scene.id, file);
                      assetUpdated(r.project, r.version);
                    }}
                    onClearRecording={async () => {
                      await flushSave();
                      const r = await api.clearRecording(slug!, scene.id);
                      assetUpdated(r.project, r.version);
                    }}
                    prompt={scenePrompt(project, scene, characterLib)}
                    character={characterLib?.characters.find((c) => c.id === scene.character)}
                    illustrated={project.style === "illustrated"}
                  />
                ))}
              </section>
              )}
              {tab !== "script" && <aside className="preview-col">
                <div className="preview-sticky">
                  {brand ? <Preview ref={player} project={project} timeline={preview.timeline} projectPath={loaded.projectPath} brand={brand} /> : <div className="empty-state">Loading brand…</div>}
                  <p className="muted small">
                    Click a scene to jump to it. Scenes marked “Needs voice” play silent at an estimated length.
                  </p>
                </div>
              </aside>}
            </div>
          </>
        )}
      </main>

      {searchFor && slug && (
        <SearchModal
          initialQuery={searchFor.visual.searchTerms?.[0] ?? searchFor.name ?? project?.title ?? ""}
          sceneLabel={searchFor.kind === "item" ? `#${searchFor.rank} ${searchFor.name}` : "the hook"}
          onClose={() => setSearchFor(null)}
          onPick={async (result) => {
            await flushSave();
            const r = await api.assetFromUrl(slug, searchFor.id, result);
            assetUpdated(r.project, r.version);
            setSearchFor(null);
          }}
        />
      )}
    </div>
  );
};

import { useRef, useState } from "react";
import { assetSrc } from "../../remotion/src/components/SceneVisual";
import type { Scene } from "../../remotion/src/types";
import type { Character } from "./api";

type Props = {
  scene: Scene;
  projectPath: string;
  stale: boolean;
  active: boolean;
  onChange: (scene: Scene) => void;
  onFocus: () => void;
  onUpload: (file: File) => Promise<void>;
  onSearch: () => void;
  onUploadRecording: (file: File) => Promise<void>;
  onClearRecording: () => Promise<void>;
  prompt: string | null; // full AI prompt (style + character + scene action for illustrated)
  character?: Character;
  illustrated: boolean;
};

const KIND_LABEL = { hook: "Hook", item: "Item", character: "Character", beat: "Beat", scoreboard: "Scoreboard", measure: "Ballot", stats: "Stats", chart: "Chart", quiz: "Quiz", comment: "Comment", diagram: "Diagram", map: "Map", shot: "Shot", doc: "Scene", outro: "Outro" };

export const SceneCard: React.FC<Props> = ({
  scene, projectPath, stale, active, onChange, onFocus, onUpload, onSearch, onUploadRecording, onClearRecording,
  prompt, character, illustrated,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const recordingInput = useRef<HTMLInputElement>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const visual = scene.visual;
  // scoreboard / ballot scenes and map/programmatic graphic backgrounds are drawn by the template
  const needsImage =
    !["outro", "scoreboard", "measure", "stats", "chart", "quiz", "comment", "diagram", "map"].includes(scene.kind) &&
    !visual.map &&
    !scene.hemicycle &&
    !scene.scribbles &&
    !(scene.argon && visual.type === "graphic");

  const set = <K extends keyof Scene>(key: K, value: Scene[K]) => onChange({ ...scene, [key]: value });
  const setVisual = (patch: Partial<Scene["visual"]>) => onChange({ ...scene, visual: { ...visual, ...patch } });

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const copyPrompt = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className={`scene ${active ? "active" : ""}`} onFocusCapture={onFocus} onClick={onFocus}>
      <header className="scene-head">
        <span className={`kind kind-${scene.kind}`}>
          {scene.kind === "item" ? (scene.rank != null ? `#${scene.rank}` : scene.tag ?? "Item") : KIND_LABEL[scene.kind]}
        </span>
        {scene.kind === "item" || scene.kind === "character" || scene.kind === "beat" ? (
          <input
            className="name-input"
            value={scene.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            aria-label={scene.kind === "character" ? "Role" : "Name"}
          />
        ) : (
          <span className="scene-title">{scene.kind === "doc" && scene.doc ? scene.doc.layout[0].toUpperCase() + scene.doc.layout.slice(1) : KIND_LABEL[scene.kind]}</span>
        )}
        {stale && <span className="badge warn" title="Narration changed since the voice was generated">Needs voice</span>}
      </header>

      <div className="scene-body">
        <div className="fields">
          {scene.kind === "character" && (
            <label>
              <span>Real name <em className="muted">· shown on the ID badge</em></span>
              <input value={scene.realName ?? ""} onChange={(e) => set("realName", e.target.value)} />
            </label>
          )}
          <label>
            <span>Narration</span>
            <textarea rows={3} value={scene.narration} onChange={(e) => set("narration", e.target.value)} />
          </label>
          <div className="voice-row">
            {scene.recording ? (
              <>
                <span className="badge rec">🎙 My recording</span>
                <audio controls preload="none" src={`/${projectPath}/${scene.recording}`} />
                <button
                  className="link"
                  disabled={recordingBusy}
                  onClick={async () => {
                    setRecordingBusy(true);
                    await onClearRecording().finally(() => setRecordingBusy(false));
                  }}
                >
                  Use AI voice
                </button>
              </>
            ) : (
              <>
                <span className="muted small">AI voice</span>
                <button className="link" disabled={recordingBusy} onClick={() => recordingInput.current?.click()}>
                  {recordingBusy ? "Uploading…" : "Upload my recording"}
                </button>
              </>
            )}
            <input
              ref={recordingInput}
              type="file"
              accept="audio/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setRecordingBusy(true);
                await onUploadRecording(file).finally(() => setRecordingBusy(false));
                e.target.value = "";
              }}
            />
          </div>
          {scene.portraits?.length ? (
            <div className="portrait-row">
              {scene.portraits.map((p) => (
                <span key={p.name} className={`portrait-chip party-${p.party}`} title={`${p.license ?? ""} · ${p.credit ?? ""}`}>
                  <img src={`/${p.photo}`} alt="" />
                  {p.name}
                  {p.winner && " ✓"}
                </span>
              ))}
            </div>
          ) : null}
          <label>
            <span>On-screen text <em className="muted">· wrap words in *asterisks* to highlight</em></span>
            <input value={scene.onScreenText} onChange={(e) => set("onScreenText", e.target.value)} />
          </label>
        </div>

        {needsImage && (
          <div
            className={`asset ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files[0]);
            }}
          >
            {visual.asset ? (
              <img className="thumb" src={`/${assetSrc(visual.asset, projectPath)}`} alt="" />
            ) : (
              <div className="thumb empty">{uploading ? "Uploading…" : "Drop image"}</div>
            )}
            {character && (
              <div className="char-chip" title={character.description}>
                {character.sheet ? <img src={`/${character.sheet}`} alt="" /> : <span className="char-dot" />}
                <span>{character.name}</span>
              </div>
            )}
            <div className="asset-actions">
              {!illustrated && <button className="btn small" onClick={onSearch}>Search</button>}
              <button className="btn small" onClick={() => fileInput.current?.click()}>Upload</button>
              <button className="btn small" onClick={copyPrompt} disabled={!prompt}>
                {copied ? "Copied ✓" : "Copy AI prompt"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </div>
          </div>
        )}
      </div>

      {needsImage && (
        <div className="details">
          <button className="link" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Hide" : "Show"} image details
            {visual.asset && (!visual.license || visual.license === "Own / unspecified") && <span className="badge warn">No license</span>}
          </button>
          {showDetails && (
            <div className="details-grid">
              <label className="span-2">
                <span>{illustrated ? "Scene action (style + character are added when you copy)" : "AI prompt"}</span>
                <textarea rows={2} value={visual.aiPrompt ?? ""} onChange={(e) => setVisual({ aiPrompt: e.target.value })} />
              </label>
              {illustrated && character && (
                <p className="span-2 muted small">
                  {character.sheet
                    ? "Attach this character's reference sheet (Characters panel) to the chat so the drawing stays on-model."
                    : "Tip: make this character's reference sheet first (Characters panel), then attach it with the prompt."}
                </p>
              )}
              {!illustrated && <label className="span-2">
                <span>Search terms (comma separated)</span>
                <input
                  value={(visual.searchTerms ?? []).join(", ")}
                  onChange={(e) => setVisual({ searchTerms: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </label>}
              <label>
                <span>License</span>
                <input value={visual.license ?? ""} placeholder="Own · CC BY 4.0 · Pexels License…" onChange={(e) => setVisual({ license: e.target.value || null })} />
              </label>
              <label>
                <span>Credit</span>
                <input value={visual.credit ?? ""} onChange={(e) => setVisual({ credit: e.target.value || null })} />
              </label>
              <label className="span-2">
                <span>Source</span>
                <input value={visual.source ?? ""} onChange={(e) => setVisual({ source: e.target.value || null })} />
              </label>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

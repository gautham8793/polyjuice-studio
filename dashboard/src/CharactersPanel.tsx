import { useRef, useState } from "react";
import type { Project } from "../../remotion/src/types";
import { api, type Character, type CharacterLibrary } from "./api";
import { sheetPrompt } from "./prompts";

type Props = {
  project: Project;
  library: CharacterLibrary;
  onLibrary: (lib: CharacterLibrary) => void;
};

// The cast of an illustrated project: one reference sheet per character, made once and reused.
export const CharactersPanel: React.FC<Props> = ({ project, library, onLibrary }) => {
  const [open, setOpen] = useState(true);
  const cast = (project.characters ?? [])
    .map((id) => library.characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
  const missing = (project.characters ?? []).filter((id) => !library.characters.some((c) => c.id === id));
  const withSheets = cast.filter((c) => c.sheet).length;
  const style = project.stylePreset ? library.styles[project.stylePreset] : undefined;

  return (
    <section className="sound">
      <button className="sound-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sound-title">Characters</span>
        <span className="muted small">
          {withSheets}/{cast.length} reference sheets · {style?.label ?? project.stylePreset ?? "no style preset"}
        </span>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="cast-body">
          <p className="muted small">
            Make each character's reference sheet once: <strong>Copy sheet prompt</strong> → paste in Gemini or ChatGPT →
            upload the result. Then for every scene, copy its prompt and attach that sheet so the character looks the same.
          </p>
          {missing.length > 0 && (
            <p className="notice error small">Not in library/characters/: {missing.join(", ")}</p>
          )}
          <div className="cast-grid">
            {cast.map((c) => (
              <CharacterCard key={c.id} project={project} character={c} library={library} onLibrary={onLibrary} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const CharacterCard: React.FC<{
  project: Project;
  character: Character;
  library: CharacterLibrary;
  onLibrary: (lib: CharacterLibrary) => void;
}> = ({ project, character, library, onLibrary }) => {
  const input = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(character.description);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = description.trim() !== character.description;

  return (
    <div className="cast-card">
      <button className="sheet" onClick={() => input.current?.click()} title="Upload reference sheet">
        {character.sheet ? <img src={`/${character.sheet}`} alt={`${character.name} reference sheet`} /> : <span>{busy ? "Uploading…" : "+ Sheet"}</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            onLibrary(await api.uploadSheet(character.id, file));
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <div className="cast-info">
        <strong>{character.name}</strong>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label={`${character.name} description`}
        />
        <div className="row">
          <button
            className="btn small"
            onClick={async () => {
              await navigator.clipboard.writeText(sheetPrompt(project, { ...character, description }, library));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied ✓" : "Copy sheet prompt"}
          </button>
          {dirty && (
            <button
              className="btn small primary"
              onClick={async () => onLibrary(await api.updateCharacter({ id: character.id, name: character.name, description: description.trim() }))}
            >
              Save look
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

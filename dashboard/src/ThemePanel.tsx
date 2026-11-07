import { useState } from "react";
import { BODY_FONT_OPTIONS, HEADLINE_FONT_OPTIONS } from "../../remotion/src/theme";
import type { Brand, BrandPreset, Project } from "../../remotion/src/types";
import { api } from "./api";

type Props = {
  brand: Brand;
  project: Project;
  onBrandChange: (brand: Brand) => void;
  onProjectChange: (project: Project) => void;
};

// Pick dark or light text over an accent/secondary color based on relative luminance.
function contrastInk(hex: string, darkFallback = "#0E1015", lightFallback = "#FFFFFF"): string {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return lightFallback;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.52 ? darkFallback : lightFallback;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || "custom";

export const ThemePanel: React.FC<Props> = ({ brand, project, onBrandChange, onProjectChange }) => {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const activeId = (project.theme && brand.presets[project.theme] ? project.theme : brand.active) ?? Object.keys(brand.presets)[0];
  const activePreset = brand.presets[activeId] ?? Object.values(brand.presets)[0];

  const selectTheme = (id: string) => {
    // If picking the channel default, clear project.theme override; otherwise store the preset key on project.
    const nextTheme = id === brand.active ? undefined : id;
    onProjectChange({ ...project, theme: nextTheme });
    setStatus(null);
  };

  const updateActivePreset = (patch: Partial<BrandPreset>) => {
    const updated: BrandPreset = {
      ...activePreset,
      ...patch,
      colors: { ...activePreset.colors, ...(patch.colors ?? {}) },
      fonts: { ...activePreset.fonts, ...(patch.fonts ?? {}) },
    };
    onBrandChange({
      ...brand,
      presets: { ...brand.presets, [activeId]: updated },
    });
    setDirty(true);
    setStatus(null);
  };

  const updateColor = (key: keyof BrandPreset["colors"], value: string) => {
    const colors = { ...activePreset.colors, [key]: value };
    if (key === "accent" || key === "background") {
      colors.textOnAccent = contrastInk(colors.accent, colors.background, "#FFFFFF");
    }
    if (key === "secondary" || key === "background") {
      colors.textOnSecondary = contrastInk(colors.secondary, colors.background, "#FFFFFF");
    }
    updateActivePreset({ colors });
  };

  const saveBrandToDisk = async (nextBrand = brand, msg = "Theme saved") => {
    setSaving(true);
    setStatus(null);
    try {
      const saved = await api.saveBrand(nextBrand);
      onBrandChange(saved);
      setDirty(false);
      setStatus(msg);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async () => {
    const nextBrand: Brand = { ...brand, active: activeId };
    onProjectChange({ ...project, theme: undefined });
    await saveBrandToDisk(nextBrand, `"${activePreset.label.split("—")[0].trim()}" is now the channel default`);
  };

  const createNewTheme = async () => {
    const label = newName.trim();
    if (!label) return;
    let id = slugify(label.split("—")[0]);
    let suffix = 2;
    while (brand.presets[id]) {
      id = `${slugify(label.split("—")[0])}-${suffix++}`;
    }
    const nextBrand: Brand = {
      ...brand,
      presets: {
        ...brand.presets,
        [id]: {
          ...activePreset,
          label,
          colors: { ...activePreset.colors },
          fonts: { ...activePreset.fonts },
        },
      },
    };
    setNewName("");
    setCreatingNew(false);
    onProjectChange({ ...project, theme: id });
    await saveBrandToDisk(nextBrand, `Created theme "${label}"`);
    setCustomizing(true);
  };

  const deleteTheme = async () => {
    const keys = Object.keys(brand.presets);
    if (keys.length <= 1) return;
    const { [activeId]: _, ...rest } = brand.presets;
    const fallback = brand.active !== activeId && rest[brand.active] ? brand.active : Object.keys(rest)[0];
    const nextBrand: Brand = { ...brand, active: fallback, presets: rest };
    onProjectChange({ ...project, theme: undefined });
    await saveBrandToDisk(nextBrand, "Theme deleted");
  };

  return (
    <section className="sound">
      <button className="sound-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sound-title">Theme</span>
        <span className="theme-inline-preview">
          <span className="swatch-dots">
            <span className="swatch-dot" style={{ background: activePreset.colors.background }} />
            <span className="swatch-dot" style={{ background: activePreset.colors.accent }} />
            <span className="swatch-dot" style={{ background: activePreset.colors.secondary }} />
          </span>
          <span className="muted small">
            {activePreset.label.split("—")[0].trim()} · {activePreset.fonts.headline}/{activePreset.fonts.body}
            {project.theme && project.theme !== brand.active ? " (this video)" : " (default)"}
          </span>
        </span>
        {dirty && <span className="badge warn">Unsaved</span>}
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="theme-body">
          <div className="theme-grid">
            {Object.entries(brand.presets).map(([id, preset]) => {
              const isSelected = id === activeId;
              const isDefault = id === brand.active;
              const [shortName, desc] = preset.label.split("—").map((s) => s.trim());
              return (
                <button
                  key={id}
                  type="button"
                  className={`theme-card ${isSelected ? "active" : ""}`}
                  onClick={() => selectTheme(id)}
                >
                  <div className="theme-swatches" style={{ background: preset.colors.background }}>
                    <span className="theme-bar" style={{ background: preset.colors.surface }} />
                    <span className="theme-pill" style={{ background: preset.colors.accent, color: preset.colors.textOnAccent }}>
                      #1
                    </span>
                    <span className="theme-pill" style={{ background: preset.colors.secondary, color: preset.colors.textOnSecondary }}>
                      FACT
                    </span>
                    <span className="theme-sample-text" style={{ color: preset.colors.text }}>
                      Aa
                    </span>
                  </div>
                  <div className="theme-card-meta">
                    <div className="theme-card-title">
                      <strong>{shortName}</strong>
                      {isDefault && <span className="theme-tag">Default</span>}
                    </div>
                    {desc && <span className="muted small">{desc}</span>}
                    <span className="muted small">
                      {preset.fonts.headline} + {preset.fonts.body}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="row">
            <button className="btn small" onClick={() => setCustomizing(!customizing)}>
              {customizing ? "Hide editor" : `Customize "${activePreset.label.split("—")[0].trim()}"`}
            </button>
            <button className="btn small" onClick={() => setCreatingNew(!creatingNew)}>
              + New theme
            </button>
            {activeId !== brand.active && (
              <button className="btn small" onClick={setAsDefault} disabled={saving}>
                Set as channel default
              </button>
            )}
            {dirty && (
              <button className="btn small primary" onClick={() => saveBrandToDisk()} disabled={saving}>
                {saving ? "Saving…" : "Save theme changes"}
              </button>
            )}
            {status && <span className="muted small">{status}</span>}
          </div>

          {creatingNew && (
            <div className="theme-new-row">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Theme name (e.g. Documentary — warm slate + gold)"
                onKeyDown={(e) => e.key === "Enter" && createNewTheme()}
              />
              <button className="btn small primary" onClick={createNewTheme} disabled={!newName.trim() || saving}>
                Create from current
              </button>
              <button className="btn small ghost" onClick={() => setCreatingNew(false)}>
                Cancel
              </button>
            </div>
          )}

          {customizing && (
            <div className="theme-editor">
              <div className="details-grid">
                <label className="span-2">
                  <span>Theme label</span>
                  <input
                    value={activePreset.label}
                    onChange={(e) => updateActivePreset({ label: e.target.value })}
                  />
                </label>

                <label>
                  <span>Headline font</span>
                  <select
                    value={activePreset.fonts.headline}
                    onChange={(e) => updateActivePreset({ fonts: { ...activePreset.fonts, headline: e.target.value } })}
                  >
                    {HEADLINE_FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Body &amp; caption font</span>
                  <select
                    value={activePreset.fonts.body}
                    onChange={(e) => updateActivePreset({ fonts: { ...activePreset.fonts, body: e.target.value } })}
                  >
                    {BODY_FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="color-grid">
                {(
                  [
                    ["background", "Background"],
                    ["surface", "Card / Surface"],
                    ["accent", "Primary Accent (badges, active word)"],
                    ["secondary", "Secondary (fact strip, stamps)"],
                    ["text", "Main Text"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="color-field">
                    <span>{label}</span>
                    <div className="color-input-row">
                      <input
                        type="color"
                        value={activePreset.colors[key]}
                        onChange={(e) => updateColor(key, e.target.value.toUpperCase())}
                      />
                      <input
                        type="text"
                        value={activePreset.colors[key]}
                        onChange={(e) => updateColor(key, e.target.value)}
                      />
                    </div>
                  </label>
                ))}
              </div>

              <div className="row end">
                {Object.keys(brand.presets).length > 1 && (
                  <button className="btn small ghost" onClick={deleteTheme} disabled={saving}>
                    Delete theme
                  </button>
                )}
                <button className="btn small primary" onClick={() => saveBrandToDisk()} disabled={saving}>
                  {saving ? "Saving…" : "Save theme"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

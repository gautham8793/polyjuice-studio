import { useState } from "react";
import type { Brand, Branding, CaptionStyle, Project, SourceStyle, WatermarkStyle } from "../../remotion/src/types";
import { api } from "./api";
import { Connections } from "./Connections";

type Props = {
  brand: Brand;
  project: Project;
  onBrandChange: (brand: Brand) => void;
  onProjectChange: (project: Project) => void;
};

const DEFAULT_BRANDING: Branding = { watermark: "footer", source: "footer" };

const WATERMARKS: { id: WatermarkStyle; label: string; hint: string }[] = [
  { id: "footer", label: "Footer", hint: "@handle, bottom center" },
  { id: "pill", label: "Pill", hint: "Channel name, bottom left" },
  { id: "corner", label: "Corner bug", hint: "@handle, top right (TV style)" },
  { id: "intro", label: "Intro card", hint: "Name card + Subscribe, mid-video (branding.introAt, default 20 s)" },
  { id: "none", label: "Hidden", hint: "Outro only" },
];

const SOURCES: { id: SourceStyle; label: string; hint: string }[] = [
  { id: "footer", label: "Footer line", hint: "Small text above the handle" },
  { id: "chip", label: "Chip", hint: "Boxed tag, bottom right" },
  { id: "none", label: "Hidden", hint: "Sources only in the description" },
];

const SIZES = [
  { label: "S", value: 66 },
  { label: "M", value: 84 },
  { label: "L", value: 100 },
  { label: "XL", value: 118 },
];

// Channel identity + how this video shows captions, the channel name and its source line.
export const ChannelPanel: React.FC<Props> = ({ brand, project, onBrandChange, onProjectChange }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(brand.channelName);
  const [handle, setHandle] = useState(brand.handle);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const channelDirty = name !== brand.channelName || handle !== brand.handle;
  const captions: CaptionStyle = { ...brand.captions, ...project.captions };
  const branding: Branding = { ...DEFAULT_BRANDING, ...brand.branding, ...project.branding };
  const customized = !!project.captions || !!project.branding;

  const save = async (next: Brand, msg: string) => {
    setSaving(true);
    setStatus(null);
    try {
      onBrandChange(await api.saveBrand(next));
      setStatus(msg);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const setCaptions = (patch: Partial<CaptionStyle>) =>
    onProjectChange({ ...project, captions: { ...project.captions, ...patch } });
  const setBranding = (patch: Partial<Branding>) =>
    onProjectChange({ ...project, branding: { ...project.branding, ...patch } });

  const cleanHandle = (h: string) => (h.trim() ? `@${h.trim().replace(/^@+/, "").replace(/\s+/g, "")}` : "");

  return (
    <section className="sound">
      <button className="sound-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sound-title">Channel &amp; captions</span>
        <span className="muted small">
          {brand.channelName} · captions {captions.fontSize}px · name: {WATERMARKS.find((w) => w.id === branding.watermark)?.label}
          {customized ? " (this video)" : ""}
        </span>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="channel-body">
          <div className="sound-group">
            <h3>Channel · all videos</h3>
            <div className="details-grid">
              <label>
                <span>Channel name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fact Bolt" />
              </label>
              <label>
                <span>Handle</span>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} onBlur={() => setHandle(cleanHandle(handle))} placeholder="@factbolt" />
              </label>
            </div>
            {channelDirty && (
              <div className="row">
                <button
                  className="btn small primary"
                  disabled={saving || !name.trim()}
                  onClick={() => save({ ...brand, channelName: name.trim(), handle: cleanHandle(handle) || brand.handle }, "Channel saved")}
                >
                  {saving ? "Saving…" : "Save channel"}
                </button>
                <span className="muted small">Shown in the watermark, intro card and outro of every video.</span>
              </div>
            )}
          </div>

          <Connections />

          <div className="sound-group">
            <h3>Captions · this video</h3>
            <div className="row">
              {SIZES.map((s) => (
                <button
                  key={s.label}
                  className={`btn small ${captions.fontSize === s.value ? "primary" : ""}`}
                  onClick={() => setCaptions({ fontSize: s.value })}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="slider">
              <span>Size {captions.fontSize}px</span>
              <input type="range" min={56} max={130} step={2} value={captions.fontSize}
                onChange={(e) => setCaptions({ fontSize: Number(e.target.value) })} />
            </label>
            <label className="slider">
              <span>Height from bottom {captions.bottomOffset}px</span>
              <input type="range" min={200} max={620} step={10} value={captions.bottomOffset}
                onChange={(e) => setCaptions({ bottomOffset: Number(e.target.value) })} />
            </label>
            <label className="slider">
              <span>Words at a time: {captions.wordsPerGroup}</span>
              <input type="range" min={1} max={5} step={1} value={captions.wordsPerGroup}
                onChange={(e) => setCaptions({ wordsPerGroup: Number(e.target.value) })} />
            </label>
          </div>

          <div className="sound-group span-all">
            <h3>Channel name on screen · this video</h3>
            <div className="style-grid">
              {WATERMARKS.map((w) => (
                <button
                  key={w.id}
                  className={`style-card ${branding.watermark === w.id ? "active" : ""}`}
                  onClick={() => setBranding({ watermark: w.id })}
                >
                  <span className={`style-mini wm-${w.id}`}>
                    <i />
                  </span>
                  <strong>{w.label}</strong>
                  <span className="muted small">{w.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sound-group span-all">
            <h3>Source line · this video</h3>
            <div className="style-grid">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  className={`style-card ${branding.source === s.id ? "active" : ""}`}
                  onClick={() => setBranding({ source: s.id })}
                >
                  <span className={`style-mini src-${s.id}`}>
                    <i />
                  </span>
                  <strong>{s.label}</strong>
                  <span className="muted small">{s.hint}</span>
                </button>
              ))}
            </div>
            {project.series?.source ? (
              <p className="muted small">
                Text comes from the series: "Source: {project.series.source}
                {project.series.asOf ? ` · as of ${project.series.asOf}` : ""}".
              </p>
            ) : (
              <label>
                <span>Source text (leave empty to hide)</span>
                <input
                  value={branding.sourceText ?? ""}
                  placeholder="e.g. Sources: NOAA, WWF · links in description"
                  onChange={(e) => setBranding({ sourceText: e.target.value })}
                />
              </label>
            )}
          </div>

          <div className="row span-all">
            <button
              className="btn small"
              disabled={saving || !customized}
              onClick={() =>
                save(
                  {
                    ...brand,
                    captions: { ...brand.captions, ...project.captions },
                    branding: { ...DEFAULT_BRANDING, ...brand.branding, ...project.branding, sourceText: brand.branding?.sourceText },
                  },
                  "Saved as the channel default",
                )
              }
            >
              Make these the channel default
            </button>
            <button
              className="btn small ghost"
              disabled={!customized}
              onClick={() => onProjectChange({ ...project, captions: undefined, branding: undefined })}
            >
              Reset this video to channel default
            </button>
            {status && <span className="muted small">{status}</span>}
          </div>
        </div>
      )}
    </section>
  );
};

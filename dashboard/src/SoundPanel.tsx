import { useEffect, useRef, useState } from "react";
import type { Music, Project, Voice } from "../../remotion/src/types";
import { api, type MusicTrack } from "./api";

// English voices. Kokoro (local, free) ids: a = American, b = British; f = female, m = male.
// Google Chirp3-HD (cloud, natural Indian English) ids start with "en-IN-".
const VOICES: { id: string; label: string; group?: string }[] = [
  { id: "am_michael", label: "Michael · US male (default)" },
  { id: "am_adam", label: "Adam · US male" },
  { id: "am_eric", label: "Eric · US male" },
  { id: "am_fenrir", label: "Fenrir · US male" },
  { id: "am_liam", label: "Liam · US male" },
  { id: "am_onyx", label: "Onyx · US male" },
  { id: "am_puck", label: "Puck · US male" },
  { id: "af_heart", label: "Heart · US female" },
  { id: "af_bella", label: "Bella · US female" },
  { id: "af_nicole", label: "Nicole · US female" },
  { id: "af_sarah", label: "Sarah · US female" },
  { id: "af_nova", label: "Nova · US female" },
  { id: "af_sky", label: "Sky · US female" },
  { id: "bm_george", label: "George · UK male" },
  { id: "bm_lewis", label: "Lewis · UK male" },
  { id: "bm_daniel", label: "Daniel · UK male" },
  { id: "bf_emma", label: "Emma · UK female" },
  { id: "bf_isabella", label: "Isabella · UK female" },
  { id: "en-IN-Chirp3-HD-Achird", label: "Achird · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Algenib", label: "Algenib · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Algieba", label: "Algieba · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Alnilam", label: "Alnilam · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Charon", label: "Charon · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Enceladus", label: "Enceladus · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Fenrir", label: "Fenrir · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Iapetus", label: "Iapetus · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Orus", label: "Orus · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Puck", label: "Puck · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Rasalgethi", label: "Rasalgethi · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Sadachbia", label: "Sadachbia · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Sadaltager", label: "Sadaltager · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Schedar", label: "Schedar · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Umbriel", label: "Umbriel · Indian male", group: "india" },
  { id: "en-IN-Chirp3-HD-Zubenelgenubi", label: "Zubenelgenubi · Indian male", group: "india" },
];
const engineFor = (voiceId: string): Voice["engine"] => (voiceId.startsWith("en-IN-") ? "google" : "kokoro");

const DEFAULT_VOICE: Voice = { source: "tts", engine: "kokoro", voiceId: "am_michael", speed: 1.05 };
const DEFAULT_MUSIC = { volume: 0.35, duckTo: 0.1, startAt: 0 };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

type Props = { project: Project; onChange: (project: Project) => void };

export const SoundPanel: React.FC<Props> = ({ project, onChange }) => {
  const [open, setOpen] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [editing, setEditing] = useState<MusicTrack | null>(null);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);

  const voice = project.voice ?? DEFAULT_VOICE;
  const music = project.music ?? null;
  const current = tracks.find((t) => t.path === music?.track);

  useEffect(() => {
    api.listMusic().then(setTracks).catch((e) => setError(String(e)));
  }, []);

  const setVoice = (patch: Partial<Voice>) => onChange({ ...project, voice: { ...voice, ...patch } });
  const setMusic = (next: Music | null) => onChange({ ...project, music: next });

  const play = (src: string) => {
    if (!audio.current) return;
    audio.current.src = src;
    audio.current.play();
  };

  const previewVoice = async () => {
    setSampleBusy(true);
    setError("");
    try {
      const { url } = await api.voiceSample(voice.voiceId, voice.speed);
      play(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setSampleBusy(false);
    }
  };

  const uploadMusic = async (file?: File) => {
    if (!file) return;
    try {
      setTracks(await api.uploadMusic(file));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <section className="sound">
      <button className="sound-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sound-title">Sound</span>
        <span className="muted small">
          {VOICES.find((v) => v.id === voice.voiceId)?.label.split(" ·")[0] ?? voice.voiceId} voice ·{" "}
          {current ? current.title : "no music"}
        </span>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="sound-body">
          <div className="sound-group">
            <h3>Voice</h3>
            <div className="row">
              <select value={voice.voiceId} onChange={(e) => setVoice({ voiceId: e.target.value, engine: engineFor(e.target.value) })} aria-label="Voice">
                <optgroup label="US & UK English · Kokoro (free, local)">
                  {VOICES.filter((v) => !v.group).map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Indian English · Google Chirp3-HD (natural)">
                  {VOICES.filter((v) => v.group === "india").map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </optgroup>
              </select>
              <button className="btn small" onClick={previewVoice} disabled={sampleBusy}>
                {sampleBusy ? "Making sample…" : "▶ Hear it"}
              </button>
            </div>
            <label className="slider">
              <span>Speed {voice.speed.toFixed(2)}×</span>
              <input
                type="range" min={0.8} max={1.3} step={0.05} value={voice.speed}
                onChange={(e) => setVoice({ speed: Number(e.target.value) })}
              />
            </label>
            <p className="muted small">Changing voice or speed marks every scene “Needs voice”. Scenes with your own recording keep it.</p>
          </div>

          <div className="sound-group">
            <h3>Music</h3>
            <div className="row">
              <select
                value={music?.track ?? ""}
                onChange={(e) =>
                  setMusic(e.target.value ? { ...DEFAULT_MUSIC, ...music, track: e.target.value } : null)
                }
                aria-label="Music track"
              >
                <option value="">No music</option>
                {tracks.map((t) => (
                  <option key={t.file} value={t.path}>
                    {t.title}{t.mood.length ? ` · ${t.mood.join(", ")}` : ""} ({fmt(t.duration)})
                  </option>
                ))}
              </select>
              {current && <button className="btn small" onClick={() => play(`/${current.path}`)}>▶ Play</button>}
              {current && <button className="btn small" onClick={() => setEditing(current)}>Tags</button>}
            </div>
            {music && (
              <>
                <label className="slider">
                  <span>Music volume {Math.round(music.volume * 100)}%</span>
                  <input type="range" min={0} max={1} step={0.05} value={music.volume}
                    onChange={(e) => setMusic({ ...music, volume: Number(e.target.value) })} />
                </label>
                <label className="slider">
                  <span>Under the voice {Math.round(music.duckTo * 100)}%</span>
                  <input type="range" min={0} max={0.5} step={0.01} value={music.duckTo}
                    onChange={(e) => setMusic({ ...music, duckTo: Number(e.target.value) })} />
                </label>
                <label className="slider">
                  <span>Start track at {fmt(music.startAt ?? 0)}</span>
                  <input type="range" min={0} max={Math.max(0, (current?.duration ?? 60) - 10)} step={1}
                    value={music.startAt ?? 0}
                    onChange={(e) => setMusic({ ...music, startAt: Number(e.target.value) })} />
                </label>
                {current?.attribution && (
                  <p className="notice small">Needs credit in the description: <em>{current.attribution}</em></p>
                )}
              </>
            )}
            <div className="row">
              <button className="btn small" onClick={() => musicInput.current?.click()}>+ Add track to library</button>
              <input ref={musicInput} type="file" accept="audio/*" hidden onChange={(e) => uploadMusic(e.target.files?.[0])} />
            </div>
            {tracks.length === 0 && (
              <p className="muted small">
                Library is empty. Download tracks from YouTube Studio → Audio Library, then add them here.
              </p>
            )}
          </div>
          {error && <p className="notice error small">{error}</p>}
        </div>
      )}

      {editing && (
        <TagEditor
          track={editing}
          onClose={() => setEditing(null)}
          onSave={async (tag) => {
            setTracks(await api.tagMusic(tag));
            setEditing(null);
          }}
        />
      )}
      <audio ref={audio} hidden />
    </section>
  );
};

const TagEditor: React.FC<{
  track: MusicTrack;
  onClose: () => void;
  onSave: (tag: Pick<MusicTrack, "file" | "title" | "artist" | "mood" | "attribution">) => Promise<void>;
}> = ({ track, onClose, onSave }) => {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [mood, setMood] = useState(track.mood.join(", "));
  const [needsCredit, setNeedsCredit] = useState(!!track.attribution);
  const [attribution, setAttribution] = useState(track.attribution ?? "");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Track tags">
        <header className="modal-head">
          <h2>Track tags</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="tag-form">
          <label><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label><span>Artist</span><input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          <label><span>Mood (comma separated)</span><input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="calm, curious, epic" /></label>
          <label className="check">
            <input type="checkbox" checked={needsCredit} onChange={(e) => setNeedsCredit(e.target.checked)} />
            <span>Track requires attribution (YouTube Audio Library shows a “Creative Commons” badge)</span>
          </label>
          {needsCredit && (
            <label>
              <span>Credit text (copy it from the Audio Library)</span>
              <textarea rows={2} value={attribution} onChange={(e) => setAttribution(e.target.value)} />
            </label>
          )}
          <div className="row end">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn primary"
              onClick={() =>
                onSave({
                  file: track.file,
                  title: title.trim() || track.title,
                  artist: artist.trim(),
                  mood: mood.split(",").map((m) => m.trim()).filter(Boolean),
                  attribution: needsCredit ? attribution.trim() || `${title} by ${artist}` : null,
                })
              }
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

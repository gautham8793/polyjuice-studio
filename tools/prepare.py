"""Generate per-scene voice + word captions for a project and write timeline.json.

Usage:
  tools/.venv/bin/python tools/prepare.py 2026-11-types-of-whales [--force]   (a slug or a project folder)

Each scene's voice is either TTS — Kokoro, or Google for "en-IN-…" voice ids — (project "voice") or the scene's own "recording"
(an uploaded take, loudness-normalized). Scenes whose narration / voice / recording haven't
changed since the last run are skipped.
"""
import argparse
import difflib
import hashlib
import re
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from captions import transcribe  # noqa: E402
from studio_paths import content_path, project_dir as find_project  # noqa: E402

SAMPLE_RATE = 24000
SILENT_SECONDS = 2.0  # how long a scene with no narration stays on screen


def voice_key(scene: dict, voice: dict) -> str:
    if scene.get("recording"):
        return f"rec:{scene['recording']}"
    # float(): "speed": 1 and 1.0 must give the same key ("@1.0", as the dashboard expects),
    # or every scene looks changed and gets re-voiced
    key = f"{voice.get('voiceId')}@{float(voice.get('speed', 1.0))}"
    if voice.get("tempo") and float(voice["tempo"]) != 1.0:
        key += f"~{float(voice['tempo'])}"  # sped up afterwards (see apply_tempo)
    if scene.get("pauses"):
        key += "|p:" + ",".join(f"{p['after']}+{float(p['seconds'])}" for p in scene["pauses"])
    return f"{key}|{scene['ttsText']}" if scene.get("ttsText") else key


def scene_hash(narration: str, key: str) -> str:
    return hashlib.sha1(json.dumps([narration, key]).encode()).hexdigest()[:12]


def load_words(captions_json: Path) -> list[dict]:
    data = json.loads(captions_json.read_text())
    words = []
    for seg in data["transcription"]:
        text = seg["text"].strip()
        if not text:
            continue
        words.append({
            "text": text,
            "start": seg["offsets"]["from"] / 1000,
            "end": seg["offsets"]["to"] / 1000,
        })
    return words


def _norm(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower())


def align_to_script(words: list[dict], narration: str) -> list[dict]:
    """Keep Whisper's timings but show the script's spelling wherever the two line up 1:1.

    Whisper often mishears names ("Hinojosa"); the script is the source of truth for TTS.
    Where the word counts differ ("more a healy" vs "Maura Healey") the script words are spread
    over the same time span — unless Whisper wrote digits ("2008" for "two thousand eight"),
    which are kept because they read better on screen.
    """
    script = narration.split()
    a = [_norm(w["text"]) for w in words]
    b = [_norm(w) for w in script]
    out = [dict(w) for w in words]
    result: list[dict] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        heard, said = out[i1:i2], script[j1:j2]
        if op in ("equal", "replace") and len(heard) == len(said):
            result += [{**w, "text": t} for w, t in zip(heard, said)]
        elif op == "replace" and heard and not all(re.fullmatch(r"[$]?[\d,.]+[%.,:;]?", w["text"]) for w in heard if re.search(r"\d", w["text"])) or (
            op == "replace" and heard and not any(re.search(r"\d", w["text"]) for w in heard)
        ):
            # spread the script words over the span — also when Whisper wrote a misleading
            # number form like "18-20" for "eighteen of twenty"
            # e.g. "more a healy" → "Maura Healey": spread the script words over the same span
            start, end = heard[0]["start"], heard[-1]["end"]
            step = (end - start) / len(said)
            result += [{"text": t, "start": round(start + k * step, 3), "end": round(start + (k + 1) * step, 3)}
                       for k, t in enumerate(said)]
        else:
            result += heard  # digits Whisper wrote ("2008") or words only Whisper has
    return result


class Tts:
    """Lazily-loaded Kokoro pipelines, one per language (voice prefix: a=US, b=UK, h=Hindi…)."""

    def __init__(self) -> None:
        self.pipelines = {}

    def speak(self, text: str, voice_id: str, speed: float, out: Path) -> None:
        from tts import is_google, speak_google  # tools/tts.py

        if is_google(voice_id):
            speak_google(text, voice_id, speed, out)
            return
        from kokoro import KPipeline

        lang = voice_id[0]
        if lang not in self.pipelines:
            self.pipelines[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
        chunks = [a for _, _, a in self.pipelines[lang](text, voice=voice_id, speed=speed)]
        sf.write(out, np.concatenate(chunks), SAMPLE_RATE)


def spread_bunched(words: list[dict]) -> list[dict]:
    """Whisper sometimes squeezes the first few words into a few milliseconds ("So the phone
    company" all at 0.0–0.05 s). Spread such runs (3+ words) evenly, by length, up to the next
    properly timed word, so captions don't flash past."""
    out = [dict(w) for w in words]
    i = 0
    while i < len(out):
        j = i
        while j < len(out) and out[j]["end"] - out[j]["start"] < 0.04:
            j += 1
        if j - i >= 3:
            # the first properly timed word after the run swallowed the run's time: share it
            end = min(j + 1, len(out))
            t0 = out[i]["start"]
            t1 = out[end - 1]["end"] if j < len(out) else out[j - 1]["end"] + 0.3 * (j - i)
            chars = [max(1, len(w["text"])) for w in out[i:end]]
            total, acc = sum(chars), 0
            for k, c in zip(range(i, end), chars):
                out[k]["start"] = round(t0 + (t1 - t0) * acc / total, 3)
                acc += c
                out[k]["end"] = round(t0 + (t1 - t0) * acc / total, 3)
        i = max(j, i + 1)
    return out


def _norm_tok(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def speak_with_pauses(tts: "Tts", text: str, pauses: list[dict], voice: dict, out: Path) -> None:
    """Dramatic beats ("So, is the bank dead? [beat] No."): the line is split after each marked
    word, every part is voiced on its own (so each ends with its own natural cadence) and the parts
    are joined with that many seconds of silence. Captions still come from the whole narration."""
    words = text.split()
    cuts, start = [], 0
    for p in pauses:
        # the exact word, punctuation included, wins ("chips." not the earlier "chips,"); only if
        # there's no exact match, compare without punctuation
        exact = next((i for i in range(start, len(words)) if words[i] == p["after"]), None)
        target = _norm_tok(p["after"])
        loose = next((i for i in range(start, len(words)) if _norm_tok(words[i]) == target), None)
        i = exact if exact is not None else loose
        if i is None:
            raise SystemExit(f"pause word '{p['after']}' not found in: {text}")
        cuts.append((i + 1, float(p["seconds"])))
        start = i + 1
    parts, prev = [], 0
    for end, sec in cuts + [(len(words), 0.0)]:
        if end > prev:
            parts.append((" ".join(words[prev:end]), sec))
        prev = end
    audio, rate, spans, t = [], SAMPLE_RATE, [], 0.0
    for i, (chunk, sec) in enumerate(parts):
        tmp = out.with_suffix(f".part{i}.wav")
        tts.speak(chunk, voice["voiceId"], voice.get("speed", 1.0), tmp)
        data, rate = sf.read(tmp, dtype="float32")
        tmp.unlink()
        if data.ndim > 1:
            data = data.mean(axis=1)
        audio.append(data)
        spans.append((t, t + len(data) / rate, len(chunk.split())))  # when this part is spoken
        t += len(data) / rate
        if sec > 0:
            audio.append(np.zeros(int(sec * rate), dtype="float32"))
            t += int(sec * rate) / rate
    sf.write(out, np.concatenate(audio), rate)
    return spans


def fit_words_to_spans(words: list[dict], spans: list[tuple], script: list[str]) -> list[dict]:
    """Word timings for a line voiced in parts with silent beats. We know exactly when each part
    is spoken (spans) and which script words it holds; Whisper's words are used inside each span
    when it heard all of them, otherwise that part's words are spread evenly by length (Whisper
    tends to drop or smear a short word right after a silence, e.g. the "No." in "dead? … No.")."""
    out, i = [], 0
    for t0, t1, n in spans:
        toks = script[i : i + n]
        i += n
        heard = [w for w in words if t0 - 0.05 <= (w["start"] + w["end"]) / 2 <= t1 + 0.05]
        if len(heard) == len(toks):
            out += [{**w, "text": tok, "start": round(max(w["start"], t0), 3), "end": round(min(w["end"], t1), 3)} for w, tok in zip(heard, toks)]
            continue
        total = sum(max(1, len(tok)) for tok in toks)
        acc = 0
        for tok in toks:
            s0 = t0 + (t1 - t0) * acc / total
            acc += max(1, len(tok))
            out.append({"text": tok, "start": round(s0, 3), "end": round(t0 + (t1 - t0) * acc / total, 3)})
    return out


def apply_tempo(wav: Path, tempo: float) -> None:
    """Speed a finished take up (or down) without changing pitch — ffmpeg atempo.

    Google's Chirp3-HD voices read each line a little differently, so their own speaking rate
    only nudges the pace; stretching the take afterwards gives an exact, predictable speed.
    """
    if not tempo or abs(tempo - 1.0) < 1e-6:
        return
    tmp = wav.with_suffix(".tempo.wav")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-filter:a", f"atempo={tempo}", str(tmp)], check=True)
    tmp.replace(wav)


def import_recording(src: Path, out: Path) -> None:
    # Mono, trimmed silence at the ends, broadcast-ish loudness (-16 LUFS) to sit with the TTS level.
    subprocess.run([
        "ffmpeg", "-loglevel", "error", "-y", "-i", str(src),
        "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
               "silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5",
        "-ac", "1", "-ar", "48000", str(out),
    ], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("project")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    project_dir = find_project(args.project)
    rel = content_path(project_dir)  # audio paths in timeline.json are relative to the content root
    project = json.loads((project_dir / "project.json").read_text())
    voice = project["voice"]

    audio_dir = project_dir / "audio"
    captions_dir = project_dir / "captions"
    audio_dir.mkdir(exist_ok=True)
    captions_dir.mkdir(exist_ok=True)

    timeline_path = project_dir / "timeline.json"
    previous = {}
    if timeline_path.exists() and not args.force:
        previous = {s["id"]: s for s in json.loads(timeline_path.read_text())["scenes"]}

    tts = Tts()
    scenes = []
    for scene in project["scenes"]:
        spans = None  # set when the line is voiced in parts with silent beats
        sid = scene["id"]
        wav = audio_dir / f"{sid}.wav"
        cap_base = captions_dir / sid
        key = voice_key(scene, voice)
        h = scene_hash(scene["narration"], key)

        if sid in previous and previous[sid].get("hash") == h and wav.exists():
            print(f"{sid}: unchanged, skipping")
            scenes.append({**previous[sid], "hold": scene.get("hold", 0)})
            continue

        if not scene["narration"].strip() and not scene.get("recording"):
            # nothing to say (e.g. a silent outro card): hold the scene on screen without voice
            wav.unlink(missing_ok=True)
            scenes.append({"id": sid, "hash": h, "narration": "", "voiceKey": key, "audio": None,
                           "duration": SILENT_SECONDS, "hold": scene.get("hold", 0), "words": []})
            print(f"{sid}: no narration, {SILENT_SECONDS:.1f}s silent")
            continue

        if scene.get("recording"):
            import_recording(project_dir / scene["recording"], wav)
        else:
            if scene.get("pauses"):
                spans = speak_with_pauses(tts, scene.get("ttsText") or scene["narration"], scene["pauses"], voice, wav)
            else:
                tts.speak(scene.get("ttsText") or scene["narration"], voice["voiceId"], voice.get("speed", 1.0), wav)

        # Whisper times the natural-speed take more reliably than a stretched one, so transcribe
        # first, then speed the take up and scale the word timings to match.
        tempo = 1.0 if scene.get("recording") else float(voice.get("tempo", 1.0))
        transcribe(wav, cap_base)
        apply_tempo(wav, tempo)

        duration = sf.info(wav).duration
        scenes.append({
            "id": sid,
            "hash": h,
            "narration": scene["narration"],
            "voiceKey": key,
            "audio": f"{rel}/audio/{sid}.wav",
            "duration": round(duration, 3),
            "hold": scene.get("hold", 0),  # quiz countdown: silence after the voice
            "words": [
                {**w, "start": round(w["start"] / tempo, 3), "end": round(w["end"] / tempo, 3)}
                for w in (lambda ws: fit_words_to_spans(ws, spans, scene["narration"].split()) if spans else ws)(
                    spread_bunched(
                        load_words(cap_base.with_suffix(".json"))
                        if scene.get("recording")  # a recording may go off-script — trust what was said
                        else align_to_script(load_words(cap_base.with_suffix(".json")), scene["narration"])
                    )
                )
            ],
        })
        print(f"{sid}: {duration:.2f}s{' (recording)' if scene.get('recording') else ''}")

    timeline_path.write_text(json.dumps({"scenes": scenes}, indent=2))
    print(f"wrote {content_path(timeline_path)} — total {sum(s['duration'] for s in scenes):.1f}s")


if __name__ == "__main__":
    main()

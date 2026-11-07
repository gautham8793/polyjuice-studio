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
    key = f"{voice.get('voiceId')}@{voice.get('speed', 1.0)}"
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
            tts.speak(scene.get("ttsText") or scene["narration"], voice["voiceId"], voice.get("speed", 1.0), wav)

        transcribe(wav, cap_base)

        duration = sf.info(wav).duration
        scenes.append({
            "id": sid,
            "hash": h,
            "narration": scene["narration"],
            "voiceKey": key,
            "audio": f"{rel}/audio/{sid}.wav",
            "duration": round(duration, 3),
            "hold": scene.get("hold", 0),  # quiz countdown: silence after the voice
            "words": (
                load_words(cap_base.with_suffix(".json"))
                if scene.get("recording")  # a recording may go off-script — trust what was said
                else align_to_script(load_words(cap_base.with_suffix(".json")), scene["narration"])
            ),
        })
        print(f"{sid}: {duration:.2f}s{' (recording)' if scene.get('recording') else ''}")

    timeline_path.write_text(json.dumps({"scenes": scenes}, indent=2))
    print(f"wrote {content_path(timeline_path)} — total {sum(s['duration'] for s in scenes):.1f}s")


if __name__ == "__main__":
    main()

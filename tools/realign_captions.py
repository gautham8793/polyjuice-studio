"""Re-time word captions to the real speech in each voice clip, for scenes where Whisper's
timings drift (words running past the end of the audio, or a long pause in the wrong place).

The clip's speech segments come from ffmpeg silencedetect. The caption words are split into
chunks at sentence ends (. ? ! :); when there are as many chunks as speech segments, each chunk is
spread evenly over its own segment (by word length). Otherwise all words are scaled to end when the
speech ends. Only scenes that need it are touched unless --all is given. Optional fixes replace
misheard caption text with the script's words (same count, or re-spread over the same span).

Usage: python3 tools/realign_captions.py <project folder> [--all] [--ids r20,r51]
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--all", action="store_true")
ap.add_argument("--ids", default="")
ap.add_argument("--from-script", default="", help="comma-separated scene ids whose caption words are replaced by the script's words")
args = ap.parse_args()

proj = Path(args.project)
root = proj.parent.parent  # content root (workspace/)
project = json.loads((proj / "project.json").read_text(encoding="utf-8"))
narr = {s["id"]: s["narration"] for s in project["scenes"]}
tl_path = proj / "timeline.json"
tl = json.loads(tl_path.read_text(encoding="utf-8"))
only = set(filter(None, args.ids.split(",")))
from_script = set(filter(None, args.from_script.split(",")))


def speech_segments(wav: Path, dur: float):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    sil = list(zip(st, en + [dur] * (len(st) - len(en))))
    segs, t = [], 0.0
    for a, e in sil:
        if a > t + 0.05:
            segs.append((t, a))
        t = max(t, e)
    if dur > t + 0.05:
        segs.append((t, dur))
    return segs


def spread(words, a, b):
    weights = [max(1, len(re.sub(r"[^A-Za-z0-9]", "", w["text"]))) for w in words]
    total = sum(weights)
    t = a
    for w, k in zip(words, weights):
        d = (b - a) * k / total
        w["start"], w["end"] = round(t, 3), round(t + d, 3)
        t += d


changed = []
for s in tl["scenes"]:
    sid, words, dur = s["id"], s["words"], s["duration"]
    if not words or not s.get("audio"):
        continue
    if sid in from_script:
        toks = narr[sid].split()
        a, b = words[0]["start"], words[-1]["end"]
        words = [{"text": t, "start": a, "end": b} for t in toks]
        s["words"] = words
    drift = words[-1]["end"] > dur + 0.05
    if not (args.all or sid in only or sid in from_script or drift):
        continue
    segs = speech_segments(root / s["audio"], dur)
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.?!:]$", w["text"]):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    if segs and len(chunks) == len(segs):
        for ch, (a, b) in zip(chunks, segs):
            spread(ch, a, b)
        how = f"{len(segs)} segments"
    elif segs and sid in from_script:  # new words have no timings of their own: spread over the speech
        spread(words, segs[0][0], segs[-1][1])
        how = "spread over the speech"
    elif segs:
        a, b = segs[0][0], segs[-1][1]
        k = (b - a) / max(1e-6, words[-1]["end"] - words[0]["start"])
        w0 = words[0]["start"]
        for w in words:
            w["start"], w["end"] = round(a + (w["start"] - w0) * k, 3), round(a + (w["end"] - w0) * k, 3)
        how = f"scaled ×{k:.2f}"
    else:
        continue
    changed.append(f"{sid}: {how}")

tl_path.write_text(json.dumps(tl, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("\n".join(changed) or "nothing to fix")

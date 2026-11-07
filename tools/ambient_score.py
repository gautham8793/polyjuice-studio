"""Synthesize a placeholder ambient score (own audio, no license needed) from a section list.

Usage:
  tools/.venv/bin/python -I tools/ambient_score.py projects/<slug>/score.json library/music/<name>.mp3

score.json: {"length": 88, "sections": [{"at": 0, "chord": ["A2", "E3", "C4"], "pulse": 60,
             "shimmer": 0.0, "noise": 0.4, "level": 0.8}, ...]}
- chord: pad notes, cross-faded into the next section over 2 s
- pulse: heartbeat-like low thump, beats per minute (0 = none)
- shimmer: 0–1, density of soft high plucks from the chord
- noise: 0–1, filtered "flow" noise · level: overall pad loudness
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
XFADE = 2.0
NOTES = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}


def hz(note: str) -> float:
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((NOTES[name] + 12 * (octave - 4)) / 12)


def section_weights(sections: list[dict], t: np.ndarray) -> list[np.ndarray]:
    """Per-section envelopes that sum to 1, with XFADE-second cross-fades at the boundaries."""
    weights = []
    for i, s in enumerate(sections):
        start = s["at"]
        end = sections[i + 1]["at"] if i + 1 < len(sections) else t[-1] + 1
        rise = np.clip((t - start) / XFADE + 0.5, 0, 1) if i else np.ones_like(t)
        fall = np.clip((end - t) / XFADE + 0.5, 0, 1) if i + 1 < len(sections) else np.ones_like(t)
        weights.append(rise * fall)
    total = np.maximum(sum(weights), 1e-6)
    return [w / total for w in weights]


def pad(freqs: list[float], t: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    out = np.zeros_like(t)
    for f in freqs:
        for detune in (-0.18, 0.0, 0.21):
            ph = rng.uniform(0, 2 * np.pi)
            g = f + detune
            # a few soft harmonics, slowly breathing
            voice = np.sin(2 * np.pi * g * t + ph) + 0.28 * np.sin(4 * np.pi * g * t + ph) + 0.1 * np.sin(6 * np.pi * g * t + ph)
            out += voice * (0.75 + 0.25 * np.sin(2 * np.pi * rng.uniform(0.04, 0.09) * t + ph))
    return out / (len(freqs) * 3)


def thump(n: int) -> np.ndarray:
    tt = np.arange(n) / SR
    f = 46 + 30 * np.exp(-tt * 18)  # pitch drops like a soft kick
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)


def pluck(freq: float, n: int) -> np.ndarray:
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * tt) + 0.3 * np.sin(4 * np.pi * freq * tt)) * np.exp(-tt * 2.4) * np.minimum(1, tt * 200)


def main() -> None:
    spec = json.loads(Path(sys.argv[1]).read_text())
    out_path = Path(sys.argv[2])
    length = float(spec["length"])
    sections = spec["sections"]
    rng = np.random.default_rng(spec.get("seed", 7))
    t = np.arange(int(length * SR)) / SR
    mix = np.zeros_like(t)

    weights = section_weights(sections, t)
    beat = thump(int(0.6 * SR))
    for s, w in zip(sections, weights):
        mix += 0.5 * s.get("level", 0.8) * w * pad([hz(n) for n in s["chord"]], t, rng)
        # heartbeat: a double thump (lub-dub) each beat
        if s.get("pulse"):
            period = 60.0 / s["pulse"]
            k = s["at"] + 0.2
            end = min(length, (sections[sections.index(s) + 1]["at"] if s is not sections[-1] else length) + XFADE / 2)
            while k < end:
                for off, gain in ((0.0, 0.55), (0.22, 0.32)):
                    i = int((k + off) * SR)
                    seg = beat[: max(0, min(len(beat), len(t) - i))]
                    mix[i : i + len(seg)] += gain * seg * w[i : i + len(seg)]
                k += period
        # shimmer: sparse high plucks from the chord, two octaves up
        if s.get("shimmer"):
            end = sections[sections.index(s) + 1]["at"] if s is not sections[-1] else length
            k = s["at"]
            while k < end:
                f = hz(rng.choice(s["chord"])) * 4 * rng.choice([1, 1.5])
                i = int(k * SR)
                p = pluck(f, int(2.5 * SR))[: len(t) - i]
                mix[i : i + len(p)] += 0.06 * p * w[i : i + len(p)]
                k += rng.uniform(0.25, 0.9) / s["shimmer"]
        # flow noise: brown noise, swelling slowly
        if s.get("noise"):
            brown = np.cumsum(rng.normal(0, 1, len(t)))
            brown -= np.convolve(brown, np.ones(4096) / 4096, mode="same")  # remove drift
            brown /= np.abs(brown).max() + 1e-9
            mix += 0.12 * s["noise"] * w * brown * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t))

    fade = np.minimum(1, np.minimum(t / 2.0, (length - t) / 4.0))
    mix *= fade
    mix /= np.abs(mix).max() + 1e-9

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "score.wav"
        sf.write(wav, np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1) * 0.8, SR)  # slight stereo width
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav),
             "-af", "aecho=0.8:0.6:70|160|310:0.32|0.22|0.14,lowpass=f=7000,loudnorm=I=-20:TP=-2",
             "-ar", "44100", "-b:a", "192k", str(out_path)],
            check=True,
        )
    print(f"wrote {out_path} ({length:.0f}s, {len(sections)} sections)")


if __name__ == "__main__":
    main()

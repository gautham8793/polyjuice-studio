"""Synthesize the sound-effect library (own audio, no license needed) into library/sfx/.

Usage:
  tools/.venv/bin/python -I tools/make_sfx.py

Each effect is short and mono; loops (heartbeat, monitor, ventilator) are exactly one cycle long
so Remotion can loop them seamlessly. Scenes play them via `shot.sfx`.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I leaves the script folder off sys.path
from studio_paths import CONTENT_ROOT  # noqa: E402

OUT = CONTENT_ROOT / "library/sfx"
rng = np.random.default_rng(3)


def t_(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def env(t: np.ndarray, attack: float, decay: float) -> np.ndarray:
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-np.maximum(0, t - attack) / decay)


def lowpass(x: np.ndarray, k: int) -> np.ndarray:
    return np.convolve(x, np.ones(k) / k, mode="same")


def thump(t: np.ndarray, f0: float, f1: float, decay: float) -> np.ndarray:
    f = f1 + (f0 - f1) * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.004, decay)


def heartbeat() -> np.ndarray:  # one lub-dub per second (60 bpm loop)
    t = t_(1.0)
    out = 0.9 * thump(t, 80, 45, 0.09)
    i = int(0.24 * SR)
    out[i:] += 0.6 * thump(t[: len(t) - i], 90, 50, 0.07)
    return out


def monitor_beep() -> np.ndarray:  # hospital monitor: one soft beep per second
    t = t_(1.0)
    b = t < 0.14
    tone = np.sin(2 * np.pi * 980 * t) + 0.25 * np.sin(2 * np.pi * 1960 * t)
    return 0.5 * tone * b * np.minimum(1, t / 0.005) * np.minimum(1, (0.14 - t) / 0.02).clip(0, 1)


def ventilator() -> np.ndarray:  # 4 s breath cycle: filtered noise swelling in and out
    t = t_(4.0)
    noise = lowpass(rng.normal(0, 1, len(t)), 40) - lowpass(rng.normal(0, 1, len(t)), 400)
    breath = np.sin(np.pi * np.clip(t / 1.6, 0, 1)) ** 2 + 0.6 * np.sin(np.pi * np.clip((t - 1.9) / 1.8, 0, 1)) ** 2
    return 1.6 * noise * breath


def click() -> np.ndarray:  # receptor locking on: a crisp, slightly metallic click
    t = t_(0.35)
    tick = rng.normal(0, 1, len(t)) * env(t, 0.0005, 0.006)
    ring = (np.sin(2 * np.pi * 2400 * t) + 0.6 * np.sin(2 * np.pi * 3700 * t)) * env(t, 0.001, 0.05)
    return 0.8 * tick + 0.35 * ring + 0.5 * thump(t, 200, 120, 0.04)


def pop() -> np.ndarray:  # a pore opening
    t = t_(0.25)
    f = 900 * np.exp(-t * 30) + 180
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.002, 0.04)


def shimmer() -> np.ndarray:  # granzymes pouring in: a rising cloud of tiny bells
    t = t_(2.2)
    out = np.zeros_like(t)
    for _ in range(60):
        start = rng.uniform(0, 1.6)
        f = rng.uniform(1800, 4200) * (1 + start * 0.25)
        i = int(start * SR)
        tt = t[: len(t) - i]
        out[i:] += np.sin(2 * np.pi * f * tt) * env(tt, 0.002, 0.18) * rng.uniform(0.3, 1)
    return out * np.minimum(1, t / 0.4) * np.minimum(1, (2.2 - t) / 0.4)


def rumble() -> np.ndarray:  # a cell breaking apart: low, soft, settling
    t = t_(2.5)
    noise = lowpass(rng.normal(0, 1, len(t)), 300)
    return (3 * noise + 0.5 * np.sin(2 * np.pi * 42 * t)) * env(t, 0.15, 0.9)


def whoosh() -> np.ndarray:  # camera move / transition
    t = t_(1.2)
    n = rng.normal(0, 1, len(t))
    sweep = np.zeros_like(t)
    # band of noise sweeping up then down
    for k, w in ((60, 0.7), (25, 0.5), (10, 0.3)):
        sweep += w * (lowpass(n, k) - lowpass(n, k * 6))
    shape = np.sin(np.pi * np.clip(t / 1.2, 0, 1)) ** 3
    return 2.2 * sweep * shape


def hit() -> np.ndarray:  # chapter card / title: deep cinematic boom
    t = t_(3.0)
    boom = thump(t, 70, 32, 0.9)
    air = lowpass(rng.normal(0, 1, len(t)), 120) * env(t, 0.01, 0.5)
    return 0.9 * boom + 0.8 * air


def riser() -> np.ndarray:  # tension building into a reveal
    t = t_(3.0)
    f = 120 + 500 * (t / 3.0) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * lowpass(rng.normal(0, 1, len(t)), 30)
    return tone * (t / 3.0) ** 2 * np.minimum(1, (3.0 - t) / 0.05)


def tick() -> np.ndarray:  # counters and timeline points
    t = t_(0.12)
    return np.sin(2 * np.pi * 1500 * t) * env(t, 0.001, 0.02)


EFFECTS = {
    "heartbeat": heartbeat, "monitor-beep": monitor_beep, "ventilator": ventilator, "click": click,
    "pop": pop, "shimmer": shimmer, "rumble": rumble, "whoosh": whoosh, "hit": hit, "riser": riser, "tick": tick,
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in EFFECTS.items():
        x = make()
        x = 0.7 * x / (np.abs(x).max() + 1e-9)
        sf.write(OUT / f"{name}.wav", x.astype(np.float32), SR)
        print(f"library/sfx/{name}.wav  {len(x) / SR:.2f}s")

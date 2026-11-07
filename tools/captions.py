"""Word-level captions with whisper.cpp (local, free). Replaces captions.sh so it also runs on Windows.

Usage:
  python tools/captions.py voice.wav out/captions   -> writes out/captions.json

Needs `whisper-cli` (whisper.cpp) on PATH or in tools/bin/, and the model tools/models/ggml-base.en.bin.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
MODEL = TOOLS / "models" / "ggml-base.en.bin"


def whisper_cli() -> str:
    exe = "whisper-cli.exe" if sys.platform == "win32" else "whisper-cli"
    local = TOOLS / "bin" / exe
    found = str(local) if local.is_file() else shutil.which("whisper-cli")
    if not found:
        raise SystemExit("whisper-cli not found: install whisper.cpp or put it in tools/bin/")
    return found


def transcribe(audio: Path, out_base: Path) -> Path:
    with tempfile.TemporaryDirectory() as tmp:
        wav16 = Path(tmp) / "whisper.wav"
        # whisper.cpp expects 16 kHz mono PCM
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(audio),
                        "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav16)], check=True)
        # -ml 1 -sow: one word per segment, split on word boundaries
        cmd = [whisper_cli(), "-m", str(MODEL), "-f", str(wav16), "-ml", "1", "-sow", "-oj", "-of", str(out_base), "-np"]
        if subprocess.run(cmd, capture_output=True).returncode != 0:
            subprocess.run([cmd[0], "-ng", *cmd[1:]], check=True, capture_output=True)  # no GPU (Metal) available
    return out_base.with_suffix(".json")


if __name__ == "__main__":
    print(f"wrote {transcribe(Path(sys.argv[1]), Path(sys.argv[2]))}")

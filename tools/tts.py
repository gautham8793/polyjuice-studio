"""Text-to-speech: Kokoro (local, free) or Google Cloud (Indian-English Chirp3-HD voices).

Google voice ids look like "en-IN-Chirp3-HD-Iapetus"; the service-account key is read from
secrets/google-tts.json (or GOOGLE_APPLICATION_CREDENTIALS).

Usage:
  tools/.venv/bin/python tools/tts.py "Text to speak" out.wav [--voice am_michael] [--speed 1.0]
  tools/.venv/bin/python tools/tts.py @script.txt out.wav
"""
import argparse
import os
import re
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 24000
ROOT = Path(__file__).resolve().parent.parent


def is_google(voice_id: str) -> bool:
    return voice_id.startswith("en-IN-")


def speak_google(text: str, voice_id: str, speed: float, out: Path) -> None:
    from google.cloud import texttospeech as tts

    os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(ROOT / "secrets/google-tts.json"))
    # Kokoro phoneme overrides "[Lok Sabha](/lˈOk sˈʌbɑ/)" → plain words; Indian voices say them natively
    text = re.sub(r"\[([^\]]+)\]\(/[^)]*/\)", r"\1", text)
    response = tts.TextToSpeechClient().synthesize_speech(
        input=tts.SynthesisInput(text=text),
        voice=tts.VoiceSelectionParams(language_code=voice_id[:5], name=voice_id),
        audio_config=tts.AudioConfig(audio_encoding=tts.AudioEncoding.LINEAR16, sample_rate_hertz=SAMPLE_RATE, speaking_rate=speed),
    )
    Path(out).write_bytes(response.audio_content)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("text", help="Text, or @path to a text file")
    parser.add_argument("out", help="Output .wav path")
    parser.add_argument("--voice", default="am_michael")
    parser.add_argument("--speed", type=float, default=1.0)
    args = parser.parse_args()

    text = Path(args.text[1:]).read_text() if args.text.startswith("@") else args.text
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    if is_google(args.voice):
        speak_google(text, args.voice, args.speed, Path(args.out))
        print(f"wrote {args.out}")
        return
    # lang_code "a" = American English, "b" = British English
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    chunks = [audio for _, _, audio in pipeline(text, voice=args.voice, speed=args.speed)]

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.out, np.concatenate(chunks), SAMPLE_RATE)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()

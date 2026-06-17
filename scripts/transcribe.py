#!/usr/bin/env python3
"""Open-source speech-to-text using OpenAI Whisper.

Install: pip install openai-whisper
Usage: python transcribe.py <audio_path> <language_code>

Accepts WAV (preferred), WebM, MP4, or other formats when ffmpeg is available.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def to_wav(input_path: Path) -> Path:
    if input_path.suffix.lower() == ".wav":
        return input_path

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpeg is required to decode browser audio for Python Whisper."
        )

    output = Path(tempfile.gettempdir()) / f"{input_path.stem}.whisper.wav"
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(input_path),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-f",
            "wav",
            str(output),
        ],
        check=True,
        capture_output=True,
    )
    return output


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: transcribe.py <audio_path> <language_code>", file=sys.stderr)
        sys.exit(1)

    audio_path = Path(sys.argv[1])
    language = sys.argv[2]

    try:
        import whisper
    except ImportError as exc:
        print(
            "openai-whisper not installed. Run: pip install openai-whisper",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    wav_path = to_wav(audio_path)
    model = whisper.load_model("base")
    result = model.transcribe(str(wav_path), language=language, fp16=False)
    print(result["text"].strip())


if __name__ == "__main__":
    main()

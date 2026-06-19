#!/usr/bin/env python3
"""Speech-to-text using OpenAI Whisper with bundled ffmpeg support."""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def resolve_ffmpeg() -> str:
    candidates = [
        os.environ.get("FFMPEG_PATH"),
        shutil.which("ffmpeg"),
        Path(__file__).resolve().parent.parent
        / "node_modules"
        / "ffmpeg-static"
        / "ffmpeg.exe",
        Path(__file__).resolve().parent.parent
        / "node_modules"
        / "ffmpeg-static"
        / "ffmpeg",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return str(Path(candidate).resolve())
    raise RuntimeError(
        "ffmpeg not found. Run npm install in the backend folder."
    )


def ensure_ffmpeg_on_path() -> str:
    ffmpeg = resolve_ffmpeg()
    ffmpeg_dir = str(Path(ffmpeg).parent)
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    os.environ["FFMPEG_PATH"] = ffmpeg
    return ffmpeg


def to_wav(input_path: Path) -> Path:
    if input_path.suffix.lower() == ".wav":
        return input_path

    ffmpeg = ensure_ffmpeg_on_path()
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

    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    try:
        import whisper
    except ImportError as exc:
        print(
            "openai-whisper not installed. Run: pip install openai-whisper",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    ensure_ffmpeg_on_path()
    wav_path = to_wav(audio_path)

    model_name = os.environ.get("WHISPER_PY_MODEL", "base")
    model = whisper.load_model(model_name)
    result = model.transcribe(str(wav_path), language=language, fp16=False)
    text = result.get("text", "").strip()
    if not text:
        print("Whisper returned empty transcript", file=sys.stderr)
        sys.exit(2)
    print(text)


if __name__ == "__main__":
    main()

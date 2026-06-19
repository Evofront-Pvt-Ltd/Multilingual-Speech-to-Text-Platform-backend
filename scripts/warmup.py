#!/usr/bin/env python3
"""Pre-load OpenAI Whisper model at backend startup."""
import os
import shutil
import sys
from pathlib import Path


def ensure_ffmpeg_on_path() -> None:
    candidates = [
        os.environ.get("FFMPEG_PATH"),
        shutil.which("ffmpeg"),
        Path(__file__).resolve().parent.parent
        / "node_modules"
        / "ffmpeg-static"
        / "ffmpeg.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            ffmpeg = str(Path(candidate).resolve())
            os.environ["FFMPEG_PATH"] = ffmpeg
            os.environ["PATH"] = str(Path(ffmpeg).parent) + os.pathsep + os.environ.get("PATH", "")
            return
    raise RuntimeError("ffmpeg not found for Whisper warmup")


ensure_ffmpeg_on_path()

import whisper  # noqa: E402

model_name = os.environ.get("WHISPER_PY_MODEL", "base")
whisper.load_model(model_name)
print(f"Whisper {model_name} loaded")

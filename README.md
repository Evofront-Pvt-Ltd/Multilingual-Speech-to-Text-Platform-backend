# VoiceBridge AI — Backend

NestJS API for multilingual speech-to-text and translation (Phase 1 PoC).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health + Whisper engine status |
| `POST` | `/transcribe` | Upload audio + source language → transcript |
| `POST` | `/translate` | Translate text between languages |
| `POST` | `/translate/transcript` | Translate a stored transcript by ID |
| `GET` | `/transcripts` | List all transcripts + supported languages |
| `GET` | `/transcripts/:id` | Get a single transcript |

## Quick Start (Windows)

```powershell
cd "Multilingual-Speech-to-Text-Platform-backend"
.\start.ps1
```

Server runs at **http://localhost:3001**.

On first start, `yarn install` runs automatically. The Whisper AI model (~150MB) downloads on the first transcription — wait until the terminal shows:

```
Whisper neural engine ready.
```

## Phase 1 User Flow

1. User selects **source language** (English, Hindi, Kannada, etc.)
2. User **records voice** in the browser
3. Audio is sent to `POST /transcribe`
4. **Whisper** converts speech to text (no Python required)
5. User selects **target language** and calls `POST /translate`
6. Transcript + translation are stored in `data/transcripts.json`

## Speech-to-Text (Node.js Whisper)

Built-in — no Python install needed for the PoC demo.

| Package | Role |
|---------|------|
| `@xenova/transformers` | Open-source Whisper in Node.js |
| `ffmpeg-static` | Converts browser WebM/MP4 to WAV |
| `wavefile` | Decodes WAV for the Whisper pipeline |

Optional: set `WHISPER_MODEL=Xenova/whisper-small` in `.env` for better Indian language accuracy (slower, larger download).

Optional Python fallback (not required): set `ENABLE_PYTHON_WHISPER=true` and run `pip install -r scripts/requirements.txt`.

## Translation

Uses `google-translate-api-x` (open-source client). Requires internet access.

Supported languages: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin (comma-separated) |
| `WHISPER_MODEL` | `Xenova/whisper-base` | Hugging Face Whisper model ID |
| `ENABLE_PYTHON_WHISPER` | unset | Set to `true` to enable optional Python fallback |
| `PYTHON_PATH` | `python` | Python executable (only if Python fallback enabled) |

## Data Storage

- Transcripts: `data/transcripts.json` (UTF-8)
- Audio uploads: `uploads/`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Demo/placeholder transcript | Restart backend after `yarn install`; record again |
| `AudioContext` error | Backend is outdated — pull latest and restart |
| Translation fails | Check internet; Google translate client needs network |
| First transcription slow | Normal — Whisper model is downloading (~150MB) |
| Port 3001 in use | Run `.\start.ps1` — it frees the port automatically |

## Demo Checklist

- [ ] Backend running — `GET http://localhost:3001/health` shows `"ready": true`
- [ ] Frontend running — `http://localhost:3000`
- [ ] Record 5+ seconds of clear speech
- [ ] Transcript shows **Neural Engine** (not demo placeholder)
- [ ] Translate to Hindi or Kannada — script renders correctly

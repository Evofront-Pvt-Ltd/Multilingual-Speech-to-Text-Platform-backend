# VoiceBridge AI — Backend

NestJS API for the VoiceBridge AI enterprise voice intelligence platform.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |
| `PYTHON_PATH` | `python` | Python executable for Whisper STT |

## Speech-to-Text

Uses OpenAI Whisper when available, with automatic fallback to standard mode.

```bash
pip install -r scripts/requirements.txt
```

## Data Storage

Transcripts are persisted as JSON in `data/transcripts.json`. Audio files are stored in `uploads/`.

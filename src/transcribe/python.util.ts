import * as fs from 'fs';
import * as path from 'path';

/** Resolve a working Python executable for OpenAI Whisper. */
export function resolvePythonExecutable(): string | null {
  const candidates = [
    process.env.PYTHON_PATH,
    path.join(
      process.env.USERPROFILE ?? '',
      '.cache',
      'codex-runtimes',
      'codex-primary-runtime',
      'dependencies',
      'python',
      'python.exe',
    ),
    path.join(
      process.env.LOCALAPPDATA ?? '',
      'Programs',
      'Python',
      'Python312',
      'python.exe',
    ),
    path.join(
      process.env.LOCALAPPDATA ?? '',
      'Programs',
      'Python',
      'Python311',
      'python.exe',
    ),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate.endsWith('.exe') && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/** ffmpeg binary for Python Whisper (openai-whisper calls ffmpeg internally). */
export function resolveFfmpegExecutable(): string | null {
  const candidates = [
    process.env.FFMPEG_PATH,
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function pythonExecEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const python = resolvePythonExecutable();
  if (python) {
    env.PYTHON_PATH = python;
  }

  const ffmpeg = resolveFfmpegExecutable();
  if (ffmpeg) {
    env.FFMPEG_PATH = ffmpeg;
    const ffmpegDir = path.dirname(ffmpeg);
    env.PATH = `${ffmpegDir};${env.PATH ?? ''}`;
  }

  return env;
}

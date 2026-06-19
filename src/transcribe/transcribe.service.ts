import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { LANGUAGE_CODES } from '../common/languages';
import { StorageService } from '../common/storage.service';
import {
  convertAudioToWav,
  safeUnlink,
  tempWavPath,
} from './audio.util';
import {
  isLikelyHallucination,
  mergeTranscripts,
  pickBestTranscript,
} from './transcript-picker.util';
import { NATIVE_SCRIPT_LANGUAGES } from './whisper.constants';
import { isValidTranscript, acceptBrowserTranscript } from './whisper.constants';
import { pythonExecEnv, resolvePythonExecutable } from './python.util';
import { EngineStatus, WhisperNodeEngine } from './whisper-node.engine';

const execFileAsync = promisify(execFile);

@Injectable()
export class TranscribeService implements OnModuleInit {
  private readonly logger = new Logger(TranscribeService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  private readonly scriptsDir = path.join(process.cwd(), 'scripts');
  private readonly whisperNode = new WhisperNodeEngine();

  constructor(private readonly storage: StorageService) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  onModuleInit(): void {
    this.whisperNode.preload().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Whisper preload will retry on first recording: ${message}`);
    });
    this.warmPythonWhisper().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Python Whisper warmup skipped: ${message}`);
    });
  }

  /** Pre-load Python Whisper model so first client recording is fast. */
  private async warmPythonWhisper(): Promise<void> {
    const pythonCmd = resolvePythonExecutable();
    if (!pythonCmd) return;

    const warmupScript = path.join(this.scriptsDir, 'warmup.py');
    if (!fs.existsSync(warmupScript)) return;

    this.logger.log('Warming Python Whisper model (first run may take 1–2 min)…');
    await execFileAsync(pythonCmd, [warmupScript], {
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
      env: pythonExecEnv(),
    });
    this.logger.log('Python Whisper ready.');
  }

  getEngineStatus(): {
    status: EngineStatus;
    model: string;
    error: string | null;
  } {
    return {
      status: this.whisperNode.getStatus(),
      model: this.whisperNode.getModelName(),
      error: this.whisperNode.getLastError(),
    };
  }

  async transcribe(
    audioBuffer: Buffer,
    sourceLanguage: string,
    originalFilename: string,
    browserFallback?: string,
  ) {
    const text = await this.runTranscription(
      audioBuffer,
      sourceLanguage,
      originalFilename,
      false,
      browserFallback,
    );

    const ext = path.extname(originalFilename) || '.webm';
    const audioFilename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const audioPath = path.join(this.uploadsDir, audioFilename);
    fs.writeFileSync(audioPath, audioBuffer);

    const record = this.storage.create({
      sourceLanguage,
      originalText: text,
      audioFilename,
      transcriptionMode: 'whisper',
    });

    return {
      id: record.id,
      text,
      sourceLanguage,
      mode: 'whisper' as const,
      createdAt: record.createdAt,
    };
  }

  /** Save browser live transcript instantly — no audio / Whisper processing. */
  async saveFromBrowserText(sourceLanguage: string, text: string) {
    if (!LANGUAGE_CODES.has(sourceLanguage)) {
      throw new BadRequestException(
        `Unsupported source language: ${sourceLanguage}`,
      );
    }

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      throw new BadRequestException('Transcript text is required');
    }
    if (!acceptBrowserTranscript(cleaned, sourceLanguage)) {
      throw new BadRequestException(
        'Live transcript was not valid for the selected language',
      );
    }

    this.logger.log(
      `Saved browser transcript (${sourceLanguage}, ${cleaned.length} chars)`,
    );

    const record = this.storage.create({
      sourceLanguage,
      originalText: cleaned,
      transcriptionMode: 'whisper',
    });

    return {
      id: record.id,
      text: cleaned,
      sourceLanguage,
      mode: 'whisper' as const,
      createdAt: record.createdAt,
    };
  }

  /** Live preview — fast Node Whisper only (never blocks on Python). */
  async previewTranscribe(
    audioBuffer: Buffer,
    sourceLanguage: string,
    originalFilename: string,
  ) {
    if (audioBuffer.length < 2000) {
      return { text: '', sourceLanguage, mode: 'preview' as const };
    }

    try {
      const text = await this.runFastPreview(
        audioBuffer,
        sourceLanguage,
        originalFilename,
      );
      return { text, sourceLanguage, mode: 'preview' as const };
    } catch {
      return { text: '', sourceLanguage, mode: 'preview' as const };
    }
  }

  private async runFastPreview(
    audioBuffer: Buffer,
    sourceLanguage: string,
    originalFilename: string,
  ): Promise<string> {
    const ext = path.extname(originalFilename) || '.webm';
    const audioPath = path.join(
      this.uploadsDir,
      `preview-${Date.now()}-${crypto.randomUUID()}${ext}`,
    );
    const wavPath = tempWavPath(audioPath);

    fs.writeFileSync(audioPath, audioBuffer);

    try {
      await convertAudioToWav(audioPath, wavPath);
      const text = await this.whisperNode.transcribeFast(wavPath, sourceLanguage);
      if (isValidTranscript(text, sourceLanguage)) return text;
      return text.trim();
    } finally {
      safeUnlink(audioPath);
      safeUnlink(wavPath);
    }
  }

  private async runTranscription(
    audioBuffer: Buffer,
    sourceLanguage: string,
    originalFilename: string,
    allowEmpty: boolean,
    browserFallback?: string,
  ): Promise<string> {
    if (!LANGUAGE_CODES.has(sourceLanguage)) {
      throw new BadRequestException(
        `Unsupported source language: ${sourceLanguage}`,
      );
    }

    const minBytes = allowEmpty ? 2000 : 100;
    if (audioBuffer.length < minBytes) {
      if (allowEmpty) return '';
      throw new BadRequestException(
        'Recording is too short. Please record at least 2–3 seconds of speech.',
      );
    }

    const ext = path.extname(originalFilename) || '.webm';
    const audioPath = path.join(
      this.uploadsDir,
      `job-${Date.now()}-${crypto.randomUUID()}${ext}`,
    );
    const wavPath = tempWavPath(audioPath);

    try {
      fs.writeFileSync(audioPath, audioBuffer);

      const fallback = browserFallback?.replace(/\s+/g, ' ').trim();
      const isIndic = NATIVE_SCRIPT_LANGUAGES.has(sourceLanguage);

      if (fallback && acceptBrowserTranscript(fallback, sourceLanguage)) {
        this.logger.log(
          `Instant transcript from browser (${sourceLanguage}, ${fallback.length} chars)`,
        );
        return fallback;
      }

      if (fallback) {
        this.logger.warn(
          `Browser fallback rejected for ${sourceLanguage}: "${fallback.slice(0, 40)}"`,
        );
      }

      await convertAudioToWav(audioPath, wavPath);

      const candidates: Array<string | undefined> = [];
      if (fallback) candidates.push(fallback);

      if (isIndic) {
        try {
          candidates.push(
            await this.transcribeWithPythonWhisper(wavPath, sourceLanguage, 90000),
          );
        } catch (pythonError) {
          const pyMessage =
            pythonError instanceof Error
              ? pythonError.message
              : String(pythonError);
          this.logger.warn(`Python Whisper failed: ${pyMessage}`);
        }
      } else {
        const nodeText = await Promise.race([
          this.whisperNode.transcribe(wavPath, sourceLanguage).catch((error) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(`Node Whisper failed: ${message}`);
            return undefined;
          }),
          new Promise<string | undefined>((resolve) =>
            setTimeout(() => resolve(undefined), 30000),
          ),
        ]);
        if (nodeText) candidates.push(nodeText);
      }

      let text = pickBestTranscript(candidates, sourceLanguage);

      if (
        text &&
        isLikelyHallucination(text) &&
        fallback &&
        fallback.length > text.length + 5 &&
        isValidTranscript(fallback, sourceLanguage)
      ) {
        text = fallback;
      }

      if (!text && fallback && isValidTranscript(fallback, sourceLanguage)) {
        this.logger.log(`Using browser capture for ${sourceLanguage}`);
        text = fallback;
      }

      if (!text && !isIndic) {
        try {
          candidates.push(
            await this.transcribeWithPythonWhisper(wavPath, sourceLanguage, 60000),
          );
          text = pickBestTranscript(candidates, sourceLanguage);
        } catch (pythonError) {
          const pyMessage =
            pythonError instanceof Error
              ? pythonError.message
              : String(pythonError);
          this.logger.warn(`Python Whisper failed: ${pyMessage}`);
        }
      }

      if (!text && fallback && isValidTranscript(fallback, sourceLanguage)) {
        text = fallback;
      }

      if (!text) {
        if (allowEmpty) return '';
        const langName = sourceLanguage.toUpperCase();
        throw new ServiceUnavailableException(
          `Could not transcribe ${langName}. Speak clearly for 8+ seconds in Chrome/Edge with the correct language selected.`,
        );
      }

      if (fallback && isValidTranscript(fallback, sourceLanguage)) {
        const merged = mergeTranscripts(text, fallback, sourceLanguage);
        if (merged.length > text.length) {
          this.logger.log(`Merged browser capture into final ${sourceLanguage} transcript`);
          text = merged;
        }
      }

      return text;
    } finally {
      safeUnlink(audioPath);
      safeUnlink(wavPath);
    }
  }

  private async transcribeWithPythonWhisper(
    audioPath: string,
    language: string,
    timeoutMs = 180000,
  ): Promise<string> {
    const scriptPath = path.join(this.scriptsDir, 'transcribe.py');
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Python Whisper script not found');
    }

    const pythonCmd = resolvePythonExecutable();
    if (!pythonCmd) {
      throw new Error(
        'Python not found. Run setup-python-whisper.ps1 in the backend folder.',
      );
    }

    this.logger.log(`Running Python Whisper with ${pythonCmd}`);

    const { stdout } = await execFileAsync(
      pythonCmd,
      [scriptPath, audioPath, language],
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: pythonExecEnv(),
      },
    );

    const result = stdout.trim();
    if (!result) {
      throw new Error('Python Whisper returned empty transcript');
    }
    return result;
  }
}

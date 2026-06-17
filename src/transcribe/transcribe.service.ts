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
  ) {
    if (!LANGUAGE_CODES.has(sourceLanguage)) {
      throw new BadRequestException(
        `Unsupported source language: ${sourceLanguage}`,
      );
    }

    if (audioBuffer.length < 100) {
      throw new BadRequestException(
        'Recording is too short. Please record at least 2–3 seconds of speech.',
      );
    }

    const ext = path.extname(originalFilename) || '.webm';
    const audioFilename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const audioPath = path.join(this.uploadsDir, audioFilename);
    const wavPath = tempWavPath(audioPath);

    fs.writeFileSync(audioPath, audioBuffer);

    try {
      await convertAudioToWav(audioPath, wavPath);

      let text: string | undefined;

      try {
        text = await this.whisperNode.transcribe(wavPath, sourceLanguage);
      } catch (nodeError) {
        const message =
          nodeError instanceof Error ? nodeError.message : String(nodeError);
        this.logger.warn(`Node Whisper failed: ${message}`);

        if (process.env.ENABLE_PYTHON_WHISPER === 'true') {
          try {
            text = await this.transcribeWithPythonWhisper(
              wavPath,
              sourceLanguage,
            );
          } catch (pythonError) {
            const pyMessage =
              pythonError instanceof Error
                ? pythonError.message
                : String(pythonError);
            this.logger.warn(`Python Whisper failed: ${pyMessage}`);
          }
        }

        if (text === undefined) {
          throw new ServiceUnavailableException(
            `Speech-to-text failed: ${message}`,
          );
        }
      }

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
    } catch (error) {
      safeUnlink(audioPath);
      safeUnlink(wavPath);
      throw error;
    }
  }

  private async transcribeWithPythonWhisper(
    audioPath: string,
    language: string,
  ): Promise<string> {
    const scriptPath = path.join(this.scriptsDir, 'transcribe.py');
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Python Whisper script not found');
    }

    const pythonCandidates = [
      process.env.PYTHON_PATH,
      'python3',
      'python',
      'py',
    ].filter(Boolean) as string[];

    let lastError: Error | undefined;

    for (const pythonCmd of pythonCandidates) {
      try {
        const { stdout } = await execFileAsync(
          pythonCmd,
          [scriptPath, audioPath, language],
          { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
        );

        const result = stdout.trim();
        if (!result) {
          throw new Error('Python Whisper returned empty transcript');
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error('Python is not installed');
  }
}

import { Logger } from '@nestjs/common';
import {
  DEFAULT_WHISPER_MODEL,
  WHISPER_LANGUAGE_NAMES,
} from './whisper.constants';
import { readWavAsFloat32 } from './wav-decode.util';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

type WhisperPipeline = (
  audio: Float32Array | string,
  options?: Record<string, unknown>,
) => Promise<{ text?: string }>;

export class WhisperNodeEngine {
  private readonly logger = new Logger(WhisperNodeEngine.name);
  private pipeline: WhisperPipeline | null = null;
  private pipelinePromise: Promise<WhisperPipeline> | null = null;
  private status: EngineStatus = 'idle';
  private lastError: string | null = null;

  getStatus(): EngineStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getModelName(): string {
    return DEFAULT_WHISPER_MODEL;
  }

  preload(): Promise<void> {
    return this.getPipeline().then(() => undefined);
  }

  async transcribe(wavPath: string, languageCode: string): Promise<string> {
    const transcriber = await this.getPipeline();
    const audio = readWavAsFloat32(wavPath);

    const language =
      WHISPER_LANGUAGE_NAMES[languageCode] ??
      WHISPER_LANGUAGE_NAMES.en ??
      'english';

    const output = await transcriber(audio, {
      language,
      task: 'transcribe',
      return_timestamps: false,
    });

    const text = (output?.text ?? '').trim();
    if (!text) {
      throw new Error(
        'Speech engine could not detect any words. Speak clearly for at least 2–3 seconds.',
      );
    }

    return text;
  }

  private async getPipeline(): Promise<WhisperPipeline> {
    if (this.pipeline) return this.pipeline;
    if (this.pipelinePromise) return this.pipelinePromise;

    this.status = 'loading';
    this.pipelinePromise = (async () => {
      try {
        this.logger.log(
          `Loading Whisper model "${DEFAULT_WHISPER_MODEL}" (first run downloads ~150MB)…`,
        );
        const { pipeline, env } = await import('@xenova/transformers');
        env.allowLocalModels = true;
        env.useBrowserCache = false;
        const instance = (await pipeline(
          'automatic-speech-recognition',
          DEFAULT_WHISPER_MODEL,
        )) as WhisperPipeline;
        this.pipeline = instance;
        this.status = 'ready';
        this.lastError = null;
        this.logger.log('Whisper neural engine ready.');
        return instance;
      } catch (error) {
        this.status = 'error';
        this.lastError =
          error instanceof Error ? error.message : String(error);
        this.pipelinePromise = null;
        throw error;
      }
    })();

    return this.pipelinePromise;
  }
}

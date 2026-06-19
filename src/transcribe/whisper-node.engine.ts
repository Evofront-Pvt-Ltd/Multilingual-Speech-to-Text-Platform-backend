import { Logger } from '@nestjs/common';
import {
  DEFAULT_WHISPER_MODEL,
  INDIC_WHISPER_MODEL,
  isValidTranscript,
  languageStrategies,
  modelsForLanguage,
  NATIVE_SCRIPT_LANGUAGES,
  WHISPER_LANGUAGE_NAMES,
} from './whisper.constants';
import { sanitizeWhisperText } from './whisper-output.util';
import { readWavAsFloat32 } from './wav-decode.util';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

type WhisperPipeline = (
  audio: Float32Array | string,
  options?: Record<string, unknown>,
) => Promise<{ text?: string }>;

type CachedPipeline = {
  modelId: string;
  pipeline: WhisperPipeline;
};

export class WhisperNodeEngine {
  private readonly logger = new Logger(WhisperNodeEngine.name);
  private readonly pipelines = new Map<string, WhisperPipeline>();
  private status: EngineStatus = 'idle';
  private lastError: string | null = null;
  private loadedModelName = DEFAULT_WHISPER_MODEL;

  getStatus(): EngineStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getModelName(): string {
    return this.loadedModelName;
  }

  preload(): Promise<void> {
    return this.getPipeline(DEFAULT_WHISPER_MODEL).then(() => undefined);
  }

  preloadIndic(): Promise<void> {
    if (INDIC_WHISPER_MODEL === DEFAULT_WHISPER_MODEL) {
      return Promise.resolve();
    }
    return this.getPipeline(INDIC_WHISPER_MODEL).then(() => undefined);
  }

  async transcribe(wavPath: string, languageCode: string): Promise<string> {
    const audio = readWavAsFloat32(wavPath);
    const models = modelsForLanguage(languageCode);
    const strategies = languageStrategies(languageCode);

    let bestText = '';
    let bestScore = -1;

    for (const modelId of models) {
      const pipeline = await this.getPipeline(modelId);

      for (const language of strategies) {
        try {
          const text = await this.runOnce(pipeline, audio, language);
          if (!isValidTranscript(text, languageCode)) {
            this.logger.warn(
              `Rejected ${modelId} (${language ?? 'auto'}): "${text.slice(0, 40)}"`,
            );
            continue;
          }

          const score = text.length;
          if (score > bestScore) {
            bestScore = score;
            bestText = text;
            this.loadedModelName = modelId;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Attempt failed ${modelId} (${language ?? 'auto'}): ${message}`,
          );
        }
      }
    }

    if (bestText) return bestText;

    throw new Error(
      `Could not transcribe ${languageCode.toUpperCase()} speech. Speak clearly for 8+ seconds in a quiet room, with the correct source language selected.`,
    );
  }

  /** Single fast pass for live preview — avoids multi-model delays. */
  async transcribeFast(wavPath: string, languageCode: string): Promise<string> {
    const audio = readWavAsFloat32(wavPath);
    const modelId = NATIVE_SCRIPT_LANGUAGES.has(languageCode)
      ? INDIC_WHISPER_MODEL
      : DEFAULT_WHISPER_MODEL;
    const pipeline = await this.getPipeline(modelId);
    const language =
      WHISPER_LANGUAGE_NAMES[languageCode] ?? languageCode;

    const text = await this.runOnce(pipeline, audio, language);
    if (text) return text;

    throw new Error(`Preview transcription empty for ${languageCode}`);
  }

  private async runOnce(
    pipeline: WhisperPipeline,
    audio: Float32Array,
    language: string | null,
  ): Promise<string> {
    const options: Record<string, unknown> = {
      task: 'transcribe',
      return_timestamps: false,
      chunk_length_s: 30,
      stride_length_s: 5,
    };
    if (language) {
      options.language = language;
    }

    const output = await pipeline(audio, options);
    return sanitizeWhisperText((output?.text ?? '').trim());
  }

  private async getPipeline(modelId: string): Promise<WhisperPipeline> {
    const cached = this.pipelines.get(modelId);
    if (cached) return cached;

    // One model in RAM at a time — loading both caused OOM crashes on Windows.
    if (this.pipelines.size > 0) {
      this.pipelines.clear();
    }

    this.status = 'loading';

    try {
      this.logger.log(`Loading Whisper "${modelId}"…`);
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = true;
      env.useBrowserCache = false;
      const instance = (await pipeline('automatic-speech-recognition', modelId, {
        quantized: true,
      })) as WhisperPipeline;

      this.pipelines.set(modelId, instance);
      this.status = 'ready';
      this.lastError = null;
      this.logger.log(`Whisper ready: ${modelId}`);
      return instance;
    } catch (error) {
      this.status = 'error';
      this.lastError =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
}

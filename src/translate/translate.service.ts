import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { translate } from 'google-translate-api-x';
import { LANGUAGE_CODES } from '../common/languages';
import { StorageService } from '../common/storage.service';

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly scriptsDir = path.join(process.cwd(), 'scripts');

  constructor(private readonly storage: StorageService) {}

  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    transcriptId?: string,
  ) {
    if (!LANGUAGE_CODES.has(sourceLanguage)) {
      throw new BadRequestException(
        `Unsupported source language: ${sourceLanguage}`,
      );
    }
    if (!LANGUAGE_CODES.has(targetLanguage)) {
      throw new BadRequestException(
        `Unsupported target language: ${targetLanguage}`,
      );
    }
    if (sourceLanguage === targetLanguage) {
      const result = {
        text,
        sourceLanguage,
        targetLanguage,
        mode: 'passthrough' as const,
      };
      if (transcriptId) {
        this.storage.update(transcriptId, {
          targetLanguage,
          translatedText: text,
        });
      }
      return { ...result, transcriptId };
    }

    const { text: translatedText, mode } = await this.translateWithFallback(
      text,
      sourceLanguage,
      targetLanguage,
    );

    if (transcriptId) {
      const record = this.storage.findById(transcriptId);
      if (!record) {
        throw new NotFoundException(`Transcript ${transcriptId} not found`);
      }
      this.storage.update(transcriptId, {
        targetLanguage,
        translatedText,
      });
    } else if (text.trim()) {
      this.storage.create({
        sourceLanguage,
        targetLanguage,
        originalText: text,
        translatedText,
      });
    }

    return {
      text: translatedText,
      sourceLanguage,
      targetLanguage,
      mode,
      transcriptId,
    };
  }

  async translateTranscript(transcriptId: string, targetLanguage: string) {
    const record = this.storage.findById(transcriptId);
    if (!record) {
      throw new NotFoundException(`Transcript ${transcriptId} not found`);
    }

    return this.translateText(
      record.originalText,
      record.sourceLanguage,
      targetLanguage,
      transcriptId,
    );
  }

  private async translateWithFallback(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<{ text: string; mode: 'google' | 'fallback' }> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException('Text to translate cannot be empty');
    }

    try {
      const result = await this.translateViaGoogle(trimmed, sourceLanguage, targetLanguage);
      return { text: result, mode: 'google' };
    } catch (primaryError) {
      const primaryMessage =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      this.logger.warn(`Primary translation failed: ${primaryMessage}`);
    }

    try {
      const result = await this.translateViaPython(trimmed, sourceLanguage, targetLanguage);
      return { text: result, mode: 'fallback' };
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      this.logger.error(`Fallback translation failed: ${fallbackMessage}`);
    }

    throw new ServiceUnavailableException(
      `Translation unavailable (${sourceLanguage} → ${targetLanguage}). Please check your internet connection and try again.`,
    );
  }

  private async translateViaGoogle(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string> {
    const chunks = this.splitIntoChunks(text);
    const translated: string[] = [];

    for (const chunk of chunks) {
      const part = await this.translateChunkWithRetry(chunk, sourceLanguage, targetLanguage);
      translated.push(part);
    }

    return translated.join(' ').replace(/\s+/g, ' ').trim();
  }

  private async translateChunkWithRetry(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    attempts = 3,
  ): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await translate(text, {
          from: sourceLanguage,
          to: targetLanguage,
        });
        const result = response.text?.trim() ?? '';
        if (!result) {
          throw new Error('Translation API returned empty text');
        }
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await this.delay(attempt * 500);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Translation failed after retries');
  }

  private async translateViaPython(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string> {
    const scriptPath = path.join(this.scriptsDir, 'translate.py');
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Python translation script not found');
    }

    const pythonCmd = process.env.PYTHON_PATH ?? 'python';
    const chunks = this.splitIntoChunks(text);
    const translated: string[] = [];

    for (const chunk of chunks) {
      const result = await this.runPythonChunk(
        pythonCmd,
        scriptPath,
        chunk,
        sourceLanguage,
        targetLanguage,
      );
      translated.push(result);
    }

    return translated.join(' ').replace(/\s+/g, ' ').trim();
  }

  private splitIntoChunks(text: string, maxLength = 450): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (trimmed.length > maxLength) {
        if (current) {
          chunks.push(current.trim());
          current = '';
        }
        for (let i = 0; i < trimmed.length; i += maxLength) {
          chunks.push(trimmed.slice(i, i + maxLength).trim());
        }
        continue;
      }

      const next = current ? `${current} ${trimmed}` : trimmed;
      if (next.length > maxLength) {
        chunks.push(current.trim());
        current = trimmed;
      } else {
        current = next;
      }
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  private runPythonChunk(
    pythonCmd: string,
    scriptPath: string,
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(pythonCmd, [scriptPath, sourceLanguage, targetLanguage], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        const result = stdout.trim();
        if (code === 0 && result) {
          resolve(result);
          return;
        }
        reject(new Error(stderr.trim() || 'Python translation failed'));
      });

      proc.stdin.write(text);
      proc.stdin.end();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

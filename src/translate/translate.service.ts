import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { translate } from 'google-translate-api-x';
import { LANGUAGE_CODES } from '../common/languages';
import { StorageService } from '../common/storage.service';

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(private readonly storage: StorageService) {}

  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    transcriptId?: string,
  ) {
    if (!LANGUAGE_CODES.has(sourceLanguage)) {
      throw new Error(`Unsupported source language: ${sourceLanguage}`);
    }
    if (!LANGUAGE_CODES.has(targetLanguage)) {
      throw new Error(`Unsupported target language: ${targetLanguage}`);
    }
    if (sourceLanguage === targetLanguage) {
      const result = { text, sourceLanguage, targetLanguage, mode: 'passthrough' as const };
      if (transcriptId) {
        this.storage.update(transcriptId, {
          targetLanguage,
          translatedText: text,
        });
      }
      return result;
    }

    let translatedText: string;
    let mode: 'google' | 'demo';

    try {
      const response = await translate(text, {
        from: sourceLanguage,
        to: targetLanguage,
      });
      translatedText = response.text;
      mode = 'google';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Translation API failed, using demo mode: ${message}`);
      translatedText = `[Demo translation ${sourceLanguage} → ${targetLanguage}] ${text}`;
      mode = 'demo';
    }

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

  async translateTranscript(
    transcriptId: string,
    targetLanguage: string,
  ) {
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
}

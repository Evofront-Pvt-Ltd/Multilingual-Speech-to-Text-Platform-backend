import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TranscriptRecord {
  id: string;
  sourceLanguage: string;
  targetLanguage?: string;
  originalText: string;
  translatedText?: string;
  audioFilename?: string;
  transcriptionMode?: 'whisper' | 'demo';
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class StorageService {
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly dataFile = path.join(this.dataDir, 'transcripts.json');

  constructor() {
    this.ensureDataFile();
  }

  private ensureDataFile(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private readAll(): TranscriptRecord[] {
    const raw = fs.readFileSync(this.dataFile, 'utf-8');
    return JSON.parse(raw) as TranscriptRecord[];
  }

  private writeAll(records: TranscriptRecord[]): void {
    fs.writeFileSync(this.dataFile, JSON.stringify(records, null, 2), 'utf-8');
  }

  findAll(): TranscriptRecord[] {
    return this.readAll().sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  findById(id: string): TranscriptRecord | undefined {
    return this.readAll().find((record) => record.id === id);
  }

  create(
    data: Omit<TranscriptRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): TranscriptRecord {
    const now = new Date().toISOString();
    const record: TranscriptRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const records = this.readAll();
    records.push(record);
    this.writeAll(records);
    return record;
  }

  update(
    id: string,
    data: Partial<Pick<TranscriptRecord, 'targetLanguage' | 'translatedText'>>,
  ): TranscriptRecord | undefined {
    const records = this.readAll();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return undefined;

    records[index] = {
      ...records[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.writeAll(records);
    return records[index];
  }
}

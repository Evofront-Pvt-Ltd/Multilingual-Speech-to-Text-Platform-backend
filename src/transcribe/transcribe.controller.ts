import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TranscribeService } from './transcribe.service';

@Controller('transcribe')
export class TranscribeController {
  constructor(private readonly transcribeService: TranscribeService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') language: string,
    @Body('browserText') browserText?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    if (!language) {
      throw new BadRequestException('Source language is required');
    }

    return this.transcribeService.transcribe(
      file.buffer,
      language,
      file.originalname,
      browserText,
    );
  }

  @Post('save-text')
  async saveText(
    @Body('language') language: string,
    @Body('text') text: string,
  ) {
    if (!language) {
      throw new BadRequestException('Source language is required');
    }
    if (!text?.trim()) {
      throw new BadRequestException('Transcript text is required');
    }

    return this.transcribeService.saveFromBrowserText(language, text);
  }

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') language: string,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    if (!language) {
      throw new BadRequestException('Source language is required');
    }

    return this.transcribeService.previewTranscribe(
      file.buffer,
      language,
      file.originalname,
    );
  }
}

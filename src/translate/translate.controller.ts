import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../common/languages';
import { TranslateService } from './translate.service';

const codes = SUPPORTED_LANGUAGES.map((l) => l.code);

class TranslateDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsString()
  @IsIn(codes)
  sourceLanguage!: string;

  @IsString()
  @IsIn(codes)
  targetLanguage!: string;

  @IsOptional()
  @IsUUID()
  transcriptId?: string;
}

class TranslateTranscriptDto {
  @IsUUID()
  transcriptId!: string;

  @IsString()
  @IsIn(codes)
  targetLanguage!: string;
}

@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post()
  translate(@Body() dto: TranslateDto) {
    return this.translateService.translateText(
      dto.text,
      dto.sourceLanguage,
      dto.targetLanguage,
      dto.transcriptId,
    );
  }

  @Post('transcript')
  translateTranscript(@Body() dto: TranslateTranscriptDto) {
    return this.translateService.translateTranscript(
      dto.transcriptId,
      dto.targetLanguage,
    );
  }
}

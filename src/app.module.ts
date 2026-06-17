import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { TranscribeModule } from './transcribe/transcribe.module';
import { TranslateModule } from './translate/translate.module';
import { TranscriptsModule } from './transcripts/transcripts.module';

@Module({
  imports: [
    CommonModule,
    HealthModule,
    TranscribeModule,
    TranslateModule,
    TranscriptsModule,
  ],
})
export class AppModule {}

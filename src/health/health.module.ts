import { Module } from '@nestjs/common';
import { TranscribeModule } from '../transcribe/transcribe.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TranscribeModule],
  controllers: [HealthController],
})
export class HealthModule {}

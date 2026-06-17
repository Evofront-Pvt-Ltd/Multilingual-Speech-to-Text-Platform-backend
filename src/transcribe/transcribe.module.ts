import { Module } from '@nestjs/common';
import { TranscribeController } from './transcribe.controller';
import { TranscribeService } from './transcribe.service';

@Module({
  controllers: [TranscribeController],
  providers: [TranscribeService],
  exports: [TranscribeService],
})
export class TranscribeModule {}

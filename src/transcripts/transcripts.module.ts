import { Module } from '@nestjs/common';
import { TranscriptsController } from './transcripts.controller';

@Module({
  controllers: [TranscriptsController],
})
export class TranscriptsModule {}

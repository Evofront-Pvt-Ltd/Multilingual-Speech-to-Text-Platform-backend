import { Controller, Get } from '@nestjs/common';
import { TranscribeService } from '../transcribe/transcribe.service';

@Controller('health')
export class HealthController {
  constructor(private readonly transcribeService: TranscribeService) {}

  @Get()
  check() {
    const engine = this.transcribeService.getEngineStatus();
    return {
      status: 'ok',
      service: 'VoiceBridge AI',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      engine: {
        speechToText: engine.status,
        model: engine.model,
        ready: engine.status === 'ready',
        error: engine.error,
      },
    };
  }
}

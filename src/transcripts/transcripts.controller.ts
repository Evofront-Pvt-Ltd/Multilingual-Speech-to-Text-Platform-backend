import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { SUPPORTED_LANGUAGES } from '../common/languages';
import { StorageService } from '../common/storage.service';

@Controller('transcripts')
export class TranscriptsController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  findAll() {
    return {
      languages: SUPPORTED_LANGUAGES,
      transcripts: this.storage.findAll(),
      total: this.storage.findAll().length,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const record = this.storage.findById(id);
    if (!record) {
      throw new NotFoundException(`Transcript ${id} not found`);
    }
    return record;
  }
}

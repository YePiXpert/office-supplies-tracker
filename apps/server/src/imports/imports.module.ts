import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { OcrClient } from './ocr.client';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, OcrClient],
  exports: [OcrClient],
})
export class ImportsModule {}

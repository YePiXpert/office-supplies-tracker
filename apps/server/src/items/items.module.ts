import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ExportService } from './export.service';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService, ExportService],
  exports: [ItemsService, ExportService],
})
export class ItemsModule {}

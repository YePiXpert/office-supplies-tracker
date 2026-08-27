import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { BackupService } from './backup.service';
import { AutoBackupService } from './auto-backup.service';
import { ImportsModule } from '../imports/imports.module';

@Module({
  imports: [ImportsModule],
  controllers: [SystemController],
  providers: [BackupService, AutoBackupService],
})
export class SystemModule {}

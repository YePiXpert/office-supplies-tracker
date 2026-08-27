import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  Body,
} from '@nestjs/common';
import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { BackupService } from './backup.service';
import { AutoBackupService } from './auto-backup.service';
import { OcrClient } from '../imports/ocr.client';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import { config } from '../config';
import { autoBackupConfigSchema, type AutoBackupConfig } from '@procure-lite/shared';

const APP_VERSION = '2.0.0';

@Controller('system')
export class SystemController {
  constructor(
    private readonly backup: BackupService,
    private readonly autoBackup: AutoBackupService,
    private readonly ocr: OcrClient,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async status() {
    const [items, products, distributions] = await Promise.all([
      this.prisma.item.count(),
      this.prisma.product.count(),
      this.prisma.distribution.count(),
    ]);
    let dbSizeBytes = 0;
    try {
      dbSizeBytes = fs.statSync(config.dbPath).size;
    } catch {
      dbSizeBytes = 0;
    }
    return {
      version: APP_VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
      dbSizeBytes,
      counts: { items, products, distributions },
      autoBackup: await this.autoBackup.getConfig(),
      restoring: this.backup.isRestoring(),
    };
  }

  @Get('ocr-health')
  ocrHealth() {
    return this.ocr.health();
  }

  /* --------------------------------- 备份 ---------------------------------- */

  @Get('backups')
  backups() {
    return this.backup.list();
  }

  @Post('backups')
  createBackup(@Req() req: FastifyRequest) {
    return this.backup.create(clientIp(req));
  }

  @Get('backups/:name/download')
  download(@Param('name') name: string, @Res({ passthrough: true }) res: FastifyReply) {
    const full = this.backup.path(name);
    res.header('content-type', 'application/zip');
    res.header('content-disposition', `attachment; filename="${name}"`);
    return fs.readFileSync(full);
  }

  @Post('backups/:name/restore')
  @HttpCode(200)
  restore(@Param('name') name: string, @Req() req: FastifyRequest) {
    return this.backup.restore(name, clientIp(req));
  }

  @Delete('backups/:name')
  removeBackup(@Param('name') name: string, @Req() req: FastifyRequest) {
    return this.backup.remove(name, clientIp(req));
  }

  /* -------------------------------- 自动备份 ------------------------------- */

  @Get('auto-backup')
  getAutoBackup() {
    return this.autoBackup.getConfig();
  }

  @Put('auto-backup')
  updateAutoBackup(
    @Body(new ZodValidationPipe(autoBackupConfigSchema)) body: AutoBackupConfig,
  ) {
    return this.autoBackup.updateConfig(body);
  }
}

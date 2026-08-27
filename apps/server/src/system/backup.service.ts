import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { config } from '../config';

const MAX_RESTORE_ENTRIES = 20_000;
const MAX_RESTORE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB 解压上限

export interface BackupInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

/** 备份 = SQLite 一致性快照 + 上传附件目录，打包为 zip */
@Injectable()
export class BackupService implements OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private restoring = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  isRestoring(): boolean {
    return this.restoring;
  }

  async create(ip?: string): Promise<BackupInfo> {
    if (this.restoring) throw new ServiceUnavailableException('备份恢复进行中，请稍后再试');
    const stamp = new Date();
    const name = `backup-${stamp.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;
    const target = path.join(config.backupsDir, name);
    const snapshotPath = path.join(config.backupsDir, `.snapshot-${Date.now()}.db`);

    try {
      // VACUUM INTO 生成一致性快照（单引号转义防意外）
      const snapshotSql = snapshotPath.split('\\').join('/').replace(/'/g, "''");
      await this.prisma.$executeRawUnsafe(`VACUUM INTO '${snapshotSql}'`);

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(target);
        const archive = archiver('zip', { zlib: { level: 6 } });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.file(snapshotPath, { name: 'procure.db' });
        archive.directory(config.uploadsDir, 'uploads');
        void archive.finalize();
      });

      const stat = fs.statSync(target);
      await this.audit.log('BACKUP_CREATE', { entity: 'backup', detail: { name }, ip });
      return { name, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
    } finally {
      fs.rmSync(snapshotPath, { force: true });
    }
  }

  list(): BackupInfo[] {
    return fs
      .readdirSync(config.backupsDir)
      .filter((f) => f.endsWith('.zip'))
      .map((name) => {
        const stat = fs.statSync(path.join(config.backupsDir, name));
        return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  private resolve(name: string): string {
    if (!/^backup-[\w-]+\.zip$/.test(name)) throw new BadRequestException('备份文件名不合法');
    const full = path.join(config.backupsDir, name);
    if (!fs.existsSync(full)) throw new NotFoundException('备份不存在');
    return full;
  }

  path(name: string): string {
    return this.resolve(name);
  }

  /** 恢复：校验 zip → 断开数据库 → 替换文件 → 重连 */
  async restore(name: string, ip?: string): Promise<void> {
    const full = this.resolve(name);
    if (this.restoring) throw new ServiceUnavailableException('已有恢复任务进行中');
    this.restoring = true;
    let disconnected = false;
    try {
      const zip = new AdmZip(full);
      const entries = zip.getEntries();
      if (entries.length > MAX_RESTORE_ENTRIES) throw new BadRequestException('备份内容异常');
      const totalBytes = entries.reduce((s, e) => s + e.header.size, 0);
      if (totalBytes > MAX_RESTORE_BYTES) throw new BadRequestException('备份内容异常');
      for (const e of entries) {
        if (e.entryName.includes('..') || path.isAbsolute(e.entryName)) {
          throw new BadRequestException('备份包含非法路径');
        }
      }

      const tempDir = path.join(config.backupsDir, `.restore-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      zip.extractAllTo(tempDir, true);

      const dbFile = path.join(tempDir, 'procure.db');
      if (!fs.existsSync(dbFile)) throw new BadRequestException('备份缺少数据库文件');

      await this.prisma.$disconnect();
      disconnected = true;
      fs.copyFileSync(dbFile, config.dbPath);

      fs.rmSync(config.uploadsDir, { recursive: true, force: true });
      const restoredUploads = path.join(tempDir, 'uploads');
      if (fs.existsSync(restoredUploads)) {
        fs.mkdirSync(config.uploadsDir, { recursive: true });
        fs.cpSync(restoredUploads, config.uploadsDir, { recursive: true });
      } else {
        fs.mkdirSync(config.uploadsDir, { recursive: true });
      }

      fs.rmSync(tempDir, { recursive: true, force: true });
      await this.prisma.$connect();
      disconnected = false;
      await this.audit.log('BACKUP_RESTORE', { entity: 'backup', detail: { name }, ip });
      this.logger.log(`已从备份 ${name} 恢复`);
    } catch (e) {
      this.logger.error(`恢复失败：${e instanceof Error ? e.message : e}`);
      throw e;
    } finally {
      // 无论成败，只要断开过就尽力重连，避免进程带着关闭的连接池继续服务
      if (disconnected) {
        await this.prisma.$connect().catch((re: unknown) => {
          this.logger.error(`恢复后重连数据库失败，由容器重启兜底: ${re}`);
        });
      }
      this.restoring = false;
    }
  }

  remove(name: string, ip?: string): { ok: boolean } {
    const full = this.resolve(name);
    fs.rmSync(full);
    void this.audit.log('BACKUP_DELETE', { entity: 'backup', detail: { name }, ip });
    return { ok: true };
  }

  /** 只保留最近 keepCount 个备份 */
  prune(keepCount: number): number {
    const list = this.list();
    let removed = 0;
    for (const b of list.slice(keepCount)) {
      try {
        fs.rmSync(path.join(config.backupsDir, b.name));
        removed += 1;
      } catch {
        // 忽略单个删除失败
      }
    }
    return removed;
  }

  onModuleDestroy(): void {
    this.restoring = false;
  }
}

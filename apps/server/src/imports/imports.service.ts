import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OcrClient } from './ocr.client';
import { config } from '../config';
import type { ImportConfirmInput, ParseResult } from '@procure-lite/shared';

const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp'];

export interface ImportTaskView {
  id: string;
  filename: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  result?: ParseResult;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

@Injectable()
export class ImportsService implements OnModuleInit {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocr: OcrClient,
    private readonly audit: AuditService,
  ) {}

  /** 进程重启后，把停留在 RUNNING 的僵尸任务标记为失败（任务态只在内存推进） */
  async onModuleInit(): Promise<void> {
    await this.prisma.importTask
      .updateMany({
        where: { status: 'RUNNING' },
        data: { status: 'FAILED', error: '服务重启导致解析中断，请重新上传', finishedAt: new Date() },
      })
      .catch(() => undefined);
  }

  /** 保存文件 → 建任务 → 异步解析（任务状态落库，重启后仍可查询） */
  async upload(file: { buffer: Buffer; filename: string; size: number }, ip?: string) {
    const filename = path.basename(file.filename || 'upload');
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      throw new BadRequestException(`不支持的文件类型 ${ext}（支持 PDF 与常见图片格式）`);
    }
    if (file.size > config.maxUploadBytes) {
      throw new BadRequestException(`文件超过 ${Math.floor(config.maxUploadBytes / 1024 / 1024)}MB 限制`);
    }

    // 顺带清理 30 天前的导入任务记录，防止无限增长
    await this.prisma.importTask
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400_000) } } })
      .catch(() => undefined);

    const id = randomUUID();
    const stored = path.join(config.uploadsDir, `${id}${ext}`);
    fs.writeFileSync(stored, file.buffer);

    await this.prisma.importTask.create({ data: { id, filename, status: 'RUNNING' } });
    await this.audit.log('IMPORT_UPLOAD', { entity: 'importTask', entityId: undefined, detail: { id, filename }, ip });

    // 异步执行，不阻塞响应
    void this.runParse(id, stored, filename);

    return { taskId: id };
  }

  private async runParse(taskId: string, filePath: string, filename: string): Promise<void> {
    let result: Awaited<ReturnType<OcrClient['parse']>> | undefined;
    try {
      result = await this.ocr.parse(fs.readFileSync(filePath), filename);
      await this.prisma.importTask.update({
        where: { id: taskId },
        data: { status: 'DONE', result: JSON.stringify(result), finishedAt: new Date() },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`解析任务 ${taskId} 失败: ${message}`);
      await this.prisma.importTask
        .update({
          where: { id: taskId },
          data: { status: 'FAILED', error: message, finishedAt: new Date() },
        })
        .catch(() => undefined);
    } finally {
      // 暂存原件用完即删（解析结果 JSON 已留痕），避免 uploads 无限膨胀
      fs.rm(filePath, { force: true }, () => undefined);
    }
  }

  async task(id: string): Promise<ImportTaskView> {
    const row = await this.prisma.importTask.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('任务不存在');
    return {
      id: row.id,
      filename: row.filename,
      status: row.status as ImportTaskView['status'],
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString(),
    };
  }

  /** 确认前检查：逐条返回与现有台账重复的明细 */
  async checkDuplicates(body: {
    serialNumber: string;
    handler: string;
    itemNames: string[];
  }) {
    const found = await this.prisma.item.findMany({
      where: {
        serialNumber: body.serialNumber,
        handler: body.handler,
        deletedAt: null,
        itemName: { in: body.itemNames },
      },
      select: { id: true, itemName: true, quantity: true, status: true },
    });
    const byName = new Map(found.map((f) => [f.itemName, f]));
    return body.itemNames
      .filter((name) => byName.has(name))
      .map((name) => {
        const f = byName.get(name)!;
        return { itemName: name, matchedId: f.id, matchedQuantity: f.quantity, matchedStatus: f.status };
      });
  }

  /** 确认导入：逐条创建/合并/跳过（同一事务） */
  async confirm(input: ImportConfirmInput, ip?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      let created = 0;
      let merged = 0;
      let skipped = 0;
      const ids: number[] = [];

      for (const line of input.items) {
        const existing = await tx.item.findFirst({
          where: {
            serialNumber: input.serialNumber,
            handler: input.handler,
            itemName: line.itemName,
            deletedAt: null,
          },
        });

        if (existing) {
          if (line.duplicateAction === 'merge') {
            const newQty = existing.quantity + line.quantity;
            const after = await tx.item.update({
              where: { id: existing.id },
              data: { quantity: newQty },
            });
            await tx.itemHistory.create({
              data: {
                itemId: existing.id,
                action: 'IMPORT_MERGE',
                changedFields: JSON.stringify({ quantity: [existing.quantity, newQty] }),
                beforeData: JSON.stringify(existing),
                afterData: JSON.stringify(after),
              },
            });
            merged += 1;
            ids.push(existing.id);
          } else {
            skipped += 1;
          }
          continue;
        }

        const item = await tx.item.create({
          data: {
            serialNumber: input.serialNumber,
            department: input.department,
            handler: input.handler,
            requestDate: input.requestDate,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            purchaseLink: line.purchaseLink,
            supplierId: input.supplierId ?? null,
          },
        });
        await tx.itemHistory.create({
          data: { itemId: item.id, action: 'IMPORT_CREATE', afterData: JSON.stringify(item) },
        });
        created += 1;
        ids.push(item.id);
      }
      return { created, merged, skipped, ids };
    });

    await this.audit.log('IMPORT_CONFIRM', {
      entity: 'import',
      detail: {
        serialNumber: input.serialNumber,
        created: result.created,
        merged: result.merged,
        skipped: result.skipped,
      },
      ip,
    });
    return result;
  }
}

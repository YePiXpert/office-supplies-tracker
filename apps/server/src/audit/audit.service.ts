import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  entity?: string;
  entityId?: number;
  detail?: unknown;
  ip?: string;
}

/** 显式调用的审计日志（不依赖 ORM 钩子，写入点清晰可查） */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, entry: AuditEntry = {}): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entity: entry.entity,
          entityId: entry.entityId,
          detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
          operatorIp: entry.ip,
        },
      });
    } catch {
      // 审计失败不应阻断业务
    }
  }
}

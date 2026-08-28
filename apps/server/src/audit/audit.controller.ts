import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(
    @Query(
      new ZodValidationPipe(
        z.object({
          action: z.string().trim().max(64).optional(),
          search: z.string().trim().max(100).optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(200).default(20),
        }),
      ),
    )
    query: { action?: string; search?: string; page: number; pageSize: number },
  ) {
    const where = {
      // 精确匹配：前端是固定下拉，contains 会让 AUTH_LOGIN 误中 AUTH_LOGIN_FAILED
      ...(query.action ? { action: query.action } : {}),
      ...(query.search
        ? { OR: [{ action: { contains: query.search } }, { detail: { contains: query.search } }] }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([logs, total]) => ({ logs, total, page: query.page, pageSize: query.pageSize }));
  }
}

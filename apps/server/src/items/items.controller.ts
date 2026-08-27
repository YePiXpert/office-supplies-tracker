import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ItemsService } from './items.service';
import { ExportService } from './export.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import {
  batchUpdateSchema,
  itemCreateSchema,
  itemQuerySchema,
  itemUpdateSchema,
  type BatchUpdateInput,
  type ItemCreateInput,
  type ItemQuery,
  type ItemUpdateInput,
} from '@procure-lite/shared';

@Controller('items')
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly exporter: ExportService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(itemQuerySchema)) query: ItemQuery) {
    return this.items.list(query);
  }

  @Get('facets')
  facets() {
    return this.items.facets();
  }

  @Get('export')
  async export(
    @Query(new ZodValidationPipe(itemQuerySchema)) query: ItemQuery,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const buffer = await this.exporter.exportLedger(query);
    res.header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('content-disposition', `attachment; filename="ledger-${Date.now()}.xlsx"`);
    return buffer;
  }

  @Post('batch-update')
  @HttpCode(200)
  batchUpdate(
    @Body(new ZodValidationPipe(batchUpdateSchema)) body: BatchUpdateInput,
    @Req() req: FastifyRequest,
  ) {
    return this.items.batchUpdate(body, clientIp(req));
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.items.get(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(itemCreateSchema)) body: ItemCreateInput,
    @Req() req: FastifyRequest,
  ) {
    return this.items.create(body, clientIp(req));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(itemUpdateSchema)) body: ItemUpdateInput,
    @Req() req: FastifyRequest,
  ) {
    return this.items.update(id, body, clientIp(req));
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('permanent') permanent: string | undefined,
    @Req() req: FastifyRequest,
  ) {
    if (permanent === 'true') return this.items.purge(id, clientIp(req));
    return this.items.softDelete([id], clientIp(req));
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    return this.items.restore(id, clientIp(req));
  }

  @Get(':id/history')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.items.history(id);
  }

  @Post(':id/rollback')
  @HttpCode(200)
  rollback(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(z.object({ historyId: z.coerce.number().int().positive() })))
    body: { historyId: number },
    @Req() req: FastifyRequest,
  ) {
    return this.items.rollback(id, body.historyId, clientIp(req));
  }
}

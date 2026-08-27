import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SuppliersService } from './suppliers.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import {
  priceRecordSchema,
  supplierUpsertSchema,
  type PriceRecordInput,
  type SupplierUpsertInput,
} from '@procure-lite/shared';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list() {
    return this.suppliers.list();
  }

  @Get('price-records')
  priceRecords(
    @Query(
      new ZodValidationPipe(
        z.object({
          itemName: z.string().trim().max(200).optional(),
          supplierId: z.coerce.number().int().positive().optional(),
        }),
      ),
    )
    query: { itemName?: string; supplierId?: number },
  ) {
    return this.suppliers.priceRecords(query);
  }

  @Get('suggest')
  suggest(@Query(new ZodValidationPipe(z.object({ itemName: z.string().trim().min(1) }))) query: { itemName: string }) {
    return this.suppliers.suggest(query.itemName);
  }

  @Post()
  upsert(
    @Body(new ZodValidationPipe(supplierUpsertSchema)) body: SupplierUpsertInput,
    @Req() req: FastifyRequest,
  ) {
    return this.suppliers.upsert(body, clientIp(req));
  }

  @Post('price-records')
  addPriceRecord(
    @Body(new ZodValidationPipe(priceRecordSchema)) body: PriceRecordInput,
    @Req() req: FastifyRequest,
  ) {
    return this.suppliers.addPriceRecord(body, clientIp(req));
  }

  @Delete('price-records/:id')
  removePriceRecord(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    return this.suppliers.removePriceRecord(id, clientIp(req));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    return this.suppliers.remove(id, clientIp(req));
  }
}

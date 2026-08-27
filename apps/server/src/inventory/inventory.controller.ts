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
import { InventoryService } from './inventory.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import {
  movementCreateSchema,
  movementQuerySchema,
  productUpsertSchema,
  type MovementCreateInput,
  type MovementQuery,
  type ProductUpsertInput,
} from '@procure-lite/shared';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('products')
  products(
    @Query(
      new ZodValidationPipe(
        z.object({ search: z.string().trim().max(100).optional(), low: z.enum(['1', '0']).optional() }),
      ),
    )
    query: { search?: string; low?: '1' | '0' },
  ) {
    return this.inventory.products(query.search, query.low === '1');
  }

  @Get('movements')
  movements(@Query(new ZodValidationPipe(movementQuerySchema)) query: MovementQuery) {
    return this.inventory.movements(query);
  }

  @Post('products')
  upsertProduct(
    @Body(new ZodValidationPipe(productUpsertSchema)) body: ProductUpsertInput,
    @Req() req: FastifyRequest,
  ) {
    return this.inventory.upsertProduct(body, clientIp(req));
  }

  @Post('movements')
  createMovement(
    @Body(new ZodValidationPipe(movementCreateSchema)) body: MovementCreateInput,
    @Req() req: FastifyRequest,
  ) {
    return this.inventory.createMovement(body, clientIp(req));
  }

  /** 台账记录整单入库 */
  @Post('stock-in/:itemId')
  stockIn(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: FastifyRequest,
  ) {
    return this.inventory.stockIn(itemId, clientIp(req));
  }

  @Delete('products/:id')
  deleteProduct(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    return this.inventory.deleteProduct(id, clientIp(req));
  }

  @Delete('movements/:id')
  removeMovement(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    return this.inventory.removeMovement(id, clientIp(req));
  }
}

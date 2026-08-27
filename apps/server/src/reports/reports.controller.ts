import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { ReportsService } from './reports.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { reportQuerySchema } from '@procure-lite/shared';

const amountQuery = reportQuerySchema.extend({
  groupBy: z.enum(['month', 'department', 'supplier']).default('month'),
});

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('amount')
  amount(
    @Query(new ZodValidationPipe(amountQuery))
    query: { groupBy: 'month' | 'department' | 'supplier'; dateFrom?: string; dateTo?: string },
  ) {
    return this.reports.amount(query.groupBy, query.dateFrom, query.dateTo);
  }

  @Get('operations')
  operations(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: { dateFrom?: string; dateTo?: string },
  ) {
    return this.reports.operations(query.dateFrom, query.dateTo);
  }

  @Get('recipients')
  recipients(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: { dateFrom?: string; dateTo?: string },
  ) {
    return this.reports.recipients(query.dateFrom, query.dateTo);
  }

  @Get('suppliers')
  suppliers(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: { dateFrom?: string; dateTo?: string },
  ) {
    return this.reports.suppliers(query.dateFrom, query.dateTo);
  }
}

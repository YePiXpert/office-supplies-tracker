import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ImportsService } from './imports.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import { readUpload } from '../common/multipart.util';
import { importConfirmSchema, type ImportConfirmInput } from '@procure-lite/shared';

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('upload')
  async upload(@Req() req: FastifyRequest) {
    const file = await readUpload(req);
    return this.imports.upload(file, clientIp(req));
  }

  @Get('tasks/:id')
  task(@Param('id') id: string) {
    return this.imports.task(id);
  }

  @Post('check-duplicates')
  checkDuplicates(
    @Body(
      new ZodValidationPipe(
        z.object({
          serialNumber: z.string().trim().min(1).max(64),
          handler: z.string().trim().min(1).max(64),
          itemNames: z.array(z.string().trim().min(1).max(200)).min(1),
        }),
      ),
    )
    body: { serialNumber: string; handler: string; itemNames: string[] },
  ) {
    return this.imports.checkDuplicates(body);
  }

  @Post('confirm')
  confirm(
    @Body(new ZodValidationPipe(importConfirmSchema)) body: ImportConfirmInput,
    @Req() req: FastifyRequest,
  ) {
    return this.imports.confirm(body, clientIp(req));
  }
}

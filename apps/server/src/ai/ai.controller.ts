import { Body, Controller, Get, HttpCode, Post, Put, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  aiAskSchema,
  aiConfigSchema,
  aiOcrReviewSchema,
  type AiAskInput,
  type AiConfigInput,
  type AiOcrReviewInput,
} from '@procure-lite/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import { AiService } from './ai.service';
import { AiConfigService } from './ai-config.service';
import { LlmClient } from './llm.client';

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly aiConfig: AiConfigService,
    private readonly llm: LlmClient,
  ) {}

  @Get('config')
  async getConfig() {
    return this.aiConfig.view(await this.aiConfig.getConfig());
  }

  @Put('config')
  @HttpCode(200)
  async updateConfig(
    @Body(new ZodValidationPipe(aiConfigSchema)) body: AiConfigInput,
    @Req() req: FastifyRequest,
  ) {
    const stored = await this.aiConfig.updateConfig(body, clientIp(req));
    return this.aiConfig.view(stored);
  }

  @Get('health')
  async health() {
    const cfg = await this.aiConfig.getConfig();
    if (!(cfg.enabled && cfg.apiKey)) return { ok: false, reason: 'not-configured' };
    return { ok: await this.llm.ping(cfg.baseUrl, cfg.apiKey, cfg.model) };
  }

  @Post('ask')
  ask(
    @Body(new ZodValidationPipe(aiAskSchema)) body: AiAskInput,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.ask(body, clientIp(req));
  }

  @Post('ocr-review')
  @HttpCode(200)
  ocrReview(
    @Body(new ZodValidationPipe(aiOcrReviewSchema)) body: AiOcrReviewInput,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.ocrReview(body, clientIp(req));
  }
}

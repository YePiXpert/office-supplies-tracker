import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { config } from '../config';
import type { AiConfigInput, AiConfigView } from '@procure-lite/shared';

const SETTING_KEY = 'aiConfig';

export interface StoredAiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  semanticSearch: boolean;
}

/** AI 配置：存 Setting 表（与自动备份同一模式），env 只作首次默认值 */
@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private defaults(): StoredAiConfig {
    return {
      enabled: false,
      baseUrl: config.llmDefaults.baseUrl,
      apiKey: config.llmDefaults.apiKey,
      model: config.llmDefaults.model,
      semanticSearch: true,
    };
  }

  async getConfig(): Promise<StoredAiConfig> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
    if (!row) return this.defaults();
    try {
      return { ...this.defaults(), ...(JSON.parse(row.value) as Partial<StoredAiConfig>) };
    } catch {
      return this.defaults();
    }
  }

  async updateConfig(input: AiConfigInput, ip?: string): Promise<StoredAiConfig> {
    const current = await this.getConfig();
    // 前端不回传 apiKey 明文，留空表示沿用已保存的 Key
    const apiKey = input.apiKey ? input.apiKey : current.apiKey;
    if (input.enabled && !apiKey) {
      throw new BadRequestException('启用 AI 前需要先填写 API Key');
    }
    const stored: StoredAiConfig = {
      enabled: input.enabled,
      baseUrl: input.baseUrl,
      apiKey,
      model: input.model,
      semanticSearch: input.semanticSearch,
    };
    await this.prisma.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify(stored) },
      update: { value: JSON.stringify(stored) },
    });
    await this.audit.log('AI_CONFIG_UPDATE', {
      detail: { enabled: stored.enabled, baseUrl: stored.baseUrl, model: stored.model },
      ip,
    });
    return stored;
  }

  /** 是否已具备调用条件（ask / 语义搜索 / OCR 校对的公共门槛） */
  async isReady(): Promise<boolean> {
    const cfg = await this.getConfig();
    return cfg.enabled && !!cfg.apiKey && !!cfg.baseUrl && !!cfg.model;
  }

  /** 语义搜索开关（独立于 ask，弱化配置耦合） */
  async semanticSearchEnabled(): Promise<boolean> {
    const cfg = await this.getConfig();
    return cfg.enabled && cfg.semanticSearch && !!cfg.apiKey;
  }

  view(cfg: StoredAiConfig): AiConfigView {
    return {
      enabled: cfg.enabled,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      semanticSearch: cfg.semanticSearch,
      apiKeySet: !!cfg.apiKey,
    };
  }
}

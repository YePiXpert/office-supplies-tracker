import { Global, Module } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { AiConfigService } from './ai-config.service';
import { AiSearchService } from './ai-search.service';

/** AI 基础设施（客户端/配置/语义搜索）：全局模块，Items/Inventory 等模块直接注入 */
@Global()
@Module({
  providers: [LlmClient, AiConfigService, AiSearchService],
  exports: [LlmClient, AiConfigService, AiSearchService],
})
export class AiCoreModule {}

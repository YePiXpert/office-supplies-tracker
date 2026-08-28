import { BadRequestException, Injectable } from '@nestjs/common';
import {
  aiOcrReviewResultSchema,
  type AiAskInput,
  type AiAskResponse,
  type AiOcrReviewInput,
  type AiOcrReviewResult,
  type AiToolStep,
} from '@procure-lite/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ImportsService } from '../imports/imports.service';
import { LlmClient, type ChatMessage } from './llm.client';
import { AiConfigService, type StoredAiConfig } from './ai-config.service';
import { AiToolsService } from './ai-tools';
import { AiSearchService } from './ai-search.service';

/** 单条工具结果回传给 LLM 的字符上限，防止 token 失控 */
const TOOL_RESULT_LIMIT = 16_000;
const MAX_TOOL_ROUNDS = 6;

@Injectable()
export class AiService {
  constructor(
    private readonly llm: LlmClient,
    private readonly aiConfig: AiConfigService,
    private readonly tools: AiToolsService,
    private readonly search: AiSearchService,
    private readonly prisma: PrismaService,
    private readonly imports: ImportsService,
    private readonly audit: AuditService,
  ) {}

  /** 门槛检查放在最前面，未启用时给出可操作的提示 */
  private async requireConfig(): Promise<StoredAiConfig> {
    const cfg = await this.aiConfig.getConfig();
    if (!(cfg.enabled && cfg.apiKey)) {
      throw new BadRequestException('AI 功能未启用，请先到「系统设置 → AI 助手」完成配置');
    }
    return cfg;
  }

  /** 自然语言问答：tool-calling 循环最多 MAX_TOOL_ROUNDS 轮，之后强制收敛为最终回答 */
  async ask(input: AiAskInput, ip?: string): Promise<AiAskResponse> {
    const cfg = await this.requireConfig();
    const messages: ChatMessage[] = [
      { role: 'system', content: this.tools.systemPrompt() },
      ...(input.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: input.question },
    ];
    const defs = this.tools.definitions();
    const steps: AiToolStep[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await this.llm.chat({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        messages,
        tools: defs,
        maxTokens: 2048,
      });

      if (res.toolCalls.length === 0) {
        await this.audit.log('AI_QUERY', {
          detail: { question: input.question, rounds: round + 1, toolCalls: steps.length },
          ip,
        });
        return {
          answer: res.content?.trim() || '（模型没有返回内容，请重试）',
          steps,
          model: cfg.model,
        };
      }

      messages.push({
        role: 'assistant',
        content: res.content,
        tool_calls: res.toolCalls.map((c) => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
        })),
      });
      for (const call of res.toolCalls) {
        let payload: string;
        let count = 0;
        try {
          const executed = await this.tools.execute(call.name, (call.args ?? {}) as Record<string, unknown>);
          count = executed.count;
          const json = JSON.stringify(executed.result);
          payload = json.length > TOOL_RESULT_LIMIT ? json.slice(0, TOOL_RESULT_LIMIT) + '…（已截断）' : json;
        } catch (e) {
          // 工具报错也回给模型，让它自行调整参数或放弃该路径
          payload = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
        }
        steps.push({ name: call.name, args: (call.args ?? {}) as Record<string, unknown>, count });
        messages.push({ role: 'tool', content: payload, tool_call_id: call.id });
      }
    }

    const final = await this.llm.chat({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      messages,
      maxTokens: 2048,
    });
    await this.audit.log('AI_QUERY', {
      detail: { question: input.question, rounds: MAX_TOOL_ROUNDS + 1, toolCalls: steps.length },
      ip,
    });
    return {
      answer: final.content?.trim() || '（多轮查询后未能生成回答，请换个问法重试）',
      steps,
      model: cfg.model,
    };
  }

  /** OCR 结果校对：返回与当前值不同的建议，由用户在前端逐项应用 */
  async ocrReview(input: AiOcrReviewInput, ip?: string): Promise<AiOcrReviewResult> {
    const cfg = await this.requireConfig();
    const task = await this.imports.task(input.taskId);
    if (!task.result) {
      throw new BadRequestException('该任务没有解析结果（可能解析失败或尚未完成），无法 AI 校对');
    }

    const [vocab, facets] = await Promise.all([
      this.search.vocabulary(),
      this.prisma.item.groupBy({
        by: ['department', 'handler'],
        where: { deletedAt: null },
        orderBy: { department: 'asc' },
        take: 500,
      }),
    ]);

    const system =
      '你是 OA 采购审批单 OCR 结果的校对助手。你会收到 OCR 解析结果、系统现有品名词表、部门与经办人列表。\n' +
      '只输出 JSON 对象：{"serialNumber"?, "department"?, "handler"?, "requestDate"?, ' +
      '"lines": [{"index": number, "itemName"?, "quantity"?, "unitPrice"?, "reason"?}], "warnings": string[]}。\n' +
      '规则：\n' +
      '1. 只输出与当前值不同、或明显需要修正的字段；没有任何建议就输出全空结构。\n' +
      '2. 品名优先对齐词表中的既有写法（利于去重与库存归并）；部门对齐部门列表。\n' +
      '3. 数量/单价只在明显异常（如为 0、数量级错误、列错位）时修正，并在 reason 简述理由。\n' +
      '4. lines 的 index 对应 items 数组下标（从 0 开始），只给需要修改的行。\n' +
      '5. warnings 放整体性疑点（如日期格式、疑似漏行），最多 5 条。';

    const user = JSON.stringify({
      OCR结果: task.result,
      品名词表: vocab.slice(0, 300),
      部门列表: [...new Set(facets.map((f) => f.department))],
      经办人列表: [...new Set(facets.map((f) => f.handler))],
    });

    let parsed: AiOcrReviewResult | null = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const res = await this.llm.chat({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: attempt === 0 ? user : user + '\n\n上一次输出不是合法 JSON，请严格只输出一个 JSON 对象。' },
        ],
        jsonMode: true,
        temperature: 0,
        maxTokens: 2048,
      });
      try {
        parsed = aiOcrReviewResultSchema.parse(JSON.parse(res.content ?? ''));
      } catch {
        parsed = null;
      }
    }
    if (!parsed) throw new BadRequestException('AI 校对结果解析失败，请重试');

    await this.audit.log('AI_OCR_REVIEW', {
      entity: 'importTask',
      detail: { taskId: input.taskId, suggestions: parsed.lines.length },
      ip,
    });
    return this.diffAgainst(task.result, parsed);
  }

  /** 服务端先做一次差集：剔除与当前值相同的建议，前端只展示真正会变化的项 */
  private diffAgainst(
    current: { serialNumber?: string; department?: string; handler?: string; requestDate?: string; items: { itemName: string; quantity: number; unitPrice?: number }[] },
    review: AiOcrReviewResult,
  ): AiOcrReviewResult {
    const differs = <T>(a: T | undefined, b: T | undefined) => a !== undefined && a !== b;
    return {
      serialNumber: differs(review.serialNumber, current.serialNumber) ? review.serialNumber : undefined,
      department: differs(review.department, current.department) ? review.department : undefined,
      handler: differs(review.handler, current.handler) ? review.handler : undefined,
      requestDate: differs(review.requestDate, current.requestDate) ? review.requestDate : undefined,
      lines: review.lines.filter((l) => {
        const cur = current.items[l.index];
        if (!cur) return false;
        return (
          (l.itemName !== undefined && l.itemName !== cur.itemName) ||
          (l.quantity !== undefined && l.quantity !== cur.quantity) ||
          (l.unitPrice !== undefined && l.unitPrice !== cur.unitPrice)
        );
      }),
      warnings: review.warnings,
    };
  }
}

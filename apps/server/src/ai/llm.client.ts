import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

/** OpenAI 兼容 /chat/completions 的最小消息类型（含 tool-calling 往返所需的字段） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** assistant 发起的工具调用请求（回传时原样带上） */
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  /** role=tool 时对应的调用 id */
  tool_call_id?: string;
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema */
    parameters: Record<string, unknown>;
  };
}

export interface ChatCallOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  /** 要求模型输出合法 JSON（用于结构化抽取场景） */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: { id: string; name: string; args: unknown }[];
}

interface OpenAiChatResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id: string; function: { name: string; arguments: string } }[];
    };
  }[];
}

/** 调用 OpenAI 兼容的 LLM 服务（智谱 GLM / DeepSeek 等均可），配置由调用方传入 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  async chat(opts: ChatCallOptions): Promise<ChatCompletionResult> {
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    try {
      const res = await axios.post<OpenAiChatResponse>(
        url,
        {
          model: opts.model,
          messages: opts.messages,
          ...(opts.tools?.length ? { tools: opts.tools, tool_choice: 'auto' } : {}),
          ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          temperature: opts.temperature ?? 0.2,
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        },
        {
          headers: { Authorization: `Bearer ${opts.apiKey}` },
          timeout: opts.timeoutMs ?? 90_000,
        },
      );
      const message = res.data.choices?.[0]?.message;
      if (!message) throw new Error('响应中没有 choices');
      const toolCalls = (message.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        args: this.parseArgs(c.function.arguments),
      }));
      return { content: message.content ?? null, toolCalls };
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const detail =
          (e.response?.data as { error?: { message?: string } } | undefined)?.error?.message ??
          e.message;
        this.logger.error(`LLM 调用失败: ${detail}`);
        throw new ServiceUnavailableException(`AI 服务调用失败：${detail}`);
      }
      throw e;
    }
  }

  /** 连通性测试：发一个最小请求（设置页「测试连接」用） */
  async ping(baseUrl: string, apiKey: string, model: string): Promise<boolean> {
    try {
      await this.chat({
        baseUrl,
        apiKey,
        model,
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 8,
        timeoutMs: 15_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  private parseArgs(raw: string | undefined): unknown {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { _raw: raw };
    }
  }
}

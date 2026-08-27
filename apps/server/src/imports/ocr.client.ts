import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { config } from '../config';
import type { ParseResult } from '@procure-lite/shared';

/** 调用 Python OCR 微服务解析 OA 单据 */
@Injectable()
export class OcrClient {
  private readonly logger = new Logger(OcrClient.name);

  async parse(file: Buffer, filename: string): Promise<ParseResult> {
    const form = new FormData();
    const mime = this.mimeOf(filename);
    form.append('file', new Blob([new Uint8Array(file)], { type: mime }), filename);
    try {
      const res = await axios.post<ParseResult>(`${config.ocrBaseUrl}/parse`, form, {
        headers: { 'X-API-Key': config.ocrApiKey },
        timeout: 180_000, // PaddleOCR 冷启动较慢
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      return res.data;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const detail = e.response?.data?.detail ?? e.message;
        this.logger.error(`OCR 服务调用失败: ${detail}`);
        throw new ServiceUnavailableException(`单据解析失败：${detail}`);
      }
      throw e;
    }
  }

  async health(): Promise<boolean> {
    try {
      await axios.get(`${config.ocrBaseUrl}/health`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  private mimeOf(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      bmp: 'image/bmp',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}

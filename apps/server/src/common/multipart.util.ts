import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}

/**
 * 读取 multipart 单文件字段（Nest 11 + Fastify 无内置 FileInterceptor，
 * 直接走 @fastify/multipart 的 req.file()）。
 */
export async function readUpload(req: FastifyRequest): Promise<UploadedFile> {
  if (!req.isMultipart?.()) {
    throw new BadRequestException('请使用 multipart/form-data 上传文件');
  }
  const file = await req.file();
  if (!file) throw new BadRequestException('请选择要上传的文件');
  const buffer = await file.toBuffer();
  if (file.file?.truncated) {
    throw new PayloadTooLargeException('文件超过大小限制');
  }
  return {
    buffer,
    filename: file.filename || 'upload',
    mimetype: file.mimetype,
    size: buffer.length,
  };
}

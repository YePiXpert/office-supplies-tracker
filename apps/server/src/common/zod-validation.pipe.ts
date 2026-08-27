import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** 用 zod schema 校验并转换入参；失败时抛出带字段路径的 400 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      throw new BadRequestException(field ? `${field}：${issue.message}` : issue.message);
    }
    return result.data;
  }
}

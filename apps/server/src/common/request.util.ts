import type { FastifyRequest } from 'fastify';

/**
 * 客户端 IP：fastify 在 trustProxy 配置下已按可信跳数解析 X-Forwarded-For，
 * req.ip 取最右侧不可伪造条目，无需手动拆头。
 */
export function clientIp(req: FastifyRequest): string | undefined {
  return req.ip?.replace('::ffff:', '') || undefined;
}

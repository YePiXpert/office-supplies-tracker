import type { FastifyRequest } from 'fastify';

/** 取客户端 IP：优先信任反代头（Docker 部署在 nginx 后面） */
export function clientIp(req: FastifyRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip;
}

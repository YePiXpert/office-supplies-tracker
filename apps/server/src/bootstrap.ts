import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyPluginCallback } from 'fastify';
import type { FastifyCookieOptions } from '@fastify/cookie';
import type { FastifyHelmetOptions } from '@fastify/helmet';
import type { FastifyMultipartOptions } from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { config } from './config';

/** main 与测试共用的应用装配（入参校验统一走 zod 管道，不用 class-validator） */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  app.setGlobalPrefix('api');
  await app.register(fastifyHelmet as FastifyPluginCallback<FastifyHelmetOptions>, {
    contentSecurityPolicy: false,
  });
  await app.register(fastifyCookie as FastifyPluginCallback<FastifyCookieOptions>);
  await app.register(fastifyMultipart as FastifyPluginCallback<FastifyMultipartOptions>, {
    limits: { fileSize: config.maxUploadBytes, files: 1 },
  });
  app.useGlobalFilters(new PrismaExceptionFilter());
}

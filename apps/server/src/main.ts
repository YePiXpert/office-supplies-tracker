import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { config } from './config';
import { BackupService } from './system/backup.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // fastify 支持数字（可信跳数），但适配器类型未收窄，断言绕过
      trustProxy: 1 as unknown as boolean, // 只信任最前一层 nginx 反代
      bodyLimit: config.maxUploadBytes,
      logger: false,
    }),
  );

  await configureApp(app);
  app.enableShutdownHooks();

  // 备份恢复期间全站 503（恢复会替换数据库与附件，避免并发写入丢失）
  const backup = app.get(BackupService);
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api') && backup.isRestoring()) {
      await reply.code(503).send({ statusCode: 503, message: '备份恢复中，请稍后重试' });
    }
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.log(`API 服务已启动: http://0.0.0.0:${config.port}/api`);
  logger.log(`数据目录: ${config.dataDir}`);
}

void bootstrap();

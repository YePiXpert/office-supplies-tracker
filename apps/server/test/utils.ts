import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

export const TEST_PASSWORD = 'test-password-123';

/** 从 inject 响应中取首个 Cookie（set-cookie 可能是字符串或数组） */
export function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first).split(';')[0];
}

export interface TestApp {
  app: NestFastifyApplication;
  inject: FastifyInstance['inject'];
  cookie: string;
}

/** 创建测试应用并完成初始化 + 登录，返回带会话 Cookie 的 inject */
export async function createApp(opts: { login?: boolean } = {}): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication(new FastifyAdapter()) as NestFastifyApplication;
  await configureApp(app);
  await app.init();
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  await fastify.ready();

  const ctx: TestApp = { app, inject: fastify.inject.bind(fastify), cookie: '' };

  if (opts.login !== false) {
    // 首个用例执行 setup，之后的（数据库已初始化）直接登录
    const setup = await ctx.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { password: TEST_PASSWORD },
    });
    if (setup.statusCode !== 201 && setup.statusCode !== 409) {
      throw new Error(`测试初始化失败: ${setup.statusCode} ${setup.body}`);
    }
    const res = await ctx.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: TEST_PASSWORD },
    });
    if (res.statusCode !== 200) throw new Error(`测试登录失败: ${res.statusCode} ${res.body}`);
    ctx.cookie = cookieFrom(res);
  }
  return ctx;
}

export async function closeApp(ctx: TestApp): Promise<void> {
  await ctx.app.close();
}

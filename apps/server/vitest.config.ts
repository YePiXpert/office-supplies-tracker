import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// esbuild 不产出装饰器元数据，NestJS 的构造函数注入会失效；
// 用 swc 转译（按 tsconfig 的 emitDecoratorMetadata 生效）
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    hookTimeout: 60_000,
    testTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});

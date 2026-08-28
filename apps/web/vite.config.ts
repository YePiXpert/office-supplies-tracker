/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // prompt 而非 autoUpdate：旧 SW 继续伺服旧的 precache，直到用户点「立即更新」。
      // autoUpdate 会在用户还开着页面时换掉 SW，旧页面再去加载已被删除的路由分片就会报错。
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Procure Lite 采购台账',
        short_name: 'Procure Lite',
        description: '办公用品采购台账：OA 导入、采购执行、库存与领用发放',
        theme_color: '#14213D',
        background_color: '#F3F5F8',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  }
});

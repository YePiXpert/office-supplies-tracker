import axios from 'axios';
import type { Router } from 'vue-router';

/** 统一 API 客户端：同源 Cookie 会话 + 401 跳转登录 */
export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 60_000,
});

let routerRef: Router | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function bindRouter(router: Router): void {
  routerRef = router;
}

/** 注册 401 回调（main.ts 里用它清除前端登录态，避免路由守卫把用户弹回工作台） */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

/** 从 axios 错误中提取用户可读信息 */
export function apiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join('；') : data.message;
    }
    if (e.code === 'ERR_NETWORK') return '网络连接失败';
    return `请求失败（${e.response?.status ?? e.code ?? '未知'}）`;
  }
  return e instanceof Error ? e.message : String(e);
}

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.();
      const path = routerRef?.currentRoute.value.path;
      if (path && path !== '/login') {
        void routerRef?.push({ path: '/login', query: { redirect: path } });
      }
    }
    return Promise.reject(error);
  },
);

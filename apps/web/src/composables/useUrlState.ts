import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

type Primitive = string | number;

/**
 * 把筛选 / 分页 / tab 状态与 URL query 双向同步。
 *
 * - 进入页面时先用 URL 里的值覆盖状态：刷新不丢筛选，链接可以直接发给同事
 * - 状态变化用 replace 写回：不往历史栈里塞一堆中间态，后退键仍然是「回上一个页面」
 * - 等于默认值的项不写进 URL，保持地址干净
 *
 * 只处理字符串/数字这类可序列化的扁平状态；Set、对象等不要放进来。
 */
export function useUrlState<T extends Record<string, Primitive>>(
  state: T,
  defaults: Readonly<T>,
): void {
  const route = useRoute();
  const router = useRouter();

  const keys = Object.keys(defaults) as (keyof T & string)[];

  // 1. URL → 状态（只在进入页面时做一次）
  for (const key of keys) {
    const raw = route.query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value == null || value === '') continue;
    state[key] = (
      typeof defaults[key] === 'number' ? Number(value) || defaults[key] : value
    ) as T[keyof T & string];
  }

  // 2. 状态 → URL
  watch(
    () => keys.map((k) => state[k]),
    (values) => {
      const query: Record<string, string> = {};
      // 保留不归本 composable 管的其它 query 参数
      for (const [k, v] of Object.entries(route.query)) {
        if (!keys.includes(k as keyof T & string) && typeof v === 'string') query[k] = v;
      }
      keys.forEach((key, i) => {
        const value = values[i];
        if (value === defaults[key] || value === '' || value == null) return;
        query[key] = String(value);
      });
      void router.replace({ query }).catch(() => undefined);
    },
  );
}

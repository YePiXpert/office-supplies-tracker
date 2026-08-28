/**
 * 列表请求的竞态守卫。
 *
 * 筛选条件连续变化时会并发多个请求，响应顺序不保证与发起顺序一致；
 * 没有守卫时慢的那个后到，会把过期数据盖在最新结果上。
 */
export function createRequestGuard() {
  let seq = 0;
  return {
    /** 开一轮请求，返回「这一轮是否仍是最新」的判定函数 */
    begin(): () => boolean {
      const mine = ++seq;
      return () => mine === seq;
    },
    /** 丢弃所有在途结果（如离开页面、切换 tab） */
    abandon(): void {
      seq += 1;
    },
  };
}

/** 尾部防抖：搜索框输入用 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  /** 立即执行并取消待触发的那次（回车搜索用） */
  wrapped.flush = (...args: A): void => {
    wrapped.cancel();
    fn(...args);
  };
  return wrapped;
}

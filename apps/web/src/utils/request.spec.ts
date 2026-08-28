import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequestGuard, debounce } from './request';

describe('createRequestGuard', () => {
  it('只有最后发起的那一轮被认为是最新的', () => {
    const guard = createRequestGuard();
    const first = guard.begin();
    const second = guard.begin();
    // 慢的第一个请求后到，必须被丢弃，否则会把过期数据盖上去
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('单独一轮请求始终有效', () => {
    const guard = createRequestGuard();
    const only = guard.begin();
    expect(only()).toBe(true);
  });

  it('abandon 让在途结果全部失效', () => {
    const guard = createRequestGuard();
    const inflight = guard.begin();
    guard.abandon();
    expect(inflight()).toBe(false);
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());

  it('连续调用只执行最后一次', () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 300);
    wrapped('a');
    wrapped('b');
    wrapped('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('cancel 取消待触发的调用', () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 300);
    wrapped('a');
    wrapped.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush 立即执行并吞掉排队的那次', () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 300);
    wrapped('queued');
    wrapped.flush('now');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('now');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

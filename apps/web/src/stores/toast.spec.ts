import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useToastStore } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it('push 添加提示并在超时后自动消失', () => {
    const store = useToastStore();
    store.success('操作成功');
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]).toMatchObject({ kind: 'success', message: '操作成功' });

    vi.advanceTimersByTime(3500);
    expect(store.toasts).toHaveLength(0);
  });

  it('dismiss 手动移除指定提示', () => {
    const store = useToastStore();
    store.error('出错了');
    store.info('提示');
    store.dismiss(store.toasts[0].id);
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].kind).toBe('info');
  });
});

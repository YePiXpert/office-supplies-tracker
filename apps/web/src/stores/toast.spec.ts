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

  it('堆叠数量封顶，挤掉最旧的一条', () => {
    const store = useToastStore();
    // 导入的解析警告可能一次来十几条，不能糊满整屏
    for (let i = 1; i <= 7; i += 1) store.info(`提示 ${i}`);
    expect(store.toasts).toHaveLength(4);
    expect(store.toasts[0].message).toBe('提示 4');
    expect(store.toasts[3].message).toBe('提示 7');
  });

  it('带撤销动作的提示：执行后自身消失', async () => {
    const store = useToastStore();
    const undo = vi.fn();
    store.success('已移入回收站', { label: '撤销', run: undo });
    expect(store.toasts[0].action?.label).toBe('撤销');

    await store.runAction(store.toasts[0]);
    expect(undo).toHaveBeenCalledOnce();
    expect(store.toasts).toHaveLength(0);
  });

  it('带动作的提示停留更久，给用户反悔的时间', () => {
    const store = useToastStore();
    store.success('已移入回收站', { label: '撤销', run: () => undefined });
    vi.advanceTimersByTime(3500);
    expect(store.toasts).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(store.toasts).toHaveLength(0);
  });
});

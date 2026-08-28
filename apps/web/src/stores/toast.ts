import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  action?: ToastAction;
}

let seq = 0;

/** 同时最多堆叠的条数：导入警告可能一次来十几条，超出的挤掉最旧的 */
const MAX_VISIBLE = 4;

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function push(
    kind: Toast['kind'],
    message: string,
    duration = 3200,
    action?: ToastAction,
  ): number {
    const id = ++seq;
    toasts.value.push({ id, kind, message, action });
    while (toasts.value.length > MAX_VISIBLE) {
      const dropped = toasts.value.shift();
      if (dropped) clearTimer(dropped.id);
    }
    timers.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }

  function clearTimer(id: number): void {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
  }

  function dismiss(id: number): void {
    clearTimer(id);
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  async function runAction(t: Toast): Promise<void> {
    dismiss(t.id);
    await t.action?.run();
  }

  // 返回 void：调用点普遍写成 `return toast.error(...)` 做提前返回
  return {
    toasts,
    success: (msg: string, action?: ToastAction): void => {
      push('success', msg, action ? 6000 : 3200, action);
    },
    error: (msg: string): void => {
      push('error', msg, 5000);
    },
    info: (msg: string): void => {
      push('info', msg);
    },
    dismiss,
    runAction,
  };
});

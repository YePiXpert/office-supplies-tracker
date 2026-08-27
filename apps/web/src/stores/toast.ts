import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

let seq = 0;

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  function push(kind: Toast['kind'], message: string, duration = 3200): void {
    const id = ++seq;
    toasts.value.push({ id, kind, message });
    setTimeout(() => dismiss(id), duration);
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg, 5000),
    info: (msg: string) => push('info', msg),
    dismiss,
  };
});

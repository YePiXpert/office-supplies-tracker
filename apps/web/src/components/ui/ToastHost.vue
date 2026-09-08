<script setup lang="ts">
import { useToastStore } from '@/stores/toast';
import Icon from './Icon.vue';

const toast = useToastStore();

const icons = { success: 'check', error: 'alert', info: 'clock' } as const;
/* 左侧 3px 色条 + 图标着色指示类型 */
const bars = {
  success: 'bg-teal',
  error: 'bg-red',
  info: 'bg-primary',
} as const;
const iconTones = {
  success: 'text-teal',
  error: 'text-red',
  info: 'text-primary',
} as const;
</script>

<template>
  <!-- bottom-20 让开移动端底部导航（h-14），桌面回到 bottom-4 -->
  <div
    class="fixed z-[100] bottom-20 lg:bottom-4 right-4 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    role="region"
    aria-label="通知"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        class="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden bg-surface border border-line rounded-(--radius-card) shadow-(--shadow-pop) px-3.5 py-3"
        :role="t.kind === 'error' ? 'alert' : 'status'"
        :aria-live="t.kind === 'error' ? 'assertive' : 'polite'"
      >
        <span class="absolute inset-y-0 left-0 w-[3px]" :class="bars[t.kind]" aria-hidden="true" />
        <Icon :name="icons[t.kind]" :size="15" class="mt-0.5 shrink-0" :class="iconTones[t.kind]" />
        <p class="flex-1 text-sm text-text leading-relaxed break-words">{{ t.message }}</p>
        <button
          v-if="t.action"
          class="shrink-0 -my-0.5 h-7 px-2 rounded-md border border-line-strong text-muted text-xs font-semibold cursor-pointer transition-colors duration-150 hover:text-primary hover:border-primary active:scale-[0.98]"
          @click="toast.runAction(t)"
        >
          {{ t.action.label }}
        </button>
        <button
          class="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-faint hover:text-text cursor-pointer transition-colors duration-150"
          aria-label="关闭提示"
          @click="toast.dismiss(t.id)"
        >
          <Icon name="close" :size="13" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

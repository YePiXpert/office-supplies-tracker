<script setup lang="ts">
import { useToastStore } from '@/stores/toast';
import Icon from './Icon.vue';

const toast = useToastStore();

const icons = { success: 'check', error: 'alert', info: 'clock' } as const;
const tones = {
  success: 'border-teal/30 text-teal',
  error: 'border-red/30 text-red',
  info: 'border-line-strong text-muted',
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
        class="pointer-events-auto flex items-start gap-2.5 bg-surface border rounded-(--radius-card) shadow-(--shadow-pop) px-3.5 py-3"
        :class="tones[t.kind]"
        :role="t.kind === 'error' ? 'alert' : 'status'"
        :aria-live="t.kind === 'error' ? 'assertive' : 'polite'"
      >
        <Icon :name="icons[t.kind]" :size="15" class="mt-0.5 shrink-0" />
        <p class="flex-1 text-sm text-text leading-relaxed break-words">{{ t.message }}</p>
        <button
          v-if="t.action"
          class="shrink-0 -my-0.5 h-7 px-2 rounded-md border border-current/30 text-xs font-semibold cursor-pointer hover:bg-current/10"
          @click="toast.runAction(t)"
        >
          {{ t.action.label }}
        </button>
        <button
          class="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-faint hover:text-text cursor-pointer"
          aria-label="关闭提示"
          @click="toast.dismiss(t.id)"
        >
          <Icon name="close" :size="13" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

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
  <div class="fixed z-[100] bottom-4 right-4 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm" role="status" aria-live="polite">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        class="flex items-start gap-2.5 bg-surface border rounded-(--radius-card) shadow-(--shadow-pop) px-3.5 py-3 cursor-pointer"
        :class="tones[t.kind]"
        @click="toast.dismiss(t.id)"
      >
        <Icon :name="icons[t.kind]" :size="15" class="mt-0.5 shrink-0" />
        <p class="text-sm text-text leading-relaxed">{{ t.message }}</p>
      </div>
    </TransitionGroup>
  </div>
</template>

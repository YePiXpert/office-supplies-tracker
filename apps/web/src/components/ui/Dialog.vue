<script setup lang="ts">
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    width?: string;
  }>(),
  { width: '560px' },
);
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 max-h-[88vh] overflow-y-auto bg-surface border border-line rounded-(--radius-card) shadow-(--shadow-pop) focus:outline-none"
        :style="{ maxWidth: props.width }"
      >
        <div class="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
          <div>
            <DialogTitle class="text-base font-bold text-ink">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-0.5 text-xs text-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose class="p-1.5 -m-1 rounded-md text-faint hover:text-text hover:bg-canvas cursor-pointer" aria-label="关闭">
            <Icon name="close" :size="16" />
          </DialogClose>
        </div>
        <div class="px-5 py-4">
          <slot />
        </div>
        <div v-if="$slots.footer" class="flex justify-end gap-2 px-5 py-3.5 border-t border-line bg-canvas/60 rounded-b-(--radius-card)">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogDescription,
} from 'reka-ui';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    width?: string;
    /** 只能通过明确的按钮关闭（恢复码这类「看完就没了」的内容用） */
    persistent?: boolean;
    /** 表单有未保存改动：关闭前先问一句，避免点遮罩把填了一半的表单弄丢 */
    dirty?: boolean;
  }>(),
  { width: '560px', persistent: false, dirty: false },
);
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const confirmDiscard = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) confirmDiscard.value = false;
  },
);

/** 所有关闭入口都先过这里 */
function requestClose(): void {
  if (props.persistent) return;
  if (props.dirty) {
    confirmDiscard.value = true;
    return;
  }
  emit('update:open', false);
}

function discard(): void {
  confirmDiscard.value = false;
  emit('update:open', false);
}
</script>

<template>
  <DialogRoot :open="props.open" @update:open="(v) => { if (!v) requestClose(); }">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 max-h-[88vh] overflow-y-auto bg-surface border border-line rounded-(--radius-card) shadow-(--shadow-pop) focus:outline-none"
        :style="{ maxWidth: props.width }"
        @escape-key-down="(e: Event) => { if (persistent) e.preventDefault(); }"
        @pointer-down-outside="(e: Event) => { if (persistent) e.preventDefault(); }"
        @interact-outside="(e: Event) => { if (persistent) e.preventDefault(); }"
      >
        <div class="sticky top-0 z-10 flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line bg-surface">
          <div class="min-w-0">
            <DialogTitle class="text-base font-bold text-ink">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-0.5 text-xs text-muted break-words">
              {{ description }}
            </DialogDescription>
          </div>
          <button
            v-if="!persistent"
            type="button"
            class="shrink-0 p-1.5 -m-1 rounded-md text-faint hover:text-text hover:bg-canvas cursor-pointer"
            aria-label="关闭"
            @click="requestClose"
          >
            <Icon name="close" :size="16" />
          </button>
        </div>
        <div class="px-5 py-4">
          <slot />
        </div>
        <div v-if="$slots.footer" class="sticky bottom-0 flex justify-end gap-2 px-5 py-3.5 border-t border-line bg-canvas/95 backdrop-blur-sm rounded-b-(--radius-card)">
          <slot name="footer" />
        </div>

        <!-- 放弃未保存内容的二次确认（内嵌，避免嵌套 portal 的层级问题） -->
        <div v-if="confirmDiscard" class="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40">
          <div class="mx-4 max-w-xs bg-surface border border-line rounded-(--radius-card) shadow-(--shadow-pop) p-4">
            <p class="text-sm font-bold text-ink">放弃未保存的修改？</p>
            <p class="mt-1 text-xs text-muted">关闭后这次填写的内容不会保留。</p>
            <div class="mt-4 flex justify-end gap-2">
              <button
                type="button"
                class="h-8 px-3 text-xs font-medium rounded-(--radius-control) border border-line-strong text-muted hover:text-primary hover:border-primary cursor-pointer"
                @click="confirmDiscard = false"
              >
                继续编辑
              </button>
              <button
                type="button"
                class="h-8 px-3 text-xs font-medium rounded-(--radius-control) bg-red text-white hover:bg-red/90 cursor-pointer"
                @click="discard"
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

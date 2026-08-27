<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';
import Icon from './Icon.vue';

export interface SelectOption {
  label: string;
  value: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    options: SelectOption[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  { placeholder: '请选择' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="block">
    <span v-if="label" class="block mb-1.5 text-xs font-semibold text-muted">{{ label }}</span>
    <SelectRoot
      :model-value="modelValue ?? undefined"
      @update:model-value="(v) => emit('update:modelValue', v === null ? '' : String(v))"
    >
      <SelectTrigger
        class="inline-flex w-full h-9.5 items-center justify-between gap-2 px-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) data-[placeholder]:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        :disabled="disabled"
        :aria-label="label"
      >
        <span class="truncate">
          <template v-if="clearable && modelValue">
            <button
              type="button"
              class="mr-1 text-faint hover:text-red"
              aria-label="清除选择"
              @click.prevent.stop="emit('update:modelValue', '')"
            >×</button>
          </template>
          <SelectValue :placeholder="placeholder" />
        </span>
        <Icon name="chevron-down" :size="14" class="shrink-0 text-muted" />
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          position="popper"
          :side-offset="4"
          class="z-50 max-h-72 min-w-(--reka-select-trigger-width) overflow-hidden bg-surface border border-line rounded-(--radius-control) shadow-(--shadow-pop)"
        >
          <SelectScrollUpButton class="flex h-6 items-center justify-center text-muted"><Icon name="chevron-down" :size="12" class="rotate-180" /></SelectScrollUpButton>
          <SelectViewport class="p-1">
            <SelectItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="relative flex items-center h-8 px-7 pr-3 text-sm rounded-md cursor-pointer data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary data-[state=checked]:font-semibold"
            >
              <SelectItemIndicator class="absolute left-2 inline-flex items-center">
                <Icon name="check" :size="13" class="text-primary" />
              </SelectItemIndicator>
              <span class="truncate">{{ opt.label }}</span>
            </SelectItem>
          </SelectViewport>
          <SelectScrollDownButton class="flex h-6 items-center justify-center text-muted"><Icon name="chevron-down" :size="12" /></SelectScrollDownButton>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

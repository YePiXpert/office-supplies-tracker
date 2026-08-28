<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import Icon from './Icon.vue';
import { debounce } from '@/utils/request';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    icon?: string;
    /** 停止输入多久后自动搜索；设 0 表示只在回车/失焦时搜 */
    delay?: number;
    ariaLabel?: string;
  }>(),
  { placeholder: '搜索', icon: 'search', delay: 350 },
);
const emit = defineEmits<{ 'update:modelValue': [v: string]; search: [] }>();

/** 本地态：输入即时反映在框里，但只在防抖到点后才向上抛搜索 */
const draft = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => {
    if (v !== draft.value) draft.value = v;
  },
);

const fire = debounce(() => {
  emit('update:modelValue', draft.value);
  emit('search');
}, props.delay);

function onInput(e: Event): void {
  draft.value = (e.target as HTMLInputElement).value;
  if (props.delay > 0) fire();
}

function submit(): void {
  fire.cancel();
  emit('update:modelValue', draft.value);
  emit('search');
}

function clear(): void {
  fire.cancel();
  draft.value = '';
  emit('update:modelValue', '');
  emit('search');
}

onBeforeUnmount(() => fire.cancel());
</script>

<template>
  <div class="relative">
    <Icon :name="icon" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
    <input
      :value="draft"
      type="search"
      :placeholder="placeholder"
      :aria-label="ariaLabel ?? placeholder"
      class="w-full h-9.5 pl-9 pr-8 text-sm bg-surface border border-line-strong rounded-(--radius-control) placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors [&::-webkit-search-cancel-button]:hidden"
      @input="onInput"
      @keyup.enter="submit"
      @keyup.escape="clear"
    />
    <button
      v-if="draft"
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 rounded-full text-faint hover:text-text hover:bg-canvas cursor-pointer"
      aria-label="清除搜索"
      @click="clear"
    >
      <Icon name="close" :size="12" />
    </button>
  </div>
</template>

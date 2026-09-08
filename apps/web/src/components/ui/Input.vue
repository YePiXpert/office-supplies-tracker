<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    label?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    hint?: string;
    /** 字段级错误：有值时输入框转红并在下方给出原因 */
    error?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    autocomplete?: string;
    /** 输入建议来源（datalist），如历史领用人、部门 */
    suggestions?: string[];
  }>(),
  { type: 'text' },
);
const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [e: FocusEvent];
  enter: [];
}>();

const listId = `dl-${Math.random().toString(36).slice(2, 9)}`;
</script>

<template>
  <label class="block">
    <span v-if="label" class="block mb-1.5 text-xs font-semibold text-muted">
      {{ label }}<span v-if="required" class="text-red ml-0.5">*</span>
    </span>
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :min="min"
      :max="max"
      :step="step"
      :autocomplete="autocomplete"
      :list="suggestions?.length ? listId : undefined"
      :aria-label="label"
      :aria-invalid="error ? 'true' : undefined"
      class="w-full h-9.5 px-3 text-sm bg-surface border rounded-(--radius-control) placeholder:text-faint disabled:bg-canvas disabled:cursor-not-allowed focus:outline-none focus:ring-2 transition-colors"
      :class="error
        ? 'border-red focus:border-red focus:ring-red/20'
        : 'border-line-strong focus:border-primary focus:ring-primary/20'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur', $event)"
      @keyup.enter="emit('enter')"
    />
    <datalist v-if="suggestions?.length" :id="listId">
      <option v-for="s in suggestions" :key="s" :value="s" />
    </datalist>
    <span v-if="error" class="mt-1 flex items-start gap-1 text-xs text-red">
      <Icon name="alert" :size="12" class="mt-0.5 shrink-0" />{{ error }}
    </span>
    <span v-else-if="hint" class="block mt-1 text-xs text-faint">{{ hint }}</span>
  </label>
</template>

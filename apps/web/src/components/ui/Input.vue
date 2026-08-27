<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    label?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    hint?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
  }>(),
  { type: 'text' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
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
      :aria-label="label"
      class="w-full h-9.5 px-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) placeholder:text-faint disabled:bg-canvas disabled:cursor-not-allowed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors"
      @input="onInput"
    />
    <span v-if="hint" class="block mt-1 text-xs text-faint">{{ hint }}</span>
  </label>
</template>

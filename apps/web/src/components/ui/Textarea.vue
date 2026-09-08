<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string | null;
    label?: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    required?: boolean;
  }>(),
  { rows: 3 },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <label class="block">
    <span v-if="label" class="block mb-1.5 text-xs font-semibold text-muted">
      {{ label }}<span v-if="required" class="text-red ml-0.5">*</span>
    </span>
    <textarea
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :required="required"
      :aria-label="label"
      class="w-full px-3 py-2 text-sm bg-surface border border-line-strong rounded-(--radius-control) placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors resize-y"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </label>
</template>

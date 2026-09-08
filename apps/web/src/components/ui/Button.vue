<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit';
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
);

const variants = {
  primary:
    'bg-primary text-white hover:bg-primary-hover border border-transparent shadow-(--shadow-xs) disabled:opacity-50',
  secondary:
    'bg-surface text-text border border-line-strong hover:border-primary hover:text-primary',
  ghost: 'bg-transparent text-muted hover:text-primary hover:bg-primary-soft border border-transparent',
  danger: 'bg-red text-white hover:bg-red/90 border border-transparent',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9.5 px-4 text-sm gap-2',
} as const;
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center font-medium rounded-(--radius-control) transition-all duration-150 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
    :class="[variants[variant], sizes[size]]"
  >
    <span v-if="loading" class="inline-block size-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'blue' | 'teal' | 'amber' | 'red' | 'gray' }>(), { tone: 'gray' });

const tones = {
  blue: 'bg-primary-soft text-primary border-primary/20',
  teal: 'bg-teal-soft text-teal border-teal/25',
  amber: 'bg-amber-soft text-amber border-amber/25',
  red: 'bg-red-soft text-red border-red/25',
  gray: 'bg-canvas text-muted border-line-strong',
} as const;
</script>

<template>
  <span
    class="inline-flex items-center gap-1 h-6 px-2 border text-xs font-medium rounded-full whitespace-nowrap"
    :class="tones[tone]"
  >
    <slot />
  </span>
</template>

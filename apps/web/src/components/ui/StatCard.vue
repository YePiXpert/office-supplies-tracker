<script setup lang="ts">
import Icon from './Icon.vue';
import { RouterLink } from 'vue-router';

defineProps<{
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  icon: string;
  tone?: 'blue' | 'teal' | 'amber' | 'red' | 'gray';
  to?: string;
}>();

const tones = {
  blue: 'bg-primary-soft text-primary',
  teal: 'bg-teal-soft text-teal',
  amber: 'bg-amber-soft text-amber',
  red: 'bg-red-soft text-red',
  gray: 'bg-canvas text-muted',
} as const;
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="card group flex items-center gap-3.5 px-4 py-3.5 transition-colors"
    :class="to ? 'hover:border-primary/40' : ''"
  >
    <span class="flex items-center justify-center size-10 rounded-(--radius-card) shrink-0" :class="tones[tone ?? 'gray']">
      <Icon :name="icon" :size="18" />
    </span>
    <div class="min-w-0">
      <p class="text-xs text-muted truncate">{{ label }}</p>
      <p class="text-xl font-bold text-ink num leading-tight">
        {{ value }}<span v-if="unit" class="ml-1 text-xs font-medium text-faint">{{ unit }}</span>
      </p>
      <p v-if="hint" class="text-meta text-faint truncate mt-0.5">{{ hint }}</p>
    </div>
    <!-- 可点击卡片：hover 时箭头滑入，给出「能点进去」的明示 -->
    <Icon
      v-if="to"
      name="chevron-right"
      :size="15"
      class="ml-auto shrink-0 -translate-x-1 text-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100"
    />
  </component>
</template>

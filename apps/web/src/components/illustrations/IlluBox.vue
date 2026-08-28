<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 空纸箱：库存空、通用空态 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <!-- 打开的纸箱：顶口朝斜上方，侧板+正面 -->
    <path d="M54 62 L66 50 H118 L106 62 Z" :fill="c.ink" fill-opacity="0.08" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M106 62 L118 50 V80 L106 92 Z" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M54 62 H106 V88 a4 4 0 0 1 -4 4 H58 a4 4 0 0 1 -4 -4 Z" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <!-- 箱面胶带缝 -->
    <line x1="80" y1="62" x2="80" y2="92" :stroke="c.ink" stroke-opacity="0.15" stroke-width="1.5" stroke-dasharray="3 4" />
    <!-- 空空如也：上方漂浮的虚线与点缀 -->
    <line x1="70" y1="36" x2="90" y2="36" :stroke="c.main" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="1 5" />
    <circle cx="128" cy="30" r="2" :fill="c.main" />
    <circle cx="34" cy="44" r="1.5" :fill="c.main" fill-opacity="0.5" />
  </IlluBase>
</template>

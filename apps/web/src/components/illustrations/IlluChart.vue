<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 图表：报表 / 统计空态 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <rect x="36" y="28" width="88" height="64" rx="8" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" />
    <rect x="46" y="38" width="22" height="4" rx="2" :fill="c.ink" fill-opacity="0.16" />
    <!-- 柱状图 -->
    <rect x="50" y="64" width="10" height="18" rx="2" :fill="c.main" />
    <rect x="66" y="56" width="10" height="26" rx="2" :fill="c.main" fill-opacity="0.55" />
    <rect x="82" y="70" width="10" height="12" rx="2" :fill="c.main" fill-opacity="0.3" />
    <rect x="98" y="50" width="10" height="32" rx="2" :fill="c.main" fill-opacity="0.8" />
    <!-- 趋势线 -->
    <path d="M55 58 L71 50 L87 55 L103 44" fill="none" :stroke="c.ink" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="103" cy="44" r="2.4" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" />
    <!-- 基线 -->
    <line x1="46" y1="82" x2="114" y2="82" :stroke="c.ink" stroke-opacity="0.25" stroke-width="1.5" stroke-linecap="round" />
  </IlluBase>
</template>

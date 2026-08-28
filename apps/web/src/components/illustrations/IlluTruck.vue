<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 货车：供应商、待到货场景 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <!-- 货厢 -->
    <rect x="38" y="46" width="50" height="32" rx="4" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" />
    <line x1="55" y1="46" x2="55" y2="78" :stroke="c.ink" stroke-opacity="0.12" stroke-width="1.5" />
    <line x1="72" y1="46" x2="72" y2="78" :stroke="c.ink" stroke-opacity="0.12" stroke-width="1.5" />
    <!-- 车头 -->
    <path d="M88 56 h14 a3 3 0 0 1 3 3 l5 8 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -3 3 H88 Z" :fill="c.main" />
    <path d="M94 61 h7 l4 7 h-11 Z" fill="#fff" fill-opacity="0.85" />
    <!-- 车轮 -->
    <circle cx="54" cy="80" r="6.5" :fill="c.ink" />
    <circle cx="98" cy="80" r="6.5" :fill="c.ink" />
    <circle cx="54" cy="80" r="2.2" fill="var(--color-surface)" />
    <circle cx="98" cy="80" r="2.2" fill="var(--color-surface)" />
    <!-- 地面与速度线 -->
    <line x1="30" y1="87" x2="130" y2="87" :stroke="c.ink" stroke-opacity="0.18" stroke-width="1.5" stroke-linecap="round" />
    <line x1="26" y1="54" x2="33" y2="54" :stroke="c.main" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round" />
    <line x1="22" y1="64" x2="33" y2="64" :stroke="c.main" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round" />
    <circle cx="126" cy="34" r="2" :fill="c.main" />
  </IlluBase>
</template>

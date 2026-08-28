<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 空收件盘：发放记录、审计日志等通用空态 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <!-- 后挡板 -->
    <rect x="54" y="40" width="52" height="14" rx="4" :fill="c.ink" fill-opacity="0.1" />
    <!-- 托盘：前沿带拿取凹口 -->
    <path d="M44 54 h20 q16 12 32 0 h20 v24 a5 5 0 0 1 -5 5 H49 a5 5 0 0 1 -5 -5 Z" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <!-- 还没东西进来：上方漂浮的点缀 -->
    <circle cx="80" cy="30" r="2" :fill="c.main" />
    <circle cx="68" cy="24" r="1.4" :fill="c.main" fill-opacity="0.55" />
    <circle cx="92" cy="23" r="1.4" :fill="c.main" fill-opacity="0.35" />
  </IlluBase>
</template>

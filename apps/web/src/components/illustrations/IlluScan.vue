<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 单据扫描：导入页引导 / 导入空态 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <!-- 扫描框四角 -->
    <path d="M48 34 V26 a4 4 0 0 1 4 -4 h8" fill="none" :stroke="c.main" stroke-width="2" stroke-linecap="round" />
    <path d="M100 22 h8 a4 4 0 0 1 4 4 v8" fill="none" :stroke="c.main" stroke-width="2" stroke-linecap="round" />
    <path d="M112 78 v8 a4 4 0 0 1 -4 4 h-8" fill="none" :stroke="c.main" stroke-width="2" stroke-linecap="round" />
    <path d="M60 90 h-8 a4 4 0 0 1 -4 -4 v-8" fill="none" :stroke="c.main" stroke-width="2" stroke-linecap="round" />
    <!-- 单据（右上角折角） -->
    <path d="M62 32 h28 l8 8 v44 a3 3 0 0 1 -3 3 H62 a3 3 0 0 1 -3 -3 V35 a3 3 0 0 1 3 -3 Z" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M90 32 v8 h8" fill="none" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <rect x="66" y="48" width="24" height="3.5" rx="1.75" :fill="c.ink" fill-opacity="0.14" />
    <rect x="66" y="57" width="24" height="3.5" rx="1.75" :fill="c.ink" fill-opacity="0.14" />
    <rect x="66" y="66" width="15" height="3.5" rx="1.75" :fill="c.ink" fill-opacity="0.14" />
    <!-- 扫描线 -->
    <rect x="52" y="42" width="56" height="2" rx="1" :fill="c.main" fill-opacity="0.45" />
  </IlluBase>
</template>

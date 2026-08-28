<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 警告三角：加载失败 / 系统错误 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'red', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <path d="M80 30 L113 82 a7 7 0 0 1 -6 10 H53 a7 7 0 0 1 -6 -10 Z" fill="var(--color-surface)" :stroke="c.main" stroke-width="2" stroke-linejoin="round" />
    <line x1="80" y1="50" x2="80" y2="67" :stroke="c.main" stroke-width="3.5" stroke-linecap="round" />
    <circle cx="80" cy="77" r="2.4" :fill="c.main" />
    <!-- 角落小装饰 -->
    <circle cx="122" cy="32" r="2" :fill="c.main" fill-opacity="0.5" />
    <path d="M36 30 v8 M32 34 h8" :stroke="c.main" stroke-opacity="0.4" stroke-width="1.6" stroke-linecap="round" />
  </IlluBase>
</template>

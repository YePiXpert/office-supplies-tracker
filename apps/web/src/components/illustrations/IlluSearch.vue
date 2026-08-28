<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 放大镜下的空白：筛选 / 搜索无结果 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <!-- 后排的文档堆 -->
    <rect x="92" y="24" width="30" height="38" rx="5" :fill="c.ink" fill-opacity="0.07" />
    <rect x="100" y="32" width="30" height="38" rx="5" :fill="c.ink" fill-opacity="0.05" />
    <!-- 放大镜 -->
    <circle cx="70" cy="56" r="19" fill="var(--color-surface)" :stroke="c.main" stroke-width="2.5" />
    <line x1="84" y1="70" x2="99" y2="85" :stroke="c.main" stroke-width="5" stroke-linecap="round" />
    <!-- 视野内没有结果 -->
    <line x1="60" y1="52" x2="80" y2="52" :stroke="c.ink" stroke-opacity="0.18" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 6" />
    <line x1="60" y1="61" x2="73" y2="61" :stroke="c.ink" stroke-opacity="0.18" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 6" />
    <circle cx="126" cy="80" r="1.8" :fill="c.main" fill-opacity="0.5" />
  </IlluBase>
</template>

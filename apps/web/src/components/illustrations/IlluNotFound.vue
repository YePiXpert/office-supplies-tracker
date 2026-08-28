<script setup lang="ts">
import IlluBase from './IlluBase.vue';
import type { IlluTone } from './tone';

/** 路标：404 页面不存在 */
withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });
</script>

<template>
  <IlluBase :tone="tone" :size="size" v-slot="{ c }">
    <!-- 路标杆与地面 -->
    <rect x="77" y="30" width="5" height="58" rx="2.5" :fill="c.ink" />
    <ellipse cx="79.5" cy="92" rx="14" ry="3" :fill="c.ink" fill-opacity="0.12" />
    <!-- 右指路牌：404 -->
    <path d="M82 38 h30 l9 8 -9 8 H82 a2 2 0 0 1 -2 -2 V40 a2 2 0 0 1 2 -2 Z" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <text x="99" y="49.5" text-anchor="middle" font-size="8.5" font-weight="700" :fill="c.main" font-family="var(--font-mono)">404</text>
    <!-- 左指路牌：空白 -->
    <path d="M77 60 H47 l-9 8 9 8 h30 a2 2 0 0 0 2 -2 V62 a2 2 0 0 0 -2 -2 Z" fill="var(--color-surface)" :stroke="c.ink" stroke-width="1.5" stroke-linejoin="round" />
    <line x1="52" y1="68" x2="66" y2="68" :stroke="c.ink" stroke-opacity="0.25" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 5" />
    <!-- 草点 -->
    <circle cx="112" cy="88" r="1.6" :fill="c.main" fill-opacity="0.5" />
    <circle cx="48" cy="90" r="1.6" :fill="c.main" fill-opacity="0.35" />
  </IlluBase>
</template>

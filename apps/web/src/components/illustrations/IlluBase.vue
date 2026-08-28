<script setup lang="ts">
import { computed } from 'vue';
import { toneColors, type IlluTone } from './tone';

/**
 * 企业风场景插画的统一画板：160×120 视窗 + 柔色圆角面板。
 * 场景组件通过默认插槽拿到调色板 c（main/soft/ink），只画内容。
 *
 * 风格约定：圆角几何、双色（soft 打底 + main 强调 + ink 线稿）、
 * 1.5px 描边、克制点缀；不加渐变、不引位图。
 */
const props = withDefaults(defineProps<{ tone?: IlluTone; size?: number }>(), { tone: 'blue', size: 132 });

const c = computed(() => toneColors[props.tone]);
const height = computed(() => Math.round(props.size * 0.75));
</script>

<template>
  <svg :width="size" :height="height" viewBox="0 0 160 120" fill="none" aria-hidden="true" class="shrink-0">
    <rect x="18" y="14" width="124" height="92" rx="14" :fill="c.soft" />
    <slot :c="c" />
  </svg>
</template>

<script setup lang="ts">
/**
 * 低透明度点阵纹理：铺在深色面板（墨蓝品牌区、概览横幅）上当底纹。
 * 用 currentColor 上色，透传 class 控制颜色与透明度，如 class="text-white/10"。
 */
withDefaults(defineProps<{ gap?: number; r?: number }>(), { gap: 22, r: 1.2 });

// 同页多个实例共存时 pattern id 不能撞
const id = `pg-${Math.random().toString(36).slice(2, 9)}`;
</script>

<template>
  <svg class="absolute inset-0 size-full pointer-events-none" aria-hidden="true">
    <defs>
      <pattern :id="id" :width="gap" :height="gap" patternUnits="userSpaceOnUse">
        <circle :cx="gap / 2" :cy="gap / 2" :r="r" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" :fill="`url(#${id})`" />
  </svg>
</template>

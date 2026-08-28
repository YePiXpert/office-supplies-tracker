<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import IlluBox from '../illustrations/IlluBox.vue';
import IlluLedger from '../illustrations/IlluLedger.vue';
import IlluScan from '../illustrations/IlluScan.vue';
import IlluChart from '../illustrations/IlluChart.vue';
import IlluTruck from '../illustrations/IlluTruck.vue';
import IlluSearch from '../illustrations/IlluSearch.vue';
import IlluEmpty from '../illustrations/IlluEmpty.vue';
import type { IlluTone } from '../illustrations/tone';

/** 空态场景插画（手绘 SVG，见 components/illustrations/） */
const scenes = {
  box: IlluBox,
  ledger: IlluLedger,
  scan: IlluScan,
  chart: IlluChart,
  truck: IlluTruck,
  search: IlluSearch,
  empty: IlluEmpty,
} as const;

const props = withDefaults(
  defineProps<{
    /** 场景插画名；不传则回退到圆圈里的线条图标 */
    illustration?: keyof typeof scenes;
    tone?: IlluTone;
    icon?: string;
    title: string;
    description?: string;
  }>(),
  { icon: 'box', tone: 'blue' },
);

const illu = computed(() => (props.illustration ? scenes[props.illustration] : null));
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <component :is="illu" v-if="illu" :tone="tone" :size="132" class="mb-1" />
    <div v-else class="flex items-center justify-center size-12 rounded-full bg-canvas text-faint border border-line">
      <Icon :name="icon" :size="20" />
    </div>
    <p class="text-sm font-semibold text-muted">{{ title }}</p>
    <p v-if="description" class="text-xs text-faint max-w-xs">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts';
import { VChart } from '@/plugins/echarts';

withDefaults(defineProps<{ option: EChartsOption; height?: string }>(), { height: '240px' });
</script>

<template>
  <VChart :option="option" autoresize :style="{ height }" class="w-full" />
</template>

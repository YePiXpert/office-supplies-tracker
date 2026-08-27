<script setup lang="ts">
import { computed } from 'vue';
import Badge from './Badge.vue';
import { ITEM_STATUS_LABELS, ITEM_STATUS_TONES, type ItemStatus } from '@procure-lite/shared';

const props = defineProps<{ status: string }>();
const label = computed(() => ITEM_STATUS_LABELS[props.status as ItemStatus] ?? props.status);
const tone = computed(() => ITEM_STATUS_TONES[props.status as ItemStatus] ?? 'gray');
</script>

<template>
  <Badge :tone="tone">{{ label }}</Badge>
</template>

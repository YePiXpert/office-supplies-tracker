<script setup lang="ts">
import Icon from './Icon.vue';
withDefaults(defineProps<{ icon?: string; title: string; description?: string }>(), { icon: 'box' });
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <div class="flex items-center justify-center size-12 rounded-full bg-canvas text-faint border border-line">
      <Icon :name="icon" :size="20" />
    </div>
    <p class="text-sm font-semibold text-muted">{{ title }}</p>
    <p v-if="description" class="text-xs text-faint max-w-xs">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>

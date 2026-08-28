<script setup lang="ts">
import Icon from './Icon.vue';
import Button from './Button.vue';

withDefaults(
  defineProps<{ title?: string; message?: string; retrying?: boolean }>(),
  { title: '加载失败' },
);
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2.5 py-14 text-center">
    <div class="flex items-center justify-center size-12 rounded-full bg-red-soft text-red border border-red/20">
      <Icon name="alert" :size="20" />
    </div>
    <p class="text-sm font-semibold text-ink">{{ title }}</p>
    <p v-if="message" class="text-xs text-muted max-w-sm break-words">{{ message }}</p>
    <Button variant="secondary" size="sm" class="mt-2" :loading="retrying" @click="$emit('retry')">
      <Icon name="refresh" :size="13" /> 重新加载
    </Button>
  </div>
</template>

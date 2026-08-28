<script setup lang="ts">
import Icon from './Icon.vue';
import Button from './Button.vue';
import IlluError from '../illustrations/IlluError.vue';

withDefaults(
  defineProps<{ title?: string; message?: string; retrying?: boolean }>(),
  { title: '加载失败' },
);
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
    <IlluError :size="120" class="mb-1" />
    <p class="text-sm font-semibold text-ink">{{ title }}</p>
    <p v-if="message" class="text-xs text-muted max-w-sm break-words">{{ message }}</p>
    <Button variant="secondary" size="sm" class="mt-2" :loading="retrying" @click="$emit('retry')">
      <Icon name="refresh" :size="13" /> 重新加载
    </Button>
  </div>
</template>

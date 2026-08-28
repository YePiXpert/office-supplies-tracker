<script setup lang="ts">
import { useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';

const router = useRouter();
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
    <div class="flex items-center justify-center size-14 rounded-2xl bg-canvas border border-line text-faint">
      <Icon name="search" :size="24" />
    </div>
    <div>
      <h1 class="text-lg font-bold text-ink">页面不存在</h1>
      <p class="mt-1 text-sm text-muted">地址可能输错了，或者这个页面已经被移除。</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" @click="router.back()">返回上一页</Button>
      <Button variant="primary" @click="router.push('/dashboard')">回到概览</Button>
    </div>
  </div>
</template>

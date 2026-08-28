<script setup lang="ts">
/**
 * 登录页品牌区主视觉：OA 导入 → 采购执行 → 库存管理 → 领用发放 的流程构图。
 * 深色（墨蓝）底专用：白线稿 + primary 步骤角标，不走 tone 系统。
 */
withDefaults(defineProps<{ width?: number }>(), { width: 320 });
</script>

<template>
  <svg
    viewBox="0 0 300 110"
    fill="none"
    aria-hidden="true"
    class="block"
    :style="{ width: '100%', maxWidth: `${width}px`, height: 'auto' }"
  >
    <!-- 节点间虚线连接 + 箭头 -->
    <line x1="60" y1="44" x2="84" y2="44" stroke="#fff" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round" />
    <path d="M84 41.5 l5 2.5 -5 2.5 Z" fill="#fff" fill-opacity="0.45" />
    <line x1="134" y1="44" x2="158" y2="44" stroke="#fff" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round" />
    <path d="M158 41.5 l5 2.5 -5 2.5 Z" fill="#fff" fill-opacity="0.45" />
    <line x1="208" y1="44" x2="232" y2="44" stroke="#fff" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round" />
    <path d="M232 41.5 l5 2.5 -5 2.5 Z" fill="#fff" fill-opacity="0.45" />

    <!-- 节点 1：OA 单 -->
    <rect x="15" y="23" width="42" height="42" rx="11" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.2" stroke-width="1.2" />
    <rect x="27" y="33" width="18" height="22" rx="2.5" stroke="#fff" stroke-opacity="0.9" stroke-width="1.5" />
    <line x1="31" y1="40" x2="41" y2="40" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round" />
    <line x1="31" y1="45" x2="41" y2="45" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round" />
    <line x1="31" y1="50" x2="37" y2="50" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="55" cy="25" r="7" fill="var(--color-primary)" />
    <text x="55" y="28" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">1</text>
    <text x="36" y="90" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity="0.6">OA 导入</text>

    <!-- 节点 2：采购（购物车） -->
    <rect x="89" y="23" width="42" height="42" rx="11" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.2" stroke-width="1.2" />
    <path d="M99 37 h3.5 l2 11.5 a1.5 1.5 0 0 0 1.5 1.5 h10.5 a1.5 1.5 0 0 0 1.5 -1.2 l2 -7.8 h-12.5" stroke="#fff" stroke-opacity="0.9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="107" cy="54" r="1.7" fill="#fff" fill-opacity="0.9" />
    <circle cx="115.5" cy="54" r="1.7" fill="#fff" fill-opacity="0.9" />
    <circle cx="129" cy="25" r="7" fill="var(--color-primary)" />
    <text x="129" y="28" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">2</text>
    <text x="110" y="90" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity="0.6">采购执行</text>

    <!-- 节点 3：库存（立方体） -->
    <rect x="163" y="23" width="42" height="42" rx="11" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.2" stroke-width="1.2" />
    <path d="M184 33 l9 5 v10 l-9 5 -9 -5 v-10 Z" stroke="#fff" stroke-opacity="0.9" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M175 38 l9 5 9 -5 M184 43 v10" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5" stroke-linejoin="round" />
    <circle cx="203" cy="25" r="7" fill="var(--color-primary)" />
    <text x="203" y="28" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">3</text>
    <text x="184" y="90" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity="0.6">库存管理</text>

    <!-- 节点 4：发放完成（对勾） -->
    <rect x="237" y="23" width="42" height="42" rx="11" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.2" stroke-width="1.2" />
    <circle cx="258" cy="44" r="10" stroke="#fff" stroke-opacity="0.9" stroke-width="1.5" />
    <path d="M252.5 44 l4 4 7 -7.5" stroke="#fff" stroke-opacity="0.9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="277" cy="25" r="7" fill="var(--color-primary)" />
    <text x="277" y="28" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">4</text>
    <text x="258" y="90" text-anchor="middle" font-size="9.5" fill="#fff" fill-opacity="0.6">领用发放</text>
  </svg>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { EChartsOption } from 'echarts';
import StatCard from '@/components/ui/StatCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import EChart from '@/components/charts/EChart.vue';
import PatternGrid from '@/components/illustrations/PatternGrid.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import { useChartTheme } from '@/components/charts/chartTheme';
import { reportsApi, inventoryApi, itemsApi, type DashboardData } from '@/api';
import { apiError } from '@/api/client';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, formatCurrencyCompact } from '@/utils/format';
import { formatDateTime } from '@/utils/datetime';
import { ITEM_STATUS_LABELS, type ItemStatus } from '@procure-lite/shared';

const toast = useToastStore();
const chartTheme = useChartTheme();

const data = ref<DashboardData | null>(null);
const lowStock = ref<{ id: number; name: string; stockQty: number; lowStockThreshold: number | null }[]>([]);
const recent = ref<{ id: number; itemName: string; department: string; status: string; createdAt: string }[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const loadError = ref('');
const lastUpdated = ref('');

async function load(silent = false): Promise<void> {
  if (silent) refreshing.value = true;
  else loading.value = data.value === null;
  try {
    const [dashboard, low, items] = await Promise.all([
      reportsApi.dashboard(),
      inventoryApi.products({ low: '1' }),
      itemsApi.list({ page: 1, pageSize: 6 }),
    ]);
    data.value = dashboard;
    lowStock.value = low;
    recent.value = items.items;
    loadError.value = '';
    lastUpdated.value = formatDateTime(new Date());
  } catch (e) {
    loadError.value = apiError(e);
    // 首次加载失败时页面上有 ErrorState，不必再弹 toast
    if (silent) toast.error(loadError.value);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

onMounted(() => load());

const donutOption = computed<EChartsOption>(() => {
  const ct = chartTheme.value;
  const slices =
    data.value?.statusSlices.filter((s) => s.count > 0).map((s) => ({
      name: ITEM_STATUS_LABELS[s.status as ItemStatus] ?? s.status,
      value: s.count,
    })) ?? [];
  return {
    color: ct.colors,
    tooltip: { ...ct.tooltip, trigger: 'item', formatter: '{b}：{c} 条（{d}%）' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: ct.muted, fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: ct.surface, borderWidth: 2 },
        label: { show: false },
        data: slices,
      },
    ],
  };
});

const trendOption = computed<EChartsOption>(() => {
  const ct = chartTheme.value;
  const trend = data.value?.trend ?? [];
  return {
    color: ct.colors,
    tooltip: { ...ct.tooltip, trigger: 'axis' },
    legend: { bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 4, textStyle: { color: ct.muted, fontSize: 11 } },
    grid: { left: 8, right: 8, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: trend.map((t) => t.date.slice(5)), ...ct.axis },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: ct.splitLine } }, ...ct.axis },
    series: [
      { name: '新增申领', type: 'bar', barMaxWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] }, data: trend.map((t) => t.created) },
      { name: '发放完成', type: 'line', smooth: true, symbolSize: 5, data: trend.map((t) => t.distributed) },
    ],
  };
});

const hasChartData = computed(() => (data.value?.statusSlices ?? []).some((s) => s.count > 0));
</script>

<template>
  <div v-if="loading" class="space-y-5">
    <Skeleton class="h-20 w-full" />
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Skeleton v-for="i in 4" :key="i" class="h-[76px]" />
    </div>
    <div class="grid lg:grid-cols-5 gap-5">
      <Skeleton class="h-72 lg:col-span-2" />
      <Skeleton class="h-72 lg:col-span-3" />
    </div>
  </div>

  <!-- 之前这里只有 v-if/v-else-if，接口一挂就是整页空白 -->
  <ErrorState
    v-else-if="!data"
    title="概览加载失败"
    :message="loadError || '没有拿到数据'"
    :retrying="refreshing"
    @retry="load()"
  />

  <div v-else class="space-y-5">
    <!-- 今日概览 -->
    <div class="card relative overflow-hidden px-6 py-5 bg-gradient-to-br from-panel via-panel to-panel-soft text-white border-panel">
      <PatternGrid class="text-white/[0.06]" />
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs text-white/55">今日工作概览 · {{ data.today.date }}</p>
        <button
          class="flex items-center gap-1 text-meta text-white/55 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          :disabled="refreshing"
          @click="load(true)"
        >
          <Icon name="refresh" :size="11" :class="refreshing ? 'animate-spin' : ''" />
          {{ refreshing ? '刷新中' : '刷新' }}
        </button>
      </div>
      <div class="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <p class="text-sm text-white/80">到货 <b class="text-xl font-semibold num text-white">{{ data.today.arrivals }}</b> 批</p>
        <p class="text-sm text-white/80">发放 <b class="text-xl font-semibold num text-white">{{ data.today.distributedQty }}</b> 件 / {{ data.today.distributionLines }} 笔</p>
        <p class="text-sm text-white/80">未付 <b class="text-xl font-semibold num text-white">{{ formatCurrencyCompact(data.payment.unpaidAmount) }}</b>（{{ data.payment.unpaidCount }} 笔）</p>
        <p v-if="data.payment.noInvoiceCount > 0" class="text-sm text-white/60">未开票 {{ data.payment.noInvoiceCount }} 笔</p>
      </div>
      <p v-if="lastUpdated" class="mt-3 text-meta text-white/40 num">更新于 {{ lastUpdated }}</p>
    </div>

    <!-- 流程指标 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="待采购" :value="data.kanbanCounts.PENDING_PURCHASE ?? 0" unit="条" icon="kanban" tone="blue" to="/kanban" hint="点击去下单" />
      <StatCard label="待到货" :value="data.kanbanCounts.PENDING_ARRIVAL ?? 0" unit="条" icon="box" tone="amber" to="/kanban" hint="确认收货" />
      <StatCard label="待分发" :value="data.kanbanCounts.PENDING_DISTRIBUTION ?? 0" unit="条" icon="distribution" tone="teal" to="/distributions" hint="发放登记" />
      <StatCard label="库存预警" :value="data.inventory.lowStockCount" unit="项" icon="alert" :tone="data.inventory.lowStockCount > 0 ? 'red' : 'gray'" to="/inventory" :hint="`共 ${data.inventory.productCount} 种物品`" />
    </div>

    <div class="grid lg:grid-cols-5 gap-5">
      <!-- 状态分布 -->
      <div class="card p-4 lg:col-span-2">
        <h2 class="text-sm font-semibold text-ink mb-1">台账状态分布</h2>
        <EChart v-if="hasChartData" :option="donutOption" height="260px" />
        <EmptyState v-else illustration="chart" title="还没有台账数据" description="导入 OA 单据后这里会有分布图" />
      </div>
      <!-- 近 7 天趋势 -->
      <div class="card p-4 lg:col-span-3">
        <h2 class="text-sm font-semibold text-ink mb-1">近 7 天动态</h2>
        <EChart :option="trendOption" height="260px" />
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-5">
      <!-- 库存预警 -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-ink">库存预警</h2>
          <router-link to="/inventory" class="text-xs text-primary hover:underline">管理库存</router-link>
        </div>
        <EmptyState v-if="lowStock.length === 0" illustration="box" tone="teal" title="库存充足" description="没有低于阈值的物品" />
        <template v-else>
          <ul class="divide-y divide-line">
            <li v-for="p in lowStock.slice(0, 6)" :key="p.id" class="flex items-center justify-between py-2.5">
              <span class="text-sm truncate">{{ p.name }}</span>
              <span class="text-xs text-red num shrink-0 ml-3">剩 {{ p.stockQty }}（阈值 {{ p.lowStockThreshold ?? 0 }}）</span>
            </li>
          </ul>
          <router-link
            v-if="lowStock.length > 6"
            :to="{ path: '/inventory', query: { low: '1' } }"
            class="mt-2 inline-block text-xs text-primary hover:underline"
          >
            还有 {{ lowStock.length - 6 }} 项 · 查看全部
          </router-link>
        </template>
      </div>

      <!-- 最近台账 -->
      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-ink">最近台账</h2>
          <router-link to="/ledger" class="text-xs text-primary hover:underline">查看全部</router-link>
        </div>
        <EmptyState v-if="recent.length === 0" illustration="ledger" title="还没有记录" description="从导入 OA 单据开始">
          <router-link to="/import" class="text-xs text-primary hover:underline">去导入</router-link>
        </EmptyState>
        <ul v-else class="divide-y divide-line">
          <li v-for="it in recent" :key="it.id" class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0">
              <p class="text-sm truncate">{{ it.itemName }}</p>
              <p class="text-meta text-faint">{{ it.department }}</p>
            </div>
            <StatusBadge :status="it.status" />
          </li>
        </ul>
      </div>
    </div>

    <!-- 未付金额明细入口 -->
    <div v-if="data.payment.unpaidCount > 0" class="card p-4 flex flex-wrap items-center gap-3">
      <Icon name="alert" :size="16" class="text-amber shrink-0" />
      <p class="text-sm text-muted">
        有 <b class="num text-ink">{{ data.payment.unpaidCount }}</b> 笔未付款，合计
        <b class="num text-ink">{{ formatCurrency(data.payment.unpaidAmount) }}</b>
      </p>
      <Button
        variant="secondary"
        size="sm"
        class="ml-auto"
        @click="$router.push({ path: '/ledger', query: { paymentStatus: 'UNPAID' } })"
      >
        去处理
      </Button>
    </div>
  </div>
</template>

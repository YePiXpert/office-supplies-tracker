<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';

const toast = useToastStore();
import type { EChartsOption } from 'echarts';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import StatCard from '@/components/ui/StatCard.vue';
import EChart from '@/components/charts/EChart.vue';
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from '@/components/charts/chartTheme';
import { reportsApi, distributionsApi } from '@/api';
import { ITEM_STATUS_LABELS, type ItemStatus } from '@procure-lite/shared';

const range = reactive({ dateFrom: '', dateTo: '' });
const groupBy = ref<'month' | 'department' | 'supplier'>('month');
const loading = ref(true);

const funnel = ref({ total: 0, pendingPurchase: 0, arrived: 0, closed: 0 });
const points = ref<{ label: string; amount: number; count: number }[]>([]);
const recipients = ref<{ recipient: string; department: string; quantity: number; times: number }[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const params = { ...clean() };
    const [ops, amount, recips] = await Promise.all([
      reportsApi.operations(params),
      reportsApi.amount({ ...params, groupBy: groupBy.value }),
      distributionsApi.recipients(params),
    ]);
    funnel.value = ops as typeof funnel.value;
    points.value = amount;
    recipients.value = recips;
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}

function clean(): { dateFrom?: string; dateTo?: string } {
  const out: { dateFrom?: string; dateTo?: string } = {};
  if (range.dateFrom) out.dateFrom = range.dateFrom;
  if (range.dateTo) out.dateTo = range.dateTo;
  return out;
}

onMounted(load);

const barOption = computed<EChartsOption>(() => ({
  color: CHART_COLORS,
  tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
  grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
  xAxis: {
    type: 'category',
    data: points.value.map((p) => p.label),
    ...AXIS_STYLE,
    axisLabel: { ...AXIS_STYLE.axisLabel, interval: 0, rotate: points.value.length > 8 ? 30 : 0 },
  },
  yAxis: [
    { type: 'value', name: '金额', splitLine: { lineStyle: { color: '#EEF1F6' } }, ...AXIS_STYLE },
    { type: 'value', name: '笔数', minInterval: 1, splitLine: { show: false }, ...AXIS_STYLE },
  ],
  series: [
    {
      name: '采购金额',
      type: 'bar',
      barMaxWidth: 26,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: points.value.map((p) => p.amount),
    },
    {
      name: '笔数',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      symbolSize: 5,
      data: points.value.map((p) => p.count),
    },
  ],
}));

const groupOptions = [
  { label: '按月份', value: 'month' },
  { label: '按部门', value: 'department' },
  { label: '按供应商', value: 'supplier' },
];
</script>

<template>
  <div class="space-y-5">
    <!-- 筛选 -->
    <div class="card p-3.5 flex flex-wrap items-end gap-3">
      <Input v-model="range.dateFrom" type="date" label="申请日期从" class="w-40" @change="load" />
      <Input v-model="range.dateTo" type="date" label="至" class="w-40" @change="load" />
      <Select v-model="groupBy" label="统计维度" :options="groupOptions" class="w-36" @update:model-value="load" />
      <Button variant="ghost" size="sm" class="mb-0.5" @click="range.dateFrom = ''; range.dateTo = ''; load()">
        <Icon name="refresh" :size="13" /> 重置
      </Button>
    </div>

    <!-- 执行漏斗 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="范围申领总量" :value="funnel.total" unit="条" icon="ledger" tone="gray" />
      <StatCard label="待采购" :value="funnel.pendingPurchase" unit="条" icon="kanban" tone="blue" />
      <StatCard label="已到货" :value="funnel.arrived" unit="条" icon="box" tone="amber" />
      <StatCard label="已发放 / 已入库" :value="funnel.closed" unit="条" icon="check" tone="teal" />
    </div>

    <!-- 金额统计 -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-bold text-ink">采购金额统计</h2>
        <p class="text-xs text-faint">未填单价的记录只计笔数不计金额</p>
      </div>
      <div v-if="loading" class="py-14 text-center text-sm text-faint">加载中…</div>
      <EChart v-else :option="barOption" height="300px" />
    </div>

    <!-- 领用排行 -->
    <div class="card p-4">
      <h2 class="text-sm font-bold text-ink mb-2">领用排行（按人）</h2>
      <p v-if="recipients.length === 0" class="py-8 text-center text-xs text-faint">所选范围内暂无领用记录</p>
      <div v-else class="overflow-x-auto">
        <table class="table-base min-w-[520px]">
          <thead>
            <tr><th>领用人</th><th>部门</th><th class="text-right">领用次数</th><th class="text-right">累计数量</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in recipients.slice(0, 20)" :key="`${r.recipient}|${r.department}`">
              <td class="font-medium">{{ r.recipient }}</td>
              <td class="text-xs text-muted">{{ r.department || '—' }}</td>
              <td class="text-right num">{{ r.times }}</td>
              <td class="text-right num font-semibold">{{ r.quantity }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="recipients.length > 20" class="px-4 pt-2 pb-3 text-[11px] text-faint">
          仅显示前 20 名，共 {{ recipients.length }} 人
        </p>
      </div>
    </div>
  </div>
</template>

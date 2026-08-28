<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { EChartsOption } from 'echarts';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import StatCard from '@/components/ui/StatCard.vue';
import EChart from '@/components/charts/EChart.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from '@/components/charts/chartTheme';
import { reportsApi, distributionsApi } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import { useUrlState } from '@/composables/useUrlState';
import { createRequestGuard } from '@/utils/request';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';
import { todayString } from '@/utils/datetime';

const toast = useToastStore();
const guard = createRequestGuard();

const DEFAULTS = { dateFrom: '', dateTo: '', groupBy: 'month' as string };
const range = reactive({ ...DEFAULTS });
useUrlState(range, DEFAULTS);

const loading = ref(true);
const loadError = ref('');
const loaded = ref(false);

const funnel = ref({ total: 0, pendingPurchase: 0, arrived: 0, closed: 0 });
const points = ref<{ label: string; amount: number; count: number }[]>([]);
const recipients = ref<{ recipient: string; department: string; quantity: number; times: number }[]>([]);

function clean(): { dateFrom?: string; dateTo?: string } {
  const out: { dateFrom?: string; dateTo?: string } = {};
  if (range.dateFrom) out.dateFrom = range.dateFrom;
  if (range.dateTo) out.dateTo = range.dateTo;
  return out;
}

async function load(): Promise<void> {
  const isCurrent = guard.begin();
  loading.value = true;
  try {
    const params = { ...clean() };
    const [ops, amount, recips] = await Promise.all([
      reportsApi.operations(params),
      reportsApi.amount({ ...params, groupBy: range.groupBy as 'month' | 'department' | 'supplier' }),
      distributionsApi.recipients(params),
    ]);
    if (!isCurrent()) return;
    funnel.value = ops as typeof funnel.value;
    points.value = amount;
    recipients.value = recips;
    loadError.value = '';
    loaded.value = true;
  } catch (e) {
    if (!isCurrent()) return;
    loadError.value = apiError(e);
  } finally {
    if (isCurrent()) loading.value = false;
  }
}

onMounted(load);

/** 常用区间的快捷入口：手点两个日期框太慢 */
function setQuickRange(kind: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all'): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (kind === 'all') {
    range.dateFrom = '';
    range.dateTo = '';
  } else if (kind === 'thisMonth') {
    range.dateFrom = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    range.dateTo = todayString();
  } else if (kind === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    range.dateFrom = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`;
    range.dateTo = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
  } else {
    range.dateFrom = `${now.getFullYear()}-01-01`;
    range.dateTo = todayString();
  }
  void load();
}

const totalAmount = computed(() => points.value.reduce((sum, p) => sum + p.amount, 0));
const totalCount = computed(() => points.value.reduce((sum, p) => sum + p.count, 0));

const barOption = computed<EChartsOption>(() => ({
  color: CHART_COLORS,
  tooltip: {
    ...TOOLTIP_STYLE,
    trigger: 'axis',
    // 金额轴带上货币符号与千分位，光看裸数字很难读
    formatter: (params: unknown) => {
      const rows = params as { axisValue: string; seriesName: string; value: number }[];
      const lines = rows.map((r) =>
        r.seriesName === '采购金额'
          ? `${r.seriesName}：${formatCurrency(r.value)}`
          : `${r.seriesName}：${r.value} 笔`,
      );
      return [rows[0]?.axisValue, ...lines].join('<br/>');
    },
  },
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
const groupLabel = computed(() => groupOptions.find((o) => o.value === range.groupBy)?.label ?? '');

function exportAmount(): void {
  downloadCsv(
    `采购金额统计-${groupLabel.value}-${Date.now()}.csv`,
    [groupLabel.value.replace('按', ''), '采购金额', '笔数'],
    points.value.map((p) => [p.label, p.amount, p.count]),
  );
  toast.success('金额统计已导出');
}

function exportRecipients(): void {
  downloadCsv(
    `领用排行-${Date.now()}.csv`,
    ['领用人', '部门', '领用次数', '累计数量'],
    recipients.value.map((r) => [r.recipient, r.department || '', r.times, r.quantity]),
  );
  toast.success('领用排行已导出');
}

const hasRange = computed(() => !!(range.dateFrom || range.dateTo));
</script>

<template>
  <div class="space-y-5">
    <!-- 筛选 -->
    <div class="card p-3.5 space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <Input v-model="range.dateFrom" type="date" label="申请日期从" class="w-40" @change="load" />
        <Input v-model="range.dateTo" type="date" label="至" class="w-40" @change="load" />
        <Select v-model="range.groupBy" label="统计维度" :options="groupOptions" class="w-36" @update:model-value="load" />
        <Button v-if="hasRange" variant="ghost" size="sm" class="mb-0.5" @click="setQuickRange('all')">
          <Icon name="close" :size="12" /> 全部时间
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="text-faint">快捷区间</span>
        <button
          v-for="q in [{ key: 'thisMonth', label: '本月' }, { key: 'lastMonth', label: '上月' }, { key: 'thisYear', label: '本年' }, { key: 'all', label: '全部' }]"
          :key="q.key"
          class="h-7 px-2.5 rounded-full border border-line-strong bg-surface text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors"
          @click="setQuickRange(q.key as 'thisMonth' | 'lastMonth' | 'thisYear' | 'all')"
        >
          {{ q.label }}
        </button>
      </div>
    </div>

    <ErrorState v-if="loadError && !loaded" :message="loadError" @retry="load" />

    <template v-else>
      <!-- 执行漏斗 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3" :class="loading ? 'opacity-50' : ''">
        <StatCard label="范围申领总量" :value="funnel.total" unit="条" icon="ledger" tone="gray" />
        <StatCard label="待采购" :value="funnel.pendingPurchase" unit="条" icon="kanban" tone="blue" />
        <StatCard label="已到货" :value="funnel.arrived" unit="条" icon="box" tone="amber" />
        <StatCard label="已发放 / 已入库" :value="funnel.closed" unit="条" icon="check" tone="teal" />
      </div>

      <!-- 金额统计 -->
      <div class="card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h2 class="text-sm font-bold text-ink">采购金额统计（{{ groupLabel }}）</h2>
            <p class="text-xs text-faint">未填单价的记录只计笔数不计金额</p>
          </div>
          <div class="flex items-center gap-3">
            <p v-if="points.length > 0" class="text-xs text-muted">
              合计 <b class="num text-ink">{{ formatCurrency(totalAmount) }}</b> · {{ totalCount }} 笔
            </p>
            <Button v-if="points.length > 0" variant="secondary" size="sm" @click="exportAmount">
              <Icon name="download" :size="13" /> 导出
            </Button>
          </div>
        </div>
        <div v-if="loading" class="py-14 text-center text-sm text-faint">加载中…</div>
        <EmptyState v-else-if="points.length === 0" icon="report" title="所选范围内没有数据" description="换个时间区间或统计维度试试" />
        <EChart v-else :option="barOption" height="300px" />
      </div>

      <!-- 领用排行 -->
      <div class="card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 class="text-sm font-bold text-ink">领用排行（按人）</h2>
          <Button v-if="recipients.length > 0" variant="secondary" size="sm" @click="exportRecipients">
            <Icon name="download" :size="13" /> 导出全部 {{ recipients.length }} 人
          </Button>
        </div>
        <div v-if="loading" class="py-8 text-center text-xs text-faint">加载中…</div>
        <p v-else-if="recipients.length === 0" class="py-8 text-center text-xs text-faint">所选范围内暂无领用记录</p>
        <div v-else class="overflow-x-auto">
          <table class="table-base min-w-[520px]">
            <thead>
              <tr><th class="w-12 text-right">#</th><th>领用人</th><th>部门</th><th class="text-right">领用次数</th><th class="text-right">累计数量</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in recipients.slice(0, 20)" :key="`${r.recipient}|${r.department}`">
                <td class="text-right num text-xs text-faint">{{ i + 1 }}</td>
                <td class="font-medium">{{ r.recipient }}</td>
                <td class="text-xs text-muted">{{ r.department || '—' }}</td>
                <td class="text-right num">{{ r.times }}</td>
                <td class="text-right num font-semibold">{{ r.quantity }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="recipients.length > 20" class="px-4 pt-2 pb-1 text-meta text-faint">
            页面只列前 20 名，共 {{ recipients.length }} 人；完整名单请用上方导出。
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

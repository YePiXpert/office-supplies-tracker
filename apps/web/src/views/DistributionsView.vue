<script setup lang="ts">
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Badge from '@/components/ui/Badge.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import DistributionCreateDialog from '@/components/distribution/DistributionCreateDialog.vue';
import { distributionsApi, type DistributionRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import { DISTRIBUTION_SOURCE_LABELS, type DistributionSource } from '@procure-lite/shared';

const toast = useToastStore();
const tab = ref<'records' | 'recipients'>('records');

/* 发放单列表 */
const rows = ref<DistributionRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 15;
const loading = ref(true);
const filters = reactive({ recipient: '', department: '', dateFrom: '', dateTo: '' });
const expanded = ref<Set<number>>(new Set());

/* 领用统计 */
const recipientStats = ref<{ recipient: string; department: string; quantity: number; times: number }[]>([]);
const statRange = reactive({ dateFrom: '', dateTo: '' });

const createOpen = ref(false);
const revokeTarget = ref<DistributionRow | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
    const res = await distributionsApi.list({ ...params, page: page.value, pageSize });
    rows.value = res.distributions;
    total.value = res.total;
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}

async function loadStats(): Promise<void> {
  const params: Record<string, string> = {};
  if (statRange.dateFrom) params.dateFrom = statRange.dateFrom;
  if (statRange.dateTo) params.dateTo = statRange.dateTo;
  recipientStats.value = await distributionsApi.recipients(params).catch(() => []);
}

onMounted(() => {
  void load();
  void loadStats();
});

function applyFilters(): void {
  page.value = 1;
  void load();
  void loadStats();
}

function toggleExpand(id: number): void {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

async function revoke(): Promise<void> {
  if (!revokeTarget.value) return;
  try {
    await distributionsApi.remove(revokeTarget.value.id);
    toast.success('发放单已作废，台账与库存已回滚');
    revokeTarget.value = null;
    await load();
    await loadStats();
  } catch (e) {
    toast.error(apiError(e));
  }
}

const maxQty = computed(() => Math.max(1, ...recipientStats.value.map((s) => s.quantity)));

function fmtTime(dt: string): string {
  return formatDateTime(dt);
}
</script>

<template>
  <div class="space-y-4">
    <div class="card overflow-hidden">
      <div class="flex border-b border-line px-3 pt-2 gap-1">
        <button
          v-for="t in [{ key: 'records', label: '发放单' }, { key: 'recipients', label: '领用统计' }]"
          :key="t.key"
          class="px-3 h-9 text-sm font-medium rounded-t-lg cursor-pointer transition-colors"
          :class="tab === t.key ? 'text-primary border-b-2 border-primary bg-primary-soft/40' : 'text-muted hover:text-text'"
          @click="tab = t.key as 'records' | 'recipients'"
        >
          {{ t.label }}
        </button>
        <div class="ml-auto flex items-center gap-2 pb-1.5">
          <Button variant="primary" size="sm" @click="createOpen = true">
            <Icon name="plus" :size="13" /> 发放登记
          </Button>
        </div>
      </div>

      <!-- 发放单列表 -->
      <template v-if="tab === 'records'">
        <div class="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-line">
          <div class="relative flex-1 min-w-44">
            <Icon name="users" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              v-model="filters.recipient"
              class="w-full h-9 pl-9 pr-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none"
              placeholder="按领用人搜索"
              @keyup.enter="applyFilters"
            />
          </div>
          <Input v-model="filters.dateFrom" type="date" class="w-36" @change="applyFilters" />
          <span class="text-faint text-xs">至</span>
          <Input v-model="filters.dateTo" type="date" class="w-36" @change="applyFilters" />
        </div>

        <div v-if="loading" class="py-14 text-center text-sm text-faint">加载中…</div>
        <EmptyState v-else-if="rows.length === 0" icon="distribution" title="还没有发放记录" description="在看板或本页发起发放登记" />

        <ul v-else class="divide-y divide-line">
          <li v-for="d in rows" :key="d.id" class="px-4">
            <div class="flex items-center gap-3 py-3 cursor-pointer select-none" @click="toggleExpand(d.id)">
              <Icon name="chevron-right" :size="14" class="text-faint transition-transform" :class="expanded.has(d.id) ? 'rotate-90' : ''" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold num">{{ d.date }}</span>
                  <Badge :tone="d.source === 'DIRECT' ? 'blue' : 'teal'">{{ DISTRIBUTION_SOURCE_LABELS[d.source as DistributionSource] }}</Badge>
                  <span v-if="d.department" class="text-xs text-muted">{{ d.department }}</span>
                </div>
                <p class="mt-0.5 text-xs text-faint truncate">
                  {{ d.lines.map((l) => `${l.recipient}·${l.itemName}×${l.quantity}`).join('，') }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-bold num text-ink">{{ d.lines.length }} 笔</p>
                <p class="text-[11px] text-faint">{{ fmtTime(d.createdAt) }}</p>
              </div>
              <button
                class="p-1.5 text-faint hover:text-red cursor-pointer shrink-0"
                title="作废此发放单"
                @click.stop="revokeTarget = d"
              >
                <Icon name="trash" :size="14" />
              </button>
            </div>

            <!-- 展开明细 -->
            <div v-if="expanded.has(d.id)" class="pb-3 -mt-1">
              <table class="table-base">
                <thead>
                  <tr><th>领用人</th><th>物品</th><th class="text-right">数量</th><th>签收备注</th></tr>
                </thead>
                <tbody>
                  <tr v-for="l in d.lines" :key="l.id">
                    <td class="font-medium">{{ l.recipient }}</td>
                    <td>{{ l.itemName }}<span v-if="l.itemId" class="ml-1.5 text-[11px] text-faint num">#{{ l.itemId }}</span></td>
                    <td class="text-right num">{{ l.quantity }}</td>
                    <td class="text-xs text-muted">{{ l.signoffNote ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="d.note" class="mt-2 text-xs text-faint">备注：{{ d.note }}</p>
            </div>
          </li>
        </ul>

        <div class="px-4 py-3 border-t border-line">
          <Pagination :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
        </div>
      </template>

      <!-- 领用统计 -->
      <template v-else>
        <div class="flex flex-wrap items-end gap-2.5 px-4 py-3 border-b border-line">
          <Input v-model="statRange.dateFrom" type="date" label="起" class="w-36" @change="loadStats" />
          <Input v-model="statRange.dateTo" type="date" label="止" class="w-36" @change="loadStats" />
          <p class="text-xs text-faint">按领用人汇总发放数量</p>
        </div>
        <EmptyState v-if="recipientStats.length === 0" icon="users" title="暂无领用数据" />
        <ul v-else class="divide-y divide-line">
          <li v-for="s in recipientStats" :key="`${s.recipient}|${s.department}`" class="flex items-center gap-3 px-4 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ s.recipient }} <span v-if="s.department" class="text-xs text-faint">· {{ s.department }}</span></p>
              <div class="mt-1 h-1.5 bg-canvas rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full" :style="{ width: `${(s.quantity / maxQty) * 100}%` }" />
              </div>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-bold num">{{ s.quantity }}</p>
              <p class="text-[11px] text-faint">{{ s.times }} 次</p>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <DistributionCreateDialog :open="createOpen" @update:open="createOpen = $event" @created="() => { load(); loadStats(); }" />
    <ConfirmDialog
      :open="!!revokeTarget"
      title="作废发放单"
      :message="`将删除该发放单并回滚相关台账状态与库存（${revokeTarget?.date} · ${revokeTarget?.lines.length} 笔）。若相关库存已被消耗则无法作废。`"
      confirm-text="作废并回滚"
      danger
      @update:open="revokeTarget = null"
      @confirm="revoke"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import DistributionCreateDialog from '@/components/distribution/DistributionCreateDialog.vue';
import PurchaseDialog from '@/components/kanban/PurchaseDialog.vue';
import { itemsApi, inventoryApi, type ItemRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import { createRequestGuard } from '@/utils/request';
import { formatAmount } from '@/utils/format';
import { KANBAN_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from '@procure-lite/shared';
import { todayString } from '@/utils/datetime';

const COLUMN_LIMIT = 100;

const toast = useToastStore();
const guard = createRequestGuard();

const columns = ref<Record<string, ItemRow[]>>({});
/** 每列真实总数（>100 时列表被截断，需要向用户明示） */
const totals = ref<Record<string, number>>({});
const loading = ref(true);
const refreshing = ref(false);
const loadError = ref('');
/** 正在提交的卡片，避免连点重复发请求 */
const busy = ref<Set<number>>(new Set());

const distributeOpen = ref(false);
const distributeTarget = ref<ItemRow[]>([]);
const stockInTarget = ref<ItemRow | null>(null);
const purchaseTarget = ref<ItemRow | null>(null);
const purchaseOpen = ref(false);

async function load(silent = false): Promise<void> {
  const isCurrent = guard.begin();
  if (silent) refreshing.value = true;
  else if (Object.keys(columns.value).length === 0) loading.value = true;
  try {
    const results = await Promise.all(
      KANBAN_STATUSES.map((s) => itemsApi.list({ status: s, pageSize: COLUMN_LIMIT })),
    );
    if (!isCurrent()) return;
    columns.value = Object.fromEntries(KANBAN_STATUSES.map((s, i) => [s, results[i].items]));
    totals.value = Object.fromEntries(KANBAN_STATUSES.map((s, i) => [s, results[i].total]));
    loadError.value = '';
  } catch (e) {
    if (!isCurrent()) return;
    loadError.value = apiError(e);
  } finally {
    if (isCurrent()) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}
onMounted(() => load());

/** 后台对账：不改 loading，页面不会塌下去重建 */
function refresh(): void {
  void load(true);
}

/** 本地先把卡片挪走，请求失败再放回去——点一下按钮不该让整块看板闪一次 */
function moveLocally(item: ItemRow, from: ItemStatus, to: ItemStatus | null): void {
  const source = columns.value[from];
  if (source) {
    columns.value[from] = source.filter((i) => i.id !== item.id);
    totals.value[from] = Math.max(0, (totals.value[from] ?? 1) - 1);
  }
  if (to && columns.value[to]) {
    columns.value[to] = [{ ...item, status: to }, ...columns.value[to]];
    totals.value[to] = (totals.value[to] ?? 0) + 1;
  }
}

async function advance(item: ItemRow, next: ItemStatus, withArrival = false): Promise<void> {
  if (busy.value.has(item.id)) return;
  busy.value = new Set(busy.value).add(item.id);
  const from = item.status as ItemStatus;
  moveLocally(item, from, next);
  try {
    await itemsApi.update(item.id, {
      status: next,
      ...(withArrival ? { arrivalDate: todayString() } : {}),
    });
    toast.success(`「${item.itemName}」${ITEM_STATUS_LABELS[next]}`, {
      label: '撤销',
      run: async () => {
        try {
          await itemsApi.update(item.id, { status: from, ...(withArrival ? { arrivalDate: null } : {}) });
          refresh();
        } catch (e) {
          toast.error(apiError(e));
        }
      },
    });
    refresh();
  } catch (e) {
    toast.error(apiError(e));
    moveLocally({ ...item, status: next }, next, from); // 回滚本地移动
  } finally {
    const nextBusy = new Set(busy.value);
    nextBusy.delete(item.id);
    busy.value = nextBusy;
  }
}

async function stockIn(): Promise<void> {
  const item = stockInTarget.value;
  if (!item) return;
  try {
    await inventoryApi.stockIn(item.id);
    toast.success('已整单入库，可在库存中发放');
    stockInTarget.value = null;
    moveLocally(item, 'PENDING_DISTRIBUTION', null);
    refresh();
  } catch (e) {
    toast.error(apiError(e));
  }
}

function openPurchase(item: ItemRow): void {
  purchaseTarget.value = item;
  purchaseOpen.value = true;
}

const COLUMN_META: Record<string, { tone: string; hint: string }> = {
  PENDING_PURCHASE: { tone: 'text-primary bg-primary-soft border-primary/20', hint: '登记供应商与成交价，或直接标记已下单' },
  PENDING_ARRIVAL: { tone: 'text-amber bg-amber-soft border-amber/25', hint: '物流跟踪中，到货后确认' },
  PENDING_DISTRIBUTION: { tone: 'text-teal bg-teal-soft border-teal/25', hint: '发放给申领人，或整单入库' },
};

const truncated = computed(() =>
  Object.fromEntries(
    KANBAN_STATUSES.map((s) => [s, (totals.value[s] ?? 0) > (columns.value[s]?.length ?? 0)]),
  ),
);
</script>

<template>
  <div class="space-y-4 lg:h-full lg:flex lg:flex-col">
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="card flex flex-col space-y-2.5 p-3 min-h-80">
        <Skeleton class="h-9 w-24" />
        <Skeleton class="h-28" />
        <Skeleton class="h-28" />
      </div>
    </div>

    <ErrorState v-else-if="loadError && Object.keys(columns).length === 0" :message="loadError" @retry="load()" />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:flex-1 lg:min-h-0">
      <section v-for="status in KANBAN_STATUSES" :key="status" class="card flex flex-col min-h-80 lg:h-full lg:min-h-0" :aria-label="ITEM_STATUS_LABELS[status]">
        <header class="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-line">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center h-6 px-2 rounded-full border text-xs font-semibold" :class="COLUMN_META[status].tone">
              {{ ITEM_STATUS_LABELS[status] }}
            </span>
            <span class="text-xs text-faint num">{{ totals[status] ?? columns[status]?.length ?? 0 }}</span>
          </div>
          <span v-if="refreshing" class="inline-block size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </header>
        <p class="px-4 pt-2 text-meta text-faint">
          {{ COLUMN_META[status].hint }}
          <router-link
            v-if="truncated[status]"
            :to="{ path: '/ledger', query: { status } }"
            class="text-amber hover:underline"
          >
            共 {{ totals[status] }} 条 · 在台账中查看全部
          </router-link>
        </p>

        <div class="p-3 space-y-2.5 max-h-[60dvh] overflow-y-auto lg:flex-1 lg:min-h-0 lg:max-h-none lg:overflow-y-auto">
          <EmptyState
            v-if="!columns[status]?.length"
            :icon="status === 'PENDING_PURCHASE' ? 'kanban' : 'box'"
            title="暂无记录"
            :description="status === 'PENDING_PURCHASE' ? '导入 OA 单据后在这里下单' : ''"
          />
          <article
            v-for="item in columns[status]"
            :key="item.id"
            class="p-3 bg-surface border border-line rounded-(--radius-control) hover:border-line-strong transition-all"
            :class="busy.has(item.id) ? 'opacity-50 pointer-events-none' : ''"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-semibold text-ink leading-snug break-all">{{ item.itemName }}</p>
              <span class="text-xs num text-muted shrink-0">×{{ item.quantity }}</span>
            </div>
            <p class="mt-1 text-meta text-faint">
              {{ item.department }} · {{ item.handler }} · <span class="num">{{ item.requestDate }}</span>
            </p>
            <p class="mt-0.5 text-meta text-faint num">
              {{ item.serialNumber }}
              <template v-if="item.unitPrice != null"> · {{ formatAmount(item.unitPrice, item.quantity) }}</template>
            </p>
            <p v-if="item.supplierName" class="mt-0.5 text-meta text-muted truncate">
              <Icon name="supplier" :size="10" class="inline" /> {{ item.supplierName }}
            </p>

            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <a
                v-if="item.purchaseLink && status === 'PENDING_PURCHASE'"
                :href="item.purchaseLink"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 h-7 px-2.5 rounded-(--radius-control) border border-line-strong text-xs font-medium text-muted hover:border-primary hover:text-primary"
              >
                <Icon name="distribution" :size="12" /> 去下单
              </a>
              <template v-if="status === 'PENDING_PURCHASE'">
                <Button size="sm" variant="primary" @click="openPurchase(item)">
                  <Icon name="edit" :size="12" /> 下单登记
                </Button>
                <Button size="sm" @click="advance(item, 'PENDING_ARRIVAL')">仅标记已下单</Button>
              </template>
              <template v-else-if="status === 'PENDING_ARRIVAL'">
                <Button size="sm" variant="primary" @click="advance(item, 'PENDING_DISTRIBUTION', true)">
                  <Icon name="check" :size="12" /> 确认到货
                </Button>
                <Button size="sm" @click="advance(item, 'PENDING_PURCHASE')">
                  <Icon name="undo" :size="12" /> 退回待采购
                </Button>
              </template>
              <template v-else>
                <Button size="sm" variant="primary" @click="distributeTarget = [item]; distributeOpen = true">
                  <Icon name="distribution" :size="12" /> 发放
                </Button>
                <Button size="sm" @click="stockInTarget = item">
                  <Icon name="inventory" :size="12" /> 入库
                </Button>
              </template>
            </div>
          </article>
        </div>
      </section>
    </div>

    <PurchaseDialog
      :open="purchaseOpen"
      :item="purchaseTarget"
      @update:open="purchaseOpen = $event"
      @done="refresh"
    />
    <DistributionCreateDialog
      :open="distributeOpen"
      :preset-items="distributeTarget"
      @update:open="distributeOpen = $event"
      @created="refresh"
    />
    <ConfirmDialog
      :open="!!stockInTarget"
      title="整单入库"
      :message="`「${stockInTarget?.itemName}」（×${stockInTarget?.quantity}）将转入库存，之后可从库存按需发放。`"
      confirm-text="确认入库"
      @update:open="stockInTarget = null"
      @confirm="stockIn"
    />
  </div>
</template>

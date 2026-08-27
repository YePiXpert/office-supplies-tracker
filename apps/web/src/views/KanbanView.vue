<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import DistributionCreateDialog from '@/components/distribution/DistributionCreateDialog.vue';
import { itemsApi, inventoryApi, type ItemRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import { KANBAN_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from '@procure-lite/shared';

const toast = useToastStore();
const columns = ref<Record<string, ItemRow[]>>({});
const loading = ref(true);

const distributeOpen = ref(false);
const distributeTarget = ref<ItemRow[]>([]);
const stockInTarget = ref<ItemRow | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const results = await Promise.all(
      KANBAN_STATUSES.map((s) => itemsApi.list({ status: s, pageSize: 100 })),
    );
    columns.value = Object.fromEntries(KANBAN_STATUSES.map((s, i) => [s, results[i].items]));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function advance(item: ItemRow, next: ItemStatus, withArrival = false): Promise<void> {
  try {
    await itemsApi.update(item.id, {
      status: next,
      ...(withArrival ? { arrivalDate: new Date().toISOString().slice(0, 10) } : {}),
    });
    toast.success(`「${item.itemName}」${ITEM_STATUS_LABELS[next]}`);
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function stockIn(): Promise<void> {
  if (!stockInTarget.value) return;
  try {
    await inventoryApi.stockIn(stockInTarget.value.id);
    toast.success('已整单入库，可在库存中发放');
    stockInTarget.value = null;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

function fmtAmount(item: ItemRow): string | null {
  return item.unitPrice != null ? `¥${(item.unitPrice * item.quantity).toFixed(2)}` : null;
}

const COLUMN_META: Record<string, { tone: string; hint: string }> = {
  PENDING_PURCHASE: { tone: 'text-primary bg-primary-soft border-primary/20', hint: '去平台下单，或标记已下单' },
  PENDING_ARRIVAL: { tone: 'text-amber bg-amber-soft border-amber/25', hint: '物流跟踪中，到货后确认' },
  PENDING_DISTRIBUTION: { tone: 'text-teal bg-teal-soft border-teal/25', hint: '发放给申领人，或整单入库' },
};
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="py-16 text-center text-sm text-faint">加载中…</div>

    <div v-else class="grid lg:grid-cols-3 gap-4">
      <section v-for="status in KANBAN_STATUSES" :key="status" class="card flex flex-col min-h-80" :aria-label="ITEM_STATUS_LABELS[status]">
        <header class="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-line">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center h-6 px-2 rounded-full border text-xs font-semibold" :class="COLUMN_META[status].tone">
              {{ ITEM_STATUS_LABELS[status] }}
            </span>
            <span class="text-xs text-faint num">{{ columns[status]?.length ?? 0 }}</span>
          </div>
        </header>
        <p class="px-4 pt-2 text-[11px] text-faint">{{ COLUMN_META[status].hint }}</p>

        <div class="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[calc(100dvh-320px)]">
          <EmptyState
            v-if="!columns[status]?.length"
            :icon="status === 'PENDING_PURCHASE' ? 'kanban' : 'box'"
            title="暂无记录"
            :description="status === 'PENDING_PURCHASE' ? '导入 OA 单据后在这里下单' : ''"
          />
          <article
            v-for="item in columns[status]"
            :key="item.id"
            class="p-3 bg-surface border border-line rounded-(--radius-control) hover:border-line-strong transition-colors"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-semibold text-ink leading-snug break-all">{{ item.itemName }}</p>
              <span class="text-xs num text-muted shrink-0">×{{ item.quantity }}</span>
            </div>
            <p class="mt-1 text-[11px] text-faint">
              {{ item.department }} · {{ item.handler }} · <span class="num">{{ item.requestDate }}</span>
            </p>
            <p class="mt-0.5 text-[11px] text-faint num">
              {{ item.serialNumber }}<template v-if="fmtAmount(item)"> · {{ fmtAmount(item) }}</template>
            </p>

            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <a
                v-if="item.purchaseLink && status === 'PENDING_PURCHASE'"
                :href="item.purchaseLink"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 h-7 px-2.5 rounded-(--radius-control) bg-primary text-white text-xs font-medium hover:bg-primary-hover"
              >
                <Icon name="distribution" :size="12" /> 去下单
              </a>
              <template v-if="status === 'PENDING_PURCHASE'">
                <Button size="sm" @click="advance(item, 'PENDING_ARRIVAL')">已下单</Button>
              </template>
              <template v-else-if="status === 'PENDING_ARRIVAL'">
                <Button size="sm" @click="advance(item, 'PENDING_DISTRIBUTION', true)">
                  <Icon name="check" :size="12" /> 确认到货
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

    <DistributionCreateDialog
      :open="distributeOpen"
      :preset-items="distributeTarget"
      @update:open="distributeOpen = $event"
      @created="load"
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

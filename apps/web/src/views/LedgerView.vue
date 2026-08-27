<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Badge from '@/components/ui/Badge.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import ItemEditDialog from '@/components/ledger/ItemEditDialog.vue';
import ItemDetailDialog from '@/components/ledger/ItemDetailDialog.vue';
import { itemsApi, downloadFile, type ItemRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type ItemStatus,
  type PaymentStatus,
} from '@procure-lite/shared';

const toast = useToastStore();

/* 筛选状态 */
const filters = reactive({
  search: '',
  status: '',
  paymentStatus: '',
  department: '',
  handler: '',
  dateFrom: '',
  dateTo: '',
});
const page = ref(1);
const pageSize = 20;
const tab = ref<'active' | 'recycle'>('active');

/* 数据 */
const rows = ref<ItemRow[]>([]);
const total = ref(0);
const loading = ref(false);
const departments = ref<string[]>([]);
const handlers = ref<string[]>([]);

/* 选择与对话框 */
const selected = ref<Set<number>>(new Set());
const editOpen = ref(false);
const editTarget = ref<ItemRow | null>(null);
const detailOpen = ref(false);
const detailTarget = ref<ItemRow | null>(null);
const confirmDelete = ref(false);
const confirmPurge = ref<ItemRow | null>(null);

const statusOptions = ITEM_STATUSES.map((s) => ({ label: ITEM_STATUS_LABELS[s], value: s }));
const paymentOptions = PAYMENT_STATUSES.map((s) => ({ label: PAYMENT_STATUS_LABELS[s], value: s }));
const departmentOptions = computed(() => departments.value.map((d) => ({ label: d, value: d })));
const handlerOptions = computed(() => handlers.value.map((h) => ({ label: h, value: h })));

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await itemsApi.list({
      ...cleanFilters(),
      deleted: tab.value === 'recycle' ? 'only' : undefined,
      page: page.value,
      pageSize,
    });
    rows.value = res.items;
    total.value = res.total;
    selected.value.clear();
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}

function cleanFilters() {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) if (v) out[k] = v;
  return out;
}

onMounted(async () => {
  await load();
  const facets = await itemsApi.facets().catch(() => ({ departments: [], handlers: [] }));
  departments.value = facets.departments;
  handlers.value = facets.handlers;
});

function applyFilters(): void {
  page.value = 1;
  void load();
}

function switchTab(t: 'active' | 'recycle'): void {
  tab.value = t;
  page.value = 1;
  void load();
}

/* 内联快速修改 */
async function quickStatus(item: ItemRow, status: ItemStatus): Promise<void> {
  try {
    await itemsApi.update(item.id, { status });
    toast.success(`已标记为「${ITEM_STATUS_LABELS[status]}」`);
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function quickPayment(item: ItemRow, paymentStatus: PaymentStatus): Promise<void> {
  try {
    await itemsApi.update(item.id, { paymentStatus });
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

/* 批量操作 */
async function batch(patch: Record<string, unknown>): Promise<void> {
  if (selected.value.size === 0) return;
  try {
    const res = await itemsApi.batchUpdate({ ids: [...selected.value], patch });
    toast.success(`已更新 ${res.updated} 条记录`);
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function batchDelete(): Promise<void> {
  const ids = [...selected.value];
  try {
    for (const id of ids) await itemsApi.remove(id);
    toast.success(`已移入回收站 ${ids.length} 条`);
    confirmDelete.value = false;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function restore(item: ItemRow): Promise<void> {
  try {
    await itemsApi.restore(item.id);
    toast.success('已恢复');
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function purge(): Promise<void> {
  if (!confirmPurge.value) return;
  try {
    await itemsApi.purge(confirmPurge.value.id);
    toast.success('已彻底删除');
    confirmPurge.value = null;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

function toggleAll(): void {
  if (allChecked.value) selected.value.clear();
  else rows.value.forEach((r) => selected.value.add(r.id));
}
const allChecked = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.id)));

async function exportXlsx(): Promise<void> {
  try {
    const params = new URLSearchParams({ ...cleanFilters(), pageSize: '200' });
    await downloadFile(`/items/export?${params.toString()}`, `采购台账-${Date.now()}.xlsx`);
    toast.success('导出已开始下载');
  } catch (e) {
    toast.error(apiError(e));
  }
}

function amount(item: ItemRow): string {
  if (item.unitPrice == null) return '—';
  return `¥${(item.unitPrice * item.quantity).toFixed(2)}`;
}
</script>

<template>
  <div class="space-y-4">
    <!-- 工具栏 -->
    <div class="card p-3.5 space-y-3">
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="relative flex-1 min-w-52">
          <Icon name="search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            v-model="filters.search"
            class="w-full h-9.5 pl-9 pr-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="搜索流水号 / 品名 / 部门 / 经办人"
            @keyup.enter="applyFilters"
          />
        </div>
        <Select v-model="filters.status" :options="statusOptions" placeholder="全部状态" clearable class="w-32" @update:model-value="applyFilters" />
        <Select v-model="filters.paymentStatus" :options="paymentOptions" placeholder="付款状态" clearable class="w-32" @update:model-value="applyFilters" />
        <Select v-model="filters.department" :options="departmentOptions" placeholder="全部部门" clearable class="w-36" @update:model-value="applyFilters" />
        <Select v-model="filters.handler" :options="handlerOptions" placeholder="全部经办人" clearable class="w-32" @update:model-value="applyFilters" />
        <Button variant="ghost" size="sm" @click="Object.assign(filters, { search: '', status: '', paymentStatus: '', department: '', handler: '', dateFrom: '', dateTo: '' }); applyFilters()">
          重置
        </Button>
        <div class="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" @click="exportXlsx">
            <Icon name="download" :size="13" /> 导出
          </Button>
          <Button variant="primary" size="sm" @click="editTarget = null; editOpen = true">
            <Icon name="plus" :size="13" /> 新增
          </Button>
        </div>
      </div>

      <!-- 批量工具条 -->
      <div v-if="selected.size > 0 && tab === 'active'" class="flex flex-wrap items-center gap-2 px-3 py-2 bg-primary-soft border border-primary/20 rounded-(--radius-control) text-xs">
        <span class="font-semibold text-primary">已选 {{ selected.size }} 条</span>
        <span class="text-faint">|</span>
        <select
          class="h-7 px-2 bg-surface border border-line-strong rounded-md text-xs cursor-pointer"
          @change="e => { const v = (e.target as HTMLSelectElement).value; if (v) { batch({ status: v }); (e.target as HTMLSelectElement).value = ''; } }"
        >
          <option value="">批量改状态…</option>
          <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select
          class="h-7 px-2 bg-surface border border-line-strong rounded-md text-xs cursor-pointer"
          @change="e => { const v = (e.target as HTMLSelectElement).value; if (v) { batch({ paymentStatus: v }); (e.target as HTMLSelectElement).value = ''; } }"
        >
          <option value="">批量改付款…</option>
          <option v-for="o in paymentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button class="h-7 px-2.5 bg-surface border border-red/30 text-red rounded-md cursor-pointer hover:bg-red-soft" @click="confirmDelete = true">移入回收站</button>
      </div>
    </div>

    <!-- 台账 / 回收站 -->
    <div class="card overflow-hidden">
      <div class="flex border-b border-line px-3 pt-2 gap-1">
        <button
          v-for="t in [{ key: 'active', label: '台账' }, { key: 'recycle', label: '回收站' }]"
          :key="t.key"
          class="px-3 h-9 text-sm font-medium rounded-t-lg cursor-pointer transition-colors"
          :class="tab === t.key ? 'text-primary border-b-2 border-primary bg-primary-soft/40' : 'text-muted hover:text-text'"
          @click="switchTab(t.key as 'active' | 'recycle')"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="loading" class="py-16 text-center text-sm text-faint">加载中…</div>

      <EmptyState
        v-else-if="rows.length === 0"
        icon="ledger"
        :title="tab === 'recycle' ? '回收站是空的' : '没有台账记录'"
        description="从 OA 单据导入，或点击右上角手工新增"
      >
        <router-link v-if="tab === 'active'" to="/import" class="text-xs text-primary hover:underline">去导入 OA 单</router-link>
      </EmptyState>

      <!-- 表格 -->
      <div v-else class="overflow-x-auto">
        <table class="table-base min-w-[1080px]">
          <thead>
            <tr>
              <th v-if="tab === 'active'" class="w-10">
                <input type="checkbox" class="size-3.5 accent-[#2563EB]" :checked="allChecked" @change="toggleAll" aria-label="全选" />
              </th>
              <th>流水号</th>
              <th>品名</th>
              <th>部门 / 经办人</th>
              <th class="text-right">数量</th>
              <th class="text-right">金额</th>
              <th>供应商</th>
              <th>状态</th>
              <th>付款</th>
              <th class="w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td v-if="tab === 'active'">
                <input v-model="selected" :value="row.id" type="checkbox" class="size-3.5 accent-[#2563EB]" />
              </td>
              <td class="num text-xs text-muted">{{ row.serialNumber }}</td>
              <td>
                <button class="font-medium hover:text-primary cursor-pointer text-left" @click="detailTarget = row; detailOpen = true">
                  {{ row.itemName }}
                </button>
                <p class="text-[11px] text-faint num">{{ row.requestDate }}</p>
              </td>
              <td class="text-xs">
                <p>{{ row.department }}</p>
                <p class="text-faint">{{ row.handler }}</p>
              </td>
              <td class="text-right num">{{ row.quantity }}<span v-if="row.unit" class="text-[11px] text-faint">{{ row.unit }}</span></td>
              <td class="text-right num">
                {{ amount(row) }}
                <p v-if="row.unitPrice != null" class="text-[11px] text-faint">单价 {{ row.unitPrice }}</p>
              </td>
              <td class="text-xs">{{ row.supplierName ?? '—' }}</td>
              <td>
                <select
                  v-if="tab === 'active'"
                  :value="row.status"
                  class="h-7 px-1.5 text-xs bg-transparent border border-line-strong rounded-md cursor-pointer hover:border-primary"
                  :aria-label="`修改 ${row.itemName} 状态`"
                  @change="quickStatus(row, ($event.target as HTMLSelectElement).value as ItemStatus)"
                >
                  <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <StatusBadge v-else :status="row.status" />
              </td>
              <td>
                <select
                  v-if="tab === 'active'"
                  :value="row.paymentStatus"
                  class="h-7 px-1.5 text-xs bg-transparent border border-line-strong rounded-md cursor-pointer hover:border-primary"
                  :aria-label="`修改 ${row.itemName} 付款状态`"
                  @change="quickPayment(row, ($event.target as HTMLSelectElement).value as PaymentStatus)"
                >
                  <option v-for="o in paymentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <Badge v-else tone="gray">{{ PAYMENT_STATUS_LABELS[row.paymentStatus as PaymentStatus] }}</Badge>
              </td>
              <td>
                <div class="flex items-center gap-0.5">
                  <template v-if="tab === 'active'">
                    <button class="p-1.5 text-faint hover:text-primary cursor-pointer" title="详情" @click="detailTarget = row; detailOpen = true">
                      <Icon name="search" :size="14" />
                    </button>
                    <button class="p-1.5 text-faint hover:text-primary cursor-pointer" title="编辑" @click="editTarget = row; editOpen = true">
                      <Icon name="edit" :size="14" />
                    </button>
                    <button class="p-1.5 text-faint hover:text-red cursor-pointer" title="移入回收站" @click="selected = new Set([row.id]); confirmDelete = true">
                      <Icon name="trash" :size="14" />
                    </button>
                  </template>
                  <template v-else>
                    <button class="p-1.5 text-faint hover:text-primary cursor-pointer" title="恢复" @click="restore(row)">
                      <Icon name="restore" :size="14" />
                    </button>
                    <button class="p-1.5 text-faint hover:text-red cursor-pointer" title="彻底删除" @click="confirmPurge = row">
                      <Icon name="trash" :size="14" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-line">
        <Pagination :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
      </div>
    </div>

    <!-- 对话框 -->
    <ItemEditDialog :open="editOpen" :item="editTarget" @update:open="editOpen = $event" @saved="load" />
    <ItemDetailDialog :open="detailOpen" :item="detailTarget" @update:open="detailOpen = $event" @changed="load" />
    <ConfirmDialog
      :open="confirmDelete"
      title="移入回收站"
      :message="`选中的 ${selected.size} 条记录将移入回收站，可随时恢复。`"
      confirm-text="移入回收站"
      danger
      @update:open="confirmDelete = $event"
      @confirm="batchDelete"
    />
    <ConfirmDialog
      :open="!!confirmPurge"
      title="彻底删除"
      :message="`「${confirmPurge?.itemName}」将被永久删除（含修改历史），不可恢复。`"
      confirm-text="彻底删除"
      danger
      @update:open="confirmPurge = null"
      @confirm="purge"
    />
  </div>
</template>

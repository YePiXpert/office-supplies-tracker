<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Badge from '@/components/ui/Badge.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Dialog from '@/components/ui/Dialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { inventoryApi, type MovementRow, type ProductRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import { MOVEMENT_TYPE_LABELS, type MovementType } from '@procure-lite/shared';

const toast = useToastStore();
const tab = ref<'products' | 'movements'>('products');

/* 物品 */
const products = ref<ProductRow[]>([]);
const productSearch = ref('');
const lowOnly = ref(false);
const loadingProducts = ref(true);

/* 流水 */
const movements = ref<MovementRow[]>([]);
const movementTotal = ref(0);
const movementPage = ref(1);
const movementPageSize = 20;
const movementTypeFilter = ref<MovementType | ''>('');
const loadingMovements = ref(false);

/* 对话框 */
const productDialogOpen = ref(false);
const productDialogTarget = ref<ProductRow | null>(null);
const productForm = reactive({ name: '', unit: '', category: '', lowStockThreshold: '' });
const movementDialogOpen = ref(false);
const movementForm = reactive({ productId: '', type: 'INBOUND' as MovementType, quantity: '', note: '' });
const deleteTarget = ref<ProductRow | null>(null);
const deleteMovementTarget = ref<MovementRow | null>(null);
const saving = ref(false);

const movementTypeOptions = (['INBOUND', 'ADJUSTMENT'] as const).map((t) => ({
  label: t === 'INBOUND' ? '入库（+）' : '盘点调整（±）',
  value: t,
}));

async function loadProducts(): Promise<void> {
  loadingProducts.value = true;
  try {
    products.value = await inventoryApi.products({
      ...(productSearch.value ? { search: productSearch.value } : {}),
      ...(lowOnly.value ? { low: '1' } : {}),
    });
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loadingProducts.value = false;
  }
}

async function loadMovements(): Promise<void> {
  loadingMovements.value = true;
  try {
    const res = await inventoryApi.movements({
      ...(movementTypeFilter.value ? { type: movementTypeFilter.value } : {}),
      page: movementPage.value,
      pageSize: movementPageSize,
    });
    movements.value = res.movements;
    movementTotal.value = res.total;
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loadingMovements.value = false;
  }
}

onMounted(() => {
  void loadProducts();
  void loadMovements();
});

const productOptions = computed(() => products.value.map((p) => ({ label: p.name, value: String(p.id) })));

function openProductDialog(target: ProductRow | null): void {
  productDialogTarget.value = target;
  Object.assign(productForm, {
    name: target?.name ?? '',
    unit: target?.unit ?? '',
    category: target?.category ?? '',
    lowStockThreshold: target?.lowStockThreshold != null ? String(target.lowStockThreshold) : '',
  });
  productDialogOpen.value = true;
}

async function saveProduct(): Promise<void> {
  saving.value = true;
  try {
    await inventoryApi.upsertProduct({
      ...(productDialogTarget.value ? { id: productDialogTarget.value.id } : {}),
      name: productForm.name.trim(),
      unit: productForm.unit.trim() || undefined,
      category: productForm.category.trim() || undefined,
      lowStockThreshold: productForm.lowStockThreshold === '' ? undefined : Number(productForm.lowStockThreshold),
    });
    toast.success('物品已保存');
    productDialogOpen.value = false;
    await loadProducts();
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    saving.value = false;
  }
}

async function saveMovement(): Promise<void> {
  const qty = Number(movementForm.quantity);
  if (!movementForm.productId) return toast.error('请选择物品');
  if (!Number.isFinite(qty) || qty === 0) return toast.error('请填写非零数量');
  if (movementForm.type === 'INBOUND' && qty <= 0) return toast.error('入库数量需为正数');
  saving.value = true;
  try {
    await inventoryApi.createMovement({
      productId: Number(movementForm.productId),
      type: movementForm.type,
      quantity: qty,
      note: movementForm.note.trim() || undefined,
    });
    toast.success('库存流水已登记');
    movementDialogOpen.value = false;
    await Promise.all([loadProducts(), loadMovements()]);
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    saving.value = false;
  }
}

async function removeProduct(): Promise<void> {
  if (!deleteTarget.value) return;
  try {
    await inventoryApi.deleteProduct(deleteTarget.value.id);
    toast.success('物品已删除');
    deleteTarget.value = null;
    await loadProducts();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function removeMovement(): Promise<void> {
  if (!deleteMovementTarget.value) return;
  try {
    await inventoryApi.removeMovement(deleteMovementTarget.value.id);
    toast.success('流水已删除并回冲');
    deleteMovementTarget.value = null;
    await Promise.all([loadProducts(), loadMovements()]);
  } catch (e) {
    toast.error(apiError(e));
  }
}

function fmtTime(dt: string): string {
  return new Date(dt).toISOString().slice(0, 16).replace('T', ' ');
}
</script>

<template>
  <div class="space-y-4">
    <div class="card overflow-hidden">
      <div class="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
        <button
          v-for="t in [{ key: 'products', label: '库存物品' }, { key: 'movements', label: '库存流水' }]"
          :key="t.key"
          class="px-3 h-9 text-sm font-medium rounded-t-lg cursor-pointer transition-colors"
          :class="tab === t.key ? 'text-primary border-b-2 border-primary bg-primary-soft/40' : 'text-muted hover:text-text'"
          @click="tab = t.key as 'products' | 'movements'"
        >
          {{ t.label }}
        </button>
        <div class="ml-auto flex items-center gap-2 pb-1.5">
          <Button variant="secondary" size="sm" @click="movementForm = { productId: '', type: 'INBOUND', quantity: '', note: '' }; movementDialogOpen = true">
            <Icon name="plus" :size="13" /> 记一笔流水
          </Button>
          <Button variant="primary" size="sm" @click="openProductDialog(null)">
            <Icon name="plus" :size="13" /> 新增物品
          </Button>
        </div>
      </div>

      <!-- 物品 -->
      <template v-if="tab === 'products'">
        <div class="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-line">
          <div class="relative flex-1 min-w-44">
            <Icon name="search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              v-model="productSearch"
              class="w-full h-9 pl-9 pr-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none"
              placeholder="搜索物品名"
              @keyup.enter="loadProducts"
            />
          </div>
          <label class="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
            <input v-model="lowOnly" type="checkbox" class="size-3.5 accent-[#2563EB]" @change="loadProducts" />
            只看低库存
          </label>
        </div>

        <div v-if="loadingProducts" class="py-14 text-center text-sm text-faint">加载中…</div>
        <EmptyState v-else-if="products.length === 0" icon="inventory" title="暂无库存物品" description="台账入库或手动新增后出现在这里" />

        <div v-else class="overflow-x-auto">
          <table class="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>物品</th><th>分类</th><th class="text-right">当前库存</th><th class="text-right">预警阈值</th><th>状态</th><th class="text-right">领用次数</th><th class="w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in products" :key="p.id">
                <td class="font-medium">{{ p.name }}<span v-if="p.unit" class="ml-1 text-xs text-faint">（{{ p.unit }}）</span></td>
                <td class="text-xs text-muted">{{ p.category ?? '—' }}</td>
                <td class="text-right num font-semibold" :class="p.isLow ? 'text-red' : ''">{{ p.stockQty }}</td>
                <td class="text-right num text-xs text-muted">{{ p.lowStockThreshold ?? '—' }}</td>
                <td><Badge :tone="p.isLow ? 'red' : 'teal'">{{ p.isLow ? '低库存' : '充足' }}</Badge></td>
                <td class="text-right num text-xs">{{ p._count?.distributionLines ?? 0 }}</td>
                <td>
                  <div class="flex items-center gap-0.5">
                    <button class="p-1.5 text-faint hover:text-primary cursor-pointer" title="编辑" @click="openProductDialog(p)">
                      <Icon name="edit" :size="14" />
                    </button>
                    <button class="p-1.5 text-faint hover:text-red cursor-pointer" title="删除" @click="deleteTarget = p">
                      <Icon name="trash" :size="14" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 流水 -->
      <template v-else>
        <div class="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <Select v-model="movementTypeFilter" :options="[{ label: '全部类型', value: '' }, ...Object.entries(MOVEMENT_TYPE_LABELS).map(([v, l]) => ({ label: l, value: v }))]" class="w-36" @update:model-value="movementPage = 1; loadMovements()" />
        </div>

        <div v-if="loadingMovements" class="py-14 text-center text-sm text-faint">加载中…</div>
        <EmptyState v-else-if="movements.length === 0" icon="inventory" title="暂无库存流水" />

        <div v-else class="overflow-x-auto">
          <table class="table-base min-w-[680px]">
            <thead>
              <tr><th>时间</th><th>物品</th><th>类型</th><th class="text-right">数量变动</th><th>说明</th><th class="w-16" /></tr>
            </thead>
            <tbody>
              <tr v-for="m in movements" :key="m.id">
                <td class="text-xs text-muted num">{{ fmtTime(m.createdAt) }}</td>
                <td class="font-medium">{{ m.product.name }}</td>
                <td>
                  <Badge :tone="m.type === 'INBOUND' ? 'teal' : m.type === 'OUTBOUND' ? 'blue' : 'amber'">
                    {{ MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type }}
                  </Badge>
                </td>
                <td class="text-right num font-semibold" :class="m.quantity >= 0 ? 'text-teal' : 'text-red'">
                  {{ m.quantity >= 0 ? '+' : '' }}{{ m.quantity }}
                </td>
                <td class="text-xs text-muted">
                  {{ m.note ?? '—' }}
                  <template v-if="m.relatedItemId"><span class="text-faint num">（台账 #{{ m.relatedItemId }}）</span></template>
                </td>
                <td>
                  <button
                    v-if="!m.relatedItemId && !m.relatedDistributionId"
                    class="p-1.5 text-faint hover:text-red cursor-pointer"
                    title="删除并回冲"
                    @click="deleteMovementTarget = m"
                  >
                    <Icon name="trash" :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-4 py-3 border-t border-line">
          <Pagination :page="movementPage" :page-size="movementPageSize" :total="movementTotal" @change="(p) => { movementPage = p; loadMovements(); }" />
        </div>
      </template>
    </div>

    <!-- 物品编辑 -->
    <Dialog :open="productDialogOpen" :title="productDialogTarget ? '编辑物品' : '新增物品'" width="480px" @update:open="productDialogOpen = $event">
      <div class="space-y-3.5">
        <Input v-model="productForm.name" label="物品名" required />
        <div class="grid grid-cols-2 gap-3">
          <Input v-model="productForm.unit" label="单位" placeholder="个 / 盒" />
          <Input v-model="productForm.category" label="分类" placeholder="文具 / 纸品" />
        </div>
        <Input v-model="productForm.lowStockThreshold" label="低库存预警阈值" type="number" min="0" step="any" hint="库存 ≤ 该值时在概览提示" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="productDialogOpen = false">取消</Button>
        <Button variant="primary" :loading="saving" @click="saveProduct">保存</Button>
      </template>
    </Dialog>

    <!-- 手动流水 -->
    <Dialog :open="movementDialogOpen" title="登记库存流水" description="入库或盘点调整；出库请走发放登记" width="480px" @update:open="movementDialogOpen = $event">
      <div class="space-y-3.5">
        <Select v-model="movementForm.productId" label="物品" :options="productOptions" required />
        <Select v-model="movementForm.type" label="类型" :options="movementTypeOptions" />
        <Input v-model="movementForm.quantity" label="数量（带符号）" type="number" step="any" required hint="盘点调整填负数表示减库存" />
        <Input v-model="movementForm.note" label="说明" placeholder="如：盘点修正 / 供应商赠送" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="movementDialogOpen = false">取消</Button>
        <Button variant="primary" :loading="saving" @click="saveMovement">登记</Button>
      </template>
    </Dialog>

    <ConfirmDialog :open="!!deleteTarget" title="删除物品" :message="`「${deleteTarget?.name}」将被删除。仅允许删除库存为零且无领用记录的物品。`" confirm-text="删除" danger @update:open="deleteTarget = null" @confirm="removeProduct" />
    <ConfirmDialog :open="!!deleteMovementTarget" title="删除流水" :message="`该流水将被删除且库存回冲（${deleteMovementTarget?.product?.name} ${(deleteMovementTarget?.quantity ?? 0) >= 0 ? '+' : ''}${deleteMovementTarget?.quantity}）。`" confirm-text="删除并回冲" danger @update:open="deleteMovementTarget = null" @confirm="removeMovement" />
  </div>
</template>

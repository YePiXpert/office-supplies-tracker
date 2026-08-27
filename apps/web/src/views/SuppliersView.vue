<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Badge from '@/components/ui/Badge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Dialog from '@/components/ui/Dialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { suppliersApi, type PriceRecordRow, type SupplierRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { formatDate } from '@/utils/datetime';
import { apiError } from '@/api/client';

const toast = useToastStore();
const tab = ref<'suppliers' | 'prices'>('suppliers');

const suppliers = ref<SupplierRow[]>([]);
const prices = ref<PriceRecordRow[]>([]);
const priceSearch = ref('');
const loading = ref(true);

const supplierDialogOpen = ref(false);
const supplierDialogTarget = ref<SupplierRow | null>(null);
const supplierForm = reactive({ name: '', contact: '', phone: '', note: '' });

const priceDialogOpen = ref(false);
const priceForm = reactive({ supplierId: '', itemName: '', unitPrice: '', purchaseLink: '' });

const deleteTarget = ref<SupplierRow | null>(null);
const deletePriceTarget = ref<PriceRecordRow | null>(null);
const saving = ref(false);

/* 采购建议 */
const suggestQuery = ref('');
const suggestions = ref<PriceRecordRow[]>([]);
const suggestLoading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    suppliers.value = await suppliersApi.list();
    prices.value = await suppliersApi
      .priceRecords(priceSearch.value ? { itemName: priceSearch.value } : undefined)
      .catch(() => []);
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const supplierOptions = computed(() => suppliers.value.map((s) => ({ label: s.name, value: String(s.id) })));

function openSupplierDialog(target: SupplierRow | null): void {
  supplierDialogTarget.value = target;
  Object.assign(supplierForm, {
    name: target?.name ?? '',
    contact: target?.contact ?? '',
    phone: target?.phone ?? '',
    note: target?.note ?? '',
  });
  supplierDialogOpen.value = true;
}

async function saveSupplier(): Promise<void> {
  if (!supplierForm.name.trim()) return toast.error('请填写供应商名称');
  saving.value = true;
  try {
    await suppliersApi.upsert({
      ...(supplierDialogTarget.value ? { id: supplierDialogTarget.value.id } : {}),
      name: supplierForm.name.trim(),
      contact: supplierForm.contact.trim() || undefined,
      phone: supplierForm.phone.trim() || undefined,
      note: supplierForm.note.trim() || undefined,
    });
    toast.success('供应商已保存');
    supplierDialogOpen.value = false;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    saving.value = false;
  }
}

async function savePrice(): Promise<void> {
  if (!priceForm.supplierId) return toast.error('请选择供应商');
  if (!priceForm.itemName.trim()) return toast.error('请填写品名');
  const price = Number(priceForm.unitPrice);
  if (!Number.isFinite(price) || price <= 0) return toast.error('请填写正确的单价');
  saving.value = true;
  try {
    await suppliersApi.addPriceRecord({
      supplierId: Number(priceForm.supplierId),
      itemName: priceForm.itemName.trim(),
      unitPrice: price,
      purchaseLink: priceForm.purchaseLink.trim() || undefined,
    });
    toast.success('价格记录已保存');
    priceDialogOpen.value = false;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    saving.value = false;
  }
}

async function removeSupplier(): Promise<void> {
  if (!deleteTarget.value) return;
  try {
    await suppliersApi.remove(deleteTarget.value.id);
    toast.success('供应商已删除');
    deleteTarget.value = null;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function removePrice(): Promise<void> {
  if (!deletePriceTarget.value) return;
  try {
    await suppliersApi.removePriceRecord(deletePriceTarget.value.id);
    toast.success('价格记录已删除');
    deletePriceTarget.value = null;
    await load();
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function runSuggest(): Promise<void> {
  if (!suggestQuery.value.trim()) return;
  suggestLoading.value = true;
  try {
    suggestions.value = await suppliersApi.suggest(suggestQuery.value.trim());
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    suggestLoading.value = false;
  }
}

function fmtTime(dt: string): string {
  return formatDate(dt);
}
</script>

<template>
  <div class="space-y-4">
    <!-- 采购建议 -->
    <div class="card p-4">
      <h2 class="text-sm font-bold text-ink mb-2.5">比价建议</h2>
      <div class="flex gap-2">
        <div class="relative flex-1 max-w-sm">
          <Icon name="search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            v-model="suggestQuery"
            class="w-full h-9.5 pl-9 pr-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none"
            placeholder="输入品名查各家最新报价"
            @keyup.enter="runSuggest"
          />
        </div>
        <Button variant="primary" size="md" :loading="suggestLoading" @click="runSuggest">查价</Button>
      </div>
      <div v-if="suggestions.length > 0" class="mt-3 overflow-x-auto">
        <table class="table-base min-w-[560px]">
          <thead><tr><th>供应商</th><th class="text-right">单价</th><th>链接</th><th>报价时间</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in suggestions" :key="s.id">
              <td>
                <span class="font-medium">{{ s.supplier.name }}</span>
                <Badge v-if="i === 0" tone="teal" class="ml-1.5">最低价</Badge>
              </td>
              <td class="text-right num font-semibold">¥{{ s.unitPrice }}</td>
              <td>
                <a v-if="s.purchaseLink" :href="s.purchaseLink" target="_blank" rel="noopener" class="text-primary hover:underline text-xs">打开链接</a>
                <span v-else class="text-faint text-xs">—</span>
              </td>
              <td class="text-xs text-faint num">{{ fmtTime(s.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="flex border-b border-line px-3 pt-2 gap-1">
        <button
          v-for="t in [{ key: 'suppliers', label: '供应商' }, { key: 'prices', label: '价格记忆' }]"
          :key="t.key"
          class="px-3 h-9 text-sm font-medium rounded-t-lg cursor-pointer transition-colors"
          :class="tab === t.key ? 'text-primary border-b-2 border-primary bg-primary-soft/40' : 'text-muted hover:text-text'"
          @click="tab = t.key as 'suppliers' | 'prices'"
        >
          {{ t.label }}
        </button>
        <div class="ml-auto flex items-center gap-2 pb-1.5">
          <Button v-if="tab === 'prices'" variant="secondary" size="sm" @click="Object.assign(priceForm, { supplierId: '', itemName: '', unitPrice: '', purchaseLink: '' }); priceDialogOpen = true">
            <Icon name="plus" :size="13" /> 记一笔价格
          </Button>
          <Button variant="primary" size="sm" @click="openSupplierDialog(null)">
            <Icon name="plus" :size="13" /> 新增供应商
          </Button>
        </div>
      </div>

      <!-- 供应商列表 -->
      <template v-if="tab === 'suppliers'">
        <div v-if="loading" class="py-14 text-center text-sm text-faint">加载中…</div>
        <EmptyState v-else-if="suppliers.length === 0" icon="supplier" title="还没有供应商" description="把常用的几家加进来，采购时快速选择" />
        <div v-else class="overflow-x-auto">
          <table class="table-base min-w-[640px]">
            <thead><tr><th>名称</th><th>联系人</th><th>电话</th><th class="text-right">关联台账</th><th class="text-right">报价数</th><th class="w-24">操作</th></tr></thead>
            <tbody>
              <tr v-for="s in suppliers" :key="s.id">
                <td class="font-medium">{{ s.name }}</td>
                <td class="text-xs">{{ s.contact ?? '—' }}</td>
                <td class="text-xs num">{{ s.phone ?? '—' }}</td>
                <td class="text-right num">{{ s._count?.items ?? 0 }}</td>
                <td class="text-right num">{{ s._count?.priceRecords ?? 0 }}</td>
                <td>
                  <div class="flex items-center gap-0.5">
                    <button class="p-1.5 text-faint hover:text-primary cursor-pointer" title="编辑" @click="openSupplierDialog(s)"><Icon name="edit" :size="14" /></button>
                    <button class="p-1.5 text-faint hover:text-red cursor-pointer" title="删除" @click="deleteTarget = s"><Icon name="trash" :size="14" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 价格记录 -->
      <template v-else>
        <div class="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <div class="relative flex-1 max-w-xs">
            <Icon name="search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              v-model="priceSearch"
              class="w-full h-9 pl-9 pr-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none"
              placeholder="按品名过滤"
              @keyup.enter="load"
            />
          </div>
        </div>
        <EmptyState v-if="prices.length === 0" icon="supplier" title="暂无价格记录" description="下单时顺手记下单价，下次自动比价" />
        <div v-else class="overflow-x-auto">
          <table class="table-base min-w-[640px]">
            <thead><tr><th>品名</th><th>供应商</th><th class="text-right">单价</th><th>链接</th><th>时间</th><th class="w-16" /></tr></thead>
            <tbody>
              <tr v-for="p in prices" :key="p.id">
                <td class="font-medium">{{ p.itemName }}</td>
                <td class="text-xs">{{ p.supplier.name }}</td>
                <td class="text-right num">¥{{ p.unitPrice }}</td>
                <td>
                  <a v-if="p.purchaseLink" :href="p.purchaseLink" target="_blank" rel="noopener" class="text-primary hover:underline text-xs">链接</a>
                  <span v-else class="text-faint text-xs">—</span>
                </td>
                <td class="text-xs text-faint num">{{ fmtTime(p.createdAt) }}</td>
                <td>
                  <button class="p-1.5 text-faint hover:text-red cursor-pointer" title="删除" @click="deletePriceTarget = p"><Icon name="trash" :size="14" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- 供应商对话框 -->
    <Dialog :open="supplierDialogOpen" :title="supplierDialogTarget ? '编辑供应商' : '新增供应商'" width="440px" @update:open="supplierDialogOpen = $event">
      <div class="space-y-3.5">
        <Input v-model="supplierForm.name" label="名称" required placeholder="如：得力官方旗舰店" />
        <div class="grid grid-cols-2 gap-3">
          <Input v-model="supplierForm.contact" label="联系人" />
          <Input v-model="supplierForm.phone" label="电话" />
        </div>
        <Input v-model="supplierForm.note" label="备注" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="supplierDialogOpen = false">取消</Button>
        <Button variant="primary" :loading="saving" @click="saveSupplier">保存</Button>
      </template>
    </Dialog>

    <!-- 价格记录对话框 -->
    <Dialog :open="priceDialogOpen" title="记一笔价格" width="440px" @update:open="priceDialogOpen = $event">
      <div class="space-y-3.5">
        <Select v-model="priceForm.supplierId" label="供应商" :options="supplierOptions" required />
        <Input v-model="priceForm.itemName" label="品名" required placeholder="与台账品名保持一致可自动比价" />
        <Input v-model="priceForm.unitPrice" label="单价" type="number" min="0" step="any" required />
        <Input v-model="priceForm.purchaseLink" label="商品链接" placeholder="https://…" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="priceDialogOpen = false">取消</Button>
        <Button variant="primary" :loading="saving" @click="savePrice">保存</Button>
      </template>
    </Dialog>

    <ConfirmDialog :open="!!deleteTarget" title="删除供应商" :message="`「${deleteTarget?.name}」将被删除。已关联台账记录的供应商无法删除。`" confirm-text="删除" danger @update:open="deleteTarget = null" @confirm="removeSupplier" />
    <ConfirmDialog :open="!!deletePriceTarget" title="删除价格记录" :message="`「${deletePriceTarget?.itemName}」在 ${deletePriceTarget?.supplier?.name} 的报价将被删除。`" confirm-text="删除" danger @update:open="deletePriceTarget = null" @confirm="removePrice" />
  </div>
</template>

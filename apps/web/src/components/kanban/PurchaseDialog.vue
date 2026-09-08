<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Icon from '@/components/ui/Icon.vue';
import { itemsApi, suppliersApi, type ItemRow, type PriceRecordRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { useCatalogStore } from '@/stores/catalog';
import { apiError } from '@/api/client';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/datetime';

/**
 * 下单登记：把「谁家买的、多少钱、什么链接」记在真正下单的那一刻。
 *
 * 之前这些只能回台账开编辑弹窗补，价格记忆和下单动作是脱节的；
 * 这里顺手把单价写进供应商报价库，下次同一品名就能自动比价。
 */
const props = defineProps<{ open: boolean; item: ItemRow | null }>();
const emit = defineEmits<{ 'update:open': [v: boolean]; done: [] }>();

const toast = useToastStore();
const catalog = useCatalogStore();
const saving = ref(false);
const suggestions = ref<PriceRecordRow[]>([]);

const form = reactive({
  supplierId: '',
  unitPrice: '',
  purchaseLink: '',
  rememberPrice: true,
});
const errors = reactive<Record<string, string>>({});

watch(
  () => props.open,
  async (open) => {
    if (!open || !props.item) return;
    Object.keys(errors).forEach((k) => delete errors[k]);
    Object.assign(form, {
      supplierId: props.item.supplierId != null ? String(props.item.supplierId) : '',
      unitPrice: props.item.unitPrice != null ? String(props.item.unitPrice) : '',
      purchaseLink: props.item.purchaseLink ?? '',
      rememberPrice: true,
    });
    await catalog.ensureSuppliers().catch(() => []);
    suggestions.value = await suppliersApi.suggest(props.item.itemName).catch(() => []);
  },
);

const supplierOptions = computed(() => [
  { label: '未指定', value: '' },
  ...catalog.suppliers.map((s) => ({ label: s.name, value: String(s.id) })),
]);

const total = computed(() => {
  const price = Number(form.unitPrice);
  if (!props.item || !Number.isFinite(price) || form.unitPrice === '') return null;
  return price * props.item.quantity;
});

function applySuggestion(s: PriceRecordRow): void {
  form.supplierId = String(s.supplierId);
  form.unitPrice = String(s.unitPrice);
  if (s.purchaseLink) form.purchaseLink = s.purchaseLink;
  delete errors.unitPrice;
}

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k]);
  if (form.unitPrice !== '') {
    const n = Number(form.unitPrice);
    if (!Number.isFinite(n)) errors.unitPrice = '单价格式不正确';
    else if (n < 0) errors.unitPrice = '单价不能为负数';
  }
  if (form.rememberPrice && form.unitPrice !== '' && !form.supplierId) {
    errors.supplierId = '记入价格库需要指定供应商';
  }
  return Object.keys(errors).length === 0;
}

async function submit(markOrdered: boolean): Promise<void> {
  if (!props.item || saving.value) return;
  if (!validate()) return;
  saving.value = true;
  try {
    await itemsApi.update(props.item.id, {
      supplierId: form.supplierId === '' ? null : Number(form.supplierId),
      unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
      purchaseLink: form.purchaseLink.trim() || null,
      ...(markOrdered ? { status: 'PENDING_ARRIVAL' as const } : {}),
    });

    // 价格记忆：失败不影响主流程，只提示
    if (form.rememberPrice && form.supplierId && form.unitPrice !== '' && Number(form.unitPrice) > 0) {
      await suppliersApi
        .addPriceRecord({
          supplierId: Number(form.supplierId),
          itemName: props.item.itemName,
          unitPrice: Number(form.unitPrice),
          purchaseLink: form.purchaseLink.trim() || undefined,
        })
        .catch(() => toast.info('采购信息已保存，但价格没能记入比价库'));
    }

    toast.success(markOrdered ? `「${props.item.itemName}」已标记为待到货` : '采购信息已保存');
    emit('update:open', false);
    emit('done');
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :open="props.open"
    title="下单登记"
    :description="props.item ? `${props.item.itemName} ×${props.item.quantity} · ${props.item.department}` : ''"
    width="520px"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="props.item" class="space-y-3.5">
      <!-- 历史报价 -->
      <div v-if="suggestions.length > 0" class="p-2.5 bg-primary-soft/50 border border-primary/15 rounded-(--radius-control)">
        <p class="flex items-center gap-1.5 text-meta font-semibold text-primary mb-1.5">
          <Icon name="supplier" :size="12" /> 历史报价（点击填入）
        </p>
        <div class="space-y-1">
          <button
            v-for="(s, i) in suggestions.slice(0, 4)"
            :key="s.id"
            type="button"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface border border-line text-xs cursor-pointer transition-all hover:border-primary text-left active:scale-[0.99]"
            @click="applySuggestion(s)"
          >
            <span class="flex-1 truncate">{{ s.supplier.name }}</span>
            <span v-if="i === 0" class="inline-flex items-center h-4.5 px-1.5 rounded-full text-meta font-semibold bg-teal-soft text-teal">最低价</span>
            <span class="num font-semibold shrink-0">{{ formatCurrency(s.unitPrice) }}</span>
            <span class="text-meta text-faint num shrink-0">{{ formatDate(s.createdAt) }}</span>
          </button>
        </div>
      </div>
      <p v-else class="text-xs text-faint">这个品名还没有历史报价，这次填的会成为下次的比价基准。</p>

      <Select v-model="form.supplierId" label="供应商" :options="supplierOptions" clearable :error="errors.supplierId" />

      <div class="grid grid-cols-2 gap-3">
        <Input
          v-model="form.unitPrice"
          label="成交单价"
          type="number"
          min="0"
          step="any"
          placeholder="可空"
          :error="errors.unitPrice"
        />
        <div>
          <span class="block mb-1.5 text-xs font-semibold text-muted">合计</span>
          <div class="flex items-center h-9.5 px-3 text-sm num font-semibold text-ink bg-canvas border border-line rounded-(--radius-control)">
            {{ total != null ? formatCurrency(total) : '—' }}
          </div>
        </div>
      </div>

      <Input v-model="form.purchaseLink" label="采购链接" placeholder="https://…（可空）" />

      <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
        <input v-model="form.rememberPrice" type="checkbox" class="size-3.5 accent-primary" />
        把这次单价记入比价库（下次采购同一品名时自动提示）
      </label>
    </div>

    <template #footer>
      <Button variant="ghost" @click="emit('update:open', false)">取消</Button>
      <Button variant="secondary" :loading="saving" @click="submit(false)">只保存</Button>
      <Button variant="primary" :loading="saving" @click="submit(true)">保存并标记已下单</Button>
    </template>
  </Dialog>
</template>

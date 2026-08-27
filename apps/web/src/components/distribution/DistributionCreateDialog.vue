<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import { distributionsApi, inventoryApi, itemsApi, type ItemRow, type ProductRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import type { DistributionSource } from '@procure-lite/shared';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** 预选的待分发台账记录（从看板进入时传入） */
    presetItems?: ItemRow[];
  }>(),
  { presetItems: () => [] },
);
const emit = defineEmits<{ 'update:open': [v: boolean]; created: [] }>();

const toast = useToastStore();
const saving = ref(false);
const mode = ref<DistributionSource>('DIRECT');
const pendingItems = ref<ItemRow[]>([]);
const products = ref<ProductRow[]>([]);

const form = reactive({
  date: new Date().toISOString().slice(0, 10),
  department: '',
  note: '',
});

interface LineDraft {
  itemId?: number;
  productId?: number;
  itemName: string;
  remaining?: number; // 台账可发放余量
  stock?: number; // 库存余量
  recipient: string;
  quantity: string;
  signoffNote: string;
}
const lines = ref<LineDraft[]>([]);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    form.date = new Date().toISOString().slice(0, 10);
    form.note = '';
    mode.value = props.presetItems.length > 0 ? 'DIRECT' : 'DIRECT';
    const [items, prods] = await Promise.all([
      itemsApi.list({ status: 'PENDING_DISTRIBUTION', pageSize: 100 }),
      inventoryApi.products(),
    ]);
    pendingItems.value = items.items;
    products.value = prods.filter((p) => p.stockQty > 0);

    if (props.presetItems.length > 0) {
      form.department = props.presetItems[0].department;
      lines.value = props.presetItems.map((it) => ({
        itemId: it.id,
        itemName: it.itemName,
        remaining: it.quantity,
        recipient: it.handler,
        quantity: String(it.quantity),
        signoffNote: '',
      }));
    } else {
      form.department = '';
      lines.value = [emptyLine()];
    }
  },
);

function emptyLine(): LineDraft {
  return { itemName: '', recipient: '', quantity: '1', signoffNote: '' };
}

const itemOptions = computed(() =>
  pendingItems.value.map((it) => ({
    label: `${it.itemName}（${it.department} · 余 ${it.quantity}）`,
    value: String(it.id),
  })),
);
const productOptions = computed(() =>
  products.value.map((p) => ({ label: `${p.name}（库存 ${p.stockQty}）`, value: String(p.id) })),
);

function onPickItem(index: number, value: string): void {
  const it = pendingItems.value.find((x) => String(x.id) === value);
  if (!it) return;
  const line = lines.value[index];
  line.itemId = it.id;
  line.itemName = it.itemName;
  line.remaining = it.quantity;
  if (!form.department) form.department = it.department;
  line.recipient = line.recipient || it.handler;
}

function onPickProduct(index: number, value: string): void {
  const p = products.value.find((x) => String(x.id) === value);
  if (!p) return;
  const line = lines.value[index];
  line.productId = p.id;
  line.itemName = p.name;
  line.stock = p.stockQty;
}

/** 校验汇总：直发数量不得超台账；库存发放不得超库存 */
const validation = computed<string | null>(() => {
  if (lines.value.length === 0) return '至少添加一条领用明细';
  const itemSums = new Map<number, number>();
  const productSums = new Map<number, number>();
  for (const l of lines.value) {
    const qty = Number(l.quantity);
    if (!l.recipient.trim()) return '请填写每条明细的领用人';
    if (!Number.isFinite(qty) || qty <= 0) return '领用数量必须大于 0';
    if (mode.value === 'DIRECT') {
      if (!l.itemId || !l.itemName) return '请为每条明细选择台账记录';
      if (l.remaining != null && qty > l.remaining) return `「${l.itemName}」发放数量超过台账数量（余 ${l.remaining}）`;
      itemSums.set(l.itemId, (itemSums.get(l.itemId) ?? 0) + qty);
    } else {
      if (!l.productId) return '请为每条明细选择库存物品';
      if (l.stock != null && qty > l.stock) return `「${l.itemName}」超过库存（余 ${l.stock}）`;
      productSums.set(l.productId, (productSums.get(l.productId) ?? 0) + qty);
    }
  }
  if (mode.value === 'DIRECT') {
    for (const [itemId, sum] of itemSums) {
      const it = pendingItems.value.find((x) => x.id === itemId);
      if (it && sum > it.quantity) {
        return `「${it.itemName}」拆分给多人的总数超过台账数量（${sum} > ${it.quantity}）`;
      }
    }
  } else {
    for (const [productId, sum] of productSums) {
      const p = products.value.find((x) => x.id === productId);
      if (p && sum > p.stockQty) {
        return `「${p.name}」合计发放超过库存（${sum} > ${p.stockQty}）`;
      }
    }
  }
  return null;
});

async function submit(): Promise<void> {
  if (validation.value) return toast.error(validation.value);
  saving.value = true;
  try {
    await distributionsApi.create({
      date: form.date,
      source: mode.value,
      department: form.department.trim() || undefined,
      note: form.note.trim() || undefined,
      lines: lines.value.map((l) => ({
        itemId: mode.value === 'DIRECT' ? l.itemId : undefined,
        productId: mode.value === 'STOCK' ? l.productId : undefined,
        itemName: l.itemName,
        recipient: l.recipient.trim(),
        quantity: Number(l.quantity),
        signoffNote: l.signoffNote.trim() || undefined,
      })),
    });
    toast.success('发放登记完成');
    emit('update:open', false);
    emit('created');
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
    title="发放登记"
    description="记录谁领了多少；直发未发完的部分会自动转入库存"
    width="680px"
    @update:open="emit('update:open', $event)"
  >
    <div class="grid grid-cols-2 gap-3 mb-4">
      <Input v-model="form.date" label="发放日期" type="date" required />
      <Input v-model="form.department" label="领用部门（可空）" placeholder="默认取申领部门" />
    </div>

    <!-- 模式切换 -->
    <div class="flex gap-2 mb-3">
      <button
        v-for="m in [{ key: 'DIRECT', label: '从台账直发' }, { key: 'STOCK', label: '从库存发放' }]"
        :key="m.key"
        class="h-8 px-3 rounded-(--radius-control) text-xs font-medium border cursor-pointer transition-colors"
        :class="mode === m.key ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-line-strong hover:border-primary'"
        @click="mode = m.key as DistributionSource; lines = [emptyLine()]"
      >
        {{ m.label }}
      </button>
    </div>

    <!-- 明细行 -->
    <div class="space-y-2">
      <div v-for="(line, i) in lines" :key="i" class="p-3 bg-canvas/60 border border-line rounded-(--radius-control) grid grid-cols-12 gap-2 items-end">
        <div class="col-span-12 sm:col-span-5">
          <Select
            v-if="mode === 'DIRECT'"
            :model-value="line.itemId ? String(line.itemId) : ''"
            :options="itemOptions"
            placeholder="选择待分发台账记录"
            @update:model-value="(v) => onPickItem(i, v)"
          />
          <Select
            v-else
            :model-value="line.productId ? String(line.productId) : ''"
            :options="productOptions"
            placeholder="选择库存物品"
            @update:model-value="(v) => onPickProduct(i, v)"
          />
        </div>
        <div class="col-span-4 sm:col-span-3">
          <input v-model="line.recipient" placeholder="领用人" class="w-full h-9.5 px-2.5 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none" />
        </div>
        <div class="col-span-3 sm:col-span-2">
          <input v-model="line.quantity" type="number" min="0" step="any" placeholder="数量" class="w-full h-9.5 px-2.5 text-sm num bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none" />
        </div>
        <div class="col-span-4 sm:col-span-1 flex justify-end">
          <button
            class="p-2 text-faint hover:text-red cursor-pointer"
            :aria-label="`删除明细 ${i + 1}`"
            :disabled="lines.length === 1"
            @click="lines.splice(i, 1)"
          >
            <Icon name="close" :size="14" />
          </button>
        </div>
      </div>
      <Button variant="ghost" size="sm" @click="lines.push(emptyLine())">
        <Icon name="plus" :size="13" /> 添加领用明细
      </Button>
    </div>

    <div class="mt-4">
      <Input v-model="form.note" label="备注（可空）" placeholder="如：第二次集中发放" />
    </div>

    <template #footer>
      <Button variant="ghost" @click="emit('update:open', false)">取消</Button>
      <Button variant="primary" :loading="saving" @click="submit">确认发放</Button>
    </template>
  </Dialog>
</template>

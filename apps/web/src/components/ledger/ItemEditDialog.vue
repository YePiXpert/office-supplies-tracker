<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Textarea from '@/components/ui/Textarea.vue';
import { itemsApi, suppliersApi, type ItemRow, type SupplierRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import { todayString, formatDateTime } from '@/utils/datetime';
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type ItemStatus,
  type PaymentStatus,
} from '@procure-lite/shared';

const props = defineProps<{ open: boolean; item: ItemRow | null }>();
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [] }>();

const toast = useToastStore();
const suppliers = ref<SupplierRow[]>([]);
const saving = ref(false);

const form = reactive({
  serialNumber: '',
  department: '',
  handler: '',
  requestDate: todayString(),
  itemName: '',
  quantity: '1',
  unit: '',
  purchaseLink: '',
  unitPrice: '',
  supplierId: '',
  status: 'PENDING_PURCHASE' as ItemStatus,
  paymentStatus: 'UNPAID' as PaymentStatus,
  invoiceIssued: false,
  arrivalDate: '',
  note: '',
});

const isEdit = computed(() => !!props.item);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    suppliers.value = await suppliersApi.list().catch(() => []);
    const it = props.item;
    Object.assign(form, {
      serialNumber: it?.serialNumber ?? '',
      department: it?.department ?? '',
      handler: it?.handler ?? '',
      requestDate: it?.requestDate ?? todayString(),
      itemName: it?.itemName ?? '',
      quantity: String(it?.quantity ?? 1),
      unit: it?.unit ?? '',
      purchaseLink: it?.purchaseLink ?? '',
      unitPrice: it?.unitPrice != null ? String(it.unitPrice) : '',
      supplierId: it?.supplierId != null ? String(it.supplierId) : '',
      status: (it?.status as ItemStatus) ?? 'PENDING_PURCHASE',
      paymentStatus: (it?.paymentStatus as PaymentStatus) ?? 'UNPAID',
      invoiceIssued: it?.invoiceIssued ?? false,
      arrivalDate: it?.arrivalDate ?? '',
      note: it?.note ?? '',
    });
  },
);

const supplierOptions = computed(() => [
  { label: '未指定', value: '' },
  ...suppliers.value.map((s) => ({ label: s.name, value: String(s.id) })),
]);
const statusOptions = ITEM_STATUSES.map((s) => ({ label: ITEM_STATUS_LABELS[s], value: s }));
const paymentOptions = PAYMENT_STATUSES.map((s) => ({ label: PAYMENT_STATUS_LABELS[s], value: s }));

async function save(): Promise<void> {
  if (saving.value) return;
  if (!form.serialNumber.trim() || !form.department.trim() || !form.handler.trim() || !form.itemName.trim()) {
    toast.error('请填写流水号、部门、经办人与品名');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      serialNumber: form.serialNumber.trim(),
      department: form.department.trim(),
      handler: form.handler.trim(),
      requestDate: form.requestDate,
      itemName: form.itemName.trim(),
      quantity: Number(form.quantity) || 1,
      unit: form.unit.trim() || undefined,
      purchaseLink: form.purchaseLink.trim() || undefined,
      unitPrice: form.unitPrice === '' ? undefined : Number(form.unitPrice),
      supplierId: form.supplierId === '' ? null : Number(form.supplierId),
      status: form.status,
      paymentStatus: form.paymentStatus,
      invoiceIssued: form.invoiceIssued,
      arrivalDate: form.arrivalDate || undefined,
      note: form.note.trim() || undefined,
    };
    if (isEdit.value && props.item) {
      await itemsApi.update(props.item.id, payload);
      toast.success('已保存修改');
    } else {
      await itemsApi.create(payload);
      toast.success('已新增台账记录');
    }
    emit('update:open', false);
    emit('saved');
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
    :title="isEdit ? '编辑台账记录' : '新增台账记录'"
    :description="isEdit ? `#${props.item?.id} ${props.item?.itemName}` : '手工录入一条采购申领'"
    width="640px"
    @update:open="emit('update:open', $event)"
  >
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <Input v-model="form.serialNumber" label="流水号" required placeholder="OA-2026-…" />
      <Input v-model="form.requestDate" label="申请日期" type="date" required />
      <Input v-model="form.department" label="申领部门" required placeholder="如：综合管理部" />
      <Input v-model="form.handler" label="经办人" required />
      <div class="sm:col-span-2">
        <Input v-model="form.itemName" label="品名" required placeholder="如：A4 复印纸" />
      </div>
      <Input v-model="form.quantity" label="数量" type="number" min="0" step="any" required />
      <Input v-model="form.unit" label="单位" placeholder="个 / 盒 / 箱（可空）" />
      <Input v-model="form.unitPrice" label="单价" type="number" min="0" step="any" placeholder="可空" />
      <Select v-model="form.supplierId" label="供应商" :options="supplierOptions" clearable />
      <div class="sm:col-span-2">
        <Input v-model="form.purchaseLink" label="采购链接" placeholder="https://…（可空）" />
      </div>
      <Select v-model="form.status" label="状态" :options="statusOptions" />
      <Select v-model="form.paymentStatus" label="付款状态" :options="paymentOptions" />
      <Input v-model="form.arrivalDate" label="到货日期" type="date" />
      <label class="flex items-center gap-2 mt-6 text-sm text-muted cursor-pointer select-none">
        <input v-model="form.invoiceIssued" type="checkbox" class="size-4 accent-[#2563EB]" />
        已开票
      </label>
      <div class="sm:col-span-2">
        <Textarea v-model="form.note" label="备注" placeholder="可空" />
      </div>
    </div>
    <template #footer>
      <Button variant="ghost" @click="emit('update:open', false)">取消</Button>
      <Button variant="primary" :loading="saving" @click="save">{{ isEdit ? '保存修改' : '新增' }}</Button>
    </template>
  </Dialog>
</template>

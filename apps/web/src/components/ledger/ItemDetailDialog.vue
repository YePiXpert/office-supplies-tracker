<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { itemsApi, http, downloadFile, type ItemRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import {
  ITEM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ItemStatus,
  type PaymentStatus,
} from '@procure-lite/shared';

interface HistoryRow {
  id: number;
  action: string;
  changedFields: string | null;
  createdAt: string;
}
interface AttachmentRow {
  id: number;
  kind: string;
  filename: string;
  createdAt: string;
}

const props = defineProps<{ open: boolean; item: ItemRow | null }>();
const emit = defineEmits<{ 'update:open': [v: boolean]; changed: [] }>();

const toast = useToastStore();
const history = ref<HistoryRow[]>([]);
const attachments = ref<AttachmentRow[]>([]);
const rollbackTarget = ref<HistoryRow | null>(null);

watch(
  () => [props.open, props.item?.id],
  async () => {
    if (!props.open || !props.item) return;
    history.value = await itemsApi.history(props.item.id).catch(() => []);
    attachments.value = await http
      .get<AttachmentRow[]>('/attachments', { params: { itemId: props.item.id } })
      .then((r) => r.data)
      .catch(() => []);
  },
);

const ACTION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '修改',
  BATCH_UPDATE: '批量修改',
  IMPORT_CREATE: '导入创建',
  IMPORT_MERGE: '导入合并数量',
  DISTRIBUTE: '发放',
  DISTRIBUTION_REVOKE: '发放作废',
  STOCK_IN: '采购入库',
  ROLLBACK: '回滚',
  DELETE: '删除',
  RESTORE: '恢复',
};

const changedSummary = computed(() => (row: HistoryRow) => {
  if (!row.changedFields) return '';
  try {
    const changed = JSON.parse(row.changedFields) as Record<string, [unknown, unknown]>;
    return Object.keys(changed).join('、');
  } catch {
    return '';
  }
});

async function doRollback(): Promise<void> {
  if (!props.item || !rollbackTarget.value) return;
  try {
    await itemsApi.rollback(props.item.id, rollbackTarget.value.id);
    toast.success('已回滚到所选版本');
    rollbackTarget.value = null;
    emit('changed');
    emit('update:open', false);
  } catch (e) {
    toast.error(apiError(e));
  }
}

async function uploadAttachment(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !props.item) return;
  const form = new FormData();
  form.append('file', file);
  form.append('kind', 'INVOICE');
  try {
    await http.post(`/attachments/items/${props.item.id}`, form, { headers: { 'content-type': 'multipart/form-data' } });
    toast.success('附件已上传');
    attachments.value = await http
      .get<AttachmentRow[]>('/attachments', { params: { itemId: props.item.id } })
      .then((r) => r.data);
  } catch (err) {
    toast.error(apiError(err));
  } finally {
    input.value = '';
  }
}

function fmt(dt: string | Date | null | undefined): string {
  if (!dt) return '—';
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <Dialog
    :open="props.open"
    title="台账详情"
    :description="props.item ? `${props.item.serialNumber} · ${props.item.itemName}` : ''"
    width="680px"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="props.item">
      <div class="flex items-center gap-2 mb-4">
        <StatusBadge :status="props.item.status" />
        <Badge tone="gray">{{ PAYMENT_STATUS_LABELS[props.item.paymentStatus as PaymentStatus] ?? props.item.paymentStatus }}</Badge>
        <Badge v-if="props.item.invoiceIssued" tone="teal">已开票</Badge>
      </div>

      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-sm">
        <div><dt class="text-xs text-faint">申领部门</dt><dd>{{ props.item.department }}</dd></div>
        <div><dt class="text-xs text-faint">经办人</dt><dd>{{ props.item.handler }}</dd></div>
        <div><dt class="text-xs text-faint">申请日期</dt><dd class="num">{{ props.item.requestDate }}</dd></div>
        <div><dt class="text-xs text-faint">数量</dt><dd class="num">{{ props.item.quantity }}{{ props.item.unit ?? '' }}</dd></div>
        <div><dt class="text-xs text-faint">单价</dt><dd class="num">{{ props.item.unitPrice != null ? `¥${props.item.unitPrice}` : '—' }}</dd></div>
        <div><dt class="text-xs text-faint">供应商</dt><dd>{{ props.item.supplierName ?? '—' }}</dd></div>
        <div><dt class="text-xs text-faint">到货日期</dt><dd class="num">{{ props.item.arrivalDate ?? '—' }}</dd></div>
        <div><dt class="text-xs text-faint">发放日期</dt><dd class="num">{{ props.item.distributionDate ?? '—' }}</dd></div>
        <div class="col-span-2 sm:col-span-3">
          <dt class="text-xs text-faint">采购链接</dt>
          <dd class="truncate">
            <a v-if="props.item.purchaseLink" :href="props.item.purchaseLink" target="_blank" rel="noopener" class="text-primary hover:underline break-all">{{ props.item.purchaseLink }}</a>
            <template v-else>—</template>
          </dd>
        </div>
        <div v-if="props.item.signoffNote" class="col-span-2 sm:col-span-3">
          <dt class="text-xs text-faint">签收信息</dt><dd>{{ props.item.signoffNote }}</dd>
        </div>
        <div v-if="props.item.note" class="col-span-2 sm:col-span-3">
          <dt class="text-xs text-faint">备注</dt><dd>{{ props.item.note }}</dd>
        </div>
      </dl>

      <!-- 附件 -->
      <div class="mt-5 pt-4 border-t border-line">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-bold text-muted">发票附件</h3>
          <label class="inline-flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
            <Icon name="upload" :size="12" /> 上传
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" class="hidden" @change="uploadAttachment" />
          </label>
        </div>
        <p v-if="attachments.length === 0" class="text-xs text-faint">暂无附件</p>
        <ul v-else class="space-y-1">
          <li v-for="a in attachments" :key="a.id" class="flex items-center justify-between gap-2 text-sm">
            <button class="truncate text-primary hover:underline cursor-pointer" @click="downloadFile(`/attachments/${a.id}/download`, a.filename)">
              <Icon name="file" :size="12" class="inline mr-1" />{{ a.filename }}
            </button>
            <span class="text-[11px] text-faint shrink-0">{{ fmt(a.createdAt) }}</span>
          </li>
        </ul>
      </div>

      <!-- 修改历史 -->
      <div class="mt-5 pt-4 border-t border-line">
        <h3 class="text-xs font-bold text-muted mb-2">修改历史（可回滚）</h3>
        <p v-if="history.length === 0" class="text-xs text-faint">暂无历史</p>
        <ul v-else class="space-y-1 max-h-56 overflow-y-auto">
          <li
            v-for="h in history"
            :key="h.id"
            class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-canvas/60 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium">{{ ACTION_LABELS[h.action] ?? h.action }}
                <span v-if="changedSummary(h)" class="text-faint font-normal text-xs">· 改了 {{ changedSummary(h) }}</span>
              </p>
              <p class="text-[11px] text-faint num">{{ fmt(h.createdAt) }}</p>
            </div>
            <Button v-if="h.action !== 'DELETE'" size="sm" variant="ghost" @click="rollbackTarget = h">回滚到此</Button>
          </li>
        </ul>
      </div>
    </template>
  </Dialog>

  <ConfirmDialog
    :open="!!rollbackTarget"
    title="回滚确认"
    :message="`将把该记录恢复到「${rollbackTarget ? fmt(rollbackTarget.createdAt) : ''}」时的状态，此操作本身也会记入历史。`"
    confirm-text="回滚"
    @update:open="rollbackTarget = null"
    @confirm="doRollback"
  />
</template>

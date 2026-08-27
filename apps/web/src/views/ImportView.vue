<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue';
import { todayString } from '@/utils/datetime';
import { useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Badge from '@/components/ui/Badge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { importsApi, suppliersApi, type ImportTaskView, type SupplierRow } from '@/api';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';
import type { DuplicatePreview } from '@procure-lite/shared';

type Step = 'upload' | 'parsing' | 'review' | 'done';

const toast = useToastStore();
const router = useRouter();

const step = ref<Step>('upload');
const taskId = ref('');
const taskError = ref('');
const suppliers = ref<SupplierRow[]>([]);
const duplicates = ref<DuplicatePreview[]>([]);
const result = ref({ created: 0, merged: 0, skipped: 0 });
const confirming = ref(false);

const form = reactive({
  serialNumber: '',
  department: '',
  handler: '',
  requestDate: todayString(),
  supplierId: '',
});

interface DraftLine {
  itemName: string;
  quantity: string;
  unitPrice: string;
  purchaseLink: string;
  duplicate: DuplicatePreview | null;
}
const lines = ref<DraftLine[]>([]);

const fileInput = ref<HTMLInputElement | null>(null)

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollFailures = 0;
onUnmounted(() => stopPoll());

function stopPoll(): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  pollFailures = 0;
}

/** 递归 setTimeout：上一次响应回来后才排下一次，天然避免重叠轮询 */
function schedulePoll(): void {
  pollTimer = setTimeout(() => void poll(), 1500);
}

async function upload(file: File): Promise<void> {
  stopPoll(); // 防御：清掉可能残留的旧轮询
  step.value = 'parsing';
  taskError.value = '';
  try {
    const { taskId: id } = await importsApi.upload(file);
    taskId.value = id;
    schedulePoll();
  } catch (e) {
    taskError.value = apiError(e);
    step.value = 'upload';
  }
}

function onFileChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void upload(file);
  (e.target as HTMLInputElement).value = '';
}

function onDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0];
  if (file) void upload(file);
}

async function poll(): Promise<void> {
  try {
    const task = await importsApi.task(taskId.value);
    pollFailures = 0;
    if (task.status === 'RUNNING' || task.status === 'PENDING') {
      schedulePoll();
      return;
    }
    stopPoll();
    if (task.status === 'FAILED' || !task.result) {
      taskError.value = task.error ?? '解析失败';
      step.value = 'upload';
      toast.error(taskError.value);
      return;
    }
    // 进入校对
    form.serialNumber = task.result.serialNumber ?? '';
    form.department = task.result.department ?? '';
    form.handler = task.result.handler ?? '';
    form.requestDate = task.result.requestDate ?? todayString();
    lines.value = task.result.items.map((it) => ({
      itemName: it.itemName,
      quantity: String(it.quantity ?? 1),
      unitPrice: it.unitPrice != null ? String(it.unitPrice) : '',
      purchaseLink: it.purchaseLink ?? '',
      duplicate: null,
    }));
    for (const w of task.result.warnings) toast.info(w);
    suppliers.value = await suppliersApi.list().catch(() => []);
    await checkDuplicates();
    step.value = 'review';
  } catch (e) {
    // 连续失败 5 次（约 8 秒）才判死；单次抖动继续等
    pollFailures += 1;
    if (pollFailures >= 5) {
      stopPoll();
      taskError.value = apiError(e);
      toast.error(taskError.value);
      step.value = 'upload';
    } else {
      schedulePoll();
    }
  }
}

async function checkDuplicates(): Promise<void> {
  const names = lines.value.map((l) => l.itemName.trim()).filter(Boolean);
  if (!form.serialNumber.trim() || !form.handler.trim() || names.length === 0) {
    duplicates.value = [];
    lines.value.forEach((l) => (l.duplicate = null));
    return;
  }
  try {
    duplicates.value = await importsApi.checkDuplicates({
      serialNumber: form.serialNumber.trim(),
      handler: form.handler.trim(),
      itemNames: names,
    });
    lines.value.forEach((l) => {
      l.duplicate = duplicates.value.find((d) => d.itemName === l.itemName.trim()) ?? null;
    });
  } catch {
    // 重复检查失败不阻塞流程
  }
}

const supplierOptions = computed(() => [
  { label: '不指定供应商', value: '' },
  ...suppliers.value.map((s) => ({ label: s.name, value: String(s.id) })),
]);

const dupCount = computed(() => lines.value.filter((l) => l.duplicate).length);

async function confirm(): Promise<void> {
  if (confirming.value) return;
  if (!form.serialNumber.trim() || !form.department.trim() || !form.handler.trim()) {
    toast.error('请补全流水号、部门与经办人');
    return;
  }
  if (lines.value.length === 0) {
    toast.error('至少保留一条物品明细');
    return;
  }
  confirming.value = true;
  try {
    await checkDuplicates();
    result.value = await importsApi.confirm({
      serialNumber: form.serialNumber.trim(),
      department: form.department.trim(),
      handler: form.handler.trim(),
      requestDate: form.requestDate,
      supplierId: form.supplierId === '' ? null : Number(form.supplierId),
      items: lines.value.map((l) => ({
        itemName: l.itemName.trim(),
        quantity: Number(l.quantity) || 1,
        unitPrice: l.unitPrice === '' ? undefined : Number(l.unitPrice),
        purchaseLink: l.purchaseLink.trim() || undefined,
      })),
    });
    step.value = 'done';
    toast.success('导入完成');
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    confirming.value = false;
  }
}

function reset(): void {
  step.value = 'upload';
  lines.value = [];
  duplicates.value = [];
  taskError.value = '';
}

const MODE_LABELS: Record<string, string> = {
  PDF_TEXT: 'PDF 文本层解析',
  PDF_OCR: 'PDF OCR 识别',
  IMAGE_OCR: '图片 OCR 识别',
  PDF_MIXED: 'PDF 文本 + OCR 混合',
  TEXT: '文本解析',
};
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-5">
    <!-- 步骤指示 -->
    <ol class="flex items-center gap-2 text-xs" aria-label="导入步骤">
      <li v-for="(s, i) in ['上传单据', '解析', '校对确认', '完成']" :key="s" class="flex items-center gap-2">
        <span
          class="flex items-center justify-center size-5 rounded-full border text-[11px] font-bold num"
          :class="(['upload','parsing','review','done'] as Step[]).indexOf(step) >= i
            ? 'bg-primary text-white border-primary'
            : 'bg-surface text-faint border-line-strong'"
        >{{ i + 1 }}</span>
        <span :class="(['upload','parsing','review','done'] as Step[]).indexOf(step) >= i ? 'text-ink font-semibold' : 'text-faint'">{{ s }}</span>
        <Icon v-if="i < 3" name="chevron-right" :size="12" class="text-line-strong" />
      </li>
    </ol>

    <!-- 1. 上传 -->
    <div v-if="step === 'upload'" class="card p-6">
      <div
        class="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-line-strong rounded-(--radius-card) text-center cursor-pointer hover:border-primary/60 hover:bg-primary-soft/30 transition-colors"
        role="button"
        tabindex="0"
        aria-label="选择或拖拽上传 OA 单据"
        @click="fileInput?.click()"
        @keydown.enter="fileInput?.click()"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <div class="flex items-center justify-center size-14 rounded-2xl bg-canvas border border-line text-ink">
          <Icon name="upload" :size="22" />
        </div>
        <div>
          <p class="text-sm font-semibold text-ink">点击选择，或把 OA 单据拖到这里</p>
          <p class="mt-1 text-xs text-faint">支持 PDF / PNG / JPG，最大 30MB</p>
        </div>
      </div>

      <!-- 手机拍照直传 -->
      <label class="mt-4 flex sm:hidden items-center justify-center gap-2 h-11 rounded-(--radius-control) bg-ink text-white text-sm font-medium cursor-pointer active:bg-ink-soft">
        <Icon name="camera" :size="16" /> 拍照上传 OA 审批单
        <input type="file" accept="image/*" capture="environment" class="hidden" @change="onFileChange" />
      </label>
      <input ref="fileInput" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp" class="hidden" @change="onFileChange" />

      <p v-if="taskError" class="mt-4 text-xs text-red text-center">{{ taskError }}</p>

      <div class="mt-6 pt-4 border-t border-line text-xs text-faint leading-relaxed">
        <p class="font-semibold text-muted mb-1">解析说明</p>
        <p>PDF 优先读取文本层；截图/扫描件自动走本地 PaddleOCR（首次解析需加载模型，稍慢）。识别结果可逐项校对后入库，与已有台账重复的行会提示跳过。</p>
      </div>
    </div>

    <!-- 2. 解析中 -->
    <div v-else-if="step === 'parsing'" class="card p-10 flex flex-col items-center gap-3">
      <span class="size-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
      <p class="text-sm font-semibold text-ink">正在解析单据…</p>
      <p class="text-xs text-faint">本地 OCR 解析中，请勿关闭页面</p>
    </div>

    <!-- 3. 校对 -->
    <template v-else-if="step === 'review'">
      <div class="card p-5">
        <h2 class="text-sm font-bold text-ink mb-3.5">单据信息</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input v-model="form.serialNumber" label="流水号" required @blur="checkDuplicates" />
          <Input v-model="form.requestDate" label="申请日期" type="date" required />
          <Input v-model="form.department" label="申领部门" required />
          <Input v-model="form.handler" label="经办人" required @blur="checkDuplicates" />
          <Select v-model="form.supplierId" label="统一指定供应商（可空）" :options="supplierOptions" clearable class="sm:col-span-2" />
        </div>
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between mb-3.5">
          <h2 class="text-sm font-bold text-ink">物品明细（{{ lines.length }} 条）</h2>
          <Button size="sm" variant="ghost" @click="lines.push({ itemName: '', quantity: '1', unitPrice: '', purchaseLink: '', duplicate: null })">
            <Icon name="plus" :size="13" /> 添加一行
          </Button>
        </div>

        <EmptyState v-if="lines.length === 0" icon="file" title="没有识别到物品" description="手动添加明细，或重新上传更清晰的单据" />

        <div v-else class="space-y-2">
          <div
            v-for="(line, i) in lines"
            :key="i"
            class="p-3 border rounded-(--radius-control) grid grid-cols-12 gap-2 items-center"
            :class="line.duplicate ? 'bg-amber-soft/60 border-amber/30' : 'bg-canvas/60 border-line'"
          >
            <div class="col-span-12 sm:col-span-5">
              <input v-model="line.itemName" placeholder="品名" class="w-full h-9 px-2.5 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none" @change="checkDuplicates" />
            </div>
            <div class="col-span-3 sm:col-span-2">
              <input v-model="line.quantity" type="number" min="0" step="any" placeholder="数量" class="w-full h-9 px-2.5 text-sm num bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none" />
            </div>
            <div class="col-span-4 sm:col-span-2">
              <input v-model="line.unitPrice" type="number" min="0" step="any" placeholder="单价" class="w-full h-9 px-2.5 text-sm num bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none" />
            </div>
            <div class="col-span-4 sm:col-span-2 flex justify-end">
              <button class="p-2 text-faint hover:text-red cursor-pointer" :aria-label="`删除第 ${i + 1} 行`" @click="lines.splice(i, 1)">
                <Icon name="close" :size="14" />
              </button>
            </div>
            <div v-if="line.purchaseLink || line.duplicate" class="col-span-12 flex items-center gap-2 flex-wrap">
              <a v-if="line.purchaseLink" :href="line.purchaseLink" target="_blank" rel="noopener" class="text-[11px] text-primary hover:underline truncate max-w-72">{{ line.purchaseLink }}</a>
              <Badge v-if="line.duplicate" tone="amber">与台账 #{{ line.duplicate.matchedId }} 重复（存量 ×{{ line.duplicate.matchedQuantity }}）</Badge>
            </div>
          </div>
        </div>

        <p v-if="dupCount > 0" class="mt-3 text-xs text-amber">
          {{ dupCount }} 条与已有台账重复，确认入库时将自动跳过。
        </p>

        <div class="mt-5 flex justify-end gap-2">
          <Button variant="ghost" @click="reset">放弃导入</Button>
          <Button variant="primary" :loading="confirming" @click="confirm">
            确认入库{{ dupCount > 0 ? `（跳过 ${dupCount} 条重复）` : '' }}
          </Button>
        </div>
      </div>
    </template>

    <!-- 4. 完成 -->
    <div v-else class="card p-8 flex flex-col items-center gap-3 text-center">
      <div class="flex items-center justify-center size-14 rounded-full bg-teal-soft text-teal border border-teal/25">
        <Icon name="check" :size="24" />
      </div>
      <h2 class="text-base font-bold text-ink">导入完成</h2>
      <p class="text-sm text-muted">
        新建 <b class="num text-ink">{{ result.created }}</b> 条 · 跳过重复 <b class="num text-ink">{{ result.skipped }}</b> 条
      </p>
      <div class="mt-3 flex gap-2">
        <Button variant="primary" @click="router.push('/ledger')">查看台账</Button>
        <Button variant="secondary" @click="reset">继续导入下一单</Button>
      </div>
    </div>
  </div>
</template>

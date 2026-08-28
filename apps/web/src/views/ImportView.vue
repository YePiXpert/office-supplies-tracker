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
import { importsApi } from '@/api';
import { useToastStore } from '@/stores/toast';
import { useCatalogStore } from '@/stores/catalog';
import { apiError } from '@/api/client';
import { formatBytes, formatCurrency } from '@/utils/format';
import type { DuplicatePreview } from '@procure-lite/shared';

type Step = 'upload' | 'parsing' | 'review' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: '上传单据' },
  { key: 'parsing', label: '解析' },
  { key: 'review', label: '校对确认' },
  { key: 'done', label: '完成' },
];

const ACCEPT_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp'];
const MAX_UPLOAD_MB = 30;
/** 解析超过这个时长就不再干等，给用户明确的退出口 */
const PARSE_TIMEOUT_MS = 5 * 60_000;

const toast = useToastStore();
const catalog = useCatalogStore();
const router = useRouter();

const step = ref<Step>('upload');
const taskId = ref('');
const taskError = ref('');
const duplicates = ref<DuplicatePreview[]>([]);
const result = ref({ created: 0, merged: 0, skipped: 0, attached: 0 });
const confirming = ref(false);
const dragging = ref(false);
const uploadedName = ref('');
const elapsed = ref(0);

const form = reactive({
  serialNumber: '',
  department: '',
  handler: '',
  requestDate: todayString(),
  supplierId: '',
});
const errors = reactive<Record<string, string>>({});

interface DraftLine {
  itemName: string;
  quantity: string;
  unitPrice: string;
  purchaseLink: string;
  duplicate: DuplicatePreview | null;
  /** 命中重复时的处理方式，默认跳过 */
  action: 'skip' | 'merge';
}
const lines = ref<DraftLine[]>([]);

const fileInput = ref<HTMLInputElement | null>(null);

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let elapsedTimer: ReturnType<typeof setInterval> | null = null;
let pollFailures = 0;
let startedAt = 0;

onUnmounted(() => stopPoll());

function stopPoll(): void {
  if (pollTimer) clearTimeout(pollTimer);
  if (elapsedTimer) clearInterval(elapsedTimer);
  pollTimer = null;
  elapsedTimer = null;
  pollFailures = 0;
}

/** 递归 setTimeout：上一次响应回来后才排下一次，天然避免重叠轮询 */
function schedulePoll(): void {
  pollTimer = setTimeout(() => void poll(), 1500);
}

/** 上传前先在本地挡一道：类型和大小的失败没必要跑一趟服务端 */
function validateFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ACCEPT_EXTS.includes(ext)) {
    return `不支持的文件类型 ${ext || '（无扩展名）'}，请上传 PDF 或图片`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `文件 ${formatBytes(file.size)}，超过 ${MAX_UPLOAD_MB}MB 上限`;
  }
  if (file.size === 0) return '文件是空的';
  return null;
}

async function upload(file: File): Promise<void> {
  const problem = validateFile(file);
  if (problem) {
    taskError.value = problem;
    toast.error(problem);
    return;
  }
  stopPoll(); // 防御：清掉可能残留的旧轮询
  uploadedName.value = file.name;
  step.value = 'parsing';
  taskError.value = '';
  elapsed.value = 0;
  startedAt = Date.now();
  elapsedTimer = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - startedAt) / 1000);
  }, 1000);
  try {
    const { taskId: id } = await importsApi.upload(file);
    taskId.value = id;
    schedulePoll();
  } catch (e) {
    stopPoll();
    taskError.value = apiError(e);
    step.value = 'upload';
  }
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void upload(file);
  input.value = '';
}

function onDrop(e: DragEvent): void {
  dragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void upload(file);
}

function cancelParsing(): void {
  stopPoll();
  step.value = 'upload';
  taskError.value = '已取消等待。解析仍在后台进行，可稍后重新上传或直接手工录入。';
}

async function poll(): Promise<void> {
  if (Date.now() - startedAt > PARSE_TIMEOUT_MS) {
    stopPoll();
    taskError.value = '解析超时（超过 5 分钟）。可能是文件过大或 OCR 服务异常，请检查系统设置里的 OCR 状态。';
    step.value = 'upload';
    toast.error(taskError.value);
    return;
  }
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
      action: 'skip',
    }));
    if (task.result.warnings.length > 0) {
      // 逐条弹会糊满屏幕，合成一条
      toast.info(
        task.result.warnings.length === 1
          ? task.result.warnings[0]
          : `解析有 ${task.result.warnings.length} 处提示：${task.result.warnings.join('；')}`,
      );
    }
    await catalog.ensureSuppliers().catch(() => []);
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
  ...catalog.suppliers.map((s) => ({ label: s.name, value: String(s.id) })),
]);

const dupLines = computed(() => lines.value.filter((l) => l.duplicate));
const skipCount = computed(() => dupLines.value.filter((l) => l.action === 'skip').length);
const mergeCount = computed(() => dupLines.value.filter((l) => l.action === 'merge').length);
const newCount = computed(() => lines.value.length - dupLines.value.length);

function setAllDuplicateActions(action: 'skip' | 'merge'): void {
  dupLines.value.forEach((l) => (l.action = action));
}

function addLine(): void {
  lines.value.push({ itemName: '', quantity: '1', unitPrice: '', purchaseLink: '', duplicate: null, action: 'skip' });
}

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k]);
  if (!form.serialNumber.trim()) errors.serialNumber = '请填写流水号';
  if (!form.department.trim()) errors.department = '请填写申领部门';
  if (!form.handler.trim()) errors.handler = '请填写经办人';
  if (!form.requestDate) errors.requestDate = '请选择申请日期';
  if (lines.value.length === 0) {
    toast.error('至少保留一条物品明细');
    return false;
  }
  const badLine = lines.value.findIndex((l) => !l.itemName.trim() || !(Number(l.quantity) > 0));
  if (badLine >= 0) {
    toast.error(`第 ${badLine + 1} 行的品名或数量不完整`);
    return false;
  }
  return Object.keys(errors).length === 0;
}

async function confirm(): Promise<void> {
  if (confirming.value) return;
  if (!validate()) return;
  confirming.value = true;
  try {
    await checkDuplicates(); // 提交前再核一次，避免期间别处已经录入
    result.value = await importsApi.confirm({
      taskId: taskId.value || undefined,
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
        duplicateAction: l.duplicate ? l.action : undefined,
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
  stopPoll();
  step.value = 'upload';
  lines.value = [];
  duplicates.value = [];
  taskError.value = '';
  taskId.value = '';
  uploadedName.value = '';
  Object.keys(errors).forEach((k) => delete errors[k]);
}

const currentStepIndex = computed(() => STEPS.findIndex((s) => s.key === step.value));
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-5">
    <!-- 步骤指示 -->
    <ol class="flex items-center gap-2 text-xs" aria-label="导入步骤">
      <li v-for="(s, i) in STEPS" :key="s.key" class="flex items-center gap-2">
        <span
          class="flex items-center justify-center size-5 rounded-full border text-meta font-bold num"
          :class="currentStepIndex >= i ? 'bg-primary text-white border-primary' : 'bg-surface text-faint border-line-strong'"
        >{{ i + 1 }}</span>
        <span :class="currentStepIndex >= i ? 'text-ink font-semibold' : 'text-faint'">{{ s.label }}</span>
        <Icon v-if="i < STEPS.length - 1" name="chevron-right" :size="12" class="text-line-strong" />
      </li>
    </ol>

    <!-- 1. 上传 -->
    <div v-if="step === 'upload'" class="card p-6">
      <div
        class="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed rounded-(--radius-card) text-center cursor-pointer transition-colors"
        :class="dragging ? 'border-primary bg-primary-soft' : 'border-line-strong hover:border-primary/60 hover:bg-primary-soft/30'"
        role="button"
        tabindex="0"
        aria-label="选择或拖拽上传 OA 单据"
        @click="fileInput?.click()"
        @keydown.enter.prevent="fileInput?.click()"
        @keydown.space.prevent="fileInput?.click()"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="flex items-center justify-center size-14 rounded-2xl bg-canvas border border-line text-ink">
          <Icon name="upload" :size="22" />
        </div>
        <div>
          <p class="text-sm font-semibold text-ink">{{ dragging ? '松开即可上传' : '点击选择，或把 OA 单据拖到这里' }}</p>
          <p class="mt-1 text-xs text-faint">支持 PDF / PNG / JPG / WebP，最大 {{ MAX_UPLOAD_MB }}MB</p>
        </div>
      </div>

      <!-- 手机拍照直传 -->
      <label class="mt-4 flex sm:hidden items-center justify-center gap-2 h-11 rounded-(--radius-control) bg-ink text-white text-sm font-medium cursor-pointer active:bg-ink-soft">
        <Icon name="camera" :size="16" /> 拍照上传 OA 审批单
        <input type="file" accept="image/*" capture="environment" class="hidden" @change="onFileChange" />
      </label>
      <input ref="fileInput" type="file" :accept="ACCEPT_EXTS.join(',')" class="hidden" @change="onFileChange" />

      <p v-if="taskError" class="mt-4 flex items-start justify-center gap-1.5 text-xs text-red text-center">
        <Icon name="alert" :size="13" class="mt-px shrink-0" />{{ taskError }}
      </p>

      <div class="mt-6 pt-4 border-t border-line text-xs text-faint leading-relaxed">
        <p class="font-semibold text-muted mb-1">解析说明</p>
        <p>PDF 优先读取文本层；截图/扫描件自动走本地 PaddleOCR（首次解析需加载模型，稍慢）。识别结果可逐项校对后入库，与已有台账重复的行可以选择跳过或把数量合并进去。入库后原始单据会作为附件留在每条台账上，随时可以回看。</p>
      </div>
    </div>

    <!-- 2. 解析中 -->
    <div v-else-if="step === 'parsing'" class="card p-10 flex flex-col items-center gap-3">
      <span class="size-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
      <p class="text-sm font-semibold text-ink">正在解析单据…</p>
      <p class="text-xs text-faint truncate max-w-full">{{ uploadedName }}</p>
      <p class="text-xs text-faint num">已用时 {{ elapsed }} 秒{{ elapsed > 25 ? '（首次解析要加载 OCR 模型，请再等等）' : '' }}</p>
      <Button variant="ghost" size="sm" class="mt-1" @click="cancelParsing">取消等待</Button>
    </div>

    <!-- 3. 校对 -->
    <template v-else-if="step === 'review'">
      <div class="card p-5">
        <h2 class="text-sm font-bold text-ink mb-3.5">单据信息</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input v-model="form.serialNumber" label="流水号" required :error="errors.serialNumber" @blur="checkDuplicates" />
          <Input v-model="form.requestDate" label="申请日期" type="date" required :error="errors.requestDate" />
          <Input v-model="form.department" label="申领部门" required :error="errors.department" />
          <Input v-model="form.handler" label="经办人" required :error="errors.handler" @blur="checkDuplicates" />
          <Select v-model="form.supplierId" label="统一指定供应商（可空）" :options="supplierOptions" clearable class="sm:col-span-2" />
        </div>
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between mb-3.5">
          <h2 class="text-sm font-bold text-ink">物品明细（{{ lines.length }} 条）</h2>
          <Button size="sm" variant="ghost" @click="addLine">
            <Icon name="plus" :size="13" /> 添加一行
          </Button>
        </div>

        <!-- 重复项的统一处置 -->
        <div v-if="dupLines.length > 0" class="mb-3 p-3 bg-amber-soft/60 border border-amber/30 rounded-(--radius-control)">
          <p class="text-xs text-amber font-semibold">
            {{ dupLines.length }} 条与已有台账重复（同流水号 + 经办人 + 品名）
          </p>
          <p class="mt-1 text-meta text-muted">
            跳过 = 保持原记录不动；合并 = 把这次的数量加到原记录上（适合补录、追加采购）。
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button class="h-7 px-2.5 text-xs rounded-md border border-line-strong bg-surface cursor-pointer hover:border-primary hover:text-primary" @click="setAllDuplicateActions('skip')">
              全部跳过
            </button>
            <button class="h-7 px-2.5 text-xs rounded-md border border-line-strong bg-surface cursor-pointer hover:border-primary hover:text-primary" @click="setAllDuplicateActions('merge')">
              全部合并数量
            </button>
          </div>
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
              <Input v-model="line.itemName" placeholder="品名" @blur="checkDuplicates" />
            </div>
            <div class="col-span-3 sm:col-span-2">
              <Input v-model="line.quantity" type="number" min="0" step="any" placeholder="数量" />
            </div>
            <div class="col-span-4 sm:col-span-2">
              <Input v-model="line.unitPrice" type="number" min="0" step="any" placeholder="单价" />
            </div>
            <div class="col-span-2 sm:col-span-2 text-right text-xs num text-muted">
              {{ line.unitPrice && line.quantity ? formatCurrency(Number(line.unitPrice) * Number(line.quantity)) : '' }}
            </div>
            <div class="col-span-3 sm:col-span-1 flex justify-end">
              <button class="p-2 text-faint hover:text-red cursor-pointer" :aria-label="`删除第 ${i + 1} 行`" @click="lines.splice(i, 1)">
                <Icon name="close" :size="14" />
              </button>
            </div>

            <div v-if="line.purchaseLink || line.duplicate" class="col-span-12 flex items-center gap-2 flex-wrap">
              <a v-if="line.purchaseLink" :href="line.purchaseLink" target="_blank" rel="noopener" class="text-meta text-primary hover:underline truncate max-w-72">{{ line.purchaseLink }}</a>
              <template v-if="line.duplicate">
                <Badge tone="amber">台账 #{{ line.duplicate.matchedId }} 已有 ×{{ line.duplicate.matchedQuantity }}</Badge>
                <div class="inline-flex rounded-md border border-line-strong overflow-hidden text-meta">
                  <button
                    class="h-6 px-2 cursor-pointer transition-colors"
                    :class="line.action === 'skip' ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-primary'"
                    @click="line.action = 'skip'"
                  >
                    跳过
                  </button>
                  <button
                    class="h-6 px-2 cursor-pointer transition-colors border-l border-line-strong"
                    :class="line.action === 'merge' ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-primary'"
                    @click="line.action = 'merge'"
                  >
                    合并（→ {{ line.duplicate.matchedQuantity + (Number(line.quantity) || 0) }}）
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-end gap-2">
          <p class="mr-auto text-xs text-muted">
            将新建 <b class="text-ink num">{{ newCount }}</b> 条
            <template v-if="mergeCount > 0"> · 合并 <b class="text-ink num">{{ mergeCount }}</b> 条</template>
            <template v-if="skipCount > 0"> · 跳过 <b class="text-ink num">{{ skipCount }}</b> 条</template>
          </p>
          <Button variant="ghost" @click="reset">放弃导入</Button>
          <Button variant="primary" :loading="confirming" @click="confirm">确认入库</Button>
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
        新建 <b class="num text-ink">{{ result.created }}</b> 条
        <template v-if="result.merged > 0"> · 合并数量 <b class="num text-ink">{{ result.merged }}</b> 条</template>
        <template v-if="result.skipped > 0"> · 跳过重复 <b class="num text-ink">{{ result.skipped }}</b> 条</template>
      </p>
      <p v-if="result.attached > 0" class="text-xs text-faint">
        OA 原件已作为附件保存在这 {{ result.attached }} 条记录上
      </p>
      <div class="mt-3 flex gap-2">
        <Button variant="primary" @click="router.push('/ledger')">查看台账</Button>
        <Button variant="secondary" @click="router.push('/kanban')">去看板下单</Button>
        <Button variant="ghost" @click="reset">继续导入下一单</Button>
      </div>
    </div>
  </div>
</template>

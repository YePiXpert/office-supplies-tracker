<script setup lang="ts">
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Dialog from '@/components/ui/Dialog.vue';
import { systemApi, downloadFile, http, type BackupInfo, type SystemStatus } from '@/api';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { apiError } from '@/api/client';
import { formatBytes } from '@/utils/format';

const toast = useToastStore();
const auth = useAuthStore();
const router = useRouter();

const status = ref<SystemStatus | null>(null);
const ocrOk = ref<boolean | null>(null);
const ocrChecking = ref(false);
const backups = ref<BackupInfo[]>([]);
const loading = ref(true);
const loadError = ref('');

/* 账号 */
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirm: '' });
const passwordErrors = reactive<Record<string, string>>({});
const recoveryPassword = ref('');
const recoveryCodeIssued = ref('');
const recoveryDialogOpen = ref(false);
const changing = ref(false);
const copied = ref(false);

/* 自动备份 */
const backupForm = reactive({ enabled: false, intervalHours: '24', keepCount: '7' });
const backupErrors = reactive<Record<string, string>>({});
const backupSaving = ref(false);

/* 备份操作 */
const creating = ref(false);
const restoring = ref(false);
const restoreTarget = ref<BackupInfo | null>(null);
const deleteBackupTarget = ref<BackupInfo | null>(null);
const downloadingBackup = ref('');

async function load(): Promise<void> {
  loading.value = status.value === null;
  try {
    const s = await systemApi.status();
    status.value = s;
    Object.assign(backupForm, {
      enabled: s.autoBackup.enabled,
      intervalHours: String(s.autoBackup.intervalHours),
      keepCount: String(s.autoBackup.keepCount),
    });
    loadError.value = '';
    backups.value = await systemApi.backups().catch(() => []);
    ocrOk.value = await systemApi.ocrHealth();
  } catch (e) {
    loadError.value = apiError(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function recheckOcr(): Promise<void> {
  ocrChecking.value = true;
  ocrOk.value = await systemApi.ocrHealth();
  ocrChecking.value = false;
  toast.info(ocrOk.value ? 'OCR 服务正常' : 'OCR 服务仍不可用，检查容器是否在运行');
}

/* --------------------------------- 账号 --------------------------------- */

function validatePassword(): boolean {
  Object.keys(passwordErrors).forEach((k) => delete passwordErrors[k]);
  if (!passwordForm.currentPassword) passwordErrors.currentPassword = '请输入当前密码';
  if (passwordForm.newPassword.length < 8) passwordErrors.newPassword = '新密码至少 8 位';
  else if (passwordForm.newPassword === passwordForm.currentPassword) {
    passwordErrors.newPassword = '新密码不能与当前密码相同';
  }
  if (passwordForm.newPassword !== passwordForm.confirm) passwordErrors.confirm = '两次输入的新密码不一致';
  return Object.keys(passwordErrors).length === 0;
}

async function changePassword(): Promise<void> {
  if (!validatePassword()) return;
  changing.value = true;
  try {
    await http.post('/auth/change-password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
    passwordForm.currentPassword = passwordForm.newPassword = passwordForm.confirm = '';
    // 服务端改密后会递增 sessionEpoch 踢掉所有会话（含当前这个），
    // 不主动跳转的话用户下一次点任何东西都会莫名其妙被弹回登录页
    toast.success('密码已修改，所有登录会话已失效，请用新密码重新登录');
    auth.loggedIn = false;
    setTimeout(() => void router.push('/login'), 900);
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    changing.value = false;
  }
}

async function regenerateRecovery(): Promise<void> {
  if (!recoveryPassword.value) {
    toast.error('请输入当前密码');
    return;
  }
  changing.value = true;
  try {
    const res = await http.post<{ recoveryCode: string }>('/auth/recovery-code', {
      password: recoveryPassword.value,
    });
    recoveryCodeIssued.value = res.data.recoveryCode;
    copied.value = false;
    recoveryDialogOpen.value = false;
    recoveryPassword.value = '';
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    changing.value = false;
  }
}

async function copyRecoveryCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(recoveryCodeIssued.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    toast.info('复制失败，请手动选中文本复制');
  }
}

/* -------------------------------- 自动备份 -------------------------------- */

function validateBackup(): boolean {
  Object.keys(backupErrors).forEach((k) => delete backupErrors[k]);
  const interval = Number(backupForm.intervalHours);
  const keep = Number(backupForm.keepCount);
  if (!Number.isInteger(interval) || interval < 1 || interval > 720) {
    backupErrors.intervalHours = '间隔需为 1–720 的整数小时';
  }
  if (!Number.isInteger(keep) || keep < 1 || keep > 100) {
    backupErrors.keepCount = '保留份数需为 1–100 的整数';
  }
  return Object.keys(backupErrors).length === 0;
}

async function saveBackupConfig(): Promise<void> {
  if (!validateBackup()) return;
  backupSaving.value = true;
  try {
    await systemApi.updateAutoBackup({
      enabled: backupForm.enabled,
      intervalHours: Number(backupForm.intervalHours),
      keepCount: Number(backupForm.keepCount),
    });
    toast.success('自动备份配置已保存');
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    backupSaving.value = false;
  }
}

async function createBackup(): Promise<void> {
  creating.value = true;
  try {
    await systemApi.createBackup();
    toast.success('备份已创建');
    backups.value = await systemApi.backups();
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    creating.value = false;
  }
}

async function restore(): Promise<void> {
  if (!restoreTarget.value) return;
  const name = restoreTarget.value.name;
  restoreTarget.value = null;
  restoring.value = true;
  try {
    await systemApi.restoreBackup(name);
    toast.success('恢复完成，页面即将刷新');
    setTimeout(() => window.location.reload(), 1200);
  } catch (e) {
    restoring.value = false;
    toast.error(apiError(e));
  }
}

async function removeBackup(): Promise<void> {
  if (!deleteBackupTarget.value) return;
  try {
    await systemApi.deleteBackup(deleteBackupTarget.value.name);
    toast.success('备份已删除');
    deleteBackupTarget.value = null;
    backups.value = await systemApi.backups();
  } catch (e) {
    toast.error(apiError(e));
  }
}

/** 走带 Cookie 的 XHR，会话过期时能给出提示，而不是新开一个显示 401 JSON 的空标签页 */
async function download(backup: BackupInfo): Promise<void> {
  downloadingBackup.value = backup.name;
  try {
    await downloadFile(`/system/backups/${encodeURIComponent(backup.name)}/download`, backup.name);
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    downloadingBackup.value = '';
  }
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时`;
}

async function logout(): Promise<void> {
  await auth.logout();
  void router.push('/login');
}

const totalBackupSize = computed(() => backups.value.reduce((sum, b) => sum + b.sizeBytes, 0));
</script>

<template>
  <div v-if="loading" class="py-16 text-center text-sm text-faint">加载中…</div>
  <ErrorState v-else-if="loadError && !status" :message="loadError" @retry="load" />

  <div v-else class="grid lg:grid-cols-2 gap-5 items-start">
    <!-- 账号安全 -->
    <section class="card p-5">
      <h2 class="text-sm font-bold text-ink mb-1">账号安全</h2>
      <p class="text-xs text-faint mb-4">单管理员模式，会话 30 分钟无操作自动过期</p>
      <div class="space-y-3 max-w-sm">
        <Input
          v-model="passwordForm.currentPassword"
          type="password"
          label="当前密码"
          autocomplete="current-password"
          :error="passwordErrors.currentPassword"
        />
        <Input
          v-model="passwordForm.newPassword"
          type="password"
          label="新密码"
          placeholder="至少 8 位"
          autocomplete="new-password"
          :error="passwordErrors.newPassword"
        />
        <Input
          v-model="passwordForm.confirm"
          type="password"
          label="确认新密码"
          autocomplete="new-password"
          :error="passwordErrors.confirm"
        />
        <p class="text-meta text-faint">修改密码会让所有已登录会话失效，你需要用新密码重新登录。</p>
        <div class="flex gap-2 pt-1">
          <Button variant="primary" size="sm" :loading="changing" @click="changePassword">修改密码</Button>
          <Button variant="secondary" size="sm" @click="recoveryDialogOpen = true">
            <Icon name="key" :size="13" /> 重置恢复码
          </Button>
        </div>
      </div>
      <div class="mt-5 pt-4 border-t border-line">
        <Button variant="ghost" size="sm" @click="logout"><Icon name="logout" :size="13" /> 退出登录</Button>
      </div>
    </section>

    <!-- 系统状态 -->
    <section class="card p-5">
      <div class="flex items-center justify-between mb-3.5">
        <h2 class="text-sm font-bold text-ink">系统状态</h2>
        <Button variant="ghost" size="sm" @click="load">
          <Icon name="refresh" :size="13" /> 刷新
        </Button>
      </div>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><dt class="text-xs text-faint">版本</dt><dd class="num">v{{ status?.version }}</dd></div>
        <div><dt class="text-xs text-faint">运行时长</dt><dd>{{ fmtUptime(status?.uptimeSeconds ?? 0) }}</dd></div>
        <div><dt class="text-xs text-faint">数据库大小</dt><dd class="num">{{ formatBytes(status?.dbSizeBytes ?? 0) }}</dd></div>
        <div>
          <dt class="text-xs text-faint">OCR 解析服务</dt>
          <dd class="flex items-center gap-2">
            <Badge :tone="ocrOk ? 'teal' : 'red'">{{ ocrOk ? '正常' : '不可用' }}</Badge>
            <button
              class="text-meta text-primary hover:underline cursor-pointer"
              :disabled="ocrChecking"
              @click="recheckOcr"
            >
              {{ ocrChecking ? '检测中…' : '重测' }}
            </button>
          </dd>
        </div>
        <div><dt class="text-xs text-faint">台账记录</dt><dd class="num">{{ status?.counts.items }}</dd></div>
        <div><dt class="text-xs text-faint">物品 / 发放单</dt><dd class="num">{{ status?.counts.products }} / {{ status?.counts.distributions }}</dd></div>
      </dl>
      <p v-if="ocrOk === false" class="mt-3 px-3 py-2 bg-amber-soft border border-amber/25 rounded-(--radius-control) text-xs text-amber">
        OCR 不可用时导入页仍能打开，但上传后会解析失败。可以先手工新增台账记录。
      </p>
    </section>

    <!-- 自动备份 -->
    <section class="card p-5">
      <h2 class="text-sm font-bold text-ink mb-1">自动备份</h2>
      <p class="text-xs text-faint mb-4">定期打包数据库与附件，保留最近 N 份</p>
      <div class="flex flex-wrap items-start gap-3 max-w-md">
        <label class="flex items-center gap-2 text-sm mt-7 cursor-pointer select-none">
          <input v-model="backupForm.enabled" type="checkbox" class="size-4 accent-[#2563EB]" />
          启用
        </label>
        <Input
          v-model="backupForm.intervalHours"
          label="间隔（小时）"
          type="number"
          min="1"
          max="720"
          class="w-32"
          :error="backupErrors.intervalHours"
        />
        <Input
          v-model="backupForm.keepCount"
          label="保留份数"
          type="number"
          min="1"
          max="100"
          class="w-28"
          :error="backupErrors.keepCount"
        />
        <Button variant="primary" size="sm" class="mt-7" :loading="backupSaving" @click="saveBackupConfig">保存</Button>
      </div>
    </section>

    <!-- 备份管理 -->
    <section class="card p-5">
      <div class="flex items-center justify-between mb-3.5">
        <div>
          <h2 class="text-sm font-bold text-ink">备份管理</h2>
          <p class="text-xs text-faint">恢复会覆盖当前数据库与附件，操作前请先创建备份</p>
        </div>
        <Button variant="primary" size="sm" :loading="creating" @click="createBackup">
          <Icon name="plus" :size="13" /> 立即备份
        </Button>
      </div>
      <p v-if="backups.length === 0" class="text-xs text-faint">还没有备份</p>
      <template v-else>
        <p class="mb-2 text-meta text-faint">{{ backups.length }} 份 · 共 {{ formatBytes(totalBackupSize) }}</p>
        <ul class="divide-y divide-line max-h-72 overflow-y-auto">
          <li v-for="b in backups" :key="b.name" class="flex items-center gap-3 py-2.5">
            <Icon name="file" :size="15" class="text-faint shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-xs num truncate" :title="b.name">{{ b.name }}</p>
              <p class="text-meta text-faint">{{ formatDateTime(b.createdAt) }} · {{ formatBytes(b.sizeBytes) }}</p>
            </div>
            <button
              class="text-xs text-primary hover:underline cursor-pointer shrink-0 disabled:opacity-50"
              :disabled="downloadingBackup === b.name"
              @click="download(b)"
            >
              {{ downloadingBackup === b.name ? '下载中…' : '下载' }}
            </button>
            <button class="text-xs text-amber hover:underline cursor-pointer shrink-0" @click="restoreTarget = b">恢复</button>
            <button class="text-xs text-red hover:underline cursor-pointer shrink-0" @click="deleteBackupTarget = b">删除</button>
          </li>
        </ul>
      </template>
    </section>

    <!-- 恢复中：全屏挡住，避免用户在数据被覆盖的过程中继续操作 -->
    <div v-if="restoring" class="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-ink/70 backdrop-blur-sm text-white">
      <span class="size-8 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
      <p class="text-sm font-semibold">正在恢复备份…</p>
      <p class="text-xs text-white/70">服务短暂不可用，请不要关闭页面</p>
    </div>

    <!-- 恢复码结果 -->
    <Dialog :open="!!recoveryCodeIssued" title="新的恢复码" width="420px" persistent @update:open="() => undefined">
      <p class="text-sm text-muted">请立即保存，只显示这一次：</p>
      <p class="mt-3 px-4 py-3 bg-canvas border border-line rounded-(--radius-control) text-center font-mono text-base tracking-widest select-all break-all">
        {{ recoveryCodeIssued }}
      </p>
      <Button variant="secondary" size="sm" class="mt-3 w-full" @click="copyRecoveryCode">
        <Icon :name="copied ? 'check' : 'copy'" :size="13" /> {{ copied ? '已复制' : '复制恢复码' }}
      </Button>
      <p class="mt-3 text-xs text-red">关掉这个窗口后无法再次查看，旧恢复码已经失效。</p>
      <template #footer>
        <Button variant="primary" @click="recoveryCodeIssued = ''">我已保存</Button>
      </template>
    </Dialog>

    <!-- 重置恢复码确认 -->
    <Dialog :open="recoveryDialogOpen" title="重置恢复码" width="420px" @update:open="recoveryDialogOpen = $event">
      <p class="text-sm text-muted mb-3">输入当前密码以生成新的恢复码，旧恢复码将失效。</p>
      <Input v-model="recoveryPassword" type="password" label="当前密码" autocomplete="current-password" required @enter="regenerateRecovery" />
      <template #footer>
        <Button variant="ghost" @click="recoveryDialogOpen = false; recoveryPassword = ''">取消</Button>
        <Button variant="primary" :loading="changing" @click="regenerateRecovery">生成</Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="!!restoreTarget"
      title="恢复备份"
      :message="`将用「${restoreTarget?.name}」覆盖当前数据库与附件，当前数据会被替换且无法找回。恢复期间服务短暂不可用。建议先点「立即备份」留一份当前数据。`"
      confirm-text="开始恢复"
      danger
      @update:open="restoreTarget = null"
      @confirm="restore"
    />
    <ConfirmDialog
      :open="!!deleteBackupTarget"
      title="删除备份"
      :message="`「${deleteBackupTarget?.name}」将被永久删除。`"
      confirm-text="删除"
      danger
      @update:open="deleteBackupTarget = null"
      @confirm="removeBackup"
    />
  </div>
</template>

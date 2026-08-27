<script setup lang="ts">
import { formatDateTime } from '@/utils/datetime';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import Badge from '@/components/ui/Badge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import Dialog from '@/components/ui/Dialog.vue';
import { systemApi, http, type BackupInfo, type SystemStatus } from '@/api';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { apiError } from '@/api/client';

const toast = useToastStore();
const auth = useAuthStore();
const router = useRouter();

const status = ref<SystemStatus | null>(null);
const ocrOk = ref<boolean | null>(null);
const backups = ref<BackupInfo[]>([]);
const loading = ref(true);

/* 账号 */
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirm: '' });
const recoveryPassword = ref('');
const recoveryCodeIssued = ref('');
const recoveryDialogOpen = ref(false);
const changing = ref(false);

/* 自动备份 */
const backupForm = reactive({ enabled: false, intervalHours: 24, keepCount: 7 });
const backupSaving = ref(false);

/* 备份操作 */
const creating = ref(false);
const restoreTarget = ref<BackupInfo | null>(null);
const deleteBackupTarget = ref<BackupInfo | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    status.value = await systemApi.status();
    Object.assign(backupForm, status.value.autoBackup);
    backups.value = await systemApi.backups().catch(() => []);
    ocrOk.value = await systemApi.ocrHealth();
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function changePassword(): Promise<void> {
  if (passwordForm.newPassword.length < 8) return toast.error('新密码至少 8 位');
  if (passwordForm.newPassword !== passwordForm.confirm) return toast.error('两次输入的新密码不一致');
  changing.value = true;
  try {
    await http.post('/auth/change-password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
    toast.success('密码已修改');
    passwordForm.currentPassword = passwordForm.newPassword = passwordForm.confirm = '';
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    changing.value = false;
  }
}

async function regenerateRecovery(): Promise<void> {
  changing.value = true;
  try {
    const res = await http.post<{ recoveryCode: string }>('/auth/recovery-code', {
      password: recoveryPassword.value,
    });
    recoveryCodeIssued.value = res.data.recoveryCode;
    recoveryDialogOpen.value = false;
    recoveryPassword.value = '';
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    changing.value = false;
  }
}

async function saveBackupConfig(): Promise<void> {
  backupSaving.value = true;
  try {
    await systemApi.updateAutoBackup({ ...backupForm });
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
  try {
    await systemApi.restoreBackup(restoreTarget.value.name);
    toast.success('恢复完成，页面即将刷新');
    restoreTarget.value = null;
    setTimeout(() => window.location.reload(), 1200);
  } catch (e) {
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

async function download(backup: BackupInfo): Promise<void> {
  window.open(`/api/system/backups/${backup.name}/download`, '_blank');
}

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
function fmtTime(dt: string): string {
  return formatDateTime(dt);
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
</script>

<template>
  <div v-if="loading" class="py-16 text-center text-sm text-faint">加载中…</div>

  <div v-else class="grid lg:grid-cols-2 gap-5 items-start">
    <!-- 账号安全 -->
    <section class="card p-5">
      <h2 class="text-sm font-bold text-ink mb-1">账号安全</h2>
      <p class="text-xs text-faint mb-4">单管理员模式，会话 30 分钟无操作自动过期</p>
      <div class="space-y-3 max-w-sm">
        <Input v-model="passwordForm.currentPassword" type="password" label="当前密码" />
        <Input v-model="passwordForm.newPassword" type="password" label="新密码" placeholder="至少 8 位" />
        <Input v-model="passwordForm.confirm" type="password" label="确认新密码" />
        <div class="flex gap-2 pt-1">
          <Button variant="primary" size="sm" :loading="changing" @click="changePassword">修改密码</Button>
          <Button variant="secondary" size="sm" @click="recoveryDialogOpen = true">重置恢复码</Button>
        </div>
      </div>
      <div class="mt-5 pt-4 border-t border-line">
        <Button variant="ghost" size="sm" @click="logout"><Icon name="logout" :size="13" /> 退出登录</Button>
      </div>
    </section>

    <!-- 系统状态 -->
    <section class="card p-5">
      <h2 class="text-sm font-bold text-ink mb-3.5">系统状态</h2>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><dt class="text-xs text-faint">版本</dt><dd class="num">v{{ status?.version }}</dd></div>
        <div><dt class="text-xs text-faint">运行时长</dt><dd>{{ fmtUptime(status?.uptimeSeconds ?? 0) }}</dd></div>
        <div><dt class="text-xs text-faint">数据库大小</dt><dd class="num">{{ fmtSize(status?.dbSizeBytes ?? 0) }}</dd></div>
        <div><dt class="text-xs text-faint">OCR 解析服务</dt>
          <dd>
            <Badge :tone="ocrOk ? 'teal' : 'red'">{{ ocrOk ? '正常' : '不可用' }}</Badge>
          </dd>
        </div>
        <div><dt class="text-xs text-faint">台账记录</dt><dd class="num">{{ status?.counts.items }}</dd></div>
        <div><dt class="text-xs text-faint">物品 / 发放单</dt><dd class="num">{{ status?.counts.products }} / {{ status?.counts.distributions }}</dd></div>
      </dl>
    </section>

    <!-- 自动备份 -->
    <section class="card p-5">
      <h2 class="text-sm font-bold text-ink mb-1">自动备份</h2>
      <p class="text-xs text-faint mb-4">定期打包数据库与附件，保留最近 N 份</p>
      <div class="flex flex-wrap items-end gap-3 max-w-md">
        <label class="flex items-center gap-2 text-sm mb-1.5 cursor-pointer select-none">
          <input v-model="backupForm.enabled" type="checkbox" class="size-4 accent-[#2563EB]" />
          启用
        </label>
        <Input v-model="backupForm.intervalHours" label="间隔（小时）" type="number" min="1" class="w-28" />
        <Input v-model="backupForm.keepCount" label="保留份数" type="number" min="1" class="w-24" />
        <Button variant="primary" size="sm" :loading="backupSaving" @click="saveBackupConfig">保存</Button>
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
          <Icon name="download" :size="13" /> 立即备份
        </Button>
      </div>
      <p v-if="backups.length === 0" class="text-xs text-faint">还没有备份</p>
      <ul v-else class="divide-y divide-line max-h-72 overflow-y-auto">
        <li v-for="b in backups" :key="b.name" class="flex items-center gap-3 py-2.5">
          <Icon name="file" :size="15" class="text-faint shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-xs num truncate" :title="b.name">{{ b.name }}</p>
            <p class="text-[11px] text-faint">{{ fmtTime(b.createdAt) }} · {{ fmtSize(b.sizeBytes) }}</p>
          </div>
          <button class="text-xs text-primary hover:underline cursor-pointer shrink-0" @click="download(b)">下载</button>
          <button class="text-xs text-amber hover:underline cursor-pointer shrink-0" @click="restoreTarget = b">恢复</button>
          <button class="text-xs text-red hover:underline cursor-pointer shrink-0" @click="deleteBackupTarget = b">删除</button>
        </li>
      </ul>
    </section>

    <!-- 恢复码结果 -->
    <Dialog :open="!!recoveryCodeIssued" title="新的恢复码" width="420px" @update:open="recoveryCodeIssued = ''">
      <p class="text-sm text-muted">请立即保存，只显示这一次：</p>
      <p class="mt-3 px-4 py-3 bg-canvas border border-line rounded-(--radius-control) text-center font-mono text-base tracking-widest select-all">
        {{ recoveryCodeIssued }}
      </p>
      <template #footer>
        <Button variant="primary" @click="recoveryCodeIssued = ''">我已保存</Button>
      </template>
    </Dialog>

    <!-- 重置恢复码确认 -->
    <Dialog :open="recoveryDialogOpen" title="重置恢复码" width="420px" @update:open="recoveryDialogOpen = $event">
      <p class="text-sm text-muted mb-3">输入当前密码以生成新的恢复码，旧恢复码将失效。</p>
      <Input v-model="recoveryPassword" type="password" label="当前密码" required />
      <template #footer>
        <Button variant="ghost" @click="recoveryDialogOpen = false">取消</Button>
        <Button variant="primary" :loading="changing" @click="regenerateRecovery">生成</Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="!!restoreTarget"
      title="恢复备份"
      :message="`将用「${restoreTarget?.name}」覆盖当前数据库与附件，恢复期间服务短暂不可用。确定继续？`"
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

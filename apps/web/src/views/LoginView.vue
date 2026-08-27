<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { apiError } from '@/api/client';

type Mode = 'login' | 'setup' | 'recover';

const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();

const mode = computed<Mode>(() => (!auth.isInitialized ? 'setup' : recoverOpen.value ? 'recover' : 'login'));
const recoverOpen = ref(false);

const password = ref('');
const passwordConfirm = ref('');
const recoveryCode = ref('');
const recoveryCodeIssued = ref('');
const loading = ref(false);

async function submit(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  try {
    if (mode.value === 'setup') {
      if (password.value.length < 8) return toast.error('密码至少 8 位');
      if (password.value !== passwordConfirm.value) return toast.error('两次输入的密码不一致');
      recoveryCodeIssued.value = await auth.setup(password.value);
    } else if (mode.value === 'recover') {
      if (!recoveryCode.value.trim()) return toast.error('请输入恢复码');
      if (password.value.length < 8) return toast.error('新密码至少 8 位');
      await auth.recover(recoveryCode.value.trim(), password.value);
      toast.success('密码已重置，请登录');
      recoverOpen.value = false;
      password.value = '';
    } else {
      await auth.login(password.value);
      toast.success('登录成功');
      const redirect = (route.query.redirect as string) || '/dashboard';
      void router.push(redirect);
    }
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-dvh flex flex-col lg:flex-row">
    <!-- 左侧品牌区 -->
    <div class="lg:w-2/5 bg-ink text-white flex flex-col justify-between p-8 lg:p-12 lg:min-h-dvh">
      <div class="flex items-center gap-2.5">
        <div class="flex items-center justify-center size-8 rounded-lg bg-primary">
          <Icon name="inventory" :size="16" />
        </div>
        <p class="text-sm font-bold">Procure Lite</p>
      </div>
      <div class="my-10 lg:my-0 max-w-sm">
        <h1 class="text-2xl lg:text-3xl font-bold leading-snug">让每一笔采购<br />都有下文</h1>
        <p class="mt-3 text-sm text-white/60 leading-relaxed">
          OA 单据导入 · 采购执行 · 库存与领用发放，一台服务器安静运行。
        </p>
      </div>
      <p class="text-[11px] text-white/35">本地部署 · 数据自持 · v2.0</p>
    </div>

    <!-- 右侧表单区 -->
    <div class="flex-1 flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-sm">
        <!-- 恢复码已生成（初始化成功） -->
        <template v-if="recoveryCodeIssued">
          <div class="card p-6">
            <div class="flex items-center gap-2 text-teal mb-3">
              <Icon name="check" :size="16" />
              <p class="text-sm font-semibold">初始化完成</p>
            </div>
            <p class="text-sm text-muted leading-relaxed">
              请把恢复码保存在安全的地方，密码遗忘时用它重置：
            </p>
            <p class="mt-3 px-4 py-3 bg-canvas border border-line rounded-(--radius-control) text-center font-mono text-base tracking-widest text-ink select-all">
              {{ recoveryCodeIssued }}
            </p>
            <p class="mt-3 text-xs text-red">恢复码只显示这一次，离开页面后无法再次查看。</p>
            <Button variant="primary" class="w-full mt-5" @click="recoveryCodeIssued = ''">我已保存，去登录</Button>
          </div>
        </template>

        <template v-else>
          <h2 class="text-lg font-bold text-ink">
            {{ mode === 'setup' ? '设置管理员密码' : mode === 'recover' ? '恢复码重置密码' : '登录' }}
          </h2>
          <p class="mt-1 mb-6 text-xs text-muted">
            {{ mode === 'setup' ? '首次使用，请为系统设置一个管理员密码（至少 8 位）' : mode === 'recover' ? '输入初始化时生成的恢复码与新密码' : '单管理员模式，输入密码继续' }}
          </p>

          <form class="space-y-4" @submit.prevent="submit">
            <div v-if="mode === 'recover'">
              <Input v-model="recoveryCode" label="恢复码" placeholder="16 位恢复码" required />
            </div>
            <Input
              v-model="password"
              type="password"
              :label="mode === 'recover' ? '新密码' : '密码'"
              :placeholder="mode === 'setup' || mode === 'recover' ? '至少 8 位' : '请输入密码'"
              required
            />
            <div v-if="mode === 'setup'">
              <Input v-model="passwordConfirm" type="password" label="确认密码" placeholder="再输入一次" required />
            </div>
            <p v-if="auth.status.locked" class="text-xs text-red">
              失败次数过多已锁定，约 {{ Math.ceil(auth.status.lockRemainingSeconds / 60) }} 分钟后可重试
            </p>
            <Button variant="primary" type="submit" class="w-full" :loading="loading">
              {{ mode === 'setup' ? '初始化系统' : mode === 'recover' ? '重置密码' : '登 录' }}
            </Button>
          </form>

          <button
            v-if="mode === 'login'"
            class="mt-4 text-xs text-faint hover:text-primary cursor-pointer"
            @click="recoverOpen = !recoverOpen"
          >
            忘记密码？使用恢复码
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

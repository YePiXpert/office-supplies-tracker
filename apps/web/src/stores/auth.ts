import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { http } from '@/api/client';

interface AuthStatus {
  initialized: boolean;
  locked: boolean;
  lockRemainingSeconds: number;
}

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>({ initialized: false, locked: false, lockRemainingSeconds: 0 });
  const checked = ref(false);
  const loggedIn = ref(false);

  const isInitialized = computed(() => status.value.initialized);

  async function refresh(): Promise<void> {
    try {
      const res = await http.get<AuthStatus>('/auth/status');
      status.value = res.data;
    } finally {
      checked.value = true;
    }
  }

  async function login(password: string): Promise<void> {
    await http.post('/auth/login', { password });
    loggedIn.value = true;
    await refresh();
  }

  async function setup(password: string): Promise<string> {
    const res = await http.post<{ recoveryCode: string }>('/auth/setup', { password });
    loggedIn.value = true;
    await refresh();
    return res.data.recoveryCode;
  }

  async function recover(recoveryCode: string, newPassword: string): Promise<void> {
    await http.post('/auth/recover', { recoveryCode, newPassword });
  }

  async function logout(): Promise<void> {
    await http.post('/auth/logout').catch(() => undefined);
    loggedIn.value = false;
    await refresh();
  }

  return { status, checked, loggedIn, isInitialized, refresh, login, setup, recover, logout };
});

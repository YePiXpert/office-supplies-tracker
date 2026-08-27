import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { bindRouter, onUnauthorized, apiError } from './api/client';
import { useAuthStore } from './stores/auth';
import { useToastStore } from './stores/toast';
import { registerSW } from 'virtual:pwa-register';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
bindRouter(router);

// 会话过期：清除登录态再跳登录页，避免守卫依据旧状态把用户弹回工作台
onUnauthorized(() => {
  useAuthStore(pinia).loggedIn = false;
});

// 全局兜底：未捕获的组件错误与 Promise 拒绝以 toast 呈现，而不是白屏/静默
app.config.errorHandler = (err) => {
  console.error(err);
  useToastStore(pinia).error('页面出现异常，请刷新重试');
};
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  useToastStore(pinia).error(apiError(e.reason));
});

app.use(router);
app.mount('#app');

registerSW({ immediate: true });

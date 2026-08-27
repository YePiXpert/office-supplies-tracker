import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { bindRouter } from './api/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/main.css';

const app = createApp(App);
app.use(createPinia());
bindRouter(router);
app.use(router);
app.mount('#app');

registerSW({ immediate: true });

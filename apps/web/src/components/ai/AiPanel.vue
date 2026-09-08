<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import { aiApi, apiError } from '@/api';
import { useToastStore } from '@/stores/toast';
import type { AiConfigView } from '@procure-lite/shared';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: { name: string; args: Record<string, unknown>; count: number }[];
  error?: boolean;
}

const toast = useToastStore();
const messages = ref<ChatMessage[]>([]);
const draft = ref('');
const asking = ref(false);
const elapsed = ref(0);
const config = ref<AiConfigView | null>(null);
const configLoaded = ref(false);
const listEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

/** 配置过（已启用且有 Key）才展示对话；否则显示引导 */
const configured = computed(() => config.value?.enabled && config.value.apiKeySet);

const EXAMPLES = [
  '本月各部门采购金额是多少？',
  '哪些物品库存偏低？',
  '上个月谁领用东西最多？',
  '未付款的采购单有哪些？',
];

let elapsedTimer: ReturnType<typeof setInterval> | null = null;

watch(
  () => props.open,
  (open) => {
    // 监听随开关增减：常驻的话面板关着时按 Escape 也会触发一次多余的 close
    if (open) {
      window.addEventListener('keydown', onEscape);
      if (!configLoaded.value) {
        aiApi
          .config()
          .then((cfg) => {
            config.value = cfg;
            configLoaded.value = true;
          })
          .catch(() => {
            // 401 已由拦截器统一处理；其他错误按未配置展示引导
            configLoaded.value = true;
          });
      }
      void nextTick(() => inputEl.value?.focus());
    } else {
      window.removeEventListener('keydown', onEscape);
    }
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscape);
  stopElapsed();
});

function onEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
}

async function send(preset?: string): Promise<void> {
  const question = (preset ?? draft.value).trim();
  if (!question || asking.value) return;
  if (!configured.value) {
    toast.info('请先在系统设置中配置并启用 AI 助手');
    return;
  }
  draft.value = '';
  const history = messages.value
    .filter((m) => !m.error)
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));
  messages.value.push({ role: 'user', content: question });
  asking.value = true;
  startElapsed();
  scrollToBottom();
  try {
    const res = await aiApi.ask({ question, history });
    messages.value.push({ role: 'assistant', content: res.answer, steps: res.steps });
  } catch (e) {
    messages.value.push({ role: 'assistant', content: apiError(e), error: true });
  } finally {
    asking.value = false;
    stopElapsed();
    scrollToBottom();
    void nextTick(() => inputEl.value?.focus());
  }
}

function startElapsed(): void {
  elapsed.value = 0;
  elapsedTimer = setInterval(() => (elapsed.value += 1), 1000);
}

function stopElapsed(): void {
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function scrollToBottom(): void {
  void nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
  });
}

watch([messages, asking], () => scrollToBottom(), { deep: true });
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.open"
        class="fixed inset-0 z-50 flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="AI 助手"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative h-full w-full sm:max-w-md bg-canvas flex flex-col shadow-(--shadow-pop)">
          <!-- 头部 -->
          <div class="flex items-center gap-2.5 px-4 h-13 bg-surface border-b border-line shrink-0">
            <span class="flex items-center justify-center size-7 rounded-lg bg-primary-soft text-primary">
              <Icon name="sparkles" :size="15" />
            </span>
            <div class="leading-tight min-w-0">
              <p class="text-sm font-semibold text-ink">AI 助手</p>
              <p v-if="configured" class="text-meta text-faint truncate">{{ config?.model }} · 问答内容会发送给模型服务商</p>
              <p v-else class="text-meta text-faint">自然语言查询台账与库存</p>
            </div>
            <button
              class="ml-auto p-1.5 rounded-(--radius-control) text-faint hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
              aria-label="关闭"
              @click="emit('close')"
            >
              <Icon name="close" :size="16" />
            </button>
          </div>

          <!-- 未配置引导 -->
          <div v-if="configLoaded && !configured" class="flex-1 overflow-y-auto p-4">
            <div class="card p-5 text-center space-y-3">
              <span class="inline-flex items-center justify-center size-10 rounded-xl bg-primary-soft text-primary">
                <Icon name="sparkles" :size="18" />
              </span>
              <p class="text-sm font-semibold text-ink">AI 助手尚未启用</p>
              <p class="text-xs text-muted leading-relaxed">
                配置一个 OpenAI 兼容的大模型接口（默认 DeepSeek，也支持智谱 GLM 等）后，即可用自然语言查询台账、库存与发放记录。
              </p>
              <router-link
                to="/settings"
                class="inline-flex items-center justify-center h-8 px-3 rounded-(--radius-control) bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors"
                @click="emit('close')"
              >
                前往系统设置
              </router-link>
            </div>
          </div>

          <!-- 对话区 -->
          <div v-else ref="listEl" class="flex-1 overflow-y-auto p-4 space-y-3">
            <template v-if="messages.length === 0">
              <div class="card p-4 space-y-3">
                <p class="text-xs text-muted">试试这样问：</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="q in EXAMPLES"
                    :key="q"
                    class="px-2.5 py-1.5 text-xs text-primary bg-primary-soft border border-primary/20 rounded-(--radius-control) hover:bg-primary/15 transition-colors cursor-pointer"
                    @click="send(q)"
                  >
                    {{ q }}
                  </button>
                </div>
              </div>
            </template>

            <template v-for="(m, i) in messages" :key="i">
              <div v-if="m.role === 'user'" class="flex justify-end">
                <div class="max-w-[85%] px-3 py-2 text-sm bg-primary text-white rounded-(--radius-card) rounded-tr-sm whitespace-pre-wrap break-words">
                  {{ m.content }}
                </div>
              </div>
              <div v-else class="space-y-2">
                <!-- 工具调用轨迹：默认折叠 -->
                <details v-if="m.steps?.length" class="text-meta text-faint">
                  <summary class="cursor-pointer select-none hover:text-muted">
                    已查询 {{ m.steps.length }} 次数据
                  </summary>
                  <ul class="mt-1 space-y-0.5 pl-3">
                    <li v-for="(s, j) in m.steps" :key="j" class="font-mono">
                      {{ s.name }}（{{ s.count }} 条）
                    </li>
                  </ul>
                </details>
                <div
                  class="max-w-[92%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-(--radius-card) rounded-tl-sm"
                  :class="m.error ? 'bg-red-soft text-red border border-red/20' : 'bg-surface border border-line text-text'"
                >{{ m.content }}</div>
              </div>
            </template>

            <div v-if="asking" class="flex items-center gap-2 text-xs text-faint">
              <span class="inline-block size-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              正在查询数据… {{ elapsed }}s
            </div>
          </div>

          <!-- 输入区 -->
          <div v-if="configured || !configLoaded" class="p-3 bg-surface border-t border-line shrink-0">
            <div class="flex items-end gap-2">
              <textarea
                ref="inputEl"
                v-model="draft"
                rows="2"
                placeholder="问点什么，如：上月行政部买了什么？（Enter 发送，Shift+Enter 换行）"
                class="flex-1 px-3 py-2 text-sm bg-canvas border border-line-strong rounded-(--radius-control) placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
                :disabled="asking"
                @keydown.enter.exact.prevent="send()"
              />
              <button
                type="button"
                class="inline-flex items-center justify-center size-9.5 shrink-0 rounded-(--radius-control) bg-primary text-white hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
                :disabled="asking || !draft.trim()"
                aria-label="发送"
                @click="send()"
              >
                <span v-if="asking" class="inline-block size-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                <Icon v-else name="send" :size="15" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

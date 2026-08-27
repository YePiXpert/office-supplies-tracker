<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import Badge from '@/components/ui/Badge.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { auditApi, type AuditRow } from '@/api';
import { apiError } from '@/api/client';
import { useToastStore } from '@/stores/toast';
import { formatDateTime } from '@/utils/datetime';

const toast = useToastStore();
const logs = ref<AuditRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 30;
const loading = ref(true);
const filters = reactive({ search: '' });

const ACTION_LABELS: Record<string, { label: string; tone: 'blue' | 'teal' | 'amber' | 'red' | 'gray' }> = {
  AUTH_SETUP: { label: '初始化', tone: 'gray' },
  AUTH_LOGIN: { label: '登录', tone: 'gray' },
  AUTH_LOGIN_FAILED: { label: '登录失败', tone: 'red' },
  AUTH_RECOVER: { label: '恢复密码', tone: 'amber' },
  AUTH_RECOVER_FAILED: { label: '恢复码错误', tone: 'red' },
  AUTH_CHANGE_PASSWORD: { label: '修改密码', tone: 'amber' },
  AUTH_REGENERATE_RECOVERY: { label: '重置恢复码', tone: 'amber' },
  ITEM_CREATE: { label: '新增台账', tone: 'blue' },
  ITEM_UPDATE: { label: '修改台账', tone: 'blue' },
  ITEM_BATCH_UPDATE: { label: '批量修改', tone: 'blue' },
  ITEM_DELETE: { label: '删除台账', tone: 'red' },
  ITEM_RESTORE: { label: '恢复台账', tone: 'teal' },
  ITEM_PURGE: { label: '彻底删除', tone: 'red' },
  ITEM_ROLLBACK: { label: '回滚', tone: 'amber' },
  ITEM_STOCK_IN: { label: '采购入库', tone: 'teal' },
  DISTRIBUTION_CREATE: { label: '发放登记', tone: 'teal' },
  DISTRIBUTION_REVOKE: { label: '作废发放', tone: 'red' },
  IMPORT_UPLOAD: { label: '上传单据', tone: 'gray' },
  IMPORT_CONFIRM: { label: '确认导入', tone: 'blue' },
  PRODUCT_CREATE: { label: '新增物品', tone: 'gray' },
  PRODUCT_UPDATE: { label: '修改物品', tone: 'gray' },
  PRODUCT_DELETE: { label: '删除物品', tone: 'red' },
  INVENTORY_MOVEMENT: { label: '库存流水', tone: 'teal' },
  INVENTORY_MOVEMENT_DELETE: { label: '删流水', tone: 'red' },
  SUPPLIER_CREATE: { label: '新增供应商', tone: 'gray' },
  SUPPLIER_UPDATE: { label: '修改供应商', tone: 'gray' },
  SUPPLIER_DELETE: { label: '删除供应商', tone: 'red' },
  PRICE_RECORD_CREATE: { label: '记价', tone: 'gray' },
  PRICE_RECORD_DELETE: { label: '删价', tone: 'red' },
  ATTACHMENT_UPLOAD: { label: '传附件', tone: 'gray' },
  ATTACHMENT_DELETE: { label: '删附件', tone: 'red' },
  BACKUP_CREATE: { label: '创建备份', tone: 'gray' },
  BACKUP_RESTORE: { label: '恢复备份', tone: 'amber' },
  BACKUP_DELETE: { label: '删备份', tone: 'red' },
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await auditApi.list({
      ...(filters.search ? { search: filters.search } : {}),
      page: page.value,
      pageSize,
    });
    logs.value = res.logs;
    total.value = res.total;
  } catch (e) {
    toast.error(apiError(e));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function detailOf(log: AuditRow): string {
  if (!log.detail) return '';
  try {
    const parsed = JSON.parse(log.detail) as Record<string, unknown>;
    return JSON.stringify(parsed);
  } catch {
    return log.detail;
  }
}


</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex items-center gap-2.5 px-4 py-3 border-b border-line">
      <div class="relative flex-1 max-w-sm">
        <Icon name="search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          v-model="filters.search"
          class="w-full h-9 pl-9 pr-3 text-sm bg-surface border border-line-strong rounded-(--radius-control) focus:border-primary focus:outline-none"
          placeholder="搜索操作类型 / 详情"
          @keyup.enter="page = 1; load()"
        />
      </div>
    </div>

    <div v-if="loading" class="py-14 text-center text-sm text-faint">加载中…</div>
    <EmptyState v-else-if="logs.length === 0" icon="audit" title="暂无审计记录" />

    <div v-else class="overflow-x-auto">
      <table class="table-base min-w-[720px]">
        <thead><tr><th>时间</th><th>操作</th><th>对象</th><th>详情</th><th>来源 IP</th></tr></thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="text-xs text-muted num whitespace-nowrap">{{ formatDateTime(log.createdAt, true) }}</td>
            <td>
              <Badge :tone="ACTION_LABELS[log.action]?.tone ?? 'gray'">
                {{ ACTION_LABELS[log.action]?.label ?? log.action }}
              </Badge>
            </td>
            <td class="text-xs text-muted whitespace-nowrap">
              {{ log.entity ?? '—' }}<template v-if="log.entityId"> #{{ log.entityId }}</template>
            </td>
            <td class="text-xs text-faint max-w-96 truncate" :title="detailOf(log)">{{ detailOf(log) || '—' }}</td>
            <td class="text-xs num text-muted">{{ log.operatorIp ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="px-4 py-3 border-t border-line">
      <Pagination :page="page" :page-size="pageSize" :total="total" @change="(p) => { page = p; load(); }" />
    </div>
  </div>
</template>

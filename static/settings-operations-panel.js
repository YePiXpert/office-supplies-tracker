(function (global) {
    global.SettingsOperationsPanel = {
        mixins: [global.OpsPanelMixin],
        template: `
            <section class="space-y-4">
                <input
                    id="invoice-attachment-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    class="hidden"
                    @change="$root.handleInvoiceAttachmentSelect"
                >

                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h3 class="text-xl font-semibold tracking-tight text-slate-900">供应商协同工作台</h3>
                        <p class="mt-1 text-sm text-slate-500">聚焦供应商资料、价格基线、导入恢复和报销闭环。供应商月报、年报与采购额走势统一放到统计报表页。</p>
                        <p v-if="$root.operationsCenterLastLoadedAt" class="mt-2 text-xs text-slate-400">最近同步：{{ formatDateTime($root.operationsCenterLastLoadedAt) }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span v-if="$root.operationsCenterLoading" class="text-xs text-slate-500">同步中...</span>
                        <button
                            @click="$root.loadOperationsCenter()"
                            :disabled="$root.operationsCenterLoading"
                            class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out"
                        >
                            刷新运营中心
                        </button>
                    </div>
                </div>

                <div v-if="$root.operationsError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {{ $root.operationsError }}
                </div>

                <ops-overview-panel v-if="isOperationsSubview('overview')"></ops-overview-panel>
                <ops-procurement-panel v-if="isOperationsSubview('procurement')"></ops-procurement-panel>
                <ops-master-data-panel v-if="isOperationsSubview('master-data')"></ops-master-data-panel>
                <ops-exceptions-panel v-if="isOperationsSubview('exceptions')"></ops-exceptions-panel>
            </section>
        `,
    };
})(window);

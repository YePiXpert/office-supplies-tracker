(function (global) {
    global.OpsOverviewPanel = {
        mixins: [global.OpsPanelMixin],
        template: `
            <div class="space-y-4">
                <div class="grid grid-cols-1 xl:grid-cols-[1.6fr,1fr] gap-4">
                    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div class="text-sm font-semibold text-slate-900">今天先做哪几步</div>
                                <div class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{{ formatCount(actionQueueCount) }} 项待跟进</div>
                                <div class="mt-2 text-sm text-slate-500">先处理执行超期、失败导入和待报销，再补供应商档案与价格基线；供应商走势统一去报表页查看和导出。</div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1">超期 {{ overdueNotifications.length }}</span>
                                <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1">导入恢复 {{ importRecoveryTasks.length }}</span>
                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">待报销 {{ pendingInvoices.length }}</span>
                                <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">供应商 {{ activeSupplierCount }}</span>
                            </div>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            <button @click="$root.goToViewSubview('reports', 'suppliers')" class="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out">
                                查看供应商报表
                            </button>
                            <button @click="$root.switchSubView('exceptions')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                查看异常队列
                            </button>
                            <button @click="$root.switchSubView('exceptions')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                跟进导入任务
                            </button>
                            <button @click="$root.switchSubView('master-data')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                维护供应商资料
                            </button>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <div class="text-sm font-semibold text-slate-900">这页现在做什么</div>
                        <div class="mt-3 space-y-3 text-sm text-slate-600">
                            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div class="font-semibold text-slate-900">做协同，不做大而全</div>
                                <div class="mt-1 text-xs text-slate-500">保留供应商档案、价格记录、导入恢复和报销闭环，把库存和供应商评价类内容退出主流程。</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div class="font-semibold text-slate-900">把分析交回报表页</div>
                                <div class="mt-1 text-xs text-slate-500">月度、年度采购额走势和供应商明细统一在"统计报表"里查看与导出，避免运营页继续膨胀。</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div class="font-semibold text-slate-900">把真实待办放最前面</div>
                                <div class="mt-1 text-xs text-slate-500">先处理超期、失败导入、待报销，再回头补供应商资料，不让配置型内容抢占注意力。</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <button @click="$root.switchSubView('master-data')" class="text-left rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">供应商档案</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(suppliers.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">当前可协同供应商数量</div>
                    </button>
                    <button @click="$root.switchSubView('master-data')" class="text-left rounded-xl border border-cyan-200 bg-cyan-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">价格基线</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(priceRecords.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">最近成交价与采购链接</div>
                    </button>
                    <button @click="$root.switchSubView('exceptions')" class="text-left rounded-xl border border-blue-200 bg-blue-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-blue-700">导入恢复</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(importRecoveryTasks.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">失败或处理中任务</div>
                    </button>
                    <button @click="$root.switchSubView('exceptions')" class="text-left rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-600">发票报销</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(pendingInvoices.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">待闭环条目</div>
                    </button>
                </div>
            </div>
        `,
    };
})(window);

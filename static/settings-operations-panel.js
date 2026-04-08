(function (global) {
    const IMPORT_STATUS_LABELS = {
        pending: '待排队',
        processing: '解析中',
        completed: '已完成',
        failed: '失败',
    };

    const REIMBURSEMENT_STATUS_LABELS = {
        pending: '待提交',
        submitted: '已提交',
        reimbursed: '已报销',
    };

    const NOTIFICATION_SEVERITY_LABELS = {
        critical: '严重',
        warning: '提醒',
        notice: '关注',
    };

    const NOTIFICATION_TITLE_LABELS = {
        'Low stock warning': '低库存预警',
        'Import task failed': '导入任务失败',
        'Reimbursement pending': '报销待跟进',
        'Purchase overdue': '采购超期',
        'Arrival overdue': '到货超期',
        'Distribution overdue': '分发超期',
    };

    const NOTIFICATION_CATEGORY_LABELS = {
        inventory: '库存',
        import: '导入',
        invoice: '发票',
        overdue: '执行超期',
    };

    const IMPORT_STATUS_ORDER = {
        failed: 0,
        processing: 1,
        pending: 2,
        completed: 3,
    };

    const REIMBURSEMENT_STATUS_ORDER = {
        pending: 0,
        submitted: 1,
        reimbursed: 2,
    };

    const SEVERITY_ORDER = {
        critical: 0,
        warning: 1,
        notice: 2,
    };

    global.SettingsOperationsPanel = {
        computed: {
            center() {
                return this.$root.operationsCenter || {};
            },
            summary() {
                return this.center.summary || {};
            },
            suppliers() {
                return Array.isArray(this.center.suppliers) ? this.center.suppliers : [];
            },
            priceRecords() {
                return Array.isArray(this.center.price_records) ? this.center.price_records : [];
            },
            importTasks() {
                return Array.isArray(this.center.import_tasks) ? this.center.import_tasks : [];
            },
            invoiceQueue() {
                return Array.isArray(this.center.invoice_queue) ? this.center.invoice_queue : [];
            },
            notifications() {
                return Array.isArray(this.center.notifications) ? this.center.notifications : [];
            },
            visibleNotifications() {
                return this.notifications.filter((row) => row?.category !== 'inventory');
            },
            criticalNotificationCount() {
                return this.visibleNotifications.filter((row) => row?.severity === 'critical').length;
            },
            warningNotificationCount() {
                return this.visibleNotifications.filter((row) => row?.severity === 'warning').length;
            },
            activeSupplierCount() {
                return this.suppliers.filter((supplier) => supplier?.is_active !== false).length;
            },
            recentPriceRecords() {
                return [...this.priceRecords]
                    .sort((left, right) => {
                        const rightDate = String(right?.last_purchase_date || right?.updated_at || '');
                        const leftDate = String(left?.last_purchase_date || left?.updated_at || '');
                        return rightDate.localeCompare(leftDate);
                    })
                    .slice(0, 6);
            },
            priorityNotifications() {
                return [...this.visibleNotifications]
                    .sort((left, right) => {
                        const severityDiff = (SEVERITY_ORDER[left?.severity] ?? 9) - (SEVERITY_ORDER[right?.severity] ?? 9);
                        if (severityDiff !== 0) return severityDiff;
                        return String(left?.category || '').localeCompare(String(right?.category || ''));
                    })
                    .slice(0, 8);
            },
            overdueNotifications() {
                return this.visibleNotifications.filter((notification) => notification?.category === 'overdue');
            },
            failedImportTasks() {
                return this.importTasks.filter((task) => task?.status === 'failed');
            },
            importRecoveryTasks() {
                return [...this.importTasks]
                    .filter((task) => task?.status !== 'completed')
                    .sort((left, right) => {
                        const statusDiff = (IMPORT_STATUS_ORDER[left?.status] ?? 9) - (IMPORT_STATUS_ORDER[right?.status] ?? 9);
                        if (statusDiff !== 0) return statusDiff;
                        return String(right?.updated_at || right?.created_at || '').localeCompare(
                            String(left?.updated_at || left?.created_at || '')
                        );
                    });
            },
            pendingInvoices() {
                return [...this.invoiceQueue]
                    .filter((item) => item?.reimbursement_status !== 'reimbursed')
                    .sort((left, right) => {
                        const statusDiff = (REIMBURSEMENT_STATUS_ORDER[left?.reimbursement_status] ?? 9)
                            - (REIMBURSEMENT_STATUS_ORDER[right?.reimbursement_status] ?? 9);
                        if (statusDiff !== 0) return statusDiff;
                        return String(right?.request_date || '').localeCompare(String(left?.request_date || ''));
                    });
            },
            actionQueueCount() {
                return this.overdueNotifications.length + this.failedImportTasks.length + this.pendingInvoices.length;
            },
        },
        methods: {
            formatDate(value) {
                const text = (value || '').toString().trim();
                return text ? text.slice(0, 10) : '--';
            },
            formatDateTime(value) {
                const text = (value || '').toString().trim();
                return text ? text.replace('T', ' ').slice(0, 16) : '--';
            },
            formatCount(value) {
                const number = Number(value || 0);
                if (!Number.isFinite(number)) return '0';
                return Number.isInteger(number) ? String(number) : number.toFixed(2);
            },
            formatFileSize(bytes) {
                const size = Number(bytes || 0);
                if (!Number.isFinite(size) || size <= 0) return '--';
                if (size < 1024) return `${size} B`;
                if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
                return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            },
            formatCurrencyValue(value) {
                if (typeof this.$root.formatCurrency === 'function') {
                    return this.$root.formatCurrency(value);
                }
                return this.formatCount(value);
            },
            importStatusLabel(status) {
                return IMPORT_STATUS_LABELS[status] || (status || '未知');
            },
            importStatusClass(status) {
                return {
                    pending: 'bg-slate-100 text-slate-700 border-slate-200',
                    processing: 'bg-blue-100 text-blue-700 border-blue-200',
                    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    failed: 'bg-rose-100 text-rose-700 border-rose-200',
                }[status] || 'bg-slate-100 text-slate-700 border-slate-200';
            },
            reimbursementLabel(status) {
                return REIMBURSEMENT_STATUS_LABELS[status] || (status || '未知');
            },
            reimbursementClass(status) {
                return {
                    pending: 'bg-amber-100 text-amber-700 border-amber-200',
                    submitted: 'bg-blue-100 text-blue-700 border-blue-200',
                    reimbursed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                }[status] || 'bg-slate-100 text-slate-700 border-slate-200';
            },
            notificationSeverityLabel(severity) {
                return NOTIFICATION_SEVERITY_LABELS[severity] || '通知';
            },
            notificationClass(severity) {
                return {
                    critical: 'border-rose-200 bg-rose-50/80',
                    warning: 'border-amber-200 bg-amber-50/80',
                    notice: 'border-blue-200 bg-blue-50/80',
                }[severity] || 'border-slate-200 bg-slate-50/80';
            },
            notificationTitleText(notification) {
                const raw = notification?.title || '';
                return NOTIFICATION_TITLE_LABELS[raw] || raw || '运营提醒';
            },
            notificationCategoryText(category) {
                return NOTIFICATION_CATEGORY_LABELS[category] || category || '运营';
            },
            notificationDetailText(notification) {
                const title = notification?.title || '';
                if (title === 'Low stock warning') {
                    return '当前库存已低于安全线，建议尽快补货或确认阈值设置。';
                }
                if (title === 'Reimbursement pending') {
                    return '该条目还没有完成报销闭环，建议补充发票号、报销状态或附件。';
                }
                if (title === 'Purchase overdue') {
                    return '该采购单在待采购阶段停留过久，建议尽快确认下单或处理阻塞。';
                }
                if (title === 'Arrival overdue') {
                    return '该采购单等待到货时间过长，建议尽快催货并同步到货日期。';
                }
                if (title === 'Distribution overdue') {
                    return '该条目已到货但分发超期，建议尽快安排发放或补签收。';
                }
                return (notification?.detail || '').toString().trim() || '请尽快处理该提醒。';
            },
            ensureInvoiceDraft(item) {
                return this.$root.getInvoiceDraft(item);
            },
            updateInvoiceDraft(item, field, value) {
                const draft = this.ensureInvoiceDraft(item);
                draft[field] = value;
                if (field === 'reimbursement_status' && value !== 'pending' && !draft.reimbursement_date) {
                    draft.reimbursement_date = global.AppTime ? global.AppTime.todayDateText() : new Date().toISOString().slice(0, 10);
                }
            },
            resetSupplierForm() {
                this.$root.resetNewSupplierForm();
            },
            resetPriceForm() {
                this.$root.resetNewPriceRecordForm();
            },
            locateInvoiceItem(item) {
                const itemId = Number(item?.item_id || 0);
                if (!itemId) return;
                this.$root.jumpToLedgerItem(itemId, item, {
                    closeDataQualityModal: false,
                    successMessage: `已定位到发票条目 #${itemId}`,
                });
            },
            fillInvoiceDateToday(item) {
                const draft = this.ensureInvoiceDraft(item);
                draft.reimbursement_date = global.AppTime ? global.AppTime.todayDateText() : new Date().toISOString().slice(0, 10);
            },
            jumpToNotificationTarget(notification) {
                const itemId = Number(notification?.related_item_id || 0);
                if (!itemId || typeof this.$root.jumpToLedgerItem !== 'function') return;
                this.$root.jumpToLedgerItem(itemId, {
                    id: itemId,
                    item_name: notification?.title || '',
                }, {
                    closeDataQualityModal: false,
                    successMessage: `已定位到提醒关联条目 #${itemId}`,
                });
            },
            openSection(targetId, detailsId = '') {
                if (detailsId) {
                    const details = document.getElementById(detailsId);
                    if (details && 'open' in details) {
                        details.open = true;
                    }
                }
                window.setTimeout(() => {
                    const element = document.getElementById(targetId);
                    if (element && typeof element.scrollIntoView === 'function') {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 40);
            },
            openMasterData(targetId = 'ops-section-full-workbench', innerId = '') {
                if (innerId) {
                    this.openSection(innerId, targetId);
                    return;
                }
                this.openSection(targetId, targetId);
            },
            openFullFollowup(innerId = '') {
                if (innerId) {
                    this.openSection(innerId, 'ops-section-full-workbench');
                    return;
                }
                this.openSection('ops-section-full-workbench', 'ops-section-full-workbench');
            },
            copyPriceLink(record) {
                if (!record?.purchase_link) {
                    this.$root.showToast('该物品暂未配置采购链接', 'error');
                    return;
                }
                this.$root.copyPurchaseLink(record.purchase_link);
            },
        },
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
                            <button @click="$root.switchView('reports')" class="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out">
                                查看供应商报表
                            </button>
                            <button @click="openSection('ops-section-exceptions')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                查看异常队列
                            </button>
                            <button @click="openSection('ops-section-import-recovery')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                跟进导入任务
                            </button>
                            <button @click="openMasterData('ops-section-full-workbench', 'ops-section-master-sourcing')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
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
                                <div class="mt-1 text-xs text-slate-500">月度、年度采购额走势和供应商明细统一在“统计报表”里查看与导出，避免运营页继续膨胀。</div>
                            </div>
                            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div class="font-semibold text-slate-900">把真实待办放最前面</div>
                                <div class="mt-1 text-xs text-slate-500">先处理超期、失败导入、待报销，再回头补供应商资料，不让配置型内容抢占注意力。</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <button @click="openMasterData('ops-section-full-workbench', 'ops-section-master-sourcing')" class="text-left rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">供应商档案</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(suppliers.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">当前可协同供应商数量</div>
                    </button>
                    <button @click="openSection('ops-section-supplier-collab')" class="text-left rounded-xl border border-cyan-200 bg-cyan-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">价格基线</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(priceRecords.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">最近成交价与采购链接</div>
                    </button>
                    <button @click="openSection('ops-section-import-recovery')" class="text-left rounded-xl border border-blue-200 bg-blue-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-blue-700">导入恢复</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(importRecoveryTasks.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">失败或处理中任务</div>
                    </button>
                    <button @click="openSection('ops-section-invoices-preview')" class="text-left rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-600">发票报销</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(pendingInvoices.length) }}</div>
                        <div class="mt-1 text-xs text-slate-600">待闭环条目</div>
                    </button>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                    <div class="xl:col-span-2 space-y-4">
                        <div id="ops-section-supplier-collab" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">供应商协同与价格基线</h4>
                                    <p class="mt-1 text-sm text-slate-500">这里保留供应商资料和最近价格，帮助你看清“哪些商品主要从哪些供应商买”。更完整的月报、年报和走势请到报表页查看。</p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <button @click="$root.switchView('reports')" class="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out">
                                        去看供应商分析
                                    </button>
                                    <button @click="openMasterData('ops-section-full-workbench', 'ops-section-master-sourcing')" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                        展开资料维护
                                    </button>
                                </div>
                            </div>
                            <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div class="text-[11px] uppercase tracking-wide text-slate-500">启用供应商</div>
                                    <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(activeSupplierCount) }}</div>
                                </div>
                                <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div class="text-[11px] uppercase tracking-wide text-slate-500">价格记录</div>
                                    <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(priceRecords.length) }}</div>
                                </div>
                                <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div class="text-[11px] uppercase tracking-wide text-slate-500">导入归属提醒</div>
                                    <div class="mt-2 text-sm font-medium text-slate-700">新增或编辑台账时直接指定供应商，后续月报和年报会更准。</div>
                                </div>
                            </div>
                            <div class="mt-5">
                                <div class="flex items-center justify-between">
                                    <div class="text-sm font-semibold text-slate-900">最近价格记录</div>
                                    <span class="text-[11px] text-slate-500">用于采购分析回填与比价参考</span>
                                </div>
                                <div class="mt-3 space-y-2">
                                    <div v-if="!recentPriceRecords.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                        暂无价格记录，建议先补常用品的最近成交价。
                                    </div>
                                    <div v-for="record in recentPriceRecords" :key="'recent-price-' + record.id" class="rounded-lg border border-slate-200 px-4 py-3">
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <div class="text-sm font-semibold text-slate-900">{{ record.item_name }}</div>
                                                <div class="mt-1 text-xs text-slate-500">
                                                    {{ record.supplier_name || '未指定供应商' }}
                                                    <span v-if="record.last_serial_number"> · {{ record.last_serial_number }}</span>
                                                    <span> · {{ formatDate(record.last_purchase_date || record.updated_at) }}</span>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-sm font-semibold font-mono text-blue-700">¥ {{ formatCurrencyValue(record.unit_price) }}</div>
                                                <button v-if="record.purchase_link" type="button" @click="copyPriceLink(record)" class="mt-2 inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                                    复制采购链接
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="ops-section-exceptions" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">优先异常队列</h4>
                                    <p class="mt-1 text-sm text-slate-500">把超期、失败和重要提醒排在前面，避免真正的阻塞沉到底部历史里。</p>
                                </div>
                                <span class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                                    严重 {{ criticalNotificationCount }} / 提醒 {{ warningNotificationCount }}
                                </span>
                            </div>
                            <div class="mt-4 space-y-3">
                                <div v-if="!priorityNotifications.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    当前没有需要优先处理的异常。
                                </div>
                                <div
                                    v-for="notification in priorityNotifications"
                                    :key="'priority-' + notification.category + '-' + notification.title + '-' + (notification.related_item_id || 'global')"
                                    :class="notificationClass(notification.severity)"
                                    class="rounded-xl border px-4 py-4"
                                >
                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="min-w-0">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <span class="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                                    {{ notificationCategoryText(notification.category) }}
                                                </span>
                                                <span class="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                                    {{ notificationSeverityLabel(notification.severity) }}
                                                </span>
                                            </div>
                                            <div class="mt-2 text-sm font-semibold text-slate-900">{{ notificationTitleText(notification) }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ notificationDetailText(notification) }}</div>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <button
                                                v-if="notification.related_item_id"
                                                @click="jumpToNotificationTarget(notification)"
                                                class="h-8 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out"
                                            >
                                                定位台账
                                            </button>
                                            <button
                                                v-else-if="notification.category === 'import'"
                                                @click="openFullFollowup('ops-section-full-imports')"
                                                class="h-8 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out"
                                            >
                                                打开导入台
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="ops-section-invoices-preview" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">待跟进发票与报销</h4>
                                    <p class="mt-1 text-sm text-slate-500">先把仍未报销完成的条目拉出来，快速定位台账和继续跟进。</p>
                                </div>
                                <button @click="openFullFollowup('ops-section-full-invoices')" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                    展开完整跟进台
                                </button>
                            </div>
                            <div class="mt-4 space-y-3">
                                <div v-if="!pendingInvoices.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    当前没有待跟进的报销条目。
                                </div>
                                <div v-for="item in pendingInvoices.slice(0, 5)" :key="'invoice-preview-' + item.item_id" class="rounded-xl border border-slate-200 px-4 py-4">
                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="min-w-0">
                                            <div class="text-sm font-semibold text-slate-900">{{ item.item_name || '未命名条目' }}</div>
                                            <div class="mt-1 text-xs text-slate-500">
                                                {{ item.serial_number || '无流水号' }} · {{ item.department || '未分配部门' }} · {{ item.handler || '未填写经办人' }}
                                            </div>
                                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                                <span :class="reimbursementClass(item.reimbursement_status)" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                                    {{ reimbursementLabel(item.reimbursement_status) }}
                                                </span>
                                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                                    申请日 {{ formatDate(item.request_date) }}
                                                </span>
                                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                                    附件 {{ item.attachment_count || 0 }} 个
                                                </span>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <button @click="locateInvoiceItem(item)" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                                定位台账
                                            </button>
                                            <button @click="openFullFollowup('ops-section-full-invoices')" class="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out">
                                                完整跟进
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div id="ops-section-supplier-health" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">供应商资料速览</h4>
                                    <p class="mt-1 text-sm text-slate-500">快速确认当前供应商目录是否齐全，并决定是去补资料，还是直接进入报表页看月报、年报和走势。</p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <button @click="$root.switchView('reports')" class="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out">
                                        打开统计报表
                                    </button>
                                    <button @click="openMasterData('ops-section-full-workbench', 'ops-section-master-sourcing')" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                        去维护资料
                                    </button>
                                </div>
                            </div>
                            <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div class="text-[11px] uppercase tracking-wide text-slate-500">供应商总数</div>
                                    <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(suppliers.length) }}</div>
                                    <div class="mt-1 text-xs text-slate-500">启用中 {{ formatCount(activeSupplierCount) }}</div>
                                </div>
                                <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div class="text-[11px] uppercase tracking-wide text-slate-500">价格记录总数</div>
                                    <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(priceRecords.length) }}</div>
                                    <div class="mt-1 text-xs text-slate-500">用于导入回填和采购额分析</div>
                                </div>
                            </div>
                            <div class="mt-5 border-t border-slate-200 pt-4">
                                <div class="text-sm font-semibold text-slate-900">最近供应商目录</div>
                                <div class="mt-3 space-y-2">
                                    <div v-if="!suppliers.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                        暂无供应商基础资料。
                                    </div>
                                    <div v-for="supplier in suppliers.slice(0, 6)" :key="'supplier-quick-' + supplier.id" class="rounded-lg border border-slate-200 px-4 py-3">
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <div class="text-sm font-semibold text-slate-900">{{ supplier.name }}</div>
                                                <div class="mt-1 text-xs text-slate-500">
                                                    {{ supplier.contact_name || '未填写联系人' }}
                                                    <span v-if="supplier.contact_phone"> · {{ supplier.contact_phone }}</span>
                                                    <span v-if="supplier.contact_email"> · {{ supplier.contact_email }}</span>
                                                </div>
                                            </div>
                                            <span :class="supplier.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                                {{ supplier.is_active ? '启用中' : '已停用' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="ops-section-import-recovery" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">导入恢复队列</h4>
                                    <p class="mt-1 text-sm text-slate-500">把失败和处理中任务独立拎出来，避免导入问题沉到底部历史里。</p>
                                </div>
                                <button @click="openFullFollowup('ops-section-full-imports')" class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                    查看全部任务
                                </button>
                            </div>
                            <div class="mt-4 space-y-2">
                                <div v-if="!importRecoveryTasks.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    当前没有待恢复的导入任务。
                                </div>
                                <div v-for="task in importRecoveryTasks.slice(0, 5)" :key="'recovery-' + task.task_id" class="rounded-lg border border-slate-200 px-4 py-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <div class="truncate text-sm font-semibold text-slate-900">{{ task.file_name || task.task_id }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ task.engine || 'unknown' }} · {{ task.protocol || 'default' }}</div>
                                            <div class="mt-1 text-xs text-slate-500">最后更新：{{ formatDateTime(task.updated_at || task.completed_at || task.created_at) }}</div>
                                        </div>
                                        <span :class="importStatusClass(task.status)" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                            {{ importStatusLabel(task.status) }}
                                        </span>
                                    </div>
                                    <div v-if="task.error_detail" class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                        {{ task.error_detail }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <details id="ops-section-full-workbench" class="group rounded-xl border border-slate-200 bg-white shadow-sm">
                    <summary class="flex cursor-pointer list-none flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div class="text-base font-semibold text-slate-900">展开完整运营台与资料维护</div>
                            <div class="mt-1 text-sm text-slate-500">完整保留供应商档案、价格记录、导入任务和发票闭环；库存相关能力本期不放在主流程展示。</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">供应商 {{ suppliers.length }}</span>
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">价格 {{ priceRecords.length }}</span>
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">导入 {{ importTasks.length }}</span>
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">待报销 {{ pendingInvoices.length }}</span>
                        </div>
                    </summary>

                    <div class="px-5 pb-5">
                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                            <div class="space-y-4">
                                <div id="ops-section-master-sourcing" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">供应商与价格库</h4>
                                    <p class="mt-1 text-sm text-slate-500">维护供应商主数据，并沉淀常用物品的最近成交价。</p>
                                </div>
                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                    {{ suppliers.length }} 家供应商
                                </span>
                            </div>

                            <form class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" @submit.prevent="$root.createSupplierRecord()">
                                <input v-model.trim="$root.newSupplier.name" type="text" maxlength="200" placeholder="供应商名称" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model.trim="$root.newSupplier.contact_name" type="text" maxlength="200" placeholder="联系人" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model.trim="$root.newSupplier.contact_phone" type="text" maxlength="80" placeholder="联系电话" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model.trim="$root.newSupplier.contact_email" type="email" maxlength="200" placeholder="联系邮箱" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model.trim="$root.newSupplier.notes" type="text" maxlength="500" placeholder="备注" class="h-10 px-3 border border-slate-300 rounded-lg text-sm md:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <label class="inline-flex items-center gap-2 text-sm text-slate-600">
                                    <input v-model="$root.newSupplier.is_active" type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20">
                                    启用供应商
                                </label>
                                <div class="flex gap-2">
                                    <button type="button" @click="resetSupplierForm" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                        重置
                                    </button>
                                    <button type="submit" :disabled="$root.supplierSaving" class="flex-1 h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out">
                                        {{ $root.supplierSaving ? '保存中...' : '新增供应商' }}
                                    </button>
                                </div>
                            </form>

                            <div class="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
                                <div v-if="!suppliers.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    暂无供应商档案。
                                </div>
                                <div v-for="supplier in suppliers" :key="'supplier-' + supplier.id" class="rounded-lg border border-slate-200 px-4 py-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <div class="text-sm font-semibold text-slate-900">{{ supplier.name }}</div>
                                            <div class="mt-1 text-xs text-slate-500">
                                                {{ supplier.contact_name || '未填写联系人' }}
                                                <span v-if="supplier.contact_phone"> · {{ supplier.contact_phone }}</span>
                                                <span v-if="supplier.contact_email"> · {{ supplier.contact_email }}</span>
                                            </div>
                                        </div>
                                        <span :class="supplier.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                            {{ supplier.is_active ? '启用中' : '已停用' }}
                                        </span>
                                    </div>
                                    <div v-if="supplier.notes" class="mt-2 text-xs text-slate-500">{{ supplier.notes }}</div>
                                </div>
                            </div>

                            <form class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200 pt-5" @submit.prevent="$root.createSupplierPriceRecord()">
                                <div class="md:col-span-2">
                                    <div class="text-sm font-semibold text-slate-900">新增价格记录</div>
                                    <div class="mt-1 text-xs text-slate-500">记录最近成交价，方便后续导入和采购比价。</div>
                                </div>
                                <input v-model.trim="$root.newPriceRecord.item_name" type="text" maxlength="200" placeholder="物品名称" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <select v-model="$root.newPriceRecord.supplier_id" class="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="">选择供应商</option>
                                    <option v-for="supplier in suppliers" :key="'price-supplier-' + supplier.id" :value="String(supplier.id)">{{ supplier.name }}</option>
                                </select>
                                <input v-model="$root.newPriceRecord.unit_price" type="number" min="0" step="0.01" placeholder="单价" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model="$root.newPriceRecord.last_purchase_date" type="date" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model.trim="$root.newPriceRecord.purchase_link" type="url" maxlength="2000" placeholder="采购链接" class="h-10 px-3 border border-slate-300 rounded-lg text-sm md:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model.trim="$root.newPriceRecord.last_serial_number" type="text" maxlength="120" placeholder="关联流水号" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <div class="flex gap-2">
                                    <button type="button" @click="resetPriceForm" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                        重置
                                    </button>
                                    <button type="submit" :disabled="$root.priceSaving" class="flex-1 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out">
                                        {{ $root.priceSaving ? '保存中...' : '新增价格记录' }}
                                    </button>
                                </div>
                            </form>

                            <div class="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
                                <div v-if="!priceRecords.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    暂无价格记录。
                                </div>
                                <div v-for="record in priceRecords" :key="'price-' + record.id" class="rounded-lg border border-slate-200 px-4 py-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <div class="text-sm font-semibold text-slate-900">{{ record.item_name }}</div>
                                            <div class="mt-1 text-xs text-slate-500">
                                                {{ record.supplier_name || '未指定供应商' }}
                                                <span v-if="record.last_serial_number"> · {{ record.last_serial_number }}</span>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-sm font-semibold font-mono text-blue-700">¥ {{ formatCurrencyValue(record.unit_price) }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ formatDate(record.last_purchase_date || record.updated_at) }}</div>
                                        </div>
                                    </div>
                                    <div class="mt-3 flex flex-wrap items-center gap-2">
                                        <a v-if="record.purchase_link" :href="record.purchase_link" target="_blank" class="inline-flex text-xs font-medium text-blue-600 hover:text-blue-700">打开采购链接</a>
                                    </div>
                                </div>
                            </div>
                                </div>

                                <div class="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                                    <div class="text-base font-semibold text-slate-900">本期范围说明</div>
                                    <div class="mt-2 text-sm text-slate-500">库存与低库存预警能力仍保留在数据层，但这一期不再作为主界面重点功能展示，避免干扰供应商采购分析主线。</div>
                                    <div class="mt-4 space-y-2 text-sm text-slate-600">
                                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
                                            1. 供应商归属请在台账录入、导入预览或批量编辑时直接指定。
                                        </div>
                                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
                                            2. 供应商月报、年报、采购额走势和商品明细请到“统计报表”页导出。
                                        </div>
                                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
                                            3. 运营页只负责供应商资料协同、导入恢复与报销闭环。
                                        </div>
                                    </div>
                                    <div class="mt-4 flex flex-wrap gap-2">
                                        <button type="button" @click="$root.switchView('reports')" class="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 ease-in-out">
                                            去统计报表
                                        </button>
                                        <button type="button" @click="$root.switchView('ledger')" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                            去台账补供应商
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div id="ops-section-full-imports" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">导入任务中心</h4>
                                    <p class="mt-1 text-sm text-slate-500">记录 OCR / AI 导入任务的执行状态、失败原因和产出条数。</p>
                                </div>
                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                    最近 {{ importTasks.length }} 条
                                </span>
                            </div>

                            <div class="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
                                <div v-if="!importTasks.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    暂无导入任务历史。
                                </div>
                                <div v-for="task in importTasks" :key="task.task_id" class="rounded-lg border border-slate-200 px-4 py-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <div class="truncate text-sm font-semibold text-slate-900">{{ task.file_name || task.task_id }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ task.engine || 'unknown' }} · {{ task.protocol || 'default' }} · {{ formatDateTime(task.created_at) }}</div>
                                        </div>
                                        <span :class="importStatusClass(task.status)" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                            {{ importStatusLabel(task.status) }}
                                        </span>
                                    </div>
                                    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        <div class="rounded-lg bg-slate-50 px-3 py-2">
                                            <div class="text-[11px] text-slate-500">识别条数</div>
                                            <div class="mt-1 font-semibold text-slate-900">{{ formatCount(task.item_count) }}</div>
                                        </div>
                                        <div class="rounded-lg bg-slate-50 px-3 py-2">
                                            <div class="text-[11px] text-slate-500">最后更新时间</div>
                                            <div class="mt-1 font-semibold text-slate-900">{{ formatDateTime(task.updated_at || task.completed_at) }}</div>
                                        </div>
                                    </div>
                                    <div v-if="task.error_detail" class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                        {{ task.error_detail }}
                                    </div>
                                </div>
                            </div>
                                </div>

                                <div id="ops-section-full-invoices" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">发票附件中心与报销闭环</h4>
                                    <p class="mt-1 text-sm text-slate-500">对已开票条目维护报销状态、发票号和附件，形成可追踪闭环。</p>
                                </div>
                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                    最近 {{ invoiceQueue.length }} 条
                                </span>
                            </div>

                            <div class="mt-4 space-y-3 max-h-[720px] overflow-y-auto pr-1">
                                <div v-if="!invoiceQueue.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    暂无待跟进的发票/报销记录。
                                </div>
                                <div v-for="item in invoiceQueue" :key="'invoice-' + item.item_id" class="rounded-xl border border-slate-200 px-4 py-4">
                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="min-w-0">
                                            <div class="text-sm font-semibold text-slate-900">{{ item.item_name || '未命名条目' }}</div>
                                            <div class="mt-1 text-xs text-slate-500">
                                                {{ item.serial_number || '无流水号' }} · {{ item.department || '未分配部门' }} · {{ item.handler || '未填写经办人' }}
                                            </div>
                                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                                    申请日 {{ formatDate(item.request_date) }}
                                                </span>
                                                <span :class="item.invoice_issued ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                                    {{ item.invoice_issued ? '已开票' : '未开票' }}
                                                </span>
                                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                                    {{ item.payment_status || '未设置付款状态' }}
                                                </span>
                                                <span :class="reimbursementClass(ensureInvoiceDraft(item).reimbursement_status)" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                                    {{ reimbursementLabel(ensureInvoiceDraft(item).reimbursement_status) }}
                                                </span>
                                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                                    {{ item.attachment_count || 0 }} 个附件
                                                </span>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                @click="locateInvoiceItem(item)"
                                                class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out"
                                            >
                                                定位台账
                                            </button>
                                            <button
                                                @click="$root.openInvoiceAttachmentPicker(item.item_id)"
                                                :disabled="$root.invoiceAttachmentUploading"
                                                class="h-9 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out"
                                            >
                                                {{ $root.invoiceAttachmentUploading && Number($root.invoiceAttachmentTargetItemId) === Number(item.item_id) ? '上传中...' : '上传附件' }}
                                            </button>
                                        </div>
                                    </div>

                                    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label class="text-xs text-slate-500">
                                            <span class="mb-1 block font-medium text-slate-600">报销状态</span>
                                            <select
                                                :value="ensureInvoiceDraft(item).reimbursement_status"
                                                @change="updateInvoiceDraft(item, 'reimbursement_status', $event.target.value)"
                                                class="h-10 w-full px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            >
                                                <option value="pending">待提交</option>
                                                <option value="submitted">已提交</option>
                                                <option value="reimbursed">已报销</option>
                                            </select>
                                        </label>
                                        <label class="text-xs text-slate-500">
                                            <span class="mb-1 block font-medium text-slate-600">报销日期</span>
                                            <div class="flex gap-2">
                                                <input
                                                    :value="ensureInvoiceDraft(item).reimbursement_date"
                                                    @input="updateInvoiceDraft(item, 'reimbursement_date', $event.target.value)"
                                                    type="date"
                                                    class="h-10 flex-1 px-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                >
                                                <button type="button" @click="fillInvoiceDateToday(item)" class="h-10 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                                    今天
                                                </button>
                                            </div>
                                        </label>
                                        <label class="text-xs text-slate-500">
                                            <span class="mb-1 block font-medium text-slate-600">发票号</span>
                                            <input
                                                :value="ensureInvoiceDraft(item).invoice_number"
                                                @input="updateInvoiceDraft(item, 'invoice_number', $event.target.value)"
                                                type="text"
                                                maxlength="120"
                                                placeholder="填写发票号码"
                                                class="h-10 w-full px-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            >
                                        </label>
                                        <div class="flex items-end">
                                            <button
                                                @click="$root.saveInvoiceRecord(item)"
                                                :disabled="$root.invoiceSavingItemId === item.item_id"
                                                class="h-10 w-full px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out"
                                            >
                                                {{ $root.invoiceSavingItemId === item.item_id ? '保存中...' : '保存报销记录' }}
                                            </button>
                                        </div>
                                        <label class="text-xs text-slate-500 md:col-span-2">
                                            <span class="mb-1 block font-medium text-slate-600">备注</span>
                                            <textarea
                                                :value="ensureInvoiceDraft(item).note"
                                                @input="updateInvoiceDraft(item, 'note', $event.target.value)"
                                                rows="2"
                                                maxlength="500"
                                                placeholder="补充报销说明、附件缺失原因或跟进备注"
                                                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                            ></textarea>
                                        </label>
                                    </div>

                                    <div class="mt-4 space-y-2">
                                        <div class="text-xs font-medium text-slate-600">附件列表</div>
                                        <div v-if="!(item.attachments || []).length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                            暂无附件，支持上传 PDF / PNG / JPG。
                                        </div>
                                        <div v-for="attachment in item.attachments || []" :key="'attachment-' + attachment.id" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                                            <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                                <div class="min-w-0">
                                                    <a :href="attachment.download_url" target="_blank" class="truncate text-sm font-medium text-blue-600 hover:text-blue-700">
                                                        {{ attachment.file_name }}
                                                    </a>
                                                    <div class="mt-1 text-xs text-slate-500">
                                                        {{ formatFileSize(attachment.file_size) }} · {{ formatDateTime(attachment.created_at) }}
                                                    </div>
                                                </div>
                                                <button @click="$root.deleteInvoiceAttachmentRecord(attachment.id)" class="h-8 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-all duration-200 ease-in-out">
                                                    删除附件
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                                </div>

                                <div id="ops-section-full-notifications" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">超期提醒与通知</h4>
                                    <p class="mt-1 text-sm text-slate-500">聚合低库存、导入失败、待报销和执行超期，优先暴露需要处理的风险。</p>
                                </div>
                                <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                    {{ notifications.length }} 条提醒
                                </span>
                            </div>

                            <div class="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
                                <div v-if="!notifications.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    暂无异常提醒。
                                </div>
                                <div
                                    v-for="notification in notifications"
                                    :key="notification.category + '-' + notification.title + '-' + (notification.related_item_id || 'global')"
                                    :class="notificationClass(notification.severity)"
                                    class="rounded-lg border px-4 py-3"
                                >
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <div class="text-sm font-semibold text-slate-900">{{ notificationTitleText(notification) }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ notificationDetailText(notification) }}</div>
                                        </div>
                                        <span class="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700">
                                            {{ notificationSeverityLabel(notification.severity) }}
                                        </span>
                                    </div>
                                    <div class="mt-3 flex items-center justify-between gap-3">
                                        <div class="text-[11px] uppercase tracking-wide text-slate-500">{{ notificationCategoryText(notification.category) }}</div>
                                        <button
                                            v-if="notification.related_item_id"
                                            @click="jumpToNotificationTarget(notification)"
                                            class="h-8 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-all duration-200 ease-in-out"
                                        >
                                            定位台账
                                        </button>
                                    </div>
                                </div>
                            </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
            </section>
        `,
    };
})(window);

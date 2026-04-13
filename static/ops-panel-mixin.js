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

    global.OpsPanelMixin = {
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
            purchaseQueue() {
                return Array.isArray(this.center.purchase_queue) ? this.center.purchase_queue : [];
            },
            receiptQueue() {
                return Array.isArray(this.center.receipt_queue) ? this.center.receipt_queue : [];
            },
            replenishmentRecommendations() {
                return Array.isArray(this.center.replenishment_recommendations)
                    ? this.center.replenishment_recommendations
                    : [];
            },
            actionQueues() {
                return this.center.action_queues || {};
            },
            actionQueueBuckets() {
                return [
                    {
                        key: 'inventory',
                        label: '补货建议',
                        rows: Array.isArray(this.actionQueues.inventory) ? this.actionQueues.inventory : [],
                    },
                    {
                        key: 'purchase',
                        label: '待下单',
                        rows: Array.isArray(this.actionQueues.purchase) ? this.actionQueues.purchase : [],
                    },
                    {
                        key: 'receipt',
                        label: '待收货',
                        rows: Array.isArray(this.actionQueues.receipt) ? this.actionQueues.receipt : [],
                    },
                    {
                        key: 'import',
                        label: '导入恢复',
                        rows: Array.isArray(this.actionQueues.import) ? this.actionQueues.import : [],
                    },
                    {
                        key: 'invoice',
                        label: '报销闭环',
                        rows: Array.isArray(this.actionQueues.invoice) ? this.actionQueues.invoice : [],
                    },
                ];
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
                return Number(this.summary.action_queue_count)
                    || (Array.isArray(this.actionQueues.all) ? this.actionQueues.all.length : 0)
                    || (
                        this.purchaseQueue.length
                        + this.receiptQueue.length
                        + this.pendingInvoices.length
                        + this.failedImportTasks.length
                    );
            },
            activeSubview() {
                return typeof this.$root.currentSubViewFor === 'function'
                    ? this.$root.currentSubViewFor('operations')
                    : 'overview';
            },
            searchQuery() {
                return (this.$root.viewSearchQueryByView?.operations || '').toString();
            },
            visiblePurchaseQueue() {
                return this.purchaseQueue.filter((item) => this.matchesQuery([
                    item?.item_name,
                    item?.serial_number,
                    item?.department,
                    item?.handler,
                    item?.recommended_supplier_name,
                    item?.supplier_name,
                    item?.note,
                ]));
            },
            visibleReceiptQueue() {
                return this.receiptQueue.filter((item) => this.matchesQuery([
                    item?.item_name,
                    item?.supplier_name,
                    item?.recommended_supplier_name,
                    item?.ordered_date,
                    item?.expected_arrival_date,
                    item?.department,
                    item?.handler,
                    item?.note,
                ]));
            },
            visibleReplenishmentRecommendations() {
                return this.replenishmentRecommendations.filter((item) => this.matchesQuery([
                    item?.item_name,
                    item?.recommended_supplier_name,
                    item?.preferred_supplier_name,
                    item?.unit,
                    item?.notes,
                ]));
            },
            visibleActionQueueBuckets() {
                return this.actionQueueBuckets.map((bucket) => ({
                    ...bucket,
                    rows: bucket.rows.filter((row) => this.matchesQuery([
                        row?.title,
                        row?.detail,
                        row?.category,
                        row?.severity,
                        row?.item_name,
                        row?.related_item_id,
                    ])),
                }));
            },
            visibleRecentPriceRecords() {
                return this.recentPriceRecords.filter((record) => this.matchesQuery([
                    record?.item_name,
                    record?.supplier_name,
                    record?.purchase_link,
                    record?.last_serial_number,
                    record?.last_purchase_date,
                ]));
            },
            visiblePriceRecords() {
                return this.priceRecords.filter((record) => this.matchesQuery([
                    record?.item_name,
                    record?.supplier_name,
                    record?.purchase_link,
                    record?.last_serial_number,
                    record?.last_purchase_date,
                    record?.lead_time_days,
                ]));
            },
            visiblePriorityNotifications() {
                return this.priorityNotifications.filter((notification) => this.matchesQuery([
                    notification?.title,
                    notification?.detail,
                    notification?.category,
                    notification?.severity,
                    notification?.related_item_id,
                ]));
            },
            visiblePendingInvoices() {
                return this.pendingInvoices.filter((item) => this.matchesQuery([
                    item?.item_name,
                    item?.serial_number,
                    item?.department,
                    item?.handler,
                    item?.invoice_number,
                    item?.reimbursement_status,
                ]));
            },
            visibleSuppliers() {
                return this.suppliers.filter((supplier) => this.matchesQuery([
                    supplier?.name,
                    supplier?.contact_name,
                    supplier?.contact_phone,
                    supplier?.contact_email,
                    supplier?.notes,
                ]));
            },
            visibleImportRecoveryTasks() {
                return this.importRecoveryTasks.filter((task) => this.matchesQuery([
                    task?.file_name,
                    task?.task_id,
                    task?.engine,
                    task?.protocol,
                    task?.error_detail,
                ]));
            },
            visibleImportTasks() {
                return this.importTasks.filter((task) => this.matchesQuery([
                    task?.file_name,
                    task?.task_id,
                    task?.engine,
                    task?.protocol,
                    task?.status,
                    task?.error_detail,
                ]));
            },
            visibleInvoiceQueue() {
                return this.invoiceQueue.filter((item) => this.matchesQuery([
                    item?.item_name,
                    item?.serial_number,
                    item?.department,
                    item?.handler,
                    item?.invoice_number,
                    item?.reimbursement_status,
                ]));
            },
            visibleNotificationsAll() {
                return this.notifications.filter((notification) => this.matchesQuery([
                    notification?.title,
                    notification?.detail,
                    notification?.category,
                    notification?.severity,
                    notification?.related_item_id,
                ]));
            },
        },
        methods: {
            matchesQuery(values) {
                return typeof this.$root.matchesSearchQuery === 'function'
                    ? this.$root.matchesSearchQuery(values, this.searchQuery)
                    : true;
            },
            isOperationsSubview(id) {
                return this.activeSubview === id;
            },
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
            formatLeadTime(days) {
                const value = Number(days);
                if (!Number.isFinite(value) || value < 0) return '--';
                return `${this.formatCount(value)} 天`;
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
            purchaseStatusLabel(status) {
                return {
                    draft: '待下单',
                    ordered: '已下单',
                    received: '已收货',
                    cancelled: '已取消',
                }[status] || (status || '未知');
            },
            purchaseStatusClass(status) {
                return {
                    draft: 'bg-amber-100 text-amber-700 border-amber-200',
                    ordered: 'bg-blue-100 text-blue-700 border-blue-200',
                    received: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
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
            ensurePurchaseOrderDraft(item) {
                return this.$root.getPurchaseOrderDraft(item);
            },
            updatePurchaseOrderDraft(item, field, value) {
                const draft = this.ensurePurchaseOrderDraft(item);
                draft[field] = value;
                if (field === 'status' && value === 'ordered' && !draft.ordered_date) {
                    draft.ordered_date = global.AppTime ? global.AppTime.todayDateText() : new Date().toISOString().slice(0, 10);
                }
            },
            fillOrderDateToday(item) {
                const draft = this.ensurePurchaseOrderDraft(item);
                draft.ordered_date = global.AppTime ? global.AppTime.todayDateText() : new Date().toISOString().slice(0, 10);
            },
            ensureReceiptDraft(item) {
                return this.$root.getReceiptDraft(item);
            },
            updateReceiptDraft(item, field, value) {
                const draft = this.ensureReceiptDraft(item);
                draft[field] = value;
            },
            fillReceiptDateToday(item) {
                const draft = this.ensureReceiptDraft(item);
                draft.received_date = global.AppTime ? global.AppTime.todayDateText() : new Date().toISOString().slice(0, 10);
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
            locateQueueItem(item) {
                const itemId = Number(item?.item_id || item?.related_item_id || 0);
                if (!itemId) return;
                this.$root.jumpToLedgerItem(itemId, item, {
                    closeDataQualityModal: false,
                    successMessage: `已定位到条目 #${itemId}`,
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
            // Simplified: no <details> to open, just scroll to element
            openSection(targetId) {
                window.setTimeout(() => {
                    const element = document.getElementById(targetId);
                    if (element && typeof element.scrollIntoView === 'function') {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 40);
            },
            openMasterData(targetId = 'ops-section-master-sourcing') {
                this.openSection(targetId);
            },
            openFullFollowup(innerId = 'ops-section-full-imports') {
                this.openSection(innerId);
            },
            copyPriceLink(record) {
                if (!record?.purchase_link) {
                    this.$root.showToast('该物品暂未配置采购链接', 'error');
                    return;
                }
                this.$root.copyPurchaseLink(record.purchase_link);
            },
        },
    };
})(window);

(function (global) {
    const formatSidebarBadgeCount = (value) => {
        const number = Number(value || 0);
        if (!Number.isFinite(number) || number <= 0) return '';
        if (number >= 100) return '99+';
        return String(Math.round(number));
    };

    global.AppState = {
        data() {
                return {
                    items: [],
                    totalItems: 0,
                    stats: { total: 0, statusCount: {}, paymentCount: {}, invoiceCount: { issued: 0, notIssued: 0 }},
                    statuses: ['待采购', '待到货', '待分发', '已分发'],
                    departments: [],
                    handlers: [],
                    supplierOptions: [],
                    paymentStatuses: ['未付款', '已付款', '已报销'],
                    filterKeyword: '',
                    filterStatus: '',
                    filterDepartment: '',
                    filterMonth: '',
                    appVersion: '',
                    authInitialized: false,
                    isAuthenticated: false,
                    authView: 'loading',
                    authLoading: false,
                    authLockSeconds: 0,
                    authMessage: '',
                    authSetupPassword: '',
                    authSetupPasswordConfirm: '',
                    authLoginPassword: '',
                    authRecoveryCode: '',
                    authRecoveryNewPassword: '',
                    showRecoveryCodeModal: false,
                    newRecoveryCode: '',
                    authInterceptorInstalled: false,
                    authBootstrapped: false,
                    authIdleTimeoutMs: 30 * 60 * 1000,
                    authIdleTimer: null,
                    authLockTimer: null,
                    authActivityHandler: null,
                    currentView: 'dashboard',
                    currentSubViewByView: {
                        operations: '',
                        reports: '',
                    },
                    viewSearchQueryByView: {
                        operations: '',
                        reports: '',
                    },
                    executionLoading: false,
                    boardKeyword: '',
                    boardDepartment: '',
                    boardMonth: '',
                    executionBoard: {
                        columns: [],
                        total: 0,
                        limitPerStatus: 80,
                    },
                    draggingExecutionId: null,
                    draggingExecutionFromKey: '',
                    executionDropTargetKey: '',
                    reportsInitialized: false,
                    auditInitialized: false,
                    executionInitialized: false,
                    operationsCenterInitialized: false,
                    operationsCenterLoading: false,
                    operationsCenterLastLoadedAt: '',
                    hashChangeListener: null,
                    currentPage: 1,
                    pageSize: 20,
                    pageSizeOptions: [20, 50, 100],
                    jumpPage: null,
                    inlineEditId: null,
                    inlineEditField: '',
                    inlineEditCommitting: false,
                    inlineEditRefs: {},
                    toasts: [],
                    nextToastId: 1,
                    toastTimers: [],
                    confirmModalVisible: false,
                    confirmModalTitle: '请确认',
                    confirmModalMessage: '',
                    confirmModalConfirmText: '确认',
                    confirmModalCancelText: '取消',
                    confirmModalDanger: false,
                    confirmModalResolver: null,
                    uploading: false,
                    uploadTaskId: '',
                    uploadPollTimer: null,
                    uploadPollInFlight: false,
                    uploadStatusText: '智能深度扫描中，请稍候',
                    restoring: false,
                    importSubmitting: false,
                    parseResult: null,
                    error: null,
                    showAddModal: false,
                    showWebdavModal: false,
                    webdavLoading: false,
                    webdavConfig: {
                        configured: false,
                        baseUrl: '',
                        username: '',
                        password: '',
                        remoteDir: '',
                        keepBackups: 0,
                        hasPassword: false,
                    },
                    webdavBackups: [],
                    webdavSelectedBackup: '',
                    showRecycleBinModal: false,
                    recycleBinLoading: false,
                    recycleBinKeyword: '',
                    recycleBinItems: [],
                    recycleBinTotal: 0,
                    recycleBinPage: 1,
                    recycleBinPageSize: 20,
                    showDataQualityModal: false,
                    dataQualityLoading: false,
                    dataQualityLimit: 200,
                    dataQualityReport: {
                        summary: {},
                        issues: [],
                        duplicates: [],
                        scannedRows: 0,
                    },
                    focusedLedgerItemId: null,
                    focusedLedgerItemTimer: null,
                    showImportPreviewModal: false,
                    selectedItems: [],
                    selectAll: false,
                    batchEditField: '',
                    batchEditValue: '',
                    showDuplicateModal: false,
                    pendingDuplicates: [],
                    pendingParsedData: null,
                    pendingParseMeta: null,
                    amountReportLoading: false,
                    amountReport: {
                        summary: {
                            totalRecords: 0,
                            totalAmount: 0,
                            pricedAmount: 0,
                            missingPriceRecords: 0
                        },
                        byDepartment: [],
                        byStatus: [],
                        byMonth: []
                    },
                    operationsReport: {
                        funnel: [],
                        cycleDistribution: {
                            requestToArrival: {
                                buckets: [],
                                averageDays: 0,
                                sampleSize: 0,
                            },
                            arrivalToDistribution: {
                                buckets: [],
                                averageDays: 0,
                                sampleSize: 0,
                            },
                        },
                        monthlyAmountTrend: [],
                        tracker: {
                            summary: {
                                toOrderCount: 0,
                                waitingReceiptCount: 0,
                                pendingInvoiceCount: 0,
                                replenishmentCount: 0,
                                actionQueueCount: 0,
                                overdueReceiptCount: 0,
                            },
                            queues: {
                                toOrder: [],
                                waitingReceipt: [],
                                pendingInvoice: [],
                            },
                            supplierLeadTimeTrend: [],
                        },
                    },
                    supplierReportYear: String(new Date().getFullYear()),
                    supplierReportFocusKey: '',
                    supplierReport: {
                        selectedYear: '',
                        summary: {
                            totalRecords: 0,
                            supplierCount: 0,
                            assignedRecords: 0,
                            unassignedRecords: 0,
                            totalAmount: 0,
                            assignedAmount: 0,
                            unassignedAmount: 0,
                        },
                        topSuppliers: [],
                        monthlyTrend: [],
                        yearlySummary: [],
                        supplierItems: [],
                        unassignedItems: [],
                    },
                    historyLoading: false,
                    historyItems: [],
                    historyTotal: 0,
                    historyPage: 1,
                    historyPageSize: 20,
                    historyKeyword: '',
                    historyAction: '',
                    historyMonth: '',
                    showLedgerDetailModal: false,
                    ledgerDetailItem: null,
                    ledgerDetailLoading: false,
                    ledgerDetailAuditLoading: false,
                    ledgerDetailAuditLogs: [],
                    ledgerDetailAuditTotal: 0,
                    ledgerDetailAuditPage: 1,
                    ledgerDetailAuditPageSize: 20,
                    importPreview: {
                        serial_number: '',
                        department: '',
                        handler: '',
                        request_date: '',
                        items: []
                    },
                    importMeta: {
                        parse_mode: '',
                        fallbacks_used: [],
                        warnings: [],
                        missing_fields: [],
                        suspect_rows: [],
                    },
                    operationsCenter: {
                        summary: {
                            supplier_count: 0,
                            price_record_count: 0,
                            inventory_profile_count: 0,
                            low_stock_count: 0,
                            import_task_count: 0,
                            failed_import_count: 0,
                            pending_reimbursement_count: 0,
                            open_purchase_count: 0,
                            pending_receipt_count: 0,
                            replenishment_recommendation_count: 0,
                            action_queue_count: 0,
                            notification_count: 0,
                        },
                        suppliers: [],
                        price_records: [],
                        inventory_profiles: [],
                        import_tasks: [],
                        purchase_queue: [],
                        receipt_queue: [],
                        replenishment_recommendations: [],
                        supplier_lead_time_trend: [],
                        action_queues: {
                            inventory: [],
                            purchase: [],
                            receipt: [],
                            import: [],
                            invoice: [],
                            all: [],
                        },
                        invoice_queue: [],
                        notifications: [],
                    },
                    newSupplier: {
                        name: '',
                        contact_name: '',
                        contact_phone: '',
                        contact_email: '',
                        notes: '',
                        is_active: true,
                    },
                    newPriceRecord: {
                        item_name: '',
                        supplier_id: '',
                        unit_price: '',
                        purchase_link: '',
                        last_purchase_date: '',
                        last_serial_number: '',
                        lead_time_days: '',
                    },
                    newInventoryProfile: {
                        item_name: '',
                        current_stock: 0,
                        low_stock_threshold: 0,
                        unit: '',
                        preferred_supplier_id: '',
                        reorder_quantity: 0,
                        notes: '',
                    },
                    inventoryEditingItemName: '',
                    invoiceAttachmentTargetItemId: null,
                    purchaseOrderDrafts: {},
                    receiptDrafts: {},
                    invoiceDrafts: {},
                    invoiceAttachmentUploading: false,
                    purchaseOrderSavingItemId: null,
                    purchaseReceiptSavingOrderId: null,
                    invoiceSavingItemId: null,
                    supplierSaving: false,
                    priceSaving: false,
                    inventorySaving: false,
                    operationsError: '',
                    newItem: {
                        serial_number: '', department: '', handler: '',
                        request_date: global.AppTime ? global.AppTime.todayDateText() : '',
                        supplier_id: '',
                        item_name: '', quantity: 1, unit_price: null, purchase_link: ''
                    },
                };
            },
        computed: {
                totalPages() { return Math.max(1, Math.ceil(this.totalItems / this.pageSize)); },
                latestItems() {
                    return [...(this.items || [])]
                        .sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0))
                        .slice(0, 5);
                },
                pageRangeStart() {
                    if (!this.totalItems) return 0;
                    return (this.currentPage - 1) * this.pageSize + 1;
                },
                pageRangeEnd() {
                    if (!this.totalItems) return 0;
                    return Math.min(this.currentPage * this.pageSize, this.totalItems);
                },
                navPrimaryViews() {
                    return window.AppViewConfig?.primaryNav || [];
                },
                navSecondaryViews() {
                    return window.AppViewConfig?.secondaryNav || [];
                },
                currentViewMeta() {
                    const config = window.AppViewConfig?.views || {};
                    return config[this.currentView] || config.dashboard || {
                        id: 'dashboard',
                        title: '\u6982\u89c8\u770b\u677f',
                    };
                },
                currentViewSubViews() {
                    return Array.isArray(this.currentViewMeta?.subviews)
                        ? this.currentViewMeta.subviews
                        : [];
                },
                operationsSubviewBadgeMap() {
                    const center = this.operationsCenter || {};
                    const summary = center.summary || {};
                    const purchaseQueue = Array.isArray(center.purchase_queue) ? center.purchase_queue : [];
                    const receiptQueue = Array.isArray(center.receipt_queue) ? center.receipt_queue : [];
                    const replenishment = Array.isArray(center.replenishment_recommendations)
                        ? center.replenishment_recommendations
                        : [];
                    const importTasks = Array.isArray(center.import_tasks) ? center.import_tasks : [];
                    const notifications = Array.isArray(center.notifications) ? center.notifications : [];
                    const invoiceQueue = Array.isArray(center.invoice_queue) ? center.invoice_queue : [];
                    const importRecoveryCount = importTasks.filter((task) => task?.status !== 'completed').length;
                    const pendingInvoiceCount = invoiceQueue.filter((item) => item?.reimbursement_status !== 'reimbursed').length;
                    const actionQueueCount = Number(summary.action_queue_count)
                        || (Array.isArray(center.action_queues?.all) ? center.action_queues.all.length : 0)
                        || (purchaseQueue.length + receiptQueue.length + importRecoveryCount + pendingInvoiceCount);
                    return {
                        overview: actionQueueCount || null,
                        procurement: (purchaseQueue.length + receiptQueue.length + replenishment.length) || null,
                        'master-data': null,
                        exceptions: (importRecoveryCount + pendingInvoiceCount + notifications.length) || null,
                    };
                },
                reportsSubviewBadgeMap() {
                    const trackerSummary = this.operationsReport?.tracker?.summary || {};
                    const supplierSummary = this.supplierReport?.summary || {};
                    return {
                        overview: null,
                        tracker: (
                            (Number(trackerSummary.toOrderCount) || 0)
                            + (Number(trackerSummary.waitingReceiptCount) || 0)
                            + (Number(trackerSummary.pendingInvoiceCount) || 0)
                        ) || null,
                        suppliers: Number(supplierSummary.unassignedRecords) || null,
                        efficiency: null,
                    };
                },
                currentViewSidebarSubViews() {
                    const activeId = typeof this.currentSubViewFor === 'function'
                        ? this.currentSubViewFor(this.currentView)
                        : (this.currentSubViewByView?.[this.currentView] || '');
                    const badgeMap = this.currentView === 'operations'
                        ? this.operationsSubviewBadgeMap
                        : (this.currentView === 'reports' ? this.reportsSubviewBadgeMap : {});
                    return this.currentViewSubViews.map((subview) => {
                        const badgeCount = badgeMap?.[subview.id] ?? null;
                        return {
                            ...subview,
                            isActive: activeId === subview.id,
                            badgeCount,
                            badgeLabel: formatSidebarBadgeCount(badgeCount),
                        };
                    });
                },
                currentViewHasSubViews() {
                    return this.currentViewSubViews.length > 0;
                },
                currentSubViewMeta() {
                    if (!this.currentViewHasSubViews) {
                        return {
                            id: '',
                            label: '',
                            title: this.currentViewMeta?.title || '',
                            description: '',
                            searchEnabled: false,
                            searchPlaceholder: '',
                        };
                    }
                    const currentId = typeof this.currentSubViewFor === 'function'
                        ? this.currentSubViewFor(this.currentView)
                        : (this.currentSubViewByView?.[this.currentView] || '');
                    return this.currentViewSubViews.find((subview) => subview.id === currentId)
                        || this.currentViewSubViews[0]
                        || {
                            id: '',
                            label: '',
                            title: this.currentViewMeta?.title || '',
                            description: '',
                            searchEnabled: false,
                            searchPlaceholder: '',
                        };
                },
                currentViewSearchQuery() {
                    return (this.viewSearchQueryByView?.[this.currentView] || '').toString();
                },
                currentViewSearchEnabled() {
                    return !!this.currentSubViewMeta?.searchEnabled;
                },
                currentViewSearchPlaceholder() {
                    return (this.currentSubViewMeta?.searchPlaceholder || '').toString();
                },
                pageTokens() {
                    const total = this.totalPages;
                    const current = this.currentPage;
                    if (total <= 7) {
                        return Array.from({ length: total }, (_, i) => i + 1);
                    }

                    const pages = new Set([1, total, current - 1, current, current + 1]);
                    if (current <= 3) {
                        pages.add(2);
                        pages.add(3);
                        pages.add(4);
                    }
                    if (current >= total - 2) {
                        pages.add(total - 1);
                        pages.add(total - 2);
                        pages.add(total - 3);
                    }

                    const sorted = [...pages]
                        .filter((page) => page >= 1 && page <= total)
                        .sort((a, b) => a - b);

                    const tokens = [];
                    let prev = 0;
                    for (const page of sorted) {
                        if (prev && page - prev > 1) {
                            tokens.push('ellipsis');
                        }
                        tokens.push(page);
                        prev = page;
                    }
                    return tokens;
                },
                historyTotalPages() {
                    return Math.max(1, Math.ceil(this.historyTotal / this.historyPageSize));
                },
                ledgerDetailAuditTotalPages() {
                    return Math.max(1, Math.ceil(this.ledgerDetailAuditTotal / this.ledgerDetailAuditPageSize));
                },
                authLockCountdownText() {
                    const total = Number(this.authLockSeconds) || 0;
                    if (total <= 0) return '';
                    const minutes = Math.floor(total / 60);
                    const seconds = total % 60;
                    return `${minutes}:${String(seconds).padStart(2, '0')}`;
                },
                reportDepartmentRows() {
                    const rows = Array.isArray(this.amountReport?.byDepartment)
                        ? this.amountReport.byDepartment
                        : [];
                    const normalized = rows.map((row, idx) => {
                        const amount = Number(row?.total_amount) || 0;
                        return {
                            ...row,
                            _rank: idx + 1,
                            _amount: amount,
                        };
                    });
                    const maxAmount = normalized.reduce(
                        (max, row) => Math.max(max, row._amount),
                        0
                    );
                    const totalAmount = Number(this.amountReport?.summary?.totalAmount) || 0;
                    return normalized
                        .sort((a, b) => b._amount - a._amount)
                        .slice(0, 10)
                        .map((row, idx) => ({
                            ...row,
                            _rank: idx + 1,
                            _ratio: maxAmount > 0 ? (row._amount / maxAmount) * 100 : 0,
                            _share: totalAmount > 0 ? (row._amount / totalAmount) * 100 : 0,
                        }));
                },
                reportStatusRows() {
                    const palette = [
                        '#f59e0b',
                        '#2563eb',
                        '#0891b2',
                        '#4f46e5',
                        '#16a34a',
                        '#64748b',
                    ];
                    const rows = Array.isArray(this.amountReport?.byStatus)
                        ? this.amountReport.byStatus
                        : [];
                    const normalized = rows.map((row, idx) => ({
                        ...row,
                        _amount: Number(row?.total_amount) || 0,
                        _color: palette[idx % palette.length],
                    }));
                    const totalAmount = normalized.reduce((sum, row) => sum + row._amount, 0);
                    return normalized.map((row) => ({
                        ...row,
                        _share: totalAmount > 0 ? (row._amount / totalAmount) * 100 : 0,
                    }));
                },
                reportStatusDonutStyle() {
                    const rows = this.reportStatusRows;
                    if (!rows.length) {
                        return { background: '#e2e8f0' };
                    }
                    const totalShare = rows.reduce((sum, row) => sum + row._share, 0);
                    if (totalShare <= 0) {
                        return { background: '#e2e8f0' };
                    }
                    let cursor = 0;
                    const segments = rows.map((row) => {
                        const start = cursor;
                        cursor += row._share;
                        const end = Math.min(100, cursor);
                        return `${row._color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
                    });
                    return {
                        background: `conic-gradient(${segments.join(', ')})`,
                    };
                },
                reportMonthRows() {
                    const rows = Array.isArray(this.amountReport?.byMonth)
                        ? this.amountReport.byMonth
                        : [];
                    const normalized = rows
                        .map((row) => ({
                            ...row,
                            _amount: Number(row?.total_amount) || 0,
                        }))
                        .sort((a, b) => String(a?.month || '').localeCompare(String(b?.month || '')))
                        .slice(-12);
                    const maxAmount = normalized.reduce((max, row) => Math.max(max, row._amount), 0);
                    return normalized.map((row) => ({
                        ...row,
                        _barHeight: maxAmount > 0 ? Math.max(16, (row._amount / maxAmount) * 150) : 16,
                    }));
                },
                reportFunnelRows() {
                    const rows = Array.isArray(this.operationsReport?.funnel)
                        ? this.operationsReport.funnel
                        : [];
                    const normalized = rows.map((row) => ({
                        ...row,
                        _count: Number(row?.count) || 0,
                    }));
                    const maxCount = normalized.reduce((max, row) => Math.max(max, row._count), 0);
                    const firstCount = Number(normalized[0]?._count) || 0;
                    return normalized.map((row, idx) => ({
                        ...row,
                        _ratio: maxCount > 0 ? (row._count / maxCount) * 100 : 0,
                        _conversion: firstCount > 0 ? (row._count / firstCount) * 100 : 0,
                        _stepDrop: idx > 0 ? Math.max(0, (normalized[idx - 1]?._count || 0) - row._count) : 0,
                    }));
                },
                requestToArrivalRows() {
                    const rows = Array.isArray(this.operationsReport?.cycleDistribution?.requestToArrival?.buckets)
                        ? this.operationsReport.cycleDistribution.requestToArrival.buckets
                        : [];
                    const normalized = rows.map((row) => ({
                        ...row,
                        _count: Number(row?.count) || 0,
                    }));
                    const maxCount = normalized.reduce((max, row) => Math.max(max, row._count), 0);
                    return normalized.map((row) => ({
                        ...row,
                        _ratio: maxCount > 0 ? (row._count / maxCount) * 100 : 0,
                    }));
                },
                arrivalToDistributionRows() {
                    const rows = Array.isArray(this.operationsReport?.cycleDistribution?.arrivalToDistribution?.buckets)
                        ? this.operationsReport.cycleDistribution.arrivalToDistribution.buckets
                        : [];
                    const normalized = rows.map((row) => ({
                        ...row,
                        _count: Number(row?.count) || 0,
                    }));
                    const maxCount = normalized.reduce((max, row) => Math.max(max, row._count), 0);
                    return normalized.map((row) => ({
                        ...row,
                        _ratio: maxCount > 0 ? (row._count / maxCount) * 100 : 0,
                    }));
                },
                reportMonthlyTrendRows() {
                    const rows = Array.isArray(this.operationsReport?.monthlyAmountTrend)
                        ? this.operationsReport.monthlyAmountTrend
                        : [];
                    const normalized = rows
                        .map((row) => {
                            const totalAmount = Number(row?.totalAmount) || 0;
                            const paidAmount = Number(row?.paidAmount) || 0;
                            const unpaidAmount = Number(row?.unpaidAmount) || 0;
                            return {
                                ...row,
                                _totalAmount: totalAmount,
                                _paidAmount: paidAmount,
                                _unpaidAmount: unpaidAmount,
                            };
                        })
                        .sort((a, b) => String(a?.month || '').localeCompare(String(b?.month || '')))
                        .slice(-12);

                    const maxAmount = normalized.reduce((max, row) => Math.max(max, row._totalAmount), 0);
                    const maxHeight = 150;
                    return normalized.map((row) => {
                        const totalHeight = maxAmount > 0 ? (row._totalAmount / maxAmount) * maxHeight : 0;
                        const displayHeight = row._totalAmount > 0 ? Math.max(16, totalHeight) : 0;
                        const otherAmount = Math.max(0, row._totalAmount - row._paidAmount - row._unpaidAmount);
                        const baseAmount = row._totalAmount > 0 ? row._totalAmount : 1;
                        const paidHeight = displayHeight * (row._paidAmount / baseAmount);
                        const unpaidHeight = displayHeight * (row._unpaidAmount / baseAmount);
                        const otherHeight = displayHeight * (otherAmount / baseAmount);
                        return {
                            ...row,
                            _otherAmount: otherAmount,
                            _totalHeight: displayHeight,
                            _paidHeight: row._paidAmount > 0 ? paidHeight : 0,
                            _unpaidHeight: row._unpaidAmount > 0 ? unpaidHeight : 0,
                            _otherHeight: otherAmount > 0 ? otherHeight : 0,
                        };
                    });
                },
                supplierFocusOptions() {
                    const rows = [
                        ...(Array.isArray(this.supplierReport?.topSuppliers) ? this.supplierReport.topSuppliers : []),
                        ...(Array.isArray(this.supplierReport?.monthlyTrend) ? this.supplierReport.monthlyTrend : []),
                    ];
                    const seen = new Set();
                    const options = [];

                    const masterSuppliers = Array.isArray(this.supplierOptions) ? this.supplierOptions : [];
                    for (const supplier of masterSuppliers) {
                        const supplierId = Number(supplier?.id);
                        const supplierName = (supplier?.name || '').toString().trim();
                        if (!Number.isFinite(supplierId) || supplierId <= 0 || !supplierName) {
                            continue;
                        }
                        const key = `id:${supplierId}`;
                        if (seen.has(key)) {
                            continue;
                        }
                        seen.add(key);
                        options.push({
                            key,
                            label: supplierName,
                        });
                    }

                    return rows.reduce((acc, row) => {
                        const supplierId = Number(row?.supplierId);
                        const supplierName = (row?.supplierName || '未归属供应商').toString();
                        const key = Number.isFinite(supplierId) && supplierId > 0
                            ? `id:${supplierId}`
                            : `name:${supplierName}`;
                        if (seen.has(key)) {
                            return acc;
                        }
                        seen.add(key);
                        acc.push({
                            key,
                            label: supplierName,
                        });
                        return acc;
                    }, options);
                },
                supplierEffectiveFocusKey() {
                    const explicit = (this.supplierReportFocusKey || '').toString().trim();
                    if (explicit && this.supplierFocusOptions.some((option) => option.key === explicit)) {
                        return explicit;
                    }
                    return this.supplierFocusOptions[0]?.key || '';
                },
                supplierTopRows() {
                    const rows = Array.isArray(this.supplierReport?.topSuppliers)
                        ? this.supplierReport.topSuppliers
                        : [];
                    const normalized = rows.map((row, idx) => ({
                        ...row,
                        _rank: idx + 1,
                        _amount: Number(row?.totalAmount) || 0,
                    }));
                    const maxAmount = normalized.reduce((max, row) => Math.max(max, row._amount), 0);
                    const totalAmount = Number(this.supplierReport?.summary?.assignedAmount) || 0;
                    return normalized.map((row) => ({
                        ...row,
                        _ratio: maxAmount > 0 ? (row._amount / maxAmount) * 100 : 0,
                        _share: totalAmount > 0 ? (row._amount / totalAmount) * 100 : 0,
                    }));
                },
                supplierFocusTrendRows() {
                    const selectedKey = this.supplierEffectiveFocusKey;
                    const rows = Array.isArray(this.supplierReport?.monthlyTrend)
                        ? this.supplierReport.monthlyTrend
                        : [];
                    const filtered = rows
                        .filter((row) => {
                            const supplierId = Number(row?.supplierId);
                            const supplierName = (row?.supplierName || '未归属供应商').toString();
                            const rowKey = Number.isFinite(supplierId) && supplierId > 0
                                ? `id:${supplierId}`
                                : `name:${supplierName}`;
                            return !selectedKey || rowKey === selectedKey;
                        })
                        .map((row) => ({
                            ...row,
                            _amount: Number(row?.totalAmount) || 0,
                        }))
                        .sort((a, b) => String(a?.month || '').localeCompare(String(b?.month || '')))
                        .slice(-12);
                    const maxAmount = filtered.reduce((max, row) => Math.max(max, row._amount), 0);
                    return filtered.map((row) => ({
                        ...row,
                        _barHeight: maxAmount > 0 ? Math.max(16, (row._amount / maxAmount) * 150) : 16,
                    }));
                },
                supplierYearOverviewRows() {
                    const sourceRows = Array.isArray(this.supplierReport?.yearlySummary)
                        ? this.supplierReport.yearlySummary
                        : [];
                    const totals = new Map();
                    for (const row of sourceRows) {
                        const year = (row?.year || '').toString();
                        if (!year) continue;
                        const existing = totals.get(year) || {
                            year,
                            totalAmount: 0,
                            recordCount: 0,
                            supplierCount: 0,
                            _supplierKeys: new Set(),
                        };
                        existing.totalAmount += Number(row?.totalAmount) || 0;
                        existing.recordCount += Number(row?.recordCount) || 0;
                        const supplierId = Number(row?.supplierId);
                        const supplierKey = Number.isFinite(supplierId) && supplierId > 0
                            ? `id:${supplierId}`
                            : `name:${(row?.supplierName || '未归属供应商').toString()}`;
                        existing._supplierKeys.add(supplierKey);
                        totals.set(year, existing);
                    }
                    const rows = [...totals.values()]
                        .map((row) => ({
                            ...row,
                            supplierCount: row._supplierKeys.size,
                            _amount: Number(row.totalAmount) || 0,
                        }))
                        .sort((a, b) => String(a.year).localeCompare(String(b.year)))
                        .slice(-5);
                    const maxAmount = rows.reduce((max, row) => Math.max(max, row._amount), 0);
                    return rows.map((row) => ({
                        ...row,
                        _barHeight: maxAmount > 0 ? Math.max(16, (row._amount / maxAmount) * 120) : 16,
                    }));
                },
                supplierFocusItemRows() {
                    const selectedKey = this.supplierEffectiveFocusKey;
                    const rows = Array.isArray(this.supplierReport?.supplierItems)
                        ? this.supplierReport.supplierItems
                        : [];
                    const filtered = rows.filter((row) => {
                        if (!selectedKey) return true;
                        const supplierId = Number(row?.supplierId);
                        const supplierName = (row?.supplierName || '未归属供应商').toString();
                        const rowKey = Number.isFinite(supplierId) && supplierId > 0
                            ? `id:${supplierId}`
                            : `name:${supplierName}`;
                        return rowKey === selectedKey;
                    });
                    return filtered
                        .map((row) => ({
                            ...row,
                            _amount: Number(row?.totalAmount) || 0,
                        }))
                        .sort((a, b) => b._amount - a._amount)
                        .slice(0, 12);
                },
                supplierUnassignedRows() {
                    return Array.isArray(this.supplierReport?.unassignedItems)
                        ? this.supplierReport.unassignedItems.slice(0, 12)
                        : [];
                },
                reportSearchQuery() {
                    return (this.viewSearchQueryByView?.reports || '').toString();
                },
                reportTrackerToOrderRows() {
                    const rows = Array.isArray(this.operationsReport?.tracker?.queues?.toOrder)
                        ? this.operationsReport.tracker.queues.toOrder
                        : [];
                    return rows.filter((row) => this.matchesSearchQuery([
                        row?.itemName,
                        row?.requestDate,
                        row?.department,
                        row?.handler,
                        row?.recommendedSupplierName,
                        row?.serialNumber,
                    ], this.reportSearchQuery));
                },
                reportTrackerWaitingReceiptRows() {
                    const rows = Array.isArray(this.operationsReport?.tracker?.queues?.waitingReceipt)
                        ? this.operationsReport.tracker.queues.waitingReceipt
                        : [];
                    return rows.filter((row) => this.matchesSearchQuery([
                        row?.itemName,
                        row?.supplierName,
                        row?.orderedDate,
                        row?.expectedArrivalDate,
                    ], this.reportSearchQuery));
                },
                reportTrackerPendingInvoiceRows() {
                    const rows = Array.isArray(this.operationsReport?.tracker?.queues?.pendingInvoice)
                        ? this.operationsReport.tracker.queues.pendingInvoice
                        : [];
                    return rows.filter((row) => this.matchesSearchQuery([
                        row?.itemName,
                        row?.requestDate,
                        row?.invoiceNumber,
                        row?.reimbursementStatus,
                    ], this.reportSearchQuery));
                },
                reportTrackerLeadTimeRows() {
                    const rows = Array.isArray(this.operationsReport?.tracker?.supplierLeadTimeTrend)
                        ? this.operationsReport.tracker.supplierLeadTimeTrend
                        : [];
                    return rows.filter((row) => this.matchesSearchQuery([
                        row?.supplierName,
                        row?.itemName,
                        row?.latestPurchaseDate,
                    ], this.reportSearchQuery));
                },
                visibleSupplierTopRows() {
                    return this.supplierTopRows.filter((row) => this.matchesSearchQuery([
                        row?.supplierName,
                        row?.recordCount,
                        row?.itemCount,
                    ], this.reportSearchQuery));
                },
                visibleSupplierFocusItemRows() {
                    return this.supplierFocusItemRows.filter((row) => this.matchesSearchQuery([
                        row?.supplierName,
                        row?.itemName,
                        row?.recordCount,
                        row?.department,
                    ], this.reportSearchQuery));
                },
                visibleSupplierUnassignedRows() {
                    return this.supplierUnassignedRows.filter((row) => this.matchesSearchQuery([
                        row?.itemName,
                        row?.requestDate,
                        row?.department,
                        row?.handler,
                    ], this.reportSearchQuery));
                },
            },
        watch: {
            },
        async mounted() {
                // 清理旧版云端配置 localStorage 键（本地离线模式不再需要这些）
                try {
                    const staleKeys = ['ocr_engine', 'llm_protocol', 'llm_config_migrated_v2'];
                    for (const key of staleKeys) {
                        window.localStorage.removeItem(key);
                    }
                    for (const proto of ['openai', 'google', 'anthropic']) {
                        for (const field of ['api_key', 'model_name', 'base_url']) {
                            window.localStorage.removeItem(`llm_${proto}_${field}`);
                            window.localStorage.removeItem(`llm_${field}`);
                        }
                    }
                    for (const field of ['api_key', 'model_name', 'base_url']) {
                        window.localStorage.removeItem(`gemini_${field}`);
                    }
                } catch (_) {}
                if (typeof this.loadAppMetadata === 'function') {
                    await this.loadAppMetadata();
                }
                if (typeof this.initializeAuthLayer === 'function') {
                    await this.initializeAuthLayer();
                }
            },
        beforeUnmount() {
                if (typeof this.teardownIdleWatcher === 'function') {
                    this.teardownIdleWatcher();
                }
                if (this.hashChangeListener) {
                    window.removeEventListener('hashchange', this.hashChangeListener);
                    this.hashChangeListener = null;
                }
                if (this.authLockTimer) {
                    clearInterval(this.authLockTimer);
                    this.authLockTimer = null;
                }
                for (const timer of this.toastTimers) {
                    clearTimeout(timer);
                }
                this.toastTimers = [];
                if (this.confirmModalResolver) {
                    this.confirmModalResolver(false);
                    this.confirmModalResolver = null;
                }
                if (this.uploadPollTimer) {
                    clearInterval(this.uploadPollTimer);
                    this.uploadPollTimer = null;
                }
                if (this.focusedLedgerItemTimer) {
                    clearTimeout(this.focusedLedgerItemTimer);
                    this.focusedLedgerItemTimer = null;
                }
            },
    };
})(window);

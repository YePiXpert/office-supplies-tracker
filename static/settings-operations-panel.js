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
            inventoryProfiles() {
                return Array.isArray(this.center.inventory_profiles) ? this.center.inventory_profiles : [];
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
            criticalNotificationCount() {
                return this.notifications.filter((row) => row?.severity === 'critical').length;
            },
            warningNotificationCount() {
                return this.notifications.filter((row) => row?.severity === 'warning').length;
            },
            noticeNotificationCount() {
                return this.notifications.filter((row) => row?.severity === 'notice').length;
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
            supplierNameById(supplierId) {
                const id = Number(supplierId || 0);
                if (!id) return '未指定';
                const matched = this.suppliers.find((supplier) => Number(supplier?.id) === id);
                return matched?.name || '未指定';
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
            resetInventoryForm() {
                this.$root.resetNewInventoryProfileForm();
            },
            startInventoryEdit(profile) {
                this.$root.prefillInventoryProfileForm(profile || {});
            },
            seedInventoryFromPriceRecord(record) {
                this.$root.prefillInventoryProfileForm({
                    item_name: record?.item_name || '',
                    current_stock: 0,
                    low_stock_threshold: 0,
                    unit: '',
                    preferred_supplier_id: record?.supplier_id || '',
                    notes: record?.purchase_link ? `参考采购链接：${record.purchase_link}` : '',
                });
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
                        <h3 class="text-xl font-semibold tracking-tight text-slate-900">运营中心</h3>
                        <p class="mt-1 text-sm text-slate-500">把供应商与价格库、库存预警、导入任务、发票附件和超期提醒收口到同一处运营面板。</p>
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

                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div class="text-sm font-semibold text-slate-900">建议验收路径</div>
                            <div class="mt-1 text-xs text-slate-500">按这 3 步走一遍，就能比较完整地确认运营中心的一期链路已经跑通。</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">严重 {{ criticalNotificationCount }}</span>
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">提醒 {{ warningNotificationCount }}</span>
                            <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">关注 {{ noticeNotificationCount }}</span>
                        </div>
                    </div>
                    <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 1</div>
                            <div class="mt-1 text-sm font-semibold text-slate-900">先建立供应商与价格基线</div>
                            <div class="mt-1 text-xs text-slate-500">新增 1 个供应商，再录入 1 条价格记录，确认列表与统计同步刷新。</div>
                        </div>
                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2</div>
                            <div class="mt-1 text-sm font-semibold text-slate-900">补库存并验证预警</div>
                            <div class="mt-1 text-xs text-slate-500">建立库存档案，把当前库存设到阈值以下，确认低库存卡片和通知会出现。</div>
                        </div>
                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 3</div>
                            <div class="mt-1 text-sm font-semibold text-slate-900">完成发票闭环与条目定位</div>
                            <div class="mt-1 text-xs text-slate-500">上传附件、保存报销状态，再用“定位台账”检查能否快速回到原始条目。</div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">供应商</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(summary.supplier_count) }}</div>
                        <div class="mt-1 text-xs text-slate-500">供应商档案总数</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">价格库</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(summary.price_record_count) }}</div>
                        <div class="mt-1 text-xs text-slate-500">历史价格记录</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">库存档案</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(summary.inventory_profile_count) }}</div>
                        <div class="mt-1 text-xs text-slate-500">低库存 {{ formatCount(summary.low_stock_count) }} 条</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">导入任务</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(summary.import_task_count) }}</div>
                        <div class="mt-1 text-xs text-slate-500">失败 {{ formatCount(summary.failed_import_count) }} 条</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">报销队列</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(summary.pending_reimbursement_count) }}</div>
                        <div class="mt-1 text-xs text-slate-500">待闭环记录</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">通知中心</div>
                        <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatCount(summary.notification_count) }}</div>
                        <div class="mt-1 text-xs text-slate-500">严重 {{ criticalNotificationCount }} / 提醒 {{ warningNotificationCount }}</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 col-span-2">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">当前能力范围</div>
                        <div class="mt-2 text-sm font-medium text-slate-900">供应商、价格、库存、导入任务、发票附件、报销状态、超期提醒已统一收口。</div>
                        <div class="mt-1 text-xs text-slate-500">适合一期运营管理和异常追踪，后续可继续加预算、审批和消息推送。</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    <div class="space-y-4">
                        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                                            <div class="text-sm font-semibold font-mono text-blue-700">¥ {{ $root.formatCurrency(record.unit_price) }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ formatDate(record.last_purchase_date || record.updated_at) }}</div>
                                        </div>
                                    </div>
                                    <div class="mt-3 flex flex-wrap items-center gap-2">
                                        <a v-if="record.purchase_link" :href="record.purchase_link" target="_blank" class="inline-flex text-xs font-medium text-blue-600 hover:text-blue-700">打开采购链接</a>
                                        <button type="button" @click="seedInventoryFromPriceRecord(record)" class="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                            带入库存表单
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h4 class="text-base font-semibold text-slate-900">库存与低库存预警</h4>
                                    <p class="mt-1 text-sm text-slate-500">按物品维度维护库存和安全线，低库存会自动出现在通知中心。</p>
                                    <p v-if="$root.inventoryEditingItemName" class="mt-2 text-xs text-blue-600">当前正在编辑：{{ $root.inventoryEditingItemName }}</p>
                                </div>
                                <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                    低库存 {{ formatCount(summary.low_stock_count) }} 条
                                </span>
                            </div>

                            <form class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" @submit.prevent="$root.saveInventoryProfile()">
                                <input v-model.trim="$root.newInventoryProfile.item_name" type="text" maxlength="200" placeholder="物品名称" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model="$root.newInventoryProfile.unit" type="text" maxlength="40" placeholder="单位，如 盒 / 支" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model="$root.newInventoryProfile.current_stock" type="number" min="0" step="0.01" placeholder="当前库存" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <input v-model="$root.newInventoryProfile.low_stock_threshold" type="number" min="0" step="0.01" placeholder="低库存阈值" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <select v-model="$root.newInventoryProfile.preferred_supplier_id" class="h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="">默认供应商</option>
                                    <option v-for="supplier in suppliers" :key="'inventory-supplier-' + supplier.id" :value="String(supplier.id)">{{ supplier.name }}</option>
                                </select>
                                <input v-model.trim="$root.newInventoryProfile.notes" type="text" maxlength="500" placeholder="补货备注" class="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                <div class="md:col-span-2 flex gap-2">
                                    <button type="button" @click="resetInventoryForm" class="h-10 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                        {{ $root.inventoryEditingItemName ? '取消编辑' : '重置' }}
                                    </button>
                                    <button type="submit" :disabled="$root.inventorySaving" class="flex-1 h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-in-out">
                                        {{ $root.inventorySaving ? '保存中...' : ($root.inventoryEditingItemName ? '更新库存档案' : '保存库存档案') }}
                                    </button>
                                </div>
                            </form>

                            <div class="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                                <div v-if="!inventoryProfiles.length" class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    暂无库存档案。
                                </div>
                                <div
                                    v-for="profile in inventoryProfiles"
                                    :key="'inventory-' + profile.id"
                                    :class="profile.is_low_stock ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'"
                                    class="rounded-lg border px-4 py-3"
                                >
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <div class="text-sm font-semibold text-slate-900">{{ profile.item_name }}</div>
                                            <div class="mt-1 text-xs text-slate-500">
                                                {{ supplierNameById(profile.preferred_supplier_id) }}
                                                <span v-if="profile.notes"> · {{ profile.notes }}</span>
                                            </div>
                                        </div>
                                        <span :class="profile.is_low_stock ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
                                            {{ profile.is_low_stock ? '低库存' : '库存健康' }}
                                        </span>
                                    </div>
                                    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        <div class="rounded-lg bg-white/80 px-3 py-2">
                                            <div class="text-[11px] text-slate-500">当前库存</div>
                                            <div class="mt-1 font-semibold text-slate-900">{{ formatCount(profile.current_stock) }} {{ profile.unit || '' }}</div>
                                        </div>
                                        <div class="rounded-lg bg-white/80 px-3 py-2">
                                            <div class="text-[11px] text-slate-500">安全线</div>
                                            <div class="mt-1 font-semibold text-slate-900">{{ formatCount(profile.low_stock_threshold) }} {{ profile.unit || '' }}</div>
                                        </div>
                                    </div>
                                    <div class="mt-3 flex justify-end">
                                        <button type="button" @click="startInventoryEdit(profile)" class="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all duration-200 ease-in-out">
                                            编辑库存
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

                        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

                        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                                            <div class="text-sm font-semibold text-slate-900">{{ notification.title }}</div>
                                            <div class="mt-1 text-xs text-slate-500">{{ notification.detail }}</div>
                                        </div>
                                        <span class="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700">
                                            {{ notificationSeverityLabel(notification.severity) }}
                                        </span>
                                    </div>
                                    <div class="mt-3 flex items-center justify-between gap-3">
                                        <div class="text-[11px] uppercase tracking-wide text-slate-500">{{ notification.category }}</div>
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
            </section>
        `,
    };
})(window);

(function (global) {
    function ensureArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeCenterPayload(payload) {
        return {
            summary: payload?.summary || {},
            suppliers: ensureArray(payload?.suppliers),
            price_records: ensureArray(payload?.price_records),
            inventory_profiles: ensureArray(payload?.inventory_profiles),
            import_tasks: ensureArray(payload?.import_tasks),
            purchase_queue: ensureArray(payload?.purchase_queue),
            receipt_queue: ensureArray(payload?.receipt_queue),
            replenishment_recommendations: ensureArray(payload?.replenishment_recommendations),
            supplier_lead_time_trend: ensureArray(payload?.supplier_lead_time_trend),
            action_queues: {
                inventory: ensureArray(payload?.action_queues?.inventory),
                purchase: ensureArray(payload?.action_queues?.purchase),
                receipt: ensureArray(payload?.action_queues?.receipt),
                import: ensureArray(payload?.action_queues?.import),
                invoice: ensureArray(payload?.action_queues?.invoice),
                all: ensureArray(payload?.action_queues?.all),
            },
            invoice_queue: ensureArray(payload?.invoice_queue),
            notifications: ensureArray(payload?.notifications),
        };
    }

    function buildInvoiceDrafts(invoiceQueue) {
        const drafts = {};
        for (const item of ensureArray(invoiceQueue)) {
            const itemId = Number(item?.item_id || 0);
            if (!itemId) continue;
            drafts[itemId] = {
                reimbursement_status: item?.reimbursement_status || 'pending',
                reimbursement_date: item?.reimbursement_date || '',
                invoice_number: item?.invoice_number || '',
                note: item?.note || '',
            };
        }
        return drafts;
    }

    function buildPurchaseOrderDrafts(purchaseQueue) {
        const drafts = {};
        for (const item of ensureArray(purchaseQueue)) {
            const itemId = Number(item?.item_id || 0);
            if (!itemId) continue;
            drafts[itemId] = {
                supplier_id: item?.supplier_id ? String(item.supplier_id) : '',
                ordered_date: item?.ordered_date || '',
                expected_arrival_date: item?.expected_arrival_date || '',
                status: item?.purchase_status || 'draft',
                note: item?.purchase_note || '',
            };
        }
        return drafts;
    }

    function buildReceiptDrafts(receiptQueue) {
        const drafts = {};
        for (const item of ensureArray(receiptQueue)) {
            const orderId = Number(item?.purchase_order_id || 0);
            if (!orderId) continue;
            drafts[orderId] = {
                received_date: item?.received_date || '',
                received_quantity: item?.received_quantity ?? item?.quantity ?? '',
                note: item?.receipt_note || '',
            };
        }
        return drafts;
    }

    global.AppOperationsApi = Object.freeze({
        normalizeCenterPayload,
        buildInvoiceDrafts,
        buildPurchaseOrderDrafts,
        buildReceiptDrafts,
        async fetchCenter() {
            const res = await axios.get('/api/ops/center');
            return normalizeCenterPayload(res?.data || {});
        },
        async createSupplier(payload) {
            const res = await axios.post('/api/ops/suppliers', payload);
            return res?.data || {};
        },
        async updateSupplier(supplierId, payload) {
            const res = await axios.put(`/api/ops/suppliers/${supplierId}`, payload);
            return res?.data || {};
        },
        async deleteSupplier(supplierId) {
            const res = await axios.delete(`/api/ops/suppliers/${supplierId}`);
            return res?.data || {};
        },
        async createPriceRecord(payload) {
            const res = await axios.post('/api/ops/prices', payload);
            return res?.data || {};
        },
        async saveInventoryProfile(payload) {
            const res = await axios.put('/api/ops/inventory', payload);
            return res?.data || {};
        },
        async savePurchaseOrder(itemId, payload) {
            const res = await axios.put(`/api/ops/orders/${itemId}`, payload);
            return res?.data || {};
        },
        async savePurchaseReceipt(orderId, payload) {
            const res = await axios.put(`/api/ops/receipts/${orderId}`, payload);
            return res?.data || {};
        },
        async saveInvoiceRecord(itemId, payload) {
            const res = await axios.put(`/api/ops/invoices/${itemId}`, payload);
            return res?.data || {};
        },
        async uploadInvoiceAttachment(itemId, formData) {
            const res = await axios.post(`/api/ops/invoices/${itemId}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res?.data || {};
        },
        async deleteInvoiceAttachment(attachmentId) {
            const res = await axios.delete(`/api/ops/invoice-attachments/${attachmentId}`);
            return res?.data || {};
        },
    });
})(window);

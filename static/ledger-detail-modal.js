(function (global) {
    global.LedgerDetailModal = {
        props: {
            visible: {
                type: Boolean,
                default: false,
            },
            loading: {
                type: Boolean,
                default: false,
            },
            item: {
                type: Object,
                default: null,
            },
            auditLoading: {
                type: Boolean,
                default: false,
            },
            auditLogs: {
                type: Array,
                default: () => [],
            },
            auditTotal: {
                type: Number,
                default: 0,
            },
            auditPage: {
                type: Number,
                default: 1,
            },
            auditTotalPages: {
                type: Number,
                default: 1,
            },
        },
        template: '#ledger-detail-modal-template',
    };
})(window);

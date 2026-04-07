(function (global) {
    global.LedgerFilterPanel = {
        props: {
            filterKeyword: {
                type: String,
                default: '',
            },
            filterStatus: {
                type: String,
                default: '',
            },
            filterDepartment: {
                type: String,
                default: '',
            },
            filterMonth: {
                type: String,
                default: '',
            },
            statuses: {
                type: Array,
                default: () => [],
            },
            departments: {
                type: Array,
                default: () => [],
            },
        },
        emits: [
            'update:filterKeyword',
            'update:filterStatus',
            'update:filterDepartment',
            'update:filterMonth',
            'import-docs',
            'add-item',
            'export-excel',
            'search',
            'clear-filters',
        ],
        template: '#ledger-filter-panel-template',
    };
})(window);

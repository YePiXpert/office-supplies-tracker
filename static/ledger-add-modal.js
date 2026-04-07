(function (global) {
    global.LedgerAddModal = {
        props: {
            visible: {
                type: Boolean,
                default: false,
            },
            item: {
                type: Object,
                default: null,
            },
        },
        template: '#ledger-add-modal-template',
    };
})(window);

(function (global) {
    const { createApp } = Vue;

    const app = createApp({
        ...global.AppState,
        ...global.AppApi,
    });

    if (global.LedgerFilterPanel) {
        app.component('ledger-filter-panel', global.LedgerFilterPanel);
    }
    if (global.LedgerBatchToolbar) {
        app.component('ledger-batch-toolbar', global.LedgerBatchToolbar);
    }

    app.mount('#app');

    document.getElementById('app').style.display = '';
})(window);

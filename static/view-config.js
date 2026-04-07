(function (global) {
    const views = Object.freeze({
        dashboard: Object.freeze({
            id: 'dashboard',
            label: '\u6982\u89c8',
            icon: '\uD83D\uDCCA',
            title: '\u6982\u89c8\u770b\u677f',
            placement: 'primary',
        }),
        ledger: Object.freeze({
            id: 'ledger',
            label: '\u53F0\u8D26',
            icon: '\uD83D\uDCC4',
            title: '\u91C7\u8D2D\u53F0\u8D26\u660E\u7EC6',
            placement: 'primary',
        }),
        execution: Object.freeze({
            id: 'execution',
            label: '\u6267\u884C\u770B\u677F',
            icon: '\uD83E\uDE84',
            title: '\u91C7\u8D2D\u6267\u884C\u770B\u677F',
            placement: 'primary',
        }),
        reports: Object.freeze({
            id: 'reports',
            label: '\u7EDF\u8BA1\u62A5\u8868',
            icon: '\uD83D\uDCC8',
            title: '\u7EDF\u8BA1\u62A5\u8868',
            placement: 'primary',
        }),
        audit: Object.freeze({
            id: 'audit',
            label: '\u5BA1\u8BA1\u65E5\u5FD7',
            icon: '\uD83D\uDEE1\uFE0F',
            title: '\u5BA1\u8BA1\u65E5\u5FD7',
            placement: 'primary',
        }),
        settings: Object.freeze({
            id: 'settings',
            label: '\u7CFB\u7EDF\u8BBE\u7F6E',
            icon: '\u2699\uFE0F',
            title: '\u7CFB\u7EDF\u8BBE\u7F6E',
            placement: 'secondary',
        }),
    });

    const orderedViews = Object.freeze(Object.values(views));

    global.AppViewConfig = Object.freeze({
        ids: Object.freeze(orderedViews.map((view) => view.id)),
        views,
        primaryNav: Object.freeze(orderedViews.filter((view) => view.placement === 'primary')),
        secondaryNav: Object.freeze(orderedViews.filter((view) => view.placement === 'secondary')),
    });
})(window);

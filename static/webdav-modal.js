(function (global) {
    global.WebdavModal = {
        props: {
            visible: {
                type: Boolean,
                default: false,
            },
            loading: {
                type: Boolean,
                default: false,
            },
            config: {
                type: Object,
                default: null,
            },
            backups: {
                type: Array,
                default: () => [],
            },
        },
        template: '#webdav-modal-template',
    };
})(window);

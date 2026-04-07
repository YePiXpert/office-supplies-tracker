(function (global) {
    global.SettingsAiPanel = {
        props: {
            ocrEngine: {
                type: String,
                default: 'local',
            },
            llmProtocol: {
                type: String,
                default: 'openai',
            },
            llmApiKey: {
                type: String,
                default: '',
            },
            llmModelName: {
                type: String,
                default: '',
            },
            llmBaseUrl: {
                type: String,
                default: '',
            },
        },
        emits: [
            'update:ocrEngine',
            'update:llmProtocol',
            'update:llmApiKey',
            'update:llmModelName',
            'update:llmBaseUrl',
        ],
        template: '#settings-ai-panel-template',
    };
})(window);

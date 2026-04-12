(function (global) {
    const BEIJING_TIMEZONE = 'Asia/Shanghai';

    function getFormatter(options) {
        return new Intl.DateTimeFormat('zh-CN', {
            timeZone: BEIJING_TIMEZONE,
            ...options,
        });
    }

    function getBeijingParts(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        const parts = {};
        for (const part of getFormatter({
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(date)) {
            if (part.type !== 'literal') {
                parts[part.type] = part.value;
            }
        }
        return parts;
    }

    function parseServerDate(value) {
        const raw = (value || '').toString().trim();
        if (!raw) {
            return null;
        }
        if (/^[A-Za-z]{3},/.test(raw)) {
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
            return new Date(`${raw.replace(' ', 'T')}+08:00`);
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return new Date(`${raw}T00:00:00+08:00`);
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatDateTime(value, fallback = '-') {
        const date = parseServerDate(value);
        if (!date) {
            return value ? String(value) : fallback;
        }
        const parts = getBeijingParts(date);
        if (!parts) {
            return value ? String(value) : fallback;
        }
        return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    }

    function todayDateText() {
        const parts = getBeijingParts(new Date());
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function compactTimestamp() {
        const parts = getBeijingParts(new Date());
        return `${parts.year.slice(2)}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
    }

    global.AppTime = {
        formatDateTime,
        todayDateText,
        compactTimestamp,
    };
})(window);

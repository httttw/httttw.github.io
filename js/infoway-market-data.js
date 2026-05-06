(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ECInfowayMarketData = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DEFAULT_QUOTE = 'USDT';

    function cleanToken(value) {
        return String(value || '').replace(/\s+/g, '').toUpperCase();
    }

    function normalizeBaseSymbol(value) {
        const clean = cleanToken(value);
        if (!clean) return '';
        if (clean.includes('/')) return clean.split('/')[0];
        if (clean.endsWith(DEFAULT_QUOTE)) return clean.slice(0, -DEFAULT_QUOTE.length);
        if (clean.endsWith('USD')) return clean.slice(0, -3);
        return clean;
    }

    function toMarketCode(value) {
        const base = normalizeBaseSymbol(value);
        return base ? `${base}${DEFAULT_QUOTE}` : '';
    }

    function fromMarketCode(value) {
        const clean = cleanToken(value);
        return clean.endsWith(DEFAULT_QUOTE) ? clean.slice(0, -DEFAULT_QUOTE.length) : clean;
    }

    function generateTraceId() {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
            const rand = Math.random() * 16 | 0;
            const value = ch === 'x' ? rand : ((rand & 0x3) | 0x8);
            return value.toString(16);
        });
    }

    function buildAuthHeaders(apiKey) {
        return {
            'accept': 'application/json',
            'apiKey': String(apiKey || '').trim()
        };
    }

    function normalizeCodesInput(codes) {
        if (Array.isArray(codes)) {
            return codes.map((code) => cleanToken(code)).filter(Boolean).join(',');
        }
        return String(codes || '').split(',').map((code) => cleanToken(code)).filter(Boolean).join(',');
    }

    function buildTradeSubscribeMessage(codes) {
        return {
            code: 10000,
            trace: generateTraceId(),
            data: {
                codes: normalizeCodesInput(codes),
                includeTy: false
            }
        };
    }

    function buildHeartbeatMessage() {
        return {
            code: 10010,
            trace: generateTraceId()
        };
    }

    function buildKlineRequest(codes, klineType, klineNum) {
        return {
            klineType: Number(klineType),
            klineNum: Number(klineNum),
            codes: normalizeCodesInput(codes)
        };
    }

    function parseNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function parsePercent(value) {
        const raw = String(value || '').replace('%', '').trim();
        return parseNumber(raw);
    }

    function toUnixMillis(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return String(Math.trunc(num)).length <= 10 ? num * 1000 : num;
    }

    function parseTradeItem(item) {
        const marketCode = cleanToken(item && item.s);
        const price = parseNumber(item && item.p);
        if (!marketCode || price === null) return null;
        return {
            marketCode,
            base: fromMarketCode(marketCode),
            price,
            lastTradeVolume: parseNumber(item && item.v) || 0,
            turnover: parseNumber(item && item.vw) || 0,
            direction: Number.isFinite(Number(item && item.td)) ? Number(item.td) : 0,
            timestamp: toUnixMillis(item && item.t)
        };
    }

    function parseTradeResponse(payload) {
        if (!payload || payload.ret !== 200 || !Array.isArray(payload.data)) return [];
        return payload.data.map(parseTradeItem).filter(Boolean);
    }

    function parseKlinePoint(point) {
        const close = parseNumber(point && point.c);
        if (close === null) return null;
        return {
            timestamp: toUnixMillis(point && point.t),
            open: parseNumber(point && point.o) || close,
            high: parseNumber(point && point.h) || close,
            low: parseNumber(point && point.l) || close,
            close,
            volume: parseNumber(point && point.v) || 0,
            turnover: parseNumber(point && point.vw) || 0,
            changePercent: parsePercent(point && point.pc) || 0,
            changeAmount: parseNumber(point && point.pca) || 0
        };
    }

    function mapKlineResponse(payload) {
        const result = {};
        if (!payload || payload.ret !== 200 || !Array.isArray(payload.data)) return result;
        payload.data.forEach((entry) => {
            const base = fromMarketCode(entry && entry.s);
            if (!base) return;
            const points = Array.isArray(entry && entry.respList) ? entry.respList.map(parseKlinePoint).filter(Boolean) : [];
            if (points.length) result[base] = points;
        });
        return result;
    }

    return {
        DEFAULT_QUOTE,
        normalizeBaseSymbol,
        toMarketCode,
        fromMarketCode,
        buildAuthHeaders,
        buildTradeSubscribeMessage,
        buildHeartbeatMessage,
        buildKlineRequest,
        parseTradeItem,
        parseTradeResponse,
        mapKlineResponse,
        generateTraceId
    };
});

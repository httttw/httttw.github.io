(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }

    const api = factory();
    if (root) {
        root.ECSiteApiConfig = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DEFAULT_API_ORIGIN = 'https://api.easycoinst0re.com';

    function trimSlashes(value) {
        return String(value || '').trim().replace(/\/+$/, '');
    }

    function readLocalStorage(windowLike, key) {
        try {
            if (windowLike && windowLike.localStorage && typeof windowLike.localStorage.getItem === 'function') {
                return String(windowLike.localStorage.getItem(key) || '').trim();
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function getApiOrigin(windowLike) {
        const explicit = trimSlashes(windowLike && windowLike.EC_API_ORIGIN);
        if (explicit) return explicit;

        const cached = trimSlashes(readLocalStorage(windowLike, 'ec_api_origin'));
        if (cached) return cached;

        return DEFAULT_API_ORIGIN;
    }

    function buildCoinGeckoProxyUrl(apiOrigin) {
        return trimSlashes(apiOrigin || DEFAULT_API_ORIGIN) + '/api/coingecko/simple-price';
    }

    function buildCoinGeckoMarketsProxyUrl(apiOrigin) {
        return trimSlashes(apiOrigin || DEFAULT_API_ORIGIN) + '/api/coingecko/coins-markets';
    }

    function deriveFiatUsdRatesFromCoinGecko(payload) {
        const bitcoin = payload && payload.bitcoin ? payload.bitcoin : {};
        const usd = Number(bitcoin.usd);
        const aud = Number(bitcoin.aud);
        const eur = Number(bitcoin.eur);

        return {
            USD: 1,
            AUD: usd > 0 && aud > 0 ? usd / aud : 0,
            EUR: usd > 0 && eur > 0 ? usd / eur : 0
        };
    }

    return {
        DEFAULT_API_ORIGIN,
        getApiOrigin,
        buildCoinGeckoProxyUrl,
        buildCoinGeckoMarketsProxyUrl,
        deriveFiatUsdRatesFromCoinGecko
    };
});

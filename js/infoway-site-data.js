(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ECInfowaySiteData = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const SUPPORTED_ASSETS = [
        { base: 'BTC', symbol: 'BTC/USDT', name: 'Bitcoin', accent: 'amber', icon: 'B' },
        { base: 'ETH', symbol: 'ETH/USDT', name: 'Ethereum', accent: 'blue', icon: 'E' },
        { base: 'BNB', symbol: 'BNB/USDT', name: 'BNB', accent: 'amber', icon: 'B' },
        { base: 'XRP', symbol: 'XRP/USDT', name: 'XRP', accent: 'blue', icon: 'X' },
        { base: 'SOL', symbol: 'SOL/USDT', name: 'Solana', accent: 'green', icon: 'S' },
        { base: 'ADA', symbol: 'ADA/USDT', name: 'Cardano', accent: 'blue', icon: 'A' },
        { base: 'DOGE', symbol: 'DOGE/USDT', name: 'Dogecoin', accent: 'amber', icon: 'D' },
        { base: 'LINK', symbol: 'LINK/USDT', name: 'Chainlink', accent: 'blue', icon: 'L' },
        { base: 'DOT', symbol: 'DOT/USDT', name: 'Polkadot', accent: 'green', icon: 'D' },
        { base: 'AVAX', symbol: 'AVAX/USDT', name: 'Avalanche', accent: 'red', icon: 'A' },
        { base: 'LTC', symbol: 'LTC/USDT', name: 'Litecoin', accent: 'amber', icon: 'L' },
        { base: 'BCH', symbol: 'BCH/USDT', name: 'Bitcoin Cash', accent: 'amber', icon: 'B' },
        { base: 'TRX', symbol: 'TRX/USDT', name: 'TRON', accent: 'red', icon: 'T' },
        { base: 'XLM', symbol: 'XLM/USDT', name: 'Stellar', accent: 'blue', icon: 'X' },
        { base: 'SUI', symbol: 'SUI/USDT', name: 'Sui', accent: 'blue', icon: 'S' },
        { base: 'ICP', symbol: 'ICP/USDT', name: 'Internet Computer', accent: 'blue', icon: 'I' },
        { base: 'MANA', symbol: 'MANA/USDT', name: 'Decentraland', accent: 'red', icon: 'M' },
        { base: 'ETC', symbol: 'ETC/USDT', name: 'Ethereum Classic', accent: 'green', icon: 'E' },
        { base: 'SAND', symbol: 'SAND/USDT', name: 'The Sandbox', accent: 'amber', icon: 'S' },
        { base: 'CHZ', symbol: 'CHZ/USDT', name: 'Chiliz', accent: 'red', icon: 'C' },
        { base: 'USDC', symbol: 'USDC/USDT', name: 'USD Coin', accent: 'blue', icon: 'U' },
        { base: 'AXS', symbol: 'AXS/USDT', name: 'Axie Infinity', accent: 'blue', icon: 'A' }
    ];

    const HOME_MARKET_ASSETS = [
        'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'LINK',
        'DOT', 'AVAX', 'LTC', 'BCH', 'TRX', 'XLM', 'SUI', 'ICP',
        'MANA', 'ETC', 'SAND', 'CHZ', 'USDC', 'AXS'
    ]
        .map(findAsset)
        .filter(Boolean);

    const RATE_ASSETS = SUPPORTED_ASSETS.slice();

    const TRACKER_HOLDINGS = [
        { base: 'BTC', qty: 0.86, cost: 62350 },
        { base: 'ETH', qty: 7.4, cost: 2140 },
        { base: 'SOL', qty: 155, cost: 138 },
        { base: 'XRP', qty: 12800, cost: 0.57 },
        { base: 'BNB', qty: 19, cost: 486 },
        { base: 'ADA', qty: 9800, cost: 0.41 },
        { base: 'DOGE', qty: 102000, cost: 0.083 },
        { base: 'LINK', qty: 860, cost: 12.4 },
        { base: 'DOT', qty: 1200, cost: 6.18 },
        { base: 'AVAX', qty: 410, cost: 28.6 },
        { base: 'LTC', qty: 320, cost: 88.4 },
        { base: 'BCH', qty: 120, cost: 361.8 },
        { base: 'TRX', qty: 64000, cost: 0.118 },
        { base: 'XLM', qty: 28500, cost: 0.122 },
        { base: 'SUI', qty: 7300, cost: 1.24 },
        { base: 'ICP', qty: 520, cost: 9.4 },
        { base: 'MANA', qty: 16500, cost: 0.38 },
        { base: 'ETC', qty: 410, cost: 24.7 },
        { base: 'SAND', qty: 14800, cost: 0.44 },
        { base: 'CHZ', qty: 54000, cost: 0.076 },
        { base: 'USDC', qty: 12500, cost: 1.0 },
        { base: 'AXS', qty: 950, cost: 7.85 }
    ].map(function (item) {
        const asset = findAsset(item.base);
        return asset ? { ...asset, qty: item.qty, cost: item.cost } : null;
    }).filter(Boolean);

    const QUICK_CONVERTER_CRYPTO_OPTIONS = SUPPORTED_ASSETS.map(function (asset) {
        return { code: asset.base, name: asset.name, icon: asset.icon };
    })
        .filter(Boolean);

    const SUPPORTED_BASES = new Set(SUPPORTED_ASSETS.map(function (item) { return item.base; }));

    function cleanBase(value) {
        return String(value || '').trim().toUpperCase().replace('/USDT', '');
    }

    function findAsset(base) {
        const normalized = cleanBase(base);
        return SUPPORTED_ASSETS.find(function (item) { return item.base === normalized; }) || null;
    }

    function isSupportedBase(base) {
        return SUPPORTED_BASES.has(cleanBase(base));
    }

    function toMarketCode(base) {
        const normalized = cleanBase(base);
        return normalized ? normalized + 'USDT' : '';
    }

    function computeWeeklyChange(points) {
        if (!Array.isArray(points) || points.length === 0) return 0;
        const latest = Number(points[0] && points[0].close);
        const earliest = Number(points[points.length - 1] && points[points.length - 1].close);
        if (!(latest > 0) || !(earliest > 0)) return 0;
        return ((latest / earliest) - 1) * 100;
    }

    function deriveUsdQuoteMap(tradeRows, dailyMap) {
        const quotes = {};
        const tradeIndex = {};
        (tradeRows || []).forEach(function (row) {
            if (row && row.base) tradeIndex[cleanBase(row.base)] = row;
        });

        Object.keys(dailyMap || {}).forEach(function (base) {
            const normalized = cleanBase(base);
            if (!isSupportedBase(normalized)) return;
            const points = Array.isArray(dailyMap[base]) ? dailyMap[base] : [];
            if (!points.length) return;
            const latest = points[0] || {};
            const trade = tradeIndex[normalized] || {};
            const closePrice = Number(latest.close);
            const tradePrice = Number(trade.price);
            quotes[normalized] = {
                base: normalized,
                price: tradePrice > 0 ? tradePrice : (closePrice > 0 ? closePrice : 0),
                changePercent: Number(latest.changePercent) || 0,
                volume: Number(latest.turnover) || Number(latest.volume) || 0,
                weekChange: computeWeeklyChange(points),
                timestamp: Number(trade.timestamp) || Number(latest.timestamp) || 0
            };
        });

        Object.keys(tradeIndex).forEach(function (base) {
            if (quotes[base]) return;
            const trade = tradeIndex[base];
            quotes[base] = {
                base,
                price: Number(trade.price) || 0,
                changePercent: 0,
                volume: Number(trade.turnover) || 0,
                weekChange: 0,
                timestamp: Number(trade.timestamp) || 0
            };
        });

        return quotes;
    }

    return {
        SUPPORTED_ASSETS,
        HOME_MARKET_ASSETS,
        RATE_ASSETS,
        TRACKER_HOLDINGS,
        QUICK_CONVERTER_CRYPTO_OPTIONS,
        SUPPORTED_BASES,
        findAsset,
        isSupportedBase,
        toMarketCode,
        computeWeeklyChange,
        deriveUsdQuoteMap
    };
});

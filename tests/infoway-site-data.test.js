const test = require('node:test');
const assert = require('node:assert/strict');

const {
    HOME_MARKET_ASSETS,
    RATE_ASSETS,
    TRACKER_HOLDINGS,
    QUICK_CONVERTER_CRYPTO_OPTIONS,
    isSupportedBase,
    computeWeeklyChange,
    deriveUsdQuoteMap
} = require('../js/infoway-site-data.js');

test('exposes only verified Infoway-covered assets for home, rate, and tracker pages', () => {
    assert.equal(HOME_MARKET_ASSETS.length, 8);
    assert.deepEqual(HOME_MARKET_ASSETS.map((item) => item.base), ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'LINK']);

    assert.ok(RATE_ASSETS.length >= 20);
    assert.ok(RATE_ASSETS.every((item) => isSupportedBase(item.base)));

    assert.ok(TRACKER_HOLDINGS.every((item) => isSupportedBase(item.base)));
    assert.ok(QUICK_CONVERTER_CRYPTO_OPTIONS.every((item) => isSupportedBase(item.code)));
});

test('computes weekly change from newest-first daily candles', () => {
    const points = [
        { close: 82700, timestamp: 1778025600000 },
        { close: 80905.52, timestamp: 1777939200000 },
        { close: 79861.01, timestamp: 1777852800000 }
    ];

    assert.equal(computeWeeklyChange(points).toFixed(2), '3.55');
});

test('derives a USD quote map from Infoway trade and kline payloads', () => {
    const tradeRows = [
        { base: 'BTC', price: 82680 },
        { base: 'ETH', price: 2415 }
    ];
    const dailyMap = {
        BTC: [
            { close: 82700, turnover: 822074214.9862617, changePercent: 2.22, timestamp: 1778025600000 },
            { close: 80905.52, turnover: 1374598561.207, changePercent: 1.31, timestamp: 1777939200000 }
        ],
        ETH: [
            { close: 2416.53, turnover: 398087259.572444, changePercent: 2.36, timestamp: 1778025600000 },
            { close: 2360.77, turnover: 681484903.5, changePercent: 0.58, timestamp: 1777939200000 }
        ]
    };

    const quotes = deriveUsdQuoteMap(tradeRows, dailyMap);
    assert.equal(quotes.BTC.price, 82680);
    assert.equal(quotes.BTC.changePercent, 2.22);
    assert.equal(quotes.BTC.volume, 822074214.9862617);
    assert.equal(quotes.ETH.price, 2415);
    assert.equal(quotes.ETH.weekChange.toFixed(2), '2.36');
});

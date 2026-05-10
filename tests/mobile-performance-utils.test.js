const test = require('node:test');
const assert = require('node:assert/strict');

const {
    shouldRenderMobileMarketLists,
    buildPairPanelMarkup,
    buildExchangeCoinModalMarkup,
} = require('../js/mobile-performance-utils.js');

test('shouldRenderMobileMarketLists only re-renders visible market list screens', () => {
    assert.equal(shouldRenderMobileMarketLists('homeScreen'), true);
    assert.equal(shouldRenderMobileMarketLists('market'), true);
    assert.equal(shouldRenderMobileMarketLists('profile'), false);
    assert.equal(shouldRenderMobileMarketLists('deposit'), false);
    assert.equal(shouldRenderMobileMarketLists('trade'), false);
});

test('buildPairPanelMarkup inlines current price and change without deferred updates', () => {
    const html = buildPairPanelMarkup({
        pairList: ['BTC/USDT', 'ETH/USDT'],
        currentTradingCoin: 'BTC',
        localData: {
            BTC: { price: 81702.75, change: 1.01 },
            ETH: { price: 1910.12, change: -0.32 },
        },
    });

    assert.match(html, /panel-list-item selected/);
    assert.match(html, /data-symbol="BTC\/USDT"/);
    assert.match(html, /81,702\.75/);
    assert.match(html, /\+1\.01%/);
    assert.match(html, /1,910\.12/);
    assert.match(html, /-0\.32%/);
});

test('buildExchangeCoinModalMarkup sorts selected and funded coins first', () => {
    const html = buildExchangeCoinModalMarkup({
        exchangeCoins: [
            { s: 'ETH', i: 'eth' },
            { s: 'BTC', i: 'btc' },
            { s: 'XRP', i: 'xrp' },
        ],
        selectedSymbol: 'ETH',
        getBalance: (symbol) => ({ ETH: 0, BTC: 2.5, XRP: 0 }[symbol] || 0),
        copy: { available: 'Available', selected: 'Selected' },
        getCoinIconHtml: (symbol) => `<span>${symbol}</span>`,
        formatAmount: (amount) => amount.toFixed(2),
    });

    const ethIndex = html.indexOf('data-symbol="ETH"');
    const btcIndex = html.indexOf('data-symbol="BTC"');
    const xrpIndex = html.indexOf('data-symbol="XRP"');

    assert.ok(ethIndex >= 0, 'Expected ETH row to be rendered');
    assert.ok(btcIndex >= 0, 'Expected BTC row to be rendered');
    assert.ok(xrpIndex >= 0, 'Expected XRP row to be rendered');
    assert.ok(ethIndex < btcIndex, 'Selected coin should render first');
    assert.ok(btcIndex < xrpIndex, 'Funded coin should render before empty ones');
    assert.match(html, /Selected/);
    assert.match(html, /Available 2\.50 BTC/);
});

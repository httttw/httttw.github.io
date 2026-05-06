const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_API_ORIGIN,
    getApiOrigin,
    buildCoinGeckoProxyUrl,
    deriveFiatUsdRatesFromCoinGecko
} = require('../js/site-api-config.js');

test('resolves the default API origin and CoinGecko worker path', () => {
    assert.equal(DEFAULT_API_ORIGIN, 'https://api.easycoinst0re.com');
    assert.equal(getApiOrigin({}), 'https://api.easycoinst0re.com');
    assert.equal(buildCoinGeckoProxyUrl('https://api.easycoinst0re.com/'), 'https://api.easycoinst0re.com/api/coingecko/simple-price');
});

test('prefers explicit window and localStorage overrides for API origin', () => {
    assert.equal(getApiOrigin({
        EC_API_ORIGIN: 'https://edge.easycoinst0re.com/',
        localStorage: { getItem() { return 'https://ignored.example'; } }
    }), 'https://edge.easycoinst0re.com');

    assert.equal(getApiOrigin({
        localStorage: { getItem(key) { return key === 'ec_api_origin' ? 'https://cached.easycoinst0re.com/' : ''; } }
    }), 'https://cached.easycoinst0re.com');
});

test('derives fiat USD rates from multi-currency bitcoin quotes', () => {
    const rates = deriveFiatUsdRatesFromCoinGecko({
        bitcoin: {
            usd: 94680.11,
            aud: 148874.79,
            eur: 83293.57
        }
    });

    assert.equal(rates.USD, 1);
    assert.equal(rates.AUD.toFixed(6), '0.635971');
    assert.equal(rates.EUR.toFixed(6), '1.136704');
});

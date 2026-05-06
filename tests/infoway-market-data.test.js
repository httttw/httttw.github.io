const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeBaseSymbol,
    toMarketCode,
    fromMarketCode,
    parseTradeResponse,
    mapKlineResponse,
    buildTradeSubscribeMessage,
    buildHeartbeatMessage
} = require('../js/infoway-market-data.js');

test('normalizes symbols and market codes for Infoway crypto pairs', () => {
    assert.equal(normalizeBaseSymbol(' btc / usdt '), 'BTC');
    assert.equal(normalizeBaseSymbol('USDEUSDT'), 'USDE');
    assert.equal(toMarketCode('BTC/USDT'), 'BTCUSDT');
    assert.equal(toMarketCode('eth'), 'ETHUSDT');
    assert.equal(fromMarketCode('SOLUSDT'), 'SOL');
});

test('parses Infoway latest trade response into base-price records', () => {
    const response = {
        ret: 200,
        data: [
            { s: 'BTCUSDT', p: '81628.27', v: '0.00007', vw: '5.7139789', t: 1778038486756, td: 1 },
            { s: 'ETHUSDT', p: '2378.07', v: '0.5508', vw: '1309.840956', t: 1778038486882, td: 2 }
        ]
    };

    assert.deepEqual(parseTradeResponse(response), [
        {
            marketCode: 'BTCUSDT',
            base: 'BTC',
            price: 81628.27,
            lastTradeVolume: 0.00007,
            turnover: 5.7139789,
            direction: 1,
            timestamp: 1778038486756
        },
        {
            marketCode: 'ETHUSDT',
            base: 'ETH',
            price: 2378.07,
            lastTradeVolume: 0.5508,
            turnover: 1309.840956,
            direction: 2,
            timestamp: 1778038486882
        }
    ]);
});

test('maps Infoway kline response into candle arrays with numeric fields', () => {
    const response = {
        ret: 200,
        data: [
            {
                s: 'BTCUSDT',
                respList: [
                    { t: '1778025600', h: '81760.84000', o: '80905.53000', l: '80731.14000', c: '81600.15000', v: '2902.49858', vw: '235830980.8764087', pc: '0.86%', pca: '694.63000' }
                ]
            }
        ]
    };

    assert.deepEqual(mapKlineResponse(response), {
        BTC: [
            {
                timestamp: 1778025600000,
                open: 80905.53,
                high: 81760.84,
                low: 80731.14,
                close: 81600.15,
                volume: 2902.49858,
                turnover: 235830980.8764087,
                changePercent: 0.86,
                changeAmount: 694.63
            }
        ]
    });
});

test('builds Infoway websocket protocol messages', () => {
    const subscribe = buildTradeSubscribeMessage('BTCUSDT,ETHUSDT');
    assert.equal(subscribe.code, 10000);
    assert.equal(subscribe.data.codes, 'BTCUSDT,ETHUSDT');
    assert.equal(subscribe.data.includeTy, false);
    assert.ok(typeof subscribe.trace === 'string' && subscribe.trace.length >= 16);

    const heartbeat = buildHeartbeatMessage();
    assert.equal(heartbeat.code, 10010);
    assert.ok(typeof heartbeat.trace === 'string' && heartbeat.trace.length >= 16);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    shouldEnableMockMarketData,
    shouldPromoteToMock
} = require('../js/mobile-market-data-guards.js');

test('enables mobile mock market data only on local development hosts', () => {
    assert.equal(shouldEnableMockMarketData('localhost'), true);
    assert.equal(shouldEnableMockMarketData('127.0.0.1'), true);
    assert.equal(shouldEnableMockMarketData('easycoinst0re.com'), false);
    assert.equal(shouldEnableMockMarketData('www.easycoinst0re.com'), false);
});

test('never promotes production traffic into mock mode after failures', () => {
    assert.equal(shouldPromoteToMock(false, 3), false);
    assert.equal(shouldPromoteToMock(false, 9), false);
});

test('allows local development to promote into mock mode after repeated failures', () => {
    assert.equal(shouldPromoteToMock(true, 2), false);
    assert.equal(shouldPromoteToMock(true, 3), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('G:/works/AdminecmainPRO/.tmp-playwright/node_modules/playwright');

test('mobile login triggers a market data request without waiting for the long poll window', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const requests = [];

    page.on('response', (res) => {
        const url = res.url();
        if (url.includes('/api/infoway/batch-trade') || url.includes('/api/infoway/batch-kline')) {
            requests.push(`${res.status()} ${url}`);
        }
    });

    try {
        await page.goto('http://127.0.0.1:4173/mobile.html?testcase=login-refresh', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await page.fill('input[type="email"], input[placeholder*="email" i]', '923640718@qq.com');
        await page.fill('input[type="password"], input[placeholder*="password" i]', '5808002a');
        await page.click('#auth-login-btn');
        await page.waitForTimeout(8000);

        assert.ok(
            requests.length > 0,
            `Expected an immediate Infoway refresh after login, but saw no market requests within 8s. Requests: ${JSON.stringify(requests)}`
        );
    } finally {
        await page.close();
        await browser.close();
    }
});

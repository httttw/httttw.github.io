const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const repoRoot = path.join(__dirname, '..');

function getBrowserExecutablePath() {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[ext] || 'application/octet-stream';
}

async function withStaticServer(run) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const targetPath = pathname === '/' ? path.join(repoRoot, 'index.html') : path.join(repoRoot, pathname.replace(/^\/+/, ''));
    if (!targetPath.startsWith(repoRoot) || !fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(targetPath) });
    fs.createReadStream(targetPath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('mobile login page wires login handlers without runtime boot errors', async () => {
  const executablePath = getBrowserExecutablePath();
  assert.ok(executablePath, 'expected a local Edge or Chrome executable for runtime verification');

  await withStaticServer(async (origin) => {
    const browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    });

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.stack || String(err)));

    try {
      await page.goto(`${origin}/mobile.html?v=20260511f`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(1500);

      const runtimeState = await page.evaluate(() => ({
        hasHandleLogin: typeof window.handleLogin,
        hasSwitchLoginTab: typeof window.switchLoginTab,
        bottomNavParentClass: document.querySelector('.bottom-nav')?.parentElement?.className || null,
        bottomNavRect: (() => {
          const nav = document.querySelector('.bottom-nav');
          if (!nav) return null;
          const rect = nav.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
          };
        })(),
      }));

      const blockers = pageErrors.filter((entry) =>
        /switchLoginTab|handleLogin|PHONE_COUNTRY_CODE_STORAGE_KEY|currentScreen|exchangeCoins|Cannot convert undefined or null to object/.test(entry)
      );

      assert.deepEqual(blockers, [], `expected no login-boot blockers, got:\n${blockers.join('\n\n')}`);
      assert.equal(runtimeState.hasHandleLogin, 'function');
      assert.equal(runtimeState.hasSwitchLoginTab, 'function');
      assert.equal(runtimeState.bottomNavParentClass, 'mobile-frame');
      assert.ok(runtimeState.bottomNavRect && runtimeState.bottomNavRect.width > 0, 'expected bottom nav width to be positive');
      assert.ok(runtimeState.bottomNavRect && runtimeState.bottomNavRect.height > 0, 'expected bottom nav height to be positive');
    } finally {
      await browser.close();
    }
  });
});


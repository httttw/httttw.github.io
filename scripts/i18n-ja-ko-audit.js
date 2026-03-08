/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright-core");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.EC_I18N_PORT || 8096);
const BASE_URL = process.env.EC_I18N_BASE_URL || `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(PROJECT_ROOT, "artifacts", "i18n-full-audit");

const LANGS = [
  { code: "en", label: "English" },
  { code: "zh", label: "\u4e2d\u6587" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "\u65e5\u672c\u8a9e" },
  { code: "ko", label: "\ud55c\uad6d\uc5b4" }
];

const PAGES = [
  { file: "index.html", mode: "desktop" },
  { file: "markets.html", mode: "desktop" },
  { file: "trade.html", mode: "desktop" },
  { file: "delivery_chart.html", mode: "desktop" },
  { file: "contract.html", mode: "desktop" },
  { file: "fund.html", mode: "desktop" },
  { file: "dashboard.html", mode: "desktop" },
  { file: "buy-sell.html", mode: "desktop" },
  { file: "login.html", mode: "desktop" },
  { file: "signup.html", mode: "desktop" },
  { file: "mine.html", mode: "desktop" },
  { file: "multi-coin-order.html", mode: "desktop" },
  { file: "admin_login.html", mode: "desktop" },
  { file: "admin.html", mode: "desktop" },
  { file: "support_admin.html", mode: "desktop" },
  { file: "mobile.html", mode: "mobile" }
];

const GARBLED_TOKENS = [
  "\uFFFD",
  "\u99AF",
  "\u68E3",
  "\u95B3",
  "\u95B4",
  "\u922E",
  "\u922F",
  "\u9231",
  "\u9241",
  "\u922B",
  "\u9473",
  "\u812A",
  "\u76F2"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findChromeExecutable() {
  const fromEnv = process.env.CHROME_EXECUTABLE;
  const candidates = [
    fromEnv,
    path.resolve(PROJECT_ROOT, "..", "chrome-win64", "chrome-win64", "chrome.exe"),
    path.resolve(PROJECT_ROOT, "..", "chrome-win64", "chrome.exe"),
    path.resolve("G:/works/AdminecmainPRO/chrome-win64/chrome-win64/chrome.exe"),
    path.resolve("C:/Program Files/Google/Chrome/Application/chrome.exe")
  ].filter(Boolean);

  for (const p of candidates) {
    if (fileExists(p)) return p;
  }
  throw new Error("Chrome executable not found. Set CHROME_EXECUTABLE first.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(baseUrl, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/index.html`, { method: "GET" });
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`Server not ready: ${baseUrl}`);
}

function startStaticServer(port) {
  return spawn("python", ["-m", "http.server", String(port)], {
    cwd: PROJECT_ROOT,
    stdio: "ignore",
    windowsHide: true
  });
}

function hasGarble(text) {
  if (!text) return false;
  for (const token of GARBLED_TOKENS) {
    if (text.includes(token)) return true;
  }
  if (/(?:Ã.|Â.|Ð.|Ñ.){2,}/.test(text)) return true;
  return false;
}

function hasExpectedScript(text, lang) {
  if (!text) return false;
  if (lang === "zh") return /[\u4E00-\u9FFF]/.test(text);
  if (lang === "ja") return /[\u3040-\u30FF\u31F0-\u31FF]/.test(text) || /[\u4E00-\u9FFF]/.test(text);
  if (lang === "ko") return /[\uAC00-\uD7A3]/.test(text);
  return true;
}

function buildViewport(mode) {
  if (mode === "mobile") {
    return {
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    };
  }
  return {
    viewport: { width: 1366, height: 900 },
    isMobile: false,
    hasTouch: false
  };
}

function safeFileName(name) {
  return name.replace(/[^\w.-]/g, "_");
}

async function runAudit() {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, "screenshots"));

  const chromePath = findChromeExecutable();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"]
  });

  const results = [];
  try {
    for (const lang of LANGS) {
      const langDir = path.join(OUT_DIR, "screenshots", lang.code);
      ensureDir(langDir);

      for (const pageDef of PAGES) {
        const contextOpts = buildViewport(pageDef.mode);
        const context = await browser.newContext(contextOpts);
        await context.addInitScript((payload) => {
          localStorage.setItem("ec_site_lang", payload.code);
          localStorage.setItem("ec_language", payload.label);
        }, lang);

        const page = await context.newPage();
        const url = `${BASE_URL}/${pageDef.file}`;
        const startedAt = Date.now();
        let error = "";

        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
          await page.waitForTimeout(1200);

          await page
            .evaluate((code) => {
              if (typeof window.ecSetSiteLanguage === "function") {
                window.ecSetSiteLanguage(code);
              }
            }, lang.code)
            .catch(() => {});

          await page.waitForTimeout(2200);
          await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
        } catch (e) {
          error = e && e.message ? e.message : String(e);
        }

        const shotName = safeFileName(pageDef.file.replace(".html", ""));
        const shotPath = path.join(langDir, `${shotName}.png`);

        try {
          await page.screenshot({ path: shotPath, fullPage: true });
        } catch (shotErr) {
          if (!error) error = `screenshot failed: ${shotErr.message || shotErr}`;
        }

        const data = await page
          .evaluate(() => {
            const body = document.body ? document.body.innerText || "" : "";
            return {
              title: document.title || "",
              htmlLang: document.documentElement ? document.documentElement.lang || "" : "",
              text: body.replace(/\s+/g, " ").trim(),
              href: window.location.href
            };
          })
          .catch(() => ({ title: "", htmlLang: "", text: "", href: "" }));

        const sampleText = String(data.text || "").slice(0, 15000);
        const garbled = hasGarble(sampleText);
        const scriptOk = hasExpectedScript(sampleText, lang.code);
        const elapsedMs = Date.now() - startedAt;

        results.push({
          lang: lang.code,
          page: pageDef.file,
          mode: pageDef.mode,
          ok: !error && !garbled && scriptOk,
          error,
          garbled,
          scriptOk,
          htmlLang: data.htmlLang,
          title: data.title,
          finalUrl: data.href,
          elapsedMs,
          screenshot: path.relative(PROJECT_ROOT, shotPath).replace(/\\/g, "/")
        });

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

function writeReport(results) {
  const reportJsonPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportJsonPath, JSON.stringify(results, null, 2), "utf8");

  const byLang = {};
  for (const r of results) {
    if (!byLang[r.lang]) byLang[r.lang] = [];
    byLang[r.lang].push(r);
  }

  const lines = [];
  lines.push("# I18N Screenshot Audit");
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Base URL: ${BASE_URL}`);
  lines.push(`- Pages checked: ${PAGES.length}`);
  lines.push(`- Languages checked: ${LANGS.map((x) => x.code).join(", ")}`);
  lines.push("");

  for (const lang of LANGS) {
    const rows = byLang[lang.code] || [];
    const okCount = rows.filter((x) => x.ok).length;
    const failCount = rows.length - okCount;
    lines.push(`## ${lang.code.toUpperCase()} (${lang.label})`);
    lines.push(`- Pass: ${okCount}`);
    lines.push(`- Fail: ${failCount}`);
    for (const row of rows) {
      if (row.ok) continue;
      lines.push(
        `- FAIL ${row.page}: garbled=${row.garbled}, scriptOk=${row.scriptOk}, error=${row.error || "none"}, shot=${row.screenshot}`
      );
    }
    lines.push("");
  }

  const reportMdPath = path.join(OUT_DIR, "report.md");
  fs.writeFileSync(reportMdPath, lines.join("\n"), "utf8");

  console.log(`Wrote: ${path.relative(PROJECT_ROOT, reportJsonPath)}`);
  console.log(`Wrote: ${path.relative(PROJECT_ROOT, reportMdPath)}`);
}

async function main() {
  const server = startStaticServer(PORT);
  try {
    await waitForServerReady(BASE_URL, 25000);
    const results = await runAudit();
    writeReport(results);
  } finally {
    if (server && !server.killed) {
      try {
        server.kill();
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


# Free API Contract Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining paid or blocked market data dependencies on the contract-related pages with free browser-usable APIs while preserving the current UI and interaction flow.

**Architecture:** Keep TradingView for chart rendering, switch quote and 24h stat reads to Binance public REST/WS for pages that already trade on `*/USDT` pairs, and switch the desktop perpetual trade side-cache to CoinGecko batch pricing for broader coin coverage. Preserve existing DOM updates and fallback timers so only the data source changes.

**Tech Stack:** Static HTML/JS, Binance public REST API, Binance WebSocket streams, CoinGecko public REST API, Playwright CLI.

---

### Task 1: Switch `contract.html` to Binance quote + WebSocket

**Files:**
- Modify: `G:\works\AdminecmainPRO\ECPROJECT-main\contract.html`
- Test: browser verification on `contract.html`

- [ ] Replace the TwelveData key and symbol helper with Binance-style symbol normalization (`BTCUSDT`).
- [ ] Update the quote fetch function to read from `https://api.binance.com/api/v3/ticker/24hr?symbol=...`.
- [ ] Update the live price WebSocket to `wss://stream.binance.com:9443/ws/<symbol>@ticker`.
- [ ] Keep the existing DOM update methods but map Binance fields into them.
- [ ] Verify that the page loads, updates stats, and connects without console errors.

### Task 2: Switch `delivery_chart.html` to Binance bulk quote + combined streams

**Files:**
- Modify: `G:\works\AdminecmainPRO\ECPROJECT-main\delivery_chart.html`
- Test: browser verification on `delivery_chart.html`

- [ ] Replace the TwelveData key and `/USD` symbol normalization with Binance `BTCUSDT` style symbols.
- [ ] Change bulk drawer quote initialization to Binance `ticker/24hr?symbols=[...]`.
- [ ] Change single-symbol header refresh to Binance `ticker/24hr?symbol=...`.
- [ ] Replace the TwelveData WebSocket with Binance combined ticker streams for all drawer symbols.
- [ ] Preserve the existing polling fallback and TradingView symbol behavior.
- [ ] Verify drawer prices, header stats, and console stability.

### Task 3: Switch desktop perpetual auxiliary quote cache to CoinGecko batch pricing

**Files:**
- Modify: `G:\works\AdminecmainPRO\ECPROJECT-main\js\desktop-perpetual-contract.js`
- Test: browser verification on `contract.html` plus static code sanity

- [ ] Remove the stale TwelveData key dependency from the desktop perpetual helper script.
- [ ] Add a CoinGecko symbol-to-id map for the supported external trade coins.
- [ ] Replace per-coin TwelveData quote calls with batched CoinGecko `simple/price`.
- [ ] Keep the current active pair quote as highest priority and refresh only missing open-position coins externally.
- [ ] Verify no new console errors and that open-position quote refresh logic still runs.

### Task 4: Browser verification

**Files:**
- Test only

- [ ] Open `contract.html` with Playwright and verify quote requests, WebSocket, and console output.
- [ ] Open `delivery_chart.html` with Playwright and verify Binance requests, live updates, and console output.
- [ ] Regress `markets.html` briefly to ensure the earlier Worker routing is still healthy.
- [ ] Commit only the files involved in this scope.

(function () {
    const siteData = window.ECInfowaySiteData || null;
    const marketData = window.ECInfowayMarketData || null;
    const siteApiConfig = window.ECSiteApiConfig || null;
    if (!siteData || !marketData) return;

    const RATE_UNIVERSE = siteData.RATE_ASSETS.slice();
    const DEFAULT_LANG = 'en';
    const POLL_MS = 30000;
    const PRICE_SPREAD_RATE = 0.005;
    const API_ORIGIN = siteApiConfig && typeof siteApiConfig.getApiOrigin === 'function'
        ? siteApiConfig.getApiOrigin(window)
        : 'https://api.easycoinst0re.com';
    const INFOWAY_TRADE_URL = `${API_ORIGIN}/api/infoway/batch-trade`;
    const INFOWAY_KLINE_URL = `${API_ORIGIN}/api/infoway/batch-kline`;
    const marketCodes = RATE_UNIVERSE.map(function (item) {
        return siteData.toMarketCode(item.base);
    }).join(',');

    const COPY = {
        en: {
            loading: 'Loading live rates...',
            noData: 'Live market data unavailable. Retrying...',
            noMatch: 'No matching assets found.',
            searchPlaceholder: 'Filter list',
            buy: 'Buy',
            sell: 'Sell',
            watch: 'Watch'
        },
        de: {
            loading: 'Live-Kurse werden geladen...',
            noData: 'Marktdaten nicht verfugbar. Erneuter Versuch...',
            noMatch: 'Keine passenden Assets gefunden.',
            searchPlaceholder: 'Liste filtern',
            buy: 'Kaufen',
            sell: 'Verkaufen',
            watch: 'Beobachten'
        }
    };

    const dom = {
        todayList: document.getElementById('rate-today-list'),
        weekList: document.getElementById('rate-week-list'),
        tableBody: document.getElementById('rate-table-body'),
        emptyState: document.getElementById('rate-empty-state'),
        searchInput: document.getElementById('rate-search-input'),
        usdToggle: document.getElementById('rate-usd-toggle'),
        usdLabel: document.getElementById('rate-usd-label')
    };

    if (!dom.todayList || !dom.weekList || !dom.tableBody || !dom.emptyState) return;

    const state = {
        rows: [],
        search: '',
        quoteCurrency: 'USD',
        lang: DEFAULT_LANG,
        isLoading: false,
        errorText: '',
        lastUpdatedAt: 0
    };

    function normalizeLang(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'de' || raw === 'deutsch') return 'de';
        return 'en';
    }

    function getLang() {
        if (typeof window.ecGetSiteLanguage === 'function') {
            return normalizeLang(window.ecGetSiteLanguage());
        }
        return normalizeLang(localStorage.getItem('ec_site_lang') || localStorage.getItem('ec_language'));
    }

    function t(key) {
        const dict = COPY[state.lang] || COPY.en;
        return dict[key] || COPY.en[key] || '';
    }

    function toNumber(value, fallback) {
        const num = Number(value);
        return Number.isFinite(num) ? num : (fallback === undefined ? NaN : fallback);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        if (!(value > 0)) return '--';
        let min = 2;
        let max = 2;
        if (value < 1) {
            min = 4;
            max = 6;
        } else if (value < 100) {
            min = 2;
            max = 4;
        }
        return '$' + new Intl.NumberFormat('en-US', {
            minimumFractionDigits: min,
            maximumFractionDigits: max
        }).format(value);
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '--';
        const sign = value > 0 ? '+' : '';
        return sign + value.toFixed(2) + '%';
    }

    function formatVolume(value) {
        if (!(value > 0)) return '24h Vol --';
        return '24h Vol $' + new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 2
        }).format(value);
    }

    function trendTone(value) {
        if (value > 0.15) return 'positive';
        if (value < -0.15) return 'negative';
        return 'neutral';
    }

    function trendLabel(value) {
        if (value > 0.15) return t('buy');
        if (value < -0.15) return t('sell');
        return t('watch');
    }

    function fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timer = window.setTimeout(function () {
            controller.abort();
        }, 15000);

        return fetch(url, {
            ...(options || {}),
            signal: controller.signal
        }).finally(function () {
            window.clearTimeout(timer);
        });
    }

    async function fetchQuotes() {
        const tradeResponse = await fetchWithTimeout(`${INFOWAY_TRADE_URL}?codes=${encodeURIComponent(marketCodes)}`, {
            headers: { accept: 'application/json' }
        });
        if (!tradeResponse.ok) throw new Error(`Infoway trade HTTP ${tradeResponse.status}`);
        const tradePayload = await tradeResponse.json();
        const tradeRows = marketData.parseTradeResponse(tradePayload);

        const klineResponse = await fetchWithTimeout(INFOWAY_KLINE_URL, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify(marketData.buildKlineRequest(marketCodes, 8, 7))
        });
        if (!klineResponse.ok) throw new Error(`Infoway kline HTTP ${klineResponse.status}`);
        const klinePayload = await klineResponse.json();
        const dailyMap = marketData.mapKlineResponse(klinePayload);
        return siteData.deriveUsdQuoteMap(tradeRows, dailyMap);
    }

    function buildRows(quoteMap) {
        return RATE_UNIVERSE.map(function (asset) {
            const quote = quoteMap[asset.base];
            if (!quote || !(quote.price > 0)) return null;
            return {
                symbol: asset.base,
                name: asset.name,
                accent: asset.accent,
                image: '',
                price: toNumber(quote.price, 0),
                dayChange: toNumber(quote.changePercent, NaN),
                weekChange: toNumber(quote.weekChange, 0),
                volume: toNumber(quote.volume, 0)
            };
        }).filter(Boolean);
    }

    function filteredRows() {
        const query = state.search.trim().toLowerCase();
        if (!query) return state.rows;
        return state.rows.filter(function (row) {
            return row.symbol.toLowerCase().indexOf(query) >= 0 ||
                row.name.toLowerCase().indexOf(query) >= 0;
        });
    }

    function iconMarkup(row, className) {
        const letters = row.symbol.length > 4 ? row.symbol.slice(0, 2) : row.symbol.slice(0, 3);
        return '<span class="' + className + ' rate-coin-fallback" data-accent="' + escapeHtml(row.accent) + '">' + escapeHtml(letters) + '</span>';
    }

    function buildSparklinePath(row) {
        const seed = row.symbol.split('').reduce(function (sum, ch) { return sum + ch.charCodeAt(0); }, 0);
        const values = [];
        const count = 11;
        const base = 18 + ((seed % 7) * 1.2);
        const drift = Number.isFinite(row.dayChange) ? row.dayChange * 0.22 : 0;
        const weekly = Number.isFinite(row.weekChange) ? row.weekChange * 0.08 : 0;
        for (let i = 0; i < count; i += 1) {
            const wave = Math.sin((i + seed) * 0.72) * 6;
            const noise = Math.cos((i + 2 + seed) * 0.37) * 3.2;
            const trend = ((i - (count - 1) / 2) * (drift / 5)) + (weekly / 9);
            values.push(base + wave + noise + trend);
        }
        const min = Math.min.apply(null, values);
        const max = Math.max.apply(null, values);
        const range = Math.max(1, max - min);
        return values.map(function (value, index) {
            const x = (index / (count - 1)) * 132;
            const y = 36 - (((value - min) / range) * 30) - 3;
            return (index === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
        }).join(' ');
    }

    function renderTopList(container, rows, key) {
        const top = rows
            .filter(function (row) { return Number.isFinite(row[key]); })
            .sort(function (a, b) { return Number(b[key]) - Number(a[key]); })
            .slice(0, 3);

        container.innerHTML = top.map(function (row) {
            const tone = trendTone(row[key]);
            return '' +
                '<a class="rate-list-item" href="buy-sell.html">' +
                '  <span class="rate-list-main">' +
                iconMarkup(row, 'rate-coin-icon') +
                '    <span class="rate-coin-copy">' +
                '      <span class="rate-coin-name">' + escapeHtml(row.name) + '</span>' +
                '      <span class="rate-coin-symbol">(' + escapeHtml(row.symbol) + ')</span>' +
                '    </span>' +
                '  </span>' +
                '  <span class="rate-list-side">' +
                '    <span class="rate-change ' + tone + '">' + formatPercent(row[key]) + '</span>' +
                '    <span class="rate-action-chip"><i class="ri-shopping-bag-3-line"></i></span>' +
                '  </span>' +
                '</a>';
        }).join('');
    }

    function renderTable(rows) {
        dom.tableBody.innerHTML = rows.map(function (row) {
            const sell = row.price > 0 ? row.price * (1 - PRICE_SPREAD_RATE) : 0;
            const buy = row.price > 0 ? row.price * (1 + PRICE_SPREAD_RATE) : 0;
            const tone = trendTone(row.dayChange);
            return '' +
                '<tr>' +
                '  <td class="rate-table-icon-cell">' + iconMarkup(row, 'rate-table-icon rate-coin-icon') + '</td>' +
                '  <td class="rate-name-cell">' +
                '    <div class="rate-name-block">' +
                '      <strong>' + escapeHtml(row.name) + '</strong>' +
                '      <span>' + escapeHtml(formatVolume(row.volume)) + '</span>' +
                '    </div>' +
                '  </td>' +
                '  <td><span class="rate-symbol-pill">' + escapeHtml(row.symbol) + '/' + escapeHtml(state.quoteCurrency) + '</span></td>' +
                '  <td class="rate-price-cell">' + formatPrice(sell) + '</td>' +
                '  <td class="rate-price-cell">' + formatPrice(buy) + '</td>' +
                '  <td><span class="rate-change ' + tone + '">' + formatPercent(row.dayChange) + '</span></td>' +
                '  <td>' +
                '    <div class="rate-trend-cell">' +
                '      <svg class="rate-sparkline ' + tone + '" viewBox="0 0 132 36" aria-hidden="true">' +
                '        <path d="' + buildSparklinePath(row) + '"></path>' +
                '      </svg>' +
                '      <span class="rate-pill ' + tone + '">' + escapeHtml(trendLabel(row.dayChange)) + '</span>' +
                '    </div>' +
                '  </td>' +
                '</tr>';
        }).join('');
    }

    function render() {
        const rows = filteredRows();
        renderTopList(dom.todayList, state.rows, 'dayChange');
        renderTopList(dom.weekList, state.rows, 'weekChange');
        renderTable(rows);

        if (rows.length > 0) {
            dom.emptyState.classList.remove('visible');
            dom.emptyState.textContent = '';
            return;
        }

        dom.emptyState.classList.add('visible');
        if (state.isLoading && state.rows.length === 0) {
            dom.emptyState.textContent = t('loading');
            return;
        }
        if (state.rows.length === 0) {
            dom.emptyState.textContent = state.errorText || t('noData');
            return;
        }
        dom.emptyState.textContent = t('noMatch');
    }

    async function refreshRows() {
        if (state.isLoading) return;
        state.isLoading = true;
        render();
        try {
            const quoteMap = await fetchQuotes();
            const rows = buildRows(quoteMap);
            if (!rows.length) throw new Error('No supported rate rows generated');
            state.rows = rows;
            state.lastUpdatedAt = Date.now();
            state.errorText = '';
        } catch (error) {
            console.warn('Rate page data fetch failed:', error && error.message ? error.message : error);
            state.errorText = t('noData');
        } finally {
            state.isLoading = false;
            render();
        }
    }

    function applyLangAndLabels() {
        state.lang = getLang();
        if (dom.searchInput) dom.searchInput.placeholder = t('searchPlaceholder');
        if (dom.usdLabel) dom.usdLabel.textContent = state.quoteCurrency;
        render();
    }

    function initEvents() {
        if (dom.searchInput) {
            dom.searchInput.addEventListener('input', function (event) {
                state.search = String(event.target.value || '');
                render();
            });
        }
        if (dom.usdToggle) {
            dom.usdToggle.addEventListener('change', function () {
                state.quoteCurrency = dom.usdToggle.checked ? 'USD' : 'USDT';
                if (dom.usdLabel) dom.usdLabel.textContent = state.quoteCurrency;
                render();
            });
        }
        window.addEventListener('storage', function (event) {
            if (event.key === 'ec_site_lang' || event.key === 'ec_language') {
                applyLangAndLabels();
            }
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) refreshRows();
        });
    }

    applyLangAndLabels();
    initEvents();
    refreshRows();
    window.setInterval(refreshRows, POLL_MS);
})();

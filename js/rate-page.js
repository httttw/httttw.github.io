(function () {
    const RATE_UNIVERSE = [
        { symbol: 'BTC', id: 'bitcoin', name: 'Bitcoin', accent: 'amber' },
        { symbol: 'ETH', id: 'ethereum', name: 'Ethereum', accent: 'blue' },
        { symbol: 'SOL', id: 'solana', name: 'Solana', accent: 'green' },
        { symbol: 'XRP', id: 'ripple', name: 'XRP', accent: 'blue' },
        { symbol: 'BNB', id: 'binancecoin', name: 'BNB', accent: 'amber' },
        { symbol: 'ADA', id: 'cardano', name: 'Cardano', accent: 'blue' },
        { symbol: 'DOGE', id: 'dogecoin', name: 'Dogecoin', accent: 'amber' },
        { symbol: 'AVAX', id: 'avalanche-2', name: 'Avalanche', accent: 'red' },
        { symbol: 'LINK', id: 'chainlink', name: 'Chainlink', accent: 'blue' },
        { symbol: 'DOT', id: 'polkadot', name: 'Polkadot', accent: 'green' },
        { symbol: 'LTC', id: 'litecoin', name: 'Litecoin', accent: 'amber' },
        { symbol: 'BCH', id: 'bitcoin-cash', name: 'Bitcoin Cash', accent: 'amber' },
        { symbol: 'TRX', id: 'tron', name: 'TRON', accent: 'red' },
        { symbol: 'XLM', id: 'stellar', name: 'Stellar', accent: 'blue' },
        { symbol: 'TON', id: 'the-open-network', name: 'Toncoin', accent: 'blue' },
        { symbol: 'SUI', id: 'sui', name: 'Sui', accent: 'blue' },
        { symbol: 'HBAR', id: 'hedera-hashgraph', name: 'Hedera', accent: 'green' },
        { symbol: 'ALGO', id: 'algorand', name: 'Algorand', accent: 'blue' },
        { symbol: 'XMR', id: 'monero', name: 'Monero', accent: 'amber' },
        { symbol: 'ICP', id: 'internet-computer', name: 'Internet Computer', accent: 'blue' },
        { symbol: 'NEO', id: 'neo', name: 'NEO', accent: 'green' },
        { symbol: 'IOTA', id: 'iota', name: 'IOTA', accent: 'blue' },
        { symbol: 'MANA', id: 'decentraland', name: 'Decentraland', accent: 'red' },
        { symbol: 'ETC', id: 'ethereum-classic', name: 'Ethereum Classic', accent: 'green' },
        { symbol: 'AXS', id: 'axie-infinity', name: 'Axie Infinity', accent: 'blue' },
        { symbol: 'SAND', id: 'the-sandbox', name: 'The Sandbox', accent: 'amber' },
        { symbol: 'VET', id: 'vechain', name: 'VeChain', accent: 'green' },
        { symbol: 'YFI', id: 'yearn-finance', name: 'yearn.finance', accent: 'blue' },
        { symbol: 'CHZ', id: 'chiliz', name: 'Chiliz', accent: 'red' },
        { symbol: 'HYPE', id: 'hyperliquid', name: 'Hyperliquid', accent: 'green' },
        { symbol: 'IP', id: 'story-2', name: 'Story', accent: 'amber' },
        { symbol: 'WBT', id: 'whitebit', name: 'WhiteBIT Coin', accent: 'blue' },
        { symbol: 'USDC', id: 'usd-coin', name: 'USD Coin', accent: 'blue' },
        { symbol: 'DAI', id: 'dai', name: 'Dai', accent: 'amber' },
        { symbol: 'USDE', id: 'ethena-usde', name: 'Ethena USDe', accent: 'green' }
    ];

    const DEFAULT_LANG = 'en';
    const POLL_MS = 30000;
    const PRICE_SPREAD_RATE = 0.005;
    const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
    const COINGECKO_DEMO_KEY = String(
        window.EC_COINGECKO_DEMO_KEY || localStorage.getItem('ec_coingecko_demo_key') || ''
    ).trim();

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

    if (!dom.todayList || !dom.weekList || !dom.tableBody || !dom.emptyState) {
        return;
    }

    const state = {
        rows: [],
        search: '',
        quoteCurrency: 'USD',
        lang: DEFAULT_LANG,
        isLoading: false,
        lastDataHash: '',
        errorText: ''
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

    function buildSparklinePath(row) {
        const seed = row.symbol.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
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
        return values.map((value, index) => {
            const x = (index / (count - 1)) * 132;
            const y = 36 - (((value - min) / range) * 30) - 3;
            return (index === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
        }).join(' ');
    }

    function iconMarkup(row, className) {
        if (row.image) {
            return '<span class="' + className + '"><img src="' + escapeHtml(row.image) + '" alt="' + escapeHtml(row.symbol) + '"></span>';
        }
        const letters = row.symbol.length > 4 ? row.symbol.slice(0, 2) : row.symbol.slice(0, 3);
        return '<span class="' + className + ' rate-coin-fallback" data-accent="' + escapeHtml(row.accent) + '">' + escapeHtml(letters) + '</span>';
    }

    function filteredRows() {
        const query = state.search.trim().toLowerCase();
        if (!query) return state.rows;
        return state.rows.filter((row) => {
            return row.symbol.toLowerCase().indexOf(query) >= 0 ||
                row.name.toLowerCase().indexOf(query) >= 0;
        });
    }

    function renderTopList(container, rows, key) {
        const top = rows
            .filter((row) => Number.isFinite(row[key]))
            .sort((a, b) => Number(b[key]) - Number(a[key]))
            .slice(0, 3);
        container.innerHTML = top.map((row) => {
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
        dom.tableBody.innerHTML = rows.map((row) => {
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

    function dataHash(rows) {
        return rows.slice(0, 25).map((row) => {
            return [
                row.symbol,
                row.price.toFixed(6),
                Number.isFinite(row.dayChange) ? row.dayChange.toFixed(4) : 'nan',
                Number.isFinite(row.weekChange) ? row.weekChange.toFixed(4) : 'nan'
            ].join(':');
        }).join('|');
    }

    async function fetchCoinGeckoRows() {
        const ids = RATE_UNIVERSE.map((item) => item.id).join(',');
        const params = new URLSearchParams({
            vs_currency: 'usd',
            ids: ids,
            order: 'market_cap_desc',
            per_page: '250',
            page: '1',
            sparkline: 'false',
            price_change_percentage: '7d',
            locale: 'en'
        });
        const headers = { accept: 'application/json' };
        if (COINGECKO_DEMO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_DEMO_KEY;

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(COINGECKO_BASE_URL + '/coins/markets?' + params.toString(), {
                headers,
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            const payload = await response.json();
            const byId = {};
            (payload || []).forEach((item) => { byId[item.id] = item; });

            return RATE_UNIVERSE.map((meta) => {
                const item = byId[meta.id] || {};
                return {
                    symbol: meta.symbol,
                    name: item.name || meta.name,
                    accent: meta.accent,
                    image: item.image || '',
                    price: toNumber(item.current_price, 0),
                    dayChange: toNumber(item.price_change_percentage_24h_in_currency || item.price_change_percentage_24h, NaN),
                    weekChange: toNumber(item.price_change_percentage_7d_in_currency, NaN),
                    volume: toNumber(item.total_volume, 0)
                };
            }).filter((row) => row.price > 0 || Number.isFinite(row.dayChange));
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function refreshRows() {
        if (state.isLoading) return;
        state.isLoading = true;
        render();
        try {
            const rows = await fetchCoinGeckoRows();
            const hash = dataHash(rows);
            state.errorText = '';
            if (hash !== state.lastDataHash) {
                state.rows = rows;
                state.lastDataHash = hash;
            }
        } catch (error) {
            state.errorText = t('noData');
            console.warn('Rate page data fetch failed:', error && error.message ? error.message : error);
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
            dom.searchInput.addEventListener('input', (event) => {
                state.search = String(event.target.value || '');
                render();
            });
        }
        if (dom.usdToggle) {
            dom.usdToggle.addEventListener('change', () => {
                state.quoteCurrency = dom.usdToggle.checked ? 'USD' : 'USDT';
                if (dom.usdLabel) dom.usdLabel.textContent = state.quoteCurrency;
                render();
            });
        }
        window.addEventListener('storage', (event) => {
            if (event.key === 'ec_site_lang' || event.key === 'ec_language') {
                applyLangAndLabels();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) refreshRows();
        });
    }

    applyLangAndLabels();
    initEvents();
    refreshRows();
    window.setInterval(refreshRows, POLL_MS);
})();

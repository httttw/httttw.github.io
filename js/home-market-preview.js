(function () {
    const tableBody = document.getElementById('home-market-table-body');
    const statusEl = document.getElementById('home-market-status');
    const tabEls = Array.from(document.querySelectorAll('[data-home-market-tab]'));
    if (!tableBody || tabEls.length === 0) return;

const TWELVE_DATA_API_KEY = '217ed0f158d74b57b4d374b2373269a4-infoway';
    const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
    const COINGECKO_DEMO_KEY = String(window.EC_COINGECKO_DEMO_KEY || localStorage.getItem('ec_coingecko_demo_key') || '').trim();
    const COINGECKO_PROXY_URL = String(
        window.EC_COINGECKO_PROXY_URL || localStorage.getItem('ec_coingecko_proxy_url') || ''
    ).trim();

    const HOME_MARKET_UNIVERSE = [
        { symbol: 'BTC/USDT', accent: '#f59e0b', icon: 'B' },
        { symbol: 'ETH/USDT', accent: '#6366f1', icon: 'E' },
        { symbol: 'HBAR/USDT', accent: '#111111', icon: 'H' },
        { symbol: 'IP/USDT', accent: '#f59e0b', icon: 'IP' },
        { symbol: 'WBT/USDT', accent: '#f59e0b', icon: 'W' },
        { symbol: 'XMR/USDT', accent: '#f97316', icon: 'X' },
        { symbol: 'ALGO/USDT', accent: '#111111', icon: 'A' },
        { symbol: 'ADA/USDT', accent: '#2563eb', icon: 'A' }
    ];

    const COINGECKO_SYMBOL_TO_ID = {
        BTC: 'bitcoin',
        ETH: 'ethereum',
        HBAR: 'hedera-hashgraph',
        IP: 'story-2',
        WBT: 'whitebit',
        XMR: 'monero',
        ALGO: 'algorand',
        ADA: 'cardano'
    };

    const store = {};
    let activeTab = 'market';
    let refreshTimer = null;
    let isRefreshing = false;
    let coingeckoProxyUnavailable = false;

    function cleanSymbol(value) {
        return String(value || '').replace(/\s+/g, '').toUpperCase();
    }

    function getBase(symbol) {
        return cleanSymbol(symbol).split('/')[0];
    }

    function resolveTwelveDataSymbols(base) {
        if (base === 'IP') return ['IP/USD', 'IP/USDT'];
        if (base === 'WBT') return ['WBT/USDT', 'WBT/USD'];
        return [`${base}/USD`, `${base}/USDT`];
    }

    function setStatus(text, color) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.style.color = color || '#8a879d';
    }

    function mergeRecord(base, incoming, options) {
        const current = store[base] || { price: 0, change: 0, volume: 0, prevClose: 0 };
        const next = { ...current };
        const replacePrice = !!(options && options.replacePrice);
        const replaceChange = !!(options && options.replaceChange);
        const replaceVolume = !!(options && options.replaceVolume);
        const replacePrevClose = !!(options && options.replacePrevClose);

        if (Number.isFinite(incoming.price) && incoming.price > 0 && (replacePrice || !(current.price > 0))) {
            next.price = incoming.price;
        }
        if (Number.isFinite(incoming.change) && (replaceChange || !Number.isFinite(current.change))) {
            next.change = incoming.change;
        }
        if (Number.isFinite(incoming.volume) && incoming.volume > 0 && (replaceVolume || !(current.volume > 0))) {
            next.volume = incoming.volume;
        }
        if (Number.isFinite(incoming.prevClose) && incoming.prevClose > 0 && (replacePrevClose || !(current.prevClose > 0))) {
            next.prevClose = incoming.prevClose;
        }
        store[base] = next;
    }

    function formatPrice(value) {
        if (!(value > 0)) return '--';
        return '$ ' + value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: value < 1 ? 6 : 4
        });
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '--';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)} %`;
    }

    function formatVolume(value) {
        if (!(value > 0)) return '--';
        const compact = new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 2
        }).format(value);
        return `$ ${compact}`;
    }

    function buildRowsForTab(tab) {
        const rows = HOME_MARKET_UNIVERSE.map((item) => {
            const base = getBase(item.symbol);
            const live = store[base] || {};
            return {
                ...item,
                base,
                price: Number(live.price || 0),
                change: Number.isFinite(live.change) ? Number(live.change) : NaN,
                volume: Number(live.volume || 0)
            };
        });

        if (tab === 'hot') {
            rows.sort((a, b) => (b.volume || -1) - (a.volume || -1));
        } else if (tab === 'gainers') {
            rows.sort((a, b) => {
                const aVal = Number.isFinite(a.change) ? a.change : -Infinity;
                const bVal = Number.isFinite(b.change) ? b.change : -Infinity;
                return bVal - aVal;
            });
        }

        return rows;
    }

    function renderTable() {
        const rows = buildRowsForTab(activeTab);
        if (rows.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="home-market-empty">No market data available.</td></tr>';
            return;
        }

        tableBody.innerHTML = rows.map((row) => {
            const changeClass = Number.isFinite(row.change)
                ? (row.change >= 0 ? 'home-market-change-positive' : 'home-market-change-negative')
                : '';
            return `
                <tr>
                    <td>
                        <div class="pair-info">
                            <div class="home-market-icon" style="color:${row.accent};">${row.icon}</div>
                            ${row.symbol}
                        </div>
                    </td>
                    <td style="font-weight: 500;">${formatPrice(row.price)}</td>
                    <td class="${changeClass}">${formatPercent(row.change)}</td>
                    <td>${formatVolume(row.volume)}</td>
                    <td style="text-align: right;"><a href="buy-sell.html" class="btn-buy-sell">Buy/sell</a></td>
                </tr>
            `;
        }).join('');
    }

    async function fetchTwelveDataQuotes() {
        const apiSymbols = [];
        HOME_MARKET_UNIVERSE.forEach((item) => {
            resolveTwelveDataSymbols(getBase(item.symbol)).forEach((symbol) => apiSymbols.push(symbol));
        });

        const uniqueSymbols = Array.from(new Set(apiSymbols));
        if (uniqueSymbols.length === 0) return 0;

        const url = `https://api.twelvedata.com/quote?symbol=${uniqueSymbols.map(encodeURIComponent).join(',')}&apikey=${TWELVE_DATA_API_KEY}`;
        const response = await fetch(url);
        const payload = await response.json();
        const results = uniqueSymbols.length === 1 && !payload[uniqueSymbols[0]] ? { [uniqueSymbols[0]]: payload } : payload;

        let updated = 0;
        uniqueSymbols.forEach((apiSymbol) => {
            const info = results[apiSymbol];
            if (!info || info.status === 'error') return;
            const base = getBase(apiSymbol);
            mergeRecord(base, {
                price: Number(info.close || 0),
                change: Number(info.percent_change || 0),
                volume: Number(info.rolling_24h_volume || info.volume || 0),
                prevClose: Number(info.previous_close || 0)
            }, {
                replacePrice: true,
                replaceChange: true,
                replaceVolume: true,
                replacePrevClose: true
            });
            updated += 1;
        });

        return updated;
    }

    async function fetchCoinGeckoSimplePrice(idsCsv) {
        const params = new URLSearchParams({
            ids: idsCsv,
            vs_currencies: 'usd',
            include_24hr_change: 'true',
            include_24hr_vol: 'true',
            include_last_updated_at: 'true'
        });

        if (COINGECKO_PROXY_URL && !coingeckoProxyUnavailable) {
            const glue = COINGECKO_PROXY_URL.includes('?') ? '&' : '?';
            const proxyUrl = `${COINGECKO_PROXY_URL}${glue}${params.toString()}`;
            const proxyResponse = await fetch(proxyUrl, { headers: { accept: 'application/json' } });
            if (proxyResponse.ok) {
                return await proxyResponse.json();
            }
            if (proxyResponse.status === 404 || proxyResponse.status === 502 || proxyResponse.status === 530) {
                coingeckoProxyUnavailable = true;
            }
        }

        const headers = { accept: 'application/json' };
        if (COINGECKO_DEMO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_DEMO_KEY;
        const directResponse = await fetch(`${COINGECKO_BASE_URL}/simple/price?${params.toString()}`, { headers });
        if (!directResponse.ok) {
            throw new Error(`CoinGecko HTTP ${directResponse.status}`);
        }
        return await directResponse.json();
    }

    async function fetchCoinGeckoQuotes() {
        const ids = Array.from(new Set(HOME_MARKET_UNIVERSE
            .map((item) => COINGECKO_SYMBOL_TO_ID[getBase(item.symbol)])
            .filter(Boolean)));
        if (ids.length === 0) return 0;

        const idToBase = {};
        Object.keys(COINGECKO_SYMBOL_TO_ID).forEach((base) => {
            idToBase[COINGECKO_SYMBOL_TO_ID[base]] = base;
        });

        const payload = await fetchCoinGeckoSimplePrice(ids.join(','));
        let updated = 0;

        ids.forEach((id) => {
            const info = payload[id];
            if (!info || !Number.isFinite(Number(info.usd))) return;
            const base = idToBase[id];
            const price = Number(info.usd);
            const change = Number.isFinite(Number(info.usd_24h_change)) ? Number(info.usd_24h_change) : 0;
            const volume = Number.isFinite(Number(info.usd_24h_vol)) ? Number(info.usd_24h_vol) : 0;
            const prevClose = change === -100 ? price : (price / (1 + (change / 100)));

            mergeRecord(base, {
                price,
                change,
                volume,
                prevClose
            }, {
                replacePrice: !(store[base] && store[base].price > 0),
                replaceChange: !(store[base] && Number.isFinite(store[base].change)),
                replaceVolume: true,
                replacePrevClose: !(store[base] && store[base].prevClose > 0)
            });
            updated += 1;
        });

        return updated;
    }

    async function refreshMarketData() {
        if (isRefreshing) return;
        if (document.visibilityState === 'hidden') return;
        isRefreshing = true;
        setStatus('Updating market data...', '#8a879d');

        try {
            const twelveCount = await fetchTwelveDataQuotes();
            const geckoCount = await fetchCoinGeckoQuotes();
            renderTable();

            if (twelveCount > 0 && geckoCount > 0) {
                setStatus('Live market data (hybrid)', '#18a957');
            } else if (geckoCount > 0) {
                setStatus('Live market data (CoinGecko)', '#18a957');
            } else if (twelveCount > 0) {
                setStatus('Live market data (TwelveData)', '#18a957');
            } else {
                setStatus('Market data unavailable', '#d44848');
            }
        } catch (error) {
            console.error('Home market preview update failed:', error);
            renderTable();
            setStatus('Market data unavailable', '#d44848');
        } finally {
            isRefreshing = false;
        }
    }

    tabEls.forEach((tabEl) => {
        tabEl.addEventListener('click', () => {
            activeTab = tabEl.getAttribute('data-home-market-tab') || 'market';
            tabEls.forEach((item) => item.classList.toggle('active', item === tabEl));
            renderTable();
        });
    });

    function startPreviewRefresh() {
        if (refreshTimer) return;
        refreshMarketData();
        refreshTimer = window.setInterval(refreshMarketData, 15000);
    }

    renderTable();
    if (document.readyState === 'complete') {
        window.setTimeout(startPreviewRefresh, 400);
    } else {
        window.addEventListener('load', () => window.setTimeout(startPreviewRefresh, 400), { once: true });
    }

    window.addEventListener('beforeunload', () => {
        if (refreshTimer) window.clearInterval(refreshTimer);
    });
})();

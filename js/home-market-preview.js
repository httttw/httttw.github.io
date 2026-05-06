(function () {
    const tableBody = document.getElementById('home-market-table-body');
    const statusEl = document.getElementById('home-market-status');
    const tabEls = Array.from(document.querySelectorAll('[data-home-market-tab]'));
    const siteData = window.ECInfowaySiteData || null;
    const marketData = window.ECInfowayMarketData || null;
    const siteApiConfig = window.ECSiteApiConfig || null;

    if (!tableBody || tabEls.length === 0 || !siteData || !marketData) return;

    const API_ORIGIN = siteApiConfig && typeof siteApiConfig.getApiOrigin === 'function'
        ? siteApiConfig.getApiOrigin(window)
        : 'https://api.easycoinst0re.com';
    const INFOWAY_TRADE_URL = `${API_ORIGIN}/api/infoway/batch-trade`;
    const INFOWAY_KLINE_URL = `${API_ORIGIN}/api/infoway/batch-kline`;
    const HOME_MARKET_UNIVERSE = siteData.HOME_MARKET_ASSETS.slice();
    const store = {};
    const codes = HOME_MARKET_UNIVERSE.map(function (item) {
        return siteData.toMarketCode(item.base);
    }).join(',');

    let activeTab = 'market';
    let refreshTimer = null;
    let isRefreshing = false;
    const ACCENT_COLORS = {
        amber: '#f59e0b',
        blue: '#4f46e5',
        green: '#10b981',
        red: '#ef4444'
    };

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

    function setStatus(text, color) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.style.color = color || '#8a879d';
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
        return sign + value.toFixed(2) + ' %';
    }

    function formatVolume(value) {
        if (!(value > 0)) return '--';
        const compact = new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 2
        }).format(value);
        return '$ ' + compact;
    }

    async function fetchQuotes() {
        const tradeResponse = await fetchWithTimeout(`${INFOWAY_TRADE_URL}?codes=${encodeURIComponent(codes)}`, {
            headers: { accept: 'application/json' }
        });
        if (!tradeResponse.ok) {
            throw new Error(`Infoway trade HTTP ${tradeResponse.status}`);
        }
        const tradePayload = await tradeResponse.json();
        const tradeRows = marketData.parseTradeResponse(tradePayload);

        const klineResponse = await fetchWithTimeout(INFOWAY_KLINE_URL, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify(marketData.buildKlineRequest(codes, 8, 7))
        });
        if (!klineResponse.ok) {
            throw new Error(`Infoway kline HTTP ${klineResponse.status}`);
        }
        const klinePayload = await klineResponse.json();
        const dailyMap = marketData.mapKlineResponse(klinePayload);

        return siteData.deriveUsdQuoteMap(tradeRows, dailyMap);
    }

    function buildRowsForTab(tab) {
        const rows = HOME_MARKET_UNIVERSE.map(function (item) {
            const live = store[item.base] || {};
            return {
                ...item,
                price: Number(live.price || 0),
                change: Number.isFinite(live.changePercent) ? Number(live.changePercent) : NaN,
                volume: Number(live.volume || 0)
            };
        });

        if (tab === 'hot') {
            rows.sort(function (a, b) { return (b.volume || -1) - (a.volume || -1); });
        } else if (tab === 'gainers') {
            rows.sort(function (a, b) {
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

        tableBody.innerHTML = rows.map(function (row) {
            const changeClass = Number.isFinite(row.change)
                ? (row.change >= 0 ? 'home-market-change-positive' : 'home-market-change-negative')
                : '';
            const accentColor = ACCENT_COLORS[row.accent] || '#5b3df5';
            return `
                <tr>
                    <td>
                        <div class="pair-info">
                            <div class="home-market-icon" style="background:${accentColor};color:#ffffff;">${row.icon}</div>
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

    async function refreshMarketData() {
        if (isRefreshing || document.visibilityState === 'hidden') return;
        isRefreshing = true;
        setStatus('Updating market data...', '#8a879d');

        try {
            const quotes = await fetchQuotes();
            HOME_MARKET_UNIVERSE.forEach(function (item) {
                if (quotes[item.base]) {
                    store[item.base] = quotes[item.base];
                }
            });
            renderTable();
            setStatus('Live market data (Infoway)', '#18a957');
        } catch (error) {
            console.error('Home market preview update failed:', error);
            renderTable();
            setStatus('Market data unavailable', '#d44848');
        } finally {
            isRefreshing = false;
        }
    }

    tabEls.forEach(function (tabEl) {
        tabEl.addEventListener('click', function () {
            activeTab = tabEl.getAttribute('data-home-market-tab') || 'market';
            tabEls.forEach(function (item) {
                item.classList.toggle('active', item === tabEl);
            });
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
        window.addEventListener('load', function () {
            window.setTimeout(startPreviewRefresh, 400);
        }, { once: true });
    }

    window.addEventListener('beforeunload', function () {
        if (refreshTimer) window.clearInterval(refreshTimer);
    });
})();

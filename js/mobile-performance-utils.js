(function (globalScope) {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatSignedPercent(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '0.00%';
        const prefix = numeric > 0 ? '+' : '';
        return `${prefix}${numeric.toFixed(2)}%`;
    }

    function formatPrice(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '0.00';
        return numeric.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: numeric >= 100 ? 2 : 4,
        });
    }

    function shouldRenderMobileMarketLists(target) {
        return target === 'homeScreen' || target === 'market';
    }

    function sortExchangeCoins(exchangeCoins, selectedSymbol, getBalance) {
        return exchangeCoins.slice().sort((a, b) => {
            const aSelected = a.s === selectedSymbol ? 1 : 0;
            const bSelected = b.s === selectedSymbol ? 1 : 0;
            if (aSelected !== bSelected) return bSelected - aSelected;

            const aBal = Number(getBalance(a.s)) || 0;
            const bBal = Number(getBalance(b.s)) || 0;
            const aHas = aBal > 0 ? 1 : 0;
            const bHas = bBal > 0 ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
            if (Math.abs(bBal - aBal) > 0.0000001) return bBal - aBal;
            return a.s.localeCompare(b.s);
        });
    }

    function buildExchangeCoinModalMarkup({
        exchangeCoins = [],
        selectedSymbol = '',
        getBalance = () => 0,
        copy = { available: 'Available', selected: 'Selected' },
        getCoinIconHtml = () => '',
        formatAmount = (amount) => String(amount),
    }) {
        const sortedCoins = sortExchangeCoins(exchangeCoins, selectedSymbol, getBalance);

        return sortedCoins.map((coin) => {
            const available = Number(getBalance(coin.s)) || 0;
            const isSelected = coin.s === selectedSymbol;

            return `
                <div class="coin-list-row" data-symbol="${escapeHtml(coin.s)}">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div class="coin-icon-sm">${getCoinIconHtml(coin.s, coin.i)}</div>
                            <div>
                                <div style="font-weight:600; font-size:16px;">${escapeHtml(coin.s)}</div>
                                <div style="font-size:12px; color:#8f97a9;">${escapeHtml(copy.available)} ${escapeHtml(formatAmount(available, coin.s))} ${escapeHtml(coin.s)}</div>
                            </div>
                        </div>
                        <div style="font-size:11px; color:${isSelected ? '#6a35ff' : '#8f97a9'}; font-weight:600;">${isSelected ? escapeHtml(copy.selected) : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function buildPairPanelMarkup({
        pairList = [],
        currentTradingCoin = '',
        localData = {},
    }) {
        return pairList.map((pair) => {
            const symbol = String(pair).split('/')[0];
            const isSelected = currentTradingCoin === symbol;
            const price = localData && localData[symbol] ? formatPrice(localData[symbol].price) : '0.00';
            const change = localData && localData[symbol] ? formatSignedPercent(localData[symbol].change) : '0.00%';

            return `
                <div class="panel-list-item${isSelected ? ' selected' : ''}" data-symbol="${escapeHtml(pair)}">
                    <div class="panel-pair-name">${escapeHtml(pair)}</div>
                    <div class="panel-pair-price">
                        <span class="panel-price-val price-${escapeHtml(symbol)}">${price}</span>
                        <span class="panel-change-val change-${escapeHtml(symbol)}">${change}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const api = {
        buildExchangeCoinModalMarkup,
        buildPairPanelMarkup,
        shouldRenderMobileMarketLists,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    globalScope.MobilePerformanceUtils = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
    const CMC_IDS = {
        BTC: 1,
        ETH: 1027,
        BNB: 1839,
        SOL: 5426,
        ADA: 2010,
        XRP: 52,
        DOGE: 74,
        DOT: 6636,
        SHIB: 5994,
        AVAX: 5805,
        LINK: 1975,
        UNI: 7083,
        BUSD: 4687,
        BCH: 1831,
        LTC: 2,
        MATIC: 3890,
        THETA: 2416,
        XLM: 512,
        DAI: 4943,
        VET: 3077,
        ETC: 1321,
        FIL: 2280,
        XMR: 328,
        TRX: 1958,
        EOS: 1765,
        AAVE: 7278,
        ATOM: 3794,
        NEO: 1376,
        ICP: 8916,
        SUSHI: 6758,
        SRM: 6187,
        ZRX: 1896,
        ENJ: 2130,
        MKR: 1518,
        HBAR: 4642,
        TRAC: 3318,
        RLC: 1637,
        BAT: 1697,
        ZIL: 2469,
        COMP: 5692,
        YFI: 5864,
        ALGO: 4030,
        AXS: 6783,
        CAKE: 7186,
        CHZ: 4066,
        CRV: 6538,
        GRT: 6719,
        KNC: 9444,
        MANA: 1966,
        QTUM: 1684,
        SAND: 6210,
        SNX: 2586,
        XTZ: 2011,
        YGG: 10688
    };

    const SYMBOL_ALIASES = {
        BUSD: 'busd',
        USDT: 'usdt',
        BTC: 'btc',
        ETH: 'eth',
        XRP: 'xrp',
        SHIB: 'shib',
        MATIC: 'matic',
        XLM: 'xlm',
        BCH: 'bch',
        LTC: 'ltc',
        DAI: 'dai',
        FIL: 'fil',
        XMR: 'xmr',
        TRX: 'trx',
        EOS: 'eos',
        AAVE: 'aave',
        ATOM: 'atom',
        ICP: 'icp',
        SUSHI: 'sushi',
        ZRX: 'zrx',
        ENJ: 'enj',
        MKR: 'mkr',
        HBAR: 'hbar',
        TNT: 'tnt',
        TRAC: 'trac'
    };

    function cleanSymbol(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
    }

    function deriveSymbol(img) {
        const alt = cleanSymbol(img.getAttribute('alt'));
        if (alt) return alt;
        const text = img.parentElement ? cleanSymbol(img.parentElement.textContent.split(/\s+/)[0]) : '';
        if (text) return text;
        return 'COIN';
    }

    function makeSvgFallback(symbol) {
        const code = cleanSymbol(symbol).slice(0, 4) || 'COIN';
        const colors = ['#6d34e7', '#4f46e5', '#059669', '#0f766e', '#ea580c', '#dc2626'];
        let hash = 0;
        for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash) + code.charCodeAt(i);
        const bg = colors[Math.abs(hash) % colors.length];
        const textColor = '#ffffff';
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="32" fill="${bg}"/>
                <text x="32" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="${code.length > 3 ? 16 : 20}" font-weight="700" fill="${textColor}">${code}</text>
            </svg>
        `.trim();
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getCandidates(symbol) {
        const code = cleanSymbol(symbol);
        const lower = SYMBOL_ALIASES[code] || code.toLowerCase();
        const urls = [];
        if (CMC_IDS[code]) {
            urls.push(`https://s2.coinmarketcap.com/static/img/coins/64x64/${CMC_IDS[code]}.png`);
        }
        urls.push(`https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${lower}.png`);
        urls.push(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${lower}.png`);
        urls.push(makeSvgFallback(code));
        return urls;
    }

    function patchImage(img) {
        if (!img || img.dataset.iconPatched === '1') return;
        const symbol = deriveSymbol(img);
        const candidates = getCandidates(symbol);
        let index = 0;
        img.dataset.iconPatched = '1';
        img.dataset.coinSymbol = symbol;
        img.classList.add('coin-icon-safe');

        const tryNext = () => {
            if (index >= candidates.length) return;
            img.src = candidates[index];
            index += 1;
        };

        img.addEventListener('error', tryNext);
        tryNext();
    }

    function scanIcons(root) {
        const selector = [
            '.coin-item img',
            '#buy-sell-view img[alt]',
            '#auto-buy-view img[alt]',
            '#multi-section img[alt]',
            '.modal-currency img[alt]'
        ].join(',');

        root.querySelectorAll(selector).forEach((img) => patchImage(img));
    }

    function init() {
        scanIcons(document);
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        scanIcons(node);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

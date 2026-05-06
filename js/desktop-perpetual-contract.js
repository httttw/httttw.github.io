import {
    auth,
    db,
    checkSession,
    onAuthStateChanged,
    enforceKycAccess,
    collection,
    addDoc,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    increment
} from '../firebase-config.js';

const PLATFORM_TIMEZONE = 'America/New_York';
const PLATFORM_TIMEZONE_LABEL = 'ET';
const LEVERAGE = 30;
const CONTRACT_UNIT = 100;
const TRADE_FEE_RATE = 0.005;
const PERP_DISPLAY_DURATION_SEC = 60 * 45;
const DISPLAY_STATE_KEY = '__desktopPerpDisplayStateMap';

const state = {
    user: null,
    userData: {},
    balance: 0,
    orderType: 'Market',
    activeTab: 'open',
    openTrades: [],
    historyTrades: [],
    externalQuoteCache: {},
    userUnsubscribe: null,
    tradesUnsubscribe: null,
    authUnsubscribe: null,
    liveUiTimer: null,
    quoteRefreshTimer: null,
    uiBound: false,
    submitting: false,
    closingTradeIds: new Set(),
    modalTradeId: null
};

const dom = {};

window.currentLeverage = LEVERAGE;
window.contractUnit = CONTRACT_UNIT;
window.TRADE_FEE_RATE = TRADE_FEE_RATE;
window.desktopPerpState = state;

function cacheDom() {
    dom.tabs = document.getElementById('desktop-perp-tabs');
    dom.openView = document.getElementById('desktop-perp-open-view');
    dom.positionsView = document.getElementById('desktop-perp-positions-view');
    dom.historyView = document.getElementById('desktop-perp-history-view');
    dom.availableBalance = document.getElementById('desktop-available-balance');
    dom.maxLots = document.getElementById('desktop-max-lots');
    dom.contractUnit = document.getElementById('desktop-contract-unit');
    dom.orderTypeSwitch = document.getElementById('desktop-order-type-switch');
    dom.priceInput = document.getElementById('desktop-perp-price');
    dom.lotsInput = document.getElementById('desktop-perp-lots');
    dom.slider = document.getElementById('desktop-perp-slider');
    dom.tpInput = document.getElementById('desktop-perp-tp');
    dom.slInput = document.getElementById('desktop-perp-sl');
    dom.openLongBtn = document.getElementById('desktop-open-long');
    dom.openShortBtn = document.getElementById('desktop-open-short');
    dom.orderStatus = document.getElementById('desktop-order-status');
    dom.contractValue = document.getElementById('desktop-contract-value');
    dom.margin = document.getElementById('desktop-margin');
    dom.fee = document.getElementById('desktop-fee');
    dom.markPrice = document.getElementById('desktop-mark-price');
    dom.marginRatio = document.getElementById('desktop-margin-ratio');
    dom.maintenanceMargin = document.getElementById('desktop-maintenance-margin');
    dom.marginBalance = document.getElementById('desktop-margin-balance');
    dom.openCount = document.getElementById('desktop-open-count');
    dom.openPnl = document.getElementById('desktop-open-pnl');
    dom.openList = document.getElementById('desktop-open-positions-list');
    dom.historyCount = document.getElementById('desktop-history-count');
    dom.historyPnl = document.getElementById('desktop-history-pnl');
    dom.historyList = document.getElementById('desktop-history-list');
    dom.modal = document.getElementById('desktop-trade-modal');
    dom.modalTitle = document.getElementById('desktop-trade-modal-title');
    dom.modalSubtitle = document.getElementById('desktop-trade-modal-subtitle');
    dom.modalBody = document.getElementById('desktop-trade-modal-body');
    dom.modalClose = document.getElementById('desktop-trade-modal-close');
}

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function parseNumericText(value) {
    const num = Number(String(value || '').replace(/,/g, '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(num) ? num : 0;
}

function escapeHtml(value) {
    return String(value === undefined || value === null ? '--' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeDateInput(value) {
    if (!value && value !== 0) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        const millis = (value.seconds * 1000) + Math.round((value.nanoseconds || 0) / 1e6);
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function formatPlatformDateTime(value) {
    const date = normalizeDateInput(value);
    if (!date) return '--';
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: PLATFORM_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(date);
        const part = (type) => (parts.find((item) => item.type === type) || {}).value || '';
        return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
    } catch (error) {
        return '--';
    }
}

function formatPrice(value) {
    const num = toNumber(value, NaN);
    if (!Number.isFinite(num)) return '--';
    if (Math.abs(num) >= 1000) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (Math.abs(num) >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return num.toFixed(6);
}

function formatPriceInputValue(value) {
    const num = toNumber(value, NaN);
    if (!Number.isFinite(num) || num <= 0) return '';
    return num >= 1000 ? num.toFixed(2) : num.toFixed(4);
}

function formatUsdt(value, digits = 2) {
    const num = toNumber(value, NaN);
    return Number.isFinite(num) ? `${num.toFixed(digits)} USDT` : '--';
}

function formatSigned(value, digits = 2, suffix = '') {
    const num = toNumber(value, NaN);
    if (!Number.isFinite(num)) return '--';
    return `${num >= 0 ? '+' : ''}${num.toFixed(digits)}${suffix}`;
}

function formatPercent(value, digits = 2) {
    return formatSigned(value, digits, '%');
}

function getReadableErrorMessage(error, fallbackMessage) {
    const code = String((error && error.code) || '').toLowerCase();
    const messageMap = {
        'permission-denied': 'Permission denied. Please refresh and try again.',
        'auth/network-request-failed': 'Network unstable. Please retry.',
        'auth/invalid-credential': 'Please log in again.',
        'auth/user-not-found': 'Please log in again.',
        'auth/wrong-password': 'Please log in again.'
    };
    return messageMap[code] || (error && error.message) || fallbackMessage;
}

function getDisplayStateMap() {
    if (!window[DISPLAY_STATE_KEY]) {
        window[DISPLAY_STATE_KEY] = {};
    }
    return window[DISPLAY_STATE_KEY];
}

function buildDisplayStateKey(trade) {
    return String(
        (trade && trade.id)
        || `${trade && trade.coin ? trade.coin : 'COIN'}-${trade && trade.direction ? trade.direction : ''}-${trade && trade.price ? trade.price : ''}-${trade && trade.amount ? trade.amount : ''}`
    );
}

function getCurrentPairText() {
    const quoted = window.desktopPerpQuote && window.desktopPerpQuote.pair
        ? String(window.desktopPerpQuote.pair)
        : '';
    const text = quoted || (document.getElementById('perp-pair-name') || {}).textContent || 'BTC/USDT';
    const normalized = String(text).trim().toUpperCase().replace('-', '/');
    if (!normalized) return 'BTC/USDT';
    return normalized.includes('/') ? normalized : `${normalized}/USDT`;
}

function getCurrentCoinSymbol() {
    return getCurrentPairText().split('/')[0] || 'BTC';
}

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_SYMBOL_TO_ID = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    HBAR: 'hedera-hashgraph',
    XMR: 'monero',
    ALGO: 'algorand',
    ADA: 'cardano',
    DOT: 'polkadot',
    NEO: 'neo',
    IOTA: 'iota',
    XTZ: 'tezos',
    ETC: 'ethereum-classic',
    XRP: 'ripple',
    AXS: 'axie-infinity',
    SAND: 'the-sandbox',
    LTC: 'litecoin',
    MANA: 'decentraland',
    USDC: 'usd-coin',
    SOL: 'solana',
    LINK: 'chainlink',
    CHZ: 'chiliz',
    AVAX: 'avalanche-2',
    BCH: 'bitcoin-cash',
    BNB: 'binancecoin',
    DOGE: 'dogecoin',
    HYPE: 'hyperliquid',
    SUI: 'sui',
    TON: 'toncoin',
    TRX: 'tron',
    XLM: 'stellar',
    ICP: 'internet-computer',
    VET: 'vechain',
    YFI: 'yearn-finance',
    WBT: 'whitebit'
};

function getCurrentQuotePrice() {
    const quotedPair = window.desktopPerpQuote && window.desktopPerpQuote.pair
        ? String(window.desktopPerpQuote.pair).trim().toUpperCase()
        : '';
    const currentPair = getCurrentPairText();
    if (quotedPair === currentPair) {
        const live = toNumber(window.desktopPerpQuote.last, 0);
        if (live > 0) return live;
    }

    const currentCoin = getCurrentCoinSymbol();
    if (state.externalQuoteCache[currentCoin] && toNumber(state.externalQuoteCache[currentCoin].price, 0) > 0) {
        return toNumber(state.externalQuoteCache[currentCoin].price, 0);
    }

    const domPrice = parseNumericText((document.getElementById('perp-last-price') || {}).textContent || '');
    return domPrice > 0 ? domPrice : 0;
}

function getDesktopTradeFeeRate() {
    return TRADE_FEE_RATE;
}

function getDesktopContractUnit() {
    return CONTRACT_UNIT;
}

function getDesktopAvailableBalance() {
    const available = toNumber(state.balance, 0);
    return available > 0 ? available : 0;
}

function getDesktopMaxLots() {
    return Math.max(0, Math.floor((getDesktopAvailableBalance() * LEVERAGE) / getDesktopContractUnit()));
}

function getTradeCoin(trade) {
    const pair = trade && trade.pair ? String(trade.pair) : '';
    const coin = trade && trade.coin ? String(trade.coin) : '';
    return (coin || pair.split('/')[0] || '').trim().toUpperCase();
}

function getTradeLots(trade) {
    const storedLots = toNumber(trade && trade.lots, NaN);
    if (Number.isFinite(storedLots) && storedLots > 0) return storedLots;
    const contractUnit = toNumber(trade && trade.contract_unit, getDesktopContractUnit());
    const amount = toNumber(trade && (trade.amount || trade.notional), 0);
    return contractUnit > 0 ? amount / contractUnit : 0;
}

function isLongTrade(trade) {
    const direction = String((trade && (trade.direction || trade.side)) || '').trim().toLowerCase();
    return direction.includes('long') || direction === 'buy';
}

function getTradeOpenTimestampMs(trade) {
    const ts = trade && (trade.timestamp || trade.open_time || trade.created_at);
    const date = normalizeDateInput(ts);
    return date ? date.getTime() : null;
}

function hashTradeSeed(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function computeSmoothWave(seed, seconds) {
    const a = (seed % 997) / 997;
    const b = (seed % 313) / 313;
    const c = (seed % 173) / 173;
    const wave = (
        Math.sin(seconds * (0.34 + a * 0.3) + (a * Math.PI * 2)) +
        (0.52 * Math.sin(seconds * (0.16 + b * 0.22) + (b * Math.PI * 2))) +
        (0.26 * Math.cos(seconds * (0.08 + c * 0.18) + (c * Math.PI * 2)))
    );
    return clampNumber(wave / 1.78, -1, 1);
}

function parsePerpetualYieldValue(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizePerpetualControlEntry(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'object' && !Array.isArray(value)) {
        const closePrice = toNumber(value.closePrice ?? value.price ?? value.customClosePrice, NaN);
        const yieldRate = parsePerpetualYieldValue(value.yieldRate ?? value.targetYieldPct ?? value.customYieldPct ?? value.customRoePct);
        return {
            closePrice: Number.isFinite(closePrice) && closePrice > 0 ? closePrice : null,
            yieldRate
        };
    }

    const legacyPrice = toNumber(value, NaN);
    return Number.isFinite(legacyPrice) && legacyPrice > 0
        ? { closePrice: legacyPrice, yieldRate: null }
        : null;
}

function getUserPerpetualCustomControl(userData, coin) {
    const normalizedCoin = String(coin || '').trim().toUpperCase();
    const priceMap = userData && userData.perpetual_custom_prices && typeof userData.perpetual_custom_prices === 'object'
        ? userData.perpetual_custom_prices
        : null;

    if (priceMap && normalizedCoin) {
        const directEntry = normalizePerpetualControlEntry(priceMap[normalizedCoin]);
        if (directEntry) return directEntry;
    }

    const legacyPrice = toNumber(userData && userData.perpetual_custom_price, NaN);
    return Number.isFinite(legacyPrice) && legacyPrice > 0
        ? { closePrice: legacyPrice, yieldRate: null }
        : null;
}

function computePerpetualClosePriceFromYield(entryPrice, targetYieldPct, feeRate, isLong) {
    const safeEntry = toNumber(entryPrice, 0);
    const safeYield = parsePerpetualYieldValue(targetYieldPct);
    const safeFeeRate = toNumber(feeRate, TRADE_FEE_RATE);
    if (!(safeEntry > 0) || safeYield === null) return null;
    const moveRatio = (safeYield / 100) + safeFeeRate;
    const multiplier = isLong ? (1 + moveRatio) : (1 - moveRatio);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
    const closePrice = safeEntry * multiplier;
    return Number.isFinite(closePrice) && closePrice > 0 ? closePrice : null;
}

function getDesktopTradeLivePrice(trade, fallbackPrice) {
    const coin = getTradeCoin(trade);
    if (coin === getCurrentCoinSymbol()) {
        const currentQuote = getCurrentQuotePrice();
        if (currentQuote > 0) return currentQuote;
    }
    if (coin && state.externalQuoteCache[coin] && toNumber(state.externalQuoteCache[coin].price, 0) > 0) {
        return toNumber(state.externalQuoteCache[coin].price, 0);
    }
    const fallback = toNumber(fallbackPrice, 0);
    return fallback > 0 ? fallback : 0;
}

function getTradeTargetSettlementMetrics(trade, overrides = {}) {
    if (!trade) return null;

    const entryPrice = toNumber(
        overrides.entryPrice !== undefined ? overrides.entryPrice : (trade.entry_price || trade.price),
        0
    );
    const amount = toNumber(
        overrides.amount !== undefined ? overrides.amount : (trade.amount || trade.notional),
        0
    );
    const leverage = toNumber(
        overrides.leverage !== undefined ? overrides.leverage : trade.leverage,
        0
    );
    const marginFallback = leverage > 0 ? (amount / leverage) : amount;
    const margin = toNumber(
        overrides.margin !== undefined ? overrides.margin : (trade.margin || marginFallback),
        0
    );
    const feeRate = toNumber(trade.fee_rate !== undefined ? trade.fee_rate : TRADE_FEE_RATE, TRADE_FEE_RATE);
    const isLong = overrides.isLongPosition !== undefined ? Boolean(overrides.isLongPosition) : isLongTrade(trade);
    const isOpenTrade = String((trade && trade.status) || '').toLowerCase() === 'open';
    const customYieldPct = parsePerpetualYieldValue(
        overrides.targetYieldPct !== undefined
            ? overrides.targetYieldPct
            : (trade.customYieldPct !== undefined ? trade.customYieldPct : trade.customRoePct)
    );
    const userControl = overrides.userPerpetualControl !== undefined
        ? normalizePerpetualControlEntry(overrides.userPerpetualControl)
        : getUserPerpetualCustomControl(state.userData, getTradeCoin(trade));
    const targetClosePrice = toNumber(
        overrides.targetClosePrice !== undefined
            ? overrides.targetClosePrice
            : (
                (trade.customClosePrice !== undefined && trade.customClosePrice !== null)
                    ? trade.customClosePrice
                    : (
                        customYieldPct !== null
                            ? computePerpetualClosePriceFromYield(entryPrice, customYieldPct, feeRate, isLong)
                            : (
                                isOpenTrade && userControl && userControl.closePrice !== null
                                    ? userControl.closePrice
                                    : (
                                        isOpenTrade && userControl && userControl.yieldRate !== null
                                            ? computePerpetualClosePriceFromYield(entryPrice, userControl.yieldRate, feeRate, isLong)
                                            : trade.close_price
                                    )
                            )
                    )
            ),
        0
    );

    if (!(entryPrice > 0) || !(amount > 0) || !(margin > 0) || !(targetClosePrice > 0)) return null;

    const totalFee = amount * feeRate;
    const rawPnl = isLong
        ? ((targetClosePrice - entryPrice) / entryPrice) * amount
        : ((entryPrice - targetClosePrice) / entryPrice) * amount;
    const pnl = rawPnl - totalFee;
    const roe = margin > 0 ? (pnl / margin) * 100 : 0;

    return {
        closePrice: targetClosePrice,
        rawPnl,
        pnl,
        roe,
        totalFee,
        feeClose: Math.max(0, totalFee - toNumber(trade.fee_open, 0)),
        isLong
    };
}

function getPerpetualDisplayPrice(trade, fallbackPrice) {
    const marketPrice = getDesktopTradeLivePrice(trade, fallbackPrice);
    const entryPrice = toNumber(trade && (trade.entry_price || trade.price || fallbackPrice), 0);
    const isPerpetual = String((trade && trade.type) || '').toLowerCase() === 'perpetual';
    const isOpen = String((trade && trade.status) || '').toLowerCase() === 'open';
    const stateMap = getDisplayStateMap();
    const stateKey = buildDisplayStateKey(trade);
    const prevState = stateMap[stateKey];

    if (!(marketPrice > 0)) {
        return entryPrice > 0 ? entryPrice : 0;
    }
    if (!isPerpetual || !isOpen) {
        return marketPrice;
    }

    const nowMs = Date.now();
    const resolvedOpenMs = getTradeOpenTimestampMs(trade);
    const openMs = Number.isFinite(resolvedOpenMs)
        ? resolvedOpenMs
        : (prevState && Number.isFinite(prevState.openMs) ? prevState.openMs : nowMs);
    const elapsedSec = Math.max(0, (nowMs - openMs) / 1000);
    const progress = clampNumber(elapsedSec / PERP_DISPLAY_DURATION_SEC, 0, 0.98);
    const targetMetrics = getTradeTargetSettlementMetrics(trade, { entryPrice });
    const targetClose = targetMetrics && toNumber(targetMetrics.closePrice, 0) > 0
        ? toNumber(targetMetrics.closePrice, 0)
        : null;

    let desiredPrice = marketPrice;
    if (entryPrice > 0 && targetClose !== null) {
        const trendCurve = 1 - Math.pow(1 - progress, 1.35);
        const trendPrice = entryPrice + ((targetClose - entryPrice) * trendCurve);
        const seed = hashTradeSeed(trade && trade.id ? trade.id : `${trade.coin || ''}-${openMs}`);
        const wave = computeSmoothWave(seed, elapsedSec);
        const marketGap = Math.abs(marketPrice - entryPrice) / entryPrice;
        const jitterPct = clampNumber(0.0018 + (marketGap * 0.2), 0.0018, 0.0105);
        const jitterPrice = trendPrice * jitterPct * wave;
        desiredPrice = trendPrice + jitterPrice;

        const boundsPad = entryPrice * (0.01 + (jitterPct * 3.8));
        const lowerBound = Math.max(0.00000001, Math.min(entryPrice, targetClose) - boundsPad);
        const upperBound = Math.max(entryPrice, targetClose) + boundsPad;
        desiredPrice = clampNumber(desiredPrice, lowerBound, upperBound);
        desiredPrice = (desiredPrice * 0.88) + (marketPrice * 0.12);

        const convergence = clampNumber((progress - 0.72) / 0.28, 0, 1);
        if (convergence > 0) {
            desiredPrice = (desiredPrice * (1 - convergence * 0.52)) + (targetClose * convergence * 0.52);
        }
    }

    if (prevState && Number.isFinite(prevState.price) && prevState.price > 0 && Number.isFinite(prevState.ts)) {
        const dtSec = clampNumber((nowMs - prevState.ts) / 1000, 0.06, 6);
        const maxStepPct = clampNumber(0.0022 * dtSec, 0.0008, 0.014);
        const maxStep = prevState.price * maxStepPct;
        const stepped = prevState.price + clampNumber(desiredPrice - prevState.price, -maxStep, maxStep);
        stateMap[stateKey] = { price: stepped, ts: nowMs, openMs };
        return stepped;
    }

    stateMap[stateKey] = { price: desiredPrice, ts: nowMs, openMs };
    return desiredPrice;
}

function resolveTradeStatusLabel(trade) {
    const raw = String((trade && trade.status) || '').trim();
    if (!raw) return 'Closed';
    if (/^win$/i.test(raw)) return 'Win';
    if (/^lose$/i.test(raw)) return 'Lose';
    if (/^approved$/i.test(raw)) return 'Approved';
    if (/^rejected$/i.test(raw)) return 'Rejected';
    if (/^open$/i.test(raw)) return 'Open';
    if (/^pending$/i.test(raw)) return 'Pending';
    if (/^closed$/i.test(raw)) return 'Closed';
    return raw;
}

function resolveTradeStatusTone(trade) {
    const status = resolveTradeStatusLabel(trade).toLowerCase();
    if (status === 'open' || status === 'pending') return 'open';
    return 'closed';
}

function getTradeClosePrice(trade) {
    if (!trade) return null;
    if (trade.close_price !== undefined && trade.close_price !== null) return toNumber(trade.close_price, null);
    if (trade.settlement_price !== undefined && trade.settlement_price !== null) return toNumber(trade.settlement_price, null);
    return null;
}

function applySliderBackground(value) {
    if (!dom.slider) return;
    const sliderValue = clampNumber(toNumber(value !== undefined ? value : dom.slider.value, 0), 0, 100);
    dom.slider.style.background = `linear-gradient(to right, var(--accent-color) ${sliderValue}%, var(--border-color) ${sliderValue}%)`;
}

function setDesktopOrderStatus(text, tone = 'neutral') {
    if (!dom.orderStatus) return;
    dom.orderStatus.textContent = text;
    dom.orderStatus.classList.remove('is-neutral', 'is-success', 'is-danger');
    if (tone === 'success') {
        dom.orderStatus.classList.add('is-success');
        return;
    }
    if (tone === 'danger') {
        dom.orderStatus.classList.add('is-danger');
        return;
    }
    dom.orderStatus.classList.add('is-neutral');
}

function setDesktopOrderType(type) {
    state.orderType = type === 'Limit' ? 'Limit' : 'Market';
    const buttons = dom.orderTypeSwitch ? dom.orderTypeSwitch.querySelectorAll('.type-btn') : [];
    buttons.forEach((button) => {
        button.classList.toggle('active', button.dataset.orderType === state.orderType);
    });
    if (dom.priceInput) {
        const isMarket = state.orderType === 'Market';
        dom.priceInput.readOnly = isMarket;
        dom.priceInput.style.opacity = isMarket ? '0.75' : '1';
        if (isMarket) {
            dom.priceInput.value = formatPriceInputValue(getCurrentQuotePrice());
        } else if (!dom.priceInput.value) {
            dom.priceInput.value = formatPriceInputValue(getCurrentQuotePrice());
        }
    }
    updateDesktopOpenForm();
}

function setDesktopTab(tab) {
    const nextTab = ['open', 'positions', 'history'].includes(tab) ? tab : 'open';
    state.activeTab = nextTab;
    if (dom.tabs) {
        dom.tabs.querySelectorAll('.form-tab').forEach((item) => {
            item.classList.toggle('active', item.dataset.tab === nextTab);
        });
    }
    if (dom.openView) dom.openView.classList.toggle('is-active', nextTab === 'open');
    if (dom.positionsView) dom.positionsView.classList.toggle('is-active', nextTab === 'positions');
    if (dom.historyView) dom.historyView.classList.toggle('is-active', nextTab === 'history');

    if (nextTab === 'positions') renderDesktopOpenPositions();
    if (nextTab === 'history') renderDesktopTradeHistory();
    if (nextTab === 'open') updateDesktopOpenForm();
}

function setDesktopSliderByLots(lots) {
    if (!dom.slider) return;
    const maxLots = getDesktopMaxLots();
    const percent = maxLots > 0 ? clampNumber((toNumber(lots, 0) / maxLots) * 100, 0, 100) : 0;
    dom.slider.value = String(Math.round(percent));
    applySliderBackground(percent);
}

function setLotsBySliderPercent(percentValue) {
    const percent = clampNumber(toNumber(percentValue, 0), 0, 100);
    const maxLots = getDesktopMaxLots();
    const lots = Math.floor((percent / 100) * maxLots);
    if (dom.lotsInput) dom.lotsInput.value = lots > 0 ? String(lots) : '';
    applySliderBackground(percent);
    updateDesktopOpenForm(false);
}

function updateDesktopOpenForm(syncSlider = true) {
    const available = getDesktopAvailableBalance();
    const maxLots = getDesktopMaxLots();
    const contractUnit = getDesktopContractUnit();
    const livePrice = getCurrentQuotePrice();
    const isMarket = state.orderType === 'Market';
    if (dom.priceInput && isMarket) {
        dom.priceInput.value = formatPriceInputValue(livePrice);
    }

    let lots = Math.max(0, Math.floor(toNumber(dom.lotsInput && dom.lotsInput.value, 0)));
    lots = Math.min(lots, maxLots);
    if (dom.lotsInput) {
        dom.lotsInput.value = lots > 0 ? String(lots) : '';
    }

    const entryPrice = toNumber(dom.priceInput && dom.priceInput.value, 0);
    const notional = lots * contractUnit;
    const margin = notional / LEVERAGE;
    const fee = notional * getDesktopTradeFeeRate();
    const maintenanceMargin = notional * 0.005;
    const marginRatio = available > 0 ? (margin / available) * 100 : 0;
    const marginBalance = Math.max(available - margin, 0);

    if (dom.availableBalance) dom.availableBalance.textContent = formatUsdt(available, 2);
    if (dom.maxLots) dom.maxLots.textContent = `${maxLots} Lot`;
    if (dom.contractUnit) dom.contractUnit.textContent = `${contractUnit} USDT/Lot`;
    if (dom.contractValue) dom.contractValue.textContent = formatUsdt(notional, 2);
    if (dom.margin) dom.margin.textContent = formatUsdt(margin, 2);
    if (dom.fee) dom.fee.textContent = formatUsdt(fee, 4);
    if (dom.markPrice) dom.markPrice.textContent = livePrice > 0 ? formatPrice(livePrice) : '--';
    if (dom.marginRatio) dom.marginRatio.innerHTML = `<i class="ri-adjust-line"></i> ${marginRatio.toFixed(2)}%`;
    if (dom.maintenanceMargin) dom.maintenanceMargin.textContent = formatUsdt(maintenanceMargin, 2);
    if (dom.marginBalance) dom.marginBalance.textContent = formatUsdt(marginBalance, 2);

    if (syncSlider) {
        setDesktopSliderByLots(lots);
    }

    if (!state.user) {
        setDesktopOrderStatus('Please log in to open a perpetual position.', 'danger');
        return;
    }
    if (maxLots <= 0) {
        setDesktopOrderStatus('Insufficient available balance. Deposit funds before opening a position.', 'danger');
        return;
    }
    if (isMarket && !(livePrice > 0)) {
        setDesktopOrderStatus('Waiting for live market price...', 'neutral');
        return;
    }
    if (!isMarket && !(entryPrice > 0)) {
        setDesktopOrderStatus('Enter a valid limit price to continue.', 'danger');
        return;
    }
    if (!(lots > 0)) {
        setDesktopOrderStatus(`Available ${available.toFixed(2)} USDT. Max ${maxLots} Lot at 30x.`, 'neutral');
        return;
    }
    if (margin > available) {
        setDesktopOrderStatus(`Margin requirement exceeds available balance. Max open size is ${maxLots} Lot.`, 'danger');
        return;
    }

    setDesktopOrderStatus(
        `${getCurrentPairText()} ${state.orderType} order will use ${margin.toFixed(2)} USDT margin and estimate ${fee.toFixed(2)} USDT total fee.`,
        'success'
    );
}

function renderModalItems(items) {
    return items.map((item) => `
        <div class="desktop-modal-item">
            <span>${escapeHtml(item.label)}</span>
            <strong class="${escapeHtml(item.className || '')}">${escapeHtml(item.value)}</strong>
        </div>
    `).join('');
}

function openDesktopModal({ title, subtitle, items, html, tradeId = null }) {
    if (!dom.modal || !dom.modalBody) return;
    state.modalTradeId = tradeId ? String(tradeId) : null;
    if (dom.modalTitle) dom.modalTitle.textContent = title || 'Order Detail';
    if (dom.modalSubtitle) dom.modalSubtitle.textContent = subtitle || 'Perpetual contract details';
    dom.modalBody.innerHTML = html || renderModalItems(items || []);
    dom.modal.classList.remove('hidden');
}

function closeDesktopModal() {
    if (!dom.modal) return;
    state.modalTradeId = null;
    dom.modal.classList.add('hidden');
}

function findTradeById(tradeId) {
    const allTrades = state.openTrades.concat(state.historyTrades);
    return allTrades.find((trade) => String(trade.id) === String(tradeId)) || null;
}

function buildOpenTradeMetrics(trade) {
    const entryPrice = toNumber(trade.entry_price || trade.price, 0);
    const amount = toNumber(trade.amount || trade.notional, 0);
    const leverage = toNumber(trade.leverage, LEVERAGE) || LEVERAGE;
    const margin = toNumber(trade.margin, amount / leverage || 0);
    const feeOpen = toNumber(trade.fee_open, 0);
    const markPrice = getPerpetualDisplayPrice(trade, entryPrice);
    const rawPnl = isLongTrade(trade)
        ? ((markPrice - entryPrice) / entryPrice) * amount
        : ((entryPrice - markPrice) / entryPrice) * amount;
    const pnl = (entryPrice > 0 && markPrice > 0) ? (rawPnl - feeOpen) : 0;
    const yieldPct = amount > 0 ? (pnl / amount) * 100 : 0;
    const roe = margin > 0 ? (pnl / margin) * 100 : 0;
    return {
        entryPrice,
        markPrice,
        amount,
        leverage,
        margin,
        feeOpen,
        pnl,
        yieldPct,
        roe,
        lots: getTradeLots(trade)
    };
}

function buildClosedTradeMetrics(trade) {
    const entryPrice = toNumber(trade.entry_price || trade.price, 0);
    const amount = toNumber(trade.amount || trade.notional, 0);
    const leverage = toNumber(trade.leverage, LEVERAGE) || LEVERAGE;
    const margin = toNumber(trade.margin, amount / leverage || 0);
    const targetMetrics = getTradeTargetSettlementMetrics(trade);
    const closePrice = (() => {
        const stored = getTradeClosePrice(trade);
        if (stored && stored > 0) return stored;
        return targetMetrics && toNumber(targetMetrics.closePrice, 0) > 0 ? toNumber(targetMetrics.closePrice, 0) : entryPrice;
    })();
    const feeTotal = (() => {
        if (trade.fee_total !== undefined && trade.fee_total !== null) return toNumber(trade.fee_total, 0);
        return targetMetrics ? toNumber(targetMetrics.totalFee, 0) : (amount * getDesktopTradeFeeRate());
    })();
    const feeClose = (() => {
        if (trade.fee_close !== undefined && trade.fee_close !== null) return toNumber(trade.fee_close, 0);
        return targetMetrics ? toNumber(targetMetrics.feeClose, 0) : Math.max(0, feeTotal - toNumber(trade.fee_open, 0));
    })();
    const rawPnl = (() => {
        if (trade.raw_pnl !== undefined && trade.raw_pnl !== null) return toNumber(trade.raw_pnl, 0);
        return targetMetrics ? toNumber(targetMetrics.rawPnl, 0) : 0;
    })();
    const pnl = (() => {
        if (trade.final_pnl !== undefined && trade.final_pnl !== null) return toNumber(trade.final_pnl, 0);
        if (trade.pnl_amount !== undefined && trade.pnl_amount !== null) return toNumber(trade.pnl_amount, 0);
        if (trade.pnl !== undefined && trade.pnl !== null) return toNumber(trade.pnl, 0);
        return targetMetrics ? toNumber(targetMetrics.pnl, 0) : (rawPnl - feeTotal);
    })();
    const roe = (() => {
        if (trade.realized_roe !== undefined && trade.realized_roe !== null) return toNumber(trade.realized_roe, 0);
        return targetMetrics ? toNumber(targetMetrics.roe, 0) : (margin > 0 ? (pnl / margin) * 100 : 0);
    })();
    const yieldPct = amount > 0 ? (pnl / amount) * 100 : 0;
    return {
        entryPrice,
        closePrice,
        amount,
        leverage,
        margin,
        feeTotal,
        feeClose,
        rawPnl,
        pnl,
        yieldPct,
        roe,
        lots: getTradeLots(trade)
    };
}

function buildTradeDetailModalPayload(trade) {
    const isOpen = String(trade.status || '').toLowerCase() === 'open';
    const metrics = isOpen ? buildOpenTradeMetrics(trade) : buildClosedTradeMetrics(trade);
    const pair = trade.pair || `${getTradeCoin(trade)}/USDT`;
    const direction = isLongTrade(trade) ? 'Long' : 'Short';
    const statusLabel = resolveTradeStatusLabel(trade);
    const pnlClass = metrics.pnl >= 0 ? 'desktop-pnl-positive' : 'desktop-pnl-negative';
    const takeProfit = trade.take_profit ? formatPrice(trade.take_profit) : '--';
    const stopLoss = trade.stop_loss ? formatPrice(trade.stop_loss) : '--';
    const openTime = formatPlatformDateTime(trade.timestamp || trade.open_time);
    const closeTime = formatPlatformDateTime(trade.closed_at);
    const markOrCloseLabel = isOpen ? 'Mark Price' : 'Close Price';
    const markOrCloseValue = isOpen ? formatPrice(metrics.markPrice) : formatPrice(metrics.closePrice);
    const feeTotal = isOpen
        ? formatUsdt(metrics.amount * getDesktopTradeFeeRate(), 4)
        : formatUsdt(metrics.feeTotal, 4);
    return {
        title: `${pair} ${direction}`,
        subtitle: `${statusLabel} perpetual order`,
        tradeId: trade.id,
        items: [
            { label: 'Order ID', value: trade.id || '--' },
            { label: 'Pair', value: pair },
            { label: 'Side', value: direction },
            { label: 'Status', value: statusLabel },
            { label: 'Order Type', value: trade.order_type || 'Market' },
            { label: 'Leverage', value: `${metrics.leverage}x Fixed` },
            { label: 'Lots', value: String(Math.round(metrics.lots || 0)) },
            { label: 'Contract Unit', value: `${toNumber(trade.contract_unit, CONTRACT_UNIT)} USDT/Lot` },
            { label: 'Contract Value', value: formatUsdt(metrics.amount, 2) },
            { label: 'Margin', value: formatUsdt(metrics.margin, 2) },
            { label: 'Entry Price', value: formatPrice(metrics.entryPrice) },
            { label: markOrCloseLabel, value: markOrCloseValue },
            { label: 'Yield', value: formatPercent(metrics.yieldPct, 2), className: pnlClass },
            { label: 'ROE', value: formatPercent(metrics.roe, 2), className: pnlClass },
            { label: 'Net P/L', value: `${formatSigned(metrics.pnl, 2)} USDT`, className: pnlClass },
            { label: 'Fee', value: feeTotal },
            { label: 'TP / SL', value: `${takeProfit} / ${stopLoss}` },
            { label: 'Open Time', value: openTime },
            { label: 'Close Time', value: isOpen ? '--' : closeTime },
            { label: 'Timezone', value: `${PLATFORM_TIMEZONE_LABEL} (${PLATFORM_TIMEZONE})` }
        ]
    };
}

function showDesktopTradeDetail(tradeOrId) {
    const trade = typeof tradeOrId === 'string' ? findTradeById(tradeOrId) : tradeOrId;
    if (!trade) {
        setDesktopOrderStatus('Order detail not found.', 'danger');
        return;
    }
    const payload = buildTradeDetailModalPayload(trade);
    openDesktopModal(payload);
}

function syncDesktopModalTrade() {
    if (!state.modalTradeId || !dom.modal || dom.modal.classList.contains('hidden')) return;
    const trade = findTradeById(state.modalTradeId);
    if (!trade) return;
    const payload = buildTradeDetailModalPayload(trade);
    if (dom.modalTitle) dom.modalTitle.textContent = payload.title;
    if (dom.modalSubtitle) dom.modalSubtitle.textContent = payload.subtitle;
    if (dom.modalBody) dom.modalBody.innerHTML = renderModalItems(payload.items);
}

function showDesktopOrderOpenedModal(payload) {
    openDesktopModal({
        title: 'Order Opened',
        subtitle: `${payload.pair} ${payload.direction} position created`,
        items: [
            { label: 'Order ID', value: payload.tradeId },
            { label: 'Pair', value: payload.pair },
            { label: 'Side', value: payload.direction },
            { label: 'Lots', value: String(payload.lots) },
            { label: 'Contract Unit', value: `${payload.contractUnit} USDT/Lot` },
            { label: 'Contract Value', value: formatUsdt(payload.notional, 2) },
            { label: 'Entry Price', value: formatPrice(payload.entryPrice) },
            { label: 'TP / SL', value: `${payload.takeProfit ? formatPrice(payload.takeProfit) : '--'} / ${payload.stopLoss ? formatPrice(payload.stopLoss) : '--'}` },
            { label: 'Fee Estimate', value: formatUsdt(payload.notional * getDesktopTradeFeeRate(), 4) }
        ]
    });
}

function showDesktopCloseResultModal(result) {
    const pnlClass = result.pnl >= 0 ? 'desktop-pnl-positive' : 'desktop-pnl-negative';
    openDesktopModal({
        title: result.pnl >= 0 ? 'Position Closed In Profit' : 'Position Closed',
        subtitle: `${result.pair} settlement completed`,
        items: [
            { label: 'Pair', value: result.pair },
            { label: 'Close Price', value: formatPrice(result.closePrice) },
            { label: 'Entry Price', value: formatPrice(result.entryPrice) },
            { label: 'Contract Value', value: formatUsdt(result.amount, 2) },
            { label: 'Fee', value: formatUsdt(result.feeTotal, 4) },
            { label: 'Yield', value: formatPercent(result.amount > 0 ? (result.pnl / result.amount) * 100 : 0, 2), className: pnlClass },
            { label: 'ROE', value: formatPercent(result.roe, 2), className: pnlClass },
            { label: 'Net P/L', value: `${formatSigned(result.pnl, 2)} USDT`, className: pnlClass }
        ]
    });
}

function showDesktopCloseConfirm(tradeId) {
    const trade = findTradeById(tradeId);
    if (!trade) {
        setDesktopOrderStatus('Position not found.', 'danger');
        return;
    }
    const metrics = buildOpenTradeMetrics(trade);
    const html = `
        <div class="desktop-modal-item">
            <span>Pair</span>
            <strong>${escapeHtml(trade.pair || `${getTradeCoin(trade)}/USDT`)}</strong>
        </div>
        <div class="desktop-modal-item">
            <span>Current Mark Price</span>
            <strong>${escapeHtml(formatPrice(metrics.markPrice))}</strong>
        </div>
        <div class="desktop-modal-item">
            <span>Unrealized P/L</span>
            <strong class="${metrics.pnl >= 0 ? 'desktop-pnl-positive' : 'desktop-pnl-negative'}">${escapeHtml(`${formatSigned(metrics.pnl, 2)} USDT`)}</strong>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="desktop-link-btn" data-modal-action="cancel">Cancel</button>
            <button type="button" class="desktop-close-btn" data-modal-action="confirm-close" data-trade-id="${escapeHtml(trade.id)}">Close Position</button>
        </div>
    `;
    openDesktopModal({
        title: 'Close Position',
        subtitle: 'Confirm perpetual settlement',
        html
    });
}

function renderDesktopOpenPositions() {
    if (!dom.openList) return;
    const stateMap = getDisplayStateMap();
    const trades = state.openTrades.filter((trade) =>
        String(trade.type || '').toLowerCase() === 'perpetual'
        && String(trade.status || '').toLowerCase() === 'open'
    );
    const activeKeys = new Set(trades.map((trade) => buildDisplayStateKey(trade)));
    Object.keys(stateMap).forEach((key) => {
        if (!activeKeys.has(key)) delete stateMap[key];
    });

    if (dom.openCount) dom.openCount.textContent = String(trades.length);
    if (!trades.length) {
        if (dom.openPnl) {
            dom.openPnl.textContent = '0.00 USDT';
            dom.openPnl.classList.remove('desktop-pnl-positive', 'desktop-pnl-negative');
        }
        dom.openList.innerHTML = '<div class="desktop-empty-state">No open perpetual positions.</div>';
        return;
    }

    let totalPnl = 0;
    const html = trades.map((trade) => {
        const metrics = buildOpenTradeMetrics(trade);
        totalPnl += metrics.pnl;
        const pair = trade.pair || `${getTradeCoin(trade)}/USDT`;
        const isLong = isLongTrade(trade);
        const pnlClass = metrics.pnl >= 0 ? 'desktop-pnl-positive' : 'desktop-pnl-negative';
        const tpText = trade.take_profit ? formatPrice(trade.take_profit) : '--';
        const slText = trade.stop_loss ? formatPrice(trade.stop_loss) : '--';

        return `
            <div class="desktop-trade-card">
                <div class="desktop-trade-card-head">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="desktop-side-badge ${isLong ? 'long' : 'short'}">${isLong ? 'Long' : 'Short'}</span>
                        <strong>${escapeHtml(pair)} Perpetual</strong>
                        <span class="desktop-status-badge open">Open</span>
                    </div>
                    <strong class="${pnlClass}">${escapeHtml(`${formatSigned(metrics.pnl, 2)} USDT`)}</strong>
                </div>
                <div class="desktop-trade-card-grid">
                    <div class="desktop-trade-kv">
                        <span>Yield</span>
                        <strong class="${pnlClass}">${escapeHtml(formatPercent(metrics.yieldPct, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>ROE</span>
                        <strong class="${pnlClass}">${escapeHtml(formatPercent(metrics.roe, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Lots</span>
                        <strong>${escapeHtml(String(Math.round(metrics.lots || 0)))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Value</span>
                        <strong>${escapeHtml(formatUsdt(metrics.amount, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Entry</span>
                        <strong>${escapeHtml(formatPrice(metrics.entryPrice))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Mark</span>
                        <strong>${escapeHtml(formatPrice(metrics.markPrice))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Margin</span>
                        <strong>${escapeHtml(formatUsdt(metrics.margin, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>TP / SL</span>
                        <strong>${escapeHtml(`${tpText} / ${slText}`)}</strong>
                    </div>
                </div>
                <div class="desktop-trade-card-actions">
                    <span style="color:var(--text-secondary); font-size:11px;">Opened ${escapeHtml(formatPlatformDateTime(trade.timestamp || trade.open_time))} ${PLATFORM_TIMEZONE_LABEL}</span>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="desktop-link-btn" data-action="detail" data-trade-id="${escapeHtml(trade.id)}">Detail</button>
                        <button type="button" class="desktop-close-btn" data-action="close" data-trade-id="${escapeHtml(trade.id)}"${state.closingTradeIds.has(trade.id) ? ' disabled' : ''}>${state.closingTradeIds.has(trade.id) ? 'Closing...' : 'Close'}</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (dom.openPnl) {
        dom.openPnl.textContent = `${formatSigned(totalPnl, 2)} USDT`;
        dom.openPnl.classList.toggle('desktop-pnl-positive', totalPnl >= 0);
        dom.openPnl.classList.toggle('desktop-pnl-negative', totalPnl < 0);
    }
    dom.openList.innerHTML = html;
}

function renderDesktopTradeHistory() {
    if (!dom.historyList) return;
    const trades = state.historyTrades.filter((trade) => String(trade.type || '').toLowerCase() === 'perpetual');
    if (dom.historyCount) dom.historyCount.textContent = String(trades.length);
    if (!trades.length) {
        if (dom.historyPnl) {
            dom.historyPnl.textContent = '0.00 USDT';
            dom.historyPnl.classList.remove('desktop-pnl-positive', 'desktop-pnl-negative');
        }
        dom.historyList.innerHTML = '<div class="desktop-empty-state">No closed perpetual orders yet.</div>';
        return;
    }

    let totalPnl = 0;
    const html = trades.map((trade) => {
        const metrics = buildClosedTradeMetrics(trade);
        totalPnl += metrics.pnl;
        const pair = trade.pair || `${getTradeCoin(trade)}/USDT`;
        const isLong = isLongTrade(trade);
        const pnlClass = metrics.pnl >= 0 ? 'desktop-pnl-positive' : 'desktop-pnl-negative';
        return `
            <div class="desktop-trade-card">
                <div class="desktop-trade-card-head">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="desktop-side-badge ${isLong ? 'long' : 'short'}">${isLong ? 'Long' : 'Short'}</span>
                        <strong>${escapeHtml(pair)} Perpetual</strong>
                        <span class="desktop-status-badge closed">${escapeHtml(resolveTradeStatusLabel(trade))}</span>
                    </div>
                    <strong class="${pnlClass}">${escapeHtml(`${formatSigned(metrics.pnl, 2)} USDT`)}</strong>
                </div>
                <div class="desktop-trade-card-grid">
                    <div class="desktop-trade-kv">
                        <span>Yield</span>
                        <strong class="${pnlClass}">${escapeHtml(formatPercent(metrics.yieldPct, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>ROE</span>
                        <strong class="${pnlClass}">${escapeHtml(formatPercent(metrics.roe, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Lots</span>
                        <strong>${escapeHtml(String(Math.round(metrics.lots || 0)))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Value</span>
                        <strong>${escapeHtml(formatUsdt(metrics.amount, 2))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Entry</span>
                        <strong>${escapeHtml(formatPrice(metrics.entryPrice))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Close</span>
                        <strong>${escapeHtml(formatPrice(metrics.closePrice))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Fee</span>
                        <strong>${escapeHtml(formatUsdt(metrics.feeTotal, 4))}</strong>
                    </div>
                    <div class="desktop-trade-kv">
                        <span>Closed At</span>
                        <strong>${escapeHtml(`${formatPlatformDateTime(trade.closed_at)} ${PLATFORM_TIMEZONE_LABEL}`)}</strong>
                    </div>
                </div>
                <div class="desktop-trade-card-actions">
                    <span style="color:var(--text-secondary); font-size:11px;">Opened ${escapeHtml(formatPlatformDateTime(trade.timestamp || trade.open_time))} ${PLATFORM_TIMEZONE_LABEL}</span>
                    <button type="button" class="desktop-link-btn" data-action="detail" data-trade-id="${escapeHtml(trade.id)}">Detail</button>
                </div>
            </div>
        `;
    }).join('');

    if (dom.historyPnl) {
        dom.historyPnl.textContent = `${formatSigned(totalPnl, 2)} USDT`;
        dom.historyPnl.classList.toggle('desktop-pnl-positive', totalPnl >= 0);
        dom.historyPnl.classList.toggle('desktop-pnl-negative', totalPnl < 0);
    }
    dom.historyList.innerHTML = html;
}

async function refreshExternalTradeQuotes() {
    const currentCoin = getCurrentCoinSymbol();
    const currentQuote = getCurrentQuotePrice();
    if (currentCoin && currentQuote > 0) {
        state.externalQuoteCache[currentCoin] = { price: currentQuote, updatedAt: Date.now() };
    }

    const coins = Array.from(new Set(
        state.openTrades
            .filter((trade) => String(trade.status || '').toLowerCase() === 'open')
            .map((trade) => getTradeCoin(trade))
            .filter((coin) => !!coin && coin !== currentCoin)
    ));
    if (!coins.length) return;
    const ids = Array.from(new Set(
        coins.map((coin) => COINGECKO_SYMBOL_TO_ID[String(coin || '').toUpperCase()]).filter(Boolean)
    ));
    if (ids.length) {
        const params = new URLSearchParams({
            ids: ids.join(','),
            vs_currencies: 'usd'
        });
        try {
            const response = await fetch(`${COINGECKO_BASE_URL}/simple/price?${params.toString()}`, {
                headers: { accept: 'application/json' }
            });
            const payload = await response.json();
            coins.forEach((coin) => {
                const id = COINGECKO_SYMBOL_TO_ID[String(coin || '').toUpperCase()];
                const entry = id ? payload[id] : null;
                const price = toNumber(entry && entry.usd, 0);
                if (price > 0) {
                    state.externalQuoteCache[coin] = { price, updatedAt: Date.now() };
                }
            });
        } catch (_) { }
    }

    if (state.activeTab === 'positions') renderDesktopOpenPositions();
    syncDesktopModalTrade();
}

function setTradeButtonsBusy(isBusy, activeDirection = '') {
    if (!dom.openLongBtn || !dom.openShortBtn) return;
    const spinner = '<span style="display:inline-flex; width:14px; height:14px; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation: spin 0.8s linear infinite;"></span>';
    dom.openLongBtn.disabled = isBusy;
    dom.openShortBtn.disabled = isBusy;
    dom.openLongBtn.innerHTML = isBusy && activeDirection === 'Long' ? `${spinner} Processing` : 'Buy Long';
    dom.openShortBtn.innerHTML = isBusy && activeDirection === 'Short' ? `${spinner} Processing` : 'Buy Short';
}

async function submitDesktopPerpOrder(direction) {
    if (state.submitting) return;
    state.submitting = true;
    setTradeButtonsBusy(true, direction);

    try {
        const user = state.user || await checkSession(false);
        if (!user) throw new Error('Please log in again.');
        state.user = user;

        const pair = getCurrentPairText();
        const coin = getCurrentCoinSymbol();
        const orderType = state.orderType;
        const livePrice = getCurrentQuotePrice();
        const entryPrice = orderType === 'Market' ? livePrice : toNumber(dom.priceInput && dom.priceInput.value, 0);
        const lots = Math.max(0, Math.floor(toNumber(dom.lotsInput && dom.lotsInput.value, 0)));
        const maxLots = getDesktopMaxLots();
        const takeProfit = dom.tpInput && dom.tpInput.value ? toNumber(dom.tpInput.value, 0) : null;
        const stopLoss = dom.slInput && dom.slInput.value ? toNumber(dom.slInput.value, 0) : null;
        const notional = lots * getDesktopContractUnit();
        const margin = notional / LEVERAGE;

        if (!(lots > 0)) throw new Error('Please enter a valid lot size.');
        if (lots > maxLots) throw new Error(`Insufficient available balance. Max open size is ${maxLots} Lot.`);
        if (!(entryPrice > 0)) throw new Error(orderType === 'Market' ? 'Waiting for live market price.' : 'Please enter a valid limit price.');
        if (takeProfit !== null && !(takeProfit > 0)) throw new Error('Take Profit must be a positive price.');
        if (stopLoss !== null && !(stopLoss > 0)) throw new Error('Stop Loss must be a positive price.');
        if (takeProfit !== null && stopLoss !== null && takeProfit === stopLoss) throw new Error('Take Profit and Stop Loss cannot be the same.');

        const isLong = direction === 'Long';
        if (isLong) {
            if (takeProfit !== null && takeProfit <= entryPrice) throw new Error('For Long, TP should be higher than entry.');
            if (stopLoss !== null && stopLoss >= entryPrice) throw new Error('For Long, SL should be lower than entry.');
        } else {
            if (takeProfit !== null && takeProfit >= entryPrice) throw new Error('For Short, TP should be lower than entry.');
            if (stopLoss !== null && stopLoss <= entryPrice) throw new Error('For Short, SL should be higher than entry.');
        }

        const tradeData = {
            coin,
            pair,
            direction,
            side: isLong ? 'buy' : 'sell',
            price: entryPrice,
            entry_price: entryPrice,
            lots,
            contract_unit: getDesktopContractUnit(),
            amount: notional,
            notional,
            leverage: LEVERAGE,
            margin: Number(margin.toFixed(2)),
            order_type: orderType,
            take_profit: takeProfit,
            stop_loss: stopLoss,
            fee_open: 0,
            fee_rate: getDesktopTradeFeeRate(),
            type: 'Perpetual',
            status: 'Open',
            admin_outcome: null,
            customClosePrice: null,
            open_time: Date.now(),
            user_uid: user.uid,
            user_email: user.email || user.phoneNumber || 'User',
            timestamp: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'trades'), tradeData);
        if (dom.lotsInput) dom.lotsInput.value = '';
        if (dom.tpInput) dom.tpInput.value = '';
        if (dom.slInput) dom.slInput.value = '';
        setDesktopSliderByLots(0);
        updateDesktopOpenForm();
        setDesktopOrderStatus(`${pair} ${direction} order opened successfully.`, 'success');

        showDesktopOrderOpenedModal({
            pair,
            direction,
            lots,
            contractUnit: getDesktopContractUnit(),
            notional,
            entryPrice,
            takeProfit,
            stopLoss,
            tradeId: docRef.id
        });
    } catch (error) {
        setDesktopOrderStatus(getReadableErrorMessage(error, 'Trade failed. Please try again.'), 'danger');
    } finally {
        state.submitting = false;
        setTradeButtonsBusy(false);
    }
}

async function settleDesktopTrade(tradeId) {
    if (!tradeId || state.closingTradeIds.has(tradeId)) return;
    state.closingTradeIds.add(tradeId);
    renderDesktopOpenPositions();

    try {
        const user = state.user || await checkSession(false);
        if (!user) throw new Error('Please log in again.');
        state.user = user;

        const tradeRef = doc(db, 'trades', tradeId);
        const tradeSnap = await getDoc(tradeRef);
        if (!tradeSnap.exists()) throw new Error('Trade not found.');

        const tradeData = tradeSnap.data();
        if (tradeData.user_uid !== user.uid) throw new Error('Trade does not belong to this user.');
        if (String(tradeData.status || '').toLowerCase() !== 'open') throw new Error('Trade is already closed.');

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        state.userData = userData;

        const coin = getTradeCoin(tradeData);
        const userPerpetualControl = getUserPerpetualCustomControl(userData, coin);
        const entryPrice = toNumber(tradeData.entry_price || tradeData.price, 0);
        const amount = toNumber(tradeData.notional || tradeData.amount, 0);
        const leverage = toNumber(tradeData.leverage, LEVERAGE) || LEVERAGE;
        const margin = toNumber(tradeData.margin, amount / leverage || 0);
        const feeRate = toNumber(tradeData.fee_rate, getDesktopTradeFeeRate());
        const totalFee = amount * feeRate;
        const feeOpen = toNumber(tradeData.fee_open, 0);
        const activeOutcome = String(tradeData.admin_outcome || '').trim().toLowerCase();
        const currentMarketPrice = getDesktopTradeLivePrice({ id: tradeId, ...tradeData }, tradeData.price);
        const tradeCustomYieldPct = parsePerpetualYieldValue(
            tradeData.customYieldPct !== undefined ? tradeData.customYieldPct : tradeData.customRoePct
        );

        let finalClosePrice = currentMarketPrice;
        if (toNumber(tradeData.customClosePrice, 0) > 0) {
            finalClosePrice = toNumber(tradeData.customClosePrice, entryPrice);
        } else if (tradeCustomYieldPct !== null) {
            finalClosePrice = toNumber(computePerpetualClosePriceFromYield(entryPrice, tradeCustomYieldPct, feeRate, isLongTrade(tradeData)), entryPrice);
        } else if (userPerpetualControl && userPerpetualControl.closePrice !== null) {
            finalClosePrice = toNumber(userPerpetualControl.closePrice, entryPrice);
        } else if (userPerpetualControl && userPerpetualControl.yieldRate !== null) {
            finalClosePrice = toNumber(computePerpetualClosePriceFromYield(entryPrice, userPerpetualControl.yieldRate, feeRate, isLongTrade(tradeData)), entryPrice);
        } else if (activeOutcome === 'win') {
            const move = 0.05 + (Math.random() * 0.05);
            finalClosePrice = isLongTrade(tradeData) ? (entryPrice * (1 + move)) : (entryPrice * (1 - move));
        } else if (activeOutcome === 'loss') {
            const move = 0.05 + (Math.random() * 0.05);
            finalClosePrice = isLongTrade(tradeData) ? (entryPrice * (1 - move)) : (entryPrice * (1 + move));
        }

        if (!(finalClosePrice > 0)) {
            finalClosePrice = entryPrice;
        }

        const rawPnl = isLongTrade(tradeData)
            ? ((finalClosePrice - entryPrice) / entryPrice) * amount
            : ((entryPrice - finalClosePrice) / entryPrice) * amount;
        const feeClose = Math.max(0, totalFee - feeOpen);
        const pnl = rawPnl - totalFee;
        const roe = margin > 0 ? (pnl / margin) * 100 : 0;

        await updateDoc(tradeRef, {
            status: 'Closed',
            close_price: finalClosePrice,
            raw_pnl: rawPnl,
            final_pnl: pnl,
            fee_close: feeClose,
            fee_total: totalFee,
            realized_roe: roe,
            closed_at: serverTimestamp()
        });

        await updateDoc(doc(db, 'users', user.uid), {
            balance: increment(pnl)
        });

        closeDesktopModal();
        setDesktopOrderStatus(`${tradeData.pair || `${coin}/USDT`} position closed successfully.`, 'success');
        showDesktopCloseResultModal({
            pair: tradeData.pair || `${coin}/USDT`,
            closePrice: finalClosePrice,
            entryPrice,
            amount,
            feeTotal: totalFee,
            roe,
            pnl
        });
    } catch (error) {
        setDesktopOrderStatus(getReadableErrorMessage(error, 'Failed to close position. Please try again.'), 'danger');
    } finally {
        state.closingTradeIds.delete(tradeId);
        renderDesktopOpenPositions();
    }
}

function bindTradeListEvents(container) {
    if (!container) return;
    container.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const tradeId = button.dataset.tradeId;
        const action = button.dataset.action;
        if (!tradeId || !action) return;
        event.preventDefault();
        if (action === 'detail') showDesktopTradeDetail(tradeId);
        if (action === 'close') showDesktopCloseConfirm(tradeId);
    });
}

function bindDesktopPerpUi() {
    if (state.uiBound) return;
    state.uiBound = true;

    if (dom.tabs) {
        dom.tabs.addEventListener('click', (event) => {
            const tab = event.target.closest('.form-tab');
            if (!tab) return;
            setDesktopTab(tab.dataset.tab || 'open');
        });
    }

    if (dom.orderTypeSwitch) {
        dom.orderTypeSwitch.addEventListener('click', (event) => {
            const button = event.target.closest('.type-btn');
            if (!button) return;
            setDesktopOrderType(button.dataset.orderType || 'Market');
        });
    }

    if (dom.priceInput) {
        dom.priceInput.addEventListener('input', () => {
            if (state.orderType === 'Limit') updateDesktopOpenForm();
        });
    }

    if (dom.lotsInput) {
        dom.lotsInput.addEventListener('input', () => {
            const lots = Math.max(0, Math.floor(toNumber(dom.lotsInput.value, 0)));
            dom.lotsInput.value = lots > 0 ? String(lots) : '';
            updateDesktopOpenForm();
        });
    }

    if (dom.slider) {
        dom.slider.addEventListener('input', () => {
            setLotsBySliderPercent(dom.slider.value);
        });
    }

    document.querySelectorAll('.desktop-quick-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const percent = toNumber(button.dataset.pct, 0);
            if (dom.slider) dom.slider.value = String(percent);
            setLotsBySliderPercent(percent);
        });
    });

    if (dom.tpInput) dom.tpInput.addEventListener('input', () => updateDesktopOpenForm(false));
    if (dom.slInput) dom.slInput.addEventListener('input', () => updateDesktopOpenForm(false));
    if (dom.openLongBtn) dom.openLongBtn.addEventListener('click', () => submitDesktopPerpOrder('Long'));
    if (dom.openShortBtn) dom.openShortBtn.addEventListener('click', () => submitDesktopPerpOrder('Short'));

    bindTradeListEvents(dom.openList);
    bindTradeListEvents(dom.historyList);

    if (dom.modalClose) dom.modalClose.addEventListener('click', closeDesktopModal);
    if (dom.modal) {
        dom.modal.addEventListener('click', (event) => {
            if (event.target === dom.modal) closeDesktopModal();
        });
    }
    if (dom.modalBody) {
        dom.modalBody.addEventListener('click', (event) => {
            const actionButton = event.target.closest('[data-modal-action]');
            if (!actionButton) return;
            const action = actionButton.dataset.modalAction;
            if (action === 'cancel') closeDesktopModal();
            if (action === 'confirm-close') settleDesktopTrade(actionButton.dataset.tradeId || '');
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeDesktopModal();
    });

    applySliderBackground(0);
    setDesktopOrderType('Market');
    setDesktopTab('open');
}

function getSortTimeMs(trade, preferClose = false) {
    const candidates = preferClose
        ? [trade.closed_at, trade.timestamp, trade.open_time, trade.created_at]
        : [trade.timestamp, trade.open_time, trade.created_at, trade.closed_at];
    for (const value of candidates) {
        const date = normalizeDateInput(value);
        if (date) return date.getTime();
    }
    return 0;
}

function startDesktopLiveLoops() {
    if (state.liveUiTimer) clearInterval(state.liveUiTimer);
    if (state.quoteRefreshTimer) clearInterval(state.quoteRefreshTimer);

    state.liveUiTimer = window.setInterval(() => {
        updateDesktopOpenForm();
        if (state.activeTab === 'positions') renderDesktopOpenPositions();
        syncDesktopModalTrade();
    }, 1200);

    state.quoteRefreshTimer = window.setInterval(() => {
        refreshExternalTradeQuotes().catch(() => { });
    }, 8000);

    refreshExternalTradeQuotes().catch(() => { });
}

function stopDesktopLiveLoops() {
    if (state.liveUiTimer) {
        clearInterval(state.liveUiTimer);
        state.liveUiTimer = null;
    }
    if (state.quoteRefreshTimer) {
        clearInterval(state.quoteRefreshTimer);
        state.quoteRefreshTimer = null;
    }
}

function initDesktopUserListener(user) {
    if (!user) return;
    if (state.userUnsubscribe) state.userUnsubscribe();
    state.userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        const userData = snapshot.exists() ? snapshot.data() : {};
        state.userData = userData;
        state.balance = toNumber(userData.balance, 0);
        updateDesktopOpenForm();
        renderDesktopOpenPositions();
        renderDesktopTradeHistory();
    }, (error) => {
        setDesktopOrderStatus(getReadableErrorMessage(error, 'Failed to sync user balance.'), 'danger');
    });
}

function initDesktopTradesListener(user) {
    if (!user) return;
    if (state.tradesUnsubscribe) state.tradesUnsubscribe();

    const tradesQuery = query(collection(db, 'trades'), where('user_uid', '==', user.uid));
    state.tradesUnsubscribe = onSnapshot(tradesQuery, (snapshot) => {
        const openTrades = [];
        const historyTrades = [];
        snapshot.forEach((docSnap) => {
            const trade = { id: docSnap.id, ...docSnap.data() };
            if (String(trade.type || '').toLowerCase() !== 'perpetual') return;
            const status = String(trade.status || '').toLowerCase();
            if (status === 'open' || status === 'pending') {
                openTrades.push(trade);
            } else {
                historyTrades.push(trade);
            }
        });

        openTrades.sort((a, b) => getSortTimeMs(b, false) - getSortTimeMs(a, false));
        historyTrades.sort((a, b) => getSortTimeMs(b, true) - getSortTimeMs(a, true));

        state.openTrades = openTrades;
        state.historyTrades = historyTrades;
        window.activeOpenTrades = openTrades.slice();
        window.tradeHistoryAll = historyTrades.slice();

        updateDesktopOpenForm();
        renderDesktopOpenPositions();
        renderDesktopTradeHistory();
        refreshExternalTradeQuotes().catch(() => { });
        syncDesktopModalTrade();
    }, (error) => {
        setDesktopOrderStatus(getReadableErrorMessage(error, 'Failed to sync trade history.'), 'danger');
    });
}

function cleanupDesktopPerp() {
    stopDesktopLiveLoops();
    if (state.authUnsubscribe) {
        state.authUnsubscribe();
        state.authUnsubscribe = null;
    }
    if (state.userUnsubscribe) {
        state.userUnsubscribe();
        state.userUnsubscribe = null;
    }
    if (state.tradesUnsubscribe) {
        state.tradesUnsubscribe();
        state.tradesUnsubscribe = null;
    }
    state.user = null;
}

function initDesktopPerp(user) {
    state.user = user;
    initDesktopUserListener(user);
    initDesktopTradesListener(user);
    startDesktopLiveLoops();
    updateDesktopOpenForm();
}

async function bootstrapDesktopPerp() {
    cacheDom();
    bindDesktopPerpUi();

    const access = await enforceKycAccess({
        requireAuth: true,
        unauthRedirect: 'login.html',
        kycRedirect: 'mobile.html'
    });
    if (!access.ok || !access.user) return;

    initDesktopPerp(access.user);
    setDesktopOrderStatus('Desktop perpetual trading connected.', 'success');

    if (state.authUnsubscribe) state.authUnsubscribe();
    state.authUnsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
            cleanupDesktopPerp();
            window.location.href = 'login.html';
            return;
        }
        if (!state.user || state.user.uid !== user.uid) {
            initDesktopPerp(user);
        }
    });
}

window.desktopShowTradeDetail = showDesktopTradeDetail;
window.desktopCloseTrade = showDesktopCloseConfirm;

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrapDesktopPerp);
} else {
    bootstrapDesktopPerp();
}

window.addEventListener('beforeunload', cleanupDesktopPerp);

(function () {
    const widgetEls = Array.from(document.querySelectorAll('[data-quick-widget]'));
    if (widgetEls.length === 0) return;

    const siteData = window.ECInfowaySiteData || null;
    const marketData = window.ECInfowayMarketData || null;
    const siteApiConfig = window.ECSiteApiConfig || null;
    if (!siteData || !marketData) return;
    const API_ORIGIN = siteApiConfig && typeof siteApiConfig.getApiOrigin === 'function'
        ? siteApiConfig.getApiOrigin(window)
        : 'https://api.easycoinst0re.com';
    const INFOWAY_TRADE_URL = `${API_ORIGIN}/api/infoway/batch-trade`;

    const FIAT_OPTIONS = [
        { code: 'USD', name: 'US dollar', icon: 'https://flagcdn.com/w80/us.png' }
    ];

    const CRYPTO_OPTIONS = siteData.QUICK_CONVERTER_CRYPTO_OPTIONS.map(function (item) {
        return {
            code: item.code,
            name: item.name,
            icon: makeCryptoSvgFallback(item.code)
        };
    });

    const FIAT_SET = new Set(FIAT_OPTIONS.map((item) => item.code));
    const CRYPTO_SET = new Set(CRYPTO_OPTIONS.map((item) => item.code));
    const quoteState = {
        fiatUsd: {
            USD: 1
        },
        cryptoUsd: Object.fromEntries(CRYPTO_OPTIONS.map((item) => [item.code, 0])),
        loaded: false
    };

    let refreshTimer = null;
    let activeMenu = null;
    const tradeCodes = CRYPTO_OPTIONS.map(function (item) {
        return siteData.toMarketCode(item.code);
    }).join(',');

    const dropdownEl = document.createElement('div');
    dropdownEl.className = 'quick-currency-dropdown';
    dropdownEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dropdownEl);

    function makeCryptoSvgFallback(code) {
        const token = String(code || 'COIN').trim().toUpperCase().slice(0, 4) || 'COIN';
        const colors = ['#2563eb', '#0f766e', '#059669', '#dc2626', '#7c3aed', '#ea580c'];
        let hash = 0;
        for (let i = 0; i < token.length; i += 1) {
            hash = ((hash << 5) - hash) + token.charCodeAt(i);
        }
        const bg = colors[Math.abs(hash) % colors.length];
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="32" fill="${bg}" />
                <text x="32" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="${token.length > 3 ? 16 : 20}" font-weight="700" fill="#ffffff">${token}</text>
            </svg>
        `.trim();
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getCryptoIconCandidates(code) {
        const normalized = String(code || '').trim().toUpperCase();
        return [makeCryptoSvgFallback(normalized)];
    }

    function getPrimaryCryptoIcon(code) {
        return getCryptoIconCandidates(code)[0];
    }

    function installCryptoIconFallback(img, code) {
        if (!img || !code || !isCrypto(code)) return;

        const candidates = getCryptoIconCandidates(code);
        let currentIndex = 0;

        const applyNext = () => {
            if (currentIndex >= candidates.length) return;
            img.src = candidates[currentIndex];
            currentIndex += 1;
        };

        img.onerror = applyNext;
        applyNext();
    }

    function isFiat(code) {
        return FIAT_SET.has(String(code || '').toUpperCase());
    }

    function isCrypto(code) {
        return CRYPTO_SET.has(String(code || '').toUpperCase());
    }

    function getCurrencyInfo(code) {
        const normalized = String(code || '').toUpperCase();
        return FIAT_OPTIONS.find((item) => item.code === normalized)
            || CRYPTO_OPTIONS.find((item) => item.code === normalized)
            || { code: normalized, name: normalized, icon: '' };
    }

    function getAllowedOptions(mode, side) {
        if (mode === 'buy') {
            return side === 'from' ? FIAT_OPTIONS : CRYPTO_OPTIONS;
        }
        return side === 'from' ? CRYPTO_OPTIONS : FIAT_OPTIONS;
    }

    function getUsdRate(code) {
        const normalized = String(code || '').toUpperCase();
        if (isFiat(normalized)) return Number(quoteState.fiatUsd[normalized] || 0);
        if (isCrypto(normalized)) return Number(quoteState.cryptoUsd[normalized] || 0);
        return 0;
    }

    function parseNumeric(value) {
        const raw = String(value || '').replace(/,/g, '').trim();
        if (!raw) return NaN;
        const numeric = Number(raw);
        return Number.isFinite(numeric) ? numeric : NaN;
    }

    function formatInputAmount(value, code) {
        if (!Number.isFinite(value)) return '';
        const normalized = String(code || '').toUpperCase();
        const maximumFractionDigits = isCrypto(normalized)
            ? (Math.abs(value) >= 1 ? 6 : 8)
            : 2;
        return value.toLocaleString('en-US', {
            useGrouping: false,
            minimumFractionDigits: 0,
            maximumFractionDigits
        });
    }

    function formatMoneyAmount(value, code) {
        if (!Number.isFinite(value)) return '--';
        const normalized = String(code || '').toUpperCase();
        const maximumFractionDigits = isCrypto(normalized)
            ? (Math.abs(value) >= 1 ? 6 : 8)
            : 2;
        return `${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits
        })} ${normalized}`;
    }

    function convertAmount(amount, fromCode, toCode) {
        const fromRate = getUsdRate(fromCode);
        const toRate = getUsdRate(toCode);
        if (!(fromRate > 0) || !(toRate > 0) || !Number.isFinite(amount)) return NaN;
        return (amount * fromRate) / toRate;
    }

    function setCurrencyElement(el, code) {
        if (!el) return;
        const info = getCurrencyInfo(code);
        const icon = info.icon ? `<img src="${info.icon}" alt="${info.code}">` : '';
        el.innerHTML = `${icon} ${info.code}`;
        if (isCrypto(info.code)) {
            installCryptoIconFallback(el.querySelector('img'), info.code);
        }
    }

    function setWidgetMeta(widget, text) {
        if (widget.metaEl) widget.metaEl.textContent = text;
    }

    function closeCurrencyMenu() {
        if (activeMenu && activeMenu.triggerEl) {
            activeMenu.triggerEl.classList.remove('is-open');
            activeMenu.triggerEl.setAttribute('aria-expanded', 'false');
        }
        activeMenu = null;
        dropdownEl.classList.remove('active');
        dropdownEl.setAttribute('aria-hidden', 'true');
        dropdownEl.innerHTML = '';
    }

    function positionCurrencyMenu(triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        const menuWidth = Math.max(dropdownEl.offsetWidth, 220);
        const menuHeight = dropdownEl.offsetHeight || 0;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = rect.left;
        if (left + menuWidth > viewportWidth - 12) {
            left = viewportWidth - menuWidth - 12;
        }
        left = Math.max(12, left);

        let top = rect.bottom + 8;
        if (top + menuHeight > viewportHeight - 12) {
            top = Math.max(12, rect.top - menuHeight - 8);
        }

        dropdownEl.style.left = `${left}px`;
        dropdownEl.style.top = `${top}px`;
    }

    function updateLabels(widget) {
        const fromInfo = getCurrencyInfo(widget.state.fromCode);
        const toInfo = getCurrencyInfo(widget.state.toCode);

        if (widget.fromLabelEl) {
            widget.fromLabelEl.textContent = `From ${fromInfo.name} (${fromInfo.code})...`;
        }
        if (widget.toLabelEl) {
            widget.toLabelEl.textContent = `To ${toInfo.name}...`;
        }

        setCurrencyElement(widget.fromCurrencyEl, widget.state.fromCode);
        setCurrencyElement(widget.toCurrencyEl, widget.state.toCode);

        if (widget.submitEl) {
            widget.submitEl.textContent = widget.state.mode === 'buy' ? 'Buy now' : 'Sell now';
        }
        if (widget.toggleModeEl) {
            widget.toggleModeEl.textContent = widget.state.mode === 'buy' ? '... or sell' : '... or buy';
        }
    }

    function updateMetaWithRate(widget) {
        const fromRate = getUsdRate(widget.state.fromCode);
        const toRate = getUsdRate(widget.state.toCode);
        if (!(fromRate > 0) || !(toRate > 0)) {
            setWidgetMeta(widget, 'Live quote is temporarily unavailable. Please try again.');
            return;
        }

        const unitAmount = widget.state.mode === 'buy'
            ? convertAmount(1, widget.state.toCode, widget.state.fromCode)
            : convertAmount(1, widget.state.fromCode, widget.state.toCode);
        const unitLabel = widget.state.mode === 'buy'
                ? `1 ${widget.state.toCode} ~ ${formatMoneyAmount(unitAmount, widget.state.fromCode)}`
                : `1 ${widget.state.fromCode} ~ ${formatMoneyAmount(unitAmount, widget.state.toCode)}`;
        const actionHint = widget.state.mode === 'buy'
            ? 'Infoway-supported coins only.'
            : 'You are now selling crypto into USD.';
        setWidgetMeta(widget, `${unitLabel}. ${actionHint}`);
    }

    function recalculate(widget, sourceSide, shouldFormatSource) {
        const sourceEl = sourceSide === 'from' ? widget.fromInputEl : widget.toInputEl;
        const targetEl = sourceSide === 'from' ? widget.toInputEl : widget.fromInputEl;
        const sourceCode = sourceSide === 'from' ? widget.state.fromCode : widget.state.toCode;
        const targetCode = sourceSide === 'from' ? widget.state.toCode : widget.state.fromCode;
        const rawValue = parseNumeric(sourceEl.value);

        if (!Number.isFinite(rawValue) || rawValue < 0) {
            targetEl.value = '';
            updateMetaWithRate(widget);
            return;
        }

        const converted = convertAmount(rawValue, sourceCode, targetCode);
        if (!Number.isFinite(converted)) {
            targetEl.value = '';
            setWidgetMeta(widget, 'Live quote is temporarily unavailable. Please try again.');
            return;
        }

        if (shouldFormatSource) {
            sourceEl.value = formatInputAmount(rawValue, sourceCode);
        }
        targetEl.value = formatInputAmount(converted, targetCode);
        updateMetaWithRate(widget);
    }

    function selectCurrency(widget, side, code) {
        const key = side === 'from' ? 'fromCode' : 'toCode';
        widget.state[key] = code;
        updateLabels(widget);
        recalculate(widget, widget.state.lastEdited, false);
    }

    function openCurrencyMenu(widget, side, triggerEl) {
        const options = getAllowedOptions(widget.state.mode, side);
        const selectedCode = side === 'from' ? widget.state.fromCode : widget.state.toCode;

        dropdownEl.innerHTML = options.map((option) => `
            <button type="button" class="quick-currency-option${option.code === selectedCode ? ' active' : ''}" data-code="${option.code}">
                <img src="${option.icon}" alt="${option.code}">
                <span class="quick-currency-option-code">${option.code}</span>
                <span class="quick-currency-option-name">${option.name}</span>
            </button>
        `).join('');

        dropdownEl.querySelectorAll('[data-code]').forEach((optionEl) => {
            const code = String(optionEl.getAttribute('data-code') || '').toUpperCase();
            if (isCrypto(code)) {
                installCryptoIconFallback(optionEl.querySelector('img'), code);
            }
        });

        dropdownEl.querySelectorAll('[data-code]').forEach((optionEl) => {
            optionEl.addEventListener('click', () => {
                selectCurrency(widget, side, optionEl.getAttribute('data-code'));
                closeCurrencyMenu();
            });
        });

        if (activeMenu && activeMenu.triggerEl && activeMenu.triggerEl !== triggerEl) {
            activeMenu.triggerEl.classList.remove('is-open');
            activeMenu.triggerEl.setAttribute('aria-expanded', 'false');
        }

        activeMenu = { widget, side, triggerEl };
        triggerEl.classList.add('is-open');
        triggerEl.setAttribute('aria-expanded', 'true');
        dropdownEl.classList.add('active');
        dropdownEl.setAttribute('aria-hidden', 'false');
        positionCurrencyMenu(triggerEl);
    }

    function toggleCurrencyMenu(widget, side, triggerEl) {
        if (activeMenu && activeMenu.triggerEl === triggerEl) {
            closeCurrencyMenu();
            return;
        }
        openCurrencyMenu(widget, side, triggerEl);
    }

    function toggleWidgetMode(widget) {
        closeCurrencyMenu();
        const previousFromValue = parseNumeric(widget.fromInputEl.value);
        const previousToValue = parseNumeric(widget.toInputEl.value);
        const nextMode = widget.state.mode === 'buy' ? 'sell' : 'buy';
        const nextFromCode = widget.state.toCode;
        const nextToCode = widget.state.fromCode;

        widget.state.mode = nextMode;
        widget.state.fromCode = nextFromCode;
        widget.state.toCode = nextToCode;
        widget.state.lastEdited = 'from';
        updateLabels(widget);

        widget.fromInputEl.value = Number.isFinite(previousToValue)
            ? formatInputAmount(previousToValue, widget.state.fromCode)
            : '';
        widget.toInputEl.value = Number.isFinite(previousFromValue)
            ? formatInputAmount(previousFromValue, widget.state.toCode)
            : '';

        recalculate(widget, 'from', false);
    }

    function persistDraft(widget) {
        const fromAmount = parseNumeric(widget.fromInputEl.value);
        const toAmount = parseNumeric(widget.toInputEl.value);
        if (!(fromAmount > 0) || !(toAmount > 0)) return null;

        const draft = {
            mode: widget.state.mode,
            fromCode: widget.state.fromCode,
            toCode: widget.state.toCode,
            fromAmount,
            toAmount,
            createdAt: new Date().toISOString()
        };

        try {
            localStorage.setItem('ec_quick_trade_draft', JSON.stringify(draft));
        } catch (err) {
            console.warn('Failed to store quick trade draft:', err);
        }
        return draft;
    }

    function handleSubmit(widget) {
        const draft = persistDraft(widget);
        if (!draft) {
            setWidgetMeta(widget, 'Enter a valid amount before continuing.');
            widget.fromInputEl.focus();
            return;
        }

        const url = new URL('buy-sell.html', window.location.href);
        url.searchParams.set('mode', draft.mode);
        url.searchParams.set('from', draft.fromCode);
        url.searchParams.set('to', draft.toCode);
        url.searchParams.set('fromAmount', formatInputAmount(draft.fromAmount, draft.fromCode));
        url.searchParams.set('toAmount', formatInputAmount(draft.toAmount, draft.toCode));
        window.location.href = url.toString();
    }

    function bindCurrencyTrigger(widget, triggerEl, side) {
        if (!triggerEl) return;
        triggerEl.setAttribute('aria-haspopup', 'listbox');
        triggerEl.setAttribute('aria-expanded', 'false');
        triggerEl.tabIndex = 0;
        triggerEl.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleCurrencyMenu(widget, side, triggerEl);
        });
        triggerEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleCurrencyMenu(widget, side, triggerEl);
            }
        });
    }

    function createWidget(widgetEl) {
        const widget = {
            el: widgetEl,
            state: {
                mode: 'buy',
                fromCode: 'USD',
                toCode: 'BTC',
                lastEdited: 'from'
            },
            fromLabelEl: widgetEl.querySelector('[data-role="from-label"]'),
            toLabelEl: widgetEl.querySelector('[data-role="to-label"]'),
            fromInputEl: widgetEl.querySelector('[data-role="from-input"]'),
            toInputEl: widgetEl.querySelector('[data-role="to-input"]'),
            fromCurrencyEl: widgetEl.querySelector('[data-role="from-currency"]'),
            toCurrencyEl: widgetEl.querySelector('[data-role="to-currency"]'),
            swapEl: widgetEl.querySelector('[data-role="swap"]'),
            submitEl: widgetEl.querySelector('[data-role="submit"]'),
            metaEl: widgetEl.querySelector('[data-role="meta"]'),
            toggleModeEl: widgetEl.querySelector('[data-role="toggle-mode"]')
        };

        updateLabels(widget);
        updateMetaWithRate(widget);

        if (widget.fromInputEl) {
            widget.fromInputEl.addEventListener('input', () => {
                widget.state.lastEdited = 'from';
                recalculate(widget, 'from', false);
            });
            widget.fromInputEl.addEventListener('blur', () => {
                recalculate(widget, 'from', true);
            });
        }

        if (widget.toInputEl) {
            widget.toInputEl.addEventListener('input', () => {
                widget.state.lastEdited = 'to';
                recalculate(widget, 'to', false);
            });
            widget.toInputEl.addEventListener('blur', () => {
                recalculate(widget, 'to', true);
            });
        }

        bindCurrencyTrigger(widget, widget.fromCurrencyEl, 'from');
        bindCurrencyTrigger(widget, widget.toCurrencyEl, 'to');

        if (widget.swapEl) {
            widget.swapEl.addEventListener('click', () => toggleWidgetMode(widget));
        }

        if (widget.toggleModeEl) {
            widget.toggleModeEl.addEventListener('click', (event) => {
                event.preventDefault();
                toggleWidgetMode(widget);
            });
        }

        if (widget.submitEl) {
            widget.submitEl.addEventListener('click', () => handleSubmit(widget));
        }

        return widget;
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

    async function fetchInfowayRates() {
        const response = await fetchWithTimeout(`${INFOWAY_TRADE_URL}?codes=${encodeURIComponent(tradeCodes)}`, {
            headers: { accept: 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Infoway trade HTTP ${response.status}`);
        }
        const payload = await response.json();
        const rows = marketData.parseTradeResponse(payload);
        rows.forEach(function (row) {
            if (CRYPTO_SET.has(row.base) && Number.isFinite(Number(row.price)) && row.price > 0) {
                quoteState.cryptoUsd[row.base] = Number(row.price);
            }
        });
    }

    const widgets = widgetEls.map(createWidget);

    async function refreshRates() {
        if (document.visibilityState === 'hidden') return;
        try {
            await fetchInfowayRates();
        } catch (err) {
            console.warn('Quick converter Infoway fetch failed:', err.message || err);
        }

        quoteState.loaded = true;
        widgets.forEach((widget) => {
            updateLabels(widget);
            recalculate(widget, widget.state.lastEdited, false);
        });
        if (activeMenu && activeMenu.triggerEl) {
            positionCurrencyMenu(activeMenu.triggerEl);
        }
    }

    function startRateRefresh() {
        if (refreshTimer) return;
        refreshRates();
        refreshTimer = window.setInterval(refreshRates, 20000);
    }

    if (document.readyState === 'complete') {
        window.setTimeout(startRateRefresh, 500);
    } else {
        window.addEventListener('load', () => window.setTimeout(startRateRefresh, 500), { once: true });
    }

    document.addEventListener('click', (event) => {
        if (!activeMenu) return;
        if (dropdownEl.contains(event.target)) return;
        if (activeMenu.triggerEl && activeMenu.triggerEl.contains(event.target)) return;
        closeCurrencyMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCurrencyMenu();
        }
    });

    window.addEventListener('resize', closeCurrencyMenu);
    window.addEventListener('scroll', closeCurrencyMenu, true);
    window.addEventListener('beforeunload', () => {
        if (refreshTimer) window.clearInterval(refreshTimer);
        closeCurrencyMenu();
    });
})();

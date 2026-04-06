(function () {
  "use strict";

  var STORAGE_KEY = "ec_site_lang";
  var LEGACY_KEY = "ec_language";
  var CACHE_PREFIX = "ec_i18n_cache_v5_";

  var SUPPORTED = ["en", "zh", "de", "ja", "ko"];
  var LANG_LABEL = {
    en: "EN",
    zh: "\u4e2d\u6587",
    de: "DE",
    ja: "JA",
    ko: "KO"
  };
  var LEGACY_LABEL = {
    en: "English",
    zh: "\u4e2d\u6587",
    de: "Deutsch",
    ja: "\u65e5\u672c\u8a9e",
    ko: "\ud55c\uad6d\uc5b4"
  };
  var TARGET_LOCALE = {
    zh: "zh-CN",
    de: "de",
    ja: "ja",
    ko: "ko"
  };
  var UX_ROUTE_RULES = [
    { re: /\b(instant buy|buy|sell)\b|快捷买币|买入|卖出|sofortkauf|kaufen|verkaufen|購入|売却|즉시 구매|매수|매도/i, to: "buy-sell.html" },
    { re: /\b(market|markets|rates|tracker)\b|行情|市场|markt|märkte|maerkte|相場|市場|마켓|시장/i, to: "markets.html" },
    { re: /\b(contract|perpetual|delivery|trade)\b|合约|永续|交割|交易|vertrag|kontrakt|handel|契約|無期限|取引|계약|무기한|거래/i, to: "trade.html" },
    { re: /\b(wallet|funds|assets?)\b|钱包|资产|资金|vermögen|vermoegen|wallet|ウォレット|資産|지갑|자산/i, to: "fund.html" },
    { re: /\b(order|orders|history)\b|订单|历史|auftrag|aufträge|auftraege|verlauf|注文|履歴|주문|기록/i, to: "dashboard.html" },
    { re: /\b(dashboard)\b|总览|仪表盘|übersicht|uebersicht|ダッシュボード|대시보드/i, to: "dashboard.html" },
    { re: /\b(login|sign in)\b|登录|anmelden|ログイン|로그인/i, to: "login.html" },
    { re: /\b(register|sign up|create account)\b|注册|创建账户|registrieren|konto erstellen|登録|アカウント作成|회원가입|계정 생성/i, to: "signup.html" },
    { re: /\b(download app|mobile|app)\b|下载|移动端|手机端|app下载|app herunterladen|mobil|アプリ|モバイル|앱|모바일/i, to: "mobile.html" },
    { re: /\b(help|support)\b|帮助|客服|hilfe|support|ヘルプ|サポート|도움말|고객센터/i, to: "mobile.html" },
    { re: /\b(about|blog|learn|careers|otc|institutional|smsf)\b|关于|资讯|学习|karriere|über uns|ueber uns|会社情報|学ぶ|소개|학습/i, to: "index.html" },
    { re: /\b(terms|privacy)\b|条款|隐私|bedingungen|datenschutz|利用規約|プライバシー|약관|개인정보/i, to: "mobile.html" }
  ];

  var STATIC_MAP = {
    zh: {
      "Home": "\u9996\u9875",
      "Market": "\u884c\u60c5",
      "Markets": "\u884c\u60c5",
      "Contract": "\u5408\u7ea6",
      "Trade": "\u4ea4\u6613",
      "Exchange": "\u5151\u6362",
      "Funds": "\u8d44\u4ea7",
      "Login": "\u767b\u5f55",
      "Logout": "\u9000\u51fa\u767b\u5f55",
      "Language": "\u8bed\u8a00",
      "Search markets": "\u641c\u7d22\u5e02\u573a",
      "Search coin name": "\u641c\u7d22\u5e01\u79cd",
      "Market Overview": "\u5e02\u573a\u6982\u89c8"
    },
    de: {
      "Home": "Startseite",
      "Market": "Markt",
      "Markets": "Maerkte",
      "Contract": "Kontrakt",
      "Trade": "Handel",
      "Exchange": "Tausch",
      "Funds": "Vermoegen",
      "Login": "Anmelden",
      "Logout": "Abmelden",
      "Language": "Sprache",
      "Search markets": "Maerkte suchen",
      "Search coin name": "Coin suchen",
      "Market Overview": "Marktuebersicht"
    },
    ja: {
      "Home": "\u30db\u30fc\u30e0",
      "Market": "\u30de\u30fc\u30b1\u30c3\u30c8",
      "Markets": "\u30de\u30fc\u30b1\u30c3\u30c8",
      "Contract": "\u5951\u7d04",
      "Trade": "\u53d6\u5f15",
      "Exchange": "\u4ea4\u63db",
      "Funds": "\u8cc7\u7523",
      "Login": "\u30ed\u30b0\u30a4\u30f3",
      "Logout": "\u30ed\u30b0\u30a2\u30a6\u30c8",
      "Language": "\u8a00\u8a9e",
      "Search markets": "\u30de\u30fc\u30b1\u30c3\u30c8\u3092\u691c\u7d22",
      "Search coin name": "\u30b3\u30a4\u30f3\u540d\u3092\u691c\u7d22",
      "Market Overview": "\u30de\u30fc\u30b1\u30c3\u30c8\u6982\u8981",
      "Buy": "\u8cfc\u5165",
      "Sell": "\u58f2\u5374",
      "Amount": "\u91d1\u984d",
      "Price": "\u4fa1\u683c",
      "Quantity": "\u6570\u91cf",
      "Available": "\u5229\u7528\u53ef\u80fd",
      "Order": "\u6ce8\u6587",
      "Orders": "\u6ce8\u6587\u5c65\u6b74",
      "Submit": "\u9001\u4fe1",
      "Sign In": "\u30ed\u30b0\u30a4\u30f3",
      "Register": "\u767b\u9332",
      "Create Account": "\u30a2\u30ab\u30a6\u30f3\u30c8\u4f5c\u6210",
      "Email": "\u30e1\u30fc\u30eb",
      "Password": "\u30d1\u30b9\u30ef\u30fc\u30c9",
      "Admin Login": "\u7ba1\u7406\u8005\u30ed\u30b0\u30a4\u30f3",
      "Verification Code": "\u8a8d\u8a3c\u30b3\u30fc\u30c9"
    },
    ko: {
      "Home": "\ud648",
      "Market": "\ub9c8\ucf13",
      "Markets": "\ub9c8\ucf13",
      "Contract": "\uacc4\uc57d",
      "Trade": "\uac70\ub798",
      "Exchange": "\uad50\ud658",
      "Funds": "\uc790\uc0b0",
      "Login": "\ub85c\uadf8\uc778",
      "Logout": "\ub85c\uadf8\uc544\uc6c3",
      "Language": "\uc5b8\uc5b4",
      "Search markets": "\ub9c8\ucf13 \uac80\uc0c9",
      "Search coin name": "\ucf54\uc778 \uc774\ub984 \uac80\uc0c9",
      "Market Overview": "\ub9c8\ucf13 \uac1c\uc694",
      "Buy": "\ub9e4\uc218",
      "Sell": "\ub9e4\ub3c4",
      "Amount": "\uae08\uc561",
      "Price": "\uac00\uaca9",
      "Quantity": "\uc218\ub7c9",
      "Available": "\uc0ac\uc6a9 \uac00\ub2a5",
      "Order": "\uc8fc\ubb38",
      "Orders": "\uc8fc\ubb38 \ub0b4\uc5ed",
      "Submit": "\uc81c\ucd9c",
      "Sign In": "\ub85c\uadf8\uc778",
      "Register": "\ud68c\uc6d0\uac00\uc785",
      "Create Account": "\uacc4\uc815 \uc0dd\uc131",
      "Email": "\uc774\uba54\uc77c",
      "Password": "\ube44\ubc00\ubc88\ud638",
      "Admin Login": "\uad00\ub9ac\uc790 \ub85c\uadf8\uc778",
      "Verification Code": "\uc778\uc99d \ucf54\ub4dc"
    }
  };

  var CLEAN_REPLACEMENTS = [
    ["\u99af\u6503\u7373", "\ud83d\udd0d"],
    ["\u99af\u5698\u99af\u56ad", "AU"],
    ["棣冩啑閿?", "\ud83d\udc41"],
    ["棣冩⒒閿?", "History"],
    ["閳绗?", "\u2198"],
    ["閳瑱绗?", "\u2197"],
    ["閳棑绗?", "\u21c4"],
    ["鑴?", "\u00d7"],
    ["鐚?", "\u203a"],
    ["棣冨笭閿?", "\u270e"],
    ["閳存唻绗?", "\u23f1"],
    ["棣冩煠閿?", "\ud83d\udcce"],
    ["棣冩懖", "\uff0b"],
    ["棣冩啟", "\ud83d\udc4b"],
    ["棣冨瘧", "\u2022"],
    ["棣冩惈", "\u2022"],
    ["棣冩惂", "\u2022"],
    ["棣冾潤", "A"],
    ["棣冩嚂", "B"],
    ["棣冩噮", "C"],
    ["棣冪叒", "C"],
    ["棣冨綌", "\u2302"],
    ["棣冩尠", "\u2709"],
    ["棣冨付", "\ud83d\udcac"],
    ["棣冩噥", "U"],
    ["棣冪崸", "\u203a"],
    ["棣冩敡", "\u21c4"],
    ["棣冩嫷", "\u2605"],
    ["閳挎瑱绗?", "Unauthenticated"],
    ["閳跨媴绗?", ""],
    ["棣冩櫟", ""],
    ["C涔坱e d'Ivoire", "Cote d'Ivoire"],
    ["$$", "$"],
    ["\u922e\u00ae?", "$"],
    ["\u95b3?", "$"],
    ["\u95b4?", "\u2713"],
    ["\u922f?", "\u2606"],
    ["\u922b?", "\u25bc"],
    ["\u9241?", "\u2713"],
    ["\u9231?", "\u203a"],
    ["\u922f\u5472\u69c4\u922f\u5472\u69c4\u922f", "\u2605\u2605\u2605\u2605\u2605"],
    ["/span>", ""],
    ["/td>", ""],
    ["/div>", ""]
  ];

  var memoryCache = Object.create(null);
  var pendingTexts = Object.create(null);
  var failedAttempts = Object.create(null);

  for (var si = 0; si < SUPPORTED.length; si += 1) {
    var langKey = SUPPORTED[si];
    if (langKey === "en") continue;
    memoryCache[langKey] = Object.create(null);
    pendingTexts[langKey] = new Set();
    failedAttempts[langKey] = Object.create(null);
  }

  var currentLang = "en";
  var flushTimer = null;
  var isFlushing = false;
  var uxReady = false;

  function isFrontendHost(host) {
    return host === "easycryptoguide.com"
      || host === "www.easycryptoguide.com"
      || host === "m.easycryptoguide.com"
      || host === "easycryptoguide.pages.dev";
  }

  var MOBILE_BUILD_ID = "20260406c";

  function buildMobileEntryUrl(query, hash) {
    var params = new URLSearchParams(query || "");
    params.set("v", MOBILE_BUILD_ID);
    var queryString = params.toString();
    return "/mobile.html" + (queryString ? "?" + queryString : "") + (hash || "");
  }

  function enforceDeviceEntryRouting() {
    try {
      var host = String(window.location.hostname || "").toLowerCase();
      if (!host) return false;
      if (host === "localhost" || host === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
      if (!isFrontendHost(host)) return false;

      var path = String(window.location.pathname || "").toLowerCase();
      if (path.indexOf("admin") >= 0 || path.indexOf("support_admin") >= 0) return false;

      var query = window.location.search || "";
      if (/[?&]desktop=1(?:&|$)/i.test(query)) return false;

      var hash = window.location.hash || "";
      var isMobilePage = path.indexOf("mobile.html") >= 0 || path === "/mobile";
      if (host.indexOf("m.") === 0) {
        if (!isMobilePage) {
          window.location.replace(buildMobileEntryUrl(query, hash));
          return true;
        }
        return false;
      }

      var ua = navigator.userAgent || "";
      var isMobileUA = /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Mobile/i.test(ua);
      var isSmallTouch = window.matchMedia && window.matchMedia("(max-width: 900px)").matches && ((navigator.maxTouchPoints || 0) > 1);
      if (!isMobilePage && (isMobileUA || isSmallTouch)) {
        window.location.replace(buildMobileEntryUrl(query, hash));
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  if (enforceDeviceEntryRouting()) return;

  function normalizeLang(v) {
    if (!v) return "";
    if (SUPPORTED.indexOf(v) >= 0) return v;
    if (v === "English") return "en";
    if (v === "Deutsch") return "de";
    if (v === "\u65e5\u672c\u8a9e") return "ja";
    if (v === "\ud55c\uad6d\uc5b4") return "ko";
    if (v === "\u4e2d\u6587" || v === "\u6d93\ueecb\ue784") return "zh";
    return "";
  }

  function getStoredLang() {
    var directRaw = localStorage.getItem(STORAGE_KEY);
    var direct = normalizeLang(directRaw);
    if (direct) return direct;

    var legacy = normalizeLang(localStorage.getItem(LEGACY_KEY));
    if (legacy) return legacy;

    return "en";
  }

  function hashText(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(36);
  }

  function cacheKey(lang, text) {
    return CACHE_PREFIX + lang + "_" + hashText(text);
  }

  function cacheGet(lang, text) {
    if (lang === "en") return text;
    if (
      memoryCache[lang] &&
      Object.prototype.hasOwnProperty.call(memoryCache[lang], text)
    ) {
      return memoryCache[lang][text];
    }
    var key = cacheKey(lang, text);
    var value = localStorage.getItem(key);
    if (value !== null) {
      memoryCache[lang][text] = value;
      return value;
    }
    return null;
  }

  function cacheSet(lang, text, translated) {
    if (lang === "en") return;
    if (!memoryCache[lang]) memoryCache[lang] = Object.create(null);
    memoryCache[lang][text] = translated;
    try {
      localStorage.setItem(cacheKey(lang, text), translated);
    } catch (e) {
      // ignore quota errors
    }
  }

  function sourceSanitize(text) {
    if (typeof text !== "string") return "";
    var out = text;
    for (var i = 0; i < CLEAN_REPLACEMENTS.length; i += 1) {
      out = out.split(CLEAN_REPLACEMENTS[i][0]).join(CLEAN_REPLACEMENTS[i][1]);
    }
    out = out.replace(/(?:棣冩|閳|馃)[^\s<]{1,8}\??/g, "");
    out = out.replace(/\/(span|td|div)>/gi, "");
    out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    out = out.replace(/\$\$/g, "$");
    out = out.replace(/\s{2,}/g, " ");
    return out.trim() ? out : "";
  }

  function isPotentiallyTranslatable(text) {
    var t = (text || "").trim();
    if (!t) return false;
    if (t.length > 180) return false;
    if (/https?:\/\//i.test(t)) return false;
    if (/\$\{/.test(t)) return false;
    if (/[{}<>]/.test(t)) return false;
    if (/^[\d\s.,:%$+\-*/()[\]]+$/.test(t)) return false;
    return /[A-Za-z]/.test(t);
  }

  function buildBatches(items, maxItems, maxChars) {
    var batches = [];
    var current = [];
    var currentChars = 0;

    for (var i = 0; i < items.length; i += 1) {
      var text = items[i];
      var len = text.length;

      if (len > maxChars) {
        if (current.length) {
          batches.push(current);
          current = [];
          currentChars = 0;
        }
        batches.push([text]);
        continue;
      }

      if (current.length >= maxItems || currentChars + len + 1 > maxChars) {
        batches.push(current);
        current = [];
        currentChars = 0;
      }

      current.push(text);
      currentChars += len + 1;
    }

    if (current.length) batches.push(current);
    return batches;
  }

  function markRetryOrGiveUp(lang, text) {
    if (!failedAttempts[lang]) failedAttempts[lang] = Object.create(null);
    var count = (failedAttempts[lang][text] || 0) + 1;
    failedAttempts[lang][text] = count;

    if (count >= 3) {
      cacheSet(lang, text, text);
      return;
    }

    pendingTexts[lang].add(text);
  }

  function storeTranslated(lang, sourceText, translatedText) {
    var cleaned = sourceSanitize(translatedText || "");
    if (!cleaned || cleaned === sourceText) {
      markRetryOrGiveUp(lang, sourceText);
      return;
    }
    if (failedAttempts[lang] && failedAttempts[lang][sourceText]) {
      delete failedAttempts[lang][sourceText];
    }
    cacheSet(lang, sourceText, cleaned);
  }

  function shouldSkipTextNode(node) {
    if (!node || !node.parentElement) return true;
    var parent = node.parentElement;
    var tag = parent.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return true;
    if (parent.closest("[data-no-translate]")) return true;
    if (
      document.body &&
      document.body.getAttribute("data-keyed-i18n") === "1" &&
      parent.closest("[data-t-key]")
    ) {
      return true;
    }
    return false;
  }

  function collectTargets(root) {
    var targets = [];
    if (!root) return targets;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (shouldSkipTextNode(node)) continue;
      var raw = node.nodeValue || "";
      if (!raw.trim()) continue;
      if (typeof node.__ecBaseText === "undefined") {
        node.__ecBaseText = sourceSanitize(raw);
      }
      var baseText = node.__ecBaseText;
      if (!baseText.trim()) continue;
      if (isPotentiallyTranslatable(baseText) || baseText !== raw) {
        targets.push({ type: "text", node: node, base: baseText });
      }
    }

    var attrs = ["placeholder", "title", "aria-label"];
    var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var i = 0; i < all.length; i += 1) {
      var el = all[i];
      if (el.closest("[data-no-translate]")) continue;
      if (
        document.body &&
        document.body.getAttribute("data-keyed-i18n") === "1" &&
        el.hasAttribute("data-t-key")
      ) {
        continue;
      }

      for (var j = 0; j < attrs.length; j += 1) {
        var attr = attrs[j];
        if (!el.hasAttribute(attr)) continue;
        var key = "ecBase_" + attr.replace(/-/g, "_");
        if (!el.dataset[key]) {
          el.dataset[key] = sourceSanitize(el.getAttribute(attr));
        }
        var base = el.dataset[key] || "";
        if (isPotentiallyTranslatable(base)) {
          targets.push({ type: "attr", el: el, attr: attr, base: base });
        }
      }

      if (
        el.tagName === "INPUT" &&
        (el.type === "submit" || el.type === "button") &&
        el.hasAttribute("value")
      ) {
        if (!el.dataset.ecBase_value) {
          el.dataset.ecBase_value = sourceSanitize(el.getAttribute("value"));
        }
        if (isPotentiallyTranslatable(el.dataset.ecBase_value)) {
          targets.push({ type: "attr", el: el, attr: "value", base: el.dataset.ecBase_value });
        }
      }
    }

    return targets;
  }

  function setTargetValue(target, value) {
    if (target.type === "text") {
      target.node.nodeValue = value;
      return;
    }
    target.el.setAttribute(target.attr, value);
  }

  function getStaticTranslation(lang, text) {
    if (lang === "en") return text;
    var map = STATIC_MAP[lang] || {};
    if (map[text]) return map[text];
    return null;
  }

  function enqueueMissingText(lang, text) {
    if (lang === "en") return;
    if (!text || !text.trim()) return;
    if (getStaticTranslation(lang, text)) return;
    if (cacheGet(lang, text)) return;
    if (failedAttempts[lang] && failedAttempts[lang][text] >= 3) return;
    pendingTexts[lang].add(text);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flushMissingTranslations();
    }, 160);
  }

  async function translateChunk(lang, chunk) {
    var tl = TARGET_LOCALE[lang];
    var joined = chunk.join("\n");
    var url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
      encodeURIComponent(tl) +
      "&dt=t&dj=1&q=" +
      encodeURIComponent(joined);

    var response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error("Translate request failed: " + response.status);
    var data = await response.json();
    var sentences = Array.isArray(data.sentences) ? data.sentences : [];
    var merged = "";
    for (var i = 0; i < sentences.length; i += 1) {
      merged += sentences[i].trans || "";
    }
    var parts = merged.split("\n");
    if (parts.length !== chunk.length) {
      // Fallback to per-item translate when split alignment fails.
      parts = [];
      for (var j = 0; j < chunk.length; j += 1) {
        parts.push(await translateSingle(lang, chunk[j]));
      }
    }
    return parts;
  }

  async function translateSingle(lang, text) {
    var tl = TARGET_LOCALE[lang];
    var url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
      encodeURIComponent(tl) +
      "&dt=t&dj=1&q=" +
      encodeURIComponent(text);
    var response = await fetch(url, { method: "GET" });
    if (!response.ok) return text;
    var data = await response.json();
    var sentences = Array.isArray(data.sentences) ? data.sentences : [];
    var out = "";
    for (var i = 0; i < sentences.length; i += 1) out += sentences[i].trans || "";
    return out || text;
  }

  async function flushMissingTranslations() {
    if (isFlushing) return;
    isFlushing = true;

    try {
      var langs = SUPPORTED.filter(function (l) {
        return l !== "en";
      });
      for (var li = 0; li < langs.length; li += 1) {
        var lang = langs[li];
        var pending = Array.from(pendingTexts[lang]);
        pendingTexts[lang].clear();

        var unresolved = [];
        for (var i = 0; i < pending.length; i += 1) {
          var text = pending[i];
          if (!cacheGet(lang, text) && !getStaticTranslation(lang, text)) unresolved.push(text);
        }

        if (!unresolved.length) continue;

        unresolved.sort(function (a, b) {
          return a.length - b.length;
        });

        var batches = buildBatches(unresolved, 8, 720);
        for (var bi = 0; bi < batches.length; bi += 1) {
          var chunk = batches[bi];
          try {
            var translated = await translateChunk(lang, chunk);
            for (var ti = 0; ti < chunk.length; ti += 1) {
              storeTranslated(lang, chunk[ti], translated[ti] || "");
            }
          } catch (e) {
            for (var ci = 0; ci < chunk.length; ci += 1) {
              try {
                var one = await translateSingle(lang, chunk[ci]);
                storeTranslated(lang, chunk[ci], one || "");
              } catch (singleError) {
                markRetryOrGiveUp(lang, chunk[ci]);
              }
            }
          }
        }
      }
    } finally {
      isFlushing = false;
      if (currentLang !== "en") {
        applyLanguage(currentLang, document.body, { persist: false, fromFlush: true });
      }
      var hasPending = false;
      for (var pi = 0; pi < SUPPORTED.length; pi += 1) {
        var pendingLang = SUPPORTED[pi];
        if (pendingLang === "en") continue;
        if (pendingTexts[pendingLang] && pendingTexts[pendingLang].size) {
          hasPending = true;
          break;
        }
      }
      if (hasPending) scheduleFlush();
    }
  }

  function updateHtmlLang(lang) {
    if (lang === "zh") {
      document.documentElement.setAttribute("lang", "zh-CN");
    } else if (lang === "de") {
      document.documentElement.setAttribute("lang", "de");
    } else if (lang === "ja") {
      document.documentElement.setAttribute("lang", "ja");
    } else if (lang === "ko") {
      document.documentElement.setAttribute("lang", "ko");
    } else {
      document.documentElement.setAttribute("lang", "en");
    }
  }

  function applyStructuralFixes(root) {
    if (!root || !root.querySelectorAll) return;

    var stars = root.querySelectorAll(".star");
    for (var i = 0; i < stars.length; i += 1) {
      stars[i].textContent = "\u2606";
    }

    var icons = root.querySelectorAll(".coin-img-box, .f-coin-icon");
    for (var j = 0; j < icons.length; j += 1) {
      var el = icons[j];
      if (el.querySelector("img")) continue;
      var text = (el.textContent || "").trim();
      if (!text) continue;
      if (!/^[A-Za-z0-9$\u20ac\u00a3\u00a5\u20a9\u2606\u2605.-]{1,3}$/.test(text)) {
        el.textContent = "";
      }
    }
  }

  function applyLanguage(lang, root, options) {
    var opts = options || {};
    var targetRoot = root || document.body;
    if (!targetRoot) return;

    currentLang = normalizeLang(lang) || "en";

    if (opts.persist !== false) {
      localStorage.setItem(STORAGE_KEY, currentLang);
      localStorage.setItem(LEGACY_KEY, LEGACY_LABEL[currentLang]);
    }

    updateHtmlLang(currentLang);
    ensureSwitcher();
    updateSwitcher(currentLang);

    applyStructuralFixes(targetRoot);

    var targets = collectTargets(targetRoot);
    for (var i = 0; i < targets.length; i += 1) {
      var t = targets[i];
      var base = t.base;
      var out = base;

      if (currentLang !== "en") {
        out =
          getStaticTranslation(currentLang, base) ||
          cacheGet(currentLang, base) ||
          base;
        if (out === base) enqueueMissingText(currentLang, base);
      }

      setTargetValue(t, out);
    }

    dispatchLangEvent(currentLang);
  }

  function dispatchLangEvent(lang) {
    var evt;
    try {
      evt = new CustomEvent("ec-language-changed", { detail: { lang: lang } });
    } catch (e) {
      evt = document.createEvent("CustomEvent");
      evt.initCustomEvent("ec-language-changed", true, true, { lang: lang });
    }
    document.dispatchEvent(evt);
  }

  function ensureBaseStyle() {
    if (document.getElementById("ec-site-lang-style")) return;
    var style = document.createElement("style");
    style.id = "ec-site-lang-style";
    style.textContent = "" +
      "html,body,input,textarea,button,select{font-family:Inter,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif !important;}" +
      "#ec-global-lang{position:fixed;top:12px;right:12px;z-index:100000;display:flex;flex-direction:column;align-items:flex-end;}" +
      "#ec-global-lang[data-hide='1']{display:none;}" +
      "#ec-global-lang .ec-lang-btn{min-width:72px;height:34px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(16,18,26,.88);color:#fff;font-size:13px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px);}" +
      "#ec-global-lang .ec-lang-menu{display:none;margin-top:6px;padding:6px;background:rgba(16,18,26,.96);border:1px solid rgba(255,255,255,.16);border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.25);min-width:96px;}" +
      "#ec-global-lang.open .ec-lang-menu{display:block;}" +
      "#ec-global-lang .ec-lang-item{width:100%;height:30px;border:0;background:transparent;color:#d8deea;border-radius:7px;font-size:13px;text-align:left;padding:0 10px;cursor:pointer;}" +
      "#ec-global-lang .ec-lang-item:hover{background:rgba(255,255,255,.1);color:#fff;}" +
      "#ec-global-lang .ec-lang-item.active{background:#2d6cdf;color:#fff;}";
    document.head.appendChild(style);
  }

  function shouldHideSwitcher() {
    if (!document.body) return false;
    if (document.getElementById("language-screen")) return true;

    var path = (window.location.pathname || "").toLowerCase();
    if (path.indexOf("mobile.html") >= 0) return true;

    return false;
  }

  function updateSwitcherVisibility() {
    var wrap = document.getElementById("ec-global-lang");
    if (!wrap) return;
    if (shouldHideSwitcher()) {
      wrap.setAttribute("data-hide", "1");
    } else {
      wrap.removeAttribute("data-hide");
    }
  }

  function ensureSwitcher() {
    ensureBaseStyle();
    if (document.getElementById("ec-global-lang")) return;

    var wrap = document.createElement("div");
    wrap.id = "ec-global-lang";
    wrap.setAttribute("data-no-translate", "1");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ec-lang-btn";
    btn.id = "ec-lang-btn";
    btn.textContent = LANG_LABEL[currentLang] || "EN";

    var menu = document.createElement("div");
    menu.className = "ec-lang-menu";
    menu.id = "ec-lang-menu";

    var items = [
      { lang: "en", label: "English" },
      { lang: "zh", label: "\u4e2d\u6587" },
      { lang: "de", label: "Deutsch" },
      { lang: "ja", label: "\u65e5\u672c\u8a9e" },
      { lang: "ko", label: "\ud55c\uad6d\uc5b4" }
    ];

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var ib = document.createElement("button");
      ib.type = "button";
      ib.className = "ec-lang-item";
      ib.setAttribute("data-lang", item.lang);
      ib.textContent = item.label;
      ib.addEventListener("click", function (ev) {
        var lang = ev.currentTarget.getAttribute("data-lang");
        wrap.classList.remove("open");
        applyLanguage(lang, document.body, { persist: true });
      });
      menu.appendChild(ib);
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      wrap.classList.toggle("open");
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    document.body.appendChild(wrap);
    updateSwitcherVisibility();

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) wrap.classList.remove("open");
    });
  }

  function updateSwitcher(lang) {
    updateSwitcherVisibility();
    var btn = document.getElementById("ec-lang-btn");
    if (btn) btn.textContent = LANG_LABEL[lang] || "EN";
    var items = document.querySelectorAll("#ec-global-lang .ec-lang-item");
    for (var i = 0; i < items.length; i += 1) {
      var it = items[i];
      it.classList.toggle("active", it.getAttribute("data-lang") === lang);
    }
  }

  function isAdminLikePage() {
    var p = (window.location.pathname || "").toLowerCase();
    return p.indexOf("/admin") >= 0 || p.indexOf("admin.html") >= 0 || p.indexOf("admin_login.html") >= 0;
  }

  function ensureUxToastStyle() {
    if (document.getElementById("ec-ux-toast-style")) return;
    var style = document.createElement("style");
    style.id = "ec-ux-toast-style";
    style.textContent =
      "#ec-ux-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(16px);opacity:0;pointer-events:none;z-index:100001;background:rgba(17,20,29,.96);color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:500;box-shadow:0 10px 24px rgba(0,0,0,.28);transition:all .22s ease;max-width:min(86vw,480px);text-align:center;}" +
      "#ec-ux-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}";
    document.head.appendChild(style);
  }

  function showUxToast(text) {
    ensureUxToastStyle();
    var toast = document.getElementById("ec-ux-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ec-ux-toast";
      toast.setAttribute("data-no-translate", "1");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toast.__ecTimer);
    toast.__ecTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  function safeActionText(el) {
    if (!el) return "";
    var label =
      el.getAttribute("data-action-label") ||
      el.getAttribute("aria-label") ||
      el.textContent ||
      "";
    return label.replace(/\s+/g, " ").trim();
  }

  function inferTopbarActionKey(label) {
    var t = (label || "").toLowerCase();
    if (!t) return "";

    if (/\b(deposit|recharge|einzahlung)\b|充值|入金|存款|入金|デポジット|입금/.test(t)) return "deposit";
    if (/\b(wallet|funds|assets?|vermoegen|vermögen|geldboerse|geldbörse)\b|钱包|资产|资金|ウォレット|資産|지갑|자산/.test(t)) return "wallet";
    if (/\b(order|orders|auftrag|auftraege|aufträge|history)\b|订单|历史|注文|履歴|주문|내역/.test(t)) return "order";
    if (/\b(dashboard|uebersicht|übersicht)\b|仪表盘|总览|ダッシュボード|대시보드/.test(t)) return "dashboard";
    if (/\b(logout|sign out|abmelden)\b|退出|登出|ログアウト|로그아웃/.test(t)) return "logout";
    if (/\b(account|konto|login|sign in)\b|账户|账号|登录|アカウント|ログイン|계정|로그인/.test(t)) return "account";
    return "";
  }

  function captureActionMetadata(root) {
    if (!root || isAdminLikePage()) return;

    var items = [];
    if (root.nodeType === 1 && root.matches && root.matches("a,button,div,span")) {
      items.push(root);
    }

    var selector =
      "a[href='#'],a[href=''],a[href='javascript:void(0)']," +
      ".topbar .t-actions .btn-dep,.topbar .t-actions .t-r.arr," +
      "#main-nav-actions .btn-dep,#main-nav-actions .t-r.arr";

    var found = root.querySelectorAll ? root.querySelectorAll(selector) : [];
    for (var i = 0; i < found.length; i += 1) items.push(found[i]);

    for (var j = 0; j < items.length; j += 1) {
      var el = items[j];
      if (!el || el.nodeType !== 1) continue;

      if (!el.getAttribute("data-action-label")) {
        var baseLabel = safeActionText(el);
        if (baseLabel) el.setAttribute("data-action-label", baseLabel);
      }

      if (!el.getAttribute("data-topbar-action")) {
        var asLabel = (safeActionText(el) || "").toLowerCase();
        var key = "";
        if (el.classList && el.classList.contains("btn-dep")) {
          key = "deposit";
        } else if (el.id === "dynamic-logout-btn") {
          key = "logout";
        } else {
          key = inferTopbarActionKey(asLabel);
          if (!key && el.tagName === "A") {
            var href = (el.getAttribute("href") || "").toLowerCase();
            if (href.indexOf("mobile.html") >= 0) key = "deposit";
            else if (href.indexOf("fund.html") >= 0) key = "wallet";
            else if (href.indexOf("dashboard.html") >= 0) key = "dashboard";
            else if (href.indexOf("login.html") >= 0) key = "account";
          }
        }
        if (key) el.setAttribute("data-topbar-action", key);
      }
    }
  }

  function normalizeActionLabel(el) {
    return safeActionText(el).toLowerCase();
  }

  function resolveRouteByLabel(label) {
    if (!label) return "";
    for (var i = 0; i < UX_ROUTE_RULES.length; i += 1) {
      var rule = UX_ROUTE_RULES[i];
      if (rule.re.test(label)) return rule.to;
    }
    return "";
  }

  function initPlaceholderLinkRouting() {
    if (isAdminLikePage()) return;

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented) return;
      var link = e.target.closest("a[href='#'],a[href=''],a[href='javascript:void(0)']");
      if (!link) return;
      if (link.getAttribute("data-no-ux") === "1") return;
      if (link.hasAttribute("onclick")) return;

      var label = normalizeActionLabel(link);
      var to = resolveRouteByLabel(label);

      e.preventDefault();

      if (to) {
        var current = (window.location.pathname || "").split("/").pop().toLowerCase();
        if (current !== to.toLowerCase()) {
          window.location.href = to;
        } else {
          showUxToast("You are already on this page.");
        }
      } else {
        showUxToast("This feature is being prepared.");
      }
    });
  }

  function hasInlineClickHandler(el) {
    return !!(el && (el.hasAttribute("onclick") || typeof el.onclick === "function"));
  }

  function resolveTopbarActionByLabel(label) {
    return resolveTopbarActionByKey(inferTopbarActionKey(label));
  }

  function hasLikelyFirebaseSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i) || "";
        if (key.indexOf("firebase:authUser:") !== 0) continue;
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (ignore) {
          continue;
        }
        if (
          parsed &&
          (parsed.uid ||
            parsed.email ||
            (parsed.stsTokenManager && parsed.stsTokenManager.accessToken))
        ) {
          return true;
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  function isTopbarUserSignedIn() {
    if (window.__EC_USER_SIGNED_IN === true) return true;
    return hasLikelyFirebaseSession();
  }

  function resolveTopbarActionByKey(key) {
    if (!key) return null;
    var signedIn = isTopbarUserSignedIn();
    if (key === "deposit") return { type: "route", to: signedIn ? "fund.html" : "login.html" };
    if (key === "wallet") return { type: "route", to: signedIn ? "fund.html" : "login.html" };
    if (key === "order") return { type: "route", to: signedIn ? "dashboard.html" : "login.html" };
    if (key === "dashboard") return { type: "route", to: signedIn ? "dashboard.html" : "login.html" };
    if (key === "logout") return { type: "logout" };
    if (key === "account") return { type: "route", to: signedIn ? "dashboard.html" : "login.html" };
    return null;
  }

  function navigateTopbarAction(to) {
    if (!to) return;
    var target = to.toLowerCase();
    var current = ((window.location.pathname || "").split("/").pop() || "").toLowerCase();
    if (current === target) {
      showUxToast("You are already on this page.");
      return;
    }
    window.location.href = to;
  }

  function logoutByFallback() {
    var redirectHome = function () {
      window.location.href = "index.html";
    };

    if (typeof window.handleLogout === "function") {
      try {
        var result = window.handleLogout();
        if (result && typeof result.then === "function") {
          result.then(redirectHome).catch(redirectHome);
        } else {
          setTimeout(redirectHome, 80);
        }
        return;
      } catch (e) {
        // continue to import fallback
      }
    }

    var tryImport = function (p) {
      return import(p).then(function (m) {
        if (m && m.signOut && m.auth) return m.signOut(m.auth);
        return null;
      });
    };

    tryImport("./firebase-config.js")
      .catch(function () {
        return tryImport("../firebase-config.js");
      })
      .then(redirectHome)
      .catch(redirectHome);
  }

  function initTopbarActionRouting() {
    if (isAdminLikePage()) return;

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented) return;

      var actionEl = e.target.closest(
        ".topbar .t-actions .btn-dep,.topbar .t-actions .t-r.arr,#main-nav-actions .btn-dep,#main-nav-actions .t-r.arr"
      );
      if (!actionEl) return;
      if (actionEl.getAttribute("data-no-ux") === "1") return;
      if (hasInlineClickHandler(actionEl)) return;

      captureActionMetadata(actionEl);
      var action =
        resolveTopbarActionByKey(actionEl.getAttribute("data-topbar-action")) ||
        resolveTopbarActionByLabel(normalizeActionLabel(actionEl));
      if (!action) return;

      // Avoid duplicate logout handling on markets dynamic navbar.
      if (action.type === "logout" && actionEl.id === "dynamic-logout-btn") return;

      e.preventDefault();

      if (action.type === "logout") {
        logoutByFallback();
        return;
      }
      navigateTopbarAction(action.to);
    });
  }

  function initPasswordEyeToggle() {
    document.addEventListener("click", function (e) {
      var eye = e.target.closest(".pwd-icon-btn");
      if (!eye) return;

      var text = (eye.textContent || "").trim();
      if (text === "$" || text === "+" || text === "✓") return;

      var wrapper = eye.closest(".pwd-input-wrapper,.auth-form-group");
      if (!wrapper) return;

      var input = wrapper.querySelector("input");
      if (!input) return;

      var marker =
        (input.id || "") + " " + (input.name || "") + " " + (input.placeholder || "");
      var looksPassword = /pass|pwd|password/i.test(marker) || input.type === "password";
      if (!looksPassword) return;

      if (input.type === "password") {
        input.type = "text";
        eye.textContent = "🙈";
      } else {
        input.type = "password";
        eye.textContent = "👁";
      }
    });
  }

  function initUxInteractions() {
    if (uxReady) return;
    uxReady = true;
    initPlaceholderLinkRouting();
    initTopbarActionRouting();
    initPasswordEyeToggle();
  }

  function initObserver() {
    if (!window.MutationObserver || !document.body) return;
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j += 1) {
          var node = m.addedNodes[j];
          if (node.nodeType === 1) {
            captureActionMetadata(node);
            applyLanguage(currentLang, node, { persist: false });
          }
        }
      }
      ensureSwitcher();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.ecSetSiteLanguage = function (lang) {
    applyLanguage(lang, document.body, { persist: true });
  };

  window.ecGetSiteLanguage = function () {
    return currentLang;
  };

  function init() {
    currentLang = getStoredLang() || "en";
    captureActionMetadata(document.body);
    ensureSwitcher();
    applyLanguage(currentLang, document.body, { persist: true });
    initUxInteractions();
    initObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

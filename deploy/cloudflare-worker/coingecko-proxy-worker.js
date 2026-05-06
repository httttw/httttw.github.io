// Cloudflare Worker: CoinGecko simple-price proxy with CORS.
// Route example:
//   https://api.easycoinst0re.com/api/coingecko/simple-price?ids=bitcoin,ethereum&vs_currencies=usd
//   https://api.easycoinst0re.com/api/infoway/batch-trade?codes=BTCUSDT,ETHUSDT
//   https://api.easycoinst0re.com/api/infoway/batch-kline
//
// Environment variable (optional):
//   COINGECKO_DEMO_API_KEY=your_demo_key
//   INFOWAY_API_KEY=your_infoway_key
//
// If you have a Pro key, replace base URL and header:
//   base = "https://pro-api.coingecko.com/api/v3"
//   header "x-cg-pro-api-key"

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type,Authorization,x-cg-demo-api-key,x-cg-pro-api-key,apiKey",
  "access-control-max-age": "86400"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=8"
    }
  });
}

function passthroughResponse(upstream) {
  const headers = new Headers(upstream.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  headers.set("cache-control", "public, max-age=8");
  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname.endsWith("/api/coingecko/simple-price")) {
      const ids = url.searchParams.get("ids") || "";
      if (!ids.trim()) {
        return jsonResponse({ error: "Missing ids query parameter" }, 400);
      }

      const upstreamParams = new URLSearchParams();
      upstreamParams.set("ids", ids);
      upstreamParams.set("vs_currencies", url.searchParams.get("vs_currencies") || "usd");
      upstreamParams.set("include_24hr_change", url.searchParams.get("include_24hr_change") || "true");
      upstreamParams.set("include_24hr_vol", url.searchParams.get("include_24hr_vol") || "true");
      upstreamParams.set("include_last_updated_at", url.searchParams.get("include_last_updated_at") || "true");

      const upstreamUrl = `https://api.coingecko.com/api/v3/simple/price?${upstreamParams.toString()}`;
      const headers = { accept: "application/json" };
      if (env && env.COINGECKO_DEMO_API_KEY) {
        headers["x-cg-demo-api-key"] = String(env.COINGECKO_DEMO_API_KEY).trim();
      }

      try {
        const upstream = await fetch(upstreamUrl, {
          method: "GET",
          headers
        });
        return passthroughResponse(upstream);
      } catch (error) {
        return jsonResponse({ error: "Upstream request failed", detail: String(error && error.message || error) }, 502);
      }
    }

    if (url.pathname.endsWith("/api/infoway/batch-trade")) {
      const codes = url.searchParams.get("codes") || "";
      if (!codes.trim()) {
        return jsonResponse({ error: "Missing codes query parameter" }, 400);
      }

      const apiKey = String((env && env.INFOWAY_API_KEY) || url.searchParams.get("apikey") || "").trim();
      if (!apiKey) {
        return jsonResponse({ error: "Missing Infoway API key" }, 400);
      }

      try {
        const upstream = await fetch(`https://data.infoway.io/crypto/batch_trade/${codes}`, {
          method: "GET",
          headers: {
            accept: "application/json",
            apiKey
          }
        });
        return passthroughResponse(upstream);
      } catch (error) {
        return jsonResponse({ error: "Infoway trade request failed", detail: String(error && error.message || error) }, 502);
      }
    }

    if (url.pathname.endsWith("/api/infoway/batch-kline")) {
      const apiKey = String((env && env.INFOWAY_API_KEY) || url.searchParams.get("apikey") || "").trim();
      if (!apiKey) {
        return jsonResponse({ error: "Missing Infoway API key" }, 400);
      }

      let body = "";
      try {
        body = await request.text();
      } catch (error) {
        return jsonResponse({ error: "Unable to read request body", detail: String(error && error.message || error) }, 400);
      }

      try {
        const upstream = await fetch("https://data.infoway.io/crypto/v2/batch_kline", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            apiKey
          },
          body
        });
        return passthroughResponse(upstream);
      } catch (error) {
        return jsonResponse({ error: "Infoway kline request failed", detail: String(error && error.message || error) }, 502);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};

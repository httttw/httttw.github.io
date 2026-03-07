// Cloudflare Worker: CoinGecko simple-price proxy with CORS.
// Route example:
//   https://api.easycryptoguide.com/api/coingecko/simple-price?ids=bitcoin,ethereum&vs_currencies=usd
//
// Environment variable (optional):
//   COINGECKO_DEMO_API_KEY=your_demo_key
//
// If you have a Pro key, replace base URL and header:
//   base = "https://pro-api.coingecko.com/api/v3"
//   header "x-cg-pro-api-key"

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "Content-Type,Authorization,x-cg-demo-api-key,x-cg-pro-api-key",
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
    if (!url.pathname.endsWith("/api/coingecko/simple-price")) {
      return jsonResponse({ error: "Not found" }, 404);
    }

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
};

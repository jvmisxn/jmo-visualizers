const SYMBOLS = [
  { symbol: "SPY", finnhub: "SPY", name: "S&P 500 ETF", group: "index" },
  { symbol: "QQQ", finnhub: "QQQ", name: "Nasdaq 100 ETF", group: "index" },
  { symbol: "DIA", finnhub: "DIA", name: "Dow 30 ETF", group: "index" },
  { symbol: "IWM", finnhub: "IWM", name: "Russell 2000 ETF", group: "index" },
  { symbol: "AAPL", finnhub: "AAPL", name: "Apple", group: "watch" },
  { symbol: "NVDA", finnhub: "NVDA", name: "NVIDIA", group: "watch" },
  { symbol: "MSFT", finnhub: "MSFT", name: "Microsoft", group: "watch" },
  { symbol: "TSLA", finnhub: "TSLA", name: "Tesla", group: "watch" },
  { symbol: "BTC", finnhub: "BINANCE:BTCUSDT", name: "Bitcoin", group: "watch" },
];

const ALLOWED_ORIGINS = new Set([
  "https://jvmisxn.github.io",
  "http://localhost:8766",
  "http://127.0.0.1:8766",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return optionsResponse(request);
    if (request.method !== "GET") return jsonResponse(request, { error: "method not allowed" }, 405);
    if (url.pathname !== "/quotes") return jsonResponse(request, { error: "not found" }, 404);
    if (!env.FINNHUB_TOKEN) return jsonResponse(request, { error: "proxy missing FINNHUB_TOKEN" }, 500);

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/quotes-cache-v1`, request);
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(request, cached);

    const payload = await fetchQuotes(env.FINNHUB_TOKEN);
    const response = jsonResponse(request, payload, 200, {
      "Cache-Control": "public, max-age=20",
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

async function fetchQuotes(token) {
  const quotes = await Promise.all(SYMBOLS.map((symbol) => quoteFor(symbol, token)));
  return {
    provider: "finnhub",
    generatedAt: Date.now(),
    quotes,
  };
}

async function quoteFor(symbol, token) {
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol.finnhub);
  url.searchParams.set("token", token);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`${symbol.symbol} quote ${response.status}`);
  const data = await response.json();
  if (!Number.isFinite(data.c) || data.c <= 0) throw new Error(`${symbol.symbol} quote missing price`);

  return {
    symbol: symbol.symbol,
    providerSymbol: symbol.finnhub,
    name: symbol.name,
    group: symbol.group,
    price: data.c,
    change: Number.isFinite(data.d) ? data.d : 0,
    changePercent: Number.isFinite(data.dp) ? data.dp : 0,
    providerTime: Number.isFinite(data.t) ? data.t * 1000 : null,
  };
}

function optionsResponse(request) {
  return withCors(request, new Response(null, { status: 204 }));
}

function jsonResponse(request, body, status = 200, headers = {}) {
  return withCors(request, new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  }));
}

function withCors(request, response) {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://jvmisxn.github.io";
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", allowOrigin);
  next.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  next.headers.set("Access-Control-Allow-Headers", "Content-Type");
  next.headers.set("Vary", "Origin");
  return next;
}

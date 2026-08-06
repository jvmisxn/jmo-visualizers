import { mkdir, writeFile } from "node:fs/promises";

const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN;
const OUTPUT_FILE = new URL("../market-data/quotes.json", import.meta.url);

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

if (!FINNHUB_TOKEN) {
  throw new Error("FINNHUB_TOKEN is required");
}

async function quoteFor(symbol) {
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol.finnhub);
  url.searchParams.set("token", FINNHUB_TOKEN);

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

const quotes = [];
for (const symbol of SYMBOLS) {
  quotes.push(await quoteFor(symbol));
}

const payload = {
  provider: "finnhub",
  generatedAt: Date.now(),
  quotes,
};

await mkdir(new URL("../market-data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);

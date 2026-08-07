const QUOTES = [
  { symbol: "SPY", name: "S&P 500 ETF", price: null, group: "index" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", price: null, group: "index" },
  { symbol: "DIA", name: "Dow 30 ETF", price: null, group: "index" },
  { symbol: "IWM", name: "Russell 2000 ETF", price: null, group: "index" },
  { symbol: "AAPL", name: "Apple", price: null, group: "watch" },
  { symbol: "NVDA", name: "NVIDIA", price: null, group: "watch" },
  { symbol: "MSFT", name: "Microsoft", price: null, group: "watch" },
  { symbol: "TSLA", name: "Tesla", price: null, group: "watch" },
  { symbol: "BTC", name: "Bitcoin", price: null, group: "watch" },
];

const FINNHUB_SYMBOLS = new Map([
  ["SPY", "SPY"],
  ["QQQ", "QQQ"],
  ["DIA", "DIA"],
  ["IWM", "IWM"],
  ["AAPL", "AAPL"],
  ["NVDA", "NVDA"],
  ["MSFT", "MSFT"],
  ["TSLA", "TSLA"],
  ["BTC", "BINANCE:BTCUSDT"],
]);

const PUBLIC_QUOTES_URL = "../market-data/quotes.json";
const PUBLIC_QUOTES_REFRESH_MS = 60000;
const MARKET_PROXY_URL = window.JMO_MARKET_PROXY_URL || "";

const HEADLINES = [
  "Showing Finnhub quote snapshots only. No simulated market movement.",
  "Chart line connects real previous close/open estimate to the latest snapshot.",
  "Public page uses GitHub Actions snapshots so the API key stays private.",
  "Live mode uses Finnhub trades only when a private token is supplied in the URL hash.",
];

const els = {
  clock: document.querySelector("#clock"),
  state: document.querySelector("#market-state"),
  activeSymbol: document.querySelector("#active-symbol"),
  activeName: document.querySelector("#active-name"),
  activePrice: document.querySelector("#active-price"),
  activeChange: document.querySelector("#active-change"),
  indices: document.querySelector("#indices"),
  watchlist: document.querySelector("#watchlist"),
  headline: document.querySelector("#headline"),
  headlineSource: document.querySelector("#headline-source"),
  ticker: document.querySelector("#ticker-text"),
  chart: document.querySelector("#chart"),
};

const ctx = els.chart.getContext("2d");
const series = new Map();
let activeIndex = 0;
let headlineIndex = 0;
let width = 0;
let height = 0;
let finnhubSocket = null;
let liveMode = false;
let lastLiveTradeAt = 0;
let lastSnapshotAt = 0;

for (const quote of QUOTES) {
  quote.open = null;
  quote.change = 0;
  series.set(quote.symbol, []);
}

function resize() {
  const rect = els.chart.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.floor(rect.width);
  height = Math.floor(rect.height);
  els.chart.width = Math.floor(width * dpr);
  els.chart.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function marketState(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "weekday").value;
  const hour = Number(parts.find((part) => part.type === "hour").value);
  const minute = Number(parts.find((part) => part.type === "minute").value);
  const total = hour * 60 + minute;
  const weekday = !["Sat", "Sun"].includes(day);
  if (!weekday) return "MARKET CLOSED";
  if (total >= 570 && total < 960) return "MARKET OPEN";
  if (total >= 240 && total < 570) return "PRE-MARKET";
  if (total >= 960 && total < 1200) return "AFTER HOURS";
  return "MARKET CLOSED";
}

function formatClock() {
  const now = new Date();
  els.clock.textContent = `${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(now)} PT`;
  els.state.textContent = marketState(now);
}

function tick() {
  renderQuotes();
  draw();
}

async function loadPublicQuoteSnapshot() {
  if (liveMode) return;

  try {
    const sourceUrl = MARKET_PROXY_URL || PUBLIC_QUOTES_URL;
    const response = await fetch(`${sourceUrl}?refresh=${Math.floor(Date.now() / PUBLIC_QUOTES_REFRESH_MS)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`snapshot ${response.status}`);
    const snapshot = await response.json();
    if (!Array.isArray(snapshot.quotes)) throw new Error("snapshot missing quotes");

    let applied = 0;
    for (const quoteData of snapshot.quotes) {
      const quote = QUOTES.find((item) => item.symbol === quoteData.symbol);
      if (!quote || !Number.isFinite(quoteData.price)) continue;
      applyQuoteSnapshot(quote, quoteData);
      applied += 1;
    }

    if (!applied) throw new Error("snapshot empty");
    lastSnapshotAt = Date.now();
    const ageMinutes = Number.isFinite(snapshot.generatedAt)
      ? Math.max(0, Math.round((Date.now() - snapshot.generatedAt) / 60000))
      : 0;
    els.headlineSource.textContent = MARKET_PROXY_URL
      ? "FINNHUB PROXY"
      : ageMinutes > 30 ? "DELAYED SNAPSHOT" : "REAL SNAPSHOT";
    renderQuotes();
    draw();
  } catch (error) {
    if (!lastSnapshotAt) els.headlineSource.textContent = "SNAPSHOT UNAVAILABLE";
  }
}

function applyQuoteSnapshot(quote, quoteData) {
  quote.price = quoteData.price;
  quote.change = Number.isFinite(quoteData.changePercent) ? quoteData.changePercent : 0;
  quote.open = quote.change === -100 ? quote.price : quote.price / (1 + quote.change / 100);
  quote.lastSnapshotAt = Date.now();

  series.set(quote.symbol, [quote.open, quote.price]);
}

function renderQuotes() {
  const active = QUOTES[activeIndex];
  els.activeSymbol.textContent = active.symbol;
  els.activeName.textContent = active.name;
  els.activePrice.textContent = formatPrice(active);
  els.activeChange.textContent = formatChange(active);
  setDirectionClass(els.activeChange, active.change);

  els.indices.innerHTML = QUOTES.filter((quote) => quote.group === "index").map(renderQuoteRow).join("");
  els.watchlist.innerHTML = QUOTES.filter((quote) => quote.group === "watch").map(renderQuoteRow).join("");
  els.ticker.innerHTML = QUOTES.map((quote) => {
    const direction = quote.change >= 0 ? "ticker-up" : "ticker-down";
    return `<span>${quote.symbol} ${formatPrice(quote)} <span class="${direction}">${formatChange(quote)}</span></span>`;
  }).join("");
}

function renderQuoteRow(quote) {
  const direction = quote.change < 0 ? "down" : "up";
  return `
    <div class="quote-item ${direction}">
      <div class="quote-symbol">${quote.symbol}</div>
      <div class="quote-price">${formatPrice(quote)}</div>
      <div class="quote-change">${formatChange(quote)}</div>
    </div>
  `;
}

function setDirectionClass(el, change) {
  el.classList.toggle("down", change < -0.04);
  el.classList.toggle("flat", Math.abs(change) <= 0.04);
}

function formatPrice(quote) {
  if (!Number.isFinite(quote.price)) return "--";
  if (quote.symbol === "BTC") {
    return `$${Math.round(quote.price).toLocaleString("en-US")}`;
  }
  return `$${quote.price.toFixed(2)}`;
}

function formatChange(quote) {
  if (!Number.isFinite(quote.price) || !Number.isFinite(quote.change)) return "--";
  return `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%`;
}

function rotateActive() {
  activeIndex = (activeIndex + 1) % QUOTES.length;
  renderQuotes();
  draw();
}

function rotateHeadline() {
  headlineIndex = (headlineIndex + 1) % HEADLINES.length;
  els.headline.textContent = HEADLINES[headlineIndex];
}

function getFinnhubToken() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const urlToken = hashParams.get("finnhub")
    || hashParams.get("token")
    || params.get("finnhub")
    || params.get("token");
  if (urlToken) {
    localStorage.setItem("jmoFinnhubToken", urlToken);
    return urlToken;
  }
  return localStorage.getItem("jmoFinnhubToken") || "";
}

function connectFinnhub() {
  const token = getFinnhubToken();
  if (!token) {
    els.headlineSource.textContent = lastSnapshotAt ? "REAL SNAPSHOT" : "SNAPSHOT LOADING";
    return;
  }

  try {
    finnhubSocket = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);
  } catch (error) {
    els.headlineSource.textContent = lastSnapshotAt ? "REAL SNAPSHOT" : "LIVE UNAVAILABLE";
    return;
  }

  finnhubSocket.addEventListener("open", () => {
    liveMode = true;
    els.headlineSource.textContent = "FINNHUB LIVE";
    for (const symbol of FINNHUB_SYMBOLS.values()) {
      finnhubSocket.send(JSON.stringify({ type: "subscribe", symbol }));
    }
  });

  finnhubSocket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type !== "trade" || !Array.isArray(payload.data)) return;
      for (const trade of payload.data) {
        applyFinnhubTrade(trade);
      }
      lastLiveTradeAt = Date.now();
      renderQuotes();
      draw();
    } catch (error) {
      // Ignore malformed vendor messages and keep the visualizer running.
    }
  });

  finnhubSocket.addEventListener("close", () => {
    liveMode = false;
    els.headlineSource.textContent = lastLiveTradeAt ? "LIVE PAUSED" : "REAL SNAPSHOT";
    setTimeout(connectFinnhub, 15000);
  });

  finnhubSocket.addEventListener("error", () => {
    els.headlineSource.textContent = lastLiveTradeAt ? "LIVE DEGRADED" : "REAL SNAPSHOT";
  });
}

function applyFinnhubTrade(trade) {
  const quote = QUOTES.find((item) => FINNHUB_SYMBOLS.get(item.symbol) === trade.s);
  if (!quote || !Number.isFinite(trade.p) || !Number.isFinite(quote.open)) return;
  quote.price = trade.p;
  quote.change = ((quote.price - quote.open) / quote.open) * 100;
  quote.lastTradeAt = Date.now();

  const values = series.get(quote.symbol);
  values.push(quote.price);
  if (values.length > 180) values.shift();
}

function draw() {
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07111a");
  gradient.addColorStop(0.48, "#121b20");
  gradient.addColorStop(1, "#030609");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawGrid();
  drawSeries(series.get(QUOTES[activeIndex].symbol), QUOTES[activeIndex].change);
  drawVolumeBars();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(123, 231, 255, 0.13)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 74) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 74) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSeries(values, change) {
  if (!Array.isArray(values) || values.length < 2 || !values.every(Number.isFinite)) {
    ctx.save();
    ctx.fillStyle = "rgba(232, 251, 255, 0.84)";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText("WAITING FOR REAL MARKET SNAPSHOT", width * 0.08, height * 0.48);
    ctx.restore();
    return;
  }
  const chartLeft = width * 0.08;
  const chartRight = width * 0.72;
  const chartTop = height * 0.24;
  const chartBottom = height * 0.76;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const color = change >= 0 ? "#59f2a2" : "#ff5d73";

  ctx.save();
  ctx.lineWidth = 5;
  ctx.shadowBlur = 22;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = chartLeft + (index / Math.max(1, values.length - 1)) * (chartRight - chartLeft);
    const y = chartBottom - ((value - min) / range) * (chartBottom - chartTop);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const fill = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
  fill.addColorStop(0, change >= 0 ? "rgba(89, 242, 162, 0.28)" : "rgba(255, 93, 115, 0.26)");
  fill.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.lineTo(chartRight, chartBottom);
  ctx.lineTo(chartLeft, chartBottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawVolumeBars() {
  const quotes = QUOTES.filter((quote) => Number.isFinite(quote.change));
  if (!quotes.length) return;
  ctx.save();
  const baseY = height * 0.92;
  const maxH = height * 0.14;
  const startX = width * 0.08;
  const span = width * 0.64;
  const maxChange = Math.max(0.1, ...quotes.map((quote) => Math.abs(quote.change)));
  for (let i = 0; i < quotes.length; i += 1) {
    const quote = quotes[i];
    const barH = maxH * (Math.abs(quote.change) / maxChange);
    ctx.fillStyle = quote.change >= 0 ? "rgba(89, 242, 162, 0.72)" : "rgba(255, 93, 115, 0.72)";
    ctx.fillRect(startX + (i / quotes.length) * span, baseY - barH, span / quotes.length - 10, barH);
  }
  ctx.restore();
}

window.addEventListener("resize", resize);
resize();
formatClock();
renderQuotes();
rotateHeadline();
loadPublicQuoteSnapshot();
connectFinnhub();

setInterval(formatClock, 1000);
setInterval(tick, 1200);
setInterval(rotateActive, 9000);
setInterval(rotateHeadline, 11000);
setInterval(loadPublicQuoteSnapshot, PUBLIC_QUOTES_REFRESH_MS);

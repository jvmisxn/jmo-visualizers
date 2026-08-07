const QUOTES = [
  { symbol: "SPY", name: "S&P 500 ETF", price: 548.42, drift: 0.012, group: "index" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", price: 475.18, drift: 0.018, group: "index" },
  { symbol: "DIA", name: "Dow 30 ETF", price: 402.31, drift: -0.004, group: "index" },
  { symbol: "IWM", name: "Russell 2000 ETF", price: 218.54, drift: 0.006, group: "index" },
  { symbol: "AAPL", name: "Apple", price: 224.91, drift: 0.01, group: "watch" },
  { symbol: "NVDA", name: "NVIDIA", price: 121.66, drift: 0.026, group: "watch" },
  { symbol: "MSFT", name: "Microsoft", price: 419.88, drift: 0.008, group: "watch" },
  { symbol: "TSLA", name: "Tesla", price: 238.75, drift: -0.015, group: "watch" },
  { symbol: "BTC", name: "Bitcoin", price: 68420, drift: 0.021, group: "watch" },
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

const PUBLIC_QUOTES_URL = "https://raw.githubusercontent.com/jvmisxn/jmo-visualizers/main/market-data/quotes.json";
const PUBLIC_QUOTES_REFRESH_MS = 60000;
const MARKET_PROXY_URL = window.JMO_MARKET_PROXY_URL || "";

const HEADLINES = [
  "Tech leads the tape while small caps try to hold the morning bid.",
  "Rates, crude, mega-cap momentum, and crypto are driving the current scan.",
  "Market breadth is mixed as traders rotate between growth and defensives.",
  "Energy and semis are setting the pace in this market scan.",
  "Futures tone remains active; watch volatility into the next data print.",
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
  quote.open = quote.price;
  quote.change = 0;
  series.set(quote.symbol, seedSeries(quote.price));
}

function seedSeries(base) {
  const values = [];
  let value = base;
  for (let i = 0; i < 160; i += 1) {
    value *= 1 + (Math.sin(i * 0.19) * 0.0007) + ((Math.random() - 0.5) * 0.0018);
    values.push(value);
  }
  return values;
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
  const state = marketState();
  const allowLocalDrift = state === "MARKET OPEN";
  for (const quote of QUOTES) {
    if (liveMode && Date.now() - (quote.lastTradeAt || 0) < 12000) continue;
    if (!liveMode && !allowLocalDrift) continue;
    const mood = Math.sin(Date.now() / 22000 + quote.symbol.charCodeAt(0)) * 0.0009;
    const randomWalk = (Math.random() - 0.48) * 0.0032;
    quote.price *= 1 + quote.drift / 10000 + mood + randomWalk;
    quote.change = ((quote.price - quote.open) / quote.open) * 100;

    const values = series.get(quote.symbol);
    values.push(quote.price);
    if (values.length > 180) values.shift();
  }
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
    if (!lastSnapshotAt) els.headlineSource.textContent = "SIMULATED TAPE";
  }
}

function applyQuoteSnapshot(quote, quoteData) {
  quote.price = quoteData.price;
  quote.change = Number.isFinite(quoteData.changePercent) ? quoteData.changePercent : 0;
  quote.open = quote.change === -100 ? quote.price : quote.price / (1 + quote.change / 100);
  quote.lastSnapshotAt = Date.now();

  const values = seedSeries(quote.price);
  values[values.length - 1] = quote.price;
  series.set(quote.symbol, values);
}

function renderQuotes() {
  const active = QUOTES[activeIndex];
  els.activeSymbol.textContent = active.symbol;
  els.activeName.textContent = active.name;
  els.activePrice.textContent = formatPrice(active);
  els.activeChange.textContent = `${active.change >= 0 ? "+" : ""}${active.change.toFixed(2)}%`;
  setDirectionClass(els.activeChange, active.change);

  els.indices.innerHTML = QUOTES.filter((quote) => quote.group === "index").map(renderQuoteRow).join("");
  els.watchlist.innerHTML = QUOTES.filter((quote) => quote.group === "watch").map(renderQuoteRow).join("");
  els.ticker.innerHTML = QUOTES.map((quote) => {
    const direction = quote.change >= 0 ? "ticker-up" : "ticker-down";
    return `<span>${quote.symbol} ${formatPrice(quote)} <span class="${direction}">${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%</span></span>`;
  }).join("");
}

function renderQuoteRow(quote) {
  const direction = quote.change < 0 ? "down" : "up";
  return `
    <div class="quote-item ${direction}">
      <div class="quote-symbol">${quote.symbol}</div>
      <div class="quote-price">${formatPrice(quote)}</div>
      <div class="quote-change">${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%</div>
    </div>
  `;
}

function setDirectionClass(el, change) {
  el.classList.toggle("down", change < -0.04);
  el.classList.toggle("flat", Math.abs(change) <= 0.04);
}

function formatPrice(quote) {
  if (quote.symbol === "BTC") {
    return `$${Math.round(quote.price).toLocaleString("en-US")}`;
  }
  return `$${quote.price.toFixed(2)}`;
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
    els.headlineSource.textContent = "SIMULATED TAPE";
    return;
  }

  try {
    finnhubSocket = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);
  } catch (error) {
    els.headlineSource.textContent = "SIM FALLBACK";
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
    els.headlineSource.textContent = lastLiveTradeAt ? "LIVE PAUSED" : "SIM FALLBACK";
    setTimeout(connectFinnhub, 15000);
  });

  finnhubSocket.addEventListener("error", () => {
    els.headlineSource.textContent = lastLiveTradeAt ? "LIVE DEGRADED" : "SIM FALLBACK";
  });
}

function applyFinnhubTrade(trade) {
  const quote = QUOTES.find((item) => FINNHUB_SYMBOLS.get(item.symbol) === trade.s);
  if (!quote || !Number.isFinite(trade.p)) return;
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
    const x = chartLeft + (index / (values.length - 1)) * (chartRight - chartLeft);
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
  ctx.save();
  const bars = 54;
  const baseY = height * 0.92;
  const maxH = height * 0.14;
  const startX = width * 0.08;
  const span = width * 0.64;
  for (let i = 0; i < bars; i += 1) {
    const pulse = 0.28 + Math.abs(Math.sin(Date.now() / 900 + i * 0.7)) * 0.72;
    const barH = maxH * pulse;
    ctx.fillStyle = i % 5 === 0 ? "rgba(255, 216, 107, 0.72)" : "rgba(123, 231, 255, 0.46)";
    ctx.fillRect(startX + (i / bars) * span, baseY - barH, span / bars - 4, barH);
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

import { mkdir, writeFile } from "node:fs/promises";

const AIRPORT_OUTPUT = new URL("../airport-channel/data.json", import.meta.url);
const SHOPPING_OUTPUT = new URL("../retro-shopping/products.json", import.meta.url);

const AIRPORT = {
  icao: "KSEA",
  iata: "SEA",
  name: "Seattle-Tacoma Intl",
};

const SHOP_FEED_URL =
  process.env.SHOP_FEED_URL || "https://shop.fourthwall.com/collections/all.json";

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "jmo-visualizers/1.0 live data snapshot",
      accept: options.accept || "*/*",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, { ...options, accept: "application/json" });
  return JSON.parse(text);
}

function textBetween(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function parseAirportEvents(xml) {
  const events = [];
  const sectionRe = /<Delay_type>([\s\S]*?)<\/Delay_type>/gi;
  let sectionMatch;
  while ((sectionMatch = sectionRe.exec(xml))) {
    const section = sectionMatch[1];
    const type = textBetween(section, "Name") || "FAA STATUS";
    const airportRe = /<Airport>([\s\S]*?)<\/Airport>/gi;
    let airportMatch;
    while ((airportMatch = airportRe.exec(section))) {
      const airport = airportMatch[1];
      const code = textBetween(airport, "ARPT");
      if (code !== AIRPORT.iata && code !== AIRPORT.icao) continue;
      events.push({
        type,
        airport: code,
        reason: textBetween(airport, "Reason"),
        start: textBetween(airport, "Start"),
        end: textBetween(airport, "End") || textBetween(airport, "Reopen"),
        minDelay: textBetween(airport, "Min_Delay"),
        maxDelay: textBetween(airport, "Max_Delay"),
        trend: textBetween(airport, "Trend"),
      });
    }
  }
  return events;
}

function parseMetar(raw) {
  const wind = raw.match(/(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT/);
  const vis = raw.match(/ (\d{1,2}(?: \d\/\d)?|\d\/\d)SM /);
  const tempDew = raw.match(/ (M?\d{2})\/(M?\d{2}) /);
  const alt = raw.match(/ A(\d{4})/);
  const ceil = raw.match(/(BKN|OVC|VV)(\d{3})/);
  const visNum = vis ? Number((vis[1].split(" ")[0] || "10").split("/")[0]) : 10;
  const ceilNum = ceil ? Number(ceil[2]) * 100 : 99999;
  const category =
    ceilNum < 500 || visNum < 1 ? "LIFR" :
    ceilNum < 1000 || visNum < 3 ? "IFR" :
    ceilNum <= 3000 || visNum <= 5 ? "MVFR" : "VFR";

  return {
    raw,
    wind: wind
      ? `${wind[1]} deg @ ${Number(wind[2])}${wind[4] ? ` G ${Number(wind[4])}` : ""} kt`
      : "CALM",
    visibility: vis ? `${vis[1]} SM` : "10+ SM",
    tempDew: tempDew
      ? `${tempDew[1].replace("M", "-")} / ${tempDew[2].replace("M", "-")} C`
      : null,
    altimeter: alt ? `${(Number(alt[1]) / 100).toFixed(2)} inHg` : null,
    ceiling: ceil ? `${Number(ceil[2]) * 100} FT` : "UNL",
    category,
  };
}

async function airportSnapshot() {
  const [metarResult, tafResult, statusResult] = await Promise.allSettled([
    fetchJson(`https://aviationweather.gov/api/data/metar?format=json&ids=${AIRPORT.icao}`),
    fetchJson(`https://aviationweather.gov/api/data/taf?format=json&ids=${AIRPORT.icao}`),
    fetchText("https://nasstatus.faa.gov/api/airport-status-information"),
  ]);

  const metarRaw =
    metarResult.status === "fulfilled" && Array.isArray(metarResult.value)
      ? metarResult.value[0]?.rawOb
      : null;
  const tafRaw =
    tafResult.status === "fulfilled" && Array.isArray(tafResult.value)
      ? tafResult.value[0]?.rawTAF
      : null;

  return {
    provider: "FAA NAS Status + NOAA AviationWeather",
    generatedAt: Date.now(),
    airport: AIRPORT,
    metar: metarRaw ? parseMetar(metarRaw) : null,
    taf: tafRaw || null,
    faa: {
      updateTime:
        statusResult.status === "fulfilled"
          ? textBetween(statusResult.value, "Update_Time")
          : null,
      events:
        statusResult.status === "fulfilled"
          ? parseAirportEvents(statusResult.value)
          : [],
      available: statusResult.status === "fulfilled",
    },
  };
}

function normalizeProduct(product, shopUrl) {
  const price =
    product.price?.cents ? product.price.cents / 100 :
    Number.parseFloat(product.price || product.sale_price || "NaN");
  const compareAt = Number.parseFloat(product.compare_at_price || "NaN");
  const image = product.image || product.images?.[0]?.src || product.featured_image;
  const url = product.url?.startsWith("http")
    ? product.url
    : new URL(product.url || `/products/${product.handle || product.id}`, shopUrl).href;

  return {
    id: product.id || product.handle || product.title,
    title: product.title || product.name,
    subtitle: product.subtitle || product.product_type || "",
    price: Number.isFinite(price) ? price : null,
    compareAt: Number.isFinite(compareAt) ? compareAt : null,
    available: product.available !== false,
    image,
    url,
    updatedAt: product.updated_at || null,
    variants: Array.isArray(product.variants) ? product.variants.length : null,
  };
}

async function shoppingSnapshot() {
  const feed = await fetchJson(SHOP_FEED_URL);
  const shopUrl = new URL(SHOP_FEED_URL).origin;
  const products = (feed.products || feed.items || [])
    .map((product) => normalizeProduct(product, shopUrl))
    .filter((product) => product.title && product.price !== null);

  return {
    provider: "Fourthwall public collection JSON",
    sourceUrl: SHOP_FEED_URL,
    generatedAt: Date.now(),
    collection: feed.title || feed.handle || "All Products",
    products,
  };
}

await mkdir(new URL("../airport-channel/", import.meta.url), { recursive: true });
await mkdir(new URL("../retro-shopping/", import.meta.url), { recursive: true });
await writeFile(AIRPORT_OUTPUT, `${JSON.stringify(await airportSnapshot(), null, 2)}\n`);
await writeFile(SHOPPING_OUTPUT, `${JSON.stringify(await shoppingSnapshot(), null, 2)}\n`);

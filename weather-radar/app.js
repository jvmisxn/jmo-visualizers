const STOPS = [
  { name: "Seattle and Puget Sound", lat: 47.6062, lon: -122.3321, zoom: 7, mode: "LOCAL FORECAST" },
  { name: "Pacific Northwest", lat: 45.9, lon: -121.5, zoom: 6, mode: "REGIONAL SCAN" },
  { name: "Northern California", lat: 38.6, lon: -121.5, zoom: 6, mode: "WEST COAST" },
  { name: "Central Plains", lat: 39.2, lon: -97.2, zoom: 5, mode: "NATIONAL RADAR" },
  { name: "Great Lakes", lat: 42.6, lon: -84.8, zoom: 5, mode: "REGIONAL SCAN" },
  { name: "Gulf Coast", lat: 29.7, lon: -90.4, zoom: 6, mode: "GULF WATCH" },
  { name: "Florida Peninsula", lat: 27.6, lon: -81.7, zoom: 6, mode: "TROPICS WATCH" },
  { name: "Western Atlantic", lat: 25.7, lon: -72.5, zoom: 5, mode: "TROPICS WATCH" },
];

const WEATHER_CODES = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorms",
  96: "Thunderstorms",
  99: "Severe storms",
};

const els = {
  clock: document.querySelector("#clock"),
  mode: document.querySelector("#mode"),
  region: document.querySelector("#region"),
  temp: document.querySelector("#temperature"),
  condition: document.querySelector("#condition"),
  wind: document.querySelector("#wind"),
  precip: document.querySelector("#precip"),
  updated: document.querySelector("#updated"),
  daily: document.querySelector("#daily"),
  viewing: document.querySelector("#now-viewing"),
  summary: document.querySelector("#summary"),
  radar: document.querySelector("#radar-stamp"),
  ticker: document.querySelector("#ticker-text"),
};

const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  tap: false,
}).setView([STOPS[0].lat, STOPS[0].lon], STOPS[0].zoom);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 10,
  minZoom: 4,
  opacity: 0.92,
}).addTo(map);

const RADAR_REFRESH_MS = 300000;

const radarLayer = L.tileLayer.wms("https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows", {
  layers: "conus_bref_qcd",
  format: "image/png",
  transparent: true,
  opacity: 0.52,
  ts: Math.floor(Date.now() / RADAR_REFRESH_MS),
}).addTo(map);

// The WMS layer only fetches tiles when the view changes, so a long-running
// OBS source would keep showing cached radar. Rolling the ts param forces a
// re-fetch of current imagery.
function refreshRadar() {
  radarLayer.setParams({ ts: Math.floor(Date.now() / RADAR_REFRESH_MS) });
}

const FETCH_TIMEOUT_MS = 15000;

let stopIndex = 0;
let lastAlertCount = 0;
let requestSeq = 0;
let retryTimer = 0;
const RETRY_DELAY_MS = 20000;

function updateClock() {
  const now = new Date();
  els.clock.textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now).replace(" ", "") + " PT";
}

function fmtTemp(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}°`;
}

function fmtWind(value) {
  if (!Number.isFinite(value)) return "Wind --";
  return `Wind ${Math.round(value)} mph`;
}

function shortDate(value, index) {
  const date = new Date(`${value}T12:00:00Z`);
  if (index === 0) return "TODAY";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })
    .format(date)
    .toUpperCase();
}

async function fetchWeather(stop) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: stop.lat,
    longitude: stop.lon,
    current: "temperature_2m,precipitation,weather_code,wind_speed_10m,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "4",
  });

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`weather ${response.status}`);
  return response.json();
}

function isNightFromWeather(weather) {
  if (isNightInPacificTime()) return true;
  const isDay = weather.current?.is_day;
  if (isDay === 0) return true;
  if (isDay === 1) return false;
  return false;
}

function isNightInPacificTime() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return Number.isFinite(hour) && (hour >= 19 || hour < 7);
}

function applyDayPart(isNight) {
  document.body.classList.toggle("night-mode", isNight);
}

async function fetchAlerts(stop) {
  const point = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
  const url = `https://api.weather.gov/alerts/active?point=${point}`;
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.features) ? data.features.slice(0, 4) : [];
}

function renderWeather(stop, weather, alerts) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const condition = WEATHER_CODES[current.weather_code] || "Weather update";
  const rain = Number.isFinite(current.precipitation) ? `${current.precipitation.toFixed(2)} in` : "--";
  const isNight = isNightFromWeather(weather);

  lastAlertCount = alerts.length;
  applyDayPart(isNight);
  document.body.classList.toggle("alert-mode", alerts.length > 0);
  els.mode.textContent = alerts.length ? "STORM WATCH" : isNight ? "NIGHT SCAN" : stop.mode;
  els.region.textContent = stop.name;
  els.temp.textContent = fmtTemp(current.temperature_2m);
  els.condition.textContent = condition;
  els.wind.textContent = fmtWind(current.wind_speed_10m);
  els.precip.textContent = `Rain ${rain}`;
  els.updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  els.daily.innerHTML = "";
  for (let i = 0; i < Math.min(4, daily.time?.length || 0); i += 1) {
    const row = document.createElement("div");
    const label = shortDate(daily.time[i], i);
    const hi = fmtTemp(daily.temperature_2m_max?.[i]);
    const lo = fmtTemp(daily.temperature_2m_min?.[i]);
    const pop = Number.isFinite(daily.precipitation_probability_max?.[i])
      ? `${Math.round(daily.precipitation_probability_max[i])}%`
      : "--";
    row.innerHTML = `<span>${label}</span><span>${hi} / ${lo} &nbsp; ${pop}</span>`;
    els.daily.appendChild(row);
  }

  els.viewing.textContent = alerts.length ? "ALERTS ACTIVE" : "NOW VIEWING";
  const alertText = alerts.map((alert) => alert.properties?.event).filter(Boolean).join(" / ");
  els.summary.textContent = alerts.length
    ? alertText
    : `${isNight ? "Night conditions" : condition} near ${stop.name}. ${fmtWind(current.wind_speed_10m)}.`;

  els.radar.textContent = alerts.length ? `${alerts.length} ALERT${alerts.length > 1 ? "S" : ""}` : "RADAR: LIVE";
  els.ticker.textContent = [
    alerts.length ? `ALERTS: ${alertText}` : `${stop.name}: ${condition}, ${fmtTemp(current.temperature_2m)}, ${fmtWind(current.wind_speed_10m)}`,
    "DATA: NOAA/NWS alerts, NOAA radar, Open-Meteo forecast, CARTO/OpenStreetMap",
    "JMO WEATHER SCAN",
  ].join("     •     ");
}

function renderFallback(stop, error) {
  document.body.classList.remove("alert-mode");
  // Keep the current day/night theme on transient failures instead of
  // flashing back to the day palette at night.
  applyDayPart(isNightInPacificTime());
  els.mode.textContent = stop.mode;
  els.region.textContent = stop.name;
  els.temp.textContent = "--";
  els.condition.textContent = "Data update pending";
  els.wind.textContent = "Wind --";
  els.precip.textContent = "Rain --";
  els.updated.textContent = "Retrying";
  els.daily.innerHTML = "";
  els.summary.textContent = `Scanning ${stop.name}`;
  els.radar.textContent = "RADAR: LIVE";
  els.ticker.textContent = `DATA REFRESH PENDING: ${error.message}     •     NOAA/NWS, Open-Meteo, CARTO/OpenStreetMap`;
}

// Fetches and renders data only; never moves the map. The periodic refresh
// and error retries reuse this so they can't cancel an in-flight flyTo glide
// (setView during flyTo snaps the camera).
async function loadStopData(index) {
  const stop = STOPS[index % STOPS.length];
  const seq = ++requestSeq;

  // A slow response for a previous stop can land after the rotation has moved
  // on; only the most recent request is allowed to touch the panel.
  try {
    const [weather, alerts] = await Promise.all([fetchWeather(stop), fetchAlerts(stop)]);
    if (seq !== requestSeq) return;
    renderWeather(stop, weather, alerts);
  } catch (error) {
    if (seq !== requestSeq) return;
    renderFallback(stop, error);
    // The panel says "Retrying", so actually retry well before the next
    // 90s rotation; the seq guard drops the retry if rotation moved on.
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (seq === requestSeq) loadStopData(index);
    }, RETRY_DELAY_MS);
  }
}

function setStop(index, instant = false) {
  const stop = STOPS[index % STOPS.length];
  if (instant) {
    map.setView([stop.lat, stop.lon], stop.zoom);
  } else {
    map.flyTo([stop.lat, stop.lon], stop.zoom, { duration: 8, easeLinearity: 0.12 });
  }
  return loadStopData(index);
}

function nextStop() {
  stopIndex = (stopIndex + 1) % STOPS.length;
  setStop(stopIndex);
}

updateClock();
setInterval(updateClock, 1000);
setStop(stopIndex, true);
setInterval(nextStop, 90000);
setInterval(() => loadStopData(stopIndex), 300000);
setInterval(refreshRadar, RADAR_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshRadar();
});

setInterval(() => {
  const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (lastAlertCount === 0) els.radar.textContent = `RADAR: ${stamp}`;
}, 30000);

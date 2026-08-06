const STOPS = [
  { name: "Seattle and Puget Sound", lat: 47.6062, lon: -122.3321, zoom: 8, mode: "LOCAL FORECAST", noaa: true },
  { name: "Pacific Northwest", lat: 45.9, lon: -121.5, zoom: 7, mode: "REGIONAL SCAN", noaa: true },
  { name: "Northern California", lat: 38.6, lon: -121.5, zoom: 7, mode: "WEST COAST", noaa: true },
  { name: "Central Plains", lat: 39.2, lon: -97.2, zoom: 6, mode: "NATIONAL RADAR", noaa: true },
  { name: "Great Lakes", lat: 42.6, lon: -84.8, zoom: 6, mode: "REGIONAL SCAN", noaa: true },
  { name: "Gulf Coast", lat: 29.7, lon: -90.4, zoom: 7, mode: "GULF WATCH", noaa: true },
  { name: "Florida Peninsula", lat: 27.6, lon: -81.7, zoom: 7, mode: "TROPICS WATCH", noaa: true },
  { name: "Western Europe", lat: 50.1, lon: 4.4, zoom: 6, mode: "WORLD SCAN" },
  { name: "Mediterranean", lat: 41.9, lon: 12.5, zoom: 6, mode: "WORLD SCAN" },
  { name: "Japan and Korea", lat: 35.7, lon: 139.7, zoom: 6, mode: "PACIFIC SCAN" },
  { name: "Eastern Australia", lat: -33.9, lon: 151.2, zoom: 6, mode: "WORLD SCAN" },
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

const BASEMAPS = {
  dayBase: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
  dayLabels: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
  nightBase: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  nightLabels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
};

const baseLayerOptions = {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 10,
  minZoom: 2,
};

const baseDayLayer = L.tileLayer(BASEMAPS.dayBase, {
  ...baseLayerOptions,
  opacity: 0.98,
}).addTo(map);

const baseNightLayer = L.tileLayer(BASEMAPS.nightBase, {
  ...baseLayerOptions,
  opacity: 0,
}).addTo(map);

const RADAR_REFRESH_MS = 300000;
const RADAR_ANIMATION_REFRESH_MS = 600000;
const RADAR_FRAME_MS = 1400;
const RADAR_MAX_FRAMES = 6;
const RAINVIEWER_COLOR_SCHEME = 4;
const STOP_DWELL_MS = 65000;
const CAMERA_GLIDE_SECONDS = 52;
const INITIAL_GLIDE_DELAY_MS = 6000;
const REGION_DETAIL_ROTATE_MS = 11000;

map.createPane("radarPane");
map.getPane("radarPane").style.zIndex = 360;
map.createPane("labelPane");
map.getPane("labelPane").style.zIndex = 430;
map.getPane("labelPane").style.pointerEvents = "none";

const labelLayerOptions = {
  subdomains: "abcd",
  maxZoom: 10,
  minZoom: 2,
  pane: "labelPane",
};

const labelDayLayer = L.tileLayer(BASEMAPS.dayLabels, {
  ...labelLayerOptions,
  opacity: 0.98,
}).addTo(map);

const labelNightLayer = L.tileLayer(BASEMAPS.nightLabels, {
  ...labelLayerOptions,
  opacity: 0,
}).addTo(map);

const radarLayer = L.tileLayer.wms("https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows", {
  layers: "conus_bref_qcd",
  format: "image/png",
  transparent: true,
  opacity: 0.3,
  pane: "radarPane",
  bounds: L.latLngBounds([24.5, -127], [50.5, -66]),
  ts: Math.floor(Date.now() / RADAR_REFRESH_MS),
}).addTo(map);

let radarFrames = [];
let radarFrameLayers = [];
let radarFrameIndex = 0;
let radarAnimationTimer = 0;
let radarAnimationLoadedAt = 0;
let radarFrameSignature = "";

// The WMS layer only fetches tiles when the view changes, so a long-running
// OBS source would keep showing cached radar. Rolling the ts param forces a
// re-fetch of current imagery.
function refreshRadar() {
  radarLayer.setParams({ ts: Math.floor(Date.now() / RADAR_REFRESH_MS) });
  updateRadarLayerForStop();
  loadAnimatedRadar();
}

async function loadAnimatedRadar() {
  try {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`radar animation ${response.status}`);
    const data = await response.json();
    const frames = [
      ...(data.radar?.past || []),
      ...(data.radar?.nowcast || []),
    ].slice(-RADAR_MAX_FRAMES);
    if (!data.host || frames.length < 2) throw new Error("radar animation unavailable");
    setAnimatedRadarFrames(data.host, frames);
  } catch (error) {
    // A transient RainViewer failure must not stack the static layer on top
    // of an animation loop that is still cycling its last good frames.
    if (radarFrames.length < 2) {
      updateRadarLayerForStop();
      els.radar.textContent = "RADAR: LIVE";
    }
  }
}

function setAnimatedRadarFrames(host, frames) {
  radarAnimationLoadedAt = Date.now();

  // RainViewer publishes new frames roughly every 10 minutes but this reloads
  // every 5; rebuilding the layers with an identical frame list blanks the
  // radar while every tile refetches, so keep the running loop instead.
  const signature = frames.map((frame) => `${host}${frame.path}`).join("|");
  if (signature === radarFrameSignature && radarFrameLayers.length === frames.length) return;
  radarFrameSignature = signature;

  clearInterval(radarAnimationTimer);
  radarAnimationTimer = 0;

  radarFrameIndex = 0;
  radarFrames = frames.map((frame, index) => ({
    time: frame.time,
    url: `${host}${frame.path}/512/{z}/{x}/{y}/${RAINVIEWER_COLOR_SCHEME}/1_1.png`,
  }));

  // One preloaded layer per frame, toggled via opacity. Swapping a single
  // layer's URL discards its tiles and refetches every 1.4s frame advance,
  // which blanks the radar while tiles stream back in.
  radarFrameLayers.forEach((layer) => map.removeLayer(layer));
  radarFrameLayers = radarFrames.map((frame, index) => L.tileLayer(frame.url, {
    opacity: index === 0 ? 0.74 : 0,
    pane: "radarPane",
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 10,
    minZoom: 4,
  }).addTo(map));

  updateRadarLayerForStop();
  radarAnimationTimer = setInterval(showNextRadarFrame, RADAR_FRAME_MS);
  updateRadarStamp();
}

function showNextRadarFrame() {
  if (radarFrames.length < 2 || radarFrameLayers.length < 2) return;
  radarFrameLayers[radarFrameIndex].setOpacity(0);
  radarFrameIndex = (radarFrameIndex + 1) % radarFrameLayers.length;
  radarFrameLayers[radarFrameIndex].setOpacity(0.74);
  updateRadarStamp();
}

function updateRadarStamp() {
  if (lastAlertCount > 0) return;
  if (radarFrames.length >= 2) {
    const frame = radarFrames[radarFrameIndex];
    const stamp = new Date(frame.time * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    els.radar.textContent = `RADAR LOOP: ${stamp}`;
    return;
  }
  const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  els.radar.textContent = `RADAR: ${stamp}`;
}

const FETCH_TIMEOUT_MS = 15000;

let stopIndex = 0;
let lastAlertCount = 0;
let detailIndex = 0;
let lastRendered = null;
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

function fmtShortWind(value) {
  if (!Number.isFinite(value)) return "wind --";
  return `wind ${Math.round(value)} mph`;
}

function fmtPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function fmtPressure(value) {
  if (!Number.isFinite(value)) return "Pressure --";
  return `Pressure ${Math.round(value)} mb`;
}

function fmtVisibility(value) {
  if (!Number.isFinite(value)) return "Visibility --";
  return `Visibility ${Math.round(value / 1609.344)} mi`;
}

function fmtClock(value) {
  if (!value) return "--";
  const match = /T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "--";
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

function shortDate(value, index) {
  const date = new Date(`${value}T12:00:00Z`);
  if (index === 0) return "TODAY";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })
    .format(date)
    .toUpperCase();
}

function summarizeAlerts(alerts) {
  const counts = new Map();
  for (const alert of alerts) {
    const event = alert.properties?.event;
    if (!event) continue;
    counts.set(event, (counts.get(event) || 0) + 1);
  }
  const parts = Array.from(counts.entries()).map(([event, count]) => (
    count > 1 ? `${event} (${count})` : event
  ));
  return parts.join(" / ");
}

function todayForecastLine(daily, timezone) {
  const hi = fmtTemp(daily.temperature_2m_max?.[0]);
  const lo = fmtTemp(daily.temperature_2m_min?.[0]);
  const pop = Number.isFinite(daily.precipitation_probability_max?.[0])
    ? `${Math.round(daily.precipitation_probability_max[0])}% rain`
    : "rain chance --";
  const sunset = fmtClock(daily.sunset?.[0], timezone);
  return `Today ${hi} / ${lo}. ${pop}. Sunset ${sunset}.`;
}

function tomorrowForecastLine(daily) {
  const hi = fmtTemp(daily.temperature_2m_max?.[1]);
  const lo = fmtTemp(daily.temperature_2m_min?.[1]);
  const pop = Number.isFinite(daily.precipitation_probability_max?.[1])
    ? `${Math.round(daily.precipitation_probability_max[1])}% rain`
    : "rain chance --";
  const code = daily.weather_code?.[1];
  const condition = WEATHER_CODES[code] || "Forecast update";
  return `Tomorrow ${condition}. ${hi} / ${lo}. ${pop}.`;
}

function buildDetailSlides(stop, weather, alerts, condition, isNight) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const alertSummary = summarizeAlerts(alerts);
  const gust = Number.isFinite(current.wind_gusts_10m) && current.wind_gusts_10m > (current.wind_speed_10m || 0) + 2
    ? `, gusts ${Math.round(current.wind_gusts_10m)} mph`
    : "";
  const slides = [];

  if (alerts.length) {
    slides.push({
      kicker: "ALERTS ACTIVE",
      summary: alertSummary || `${alerts.length} weather alerts active`,
      tickerLead: `ALERTS: ${alertSummary || `${alerts.length} active alerts`}`,
    });
  }

  slides.push({
    kicker: isNight ? "NIGHT CONDITIONS" : "CURRENT CONDITIONS",
    summary: `${condition} near ${stop.name}. ${fmtTemp(current.temperature_2m)}, ${fmtShortWind(current.wind_speed_10m)}${gust}.`,
    tickerLead: `${stop.name}: ${condition}, ${fmtTemp(current.temperature_2m)}, ${fmtWind(current.wind_speed_10m)}`,
  });

  slides.push({
    kicker: "LOCAL DETAILS",
    summary: `Feels like ${fmtTemp(current.apparent_temperature)}. Humidity ${fmtPercent(current.relative_humidity_2m)}. Clouds ${fmtPercent(current.cloud_cover)}.`,
    tickerLead: `DETAILS: feels ${fmtTemp(current.apparent_temperature)}, humidity ${fmtPercent(current.relative_humidity_2m)}, clouds ${fmtPercent(current.cloud_cover)}`,
  });

  slides.push({
    kicker: "PRESSURE / VISIBILITY",
    summary: `${fmtPressure(current.pressure_msl)}. ${fmtVisibility(current.visibility)}. Rain ${Number.isFinite(current.precipitation) ? current.precipitation.toFixed(2) : "--"} in.`,
    tickerLead: `OBSERVATION: ${fmtPressure(current.pressure_msl)}, ${fmtVisibility(current.visibility)}`,
  });

  slides.push({
    kicker: "FORECAST SNAPSHOT",
    summary: todayForecastLine(daily, weather.timezone),
    tickerLead: `FORECAST: ${todayForecastLine(daily, weather.timezone)}`,
  });

  slides.push({
    kicker: "NEXT OUTLOOK",
    summary: tomorrowForecastLine(daily),
    tickerLead: `NEXT: ${tomorrowForecastLine(daily)}`,
  });

  slides.push({
    kicker: "RADAR SCAN",
    summary: `${radarFrames.length >= 2 ? "Animated radar loop" : "Radar fallback"} over ${stop.name}. Labels stay above storm cells.`,
    tickerLead: `RADAR: ${radarFrames.length >= 2 ? "animated loop active" : "fallback scan active"} over ${stop.name}`,
  });

  return slides;
}

function renderDetailSlide() {
  if (!lastRendered) return;
  const slides = buildDetailSlides(
    lastRendered.stop,
    lastRendered.weather,
    lastRendered.alerts,
    lastRendered.condition,
    lastRendered.isNight,
  );
  if (!slides.length) return;
  const slide = slides[detailIndex % slides.length];
  els.viewing.textContent = slide.kicker;
  els.summary.textContent = slide.summary;
  els.ticker.textContent = [
    slide.tickerLead,
    "DATA: NOAA/NWS alerts, RainViewer radar, Open-Meteo forecast, CARTO/OpenStreetMap",
    "JMO WEATHER SCAN",
  ].join("     •     ");
}

function advanceDetailSlide() {
  if (!lastRendered) return;
  detailIndex += 1;
  renderDetailSlide();
}

async function fetchWeather(stop) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: stop.lat,
    longitude: stop.lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,pressure_msl,visibility,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset",
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
  const isDay = weather.current?.is_day;
  if (isDay === 0) return true;
  if (isDay === 1) return false;
  return isNightInPacificTime();
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
  baseDayLayer.setOpacity(isNight ? 0.18 : 0.98);
  baseNightLayer.setOpacity(isNight ? 0.92 : 0);
  labelDayLayer.setOpacity(isNight ? 0.08 : 0.98);
  labelNightLayer.setOpacity(isNight ? 0.98 : 0);
}

function currentStopSupportsNoaa() {
  return Boolean(STOPS[stopIndex % STOPS.length]?.noaa);
}

function updateRadarLayerForStop() {
  if (radarFrames.length >= 2) {
    radarLayer.setOpacity(0);
    return;
  }
  radarLayer.setOpacity(currentStopSupportsNoaa() ? 0.64 : 0);
}

async function fetchAlerts(stop) {
  if (!stop.noaa) return [];
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

  detailIndex = 0;
  lastRendered = { stop, weather, alerts, condition, isNight };
  renderDetailSlide();

  // Don't stomp the animated loop's frame stamp on every weather render;
  // updateRadarStamp knows whether a loop is running.
  if (alerts.length) {
    els.radar.textContent = `${alerts.length} ALERT${alerts.length > 1 ? "S" : ""}`;
  } else {
    updateRadarStamp();
  }
}

function renderFallback(stop, error) {
  // A stale alert count from the previous stop would keep suppressing the
  // radar loop stamp even though alert-mode is being cleared here.
  lastAlertCount = 0;
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
  updateRadarStamp();
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
    // Alerts are a decoration on top of the forecast; a flaky NWS response
    // (timeout/network error throws past the !ok guard) must not blank the
    // whole panel when the forecast itself succeeded.
    const [weather, alerts] = await Promise.all([
      fetchWeather(stop),
      fetchAlerts(stop).catch(() => []),
    ]);
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
  updateRadarLayerForStop();
  if (instant) {
    map.setView([stop.lat, stop.lon], stop.zoom);
  } else {
    map.flyTo([stop.lat, stop.lon], stop.zoom, {
      duration: CAMERA_GLIDE_SECONDS,
      easeLinearity: 0.04,
      noMoveStart: true,
    });
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
loadAnimatedRadar();
setTimeout(nextStop, INITIAL_GLIDE_DELAY_MS);
setInterval(nextStop, STOP_DWELL_MS);
setInterval(() => loadStopData(stopIndex), 300000);
setInterval(refreshRadar, RADAR_REFRESH_MS);
setInterval(loadAnimatedRadar, RADAR_ANIMATION_REFRESH_MS);
setInterval(advanceDetailSlide, REGION_DETAIL_ROTATE_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshRadar();
    if (Date.now() - radarAnimationLoadedAt > RADAR_ANIMATION_REFRESH_MS) loadAnimatedRadar();
  }
});

setInterval(() => {
  updateRadarStamp();
}, 30000);

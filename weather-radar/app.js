// `phrase` is the name as it reads mid-sentence: panel chips and ticker labels
// air the bare name, but spoken-style copy needs the article ("across the
// Pacific Northwest", not "near Pacific Northwest").
const STOPS = [
  { name: "Seattle and Puget Sound", lat: 47.6062, lon: -122.3321, zoom: 8, mode: "LOCAL FORECAST", noaa: true },
  { name: "Pacific Northwest", phrase: "the Pacific Northwest", lat: 45.9, lon: -121.5, zoom: 7, mode: "REGIONAL SCAN", noaa: true },
  { name: "Northern California", lat: 38.6, lon: -121.5, zoom: 7, mode: "WEST COAST", noaa: true },
  { name: "Central Plains", phrase: "the Central Plains", lat: 39.2, lon: -97.2, zoom: 6, mode: "NATIONAL RADAR", noaa: true },
  { name: "Great Lakes", phrase: "the Great Lakes", lat: 42.6, lon: -84.8, zoom: 6, mode: "REGIONAL SCAN", noaa: true },
  { name: "Gulf Coast", phrase: "the Gulf Coast", lat: 29.7, lon: -90.4, zoom: 7, mode: "GULF WATCH", noaa: true },
  { name: "Florida Peninsula", phrase: "the Florida Peninsula", lat: 27.6, lon: -81.7, zoom: 7, mode: "TROPICS WATCH", noaa: true },
  { name: "Western Europe", lat: 50.1, lon: 4.4, zoom: 6, mode: "WORLD SCAN" },
  { name: "Mediterranean", phrase: "the Mediterranean", lat: 41.9, lon: 12.5, zoom: 6, mode: "WORLD SCAN" },
  { name: "Japan and Korea", lat: 35.7, lon: 139.7, zoom: 6, mode: "PACIFIC SCAN" },
  { name: "Eastern Australia", lat: -33.9, lon: 151.2, zoom: 6, mode: "WORLD SCAN" },
  { name: "Western Atlantic", phrase: "the Western Atlantic", lat: 25.7, lon: -72.5, zoom: 5, mode: "TROPICS WATCH" },
];

function stopPhrase(stop) {
  return stop.phrase || stop.name;
}

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
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorms",
  96: "Thunderstorms",
  99: "Severe storms",
};

const CAMERA_SETS = {
  "Seattle and Puget Sound": [
    { location: "SR-99 at S Walker St", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/099vc02969.jpg" },
    { location: "SR-99 at S Lander St", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/099vc02946.jpg" },
    { location: "SR-99 at S Atlantic St", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/099vc03022.jpg" },
    { location: "SR-99 at Royal Brougham", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/099vc03037.jpg" },
    { location: "I-90 at Rainier Ave S", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/090vc00329.jpg" },
    { location: "I-90 at East Portal MBT", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/090vc00422.jpg" },
  ],
  "Pacific Northwest": [
    { location: "I-90 at W Mercer Way", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/090vc00604.jpg" },
    { location: "I-90 at 76th Ave SE", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/090vc00670.jpg" },
    { location: "I-90 at Bellevue Way", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/090vc00921.jpg" },
    { location: "I-90 at SR-900", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/090vc01581.jpg" },
    { location: "SR-167 at S 212th St", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/167vc02241.jpg" },
    { location: "SR-167 at S 194th St", source: "WSDOT", url: "https://images.wsdot.wa.gov/nw/167vc02352.jpg" },
  ],
};

// Classic TWC regional-observations look: a handful of city temps plotted on
// the map itself. Curated per stop so chips stay spread out at that stop's
// zoom — two cities closer than ~a chip width would overlap and smear.
const CITY_TEMP_SETS = {
  "Seattle and Puget Sound": [
    { name: "SEATTLE", lat: 47.6062, lon: -122.3321 },
    { name: "TACOMA", lat: 47.2529, lon: -122.4443 },
    { name: "EVERETT", lat: 47.979, lon: -122.2021 },
    { name: "OLYMPIA", lat: 47.0379, lon: -122.9007 },
  ],
  "Pacific Northwest": [
    { name: "SEATTLE", lat: 47.6062, lon: -122.3321 },
    { name: "PORTLAND", lat: 45.5152, lon: -122.6784 },
    { name: "SPOKANE", lat: 47.6588, lon: -117.426 },
    { name: "EUGENE", lat: 44.0521, lon: -123.0868 },
    { name: "BOISE", lat: 43.615, lon: -116.2023 },
  ],
  "Northern California": [
    { name: "SAN FRANCISCO", lat: 37.7749, lon: -122.4194 },
    { name: "SACRAMENTO", lat: 38.5816, lon: -121.4944 },
    { name: "REDDING", lat: 40.5865, lon: -122.3917 },
    { name: "RENO", lat: 39.5296, lon: -119.8138 },
    { name: "FRESNO", lat: 36.7378, lon: -119.7871 },
  ],
  "Central Plains": [
    { name: "KANSAS CITY", lat: 39.0997, lon: -94.5786 },
    { name: "OKLAHOMA CITY", lat: 35.4676, lon: -97.5164 },
    { name: "OMAHA", lat: 41.2565, lon: -95.9345 },
    { name: "WICHITA", lat: 37.6872, lon: -97.3301 },
    { name: "DENVER", lat: 39.7392, lon: -104.9903 },
  ],
  "Great Lakes": [
    { name: "CHICAGO", lat: 41.8781, lon: -87.6298 },
    { name: "DETROIT", lat: 42.3314, lon: -83.0458 },
    { name: "CLEVELAND", lat: 41.4993, lon: -81.6944 },
    { name: "MILWAUKEE", lat: 43.0389, lon: -87.9065 },
    { name: "TORONTO", lat: 43.6532, lon: -79.3832 },
  ],
  "Gulf Coast": [
    { name: "HOUSTON", lat: 29.7604, lon: -95.3698 },
    { name: "NEW ORLEANS", lat: 29.9511, lon: -90.0715 },
    { name: "BATON ROUGE", lat: 30.4515, lon: -91.1871 },
    { name: "PENSACOLA", lat: 30.4213, lon: -87.2169 },
  ],
  "Florida Peninsula": [
    { name: "TAMPA", lat: 27.9506, lon: -82.4572 },
    { name: "ORLANDO", lat: 28.5383, lon: -81.3792 },
    { name: "MIAMI", lat: 25.7617, lon: -80.1918 },
    { name: "JACKSONVILLE", lat: 30.3322, lon: -81.6557 },
  ],
  "Western Europe": [
    { name: "LONDON", lat: 51.5074, lon: -0.1278 },
    { name: "PARIS", lat: 48.8566, lon: 2.3522 },
    { name: "AMSTERDAM", lat: 52.3676, lon: 4.9041 },
    { name: "FRANKFURT", lat: 50.1109, lon: 8.6821 },
  ],
  "Mediterranean": [
    { name: "ROME", lat: 41.9028, lon: 12.4964 },
    { name: "BARCELONA", lat: 41.3874, lon: 2.1686 },
    { name: "ATHENS", lat: 37.9838, lon: 23.7275 },
    { name: "TUNIS", lat: 36.8065, lon: 10.1815 },
  ],
  "Japan and Korea": [
    { name: "TOKYO", lat: 35.6762, lon: 139.6503 },
    { name: "OSAKA", lat: 34.6937, lon: 135.5023 },
    { name: "SEOUL", lat: 37.5665, lon: 126.978 },
    { name: "SAPPORO", lat: 43.0618, lon: 141.3545 },
  ],
  "Eastern Australia": [
    { name: "SYDNEY", lat: -33.8688, lon: 151.2093 },
    { name: "BRISBANE", lat: -27.4698, lon: 153.0251 },
    { name: "MELBOURNE", lat: -37.8136, lon: 144.9631 },
    { name: "CANBERRA", lat: -35.2809, lon: 149.13 },
  ],
  "Western Atlantic": [
    { name: "NASSAU", lat: 25.0443, lon: -77.3504 },
    { name: "SAN JUAN", lat: 18.4655, lon: -66.1057 },
    { name: "BERMUDA", lat: 32.2949, lon: -64.7814 },
    { name: "HAVANA", lat: 23.1136, lon: -82.3666 },
  ],
};

const els = {
  clock: document.querySelector("#clock"),
  clockDate: document.querySelector("#clock-date"),
  mode: document.querySelector("#mode"),
  region: document.querySelector("#region"),
  temp: document.querySelector("#temperature"),
  condition: document.querySelector("#condition"),
  feelsLike: document.querySelector("#feels-like"),
  wind: document.querySelector("#wind"),
  precip: document.querySelector("#precip"),
  updated: document.querySelector("#updated"),
  localTime: document.querySelector("#local-time"),
  daily: document.querySelector("#daily"),
  viewing: document.querySelector("#now-viewing"),
  summary: document.querySelector("#summary"),
  radar: document.querySelector("#radar-stamp"),
  ticker: document.querySelector("#ticker-text"),
  cameraPanel: document.querySelector("#camera-panel"),
  cameraImage: document.querySelector("#camera-image"),
  cameraSource: document.querySelector("#camera-source"),
  cameraLocation: document.querySelector("#camera-location"),
  cameraUpdated: document.querySelector("#camera-updated"),
  lowerThird: document.querySelector(".lower-third"),
  slideCopy: document.querySelector(".slide-copy"),
  radarLegend: document.querySelector("#radar-legend"),
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
const RADAR_ANIMATION_STALE_MS = 1800000;
const RADAR_FRAME_MS = 1400;
const RADAR_LATEST_HOLD_MS = 4200;
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
// City temps sit above the basemap labels so a place-name tile can't strike
// through a temperature reading.
map.createPane("cityPane");
map.getPane("cityPane").style.zIndex = 440;
map.getPane("cityPane").style.pointerEvents = "none";

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
  // Opacity is CSS-only in Leaflet, so setParams would refetch every CONUS
  // tile even while the animated loop has this layer hidden; only roll the
  // stamp when the static layer is actually the one on screen.
  if (radarFrames.length < 2) {
    radarLayer.setParams({ ts: Math.floor(Date.now() / RADAR_REFRESH_MS) });
  }
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
    // Observed frames only: nowcast entries are model predictions, and the
    // lower-third labels this loop with real radar timestamps.
    const frames = (data.radar?.past || []).slice(-RADAR_MAX_FRAMES);
    if (!data.host || frames.length < 2) throw new Error("radar animation unavailable");
    setAnimatedRadarFrames(data.host, frames);
  } catch (error) {
    // A loop that hasn't refreshed in 30 minutes is showing weather that no
    // longer exists; the static NOAA layer refetches on a fresh stamp, so a
    // stale loop is worse than the fallback it was protecting.
    if (radarFrames.length >= 2 && Date.now() - radarAnimationLoadedAt > RADAR_ANIMATION_STALE_MS) {
      teardownAnimatedRadar();
    }
    // A transient RainViewer failure must not stack the static layer on top
    // of an animation loop that is still cycling its last good frames.
    if (radarFrames.length < 2) {
      // Falling back to the static layer after the animation has been
      // covering it: its cached tiles may be old, so force a fresh stamp.
      radarLayer.setParams({ ts: Math.floor(Date.now() / RADAR_REFRESH_MS) });
      updateRadarLayerForStop();
      updateRadarStamp();
    }
  }
}

function teardownAnimatedRadar() {
  clearTimeout(radarAnimationTimer);
  radarAnimationTimer = 0;
  radarFrameLayers.forEach((layer) => map.removeLayer(layer));
  radarFrameLayers = [];
  radarFrames = [];
  radarFrameIndex = 0;
  radarFrameSignature = "";
}

function setAnimatedRadarFrames(host, frames) {
  radarAnimationLoadedAt = Date.now();

  // RainViewer publishes new frames roughly every 10 minutes but this reloads
  // every 5; rebuilding the layers with an identical frame list blanks the
  // radar while every tile refetches, so keep the running loop instead.
  const signature = frames.map((frame) => `${host}${frame.path}`).join("|");
  if (signature === radarFrameSignature && radarFrameLayers.length === frames.length) return;
  radarFrameSignature = signature;

  clearTimeout(radarAnimationTimer);
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
  scheduleNextRadarFrame();
  updateRadarStamp();
}

// Broadcast loops hold on the most recent scan before restarting, so the
// viewer's eye gets a beat on "now" instead of an even metronome cycle.
function scheduleNextRadarFrame() {
  const onLatestFrame = radarFrameIndex === radarFrameLayers.length - 1;
  radarAnimationTimer = setTimeout(showNextRadarFrame, onLatestFrame ? RADAR_LATEST_HOLD_MS : RADAR_FRAME_MS);
}

function showNextRadarFrame() {
  if (radarFrames.length < 2 || radarFrameLayers.length < 2) return;
  radarFrameLayers[radarFrameIndex].setOpacity(0);
  radarFrameIndex = (radarFrameIndex + 1) % radarFrameLayers.length;
  radarFrameLayers[radarFrameIndex].setOpacity(0.74);
  updateRadarStamp();
  scheduleNextRadarFrame();
}

function updateRadarStamp() {
  if (lastAlertCount > 0) return;
  if (radarFrames.length >= 2) {
    const frame = radarFrames[radarFrameIndex];
    els.radar.textContent = `RADAR LOOP: ${broadcastTime(new Date(frame.time * 1000))}`;
    return;
  }
  els.radar.textContent = `RADAR: ${broadcastTime()}`;
}

const FETCH_TIMEOUT_MS = 15000;

// Every on-air stamp reads in the broadcast's home time to agree with the
// topbar PT clock — toLocaleTimeString would use the viewer's zone, so the
// hosted page in another timezone shows stamps that contradict the clock.
// Alert expiries are the deliberate exception: they read in the alerted
// zone's local time, and the "Local" line carries the region's wall clock.
function broadcastTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

let stopIndex = 0;
let lastAlertCount = 0;
let detailIndex = 0;
let lastRendered = null;
let requestSeq = 0;
let retryTimer = 0;
let cameraIndex = 0;
const RETRY_DELAY_MS = 20000;
const CAMERA_ROTATE_MS = 18000;

function updateClock() {
  const now = new Date();
  // The classic LDL clock ticks seconds — a static minutes-only clock reads
  // as a frozen graphic on a live stream; updateClock already runs every 1s.
  els.clock.textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now).replace(" ", "") + " PT";
  els.clockDate.textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now).replace(",", "").toUpperCase();
  renderLocalTime();
}

// The topbar clock stays on PT (the broadcast's home time), but a world-scan
// panel should show the region's own wall clock — Open-Meteo's timezone:auto
// response tells us which one that is.
let regionTimeZone = "";

function renderLocalTime() {
  if (!regionTimeZone) {
    els.localTime.textContent = "Local --";
    return;
  }
  try {
    const stamp = new Intl.DateTimeFormat("en-US", {
      timeZone: regionTimeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
    els.localTime.textContent = `Local ${stamp}`;
  } catch (error) {
    els.localTime.textContent = "Local --";
  }
}

function cameraUrl(url) {
  const next = new URL(url);
  next.searchParams.set("refresh", Math.floor(Date.now() / 60000));
  return next.toString();
}

function currentCameras() {
  const stop = STOPS[stopIndex % STOPS.length];
  return CAMERA_SETS[stop.name] || [];
}

// WSDOT feeds drop out individually; a broken-image box in the corner reads
// as a crashed graphic on stream. Dead cameras are skipped, and if the whole
// set is down the panel leaves air until the rotate cycle retries it.
let cameraFailures = 0;
let cameraLoadSeq = 0;

function renderCamera() {
  const cameras = currentCameras();
  if (!cameras.length || cameraFailures >= cameras.length) {
    els.cameraPanel.hidden = true;
    return;
  }

  // Swapping the visible img's src labels the new location under the old
  // photo while a slow WSDOT frame streams in — a mislabeled live shot on
  // air. Preload off-screen and cut image + caption together, and only
  // count a camera as failed once its probe actually errors.
  const camera = cameras[cameraIndex % cameras.length];
  const seq = ++cameraLoadSeq;
  const probe = new Image();
  probe.onload = () => {
    if (seq !== cameraLoadSeq) return;
    cameraFailures = 0;
    els.cameraImage.src = probe.src;
    els.cameraImage.alt = camera.location;
    els.cameraSource.textContent = camera.source;
    els.cameraLocation.textContent = camera.location;
    els.cameraUpdated.textContent = broadcastTime();
    els.cameraPanel.hidden = false;
  };
  probe.onerror = () => {
    if (seq !== cameraLoadSeq) return;
    cameraFailures += 1;
    if (cameraFailures >= cameras.length) {
      els.cameraPanel.hidden = true;
      return;
    }
    cameraIndex = (cameraIndex + 1) % cameras.length;
    renderCamera();
  };
  probe.src = cameraUrl(camera.url);
}

function rotateCamera() {
  const cameras = currentCameras();
  if (!cameras.length) return;
  // The cache-buster URL changes each minute, so a set that went fully dark
  // gets another chance on rotation instead of staying hidden for the stop.
  if (cameraFailures >= cameras.length) cameraFailures = 0;
  cameraIndex = (cameraIndex + 1) % cameras.length;
  renderCamera();
}

// Like the slide rotator, the camera timer restarts when a stop lands: a
// free-running interval could cut away from the first camera a second after
// it airs, which reads as a glitch rather than a rotation.
let cameraRotateTimer = 0;

function scheduleCameraRotation() {
  clearTimeout(cameraRotateTimer);
  cameraRotateTimer = setTimeout(() => {
    rotateCamera();
    scheduleCameraRotation();
  }, CAMERA_ROTATE_MS);
}

function fmtTemp(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}°`;
}

// Broadcast wind copy always leads with a compass direction — "Wind WSW 12 mph"
// tells a viewer which way the weather is coming from, a bare speed doesn't.
const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function windCompass(degrees) {
  if (!Number.isFinite(degrees)) return "";
  return COMPASS_POINTS[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16];
}

function fmtWind(value, direction, gusts) {
  if (!Number.isFinite(value)) return "Wind --";
  const compass = windCompass(direction);
  // On a windy day the gust is the story, and the observation panel is on air
  // full-time while the gusty lower-third slide is 1-of-8; METAR-style
  // "WSW 12 G 25" puts it where the viewer is already looking. Same
  // significance threshold as the slide so the two never disagree.
  const gust = Number.isFinite(gusts) && gusts > value + 2 ? ` G ${Math.round(gusts)}` : "";
  return compass
    ? `Wind ${compass} ${Math.round(value)}${gust} mph`
    : `Wind ${Math.round(value)}${gust} mph`;
}

function fmtShortWind(value, direction) {
  if (!Number.isFinite(value)) return "wind --";
  const compass = windCompass(direction);
  return compass ? `wind ${compass} ${Math.round(value)} mph` : `wind ${Math.round(value)} mph`;
}

// Broadcast conditions decks pitch "Feels like" only when it's a story —
// heat index or wind chill pulling meaningfully away from the thermometer.
// Airing "91° / Feels like 91°" full-time is dead weight, so the line only
// airs when the rounded readings are 3°+ apart. One gate shared by the
// conditions panel and the LOCAL DETAILS slide so the two never disagree.
function feelsLikeIsStory(actual, apparent) {
  return Number.isFinite(actual) && Number.isFinite(apparent)
    && Math.abs(Math.round(apparent) - Math.round(actual)) >= 3;
}

function renderFeelsLike(actual, apparent) {
  if (!feelsLikeIsStory(actual, apparent)) {
    els.feelsLike.hidden = true;
    return;
  }
  els.feelsLike.textContent = `Feels like ${Math.round(apparent)}°`;
  els.feelsLike.hidden = false;
}

function fmtPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

// US broadcast weather reads the barometer in inches of mercury — "30.06 in",
// never "1018 mb" — and this broadcast is already imperial everywhere (°F,
// mph, miles), so the pressure line matches. Open-Meteo has no inHg unit
// option; convert from the hPa it returns.
function fmtPressure(value) {
  if (!Number.isFinite(value)) return "Pressure --";
  return `Pressure ${(value / 33.8639).toFixed(2)} in`;
}

// Open-Meteo returns visibility in feet (not meters) when the request asks
// for fahrenheit/mph imperial units — current_units confirms "ft".
// Below a mile, whole-mile rounding airs "Visibility 0 mi" in exactly the
// fog that makes visibility the headline; NWS reports quarter-mile fractions
// down there, so use them.
function fmtVisibility(value) {
  if (!Number.isFinite(value)) return "Visibility --";
  const miles = value / 5280;
  if (miles < 0.97) {
    const quarters = Math.round(miles * 4);
    if (quarters <= 0) return "Visibility under 1/4 mi";
    return `Visibility ${["", "1/4", "1/2", "3/4", "1"][quarters]} mi`;
  }
  return `Visibility ${Math.round(miles)} mi`;
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

// Short hour label for the hours-ahead strip: "8 PM", not "8:00 PM" — the
// strip reads three of these in a row and the :00 is noise at a glance.
function fmtHourLabel(value) {
  const match = /T(\d{2}):/.exec(value || "");
  if (!match) return "";
  let hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour} ${suffix}`;
}

function shortDate(value, index) {
  const date = new Date(`${value}T12:00:00Z`);
  if (index === 0) return "TODAY";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })
    .format(date)
    .toUpperCase();
}

// The red STORM WATCH takeover is reserved for genuinely severe alerts.
// August air-quality alerts and special weather statements are routine; a
// broadcast that goes full red for those has no headroom left for a tornado
// warning. NWS severity is authoritative when present, but many warnings
// (e.g. Flood Warning) come through as "Moderate", so a *Warning event name
// also qualifies.
function isSevereAlert(alert) {
  const severity = alert.properties?.severity;
  if (severity === "Extreme" || severity === "Severe") return true;
  return /Warning$/.test(alert.properties?.event || "");
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

// Broadcast alert copy leads with the expiration — "Flood Watch until 5:00 PM"
// tells the viewer more than a bare event name. NWS ends/expires strings carry
// the alerted zone's local offset, so fmtClock reads the wall time local to
// the affected area, not the viewer's.
function alertTiming(alerts) {
  const ends = alerts
    .map((alert) => alert.properties?.ends || alert.properties?.expires)
    .filter(Boolean)
    .sort();
  if (!ends.length) return "";
  const clock = alertClockWithDay(ends[ends.length - 1]);
  if (clock === "--") return "";
  return alerts.length > 1 ? ` through ${clock}` : ` until ${clock}`;
}

// "until 5:00 PM" reads as today, but watches and advisories routinely run a
// day or more out; NWS copy appends the weekday when the expiry isn't today.
// The ISO string's date and offset are both local to the alerted zone, so the
// comparison uses that zone's calendar, not the viewer's.
function alertClockWithDay(value) {
  const clock = fmtClock(value);
  if (clock === "--") return "--";
  const match = /^(\d{4}-\d{2}-\d{2})T.*(?:Z|([+-])(\d{2}):?(\d{2}))$/.exec(value);
  if (!match) return clock;
  const [, endDate, sign, offH, offM] = match;
  const offsetMs = sign ? (sign === "-" ? -1 : 1) * (Number(offH) * 60 + Number(offM)) * 60000 : 0;
  const zoneToday = new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
  if (endDate === zoneToday) return clock;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" })
    .format(new Date(`${endDate}T12:00:00Z`));
  return `${clock} ${weekday}`;
}

// WHO UV index scale, the same buckets broadcast almanac panels use.
function uvCategory(uv) {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very high";
  return "extreme";
}

// After sunset, "Today 91° / 64°" recaps a day that's over — the high already
// happened, and index 0's min is this morning's low, not tonight's (Open-Meteo
// mins are calendar-day, so the overnight low lands in tomorrow's slot).
// Old-school extended forecasts flip the lead to TONIGHT with the overnight
// low. Pre-dawn the day is still ahead, so TODAY stays: a current time past
// this calendar day's sunrise means the evening side of night.
function isEveningNight(current, daily, isNight) {
  return isNight && Boolean(current?.time) && Boolean(daily.sunrise?.[0])
    && daily.sunrise[0] < current.time;
}

// Rain chances air only when rain is in play — same 25% "chance of rain"
// floor as the hours-ahead strip. A dry week's "0% rain" in every forecast
// line (and a column of 0% down the extended panel) is dead air, and the
// three surfaces gating differently would read as a disagreement.
function rainChanceClause(pop) {
  return Number.isFinite(pop) && pop >= 25 ? ` ${Math.round(pop)}% rain.` : "";
}

function todayForecastLine(daily, current, isNight) {
  const hi = fmtTemp(daily.temperature_2m_max?.[0]);
  const lo = fmtTemp(daily.temperature_2m_min?.[0]);
  const pop = rainChanceClause(daily.precipitation_probability_max?.[0]);
  // After dark, "Sunset 8:04 PM" is old news; pitch the next sunrise instead.
  // Open-Meteo returns location-local ISO strings, so comparing against
  // current.time picks today's sunrise pre-dawn and tomorrow's after sunset.
  if (isNight) {
    const now = current?.time || "";
    const sunrise = daily.sunrise?.[0] > now ? daily.sunrise?.[0] : daily.sunrise?.[1];
    // Evenings pitch tonight instead: current sky, the overnight low, and the
    // next sunrise. Today's rain chance is mostly spent by then, so it sits out.
    if (isEveningNight(current, daily, isNight)) {
      const condition = WEATHER_CODES[current?.weather_code] || "Skies";
      return `Tonight ${condition}. Lo ${fmtTemp(daily.temperature_2m_min?.[1])}. Sunrise ${fmtClock(sunrise)}.`;
    }
    return `Today ${hi} / ${lo}.${pop} Sunrise ${fmtClock(sunrise)}.`;
  }
  return `Today ${hi} / ${lo}.${pop} Sunset ${fmtClock(daily.sunset?.[0])}.`;
}

function tomorrowForecastLine(daily) {
  const hi = fmtTemp(daily.temperature_2m_max?.[1]);
  const lo = fmtTemp(daily.temperature_2m_min?.[1]);
  const pop = rainChanceClause(daily.precipitation_probability_max?.[1]);
  const code = daily.weather_code?.[1];
  const condition = WEATHER_CODES[code] || "Forecast update";
  return `Tomorrow ${condition}. ${hi} / ${lo}.${pop}`;
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
    const timing = alertTiming(alerts);
    slides.push({
      alert: true,
      kicker: "ALERTS ACTIVE",
      summary: `${alertSummary || `${alerts.length} weather alerts active`}${timing}`,
      tickerLead: `ALERTS: ${alertSummary || `${alerts.length} active alerts`}${timing}`,
    });
  }

  slides.push({
    kicker: isNight ? "NIGHT CONDITIONS" : "CURRENT CONDITIONS",
    summary: `${condition} across ${stopPhrase(stop)}. ${fmtTemp(current.temperature_2m)}, ${fmtShortWind(current.wind_speed_10m, current.wind_direction_10m)}${gust}.`,
    tickerLead: `${stop.name}: ${condition}, ${fmtTemp(current.temperature_2m)}, ${fmtWind(current.wind_speed_10m, current.wind_direction_10m)}`,
  });

  // Same significance gate as the panel's feels-like line: when the apparent
  // temperature matches the thermometer, the slide reads two facts instead of
  // padding itself with a non-story.
  const feelsSlide = feelsLikeIsStory(current.temperature_2m, current.apparent_temperature);
  slides.push({
    kicker: "LOCAL DETAILS",
    summary: `${feelsSlide ? `Feels like ${fmtTemp(current.apparent_temperature)}. ` : ""}Humidity ${fmtPercent(current.relative_humidity_2m)}. Clouds ${fmtPercent(current.cloud_cover)}.`,
    tickerLead: `DETAILS: ${feelsSlide ? `feels ${fmtTemp(current.apparent_temperature)}, ` : ""}humidity ${fmtPercent(current.relative_humidity_2m)}, clouds ${fmtPercent(current.cloud_cover)}`,
  });

  // "Rain 0.00 in" is dead air on a dry day; broadcast observation decks fill
  // that slot with the dew point, and rain takes it back only when there's
  // measurable precipitation to report.
  const obsTail = Number.isFinite(current.precipitation) && current.precipitation >= 0.01
    ? `Rain ${current.precipitation.toFixed(2)} in`
    : `Dew point ${fmtTemp(current.dew_point_2m)}`;
  slides.push({
    kicker: "PRESSURE / VISIBILITY",
    summary: `${fmtPressure(current.pressure_msl)}. ${fmtVisibility(current.visibility)}. ${obsTail}.`,
    tickerLead: `OBSERVATION: ${fmtPressure(current.pressure_msl)}, ${fmtVisibility(current.visibility)}, ${obsTail.toLowerCase()}`,
  });

  // UV index is a daytime almanac staple; after dark it's a non-story, so the
  // slide leaves the rundown rather than airing "UV 0" all night.
  const uv = daily.uv_index_max?.[0];
  if (!isNight && Number.isFinite(uv)) {
    const uvRounded = Math.round(uv);
    slides.push({
      kicker: "UV INDEX",
      summary: `Peak UV index ${uvRounded} today — ${uvCategory(uvRounded)} sun exposure.`,
      tickerLead: `UV: peak index ${uvRounded} today (${uvCategory(uvRounded)})`,
    });
  }

  // The deck jumps from current conditions to today's high/low, but the
  // high/low says nothing about whether tonight cools off or tomorrow's front
  // arrives before dawn. Old-school Local Forecast segments always aired an
  // hours-ahead strip: three readings spanning the next ~8 hours, in the
  // region's own clock (Open-Meteo hourly times are location-local).
  const hourly = weather.hourly || {};
  const hourlyStart = current.time
    ? (hourly.time || []).findIndex((time) => time > current.time)
    : -1;
  if (hourlyStart >= 0) {
    const points = [2, 5, 8]
      .map((offset) => hourlyStart + offset)
      .filter((i) => hourly.time?.[i] && Number.isFinite(hourly.temperature_2m?.[i]))
      .map((i) => {
        // Old-school hourly strips carried a rain chance next to the temp when
        // rain was in play; a dry hour stays a clean "8 PM 71°". The bare
        // percentage matches the extended-forecast rows, and 25% is where
        // broadcast copy starts saying "a chance of rain".
        const pop = hourly.precipitation_probability?.[i];
        const rain = Number.isFinite(pop) && pop >= 25 ? ` ${Math.round(pop)}%` : "";
        return `${fmtHourLabel(hourly.time[i])} ${fmtTemp(hourly.temperature_2m[i])}${rain}`;
      });
    if (points.length === 3) {
      slides.push({
        kicker: "HOURS AHEAD",
        summary: `Coming up: ${points.join(", ")}.`,
        tickerLead: `HOURS AHEAD: ${points.join(", ")}`,
      });
    }
  }

  slides.push({
    kicker: "FORECAST SNAPSHOT",
    summary: todayForecastLine(daily, current, isNight),
    tickerLead: `FORECAST: ${todayForecastLine(daily, current, isNight)}`,
  });

  slides.push({
    kicker: "NEXT OUTLOOK",
    summary: tomorrowForecastLine(daily),
    tickerLead: `NEXT: ${tomorrowForecastLine(daily)}`,
  });

  // Only pitch a radar slide when a radar layer is actually on screen: the
  // animated loop covers every stop, but the static NOAA layer only covers
  // CONUS stops.
  if (radarFrames.length >= 2) {
    const latestScan = broadcastTime(new Date(radarFrames[radarFrames.length - 1].time * 1000));
    slides.push({
      kicker: "RADAR SCAN",
      summary: `Live radar loop over ${stopPhrase(stop)}. Most recent scan ${latestScan}.`,
      tickerLead: `RADAR: live loop over ${stopPhrase(stop)}, latest scan ${latestScan}`,
    });
  } else if (stop.noaa) {
    slides.push({
      kicker: "RADAR SCAN",
      summary: `Current radar snapshot over ${stopPhrase(stop)}. Live loop resumes shortly.`,
      tickerLead: `RADAR: current snapshot over ${stopPhrase(stop)}`,
    });
  }

  return slides;
}

// The CSS crawl always takes one fixed cycle, so a long alert-day ticker
// scrolls much faster than a quiet-day one. Broadcast crawls hold a constant
// read speed; derive the cycle time from the rendered width instead.
const TICKER_PX_PER_SECOND = 85;
const TICKER_MIN_SECONDS = 24;

function setTickerText(text) {
  // Swapping text or duration mid-crawl visibly jumps the ticker; restart the
  // animation so new copy enters cleanly from off-screen right. Skip identical
  // text so the periodic refresh doesn't reset a crawl that's mid-read.
  if (text === els.ticker.textContent) return;
  els.ticker.textContent = text;
  els.ticker.style.animation = "none";
  requestAnimationFrame(() => {
    const speed = window.innerWidth <= 760 ? 60 : TICKER_PX_PER_SECOND;
    const seconds = Math.max(TICKER_MIN_SECONDS, els.ticker.scrollWidth / speed);
    els.ticker.style.animation = "";
    els.ticker.style.animationDuration = `${Math.round(seconds)}s`;
  });
}

// The lower-third rotates slides every 11s, but a full crawl takes 24s+, so a
// per-slide ticker never finishes a pass before its copy is yanked. Broadcast
// crawls run the whole rundown independent of the on-screen panel: feed the
// ticker every slide's lead at once and let it read out over the stop dwell.
function renderTicker(slides) {
  setTickerText(
    slides
      .map((slide) => slide.tickerLead)
      .concat([
        "DATA: NOAA/NWS alerts, RainViewer radar, Open-Meteo forecast, CARTO/OpenStreetMap",
        "JMO WEATHER SCAN",
      ])
      .join("     •     "),
  );
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
  detailSlideCount = slides.length;
  const slide = slides[detailIndex % slides.length];
  // Minor advisories don't trip the full red alert-mode chrome, so the alert
  // slide itself carries a red kicker chip to read differently from the
  // routine conditions slides.
  els.lowerThird.classList.toggle("alert-slide", Boolean(slide.alert));
  // Only animate when the copy actually changes: the 5-minute data refresh
  // re-renders the current slide in place, and a blink there reads as a
  // glitch rather than a rotation.
  const slideChanged = els.viewing.textContent !== slide.kicker
    || els.summary.textContent !== slide.summary;
  els.viewing.textContent = slide.kicker;
  els.summary.textContent = slide.summary;
  if (slideChanged) {
    els.slideCopy.classList.remove("slide-change");
    void els.slideCopy.offsetWidth;
    els.slideCopy.classList.add("slide-change");
  }
  if (detailIndex === 0) renderTicker(slides);
}

// The rotation timer restarts whenever a new deck renders: a free-running
// interval could fire right after a stop lands, yanking the lead slide
// (alerts / current conditions) off screen in under a second.
let detailRotateTimer = 0;

// A stop airs for 65s, but a busy deck (alerts + UV + radar) runs 8 slides —
// at a fixed 11s spin the last two (NEXT OUTLOOK, RADAR SCAN) never make air
// before the rotation moves on. Pace the spin to the deck so the whole
// rundown completes once per stop, floored so copy still gets a full read.
const DETAIL_ROTATE_MIN_MS = 8000;
let detailSlideCount = 0;

function detailRotateInterval() {
  if (!detailSlideCount) return REGION_DETAIL_ROTATE_MS;
  const fitted = Math.floor(STOP_DWELL_MS / detailSlideCount);
  return Math.max(DETAIL_ROTATE_MIN_MS, Math.min(REGION_DETAIL_ROTATE_MS, fitted));
}

function scheduleDetailRotation() {
  clearTimeout(detailRotateTimer);
  detailRotateTimer = setTimeout(advanceDetailSlide, detailRotateInterval());
}

function advanceDetailSlide() {
  if (lastRendered) {
    detailIndex += 1;
    renderDetailSlide();
  }
  scheduleDetailRotation();
}

// One multi-location Open-Meteo call per stop: comma-separated coordinates
// come back as an array in the same order as the request.
async function fetchCityTemps(stop) {
  const cities = CITY_TEMP_SETS[stop.name] || [];
  if (!cities.length) return [];
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: cities.map((city) => city.lat).join(","),
    longitude: cities.map((city) => city.lon).join(","),
    current: "temperature_2m",
    temperature_unit: "fahrenheit",
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`city temps ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data) ? data : [data];
  return cities.map((city, index) => ({ ...city, temp: results[index]?.current?.temperature_2m }));
}

let cityMarkers = [];
let cityMarkersStop = null;

function clearCityMarkers() {
  cityMarkers.forEach((marker) => map.removeLayer(marker));
  cityMarkers = [];
  cityMarkersStop = null;
}

// `temps: null` means the poll failed, not "no cities": hold this stop's
// last plot through an outage, but never leave another region's readings
// on the map under this stop's name.
function renderCityTemps(stop, temps) {
  if (!temps) {
    if (cityMarkersStop !== stop) clearCityMarkers();
    return;
  }
  clearCityMarkers();
  cityMarkersStop = stop;
  for (const city of temps) {
    if (!Number.isFinite(city.temp)) continue;
    const icon = L.divIcon({
      className: "city-temp",
      iconSize: null,
      html: `<span class="city-temp-inner"><span class="city-temp-name">${city.name}</span><span class="city-temp-val">${Math.round(city.temp)}°</span></span>`,
    });
    cityMarkers.push(L.marker([city.lat, city.lon], {
      icon,
      pane: "cityPane",
      interactive: false,
      keyboard: false,
    }).addTo(map));
  }
}

async function fetchWeather(stop) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: stop.lat,
    longitude: stop.lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,pressure_msl,visibility,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max",
    hourly: "temperature_2m,precipitation_probability",
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
  // The intensity key only airs while a radar layer is actually on screen;
  // a legend over a radar-free world stop would label colors that aren't there.
  if (radarFrames.length >= 2) {
    radarLayer.setOpacity(0);
    els.radarLegend.hidden = false;
    return;
  }
  const showStatic = currentStopSupportsNoaa();
  radarLayer.setOpacity(showStatic ? 0.64 : 0);
  els.radarLegend.hidden = !showStatic;
}

// NWS returns active alerts in issuance order, not severity order, so on a
// busy day slicing the first 4 can drop a Tornado Warning in favor of four
// routine statements. Rank by severity (warnings outrank same-tier watches)
// before truncating, which also makes the alert slide and ticker lead with
// the worst headline.
const ALERT_SEVERITY_RANK = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };

function alertRank(alert) {
  const severity = ALERT_SEVERITY_RANK[alert.properties?.severity] ?? 4;
  const warning = /Warning$/.test(alert.properties?.event || "") ? 0 : 1;
  return severity * 2 + warning;
}

async function fetchAlerts(stop) {
  if (!stop.noaa) return [];
  const point = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
  const url = `https://api.weather.gov/alerts/active?point=${point}`;
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`alerts ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.features)) return [];
  return data.features
    .slice()
    .sort((a, b) => alertRank(a) - alertRank(b))
    .slice(0, 4);
}

function renderWeather(stop, weather, alerts) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const condition = WEATHER_CODES[current.weather_code] || "Weather update";
  const isNight = isNightFromWeather(weather);

  const severeAlerts = alerts.filter(isSevereAlert);
  lastAlertCount = severeAlerts.length;
  regionTimeZone = weather.timezone || "";
  renderLocalTime();
  applyDayPart(isNight);
  document.body.classList.toggle("alert-mode", severeAlerts.length > 0);
  // The rotation circles the globe, so somewhere is always in darkness; a
  // generic NIGHT SCAN chip would replace the regional mode ("GULF WATCH",
  // "PACIFIC SCAN") on several stops every loop. Night already reads from the
  // dark chrome and the NIGHT CONDITIONS slide — keep the segment identity.
  els.mode.textContent = severeAlerts.length ? "STORM WATCH" : stop.mode;
  els.region.textContent = stop.name;
  els.temp.textContent = fmtTemp(current.temperature_2m);
  els.condition.textContent = condition;
  renderFeelsLike(current.temperature_2m, current.apparent_temperature);
  els.wind.textContent = fmtWind(current.wind_speed_10m, current.wind_direction_10m, current.wind_gusts_10m);
  // "Rain 0.00 in" is dead air on a dry day; broadcast current-conditions
  // panels fill that slot with humidity, and the rain amount takes it back
  // only when there's measurable precipitation to report.
  els.precip.textContent = Number.isFinite(current.precipitation) && current.precipitation >= 0.01
    ? `Rain ${current.precipitation.toFixed(2)} in`
    : `Humidity ${fmtPercent(current.relative_humidity_2m)}`;
  els.updated.textContent = `Updated ${broadcastTime()}`;

  els.daily.innerHTML = "";
  const evening = isEveningNight(current, daily, isNight);
  for (let i = 0; i < Math.min(4, daily.time?.length || 0); i += 1) {
    const row = document.createElement("div");
    // Lead row after sunset: TONIGHT with the current sky and the overnight
    // low (tomorrow's calendar-day min) — today's high is old news by then.
    if (evening && i === 0) {
      row.innerHTML = `<span class="day-name">TONIGHT</span><span class="day-cond">${condition}</span><span class="day-temps">Lo ${fmtTemp(daily.temperature_2m_min?.[1])}</span>`;
      els.daily.appendChild(row);
      continue;
    }
    const label = shortDate(daily.time[i], i);
    const hi = fmtTemp(daily.temperature_2m_max?.[i]);
    const lo = fmtTemp(daily.temperature_2m_min?.[i]);
    // Same 25% floor as rainChanceClause: a dry stretch airs a clean hi/lo
    // column instead of a stack of "0%" down the panel.
    const popMax = daily.precipitation_probability_max?.[i];
    const pop = Number.isFinite(popMax) && popMax >= 25 ? ` &nbsp; ${Math.round(popMax)}%` : "";
    const dayCondition = WEATHER_CODES[daily.weather_code?.[i]] || "";
    row.innerHTML = `<span class="day-name">${label}</span><span class="day-cond">${dayCondition}</span><span class="day-temps">${hi} / ${lo}${pop}</span>`;
    els.daily.appendChild(row);
  }

  // The 5-minute data refresh re-renders mid-dwell; resetting the deck then
  // yanks whatever slide is mid-read back to slide one, a visible jump every
  // refresh. Keep the slide position when it's the same stop and the alert
  // set hasn't changed — a new alert still restarts the deck so it airs
  // immediately instead of waiting for the wrap. Identity, not count: NWS
  // routinely swaps a watch for a warning in one poll, and a count-only gate
  // would sit on the upgraded headline for most of the dwell.
  const alertSignature = alerts.map((alert) => alert.id || alert.properties?.id || "").join("|");
  const sameDeck = lastRendered?.stop === stop && lastRendered.alertSignature === alertSignature;
  if (!sameDeck) detailIndex = 0;
  lastRendered = { stop, weather, alerts, condition, isNight, alertSignature };
  renderDetailSlide();
  if (!sameDeck) scheduleDetailRotation();

  // Don't stomp the animated loop's frame stamp on every weather render;
  // updateRadarStamp knows whether a loop is running. Only severe alerts
  // commandeer the stamp — minor advisories still crawl the ticker and get
  // an ALERTS ACTIVE slide, but the radar clock stays on air.
  if (severeAlerts.length) {
    els.radar.textContent = `${severeAlerts.length} ALERT${severeAlerts.length > 1 ? "S" : ""}`;
  } else {
    updateRadarStamp();
  }
}

function renderFallback(stop, error) {
  // The 11s slide rotator replays lastRendered, so leaving the previous
  // stop's data in place would overwrite this fallback with another
  // region's conditions shown under this stop's name.
  lastRendered = null;
  // A stale alert count from the previous stop would keep suppressing the
  // radar loop stamp even though alert-mode is being cleared here.
  lastAlertCount = 0;
  // Timezone came from the failed fetch's stop, so the previous region's
  // clock would be wrong under this stop's name.
  regionTimeZone = "";
  renderLocalTime();
  // The previous region's city temps would read as this stop's observations.
  if (cityMarkersStop !== stop) clearCityMarkers();
  document.body.classList.remove("alert-mode");
  // Keep the current day/night theme on transient failures instead of
  // flashing back to the day palette at night.
  applyDayPart(isNightInPacificTime());
  els.mode.textContent = stop.mode;
  els.region.textContent = stop.name;
  els.temp.textContent = "--";
  els.condition.textContent = "Data update pending";
  els.feelsLike.hidden = true;
  els.wind.textContent = "Wind --";
  els.precip.textContent = "Humidity --";
  els.updated.textContent = "Retrying";
  els.daily.innerHTML = "";
  els.lowerThird.classList.remove("alert-slide");
  els.viewing.textContent = "STANDBY";
  els.summary.textContent = `Scanning ${stopPhrase(stop)}`;
  updateRadarStamp();
  // Raw error text ("weather 500", timeout messages) is debug detail, not
  // broadcast copy; keep it in the console and put clean standby copy on air.
  console.warn(`weather fetch failed for ${stop.name}:`, error);
  setTickerText(`STAND BY: updating conditions for ${stopPhrase(stop)}     •     DATA: NOAA/NWS alerts, RainViewer radar, Open-Meteo forecast, CARTO/OpenStreetMap     •     JMO WEATHER SCAN`);
}

// NWS drops a request now and then; airing that as "no alerts" mid-storm
// strikes the STORM WATCH chrome and reshuffles the slide deck, then snaps it
// all back on the next successful poll — a visible glitch exactly when alerts
// matter most. Hold the stop's last known alerts through a failed poll,
// minus any that have expired while NWS was unreachable.
function heldAlerts(stop) {
  if (lastRendered?.stop !== stop) return [];
  const now = Date.now();
  return lastRendered.alerts.filter((alert) => {
    const ends = alert.properties?.ends || alert.properties?.expires;
    if (!ends) return true;
    const endsMs = Date.parse(ends);
    return !Number.isFinite(endsMs) || endsMs > now;
  });
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
    // must not blank the whole panel when the forecast itself succeeded.
    // The null sentinel marks "poll failed" apart from "genuinely no alerts"
    // so held alerts only cover outages, never a real all-clear.
    const [weather, alertsResult, cityTemps] = await Promise.all([
      fetchWeather(stop),
      fetchAlerts(stop).catch(() => null),
      fetchCityTemps(stop).catch(() => null),
    ]);
    if (seq !== requestSeq) return;
    renderWeather(stop, weather, alertsResult ?? heldAlerts(stop));
    renderCityTemps(stop, cityTemps);
  } catch (error) {
    if (seq !== requestSeq) return;
    // A transient failure on the 5-minute refresh (or a retry) for the stop
    // that's already on air must not yank live conditions down to "--"
    // standby; holding a slightly stale panel beats blanking it. The stamp
    // keeps its last "Updated" time, so the hold stays honest. A stop with
    // no data yet still airs the standby fallback.
    if (lastRendered?.stop === stop) {
      console.warn(`weather refresh failed for ${stop.name}, holding last render:`, error);
    } else {
      renderFallback(stop, error);
    }
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
  cameraIndex = 0;
  cameraFailures = 0;
  renderCamera();
  scheduleCameraRotation();
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
scheduleDetailRotation();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshRadar();
    if (Date.now() - radarAnimationLoadedAt > RADAR_ANIMATION_REFRESH_MS) loadAnimatedRadar();
  }
});

setInterval(() => {
  updateRadarStamp();
}, 30000);

// The crawl duration is derived from the rendered width at render time, so a
// resized OBS source or rotated phone keeps the old duration — the constant
// read speed drifts until the next copy change swaps the text. Recompute once
// the resize settles; clearing textContent first defeats setTickerText's
// identical-text skip so the crawl restarts cleanly at the new width.
// A 24/7 OBS source loads the page once and then airs it for days; pushed
// updates never reach the stream because every asset URL is pinned by the
// cache-buster it loaded with. Poll the live index.html for changed ?v=
// tokens and reload once when a deploy lands — a one-time blip at deploy
// time beats a broadcast running week-old chrome.
const VERSION_CHECK_MS = 600000;

function assetVersionSignature(html) {
  const app = /app\.js\?v=([\w.-]+)/.exec(html)?.[1] || "";
  const css = /styles\.css\?v=([\w.-]+)/.exec(html)?.[1] || "";
  return app || css ? `${app}|${css}` : "";
}

const loadedVersionSignature = assetVersionSignature(
  Array.from(document.querySelectorAll("script[src], link[rel=stylesheet]"))
    .map((el) => el.getAttribute("src") || el.getAttribute("href"))
    .join(" "),
);

async function checkForDeploy() {
  try {
    const response = await fetch("./index.html", {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return;
    const live = assetVersionSignature(await response.text());
    if (!live || !loadedVersionSignature || live === loadedVersionSignature) return;
    // Pages can keep serving a cached index for a few minutes after a deploy,
    // so the reloaded page may still carry the old tokens; reloading again for
    // the same target signature would blink the broadcast in a loop.
    if (sessionStorage.getItem("weather-reloaded-for") === live) return;
    sessionStorage.setItem("weather-reloaded-for", live);
    location.reload();
  } catch (error) {
    // Transient fetch/storage failure; the next poll retries.
  }
}

setInterval(checkForDeploy, VERSION_CHECK_MS);

let tickerResizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(tickerResizeTimer);
  tickerResizeTimer = setTimeout(() => {
    const text = els.ticker.textContent;
    if (!text.trim()) return;
    els.ticker.textContent = "";
    setTickerText(text);
  }, 400);
});

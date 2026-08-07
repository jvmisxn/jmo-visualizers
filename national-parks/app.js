"use strict";

// JMO Parks Channel — fake broadcast national parks tour.
// Data: Open-Meteo forecast + air-quality (keyless, CORS-enabled).
// Scenery: procedural canvas panorama per park (always works offline);
// a small curated set of long-lived NPS webcam JPGs feeds the inset
// "PARK CAM" panel and silently hides on failure.

const STOP_MS = 26000;
const DATA_TTL_MS = 10 * 60 * 1000;
const CAM_REFRESH_MS = 5 * 60 * 1000;

const PARKS = [
  {
    name: "Yosemite",
    state: "California",
    lat: 37.7456,
    lon: -119.5936,
    scene: "valley",
    established: 1890,
    acres: 759620,
    visitors: "3.9M",
    fact: "El Capitan's granite face rises more than 3,000 feet above the valley floor.",
  },
  {
    name: "Yellowstone",
    state: "Wyoming / Montana / Idaho",
    lat: 44.4605,
    lon: -110.8281,
    scene: "geyser",
    established: 1872,
    acres: 2219791,
    visitors: "4.5M",
    fact: "The world's first national park holds more than half of Earth's active geysers.",
  },
  {
    name: "Grand Canyon",
    state: "Arizona",
    lat: 36.0544,
    lon: -112.1401,
    scene: "canyon",
    established: 1919,
    acres: 1201647,
    visitors: "4.7M",
    fact: "The canyon runs 277 river miles long, up to 18 miles wide, and a mile deep.",
  },
  {
    name: "Zion",
    state: "Utah",
    lat: 37.2982,
    lon: -113.0263,
    scene: "canyon",
    established: 1919,
    acres: 147242,
    visitors: "4.9M",
    fact: "The Narrows squeezes hikers between sandstone walls a thousand feet tall.",
  },
  {
    name: "Mount Rainier",
    state: "Washington",
    lat: 46.786,
    lon: -121.735,
    scene: "mountain",
    established: 1899,
    acres: 236381,
    visitors: "1.6M",
    fact: "At 14,410 feet, Rainier is the most glaciated peak in the contiguous U.S.",
    cams: [{ location: "Paradise — NPS", url: "https://www.nps.gov/webcams-mora/mountain.jpg" }],
  },
  {
    name: "Olympic",
    state: "Washington",
    lat: 47.969,
    lon: -123.4986,
    scene: "forest",
    established: 1938,
    acres: 922649,
    visitors: "2.9M",
    fact: "One park spans glacier-capped peaks, temperate rainforest, and wild coastline.",
  },
  {
    name: "Glacier",
    state: "Montana",
    lat: 48.6968,
    lon: -113.7183,
    scene: "lake",
    established: 1910,
    acres: 1013126,
    visitors: "3.2M",
    fact: "Going-to-the-Sun Road crosses the Continental Divide at Logan Pass.",
  },
  {
    name: "Great Smoky Mountains",
    state: "Tennessee / North Carolina",
    lat: 35.6532,
    lon: -83.507,
    scene: "ridges",
    established: 1934,
    acres: 522427,
    visitors: "13.3M",
    fact: "America's most-visited national park — and it has never charged an entrance fee.",
  },
  {
    name: "Acadia",
    state: "Maine",
    lat: 44.3386,
    lon: -68.2733,
    scene: "coast",
    established: 1919,
    acres: 49971,
    visitors: "3.9M",
    fact: "In fall and winter, Cadillac Mountain catches the first sunrise in the U.S.",
  },
  {
    name: "Grand Teton",
    state: "Wyoming",
    lat: 43.7412,
    lon: -110.8024,
    scene: "mountain",
    established: 1929,
    acres: 310044,
    visitors: "3.4M",
    fact: "The Teton Range rises 7,000 feet straight off the valley floor with no foothills.",
  },
];

const WEATHER_TEXT = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
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

const PSAS = [
  "LEAVE NO TRACE — PACK IT IN, PACK IT OUT",
  "STAY 100 YARDS FROM BEARS AND WOLVES, 25 YARDS FROM OTHER WILDLIFE",
  "CHECK TRAIL CONDITIONS AT RANGER STATIONS BEFORE HEADING OUT",
  "CARRY WATER — ONE GALLON PER PERSON PER DAY IN DESERT PARKS",
  "FIND YOUR PARK — 63 NATIONAL PARKS COAST TO COAST",
  "DARK SKIES AHEAD — MANY PARKS OFFER RANGER-LED STARGAZING",
];

const els = {
  clock: document.querySelector("#clock"),
  clockDate: document.querySelector("#clock-date"),
  segment: document.querySelector("#segment"),
  parkName: document.querySelector("#park-name"),
  parkSub: document.querySelector("#park-sub"),
  parkLocalTime: document.querySelector("#park-local-time"),
  wxTemp: document.querySelector("#wx-temp"),
  wxCond: document.querySelector("#wx-cond"),
  wxWind: document.querySelector("#wx-wind"),
  wxPrecip: document.querySelector("#wx-precip"),
  wxHumidity: document.querySelector("#wx-humidity"),
  aqiValue: document.querySelector("#aqi-value"),
  aqiLabel: document.querySelector("#aqi-label"),
  aqiFill: document.querySelector("#aqi-fill"),
  sunRise: document.querySelector("#sun-rise"),
  sunSet: document.querySelector("#sun-set"),
  sunLength: document.querySelector("#sun-length"),
  pfEst: document.querySelector("#pf-est"),
  pfArea: document.querySelector("#pf-area"),
  pfVisitors: document.querySelector("#pf-visitors"),
  pfFact: document.querySelector("#pf-fact"),
  camPanel: document.querySelector("#cam-panel"),
  camImage: document.querySelector("#cam-image"),
  camLocation: document.querySelector("#cam-location"),
  ticker: document.querySelector("#ticker-text"),
};

// ?stop=N jumps the rotation to a given stop (1-based) for testing.
const stopParam = Number(new URLSearchParams(location.search).get("stop"));
let stopIndex = Number.isInteger(stopParam) && stopParam >= 1 ? (stopParam - 1) % PARKS.length : 0;
const dataCache = new Map(); // park.name -> { at, weather, aqi, tz }

// ---------------------------------------------------------------------------
// Clock

function tickClock() {
  const now = new Date();
  els.clock.textContent =
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT";
  els.clockDate.textContent = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
  const tz = dataCache.get(currentPark().name)?.tz;
  if (tz) {
    try {
      els.parkLocalTime.textContent = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });
    } catch {
      els.parkLocalTime.textContent = "--:--";
    }
  }
}

function currentPark() {
  return PARKS[stopIndex % PARKS.length];
}

// ---------------------------------------------------------------------------
// Data (Open-Meteo forecast + air quality; both keyless with CORS)

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadParkData(park) {
  const cached = dataCache.get(park.name);
  if (cached && Date.now() - cached.at < DATA_TTL_MS) return cached;

  const wxUrl = new URL("https://api.open-meteo.com/v1/forecast");
  wxUrl.search = new URLSearchParams({
    latitude: park.lat,
    longitude: park.lon,
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
    daily: "sunrise,sunset,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: "1",
  }).toString();

  const aqiUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  aqiUrl.search = new URLSearchParams({
    latitude: park.lat,
    longitude: park.lon,
    current: "us_aqi",
    timezone: "auto",
  }).toString();

  const [weather, aqi] = await Promise.allSettled([fetchJson(wxUrl), fetchJson(aqiUrl)]);
  const entry = {
    at: Date.now(),
    weather: weather.status === "fulfilled" ? weather.value : null,
    aqi: aqi.status === "fulfilled" ? aqi.value : null,
    tz: weather.status === "fulfilled" ? weather.value.timezone : null,
  };
  // Keep a stale entry rather than an empty one if this refresh fully failed.
  if (!entry.weather && !entry.aqi && cached) return cached;
  dataCache.set(park.name, entry);
  return entry;
}

function compassDir(deg) {
  if (!Number.isFinite(deg)) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function aqiCategory(value) {
  if (!Number.isFinite(value)) return { label: "NO DATA", color: "#c2c9b4", pct: 0 };
  if (value <= 50) return { label: "GOOD", color: "#7fce8e", pct: value / 3 };
  if (value <= 100) return { label: "MODERATE", color: "#e8d24a", pct: value / 3 };
  if (value <= 150) return { label: "SENSITIVE", color: "#e8a33d", pct: value / 3 };
  if (value <= 200) return { label: "UNHEALTHY", color: "#d96b43", pct: value / 3 };
  if (value <= 300) return { label: "VERY UNHEALTHY", color: "#b06fd4", pct: 100 };
  return { label: "HAZARDOUS", color: "#c04a5e", pct: 100 };
}

function fmtClockTime(iso) {
  // Open-Meteo returns local ISO like "2026-08-07T06:12" — format directly to
  // avoid the browser reinterpreting it in the viewer's timezone.
  const m = /T(\d{2}):(\d{2})/.exec(iso || "");
  if (!m) return "--:--";
  let h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suffix}`;
}

function daylightLength(riseIso, setIso) {
  const r = /T(\d{2}):(\d{2})/.exec(riseIso || "");
  const s = /T(\d{2}):(\d{2})/.exec(setIso || "");
  if (!r || !s) return "--";
  const mins = Number(s[1]) * 60 + Number(s[2]) - (Number(r[1]) * 60 + Number(r[2]));
  if (mins <= 0) return "--";
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function renderParkData(park, data) {
  if (park !== currentPark()) return;
  const cur = data.weather?.current;
  const daily = data.weather?.daily;

  if (cur) {
    els.wxTemp.textContent = `${Math.round(cur.temperature_2m)}°F`;
    els.wxCond.textContent = WEATHER_TEXT[cur.weather_code] || "Conditions unknown";
    els.wxWind.textContent = `${compassDir(cur.wind_direction_10m)} ${Math.round(cur.wind_speed_10m)} MPH`;
    els.wxHumidity.textContent = `${Math.round(cur.relative_humidity_2m)}%`;
  } else {
    els.wxTemp.textContent = "--°";
    els.wxCond.textContent = "DATA LINK DOWN";
    els.wxWind.textContent = "--";
    els.wxHumidity.textContent = "--";
  }

  const pop = daily?.precipitation_probability_max?.[0];
  els.wxPrecip.textContent = Number.isFinite(pop) ? `${pop}%` : "--";

  const rise = daily?.sunrise?.[0];
  const set = daily?.sunset?.[0];
  els.sunRise.textContent = fmtClockTime(rise);
  els.sunSet.textContent = fmtClockTime(set);
  els.sunLength.textContent = daylightLength(rise, set);

  const aqiVal = data.aqi?.current?.us_aqi;
  const cat = aqiCategory(aqiVal);
  els.aqiValue.textContent = Number.isFinite(aqiVal) ? Math.round(aqiVal) : "--";
  els.aqiValue.style.color = cat.color;
  els.aqiLabel.textContent = cat.label;
  els.aqiLabel.style.color = cat.color;
  els.aqiFill.style.width = `${Math.max(2, Math.min(100, cat.pct))}%`;
  els.aqiFill.style.background = cat.color;

  scene.setWeatherCode(cur?.weather_code);
  renderTicker();
}

// ---------------------------------------------------------------------------
// Park cam inset — probe off-screen so a dead camera never flashes broken UI.

let camSeq = 0;

function renderCam(park) {
  const cams = park.cams || [];
  const seq = ++camSeq;
  if (!cams.length) {
    els.camPanel.hidden = true;
    return;
  }
  const cam = cams[0];
  const probe = new Image();
  probe.onload = () => {
    if (seq !== camSeq) return;
    els.camImage.src = probe.src;
    els.camLocation.textContent = cam.location;
    els.camPanel.hidden = false;
  };
  probe.onerror = () => {
    if (seq !== camSeq) return;
    els.camPanel.hidden = true;
  };
  probe.src = `${cam.url}${cam.url.includes("?") ? "&" : "?"}t=${Math.floor(Date.now() / CAM_REFRESH_MS)}`;
}

// ---------------------------------------------------------------------------
// Ticker

function renderTicker() {
  const parts = [];
  for (const park of PARKS) {
    const cur = dataCache.get(park.name)?.weather?.current;
    if (cur) {
      parts.push(
        `<span class="ticker-wx">${park.name.toUpperCase()} ${Math.round(cur.temperature_2m)}°F ${(
          WEATHER_TEXT[cur.weather_code] || ""
        ).toUpperCase()}</span>`
      );
    }
  }
  const facts = PARKS.map(
    (p) => `<span class="ticker-fact">${p.name.toUpperCase()}: ${p.fact.toUpperCase()}</span>`
  );
  const psas = PSAS.map((p) => `<span class="ticker-psa">${p}</span>`);
  const merged = [];
  const longest = Math.max(parts.length, facts.length, psas.length);
  for (let i = 0; i < longest; i += 1) {
    if (parts[i]) merged.push(parts[i]);
    if (facts[i]) merged.push(facts[i]);
    if (psas[i % psas.length] && i < psas.length) merged.push(psas[i]);
  }
  els.ticker.innerHTML = merged.join('<span aria-hidden="true">◆</span>');
}

// ---------------------------------------------------------------------------
// Procedural scenery

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCENE_PALETTES = {
  valley: { ridge: [64, 82, 66], far: [96, 118, 108], rock: [128, 122, 108] },
  geyser: { ridge: [70, 88, 64], far: [110, 124, 104], rock: [140, 130, 110] },
  canyon: { ridge: [122, 66, 44], far: [158, 96, 66], rock: [178, 112, 74] },
  mountain: { ridge: [58, 72, 84], far: [104, 120, 134], rock: [140, 148, 158] },
  forest: { ridge: [40, 66, 48], far: [78, 104, 84], rock: [110, 124, 104] },
  lake: { ridge: [56, 76, 78], far: [96, 118, 118], rock: [130, 142, 138] },
  ridges: { ridge: [58, 78, 88], far: [104, 126, 138], rock: [140, 156, 164] },
  coast: { ridge: [54, 72, 70], far: [96, 116, 112], rock: [128, 140, 130] },
};

const scene = (() => {
  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d");
  let built = null;
  let weatherCode = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ridgeLine(rand, segments, base, amp) {
    const pts = [];
    let y = base + (rand() - 0.5) * amp;
    for (let i = 0; i <= segments; i += 1) {
      y += (rand() - 0.5) * amp * 0.55;
      y = Math.max(base - amp, Math.min(base + amp, y));
      pts.push(y);
    }
    return pts;
  }

  function build(park) {
    const rand = mulberry32(hashSeed(park.name));
    const layers = [];
    const layerCount = park.scene === "canyon" ? 4 : 3;
    for (let i = 0; i < layerCount; i += 1) {
      layers.push({
        pts: ridgeLine(rand, 24, 0.42 + i * 0.13, 0.1 + i * 0.02),
        depth: i / (layerCount - 1),
        drift: 2 + i * 5,
      });
    }
    const stars = Array.from({ length: 90 }, () => ({ x: rand(), y: rand() * 0.55, s: rand() * 1.6 + 0.4, tw: rand() * 6 }));
    const trees = Array.from({ length: 26 }, () => ({ x: rand(), h: 0.05 + rand() * 0.06, w: 0.012 + rand() * 0.012 }));
    const clouds = Array.from({ length: 6 }, () => ({ x: rand(), y: 0.08 + rand() * 0.24, s: 0.5 + rand(), v: 0.004 + rand() * 0.006 }));
    built = { park, layers, stars, trees, clouds };
  }

  function localHour(park) {
    const tz = dataCache.get(park.name)?.tz;
    if (tz) {
      try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false })
          .formatToParts(new Date());
        const h = Number(parts.find((p) => p.type === "hour")?.value);
        const m = Number(parts.find((p) => p.type === "minute")?.value);
        if (Number.isFinite(h)) return h + (m || 0) / 60;
      } catch {
        /* fall through to viewer-local time */
      }
    }
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }

  // 0 = deep night, 1 = full day, with dawn/dusk ramps.
  function dayFactor(hour) {
    if (hour >= 7 && hour <= 18) return 1;
    if (hour > 18 && hour < 21) return 1 - (hour - 18) / 3;
    if (hour > 4 && hour < 7) return (hour - 4) / 3;
    return 0;
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function rgb(c, light, tint) {
    const t = tint || [0, 0, 0];
    return `rgb(${Math.round(mix(c[0] * 0.22, c[0], light) + t[0])}, ${Math.round(
      mix(c[1] * 0.22, c[1], light) + t[1]
    )}, ${Math.round(mix(c[2] * 0.25, c[2], light) + t[2])})`;
  }

  function drawSky(w, h, day, hour) {
    const dusk = day > 0 && day < 1;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (day >= 1) {
      g.addColorStop(0, "#5f9ec9");
      g.addColorStop(0.62, "#a8cbd8");
      g.addColorStop(1, "#d3dfd2");
    } else if (dusk) {
      const evening = hour > 12;
      g.addColorStop(0, evening ? "#2b3a5e" : "#3a4a6a");
      g.addColorStop(0.55, evening ? "#b06a4e" : "#c98a5a");
      g.addColorStop(1, evening ? "#e8a26b" : "#f0b878");
    } else {
      g.addColorStop(0, "#060a18");
      g.addColorStop(0.7, "#0c1428");
      g.addColorStop(1, "#141c2c");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawCelestial(w, h, day, t) {
    if (day > 0.25) {
      const x = w * 0.72;
      const y = h * (0.34 - day * 0.16);
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 110);
      glow.addColorStop(0, `rgba(255, 240, 200, ${0.85 * day})`);
      glow.addColorStop(1, "rgba(255, 240, 200, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 120, y - 120, 240, 240);
      ctx.fillStyle = `rgba(255, 250, 225, ${0.95 * day})`;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    if (day < 0.5) {
      const alpha = 1 - day * 2;
      for (const s of built.stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * 0.9 + s.tw);
        ctx.fillStyle = `rgba(235, 240, 255, ${alpha * tw * 0.9})`;
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      }
      ctx.fillStyle = `rgba(240, 240, 230, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.18, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(6, 10, 24, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(w * 0.2 - 8, h * 0.18 - 4, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawClouds(w, h, day, t) {
    const heavy = weatherCode != null && weatherCode >= 2;
    const count = heavy ? built.clouds.length : 3;
    for (let i = 0; i < count; i += 1) {
      const c = built.clouds[i];
      const x = ((c.x + t * c.v) % 1.3 - 0.15) * w;
      const y = c.y * h;
      const alpha = (heavy ? 0.5 : 0.28) * (0.35 + day * 0.65);
      ctx.fillStyle = day > 0.3 ? `rgba(245, 245, 240, ${alpha})` : `rgba(150, 160, 180, ${alpha * 0.6})`;
      for (let p = 0; p < 4; p += 1) {
        ctx.beginPath();
        ctx.ellipse(x + p * 34 * c.s, y + (p % 2) * 8, 42 * c.s, 15 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function layerPath(layer, w, h, t, yScale, yOffset) {
    const pts = layer.pts;
    const shift = (t * layer.drift) % w;
    ctx.beginPath();
    ctx.moveTo(-w, h);
    // Draw two tiled copies so the slow horizontal drift never shows a seam.
    for (let copy = -1; copy <= 1; copy += 1) {
      for (let i = 0; i < pts.length; i += 1) {
        const x = copy * w + (i / (pts.length - 1)) * w - shift;
        const y = (pts[i] * yScale + yOffset) * h;
        ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(w * 2, h);
    ctx.closePath();
  }

  function drawLayers(w, h, day, t) {
    const pal = SCENE_PALETTES[built.park.scene] || SCENE_PALETTES.forest;
    const canyon = built.park.scene === "canyon";
    for (const layer of built.layers) {
      const c = canyon ? pal.rock : layer.depth < 0.5 ? pal.far : pal.ridge;
      const shade = 1 - layer.depth * 0.45;
      ctx.fillStyle = rgb(
        [c[0] * shade, c[1] * shade, c[2] * shade],
        0.25 + day * 0.75,
        canyon ? [layer.depth * 24, layer.depth * 6, 0] : null
      );
      layerPath(layer, w, h, t, 1, 0);
      ctx.fill();
      if (canyon) {
        // Sandstone strata bands on each canyon tier.
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = day > 0.3 ? "#5a2f1c" : "#1c0f08";
        for (let y = 0.4; y < 1; y += 0.08) {
          ctx.fillRect(0, y * h + layer.depth * 30, w, 4);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      if (built.park.scene === "mountain" && layer.depth <= 0.5) {
        // Snowcap: repaint the top slice of the far ridges.
        ctx.save();
        layerPath(layer, w, h, t, 1, 0);
        ctx.clip();
        ctx.fillStyle = `rgba(240, 246, 250, ${0.35 + day * 0.5})`;
        ctx.fillRect(0, 0, w, h * (0.47 + layer.depth * 0.1));
        ctx.restore();
      }
    }
  }

  function drawForeground(w, h, day, t) {
    const s = built.park.scene;
    if (s === "lake" || s === "coast") {
      const waterTop = h * 0.78;
      const g = ctx.createLinearGradient(0, waterTop, 0, h);
      g.addColorStop(0, day > 0.3 ? "rgba(90, 130, 150, 0.9)" : "rgba(24, 38, 56, 0.92)");
      g.addColorStop(1, day > 0.3 ? "rgba(40, 70, 90, 0.95)" : "rgba(10, 18, 30, 0.95)");
      ctx.fillStyle = g;
      ctx.fillRect(0, waterTop, w, h - waterTop);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + day * 0.12})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i += 1) {
        const y = waterTop + 10 + i * ((h - waterTop) / 12);
        const wob = Math.sin(t * 1.4 + i) * 14;
        ctx.beginPath();
        ctx.moveTo(w * 0.08 + wob, y);
        ctx.lineTo(w * 0.4 + wob + i * 18, y);
        ctx.stroke();
      }
    }
    if (s === "forest" || s === "valley" || s === "geyser" || s === "lake") {
      for (const tree of built.trees) {
        const x = tree.x * w;
        const th = tree.h * h * (s === "forest" ? 1.4 : 1);
        const tw = tree.w * w;
        const baseY = h * (s === "lake" ? 0.78 : 0.97);
        ctx.fillStyle = `rgb(${Math.round(14 + day * 16)}, ${Math.round(26 + day * 24)}, ${Math.round(16 + day * 16)})`;
        for (let tier = 0; tier < 3; tier += 1) {
          const ty = baseY - th * (tier / 3);
          const half = tw * (1 - tier * 0.26);
          ctx.beginPath();
          ctx.moveTo(x - half, ty);
          ctx.lineTo(x + half, ty);
          ctx.lineTo(x, ty - th * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    if (s === "geyser") {
      // Animated steam column, Old Faithful style.
      const gx = w * 0.30;
      const base = h * 0.82;
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.5);
      for (let i = 0; i < 16; i += 1) {
        const p = i / 16;
        const y = base - p * h * 0.34 * pulse;
        const drift = Math.sin(t * 1.1 + i * 0.8) * 12 * p + p * 26;
        const r = 8 + p * 30;
        ctx.fillStyle = `rgba(235, 240, 240, ${(1 - p) * 0.24 * pulse})`;
        ctx.beginPath();
        ctx.arc(gx + drift, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPrecip(w, h, t) {
    if (weatherCode == null) return;
    const snow = weatherCode >= 71 && weatherCode <= 86 && weatherCode !== 80 && weatherCode !== 81 && weatherCode !== 82;
    const rain = (weatherCode >= 51 && weatherCode <= 67) || weatherCode === 80 || weatherCode === 81 || weatherCode === 82 || weatherCode >= 95;
    if (!snow && !rain) return;
    ctx.strokeStyle = "rgba(200, 220, 235, 0.35)";
    ctx.fillStyle = "rgba(240, 244, 250, 0.7)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 70; i += 1) {
      const px = ((i * 137.5 + t * (snow ? 26 : 320)) % (w + 40)) - 20;
      const py = (i * 79.3 + t * (snow ? 52 : 640)) % h;
      if (snow) {
        ctx.beginPath();
        ctx.arc(px + Math.sin(t + i) * 8, py, 2.1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 3, py + 13);
        ctx.stroke();
      }
    }
  }

  function frame(nowMs) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!built) build(currentPark());
    const t = nowMs / 1000;
    const hour = localHour(built.park);
    const day = dayFactor(hour);
    drawSky(w, h, day, hour);
    drawCelestial(w, h, day, t);
    drawClouds(w, h, day, t);
    drawLayers(w, h, day, t);
    drawForeground(w, h, day, t);
    drawPrecip(w, h, t);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setPark(park) {
      build(park);
    },
    setWeatherCode(code) {
      weatherCode = Number.isFinite(code) ? code : null;
    },
  };
})();

// ---------------------------------------------------------------------------
// Rotation

async function showStop() {
  const park = currentPark();
  els.parkName.textContent = park.name;
  els.parkSub.textContent = `National Park — ${park.state}`;
  els.pfEst.textContent = String(park.established);
  els.pfArea.textContent = `${park.acres.toLocaleString("en-US")} AC`;
  els.pfVisitors.textContent = park.visitors;
  els.pfFact.textContent = park.fact;
  els.parkLocalTime.textContent = "--:--";
  els.segment.textContent = `STOP ${(stopIndex % PARKS.length) + 1} OF ${PARKS.length}`;
  scene.setPark(park);
  scene.setWeatherCode(dataCache.get(park.name)?.weather?.current?.weather_code);
  renderCam(park);
  try {
    const data = await loadParkData(park);
    renderParkData(park, data);
  } catch {
    renderParkData(park, { weather: null, aqi: null });
  }
  tickClock();
  // Warm the next stop so its cards land populated.
  const next = PARKS[(stopIndex + 1) % PARKS.length];
  loadParkData(next).catch(() => {});
}

function advance() {
  stopIndex = (stopIndex + 1) % PARKS.length;
  showStop();
}

tickClock();
setInterval(tickClock, 1000);
showStop();
setInterval(advance, STOP_MS);
setInterval(renderTicker, 90 * 1000);

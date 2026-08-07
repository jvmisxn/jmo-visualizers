/* JMO Airport Channel — fake broadcast airport board.
 *
 * Data model: everything renders from providers in the DATA section.
 * Flights + advisories are seeded demo data (deterministic per day).
 * METAR attempts a live fetch from aviationweather.gov (public NOAA API,
 * no key) and falls back to seeded demo weather if unreachable.
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------- config

  const AIRPORT = {
    icao: "KSEA",
    iata: "SEA",
    name: "Seattle–Tacoma Intl",
    tz: "America/Los_Angeles",
    tzLabel: "PT",
  };

  const METAR_URL =
    "https://aviationweather.gov/api/data/metar?format=json&ids=" + AIRPORT.icao;
  const METAR_REFRESH_MS = 10 * 60 * 1000;

  const PAGE_FLIP_MS = 12000;
  const STATUS_ROTATE_MS = 14000;

  const AIRLINES = [
    ["AS", "Alaska"], ["DL", "Delta"], ["UA", "United"], ["AA", "American"],
    ["WN", "Southwest"], ["B6", "JetBlue"], ["QX", "Horizon"], ["NK", "Spirit"],
    ["F9", "Frontier"], ["HA", "Hawaiian"], ["BA", "British Airways"],
    ["LH", "Lufthansa"], ["NH", "ANA"], ["KE", "Korean Air"], ["AC", "Air Canada"],
  ];

  const DESTINATIONS = [
    "PORTLAND", "SAN FRANCISCO", "LOS ANGELES", "SAN DIEGO", "DENVER",
    "PHOENIX", "LAS VEGAS", "SALT LAKE CITY", "CHICAGO ORD", "DALLAS FW",
    "ATLANTA", "NEW YORK JFK", "NEWARK", "BOSTON", "WASHINGTON DCA",
    "MINNEAPOLIS", "ANCHORAGE", "FAIRBANKS", "JUNEAU", "SPOKANE",
    "BOISE", "SACRAMENTO", "SAN JOSE", "ORANGE COUNTY", "HONOLULU",
    "MAUI OGG", "VANCOUVER", "CALGARY", "TORONTO", "LONDON LHR",
    "FRANKFURT", "TOKYO NRT", "SEOUL ICN", "TAIPEI", "AMSTERDAM",
    "PARIS CDG", "DUBLIN", "REYKJAVIK", "MEXICO CITY", "AUSTIN",
  ];

  const GATE_CONCOURSES = ["A", "B", "C", "D", "N", "S"];

  const ADVISORIES = [
    "TSA GENERAL SCREENING WAIT: {tsa} MIN — CHECKPOINT 3 SHORTEST",
    "LIGHT RAIL TO DOWNTOWN DEPARTS EVERY 8 MIN FROM STATION LEVEL",
    "CELL PHONE LOT OPEN — FREE WAITING FOR ARRIVING PASSENGER PICKUP",
    "RUNWAY {rwy} ACTIVE FOR DEPARTURES — EXPECT NORMAL FLOW",
    "INTERNATIONAL ARRIVALS CLEAR CUSTOMS AT SOUTH SATELLITE",
    "GARAGE LEVELS 5-7 NEAR CAPACITY — OVERFLOW PARKING AVAILABLE",
    "PET RELIEF AREAS LOCATED PRE- AND POST-SECURITY",
    "CHECKED BAG CUTOFF: 45 MIN DOMESTIC / 60 MIN INTERNATIONAL",
    "GROUND STOP NOT IN EFFECT — FIELD OPERATING NORMALLY",
    "VISIT THE OBSERVATION DECK — CONCOURSE A MEZZANINE",
  ];

  const STATUS_MESSAGES = [
    ["RAMP OPERATIONS", "Monitoring airfield movement, gate turns, and terminal flow."],
    ["TERMINAL FLOW", "Checkpoint queues moving steadily. Allow extra time during the morning bank."],
    ["GROUND CONTROL", "Taxiway alpha in use for eastbound movement. Follow marshaller guidance on the ramp."],
    ["BAGGAGE DESK", "Carousel assignments posted on arrival monitors five minutes after touchdown."],
    ["AIRFIELD DESK", "Runway inspection complete. All surfaces reported clean and dry."],
    ["GATE OPERATIONS", "Aircraft turns averaging on schedule across all concourses."],
    ["NETWORK DESK", "JMO Airport Channel — continuous departure, arrival, and field condition coverage."],
  ];

  // ---------------------------------------------------------------- seeded rng

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function daySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  // ---------------------------------------------------------------- DATA: flights

  // Generates a deterministic all-day schedule; statuses are derived live
  // from the wall clock so the board evolves in real time.
  function buildSchedule(kind) {
    const rng = mulberry32(daySeed() + (kind === "DEP" ? 17 : 71));
    const flights = [];
    const used = new Set();
    for (let m = 5 * 60; m < 24 * 60; m += 6 + Math.floor(rng() * 14)) {
      const [code] = pick(rng, AIRLINES);
      let num;
      do { num = 100 + Math.floor(rng() * 2800); } while (used.has(code + num));
      used.add(code + num);
      flights.push({
        minutes: m,
        flight: code + " " + num,
        city: pick(rng, DESTINATIONS),
        gate: pick(rng, GATE_CONCOURSES) + (1 + Math.floor(rng() * 20)),
        delay: rng() < 0.14 ? 15 + Math.floor(rng() * 75) : 0,
        cancelled: rng() < 0.015,
      });
    }
    return flights;
  }

  function fmtTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }

  function depStatus(f, now) {
    const t = f.minutes + f.delay;
    if (f.cancelled) return ["CANCELLED", "st-cancelled"];
    if (now >= t) return ["DEPARTED", "st-departed"];
    if (now >= t - 12) return ["FINAL CALL", "st-final"];
    if (now >= t - 38) return ["BOARDING", "st-boarding"];
    if (f.delay) return ["DELAYED " + fmtTime(t), "st-delayed"];
    return ["ON TIME", "st-ontime"];
  }

  function arrStatus(f, now) {
    const t = f.minutes + f.delay;
    if (f.cancelled) return ["CANCELLED", "st-cancelled"];
    if (now >= t) return ["LANDED", "st-landed"];
    if (f.delay) return ["EXP " + fmtTime(t), "st-delayed"];
    if (now >= t - 45) return ["ON APPROACH", "st-boarding"];
    return ["ON TIME", "st-ontime"];
  }

  // Board window: a few recently-departed rows for realism, rest upcoming.
  function boardWindow(flights, now, count) {
    const idx = flights.findIndex((f) => f.minutes + f.delay >= now - 8);
    const start = Math.max(0, idx < 0 ? flights.length - count : idx);
    return flights.slice(start, start + count * 2);
  }

  // ---------------------------------------------------------------- DATA: weather

  const weather = {
    raw: null,
    live: false,
    wind: "---", vis: "---", temp: "---", altim: "---",
    ceiling: "---", cat: "VFR",
  };

  function demoMetar() {
    const rng = mulberry32(daySeed() + Math.floor(nowMinutes() / 30));
    const dir = Math.round((16 + rng() * 20)) * 10 % 360;
    const spd = 4 + Math.floor(rng() * 12);
    const t = 11 + Math.floor(rng() * 12);
    const dew = t - 2 - Math.floor(rng() * 6);
    const alt = (29.7 + rng() * 0.6).toFixed(2);
    const layers = rng() < 0.5 ? "FEW045 SCT120" : "BKN025 OVC060";
    const z = new Date();
    const stamp =
      String(z.getUTCDate()).padStart(2, "0") +
      String(z.getUTCHours()).padStart(2, "0") + "00Z";
    return (
      AIRPORT.icao + " " + stamp + " " +
      String(dir).padStart(3, "0") + String(spd).padStart(2, "0") + "KT 10SM " +
      layers + " " + String(t).padStart(2, "0") + "/" +
      String(dew).padStart(2, "0") + " A" + alt.replace(".", "")
    );
  }

  function parseMetar(raw) {
    weather.raw = raw;
    const wind = raw.match(/(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT/);
    weather.wind = wind
      ? wind[1] + "° @ " + Number(wind[2]) + (wind[4] ? "G" + Number(wind[4]) : "") + " KT"
      : "CALM";
    const vis = raw.match(/ (\d{1,2}(?: \d\/\d)?|\d\/\d)SM /);
    weather.vis = vis ? vis[1] + " SM" : "10+ SM";
    const td = raw.match(/ (M?\d{2})\/(M?\d{2}) /);
    weather.temp = td
      ? td[1].replace("M", "-") + "° / " + td[2].replace("M", "-") + "°C"
      : "---";
    const alt = raw.match(/ A(\d{4})/);
    weather.altim = alt ? (Number(alt[1]) / 100).toFixed(2) + " inHg" : "---";
    const ceil = raw.match(/(BKN|OVC|VV)(\d{3})/);
    weather.ceiling = ceil ? Number(ceil[2]) * 100 + " FT" : "UNL";

    const visNum = vis ? Number((vis[1].split(" ")[0] || "10").split("/")[0]) : 10;
    const ceilNum = ceil ? Number(ceil[2]) * 100 : 99999;
    weather.cat =
      ceilNum < 500 || visNum < 1 ? "LIFR" :
      ceilNum < 1000 || visNum < 3 ? "IFR" :
      ceilNum <= 3000 || visNum <= 5 ? "MVFR" : "VFR";
  }

  async function refreshMetar() {
    try {
      const signal =
        typeof AbortSignal !== "undefined" && AbortSignal.timeout
          ? AbortSignal.timeout(8000)
          : undefined;
      const res = await fetch(METAR_URL, { signal });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      const raw = Array.isArray(data) && data[0] && data[0].rawOb;
      if (!raw) throw new Error("no rawOb");
      weather.live = true;
      parseMetar(raw);
    } catch (err) {
      weather.live = false;
      parseMetar(demoMetar());
    }
    renderWeather();
  }

  // ---------------------------------------------------------------- render

  const $ = (id) => document.getElementById(id);

  const departures = buildSchedule("DEP");
  const arrivals = buildSchedule("ARR");
  let depPage = 0;
  let arrPage = 0;
  let statusIdx = 0;

  function makeRow(f, now, statusFn, compact) {
    const [label, cls] = statusFn(f, now);
    const row = document.createElement("div");
    row.className = "board-row flip" + (compact ? " compact" : "");
    const cells = compact
      ? [fmtTime(f.minutes), f.flight, f.city, label]
      : [fmtTime(f.minutes), f.flight, f.city, f.gate, label];
    cells.forEach((text, i) => {
      const span = document.createElement("span");
      span.textContent = text;
      if (i === cells.length - 1) span.className = cls;
      row.appendChild(span);
    });
    return row;
  }

  function renderBoard(el, pageEl, flights, page, statusFn, compact) {
    const now = nowMinutes();
    el.innerHTML = "";
    // Probe row to measure real row height, then size the page to fit.
    const probe = makeRow(flights[0], now, statusFn, compact);
    el.appendChild(probe);
    const rowH = probe.offsetHeight || 28;
    const count = Math.max(4, Math.floor(el.clientHeight / rowH));
    const win = boardWindow(flights, now, count);
    const pages = Math.max(1, Math.ceil(win.length / count));
    const p = page % pages;
    pageEl.textContent = (p + 1) + "/" + pages;
    el.innerHTML = "";
    for (const f of win.slice(p * count, p * count + count)) {
      el.appendChild(makeRow(f, now, statusFn, compact));
    }
    return p;
  }

  function renderBoards(flip) {
    if (flip) { depPage++; arrPage++; }
    depPage = renderBoard($("dep-rows"), $("dep-page"), departures, depPage, depStatus, false);
    arrPage = renderBoard($("arr-rows"), $("arr-page"), arrivals, arrPage, arrStatus, true);
  }

  function renderWeather() {
    $("wx-wind").textContent = weather.wind;
    $("wx-vis").textContent = weather.vis;
    $("wx-temp").textContent = weather.temp;
    $("wx-altim").textContent = weather.altim;
    $("wx-ceiling").textContent = weather.ceiling;
    const cat = $("wx-cat");
    cat.textContent = weather.cat;
    cat.className = "wx-value cat-" + weather.cat.toLowerCase();
    $("metar-raw").textContent = weather.raw || "METAR UNAVAILABLE";
    $("wx-source").textContent = weather.live
      ? "LIVE — AVIATIONWEATHER.GOV"
      : "DEMO DATA — LIVE FEED UNREACHABLE";
  }

  function renderClocks() {
    const d = new Date();
    $("clock-local").textContent =
      d.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: AIRPORT.tz,
      }) + " " + AIRPORT.tzLabel;
    $("clock-zulu").textContent =
      String(d.getUTCHours()).padStart(2, "0") + ":" +
      String(d.getUTCMinutes()).padStart(2, "0") + "Z";
  }

  function renderStatus() {
    const [label, text] = STATUS_MESSAGES[statusIdx % STATUS_MESSAGES.length];
    $("status-label").textContent = label;
    $("status-text").textContent = text;
    statusIdx++;
  }

  function renderTicker() {
    const rng = mulberry32(daySeed() + 5);
    const rwy = pick(rng, ["16L", "16C", "16R", "34L", "34C", "34R"]);
    const tsa = 8 + Math.floor(rng() * 22);
    const items = ADVISORIES.map((a) =>
      a.replace("{tsa}", String(tsa)).replace("{rwy}", rwy)
    );
    const delayed = departures.filter(
      (f) => f.delay && !f.cancelled && f.minutes + f.delay > nowMinutes()
    ).slice(0, 4);
    for (const f of delayed) {
      items.push("DELAY ADVISORY: " + f.flight + " TO " + f.city +
        " NOW DEPARTING " + fmtTime(f.minutes + f.delay));
    }
    $("ticker-text").textContent = items.join("   •••   ") + "   •••   ";
  }

  // ---------------------------------------------------------------- airfield canvas

  // Stylized ground-radar view: three parallel runways (SEA-style),
  // taxiways, terminal, and aircraft blips rolling/arriving.
  const canvas = $("airfield");
  const ctx = canvas.getContext("2d");
  let planes = [];
  const planeRng = mulberry32(daySeed() + 999);

  function resize() {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  }
  window.addEventListener("resize", () => {
    resize();
    renderBoards(false);
  });
  resize();

  function spawnPlane() {
    const arriving = planeRng() < 0.5;
    planes.push({
      runway: Math.floor(planeRng() * 3),
      arriving,
      t: 0,
      speed: 0.0011 + planeRng() * 0.0007,
      trail: [],
    });
  }

  function drawAirfield(dt) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Ground plane tint
    ctx.fillStyle = "rgba(20, 26, 16, 0.6)";
    ctx.fillRect(0, 0, w, h);

    // Runways: three parallel, slightly rotated
    const cx = w * 0.52;
    const cy = h * 0.52;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.32);
    const rwLen = h * 0.95;
    const spacing = w * 0.09;
    for (let i = -1; i <= 1; i++) {
      const x = i * spacing;
      ctx.strokeStyle = "rgba(200, 210, 190, 0.28)";
      ctx.lineWidth = 14 * devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(x, -rwLen / 2);
      ctx.lineTo(x, rwLen / 2);
      ctx.stroke();
      // centerline dashes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.setLineDash([14 * devicePixelRatio, 18 * devicePixelRatio]);
      ctx.beginPath();
      ctx.moveTo(x, -rwLen / 2);
      ctx.lineTo(x, rwLen / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // taxiway connectors
    ctx.strokeStyle = "rgba(255, 216, 107, 0.16)";
    ctx.lineWidth = 5 * devicePixelRatio;
    for (let j = -3; j <= 3; j++) {
      ctx.beginPath();
      ctx.moveTo(-spacing, (j * rwLen) / 7);
      ctx.lineTo(spacing * 1.7, (j * rwLen) / 7 + spacing * 0.4);
      ctx.stroke();
    }
    // terminal block
    ctx.fillStyle = "rgba(255, 182, 56, 0.13)";
    ctx.strokeStyle = "rgba(255, 182, 56, 0.4)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    ctx.roundRect(spacing * 1.8, -rwLen * 0.18, spacing * 1.1, rwLen * 0.38, 10);
    ctx.fill();
    ctx.stroke();

    // planes
    for (const p of planes) {
      p.t += p.speed * dt;
      const x = (p.runway - 1) * spacing;
      const prog = p.arriving ? 1 - p.t : p.t;
      const y = -rwLen / 2 + prog * rwLen;
      // altitude fade at the departure/arrival end
      const airborne = p.arriving ? p.t < 0.25 : p.t > 0.75;
      p.trail.push([x, y]);
      if (p.trail.length > 14) p.trail.shift();
      ctx.strokeStyle = p.arriving
        ? "rgba(123, 231, 255, 0.35)"
        : "rgba(109, 242, 142, 0.35)";
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.beginPath();
      p.trail.forEach(([tx, ty], i) =>
        i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty)
      );
      ctx.stroke();
      ctx.fillStyle = p.arriving ? "#7be7ff" : "#6df28e";
      ctx.globalAlpha = airborne ? 0.55 : 1;
      ctx.beginPath();
      ctx.arc(x, y, (airborne ? 7 : 5) * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    planes = planes.filter((p) => p.t < 1);
    ctx.restore();

    // rotating beacon sweep
    const sweep = (performance.now() / 4000) % (Math.PI * 2);
    const grad = ctx.createConicGradient
      ? ctx.createConicGradient(sweep, cx, cy)
      : null;
    if (grad) {
      grad.addColorStop(0, "rgba(255, 182, 56, 0.10)");
      grad.addColorStop(0.06, "rgba(255, 182, 56, 0)");
      grad.addColorStop(1, "rgba(255, 182, 56, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - lastFrame);
    lastFrame = now;
    drawAirfield(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  renderClocks();
  renderBoards(false);
  renderStatus();
  renderTicker();
  refreshMetar();
  spawnPlane();
  spawnPlane();
  requestAnimationFrame(frame);

  setInterval(renderClocks, 1000);
  setInterval(() => renderBoards(true), PAGE_FLIP_MS);
  setInterval(renderStatus, STATUS_ROTATE_MS);
  setInterval(renderTicker, 90 * 1000);
  setInterval(refreshMetar, METAR_REFRESH_MS);
  setInterval(() => { if (planes.length < 4) spawnPlane(); }, 6500);
})();

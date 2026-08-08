/* JMO Airport Channel — real-data-only airport status board.
 *
 * Reads airport-channel/data.json, generated from FAA NAS Status and NOAA
 * AviationWeather. No synthetic flight rows or demo weather are shown.
 */
(() => {
  "use strict";

  const AIRPORT = {
    icao: "KSEA",
    iata: "SEA",
    name: "Seattle-Tacoma Intl",
    tz: "America/Los_Angeles",
    tzLabel: "PT",
  };

  const DATA_URL = "./data.json?v=" + Math.floor(Date.now() / (5 * 60 * 1000));
  const PAGE_FLIP_MS = 12000;
  const STATUS_ROTATE_MS = 14000;
  const CAMERA_ROTATE_MS = 30000;

  const CAMERA_STOPS = [
    {
      type: "iframe",
      source: "KING COUNTY AIRPORT",
      location: "Boeing Field Camera 1",
      lat: 47.5368,
      lon: -122.3039,
      url: "https://player.invintus.com/index.html?clientID=6779541715&encoder=%7B%22encoderID%22%3A%22tifkljs1%22%2C%22streamName%22%3A%22KCIA-camera1%22%2C%22live247URI%22%3A%22https%3A%2F%2Fapi.v3.invintus.com%2FStreamURI%2Fpersis%2F6779541715%2FKCIA-camera1%2Fmedia.m3u8%22%7D&model=%7B%22key%22%3A%22encoder%22%2C%22encoderID%22%3A%22uid%22%2C%22streamName%22%3A%22name%22%2C%22live247URI%22%3A%22uri%22%7D&player=%7B%22autoStart%22%3Atrue%2C%22trackAnalytics%22%3Afalse%7D",
    },
    {
      type: "iframe",
      source: "KING COUNTY AIRPORT",
      location: "Boeing Field Camera 2",
      lat: 47.5368,
      lon: -122.3039,
      url: "https://player.invintus.com/index.html?clientID=6779541715&encoder=%7B%22encoderID%22%3A%22g5wjadzz%22%2C%22streamName%22%3A%22KCIA-camera2%22%2C%22live247URI%22%3A%22https%3A%2F%2Fapi.v3.invintus.com%2FStreamURI%2Fpersis%2F6779541715%2FKCIA-camera2%2Fmedia.m3u8%22%7D&model=%7B%22key%22%3A%22encoder%22%2C%22encoderID%22%3A%22uid%22%2C%22streamName%22%3A%22name%22%2C%22live247URI%22%3A%22uri%22%7D&player=%7B%22autoStart%22%3Atrue%2C%22trackAnalytics%22%3Afalse%7D",
    },
    {
      type: "image",
      source: "WASAR / MODERN AVIATION",
      location: "Boeing Field Northwest",
      lat: 47.5368,
      lon: -122.3039,
      url: "https://kbfi.wasar.org/north.jpg",
    },
    {
      type: "image",
      source: "WASAR / MODERN AVIATION",
      location: "Boeing Field Southwest",
      lat: 47.5368,
      lon: -122.3039,
      url: "https://kbfi.wasar.org/south.jpg",
    },
  ];

  const STATUS_MESSAGES = [
    ["LIVE DATA DESK", "FAA NAS status and NOAA aviation weather snapshots only. No simulated flights on this channel."],
    ["SOURCE POLICY", "If a feed is down, this board marks the module unavailable instead of filling with placeholder data."],
    ["AIRFIELD VIEW", "Background is a stylized visualization; operational status comes from the data boards."],
  ];

  const $ = (id) => document.getElementById(id);

  let snapshot = null;
  let depPage = 0;
  let arrPage = 0;
  let statusIdx = 0;
  let cameraIdx = 0;
  let map = null;
  let cameraMarker = null;

  function fmtTime(ms) {
    if (!Number.isFinite(ms)) return "--:--";
    return new Date(ms).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: AIRPORT.tz,
    });
  }

  function ageText(ms) {
    if (!Number.isFinite(ms)) return "UNKNOWN AGE";
    const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
    return mins < 1 ? "UPDATED JUST NOW" : `UPDATED ${mins} MIN AGO`;
  }

  async function loadData() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      snapshot = await res.json();
    } catch {
      snapshot = null;
    }
    renderAll();
  }

  function eventRows() {
    const events = snapshot?.faa?.events || [];
    if (!snapshot?.faa?.available) {
      return [{
        time: "--:--",
        flight: "FAA",
        city: "NAS STATUS FEED",
        gate: "--",
        status: "UNAVAILABLE",
        cls: "st-cancelled",
      }];
    }
    if (!events.length) {
      return [{
        time: fmtTime(snapshot.generatedAt),
        flight: AIRPORT.iata,
        city: "NO ACTIVE FAA NAS DELAYS",
        gate: "NAS",
        status: "NORMAL",
        cls: "st-ontime",
      }];
    }
    return events.map((event) => ({
      time: event.start || fmtTime(snapshot.generatedAt),
      flight: event.airport || AIRPORT.iata,
      city: event.type || "FAA EVENT",
      gate: event.trend || "NAS",
      status: event.maxDelay || event.minDelay || event.end || "ACTIVE",
      cls: /closure|stop|delay/i.test(event.type || "") ? "st-delayed" : "st-boarding",
      reason: event.reason,
    }));
  }

  function forecastRows() {
    const rows = [];
    if (snapshot?.metar) {
      rows.push({
        time: fmtTime(snapshot.generatedAt),
        flight: "METAR",
        city: snapshot.metar.category || "FIELD CONDITIONS",
        status: snapshot.metar.wind || "LIVE",
        cls: "st-ontime",
      });
    }
    if (snapshot?.taf) {
      rows.push({
        time: fmtTime(snapshot.generatedAt),
        flight: "TAF",
        city: "TERMINAL FORECAST",
        status: "ISSUED",
        cls: "st-boarding",
      });
    }
    if (!rows.length) {
      rows.push({
        time: "--:--",
        flight: "NOAA",
        city: "AVIATION WEATHER",
        status: "UNAVAILABLE",
        cls: "st-cancelled",
      });
    }
    return rows;
  }

  function makeRow(row, compact) {
    const el = document.createElement("div");
    el.className = "board-row flip" + (compact ? " compact" : "");
    const cells = compact
      ? [row.time, row.flight, row.city, row.status]
      : [row.time, row.flight, row.city, row.gate || "--", row.status];
    cells.forEach((text, idx) => {
      const span = document.createElement("span");
      span.textContent = String(text || "--").toUpperCase();
      if (idx === cells.length - 1) span.className = row.cls || "";
      el.appendChild(span);
    });
    return el;
  }

  function renderBoard(el, pageEl, rows, page, compact) {
    el.innerHTML = "";
    const probe = makeRow(rows[0], compact);
    el.appendChild(probe);
    const rowH = probe.offsetHeight || 28;
    const count = Math.max(4, Math.floor(el.clientHeight / rowH));
    const pages = Math.max(1, Math.ceil(rows.length / count));
    const p = page % pages;
    pageEl.textContent = (p + 1) + "/" + pages;
    el.innerHTML = "";
    rows.slice(p * count, p * count + count).forEach((row) => el.appendChild(makeRow(row, compact)));
    return p;
  }

  function renderBoards(flip = false) {
    if (flip) { depPage++; arrPage++; }
    depPage = renderBoard($("dep-rows"), $("dep-page"), eventRows(), depPage, false);
    arrPage = renderBoard($("arr-rows"), $("arr-page"), forecastRows(), arrPage, true);
  }

  function renderWeather() {
    const metar = snapshot?.metar;
    $("wx-wind").textContent = metar?.wind || "---";
    $("wx-vis").textContent = metar?.visibility || "---";
    $("wx-temp").textContent = metar?.tempDew || "---";
    $("wx-altim").textContent = metar?.altimeter || "---";
    $("wx-ceiling").textContent = metar?.ceiling || "---";
    const cat = $("wx-cat");
    cat.textContent = metar?.category || "---";
    cat.className = "wx-value cat-" + String(metar?.category || "vfr").toLowerCase();
    $("metar-raw").textContent = metar?.raw || "NOAA AVIATION WEATHER SNAPSHOT UNAVAILABLE";
    $("wx-source").textContent = snapshot
      ? `REAL DATA — ${snapshot.provider} — ${ageText(snapshot.generatedAt)}`
      : "LIVE SNAPSHOT UNAVAILABLE";
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
    $("airport-code").textContent = AIRPORT.iata;
    $("airport-name").textContent = AIRPORT.name;
  }

  function renderStatus() {
    const [label, text] = STATUS_MESSAGES[statusIdx % STATUS_MESSAGES.length];
    $("status-label").textContent = label;
    $("status-text").textContent = text;
    statusIdx++;
  }

  function renderTicker() {
    const items = [];
    if (snapshot?.faa?.updateTime) items.push(`FAA NAS UPDATE ${snapshot.faa.updateTime}`);
    if (snapshot?.metar?.raw) items.push(snapshot.metar.raw);
    if (snapshot?.taf) items.push(snapshot.taf);
    for (const event of snapshot?.faa?.events || []) {
      items.push(`${event.type}: ${event.reason || event.maxDelay || "ACTIVE"}`);
    }
    if (!items.length) items.push("LIVE AIRPORT DATA SNAPSHOT UNAVAILABLE");
    $("ticker-text").textContent = items.join("   •••   ") + "   •••   ";
  }

  function initMap() {
    if (!window.L) return;
    map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    }).setView([47.54, -122.31], 10);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 13,
      minZoom: 3,
      opacity: 0.98,
    }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 13,
      minZoom: 3,
      opacity: 0.82,
    }).addTo(map);
    [
      { label: "SEA", lat: 47.4502, lon: -122.3088 },
      { label: "BFI", lat: 47.53, lon: -122.3019 },
      { label: "RNT", lat: 47.4931, lon: -122.2158 },
      { label: "PAE", lat: 47.9063, lon: -122.2816 },
    ].forEach((item) => {
      L.marker([item.lat, item.lon], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<div class="airport-marker"></div><div class="airport-label">${item.label}</div>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        }),
      }).addTo(map);
    });
  }

  function renderCamera() {
    const camera = CAMERA_STOPS[cameraIdx % CAMERA_STOPS.length];
    const frame = $("camera-frame");
    const image = $("camera-image");
    $("camera-source").textContent = camera.source;
    $("camera-location").textContent = camera.location;
    $("camera-updated").textContent = camera.type === "image" ? "updates about every 30 sec" : "24/7 stream";
    if (camera.type === "iframe") {
      if (frame.src !== camera.url) frame.src = camera.url;
      frame.hidden = false;
      image.hidden = true;
    } else {
      image.src = camera.url + "?v=" + Math.floor(Date.now() / 30000);
      image.hidden = false;
      frame.hidden = true;
    }
    if (map) {
      map.flyTo([camera.lat, camera.lon], 11, { animate: true, duration: 1.5 });
      if (cameraMarker) cameraMarker.remove();
      cameraMarker = L.circleMarker([camera.lat, camera.lon], {
        radius: 18,
        color: "#ffb638",
        weight: 2,
        fillColor: "#6df28e",
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(map);
    }
    cameraIdx++;
  }

  function renderAll() {
    renderClocks();
    renderBoards(false);
    renderWeather();
    renderTicker();
  }

  // ---------------------------------------------------------------- airfield canvas

  const canvas = $("airfield");
  const ctx = canvas.getContext("2d");
  let planes = [];

  function resize() {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  }
  window.addEventListener("resize", () => {
    resize();
    renderBoards(false);
    if (map) setTimeout(() => map.invalidateSize(), 50);
  });
  resize();

  function spawnPlane() {
    planes.push({
      runway: Math.floor(Math.random() * 3),
      arriving: Math.random() < 0.5,
      t: 0,
      speed: 0.0011 + Math.random() * 0.0007,
      trail: [],
    });
  }

  function drawAirfield(dt) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(20, 26, 16, 0.6)";
    ctx.fillRect(0, 0, w, h);

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
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.setLineDash([14 * devicePixelRatio, 18 * devicePixelRatio]);
      ctx.beginPath();
      ctx.moveTo(x, -rwLen / 2);
      ctx.lineTo(x, rwLen / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "rgba(255, 216, 107, 0.16)";
    ctx.lineWidth = 5 * devicePixelRatio;
    for (let j = -3; j <= 3; j++) {
      ctx.beginPath();
      ctx.moveTo(-spacing, (j * rwLen) / 7);
      ctx.lineTo(spacing * 1.7, (j * rwLen) / 7 + spacing * 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 182, 56, 0.13)";
    ctx.strokeStyle = "rgba(255, 182, 56, 0.4)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    ctx.roundRect(spacing * 1.8, -rwLen * 0.18, spacing * 1.1, rwLen * 0.38, 10);
    ctx.fill();
    ctx.stroke();

    for (const p of planes) {
      p.t += p.speed * dt;
      const x = (p.runway - 1) * spacing;
      const prog = p.arriving ? 1 - p.t : p.t;
      const y = -rwLen / 2 + prog * rwLen;
      const airborne = p.arriving ? p.t < 0.25 : p.t > 0.75;
      p.trail.push([x, y]);
      if (p.trail.length > 14) p.trail.shift();
      ctx.strokeStyle = p.arriving ? "rgba(123, 231, 255, 0.35)" : "rgba(109, 242, 142, 0.35)";
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.beginPath();
      p.trail.forEach(([tx, ty], i) => i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty));
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

    const sweep = (performance.now() / 4000) % (Math.PI * 2);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null;
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

  renderStatus();
  renderAll();
  loadData();
  initMap();
  renderCamera();
  spawnPlane();
  spawnPlane();
  requestAnimationFrame(frame);

  setInterval(renderClocks, 1000);
  setInterval(() => renderBoards(true), PAGE_FLIP_MS);
  setInterval(renderStatus, STATUS_ROTATE_MS);
  setInterval(loadData, 5 * 60 * 1000);
  setInterval(renderCamera, CAMERA_ROTATE_MS);
  setInterval(() => { if (planes.length < 4) spawnPlane(); }, 6500);
})();

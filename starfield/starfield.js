const canvas = document.querySelector("#starfield");
const ctx = canvas.getContext("2d", { alpha: false });
const params = new URLSearchParams(window.location.search);

const config = {
  density: numberParam("density", 900, 120, 2400),
  speed: numberParam("speed", 1, 0.05, 4),
  warp: numberParam("warp", 1, 0.05, 3),
  hue: numberParam("hue", 198, 0, 360),
  tint: numberParam("tint", 0.58, 0, 1),
  trails: numberParam("trails", 0.23, 0, 0.7),
  pulse: numberParam("pulse", 1, 0, 2),
  dpr: numberParam("dpr", 0, 0, 2),
  fps: numberParam("fps", 0, 0, 120),
  pointer: boolParam("pointer", true),
  audio: boolParam("audio", false),
  nebula: boolParam("nebula", true),
  glow: boolParam("glow", true),
  debug: boolParam("debug", false),
  seed: stringParam("seed", ""),
};

const pointer = {
  x: 0,
  y: 0,
  active: false,
};

const drift = { x: 0, y: 0 };

let width = 1;
let height = 1;
let centerX = 0;
let centerY = 0;
let focalLength = 1;
let stars = [];
let nebula = [];
let nebulaLayer = null;
let audioLevel = 0;
let bassLevel = 0;
let smoothLevel = 0;
let audioStarted = false;
let audioContext = null;
let analyser = null;
let frequencyData = null;
let lastTime = performance.now();
let lastRenderTime = 0;
const rand = config.seed ? mulberry32(hashString(config.seed)) : Math.random;

resize();
resetStars();
if (config.audio) void startAudio();
requestAnimationFrame(frame);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const previousWidth = width;
    const previousHeight = height;
    resize();
    if (width !== previousWidth || height !== previousHeight) resetStars();
  }, 150);
});

window.addEventListener("pointermove", (event) => {
  if (!config.pointer) return;
  pointer.active = true;
  pointer.x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
  pointer.y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
});

// pointerleave does not bubble and its leave sequence tops out at document,
// so a window listener never fires and drift would freeze at the last pointer
// offset. Listen on document, and also release on blur/tab-hide.
document.addEventListener("pointerleave", () => {
  pointer.active = false;
});

window.addEventListener("blur", () => {
  pointer.active = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pointer.active = false;
});

window.addEventListener("pointerdown", () => {
  void startAudio();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m") {
    void startAudio();
  }
});

function stringParam(name, fallback) {
  return params.get(name) || fallback;
}

function boolParam(name, fallback) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

function numberParam(name, fallback, min = -Infinity, max = Infinity) {
  const raw = params.get(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function resize() {
  const dpr = config.dpr || Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(window.innerWidth * dpr));
  height = Math.max(1, Math.floor(window.innerHeight * dpr));
  canvas.width = width;
  canvas.height = height;
  centerX = width * 0.5;
  centerY = height * 0.5;
  focalLength = Math.min(width, height) * 0.72;
}

function resetStars() {
  const cssArea = Math.max(1, window.innerWidth * window.innerHeight);
  const count = Math.max(120, Math.round(config.density * Math.sqrt(cssArea / (1920 * 1080))));
  stars = Array.from({ length: count }, () => makeStar(rand() * 1.9 + 0.1));
  nebula = Array.from({ length: 18 }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: Math.min(width, height) * (0.11 + rand() * 0.28),
    hue: config.hue + (rand() - 0.5) * 72,
    alpha: 0.018 + rand() * 0.036,
  }));
  nebulaLayer = buildNebulaLayer();
}

function makeStar(depth = rand() * 2 + 0.05) {
  const spread = 1.8;
  const warm = rand() < 0.1;
  const hue = warm ? 32 + rand() * 26 : config.hue + (rand() - 0.5) * 46;
  return {
    x: (rand() - 0.5) * width * spread,
    y: (rand() - 0.5) * height * spread,
    z: depth,
    size: 0.45 + rand() * 2.1,
    hue,
    twinkle: rand() * Math.PI * 2,
    twinkleAmount: rand() * 0.34,
    lane: rand(),
  };
}

function frame(now) {
  if (config.fps > 0) {
    const interval = 1000 / config.fps;
    if (now - lastRenderTime < interval) {
      requestAnimationFrame(frame);
      return;
    }
    // Carry the overshoot so the cap averages the requested rate instead of
    // snapping down to the next-lowest rAF-aligned rate (e.g. 30 -> ~20fps).
    lastRenderTime = now - ((now - lastRenderTime) % interval);
  } else {
    lastRenderTime = now;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateAudio(now);
  render(dt, now / 1000);
  requestAnimationFrame(frame);
}

function updateAudio(now) {
  if (!analyser || !frequencyData) {
    audioLevel = 0;
    bassLevel = 0;
    smoothLevel *= 0.94;
    return;
  }

  analyser.getByteFrequencyData(frequencyData);
  let bass = 0;
  let mids = 0;
  const bassBins = Math.max(2, Math.floor(frequencyData.length * 0.08));
  const midBins = Math.max(bassBins + 1, Math.floor(frequencyData.length * 0.34));

  for (let i = 0; i < bassBins; i += 1) bass += frequencyData[i];
  for (let i = bassBins; i < midBins; i += 1) mids += frequencyData[i];

  bassLevel = clamp01(bass / bassBins / 255);
  audioLevel = clamp01(mids / (midBins - bassBins) / 255);
  smoothLevel += (Math.max(audioLevel, bassLevel) - smoothLevel) * 0.18;
}

function render(dt, time) {
  const trailAlpha = clamp(0.06 + config.trails * 0.38 - bassLevel * 0.045, 0.045, 0.34);
  ctx.fillStyle = `rgba(0, 0, 9, ${trailAlpha})`;
  ctx.fillRect(0, 0, width, height);

  drawNebula();

  const pulse = 1 + bassLevel * 2.1 * config.pulse;
  const travel = 0.62 * config.speed;
  // Ease toward the drift target so toggling between pointer-driven and idle
  // drift glides instead of snapping the whole field sideways.
  const driftTargetX = pointer.active ? pointer.x * 54 : Math.sin(time * 0.23) * 14;
  const driftTargetY = pointer.active ? pointer.y * 38 : Math.cos(time * 0.19) * 10;
  const driftEase = 1 - Math.exp(-dt * 3.2);
  drift.x += (driftTargetX - drift.x) * driftEase;
  drift.y += (driftTargetY - drift.y) * driftEase;
  const driftX = drift.x;
  const driftY = drift.y;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const star of stars) {
    const previousZ = star.z;
    star.z -= dt * travel * (0.18 + star.lane * config.warp);
    star.twinkle += dt * (1.2 + star.lane * 3.4);

    if (star.z <= 0.045) {
      Object.assign(star, makeStar(2));
      continue;
    }

    const prev = project(star, previousZ, driftX, driftY);
    const next = project(star, star.z, driftX, driftY);

    if (!inBounds(next.x, next.y)) {
      Object.assign(star, makeStar(2));
      continue;
    }

    const depth = 1 - star.z / 2;
    const twinkle = 0.8 + Math.sin(star.twinkle) * star.twinkleAmount;
    const alpha = clamp(0.12 + depth * 0.76 + smoothLevel * 0.18, 0.08, 1) * twinkle;
    const radius = Math.max(0.6, star.size * (0.35 + depth * 2.6) * pulse);
    const tail = Math.max(1, Math.hypot(next.x - prev.x, next.y - prev.y) * (0.5 + depth * 1.4));

    ctx.strokeStyle = `hsla(${star.hue}, 100%, ${68 + depth * 22}%, ${alpha})`;
    ctx.lineWidth = radius;
    ctx.beginPath();
    ctx.moveTo(next.x, next.y);
    const angle = Math.atan2(next.y - centerY, next.x - centerX);
    ctx.lineTo(next.x - Math.cos(angle) * tail, next.y - Math.sin(angle) * tail);
    ctx.stroke();

    if (depth > 0.76) {
      ctx.fillStyle = `hsla(${star.hue + 22}, 100%, 88%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(next.x, next.y, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (config.glow) drawCoreGlow(pulse, time);
  if (config.debug) drawDebug(dt);
  ctx.restore();
}

function project(star, z, driftX, driftY) {
  const invZ = focalLength / Math.max(z * focalLength, 1);
  return {
    x: centerX + star.x * invZ + driftX * (1 - z / 2),
    y: centerY + star.y * invZ + driftY * (1 - z / 2),
  };
}

function inBounds(x, y) {
  return x > -120 && x < width + 120 && y > -120 && y < height + 120;
}

function buildNebulaLayer() {
  if (!config.nebula) return null;
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return null;
  layerCtx.globalCompositeOperation = "screen";

  for (const cloud of nebula) {
    const gradient = layerCtx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
    gradient.addColorStop(0, `hsla(${cloud.hue}, 95%, 58%, ${cloud.alpha + smoothLevel * 0.025})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    layerCtx.fillStyle = gradient;
    layerCtx.fillRect(cloud.x - cloud.r, cloud.y - cloud.r, cloud.r * 2, cloud.r * 2);
  }

  return layer;
}

function drawNebula() {
  if (!nebulaLayer) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 1 + smoothLevel * config.tint * 0.25;
  ctx.drawImage(nebulaLayer, 0, 0);
  ctx.restore();
}

function drawCoreGlow(pulse, time) {
  const r = Math.min(width, height) * (0.035 + bassLevel * 0.05);
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, r * (4.8 + pulse));
  gradient.addColorStop(0, `hsla(${config.hue + Math.sin(time) * 12}, 100%, 82%, ${0.16 + bassLevel * 0.18})`);
  gradient.addColorStop(0.42, `hsla(${config.hue + 46}, 100%, 52%, ${0.08 + audioLevel * config.tint * 0.12})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, r * (4.8 + pulse), 0, Math.PI * 2);
  ctx.fill();
}

async function startAudio() {
  if (audioStarted) {
    // Autoplay policy can leave the context suspended when audio autostarts
    // without a gesture (?audio=1); a later click/keypress resumes it here.
    if (audioContext?.state === "suspended") void audioContext.resume();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) return;
  audioStarted = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    audioStarted = false;
    audioContext = null;
    analyser = null;
    frequencyData = null;
  }
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drawDebug(dt) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(14, 14, 170, 58);
  ctx.fillStyle = "#dffcff";
  ctx.font = `${14 * (config.dpr || Math.min(window.devicePixelRatio || 1, 2))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(`stars ${stars.length}`, 24, 38);
  ctx.fillText(`fps ${Math.round(1 / Math.max(dt, 0.001))}`, 24, 60);
  ctx.restore();
}

function hashString(value) {
  let hash = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

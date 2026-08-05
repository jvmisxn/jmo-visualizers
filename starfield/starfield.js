const canvas = document.querySelector("#starfield");
const ctx = canvas.getContext("2d", { alpha: false });
const params = new URLSearchParams(window.location.search);

const config = {
  density: numberParam("density", 900),
  speed: numberParam("speed", 1),
  warp: numberParam("warp", 1),
  hue: numberParam("hue", 198),
  tint: numberParam("tint", 0.58),
  trails: numberParam("trails", 0.23),
  pulse: numberParam("pulse", 1),
};

const pointer = {
  x: 0,
  y: 0,
  active: false,
};

let width = 1;
let height = 1;
let centerX = 0;
let centerY = 0;
let focalLength = 1;
let stars = [];
let nebula = [];
let audioLevel = 0;
let bassLevel = 0;
let smoothLevel = 0;
let audioStarted = false;
let analyser = null;
let frequencyData = null;
let lastTime = performance.now();

resize();
resetStars();
requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  resize();
  resetStars();
});

window.addEventListener("pointermove", (event) => {
  pointer.active = true;
  pointer.x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
  pointer.y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
});

window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

window.addEventListener("pointerdown", () => {
  void startAudio();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m") {
    void startAudio();
  }
});

function numberParam(name, fallback) {
  const raw = params.get(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(window.innerWidth * dpr));
  height = Math.max(1, Math.floor(window.innerHeight * dpr));
  canvas.width = width;
  canvas.height = height;
  centerX = width * 0.5;
  centerY = height * 0.5;
  focalLength = Math.min(width, height) * 0.72;
}

function resetStars() {
  const count = Math.max(120, Math.round(config.density * Math.sqrt((width * height) / (1920 * 1080))));
  stars = Array.from({ length: count }, () => makeStar(Math.random() * 1.9 + 0.1));
  nebula = Array.from({ length: 18 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.min(width, height) * (0.11 + Math.random() * 0.28),
    hue: config.hue + (Math.random() - 0.5) * 72,
    alpha: 0.018 + Math.random() * 0.036,
    drift: (Math.random() - 0.5) * 8,
  }));
}

function makeStar(depth = Math.random() * 2 + 0.05) {
  const spread = 1.8;
  return {
    x: (Math.random() - 0.5) * width * spread,
    y: (Math.random() - 0.5) * height * spread,
    z: depth,
    size: 0.45 + Math.random() * 2.1,
    hue: config.hue + (Math.random() - 0.5) * 46,
    twinkle: Math.random() * Math.PI * 2,
    lane: Math.random(),
  };
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateAudio(now);
  render(dt, now / 1000);
  requestAnimationFrame(frame);
}

function updateAudio(now) {
  if (!analyser || !frequencyData) {
    const synthetic = 0.32 + Math.sin(now * 0.0016) * 0.12 + Math.sin(now * 0.00049) * 0.18;
    audioLevel = clamp01(synthetic);
    bassLevel = clamp01(0.36 + Math.sin(now * 0.0022) * 0.22);
    smoothLevel += (audioLevel - smoothLevel) * 0.04;
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

  drawNebula(time);

  const pulse = 1 + bassLevel * 2.1 * config.pulse;
  const travel = (0.62 + smoothLevel * 3.8 + bassLevel * 3.2) * config.speed;
  const driftX = pointer.active ? pointer.x * 54 : Math.sin(time * 0.23) * 14;
  const driftY = pointer.active ? pointer.y * 38 : Math.cos(time * 0.19) * 10;

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
    const twinkle = 0.72 + Math.sin(star.twinkle) * 0.28;
    const alpha = clamp(0.12 + depth * 0.76 + smoothLevel * 0.18, 0.08, 1) * twinkle;
    const radius = Math.max(0.6, star.size * (0.35 + depth * 2.6) * pulse);
    const tail = Math.max(1, Math.hypot(next.x - prev.x, next.y - prev.y) * (1.4 + bassLevel * 2.2));

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

  drawCoreGlow(pulse, time);
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

function drawNebula(time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const cloud of nebula) {
    const x = (cloud.x + Math.sin(time * 0.05 + cloud.drift) * cloud.r * 0.25 + width) % width;
    const y = (cloud.y + Math.cos(time * 0.04 + cloud.drift) * cloud.r * 0.18 + height) % height;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, cloud.r);
    gradient.addColorStop(0, `hsla(${cloud.hue}, 95%, 58%, ${cloud.alpha + smoothLevel * 0.025})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - cloud.r, y - cloud.r, cloud.r * 2, cloud.r * 2);
  }

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
  if (audioStarted || !navigator.mediaDevices?.getUserMedia) return;
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
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
  } catch {
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

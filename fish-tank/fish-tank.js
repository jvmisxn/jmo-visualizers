const canvas = document.querySelector("#tank");
const ctx = canvas.getContext("2d", { alpha: false });
const params = new URLSearchParams(window.location.search);

const config = {
  fish: numberParam("fish", 16, 1, 60),
  bubbles: numberParam("bubbles", 72, 0, 220),
  speed: numberParam("speed", 1, 0.1, 4),
  hue: numberParam("hue", 190, 0, 360),
  plants: numberParam("plants", 18, 0, 44),
  fps: numberParam("fps", 0, 0, 120),
  dpr: numberParam("dpr", 0, 0, 2),
  seed: stringParam("seed", ""),
  quality: stringParam("quality", "high"),
};

const palettes = [
  ["#ffb35c", "#ff704d", "#fff3b0"],
  ["#69e0ff", "#4a8dff", "#e7fbff"],
  ["#f86aa8", "#a45cff", "#ffe5f2"],
  ["#ffe66d", "#4ecdc4", "#f7fff7"],
  ["#ff8f3d", "#d93636", "#fff0c2"],
];

let width = 1;
let height = 1;
let dpr = 1;
let fish = [];
let backFish = [];
let frontFish = [];
let bubbles = [];
let plants = [];
let motes = [];
let waterLayer = null;
let bottomLayer = null;
let glassLayer = null;
let bubbleSprite = null;
let waveSprite = null;
let raySprite = null;
let rayOriginX = 0;
let lastTime = performance.now();
let lastRenderTime = 0;
let rand = Math.random;

resize();
resetScene();
requestAnimationFrame(frame);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const previousWidth = width;
    const previousHeight = height;
    resize();
    if (width !== previousWidth || height !== previousHeight) resetScene();
  }, 150);
});

function stringParam(name, fallback) {
  return params.get(name) || fallback;
}

function numberParam(name, fallback, min = -Infinity, max = Infinity) {
  const raw = params.get(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function resize() {
  dpr = config.dpr || Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(window.innerWidth * dpr));
  height = Math.max(1, Math.floor(window.innerHeight * dpr));
  canvas.width = width;
  canvas.height = height;
}

function resetScene() {
  // Re-seed on every reset so ?seed= layouts reproduce after resizes too,
  // not just on the first build (update() keeps consuming the stream).
  if (config.seed) rand = mulberry32(hashString(config.seed));
  fish = Array.from({ length: Math.max(1, config.fish) }, (_, index) => makeFish(index))
    .sort((a, b) => a.depth - b.depth);
  backFish = fish.filter((item) => item.depth < 0.78);
  frontFish = fish.filter((item) => item.depth >= 0.78);
  bubbles = Array.from({ length: config.bubbles }, () => makeBubble(rand() * height));
  plants = Array.from({ length: config.plants }, (_, index) => makePlant(index));
  motes = Array.from({ length: config.quality === "low" ? 0 : 160 }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: 0.45 + rand() * 1.7,
    drift: (12 + rand() * 54) * dpr,
    alpha: 0.05 + rand() * 0.13,
  }));
  waterLayer = buildWaterLayer();
  bottomLayer = buildBottomLayer();
  glassLayer = buildGlassLayer();
  bubbleSprite = buildBubbleSprite();
  waveSprite = buildWaveSprite();
  raySprite = buildRaySprite();
}

function makeFish(index) {
  const palette = palettes[index % palettes.length];
  const scale = 0.72 + rand() * 1.16;
  const lane = 0.18 + rand() * 0.58;
  const direction = rand() > 0.5 ? 1 : -1;
  return {
    x: rand() * width,
    y: height * lane,
    baseY: height * lane,
    direction,
    facing: direction,
    speed: (16 + rand() * 28) * dpr * config.speed,
    scale: scale * dpr,
    phase: rand() * Math.PI * 2,
    wave: 0.28 + rand() * 0.48,
    body: palette[0],
    fin: palette[1],
    belly: palette[2],
    depth: 0.55 + rand() * 0.45,
    tilt: 0,
    turnCooldown: 4 + rand() * 16,
  };
}

function makeBubble(y = height + rand() * height) {
  const radius = (1.6 + rand() * 6.2) * dpr;
  return {
    x: bubbleSourceX(),
    y,
    r: radius,
    speed: (12 + rand() * 34) * dpr,
    sway: 8 * dpr + rand() * 28 * dpr,
    phase: rand() * Math.PI * 2,
    alpha: 0.18 + rand() * 0.32,
  };
}

function makePlant(index) {
  const x = (index / Math.max(config.plants - 1, 1)) * width + (rand() - 0.5) * width * 0.08;
  const fronds = 3 + Math.floor(rand() * 5);
  return {
    x: clamp(x, 24 * dpr, width - 24 * dpr),
    h: height * (0.11 + rand() * 0.22),
    sway: 0.5 + rand() * 0.9,
    hue: 138 + rand() * 42,
    fronds,
    phase: rand() * Math.PI * 2,
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
  update(dt, now / 1000);
  render(now / 1000);
  requestAnimationFrame(frame);
}

function update(dt, time) {
  for (const swimmer of fish) {
    swimmer.phase += dt * (1.8 + swimmer.wave);
    swimmer.turnCooldown -= dt;
    if (swimmer.turnCooldown <= 0 && rand() < 0.22) {
      swimmer.direction *= -1;
      swimmer.turnCooldown = 7 + rand() * 18;
    }
    swimmer.facing += (swimmer.direction - swimmer.facing) * Math.min(1, dt * 3.2);
    swimmer.x += swimmer.speed * swimmer.facing * dt;
    swimmer.y = swimmer.baseY
      + Math.sin(time * swimmer.wave + swimmer.phase) * height * 0.035
      + Math.sin(time * swimmer.wave * 0.21 + swimmer.phase) * height * 0.045;

    // Analytic dy/dt of the bob keeps the pitch smooth even across lane jumps.
    const vy = Math.cos(time * swimmer.wave + swimmer.phase) * swimmer.wave * height * 0.035
      + Math.cos(time * swimmer.wave * 0.21 + swimmer.phase) * swimmer.wave * 0.21 * height * 0.045;
    const horizontal = Math.max(swimmer.speed * Math.abs(swimmer.facing), 40 * dpr);
    const targetTilt = clamp(Math.atan2(vy, horizontal), -0.3, 0.3) * 0.8;
    swimmer.tilt += (targetTilt - swimmer.tilt) * Math.min(1, dt * 4);

    const margin = 120 * swimmer.scale;
    if (swimmer.direction > 0 && swimmer.x > width + margin) {
      swimmer.direction = -1;
      swimmer.x = width + margin;
      swimmer.baseY = height * (0.16 + rand() * 0.62);
    } else if (swimmer.direction < 0 && swimmer.x < -margin) {
      swimmer.direction = 1;
      swimmer.x = -margin;
      swimmer.baseY = height * (0.16 + rand() * 0.62);
    }
  }

  for (const bubble of bubbles) {
    bubble.phase += dt * 1.4;
    bubble.y -= bubble.speed * dt;
    bubble.x += Math.sin(bubble.phase) * bubble.sway * dt;
    if (bubble.y < -bubble.r * 4) Object.assign(bubble, makeBubble(height + bubble.r * 4));
  }

  for (const mote of motes) {
    mote.y -= mote.drift * dt;
    mote.x += Math.sin(time * 0.2 + mote.y * 0.01) * 5.4 * dpr * dt;
    if (mote.y < -4 * dpr) {
      mote.y = height + 4 * dpr;
      mote.x = rand() * width;
    }
  }
}

function render(time) {
  drawWater(time);
  drawLightRays(time);
  drawMotes();
  drawBackFish(time);
  drawPlants(time);
  drawRocks();
  drawFrontFish(time);
  drawBubbles();
  drawGlass(time);
}

function drawWater(time) {
  if (waterLayer) ctx.drawImage(waterLayer, 0, 0);

  if (!waveSprite) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 12; i += 1) {
    const y = height * (0.06 + i * 0.055) + Math.sin(time * 0.28 + i) * 10 * dpr;
    ctx.drawImage(waveSprite, 0, y - 22 * dpr);
  }
  ctx.restore();
}

function drawLightRays(time) {
  if (!raySprite) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 7; i += 1) {
    const topX = width * (0.1 + i * 0.14) + Math.sin(time * 0.12 + i) * 38 * dpr;
    const bottomX = topX + Math.sin(time * 0.18 + i * 1.7) * 170 * dpr;
    // Shear the cached ray so its top edge sits at topX and its bottom edge
    // at bottomX; the shear only sways the sprite, never rebuilds gradients.
    ctx.setTransform(1, 0, (bottomX - topX) / height, 1, topX - rayOriginX, 0);
    ctx.drawImage(raySprite, 0, 0);
  }
  ctx.restore();
}

function drawMotes() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const mote of motes) {
    ctx.fillStyle = `rgba(205, 250, 255, ${mote.alpha})`;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBackFish(time) {
  for (const swimmer of backFish) {
    drawFish(swimmer, time);
  }
}

function drawFrontFish(time) {
  for (const swimmer of frontFish) {
    drawFish(swimmer, time);
  }
}

function drawFish(swimmer, time) {
  // Continuous depth cueing: depth spans 0.55-1, so this fades smoothly from
  // 0.5 to 1 instead of snapping between two flat per-layer alpha bands.
  const layerAlpha = 0.5 + clamp((swimmer.depth - 0.55) / 0.45, 0, 1) * 0.5;
  const facing = swimmer.facing;
  const dir = Math.abs(facing) < 0.06 ? (facing < 0 ? -0.06 : 0.06) : facing;
  const s = swimmer.scale * swimmer.depth;
  const tail = Math.sin(swimmer.phase * 2.4) * 0.38;
  const bodyLength = 52 * s;
  const bodyHeight = 24 * s;

  ctx.save();
  ctx.translate(swimmer.x, swimmer.y);
  ctx.scale(dir, 1);
  ctx.rotate(swimmer.tilt);
  ctx.globalAlpha = layerAlpha;

  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, bodyHeight * 0.24, bodyLength * 0.54, bodyHeight * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = swimmer.fin;
  ctx.beginPath();
  ctx.moveTo(-bodyLength * 0.48, 0);
  ctx.lineTo(-bodyLength * 0.82, -bodyHeight * (0.56 + tail));
  ctx.lineTo(-bodyLength * 0.74, bodyHeight * (0.54 - tail));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = swimmer.fin;
  ctx.beginPath();
  ctx.moveTo(2 * s, -bodyHeight * 0.3);
  ctx.quadraticCurveTo(-8 * s, -bodyHeight * 1.0, -20 * s, -bodyHeight * 0.18);
  ctx.closePath();
  ctx.fill();

  // Gradient is in local (translated) space and depends only on per-fish
  // constants, so build it once instead of reallocating every frame.
  if (!swimmer.bodyGradient) {
    const bodyGradient = ctx.createLinearGradient(-bodyLength * 0.4, -bodyHeight, bodyLength * 0.52, bodyHeight);
    bodyGradient.addColorStop(0, swimmer.belly);
    bodyGradient.addColorStop(0.42, swimmer.body);
    bodyGradient.addColorStop(1, swimmer.fin);
    swimmer.bodyGradient = bodyGradient;
  }
  ctx.fillStyle = swimmer.bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLength * 0.56, bodyHeight * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.ellipse(bodyLength * 0.1, -bodyHeight * 0.2, bodyLength * 0.26, bodyHeight * 0.14, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#06131c";
  ctx.beginPath();
  ctx.arc(bodyLength * 0.36, -bodyHeight * 0.12, Math.max(1.6 * dpr, 2.4 * s), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = Math.max(1 * dpr, 1.2 * s);
  for (let i = 0; i < 4; i += 1) {
    const x = -bodyLength * 0.22 + i * bodyLength * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, -bodyHeight * 0.34);
    ctx.quadraticCurveTo(x + 5 * s, 0, x - 2 * s, bodyHeight * 0.34);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlants(time) {
  ctx.save();
  ctx.lineCap = "round";
  for (const plant of plants) {
    for (let i = 0; i < plant.fronds; i += 1) {
      const offset = (i - (plant.fronds - 1) * 0.5) * 8 * dpr;
      const h = plant.h * (0.78 + i / plant.fronds * 0.34);
      const sway = Math.sin(time * plant.sway + plant.phase + i * 0.7) * 20 * dpr;
      const rootY = height - 26 * dpr;
      const hue = plant.hue + i * 4;
      ctx.strokeStyle = `hsla(${hue}, 62%, ${34 + i * 4}%, 0.78)`;
      ctx.lineWidth = (5 + i * 0.6) * dpr;
      ctx.beginPath();
      ctx.moveTo(plant.x + offset, rootY);
      ctx.bezierCurveTo(
        plant.x + offset - 12 * dpr,
        rootY - h * 0.35,
        plant.x + offset + sway,
        rootY - h * 0.72,
        plant.x + offset + sway * 0.7,
        rootY - h,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRocks() {
  if (bottomLayer) ctx.drawImage(bottomLayer, 0, 0);
}

function drawBubbles() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const bubble of bubbles) {
    if (!bubbleSprite) continue;
    ctx.globalAlpha = bubble.alpha;
    const size = bubble.r * 2.6;
    ctx.drawImage(bubbleSprite, bubble.x - size * 0.5, bubble.y - size * 0.5, size, size);
  }
  ctx.restore();
}

function drawGlass() {
  if (glassLayer) ctx.drawImage(glassLayer, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function bubbleSourceX() {
  const sources = [0.08, 0.38, 0.57, 0.86];
  if (rand() < 0.72) {
    return width * sources[Math.floor(rand() * sources.length)] + (rand() - 0.5) * 36 * dpr;
  }
  return rand() * width;
}

function buildWaterLayer() {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return null;
  const gradient = layerCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `hsl(${config.hue}, 76%, 24%)`);
  gradient.addColorStop(0.45, `hsl(${config.hue + 4}, 76%, 15%)`);
  gradient.addColorStop(1, `hsl(${config.hue + 12}, 70%, 7%)`);
  layerCtx.fillStyle = gradient;
  layerCtx.fillRect(0, 0, width, height);
  return layer;
}

function buildBottomLayer() {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return null;

  const sand = layerCtx.createLinearGradient(0, height * 0.82, 0, height);
  sand.addColorStop(0, "rgba(18, 43, 48, 0)");
  sand.addColorStop(0.42, "#12373c");
  sand.addColorStop(1, "#081b21");
  layerCtx.fillStyle = sand;
  layerCtx.fillRect(0, height * 0.82, width, height * 0.18);

  layerCtx.fillStyle = "rgba(221, 244, 224, 0.1)";
  for (let i = 0; i < 180; i += 1) {
    const x = ((i * 97) % Math.max(width, 1)) + Math.sin(i) * 9 * dpr;
    const y = height * (0.84 + ((i * 53) % 160) / 1000);
    const r = (0.8 + ((i * 29) % 7) * 0.3) * dpr;
    layerCtx.beginPath();
    layerCtx.arc(x, y, r, 0, Math.PI * 2);
    layerCtx.fill();
  }

  const rocks = [
    [0.1, 0.91, 52, 24],
    [0.17, 0.94, 82, 34],
    [0.72, 0.92, 64, 26],
    [0.81, 0.95, 110, 42],
    [0.9, 0.91, 58, 22],
  ];
  for (const [x, y, rx, ry] of rocks) {
    const gradient = layerCtx.createLinearGradient(width * x, height * y - ry * dpr, width * x, height * y + ry * dpr);
    gradient.addColorStop(0, "#33515a");
    gradient.addColorStop(1, "#10262c");
    layerCtx.fillStyle = gradient;
    layerCtx.beginPath();
    layerCtx.ellipse(width * x, height * y, rx * dpr, ry * dpr, 0, Math.PI, 0);
    layerCtx.fill();
  }

  return layer;
}

function buildGlassLayer() {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return null;

  const vignette = layerCtx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(0.68, "rgba(0, 0, 0, 0.12)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.54)");
  layerCtx.fillStyle = vignette;
  layerCtx.fillRect(0, 0, width, height);

  layerCtx.globalCompositeOperation = "screen";
  layerCtx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let i = 0; i < 5; i += 1) {
    const x = width * (0.16 + i * 0.18);
    layerCtx.beginPath();
    layerCtx.ellipse(x, height * 0.48, 14 * dpr, height * 0.56, -0.08, 0, Math.PI * 2);
    layerCtx.fill();
  }

  return layer;
}

function buildWaveSprite() {
  const bandHeight = Math.max(1, Math.ceil(44 * dpr));
  const sprite = document.createElement("canvas");
  sprite.width = Math.max(1, width);
  sprite.height = bandHeight;
  const spriteCtx = sprite.getContext("2d");
  if (!spriteCtx) return null;
  const wave = spriteCtx.createLinearGradient(0, 2 * dpr, 0, 42 * dpr);
  wave.addColorStop(0, "rgba(255, 255, 255, 0)");
  wave.addColorStop(0.5, "rgba(128, 234, 255, 0.045)");
  wave.addColorStop(1, "rgba(255, 255, 255, 0)");
  spriteCtx.fillStyle = wave;
  spriteCtx.fillRect(0, 0, sprite.width, bandHeight);
  return sprite;
}

function buildRaySprite() {
  rayOriginX = Math.ceil(120 * dpr);
  const sprite = document.createElement("canvas");
  sprite.width = rayOriginX + Math.ceil(140 * dpr);
  sprite.height = height;
  const spriteCtx = sprite.getContext("2d");
  if (!spriteCtx) return null;
  const ray = spriteCtx.createLinearGradient(0, 0, 0, height);
  ray.addColorStop(0, "rgba(171, 244, 255, 0.12)");
  ray.addColorStop(0.58, "rgba(171, 244, 255, 0.025)");
  ray.addColorStop(1, "rgba(171, 244, 255, 0)");
  spriteCtx.fillStyle = ray;
  spriteCtx.beginPath();
  spriteCtx.moveTo(rayOriginX - 34 * dpr, 0);
  spriteCtx.lineTo(rayOriginX + 52 * dpr, 0);
  spriteCtx.lineTo(rayOriginX + 130 * dpr, height);
  spriteCtx.lineTo(rayOriginX - 110 * dpr, height);
  spriteCtx.closePath();
  spriteCtx.fill();
  return sprite;
}

function buildBubbleSprite() {
  const size = Math.ceil(24 * dpr);
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const spriteCtx = sprite.getContext("2d");
  if (!spriteCtx) return null;
  const center = size * 0.5;
  const radius = size * 0.42;
  const gradient = spriteCtx.createRadialGradient(center - radius * 0.25, center - radius * 0.25, radius * 0.1, center, center, radius);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  gradient.addColorStop(0.34, "rgba(144, 238, 255, 0.34)");
  gradient.addColorStop(1, "rgba(144, 238, 255, 0)");
  spriteCtx.fillStyle = gradient;
  spriteCtx.strokeStyle = "rgba(210, 250, 255, 0.72)";
  spriteCtx.lineWidth = Math.max(1, dpr);
  spriteCtx.beginPath();
  spriteCtx.arc(center, center, radius, 0, Math.PI * 2);
  spriteCtx.fill();
  spriteCtx.stroke();
  return sprite;
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

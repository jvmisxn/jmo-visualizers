const canvas = document.querySelector("#tank");
const ctx = canvas.getContext("2d", { alpha: false });
const params = new URLSearchParams(window.location.search);

const config = {
  fish: numberParam("fish", 16),
  bubbles: numberParam("bubbles", 72),
  speed: numberParam("speed", 1),
  hue: numberParam("hue", 190),
  plants: numberParam("plants", 18),
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
let bubbles = [];
let plants = [];
let motes = [];
let lastTime = performance.now();

resize();
resetScene();
requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  resize();
  resetScene();
});

function numberParam(name, fallback) {
  const raw = params.get(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(window.innerWidth * dpr));
  height = Math.max(1, Math.floor(window.innerHeight * dpr));
  canvas.width = width;
  canvas.height = height;
}

function resetScene() {
  fish = Array.from({ length: Math.max(4, config.fish) }, (_, index) => makeFish(index));
  bubbles = Array.from({ length: Math.max(12, config.bubbles) }, () => makeBubble(Math.random() * height));
  plants = Array.from({ length: Math.max(6, config.plants) }, (_, index) => makePlant(index));
  motes = Array.from({ length: 160 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.45 + Math.random() * 1.7,
    drift: 0.2 + Math.random() * 0.9,
    alpha: 0.05 + Math.random() * 0.13,
  }));
}

function makeFish(index) {
  const palette = palettes[index % palettes.length];
  const scale = 0.72 + Math.random() * 1.16;
  const lane = 0.18 + Math.random() * 0.58;
  const direction = Math.random() > 0.5 ? 1 : -1;
  return {
    x: Math.random() * width,
    y: height * lane,
    baseY: height * lane,
    direction,
    speed: (16 + Math.random() * 28) * dpr * config.speed,
    scale: scale * dpr,
    phase: Math.random() * Math.PI * 2,
    wave: 0.28 + Math.random() * 0.48,
    body: palette[0],
    fin: palette[1],
    belly: palette[2],
    depth: 0.55 + Math.random() * 0.45,
  };
}

function makeBubble(y = height + Math.random() * height) {
  const radius = (1.6 + Math.random() * 6.2) * dpr;
  return {
    x: Math.random() * width,
    y,
    r: radius,
    speed: (12 + Math.random() * 34) * dpr,
    sway: 8 * dpr + Math.random() * 28 * dpr,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.18 + Math.random() * 0.32,
  };
}

function makePlant(index) {
  const x = (index / Math.max(config.plants - 1, 1)) * width + (Math.random() - 0.5) * width * 0.08;
  const fronds = 3 + Math.floor(Math.random() * 5);
  return {
    x: clamp(x, 24 * dpr, width - 24 * dpr),
    h: height * (0.11 + Math.random() * 0.22),
    sway: 0.5 + Math.random() * 0.9,
    hue: 138 + Math.random() * 42,
    fronds,
    phase: Math.random() * Math.PI * 2,
  };
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt, now / 1000);
  render(now / 1000);
  requestAnimationFrame(frame);
}

function update(dt, time) {
  for (const swimmer of fish) {
    swimmer.phase += dt * (1.8 + swimmer.wave);
    swimmer.x += swimmer.speed * swimmer.direction * dt;
    swimmer.y = swimmer.baseY + Math.sin(time * swimmer.wave + swimmer.phase) * height * 0.035;

    const margin = 120 * swimmer.scale;
    if (swimmer.direction > 0 && swimmer.x > width + margin) {
      swimmer.direction = -1;
      swimmer.x = width + margin;
      swimmer.baseY = height * (0.16 + Math.random() * 0.62);
    } else if (swimmer.direction < 0 && swimmer.x < -margin) {
      swimmer.direction = 1;
      swimmer.x = -margin;
      swimmer.baseY = height * (0.16 + Math.random() * 0.62);
    }
  }

  for (const bubble of bubbles) {
    bubble.phase += dt * 1.4;
    bubble.y -= bubble.speed * dt;
    bubble.x += Math.sin(bubble.phase) * bubble.sway * dt;
    if (bubble.y < -bubble.r * 4) Object.assign(bubble, makeBubble(height + bubble.r * 4));
  }

  for (const mote of motes) {
    mote.y -= mote.drift * dpr;
    mote.x += Math.sin(time * 0.2 + mote.y * 0.01) * 0.09 * dpr;
    if (mote.y < -4 * dpr) {
      mote.y = height + 4 * dpr;
      mote.x = Math.random() * width;
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
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0a4d68");
  gradient.addColorStop(0.45, "#06334b");
  gradient.addColorStop(1, "#031321");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 12; i += 1) {
    const y = height * (0.06 + i * 0.055) + Math.sin(time * 0.28 + i) * 10 * dpr;
    const wave = ctx.createLinearGradient(0, y - 20 * dpr, 0, y + 20 * dpr);
    wave.addColorStop(0, "rgba(255, 255, 255, 0)");
    wave.addColorStop(0.5, "rgba(128, 234, 255, 0.045)");
    wave.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = wave;
    ctx.fillRect(0, y - 22 * dpr, width, 44 * dpr);
  }
  ctx.restore();
}

function drawLightRays(time) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 7; i += 1) {
    const topX = width * (0.1 + i * 0.14) + Math.sin(time * 0.12 + i) * 38 * dpr;
    const bottomX = topX + Math.sin(time * 0.18 + i * 1.7) * 170 * dpr;
    const ray = ctx.createLinearGradient(topX, 0, bottomX, height);
    ray.addColorStop(0, "rgba(171, 244, 255, 0.12)");
    ray.addColorStop(0.58, "rgba(171, 244, 255, 0.025)");
    ray.addColorStop(1, "rgba(171, 244, 255, 0)");

    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(topX - 34 * dpr, 0);
    ctx.lineTo(topX + 52 * dpr, 0);
    ctx.lineTo(bottomX + 130 * dpr, height);
    ctx.lineTo(bottomX - 110 * dpr, height);
    ctx.closePath();
    ctx.fill();
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
  for (const swimmer of fish.filter((item) => item.depth < 0.78)) {
    drawFish(swimmer, time, 0.58);
  }
}

function drawFrontFish(time) {
  for (const swimmer of fish.filter((item) => item.depth >= 0.78)) {
    drawFish(swimmer, time, 1);
  }
}

function drawFish(swimmer, time, layerAlpha) {
  const dir = swimmer.direction;
  const s = swimmer.scale * swimmer.depth;
  const tail = Math.sin(swimmer.phase * 2.4) * 0.38;
  const bodyLength = 52 * s;
  const bodyHeight = 24 * s;

  ctx.save();
  ctx.translate(swimmer.x, swimmer.y);
  ctx.scale(dir, 1);
  ctx.globalAlpha = layerAlpha;
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 10 * dpr;

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

  const bodyGradient = ctx.createLinearGradient(-bodyLength * 0.4, -bodyHeight, bodyLength * 0.52, bodyHeight);
  bodyGradient.addColorStop(0, swimmer.belly);
  bodyGradient.addColorStop(0.42, swimmer.body);
  bodyGradient.addColorStop(1, swimmer.fin);
  ctx.fillStyle = bodyGradient;
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
  const sand = ctx.createLinearGradient(0, height * 0.82, 0, height);
  sand.addColorStop(0, "rgba(18, 43, 48, 0)");
  sand.addColorStop(0.42, "#12373c");
  sand.addColorStop(1, "#081b21");
  ctx.fillStyle = sand;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);

  ctx.save();
  ctx.fillStyle = "rgba(221, 244, 224, 0.1)";
  for (let i = 0; i < 180; i += 1) {
    const x = ((i * 97) % Math.max(width, 1)) + Math.sin(i) * 9 * dpr;
    const y = height * (0.84 + ((i * 53) % 160) / 1000);
    const r = (0.8 + ((i * 29) % 7) * 0.3) * dpr;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const rocks = [
    [0.1, 0.91, 52, 24],
    [0.17, 0.94, 82, 34],
    [0.72, 0.92, 64, 26],
    [0.81, 0.95, 110, 42],
    [0.9, 0.91, 58, 22],
  ];
  for (const [x, y, rx, ry] of rocks) {
    const gradient = ctx.createLinearGradient(width * x, height * y - ry * dpr, width * x, height * y + ry * dpr);
    gradient.addColorStop(0, "#33515a");
    gradient.addColorStop(1, "#10262c");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(width * x, height * y, rx * dpr, ry * dpr, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

function drawBubbles() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const bubble of bubbles) {
    const gradient = ctx.createRadialGradient(
      bubble.x - bubble.r * 0.25,
      bubble.y - bubble.r * 0.25,
      bubble.r * 0.1,
      bubble.x,
      bubble.y,
      bubble.r,
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${bubble.alpha + 0.2})`);
    gradient.addColorStop(0.34, `rgba(144, 238, 255, ${bubble.alpha * 0.42})`);
    gradient.addColorStop(1, "rgba(144, 238, 255, 0)");
    ctx.strokeStyle = `rgba(210, 250, 255, ${bubble.alpha})`;
    ctx.fillStyle = gradient;
    ctx.lineWidth = Math.max(1 * dpr, bubble.r * 0.08);
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlass(time) {
  ctx.save();
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(0.68, "rgba(0, 0, 0, 0.12)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.54)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let i = 0; i < 5; i += 1) {
    const x = width * (0.16 + i * 0.18) + Math.sin(time * 0.08 + i) * 20 * dpr;
    ctx.beginPath();
    ctx.ellipse(x, height * 0.48, 14 * dpr, height * 0.56, -0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

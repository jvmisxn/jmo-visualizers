const canvas = document.querySelector("#static-canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const noiseCanvas = document.createElement("canvas");
const noiseCtx = noiseCanvas.getContext("2d", { alpha: false });

let width = 0;
let height = 0;
let noiseWidth = 0;
let noiseHeight = 0;
let noiseImage = null;
let noisePixels = null;
let rowOffsets = null;
let frame = 0;
let verticalHold = 0;
let nextHoldJump = 90;
let animationId = null;
let renderTimerId = null;
let lastRenderTime = 0;
let resizeId = null;

const grainTable = createGrainTable(65536);
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const standardFrameInterval = 33;
const reducedMotionFrameInterval = 180;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.floor(window.innerWidth);
  const nextHeight = Math.floor(window.innerHeight);
  const nextCanvasWidth = Math.floor(nextWidth * dpr);
  const nextCanvasHeight = Math.floor(nextHeight * dpr);

  if (
    width === nextWidth &&
    height === nextHeight &&
    canvas.width === nextCanvasWidth &&
    canvas.height === nextCanvasHeight
  ) {
    return;
  }

  width = nextWidth;
  height = nextHeight;
  canvas.width = nextCanvasWidth;
  canvas.height = nextCanvasHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  noiseWidth = Math.max(240, Math.floor(width / 3));
  noiseHeight = Math.max(135, Math.floor(height / 3));
  noiseCanvas.width = noiseWidth;
  noiseCanvas.height = noiseHeight;
  noiseImage = noiseCtx.createImageData(noiseWidth, noiseHeight);
  noisePixels = new Uint32Array(noiseImage.data.buffer);
  rowOffsets = new Float32Array(noiseHeight);
}

function scheduleResize() {
  if (resizeId !== null) return;

  resizeId = requestAnimationFrame(() => {
    resizeId = null;
    resize();
  });
}

function render(timestamp = 0) {
  animationId = null;
  const reducedMotion = reducedMotionQuery.matches;
  const frameInterval = reducedMotion ? reducedMotionFrameInterval : standardFrameInterval;
  if (lastRenderTime && timestamp - lastRenderTime < frameInterval) {
    queueRender(frameInterval - (timestamp - lastRenderTime));
    return;
  }

  lastRenderTime = timestamp;
  frame += 1;
  const bandY = (frame * (reducedMotion ? 1 : 3)) % noiseHeight;
  const bandStrength = reducedMotion ? 18 : 54;
  const rowPulseStrength = reducedMotion ? 7 : 18;
  const grainStrength = reducedMotion ? 0.72 : 0.82;
  const grainMask = grainTable.length - 1;
  const grainSeed = (frame * (reducedMotion ? 4099 : 9973)) & grainMask;

  for (let y = 0; y < noiseHeight; y += 1) {
    const band = Math.abs(y - bandY) < 5 ? bandStrength : 0;
    rowOffsets[y] = band + Math.sin((y + frame * 2) * 0.09) * rowPulseStrength;
  }

  for (let y = 0; y < noiseHeight; y += 1) {
    const rowOffset = rowOffsets[y];
    const rowSeed = (grainSeed + y * 131) & grainMask;
    for (let x = 0; x < noiseWidth; x += 1) {
      const grain = grainTable[(rowSeed + x * 17) & grainMask];
      const hash = ((x * 13 + y * 7 + frame * 17) % 31) * 2;
      const value = clamp(grain * grainStrength + hash + rowOffset) | 0;
      noisePixels[y * noiseWidth + x] = 0xff000000 | (value << 16) | (value << 8) | value;
    }
  }

  noiseCtx.putImageData(noiseImage, 0, 0);
  drawSignal(reducedMotion);
  queueRender(reducedMotion ? reducedMotionFrameInterval : 0);
}

function drawSignal(reducedMotion) {
  if (frame >= nextHoldJump) {
    verticalHold = reducedMotion ? 0 : (Math.random() - 0.5) * height * 0.18;
    nextHoldJump = frame + 80 + Math.floor(Math.random() * 160);
  } else {
    verticalHold *= reducedMotion ? 0.72 : 0.9;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.drawImage(noiseCanvas, 0, verticalHold, width, height);
  if (verticalHold > 0) {
    ctx.drawImage(noiseCanvas, 0, verticalHold - height, width, height);
  } else if (verticalHold < 0) {
    ctx.drawImage(noiseCanvas, 0, verticalHold + height, width, height);
  }

  drawTears(reducedMotion);
  drawBurst(reducedMotion);
}

function drawTears(reducedMotion) {
  const tears = reducedMotion ? 3 : 7;
  for (let i = 0; i < tears; i += 1) {
    const y = (frame * (1.4 + i * 0.17) + i * 97) % height;
    const h = 2 + (i % 3) * 3;
    const offset = Math.sin(frame * 0.06 + i) * (reducedMotion ? 8 : 14 + i * 4);
    ctx.globalAlpha = reducedMotion ? 0.12 : 0.18 + (i % 2) * 0.12;
    ctx.drawImage(canvas, 0, y, width, h, offset, y, width, h);
  }
  ctx.globalAlpha = 1;
}

function drawBurst(reducedMotion) {
  if (reducedMotion) return;
  const pulse = Math.sin(frame * 0.031) > 0.985;
  if (!pulse) return;
  const y = Math.random() * height;
  const h = 18 + Math.random() * 54;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.18})`;
  ctx.fillRect(0, y, width, h);
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function createGrainTable(size) {
  const table = new Uint8Array(size);
  let seed = 0x4d595446;

  for (let i = 0; i < size; i += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    table[i] = seed >>> 24;
  }

  return table;
}

function queueRender(delay = 0) {
  if (delay > 0) {
    renderTimerId = window.setTimeout(() => {
      renderTimerId = null;
      animationId = requestAnimationFrame(render);
    }, delay);
    return;
  }

  animationId = requestAnimationFrame(render);
}

function stopRenderLoop() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (renderTimerId !== null) {
    clearTimeout(renderTimerId);
    renderTimerId = null;
  }
}

window.addEventListener("resize", scheduleResize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopRenderLoop();
    return;
  }

  if (animationId === null && renderTimerId === null) {
    lastRenderTime = 0;
    queueRender();
  }
});

resize();
queueRender();

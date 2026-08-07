const canvas = document.querySelector("#static-canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const noiseCanvas = document.createElement("canvas");
const noiseCtx = noiseCanvas.getContext("2d", { alpha: false });

let width = 0;
let height = 0;
let noiseWidth = 0;
let noiseHeight = 0;
let frame = 0;
let verticalHold = 0;
let nextHoldJump = 90;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  noiseWidth = Math.max(240, Math.floor(width / 3));
  noiseHeight = Math.max(135, Math.floor(height / 3));
  noiseCanvas.width = noiseWidth;
  noiseCanvas.height = noiseHeight;
}

function render() {
  frame += 1;
  const image = noiseCtx.createImageData(noiseWidth, noiseHeight);
  const data = image.data;
  const bandY = (frame * 3) % noiseHeight;

  for (let y = 0; y < noiseHeight; y += 1) {
    const band = Math.abs(y - bandY) < 5 ? 54 : 0;
    const rowPulse = Math.sin((y + frame * 2) * 0.09) * 18;
    for (let x = 0; x < noiseWidth; x += 1) {
      const index = (y * noiseWidth + x) * 4;
      const grain = Math.random() * 255;
      const hash = ((x * 13 + y * 7 + frame * 17) % 31) * 2;
      const value = clamp(grain * 0.82 + hash + band + rowPulse);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  noiseCtx.putImageData(image, 0, 0);
  drawSignal();
  requestAnimationFrame(render);
}

function drawSignal() {
  if (frame >= nextHoldJump) {
    verticalHold = (Math.random() - 0.5) * height * 0.18;
    nextHoldJump = frame + 80 + Math.floor(Math.random() * 160);
  } else {
    verticalHold *= 0.9;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.drawImage(noiseCanvas, 0, verticalHold, width, height);
  if (verticalHold > 0) {
    ctx.drawImage(noiseCanvas, 0, verticalHold - height, width, height);
  } else if (verticalHold < 0) {
    ctx.drawImage(noiseCanvas, 0, verticalHold + height, width, height);
  }

  drawTears();
  drawBurst();
}

function drawTears() {
  const tears = 7;
  for (let i = 0; i < tears; i += 1) {
    const y = (frame * (1.4 + i * 0.17) + i * 97) % height;
    const h = 2 + (i % 3) * 3;
    const offset = Math.sin(frame * 0.06 + i) * (14 + i * 4);
    ctx.globalAlpha = 0.18 + (i % 2) * 0.12;
    ctx.drawImage(canvas, 0, y, width, h, offset, y, width, h);
  }
  ctx.globalAlpha = 1;
}

function drawBurst() {
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

window.addEventListener("resize", resize);
resize();
render();

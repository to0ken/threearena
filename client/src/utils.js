

import * as THREE from 'three';


export function getKey(x, z) {
  return `${Math.floor(x)},${Math.floor(z)}`;
}

export function isInBounds(x, z, width, height) {
  return x >= 0 && x < width && z >= 0 && z < height;
}

export function updateStatus(message) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log(`[Status] ${message}`);
}


export function createTextMaterial(text, options = {}) {
  const {
    fontSize = 24,
    fontFamily = 'Arial, sans-serif',
    color = '#ffffff',
    backgroundColor = 'rgba(0, 0, 0, 0.7)',
    padding = 8,
    borderRadius = 4
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Измеряем текст
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;
  
  // Устанавливаем размер канваса
  canvas.width = textWidth + padding * 2;
  canvas.height = textHeight + padding * 2;
  
  // Рисуем фон
  ctx.fillStyle = backgroundColor;
  if (borderRadius > 0) {
    roundRect(ctx, 0, 0, canvas.width, canvas.height, borderRadius);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // Рисуем текст
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Создаём текстуру
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  return new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true,
    depthWrite: false
  });
}


function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}


export function padNumber(num, length = 2) {
  return num.toString().padStart(length, '0');
}


export function randomColor() {
  return Math.floor(Math.random() * 0xFFFFFF);
}


export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

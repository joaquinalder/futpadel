/**
 * Procedural canvas textures — no external assets required.
 * Results are cached by key for reuse across courts/skins.
 */

import * as THREE from 'three';

const cache = new Map();

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function noise2D(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function createCanvasTexture(drawFn, { width = 512, height = 512, repeat, key } = {}) {
  if (key && cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  tex.needsUpdate = true;

  if (key) cache.set(key, tex);
  return tex;
}

/** Broadcast turf — mowed stripes + rubber granules (FIFA / EA FC style). */
export function courtFloorTexture(floorHex, accentHex, courtId = 'classic') {
  return createCanvasTexture((ctx, w, h) => {
    const base = hexToRgb(floorHex);
    const dark = {
      r: Math.max(0, base.r - 28),
      g: Math.max(0, base.g - 32),
      b: Math.max(0, base.b - 24),
    };
    const light = {
      r: Math.min(255, base.r + 18),
      g: Math.min(255, base.g + 22),
      b: Math.min(255, base.b + 16),
    };
    const stripeW = 64;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const stripe = Math.floor(x / stripeW) % 2 === 0;
        const c = stripe ? light : dark;
        const n = noise2D(x * 0.04, y * 0.04) * 14 - 7;
        const g = noise2D(x * 0.12, y * 0.12) * 6;
        ctx.fillStyle = `rgb(${c.r + n + g | 0},${c.g + n | 0},${c.b + n | 0})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const accent = hexToRgb(accentHex);
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45);
    grd.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},0.06)`);
    grd.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }, { width: 1024, height: 2048, repeat: [6, 12], key: `court-floor-${courtId}` });
}

export function courtRoughnessMap(courtId = 'classic') {
  return createCanvasTexture((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise2D(x * 0.02, y * 0.02);
        const v = Math.floor(mix(180, 240, n));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, { width: 512, height: 1024, repeat: [4, 8], key: `court-rough-${courtId}` });
}

/** Jersey / fabric weave. */
export function fabricTexture(colorHex, id = 'fabric') {
  return createCanvasTexture((ctx, w, h) => {
    const c = hexToRgb(colorHex);
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const alt = ((x + y) / 4) % 2 === 0;
        const d = alt ? 12 : -8;
        ctx.fillStyle = `rgb(${Math.max(0, c.r + d)},${Math.max(0, c.g + d)},${Math.max(0, c.b + d)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.lineTo(Math.random() * w, Math.random() * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { width: 256, height: 256, repeat: [2, 2], key: `fabric-${id}-${colorHex}` });
}

/** Net grid with alpha. */
export function netTexture() {
  return createCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    const step = 16;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // Shadow knots
    ctx.fillStyle = 'rgba(15,23,42,0.5)';
    for (let x = step / 2; x < w; x += step) {
      for (let y = step / 2; y < h; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { width: 256, height: 256, repeat: [8, 4], key: 'net-grid' });
}

/** Classic soccer ball — white with black pentagons. */
export function ballTexture() {
  return createCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(0, 0, w, h);

    const drawPentagon = (cx, cy, r, rot = 0) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    ctx.fillStyle = '#0a0a0a';
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 3;

    const pentagons = [
      [0.20, 0.22, 0.0],
      [0.50, 0.12, 0.6],
      [0.80, 0.22, 1.1],
      [0.12, 0.55, 0.3],
      [0.50, 0.45, 0.0],
      [0.88, 0.55, -0.3],
      [0.20, 0.85, 0.7],
      [0.50, 0.78, -0.5],
      [0.80, 0.85, 0.4],
    ];
    for (const [u, v, rot] of pentagons) {
      drawPentagon(u * w, v * h, w * 0.07, rot);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (const [u, v] of pentagons) {
      const cx = u * w;
      const cy = v * h;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(a) * w * 0.075;
        const y1 = cy + Math.sin(a) * w * 0.075;
        const x2 = cx + Math.cos(a) * w * 0.14;
        const y2 = cy + Math.sin(a) * w * 0.14;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }, { width: 512, height: 512, key: 'ball-soccer' });
}

export function ballNormalMap() {
  return createCanvasTexture((ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise2D(x * 0.08, y * 0.08);
        const r = Math.floor(mix(120, 140, n));
        const g = Math.floor(mix(120, 140, noise2D(x * 0.08 + 3, y * 0.08)));
        const b = 255;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, { width: 256, height: 256, key: 'ball-normal' });
}

/** Glass streaks / smudges. */
export function glassTexture(tintHex, courtId = 'classic') {
  return createCanvasTexture((ctx, w, h) => {
    const c = hexToRgb(tintHex);
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.15)`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, 0);
      ctx.bezierCurveTo(
        Math.random() * w, h * 0.33,
        Math.random() * w, h * 0.66,
        Math.random() * w, h,
      );
      ctx.stroke();
    }
  }, { width: 256, height: 512, repeat: [1, 2], key: `glass-${courtId}` });
}

export function skinTexture(toneHex) {
  return createCanvasTexture((ctx, w, h) => {
    const c = hexToRgb(toneHex);
    ctx.fillStyle = toneHex;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise2D(x * 0.15, y * 0.15) * 10 - 5;
        ctx.fillStyle = `rgb(${c.r + n},${c.g + n * 0.8},${c.b + n * 0.6})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, { width: 128, height: 128, key: `skin-${toneHex}` });
}

/** Generic face — eyes, brows, nose shading, lips. */
export function faceTexture(skinHex, eyeHex, id = 'face') {
  return createCanvasTexture((ctx, w, h) => {
    const skin = hexToRgb(skinHex);
    const eye = hexToRgb(eyeHex);
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w - 0.5; const v = y / h - 0.5;
        const cheek = Math.exp(-((u * u) / 0.12 + ((v + 0.05) ** 2) / 0.08)) * 8;
        const n = noise2D(x * 0.2, y * 0.2) * 4;
        ctx.fillStyle = `rgb(${skin.r + cheek + n | 0},${skin.g + cheek * 0.7 + n | 0},${skin.b + cheek * 0.5 | 0})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const shade = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.05, w * 0.5, h * 0.55, w * 0.35);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = `rgb(${eye.r},${eye.g},${eye.b})`;
    ctx.beginPath();
    ctx.ellipse(w * 0.38, h * 0.42, w * 0.055, h * 0.04, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.62, h * 0.42, w * 0.055, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(w * 0.38, h * 0.42, w * 0.028, 0, Math.PI * 2);
    ctx.arc(w * 0.62, h * 0.42, w * 0.028, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(w * 0.37, h * 0.405, w * 0.01, 0, Math.PI * 2);
    ctx.arc(w * 0.61, h * 0.405, w * 0.01, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3d2314';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.34);
    ctx.quadraticCurveTo(w * 0.38, h * 0.31, w * 0.44, h * 0.34);
    ctx.moveTo(w * 0.56, h * 0.34);
    ctx.quadraticCurveTo(w * 0.62, h * 0.31, w * 0.68, h * 0.34);
    ctx.stroke();

    ctx.fillStyle = 'rgba(180,100,90,0.35)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, w * 0.03, h * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9a4a42';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.09, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
  }, { width: 256, height: 256, key: `face-${id}` });
}

export function disposeTextures() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}

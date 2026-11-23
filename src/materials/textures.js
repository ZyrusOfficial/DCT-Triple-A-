/**
 * Procedural canvas textures.
 *
 * Everything ships as code so the repo stays small and there are zero network
 * requests at runtime. Textures are authored at 2–4 texels/cm for close-up
 * surfaces and use mipmaps + anisotropy so they stay crisp under grazing angles.
 */
import * as THREE from 'three';

const cache = new Map();
function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  /**
   * willReadFrequently: TRUE.
   *
   * Every generator in this file writes pixels with createImageData/putImageData
   * and several read them back, so the canvas is never presented — but the
   * default context keeps it GPU-backed and each getImageData forces a full
   * synchronous readback of the surface. Measured in SwiftShader: 8,855 ms for a
   * single 512^2 getImageData without this flag, 1 ms with it.
   *
   * That one flag was 120 s of a 121 s world build (the derived normal and
   * roughness maps each read their source once). Do not set it back to false.
   */
  return { c, x: c.getContext('2d', { willReadFrequently: true }) };
}

export function finish(c, { repeat = [1, 1], srgb = true, aniso = 8, wrap = THREE.RepeatWrapping } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = wrap;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ noise */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function valueNoise(seed = 7) {
  const r = rng(seed);
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (h, x, y) => {
    const u = h & 1 ? x : -x, v = h & 2 ? y : -y;
    return u + v;
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
                lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
  };
}

export function fbm(n, x, y, oct = 5, lac = 2.0, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * n(x * f, y * f); norm += a; a *= gain; f *= lac; }
  return sum / norm;
}

/** Tiling fbm sampled on a cylinder so edges match. */
function tileNoise(seed) {
  const n = valueNoise(seed);
  return (u, v, freq) => {
    const ang = u * Math.PI * 2;
    const x = Math.cos(ang) * freq, y = Math.sin(ang) * freq, z = v * freq;
    return (n(x + z * 0.5, y + z * 0.5) + n(y - z * 0.7, x + z * 1.3)) * 0.5;
  };
}

/* --------------------------------------------------------------- concrete */
/** Weathered cream stucco — the church and DCT main building walls. */
export function stucco(hex = '#e8dcc8', opts = {}) {
  const { seed = 3, rough = 0.5, size = 512, dirt = 0.5 } = opts;
  return memo(`stucco:${hex}:${seed}:${dirt}`, () => {
    const { c, x } = canvas(512, 512);
    const t = tileNoise(seed);
    const img = x.createImageData(512, 512);
    const base = new THREE.Color(hex);
    for (let j = 0; j < 512; j++) {
      for (let i = 0; i < 512; i++) {
        const u = i / 512, v = j / 512;
        const n1 = t(u, v, 6) * 0.5 + 0.5;
        const n2 = t(u, v, 26) * 0.5 + 0.5;
        const n3 = t(u, v, 90) * 0.5 + 0.5;
        // Streaking rain-wash mostly in the lower half.
        const streak = Math.pow(n2, 3.0) * dirt * (0.4 + v * 0.6);
        let m = 0.93 + n1 * 0.07 + (n3 - 0.5) * 0.055;
        m *= 1 - streak * 0.22;
        const k = (j * 512 + i) * 4;
        img.data[k] = Math.min(255, base.r * 255 * m);
        img.data[k + 1] = Math.min(255, base.g * 255 * m * 0.999);
        img.data[k + 2] = Math.min(255, base.b * 255 * m * 0.995);
        img.data[k + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // Fine sand-grain speckle
    for (let i = 0; i < 26000; i++) {
      const a = Math.random() * 0.10;
      x.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,30,20,${a})`;
      x.fillRect(Math.random() * 512, Math.random() * 512, 1.3, 1.3);
    }
    return finish(c, { repeat: [1, 1], aniso: 8 });
  });
}

/** Smallsquare terracotta floor tiles used in the church porch. */
export function floorTile(hex = '#b9563f', groutHex = '#8d7c68') {
  return memo(`floorTile:${hex}:${groutHex}`, () => {
    const { c, x } = canvas(512, 512);
    x.fillStyle = groutHex; x.fillRect(0, 0, 512, 512);
    const N = 8, s = 512 / N, gap = 3;
    const r = rng(11);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const h = new THREE.Color(hex).offsetHSL(0, (r() - 0.5) * 0.05, (r() - 0.5) * 0.09);
      x.fillStyle = `#${h.getHexString()}`;
      x.fillRect(i * s + gap / 2, j * s + gap / 2, s - gap, s - gap);
      // subtle sheen streak
      const g = x.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      g.addColorStop(1, 'rgba(0,0,0,0.05)');
      x.fillStyle = g; x.fillRect(i * s + gap / 2, j * s + gap / 2, s - gap, s - gap);
    }
    for (let i = 0; i < 4200; i++) {
      x.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`;
      x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Large-format polished granite-ish tile for lobbies / porch aprons. */
export function graniteTile(hex = '#cfc8bd') {
  return memo(`granite:${hex}`, () => {
    const { c, x } = canvas(512, 512);
    x.fillStyle = hex; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 24000; i++) {
      const a = Math.random() * 0.14;
      x.fillStyle = Math.random() > 0.45 ? `rgba(255,255,255,${a})` : `rgba(30,28,26,${a})`;
      const s = 0.7 + Math.random() * 1.9;
      x.fillRect(Math.random() * 512, Math.random() * 512, s, s);
    }
    x.strokeStyle = 'rgba(120,112,100,0.55)'; x.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      x.beginPath(); x.moveTo(0, i * 256); x.lineTo(512, i * 256); x.stroke();
      x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, 512); x.stroke();
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/* ------------------------------------------------------------ paving/road */
export function asphalt() {
  return memo('asphalt', () => {
    const { c, x } = canvas(512, 512);
    const t = tileNoise(21);
    const img = x.createImageData(512, 512);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const u = i / 512, v = j / 512;
      const n = t(u, v, 40) * 0.5 + 0.5, n2 = t(u, v, 120) * 0.5 + 0.5;
      let g = 42 + n * 26 + n2 * 16;
      const k = (j * 512 + i) * 4;
      img.data[k] = g; img.data[k + 1] = g * 0.99; img.data[k + 2] = g * 0.97; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // gravel aggregate
    for (let i = 0; i < 9000; i++) {
      const g = 70 + Math.random() * 110;
      x.fillStyle = `rgba(${g},${g * 0.98},${g * 0.95},${0.25 + Math.random() * 0.4})`;
      x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 0.6 + Math.random() * 1.5, 0, 7); x.fill();
    }
    // tar seams + patches
    x.strokeStyle = 'rgba(24,24,24,0.5)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(20, 0); x.bezierCurveTo(60, 170, 0, 340, 40, 512); x.stroke();
    return finish(c, { repeat: [1, 1] });
  });
}

/** Concrete paving slabs of the school yard & plaza walkways. */
export function concreteSlab(hex = '#b9b3a6', cells = 4) {
  return memo(`slab:${hex}:${cells}`, () => {
    const { c, x } = canvas(512, 512);
    const t = tileNoise(5);
    const base = new THREE.Color(hex);
    const img = x.createImageData(512, 512);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const u = i / 512, v = j / 512;
      const n = t(u, v, 30) * 0.5 + 0.5;
      const m = 0.9 + n * 0.14;
      const k = (j * 512 + i) * 4;
      img.data[k] = base.r * 255 * m; img.data[k + 1] = base.g * 255 * m; img.data[k + 2] = base.b * 255 * m; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // control joints (mild — heavy lines read as a grid from the air)
    x.strokeStyle = 'rgba(96,92,86,0.42)'; x.lineWidth = 2;
    const s = 512 / cells;
    for (let i = 0; i <= cells; i++) {
      x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 512); x.stroke();
      x.beginPath(); x.moveTo(0, i * s); x.lineTo(512, i * s); x.stroke();
    }
    for (let i = 0; i < 5200; i++) {
      x.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${Math.random() * 0.07})` : `rgba(50,46,42,${Math.random() * 0.09})`;
      x.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Interlocking pavers of the church forecourt. */
export function pavers(hex = '#a08d78') {
  return memo(`pavers:${hex}`, () => {
    const { c, x } = canvas(512, 512);
    x.fillStyle = '#8d857a'; x.fillRect(0, 0, 512, 512);
    const r = rng(31);
    const bw = 64, bh = 32;
    for (let j = 0; j < 512 / bh; j++) {
      for (let i = -1; i < 512 / bw + 1; i++) {
        const off = (j % 2) * bw / 2;
        const col = new THREE.Color(hex).offsetHSL(0, (r() - 0.5) * 0.04, (r() - 0.5) * 0.12);
        x.fillStyle = `#${col.getHexString()}`;
        x.fillRect(i * bw + off + 2, j * bh + 2, bw - 4, bh - 4);
      }
    }
    return finish(c, { repeat: [1, 1] });
  });
}

export function grass() {
  return memo('grass', () => {
    const { c, x } = canvas(1024, 1024);
    const t = tileNoise(9);
    const t2 = tileNoise(57);
    const img = x.createImageData(1024, 1024);
    for (let j = 0; j < 1024; j++) for (let i = 0; i < 1024; i++) {
      const u = i / 1024, v = j / 1024;
      const n1 = t(u, v, 6) * 0.5 + 0.5;
      // second, non-harmonic noise breaks up the visible tiling grid
      const n2 = t2(u, v, 41) * 0.5 + 0.5;
      const n3 = t(u, v, 168) * 0.5 + 0.5;
      // Tropical lawn: yellow-green in sun patches, deeper green in shade.
      // Broad tonal variation at several scales so mown lawn never reads flat:
      // a big-patch term, a mid-scale term, and fine blade noise.
      const patch = Math.pow(n1, 1.5);
      const dry = Math.pow(n2, 3.0);
      const r = 56 + patch * 40 + dry * 62 + n3 * 26;
      const g = 86 + patch * 34 + dry * 40 + n3 * 30;
      const b = 34 + patch * 14 + dry * 18 + n3 * 16;
      const k = (j * 1024 + i) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // blade strokes for the near field
    for (let i = 0; i < 30000; i++) {
      const px = Math.random() * 1024, py = Math.random() * 1024;
      const len = 2 + Math.random() * 5;
      const g = 90 + Math.random() * 110;
      x.strokeStyle = `rgba(${g * 0.62},${g},${g * 0.4},${0.10 + Math.random() * 0.18})`;
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 2.4, py - len); x.stroke();
    }
    return finish(c, { repeat: [1, 1], aniso: 16 });
  });
}

export function gravel() {
  return memo('gravel', () => {
    const { c, x } = canvas(512, 512);
    x.fillStyle = '#6d6357'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 13000; i++) {
      const g = 90 + Math.random() * 110;
      x.fillStyle = `rgba(${g},${g * 0.96},${g * 0.88},${0.4 + Math.random() * 0.5})`;
      x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 0.9 + Math.random() * 2.1, 0, 7); x.fill();
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Red clay / lahar soil showing through worn lawn. */
export function soil() {
  return memo('soil', () => {
    const { c, x } = canvas(512, 512);
    const t = tileNoise(17);
    const img = x.createImageData(512, 512);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const u = i / 512, v = j / 512;
      const n = t(u, v, 25) * 0.5 + 0.5, n2 = t(u, v, 100) * 0.5 + 0.5;
      const k = (j * 512 + i) * 4;
      img.data[k] = 116 + n * 44 + n2 * 20;
      img.data[k + 1] = 78 + n * 28 + n2 * 16;
      img.data[k + 2] = 56 + n * 20 + n2 * 12;
      img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return finish(c, { repeat: [1, 1] });
  });
}

/* ------------------------------------------------------------------- roof */
/** Painted GI ribbed roofing (long-run). Ubiquitous in the Philippines. */
export function ribbedRoof(hex = '#8a3a33') {
  return memo(`roof:${hex}`, () => {
    const { c, x } = canvas(512, 512);
    const base = new THREE.Color(hex);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const rib = Math.sin((i / 512) * Math.PI * 2 * 32) * 0.5 + 0.5;
      const shade = 0.62 + rib * 0.5;
      const c2 = base.clone().multiplyScalar(shade);
      x.fillStyle = `rgb(${c2.r * 255 | 0},${c2.g * 255 | 0},${c2.b * 255 | 0})`;
      x.fillRect(i, j, 1, 1);
    }
    // rust freckles + dirt runs
    for (let i = 0; i < 2200; i++) {
      x.fillStyle = `rgba(${90 + Math.random() * 50},${40 + Math.random() * 30},20,${Math.random() * 0.22})`;
      x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, Math.random() * 3.2, 0, 7); x.fill();
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Bare galvanised steel sheet, for the covered court. */
export function galvanized() {
  return memo('galv', () => {
    const { c, x } = canvas(512, 512);
    for (let i = 0; i < 512; i++) {
      const rib = Math.sin((i / 512) * Math.PI * 2 * 40) * 0.5 + 0.5;
      const g = 132 + rib * 62;
      x.fillStyle = `rgb(${g},${g + 2},${g + 6})`;
      x.fillRect(i, 0, 1, 512);
    }
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = `rgba(${120 + Math.random() * 40},${118 + Math.random() * 30},${112},${Math.random() * 0.3})`;
      x.fillRect(Math.random() * 512, Math.random() * 512, 2, 8 + Math.random() * 22);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/* ------------------------------------------------------------- metal/wood */
export function brushedMetal(hex = '#9aa3aa', rough = 0.35) {
  return memo(`metal:${hex}:${rough}`, () => {
    const { c, x } = canvas(256, 256);
    const base = new THREE.Color(hex);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const n = Math.sin(j * 12.9898 + i * 78.233) * 43758.5453;
      const f = (n - Math.floor(n));
      const m = 0.9 + f * 0.16;
      const c2 = base.clone().multiplyScalar(m);
      x.fillStyle = `rgb(${c2.r * 255 | 0},${c2.g * 255 | 0},${c2.b * 255 | 0})`;
      x.fillRect(i, j, 1, 1);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Narra / mahogany — the reddish hardwood used for doors and pews. */
export function wood(hex = '#7a4522') {
  return memo(`wood:${hex}`, () => {
    const { c, x } = canvas(512, 512);
    const base = new THREE.Color(hex);
    const t = tileNoise(41);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const grain = Math.sin((j / 512) * 26 + t(i / 512, j / 512, 9) * 6) * 0.5 + 0.5;
      const m = 0.78 + grain * 0.34;
      const c2 = base.clone().multiplyScalar(m);
      x.fillStyle = `rgb(${c2.r * 255 | 0},${c2.g * 255 | 0},${c2.b * 255 | 0})`;
      x.fillRect(i, j, 1, 1);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/* ------------------------------------------------------------------ glass */
/** Warm T-8 window glazing with an interior glow baked in. */
export function glazing(tint = '#2c3d47', lit = 0.0) {
  return memo(`glass:${tint}:${lit}`, () => {
    const { c, x } = canvas(256, 256);
    const base = new THREE.Color(tint);
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, `rgba(${base.r * 255 | 0},${base.g * 255 | 0},${base.b * 255 | 0},1)`);
    g.addColorStop(0.55, `rgba(${(base.r * 255 * 1.35) | 0},${(base.g * 255 * 1.4) | 0},${(base.b * 255 * 1.5) | 0},1)`);
    g.addColorStop(1, `rgba(${(base.r * 255 * 0.75) | 0},${(base.g * 255 * 0.8) | 0},${(base.b * 255 * 0.9) | 0},1)`);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    if (lit > 0) {
      x.fillStyle = `rgba(255,236,196,${lit})`;
      x.fillRect(0, 0, 256, 256);
      x.fillStyle = `rgba(255,255,255,${lit * 0.5})`;
      for (let i = 0; i < 5; i++) x.fillRect(20 + i * 45, 18, 3, 220);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/* ------------------------------------------------------------- vegetation */
/** Broadleaf canopy card used on alpha-tested cross-billboards. */
export function leafCluster(seed = 1, tint = [0.20, 0.34, 0.13]) {
  return memo(`leaf:${seed}:${tint.join()}`, () => {
    const S = 256;
    const { c, x } = canvas(S, S);
    x.clearRect(0, 0, S, S);
    const r = rng(seed * 977 + 3);
    // Draw 90 overlapping elongated leaves radiating from the centre.
    for (let i = 0; i < 112; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.pow(r(), 0.62) * S * 0.46;
      const cx = S / 2 + Math.cos(a) * rad;
      const cy = S / 2 + Math.sin(a) * rad;
      const len = 12 + r() * 30;
      const wid = 4 + r() * 8;
      x.save();
      x.translate(cx, cy); x.rotate(a + (r() - 0.5) * 1.2);
      const shade = 0.55 + r() * 0.75;
      const rr = Math.min(255, tint[0] * 255 * shade);
      const gg = Math.min(255, tint[1] * 255 * shade * (1 + (r() - 0.5) * 0.22));
      const bb = Math.min(255, tint[2] * 255 * shade);
      const grd = x.createLinearGradient(0, -len / 2, 0, len / 2);
      grd.addColorStop(0, `rgba(${rr},${gg},${bb},0.0)`);
      grd.addColorStop(0.35, `rgba(${rr},${gg},${bb},0.95)`);
      grd.addColorStop(1, `rgba(${rr * 0.6},${gg * 0.72},${bb * 0.6},0.9)`);
      x.fillStyle = grd;
      x.beginPath();
      x.ellipse(0, 0, wid / 2, len / 2, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    // darken the core so clusters read as volumes, not flat discs
    const vg = x.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0.42)');
    vg.addColorStop(0.55, 'rgba(0,0,0,0.12)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = vg; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'source-over';
    return finish(c, { repeat: [1, 1], aniso: 4 });
  });
}

/** Palm frond: rachis + pinnae, alpha-tested. */
export function palmFrond() {
  return memo('frond', () => {
    // NOTE: geometry in trees.js is a *bent* strip; this texture supplies the
    // rachis and pinnae along it.
    const W = 256, H = 512;
    const { c, x } = canvas(W, H);
    const r = rng(1337);
    x.strokeStyle = '#5b6a33'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, 10); x.stroke();
    for (let i = 0; i < 44; i++) {
      const t = i / 44;
      const y = H - 14 - t * (H - 30);
      const len = Math.sin(Math.PI * (0.14 + t * 0.9)) * (W * 0.47);
      const droop = 26 + t * 34;
      for (const s of [-1, 1]) {
        const g = 0.62 + r() * 0.5;
        x.strokeStyle = `rgba(${78 * g | 0},${118 * g | 0},${52 * g | 0},0.95)`;
        x.lineWidth = 3.1;
        x.beginPath();
        x.moveTo(W / 2, y);
        x.quadraticCurveTo(W / 2 + s * len * 0.55, y - 10, W / 2 + s * len, y + droop);
        x.stroke();
      }
    }
    return finish(c, { repeat: [1, 1], aniso: 4 });
  });
}

/** Dense shrub / hedge foliage card. */
export function hedgeTex() {
  return memo('hedge', () => {
    const S = 512;
    const { c, x } = canvas(S, S);
    x.fillStyle = '#1d3a19'; x.fillRect(0, 0, S, S);
    const r = rng(555);
    for (let i = 0; i < 5200; i++) {
      const a = r() * Math.PI * 2, rad = Math.pow(r(), 0.5) * 40;
      const px = (r() * S) | 0, py = (r() * S) | 0;
      const g = 0.45 + r() * 0.7;
      x.fillStyle = `rgba(${(46 * g) | 0},${(92 * g) | 0},${(38 * g) | 0},${0.6 + r() * 0.4})`;
      x.beginPath();
      x.ellipse(px, py, 3 + rad * 0.28, 2 + r() * 3, a, 0, 7);
      x.fill();
    }
    return finish(c, { repeat: [1, 1], aniso: 8 });
  });
}

/** Bark for trunks: vertical plates + lenticels. */
export function bark() {
  return memo('bark', () => {
    const { c, x } = canvas(256, 512);
    const t = tileNoise(61);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 256; i++) {
      const n = t(i / 256, j / 512, 16) * 0.5 + 0.5;
      const v = Math.sin(i * 0.35 + n * 8) * 0.5 + 0.5;
      const g = 58 + n * 46 + v * 22;
      x.fillStyle = `rgb(${g * 1.02 | 0},${g * 0.92 | 0},${g * 0.8 | 0})`;
      x.fillRect(i, j, 1, 1);
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/* --------------------------------------------------------------- signage */
/** Renders a text sign onto a transparent card. */
export function textSign(text, {
  w = 1024, h = 256, font = '600 96px "Helvetica Neue", Arial, sans-serif',
  color = '#1b1b1b', bg = 'rgba(0,0,0,0)', align = 'center', track = 0,
} = {}) {
  return memo(`sign:${text}:${w}:${h}:${font}:${color}:${bg}:${track}`, () => {
    const { c, x } = canvas(w, h);
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = color;
    x.textAlign = align; x.textBaseline = 'middle';
    x.font = font;
    if (track) {
      // manual letter spacing for the church's spaced-out signage
      const chars = [...text];
      const widths = chars.map((ch) => x.measureText(ch).width + track);
      const total = widths.reduce((a, b) => a + b, 0) - track;
      let px = align === 'center' ? (w - total) / 2 : 0;
      for (let i = 0; i < chars.length; i++) {
        x.fillText(chars[i], px, h / 2);
        px += widths[i];
      }
    } else {
      x.fillText(text, align === 'center' ? w / 2 : 0, h / 2);
    }
    return finish(c, { repeat: [1, 1], aniso: 4 });
  });
}

/** The DCT crest stencil, drawn parametrically. */
export function dctCrest() {
  return memo('crest', () => {
    const S = 512;
    const { c, x } = canvas(S, S);
    x.clearRect(0, 0, S, S);
    x.translate(S / 2, S / 2);
    // Shield
    x.fillStyle = '#8f1c2c'; x.strokeStyle = '#5d0f1e'; x.lineWidth = 14;
    x.beginPath();
    x.moveTo(0, -190); x.bezierCurveTo(120, -190, 160, -120, 160, -40);
    x.bezierCurveTo(160, 90, 80, 160, 0, 200);
    x.bezierCurveTo(-80, 160, -160, 90, -160, -40);
    x.bezierCurveTo(-160, -120, -120, -190, 0, -190);
    x.closePath(); x.fill(); x.stroke();
    /**
     * Dominican cross (black & white).
     *
     * Strokes are deliberately heavy: the shield is viewed from the highway at
     * 20 m+, where a 44 px arm is under a pixel and the whole crest averages to a
     * pale smear. 80 px arms with gold bolt heads give it something to read as at
     * any range.
     */
    x.fillStyle = '#141414';
    x.fillRect(-40, -178, 80, 356);
    x.fillRect(-136, -84, 272, 68);
    x.fillStyle = '#f2ece0';
    x.fillRect(-40, -178, 80, 104);
    // bolt heads, so the plate reads as metal hardware at any range
    x.fillStyle = '#c9a227';
    for (const [bx, by] of [[-118, -150], [118, -150], [-118, 150], [118, 150]]) {
      x.beginPath(); x.arc(bx, by, 13, 0, Math.PI * 2); x.fill();
    }
    // Sunburst
    x.strokeStyle = '#c9a227'; x.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      x.beginPath();
      x.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
      x.lineTo(Math.cos(a) * 92, Math.sin(a) * 92);
      x.stroke();
    }
    return finish(c, { repeat: [1, 1], aniso: 4 });
  });
}


/* ----------------------------------------------------------------- brick */
/** Red brick with pale mortar — the SNDT bell tower. */
export function brickTex(hex = '#a4453a', mortar = '#cfc3ae') {
  return memo(`brick:${hex}:${mortar}`, () => {
    const { c, x } = canvas(512, 512);
    x.fillStyle = mortar; x.fillRect(0, 0, 512, 512);
    const r = rng(77);
    const bw = 64, bh = 26;
    for (let j = 0; j < 512 / bh; j++) {
      const off = (j % 2) * bw * 0.5;
      for (let i = -1; i < 512 / bw + 1; i++) {
        const col = new THREE.Color(hex).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.06, (r() - 0.5) * 0.14);
        x.fillStyle = `#${col.getHexString()}`;
        x.fillRect(i * bw + off + 2, j * bh + 2, bw - 4, bh - 4);
        // brick face mottling
        for (let k = 0; k < 12; k++) {
          x.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 240 : 0},${r() > 0.5 ? 220 : 0},${r() * 0.05})`;
          x.fillRect(i * bw + off + 2 + r() * (bw - 6), j * bh + 2 + r() * (bh - 6), 3, 2);
        }
      }
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/* ------------------------------------------------------- grass billboard */
/** Tufted grass card for the plaza verges and lawn edges. */
export function grassCardTex() {
  return memo('grassCard', () => {
    const W = 256, H = 256;
    const { c, x } = canvas(W, H);
    x.clearRect(0, 0, W, H);
    const r = rng(4242);
    for (let i = 0; i < 190; i++) {
      const bx = 40 + r() * (W - 80);
      const hgt = 60 + r() * 150;
      const lean = (r() - 0.5) * 46;
      const g = 0.5 + r() * 0.75;
      x.strokeStyle = `rgba(${(52 * g) | 0},${(104 * g) | 0},${(40 * g) | 0},${0.7 + r() * 0.3})`;
      x.lineWidth = 1.6 + r() * 1.6;
      x.beginPath();
      x.moveTo(bx, H);
      x.quadraticCurveTo(bx + lean * 0.4, H - hgt * 0.6, bx + lean, H - hgt);
      x.stroke();
    }
    return finish(c, { repeat: [1, 1], aniso: 4 });
  });
}

/* ------------------------------------------------------------ sky/facade */
/** Large printed banner used on the campus fence (school pride signage). */
export function bannerTex(lines = ['DOMINICAN', 'COLLEGE', 'OF TARLAC'], hex = '#b8325a') {
  return memo(`banner:${lines.join('|')}:${hex}`, () => {
    const { c, x } = canvas(512, 1024);
    x.fillStyle = hex; x.fillRect(0, 0, 512, 1024);
    const g = x.createLinearGradient(0, 0, 512, 1024);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 84px "Helvetica Neue", Arial, sans-serif';
    lines.forEach((l, i) => x.fillText(l, 256, 300 + i * 108));
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.font = '600 42px "Helvetica Neue", Arial, sans-serif';
    x.fillText('CAPAS · TARLAC', 256, 760);
    return finish(c, { repeat: [1, 1] });
  });
}

/* --------------------------------------------------------------- foliage */
/** A dense flowering shrub sprite (gumamela / bougainvillea). */
export function flowerBushTex(hex = '#c8394f') {
  return memo(`flowerBush:${hex}`, () => {
    const S = 256;
    const { c, x } = canvas(S, S);
    x.clearRect(0, 0, S, S);
    const r = rng(913);
    // green base
    for (let i = 0; i < 900; i++) {
      const g = 0.45 + r() * 0.6;
      x.fillStyle = `rgba(${(40 * g) | 0},${(92 * g) | 0},${(44 * g) | 0},${0.7 + r() * 0.3})`;
      x.beginPath();
      x.ellipse(r() * S, r() * S, 3 + r() * 6, 2 + r() * 4, r() * 7, 0, 7);
      x.fill();
    }
    // flowers
    const col = new THREE.Color(hex);
    for (let i = 0; i < 320; i++) {
      const s = 0.7 + r() * 0.6;
      const cc = col.clone().offsetHSL(0, 0, (r() - 0.5) * 0.18);
      x.fillStyle = `#${cc.getHexString()}`;
      const px = r() * S, py = r() * S;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        x.beginPath();
        x.ellipse(px + Math.cos(a) * 3.4 * s, py + Math.sin(a) * 3.4 * s, 3.2 * s, 2.4 * s, a, 0, 7);
        x.fill();
      }
    }
    return finish(c, { repeat: [1, 1], aniso: 4 });
  });
}

/* ---------------------------------------------------------------- stone */
/** Irregular rough-stone wall face for the grotto / frontage. */
export function rockFaceTex(hex = '#8a8175') {
  return memo(`rock:${hex}`, () => {
    const { c, x } = canvas(512, 512);
    const base = new THREE.Color(hex);
    // Deep mortar shadow base.
    x.fillStyle = '#2e2a25'; x.fillRect(0, 0, 512, 512);
    const r = rng(303);
    // Small irregular stones, roughly 34–58 px (~15–25 cm at 2 m per tile).
    let y = 0;
    while (y < 512) {
      const rowH = 30 + r() * 22;
      let xp = -r() * 30;
      while (xp < 512) {
        const w = 30 + r() * 46;
        const h = rowH - 3 - r() * 4;
        // slight lightness variation only — real stone is tonally tight
        const col = base.clone().offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.04, (r() - 0.5) * 0.085);
        x.fillStyle = `#${col.getHexString()}`;
        const px = xp + 1.6, py = y + 1.6;
        x.beginPath();
        const pts = 8;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const rr = 0.86 + r() * 0.16;
          const vx = px + w / 2 + Math.cos(a) * (w / 2) * rr;
          const vy = py + h / 2 + Math.sin(a) * (h / 2) * rr;
          i === 0 ? x.moveTo(vx, vy) : x.lineTo(vx, vy);
        }
        x.closePath(); x.fill();
        // top highlight, bottom shadow — soft, not black
        x.fillStyle = 'rgba(255,252,244,0.09)';
        x.fillRect(px + 2, py + 1, w - 6, 3);
        x.fillStyle = 'rgba(0,0,0,0.13)';
        x.fillRect(px + 2, py + h - 5, w - 6, 4);
        // fine grain
        for (let i = 0; i < 34; i++) {
          x.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 248 : 0},${r() > 0.5 ? 235 : 0},${r() * 0.055})`;
          x.fillRect(px + r() * w, py + r() * h, 1.6, 1.6);
        }
        xp += w + 3 + r() * 6;
      }
      y += rowH;
    }
    return finish(c, { repeat: [1, 1] });
  });
}

export { valueNoise };

/* ------------------------------------------------------- derived PBR maps */
/**
 * Build a tangent-space normal map from a height field.
 *
 * The material library had no normal, roughness or AO maps at all — every
 * surface was colour-only, which is why flat stucco and timber read as flat
 * regardless of the texture on them. A normal map is the cheapest way to get
 * surface relief: one extra texture fetch per pixel and no geometry, which is
 * what matters on an iGPU.
 *
 * Sobel gradients over the height field, packed to RGB. `strength` scales the
 * slope, so a subtle stucco grain and a deep rock face can share this.
 */
export function normalFromHeight(h, w, sv, strength = 2.0) {
  const c = document.createElement('canvas');
  c.width = w; c.height = sv;
  const x = c.getContext('2d');
  const img = x.createImageData(w, sv);
  const d = img.data;
  const at = (i, j) => h[((j + sv) % sv) * w + ((i + w) % w)];
  for (let j = 0; j < sv; j++) {
    for (let i = 0; i < w; i++) {
      const dx = (at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1))
               - (at(i - 1, j - 1) + 2 * at(i - 1, j) + at(i - 1, j + 1));
      const dy = (at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1))
               - (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const k = (j * w + i) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255;
      d[k + 1] = (ny * 0.5 + 0.5) * 255;
      d[k + 2] = (nz * 0.5 + 0.5) * 255;
      d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/**
 * Derive a height field from a canvas's luminance, then build the normal map.
 * The colour map already carries the relief (grain, joints, aggregate, ribs), so
 * reusing its own luminance keeps the two maps perfectly registered — no second
 * authoring pass and no chance of the relief drifting out of step.
 */
export function normalFromCanvas(src, strength = 2.0) {
  /**
   * Downsample to NORMAL_RES first.
   *
   * A normal map carries low-frequency relief — grain, joints, ribs — and is
   * sampled with mipmapping, so a 256^2 source is indistinguishable in the
   * render from a 512^2 one while being 4x cheaper for both the Sobel pass and
   * the mip chain. At 512^2 across ~90 materials this pass was ~2 minutes of the
   * world build.
   */
  const RES = 256;
  const c = document.createElement('canvas');
  c.width = c.height = RES;
  const cx = c.getContext('2d');
  cx.drawImage(src, 0, 0, RES, RES);
  const px = cx.getImageData(0, 0, RES, RES).data;
  const hgt = new Float32Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) {
    hgt[i] = (px[i * 4] * 0.2126 + px[i * 4 + 1] * 0.7152 + px[i * 4 + 2] * 0.0722) / 255;
  }
  return normalFromHeight(hgt, RES, RES, strength);
}

/**
 * Roughness map from the same luminance, inverted around a pivot. Recessed grain
 * and pores hold dirt and scatter more than raised faces, so darker pixels come
 * out rougher. Without this every surface has one constant roughness and fresnel
 * highlights are uniform — the second-biggest reason the render reads flat.
 */
export function roughnessFromCanvas(src, base = 0.7, swing = 0.25) {
  // Same reasoning as normalFromCanvas: 256^2 is plenty for a roughness map.
  const RES = 256;
  const sc = document.createElement('canvas');
  sc.width = sc.height = RES;
  const sx = sc.getContext('2d');
  sx.drawImage(src, 0, 0, RES, RES);
  const px = sx.getImageData(0, 0, RES, RES).data;
  const w = RES, hh = RES;
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, hh);
  const d = img.data;
  for (let i = 0; i < w * hh; i++) {
    const lum = (px[i * 4] * 0.2126 + px[i * 4 + 1] * 0.7152 + px[i * 4 + 2] * 0.0722) / 255;
    const v = Math.max(0, Math.min(1, base + (0.5 - lum) * swing * 2));
    const k = i * 4;
    d[k] = d[k + 1] = d[k + 2] = v * 255;
    d[k + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}

/**
 * Roughness map straight from a precomputed luminance field.
 *
 * Separate from roughnessFromCanvas so callers that already have the luminance
 * do not pay for a second getImageData — that readback is the expensive part.
 */
export function roughnessFromLum(lum, w, h, base = 0.7, swing = 0.25) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(1, base + (0.5 - lum[i]) * swing * 2));
    const k = i * 4;
    d[k] = d[k + 1] = d[k + 2] = v * 255;
    d[k + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}

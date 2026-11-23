/**
 * Large-scale terrain around the site.
 *
 * The poblacion itself is flat, so the detailed site stays a set of flat
 * quads. This module handles everything beyond it: a 2.4 km ground mesh whose
 * colour comes from a single procedural map (fields, dirt roads, tree cover),
 * plus the ring of volcanic hills that closes the horizon in every direction.
 *
 * One draw call, no textures larger than 2048².
 */
import * as THREE from 'three';
import { rng, valueNoise, fbm } from '../materials/textures.js';

const SIZE = 2400;       // metres across
const SEG = 96;          // 96×96 quads ≈ 25 m cells — plenty at this distance

export function buildTerrain(parent, M) {
  const g = new THREE.Group();
  g.name = 'terrain';
  parent.add(g);

  /* ---------------------------------------------------------- colour map */
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d');
  const img = x.createImageData(N, N);
  const n1 = valueNoise(3);
  const n2 = valueNoise(17);
  const n3 = valueNoise(41);

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      // world position of this texel
      const wx = (i / N - 0.5) * SIZE - 20;
      const wz = (j / N - 0.5) * SIZE - 40;
      const u = i / N * 26, v = j / N * 26;
      const a = fbm(n1, u, v, 4);
      const b = fbm(n2, u * 3.3, v * 3.3, 3);
      const deep = fbm(n3, u * 8.1, v * 8.1, 2);

      // Base: wet-season Central Luzon — cane fields, scrub, rice paddies.
      let r = 78 + a * 44 + deep * 18;
      let gg = 104 + a * 34 + deep * 22;
      let bb = 48 + b * 26;
      // dry / fallow patches read yellow-brown
      const dry = Math.max(0, b - 0.1) * 1.7;
      r += dry * 62; gg += dry * 46; bb += dry * 20;
      // dark tree cover
      const tree = Math.max(0, deep - 0.18) * 2.2;
      r -= tree * 46; gg -= tree * 34; bb -= tree * 30;

      // Distance darkening from the town centre hides tiling at the horizon.
      const dist = Math.hypot(wx + 20, wz + 40);
      const fade = Math.min(1, Math.max(0, (dist - 180) / 1000));
      const haze = 0.06 + fade * 0.62;
      r = r * (1 - haze) + 150 * haze;
      gg = gg * (1 - haze) + 165 * haze;
      bb = bb * (1 - haze) + 160 * haze;

      const k = (j * N + i) * 4;
      img.data[k] = Math.min(255, r);
      img.data[k + 1] = Math.min(255, gg);
      img.data[k + 2] = Math.min(255, bb);
      img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);

  // Draw the unpaved roads radiating out of town onto the map.
  x.globalCompositeOperation = 'source-over';
  const r0 = rng(99);
  const w2px = (m) => (m / SIZE) * N;
  const drawRoad = (x0, z0, x1, z1, width, col) => {
    x.strokeStyle = col;
    x.lineWidth = w2px(width);
    x.lineCap = 'round';
    x.beginPath();
    // sample as a wobbling path
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = (x0 + (x1 - x0) * t + (r0() - 0.5) * 18) / SIZE * N + N / 2;
      const pz = (z0 + (z1 - z0) * t + (r0() - 0.5) * 18) / SIZE * N + N / 2;
      i === 0 ? x.moveTo(px, pz) : x.lineTo(px, pz);
    }
    x.stroke();
  };
  // convert world→px helper used by drawRoad above (world origin offset)
  const toPx = (wx, wz) => [(wx + 20) / SIZE * N + N / 2, (wz + 40) / SIZE * N + N / 2];
  const drawRoad2 = (x0, z0, x1, z1, width, col) => {
    x.strokeStyle = col;
    x.lineWidth = w2px(width);
    x.lineCap = 'round';
    const steps = 30;
    x.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [px, pz] = toPx(x0 + (x1 - x0) * t + Math.sin(t * 9) * 9, z0 + (z1 - z0) * t + Math.sin(t * 7) * 8);
      i === 0 ? x.moveTo(px, pz) : x.lineTo(px, pz);
    }
    x.stroke();
  };
  // Only a handful of real radial roads, drawn dim and narrow — a dozen bright
  // bands radiating from town reads as sunbeams, not streets.
  x.globalAlpha = 0.55;
  const roadCol = 'rgba(150,142,126,0.9)';
  const angles = [0.18, 0.72, 1.33, 1.95, 2.55, 3.05, 3.62, 4.15, 4.78, 5.42, 5.95];
  for (const a of angles) {
    drawRoad2(Math.cos(a) * 70 - 20, Math.sin(a) * 70 - 40,
              Math.cos(a) * 1050 - 20, Math.sin(a) * 1050 - 40,
              4.0 + r0() * 2.0, roadCol);
  }
  x.globalAlpha = 1;
  // field boundary lines (rice paddies read as fine lines)
  x.strokeStyle = 'rgba(88,102,66,0.16)';
  x.lineWidth = 1.1;
  for (let i = 0; i < 150; i++) {
    const a = r0() * Math.PI * 2, rad = 260 + r0() * 700;
    const [px, pz] = toPx(Math.cos(a) * rad - 20, Math.sin(a) * rad - 40);
    const w = 20 + r0() * 90, h = 14 + r0() * 60;
    x.strokeRect(px, pz, w, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  /* --------------------------------------------------------- ground mesh */
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uvA = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) - 20, wz = pos.getZ(i) - 40;
    // Gentle rolling terrain far from town; dead flat on the site so the
    // detailed surfaces never poke through.
    const d = Math.hypot(wx + 20, wz + 40);
    const amp = THREE.MathUtils.smoothstep(d, 320, 1100) * 7.0;
    const nz = fbm(n2, wx * 0.0016, wz * 0.0016, 3);
    pos.setY(i, -0.16 + nz * amp);
    uvA.setXY(i, (wx + 20) / SIZE + 0.5, (wz + 40) / SIZE + 0.5);
    // vertex tint adds large-scale variation on top of the map
    const t = 0.86 + n3(wx * 0.004, wz * 0.004) * 0.2;
    colors[i * 3] = t; colors[i * 3 + 1] = t * 1.01; colors[i * 3 + 2] = t * 0.96;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: tex, vertexColors: true, roughness: 0.98, metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.position.y = 0;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  g.add(mesh);

  /* ---------------------------------------------------------------- hills */
  // Zambales / Cordillera foothills closing the horizon. Unlit-looking because
  // atmospheric haze dominates at this distance; still receiving sun helps.
  const hillGroup = new THREE.Group();
  const hills = [
    [-1500, -720, 1050, 118, 760],
    [-1180, 520, 820, 92, 640],
    [-780, -1420, 900, 104, 680],
    [-1850, 640, 980, 98, 720],
    [1100, -1520, 1120, 112, 820],
    [1650, -380, 1000, 96, 760],
    [1420, 1050, 1060, 104, 780],
    [-380, 1680, 1180, 94, 840],
    [-1650, -1500, 1080, 112, 800],
    [300, -1900, 1200, 88, 880],
  ];
  // Distance-graded colours: near ridges read green, the farthest dissolve
  // into the same blue-grey as the sky horizon. This is what makes a horizon
  // look real instead of like cut-out cardboard.
  const hillMats = [
    new THREE.MeshStandardMaterial({ color: 0x3d5744, roughness: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x4d6a5c, roughness: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x667f80, roughness: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x8797a0, roughness: 1.0 }),
  ];
  for (const [hx, hz, w, h, d] of hills) {
    const dist = Math.hypot(hx, hz);
    const idx = dist > 1400 ? 3 : dist > 1100 ? 2 : dist > 850 ? 1 : 0;
    const hg = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    hg.scale(w, h * (0.55 + Math.random() * 0.2), d);
    const m = new THREE.Mesh(hg, hillMats[idx]);
    m.position.set(hx, -h * 0.12, hz);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    hillGroup.add(m);
  }
  g.add(hillGroup);

  return g;
}

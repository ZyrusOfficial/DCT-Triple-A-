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
      const fade = Math.min(1, dist / 900);
      const haze = 0.30 + fade * 0.42;
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
  const roadCol = 'rgba(168,158,140,0.85)';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r0() * 0.2;
    drawRoad2(Math.cos(a) * 60 - 20, Math.sin(a) * 60 - 40,
              Math.cos(a) * 1000 - 20, Math.sin(a) * 1000 - 40,
              5.5 + r0() * 3, roadCol);
  }
  // field boundary lines (rice paddies read as fine lines)
  x.strokeStyle = 'rgba(96,110,72,0.28)';
  x.lineWidth = 1.4;
  for (let i = 0; i < 220; i++) {
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
    [-1250, -560, 900, 150, 620],
    [-980, 340, 700, 112, 520],
    [-620, -1150, 760, 132, 560],
    [-1500, 480, 820, 120, 600],
    [900, -1250, 980, 140, 700],
    [1350, -300, 860, 118, 640],
    [1180, 850, 900, 128, 660],
    [-300, 1350, 1000, 116, 700],
    [-1350, -1250, 900, 140, 680],
  ];
  const hm = new THREE.MeshStandardMaterial({ color: 0x415a48, roughness: 1.0, fog: true });
  for (const [hx, hz, w, h, d] of hills) {
    const hg = new THREE.SphereGeometry(1, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    hg.scale(w, h, d);
    const m = new THREE.Mesh(hg, hm);
    m.position.set(hx, -2, hz);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    hillGroup.add(m);
  }
  g.add(hillGroup);

  return g;
}

/**
 * Headless build harness.
 *
 * Runs the real World.build() in Node with a minimal 2D-canvas shim, so the whole
 * world can be exercised without a browser. This is the cheap first line of
 * defence: it catches import errors, bad geometry arguments, undefined Builder
 * methods and the vegetation roof-exclusion warnings in about ten seconds,
 * whereas a screenshot pass costs a minute per view and needs a working
 * Chromium rig.
 *
 *   node tools/buildtest.mjs
 *
 * Expected current output: 227 colliders, ~10 s build, and a
 * "[vegetation] skipped trees inside roofed areas" line naming the four court
 * intrusions. It does NOT check rendering — colours, lighting and material
 * appearance still need a real screenshot.
 */
const st = () => {
  const ctx = new Proxy({}, { get: (t, k) => {
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w*h*4), width:w, height:h });
    if (k === 'getImageData') return (x,y,w,h) => ({ data: new Uint8ClampedArray(w*h*4), width:w, height:h });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
    if (k === 'measureText') return () => ({ width: 10 });
    return () => {};
  }});
  return ctx;
};
const mkCanvas = () => ({ width:0, height:0, getContext: () => st(),
  toDataURL: () => 'data:', style:{}, addEventListener(){}, removeEventListener(){} });
globalThis.document = {
  createElement: (tag) => tag === 'canvas' ? mkCanvas() : { style:{}, addEventListener(){}, appendChild(){} },
  createElementNS: () => mkCanvas(),
  body: { appendChild(){}, removeChild(){} },
  getElementById: () => null,
};
globalThis.window = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  addEventListener(){}, removeEventListener(){} };
globalThis.OffscreenCanvas = function(){ return mkCanvas(); };
globalThis.self = globalThis.window;

const { World } = await import(new URL('../src/world/index.js', import.meta.url));
const THREE = await import("three");
const w = new World(new THREE.Scene());
const t0 = Date.now();
await w.build(() => {});
console.log('OK buildMs=', Date.now() - t0);
console.log('stats=', JSON.stringify({ interactables: w.interactables?.length, colliders: w.colliders?.length, timings: w.stats?.timings }));

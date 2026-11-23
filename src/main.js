/**
 * DCT — Capas, Tarlac. Walkable reconstruction.
 *
 * Boot order: renderer → sky → world → player → HUD → loop.
 */
import * as THREE from 'three';
// Expose THREE for the offline inspector/screenshot harness.
window.THREE = THREE;
import { SkySystem } from './render/sky.js';
import { PostFX } from './render/post.js';
import { World } from './world/index.js';
import { Player } from './player/controller.js';

const app = document.getElementById('app');

/* ------------------------------------------------------------------ state */
const state = {
  quality: 'balanced',
  renderScale: 1.0,
  shadowLevel: 2,
  hour: 9.5,
  haze: 0.34,
  exposure: 0.92,
  ssao: true,
  bloom: true,
  fxaa: true,
  uiVisible: true,
  panelVisible: false,
  debug: { wire: false, collide: false, bounds: false },
};

const QUALITY = {
  low:      { scale: 0.72, shadow: 1, ssao: false, bloom: true,  fxaa: true,  aoRadius: 0.9 },
  balanced: { scale: 1.0,  shadow: 2, ssao: true,  bloom: true,  fxaa: true,  aoRadius: 0.85 },
  high:     { scale: 1.0,  shadow: 3, ssao: true,  bloom: true,  fxaa: true,  aoRadius: 0.75 },
  ultra:    { scale: 1.25, shadow: 3, ssao: true,  bloom: true,  fxaa: true,  aoRadius: 0.7 },
};

/* --------------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({
  antialias: false,          // we do FXAA in post; MSAA on HDR targets is expensive
  powerPreference: 'high-performance',
  stencil: false,
  alpha: false,
  preserveDrawingBuffer: true, // needed for scripted screenshots
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping; // handled in post
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Free camera used only by the offline screenshot harness (window.__debugCam).
const debugCam = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 4000);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 2600);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.7, 16);

const sky = new SkySystem(scene, renderer);
const post = new PostFX(renderer, camera);

/* --------------------------------------------------------------- HUD refs */
const el = (id) => document.getElementById(id);
const ui = {
  boot: el('boot'), bootBar: el('boot-bar'), bootTask: el('boot-task'),
  hud: el('hud'), fps: el('s-fps'), ms: el('s-ms'), draws: el('s-draws'), tris: el('s-tris'), pos: el('s-pos'),
  needle: el('needle'), panel: el('panel-right'), reticle: el('reticle'), prompt: el('prompt'),
  place: el('place'), toast: el('toast'), badge: el('loading-badge'),
};

let world = null;
let player = null;
let clock = new THREE.Clock();
let statsAccum = 0, frames = 0, fps = 0;
let toastTimer = null;

function toast(msg, ms = 2200) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('on'), ms);
}

function progress(t, label) {
  ui.bootBar.style.width = `${Math.round(t * 100)}%`;
  if (label) ui.bootTask.textContent = label;
}

/* ------------------------------------------------------------------- boot */
async function boot() {
  progress(0.02, 'starting renderer');
  // Warm the shader compiler before the first frame so the reveal is smooth.
  await new Promise((r) => setTimeout(r, 40));

  world = new World(scene);
  await world.build(progress);

  player = new Player(camera, world);
  player.attach(renderer.domElement);
  player.teleport([0, 0, 16], Math.PI, -0.03);

  applyQuality(state.quality);
  sky.setTime(state.hour);
  sky.setHaze(state.haze);
  post.exposure = state.exposure;
  sky.refreshEnv();

  buildDestinationChips();
  bindUI();
  window.addEventListener('resize', onResize);
  onResize();

  // Pre-compile materials (one hitch instead of many).
  progress(0.98, 'compiling shaders');
  renderer.compile(scene, camera);

  setTimeout(() => {
    ui.boot.classList.add('done');
    ui.hud.classList.add('on');
    ui.badge.style.display = 'none';
    setTimeout(() => (ui.boot.style.display = 'none'), 800);
  }, 220);

  window.__app = { scene, camera, renderer, post, sky, world, player, state, debugCam };
  window.setDebugCam = (px, py, pz, tx, ty, tz, fov = 55) => {
    debugCam.position.set(px, py, pz);
    debugCam.fov = fov;
    debugCam.aspect = window.innerWidth / window.innerHeight;
    debugCam.updateProjectionMatrix();
    debugCam.lookAt(new THREE.Vector3(tx, ty, tz));
    debugCam.updateMatrixWorld(true);
    window.__debugCamOn = true;
  };
  window.clearDebugCam = () => { window.__debugCamOn = false; };
  window.__ready = true;
  animate();
}

/* ---------------------------------------------------------------- quality */
function applyQuality(name) {
  const q = QUALITY[name] || QUALITY.balanced;
  state.quality = name;
  state.shadowLevel = q.shadow;
  state.ssao = q.ssao;
  state.renderScale = q.scale;
  sky.setShadowQuality(q.shadow);
  post.aoEnabled = q.ssao;
  post.aoPass.uniforms.uRadius.value = q.aoRadius;
  post.fxaaEnabled = q.fxaa;
  post.bloomEnabled = q.bloom;
  el('q-shadow').value = String(q.shadow);
  el('q-scale').value = String(Math.round(q.scale * 100));
  el('q-ssao').value = q.ssao ? '1' : '0';
  el('q-bloom').value = q.bloom ? '1' : '0';
  el('q-aa').value = q.fxaa ? '1' : '0';
  onResize();
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  post.setSize(w * devicePixelRatio, h * devicePixelRatio, state.renderScale);
}

/* ------------------------------------------------------------------- loop */
const tmpV = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  player.update(dt);
  sky.followTarget(player.pos);
  sky.refreshEnv();

  // Interaction probe (cheap; only every 3rd frame)
  if (frameNo++ % 3 === 0) probeInteraction();

  renderer.info.reset();
  post.render(scene, clock.elapsedTime, window.__debugCamOn ? debugCam : null);

  // HUD
  statsAccum += dt; frames++;
  if (statsAccum >= 0.4) {
    fps = Math.round(frames / statsAccum);
    ui.fps.textContent = String(fps);
    ui.ms.textContent = `${(1000 / Math.max(fps, 1)).toFixed(1)}ms`;
    ui.draws.textContent = String(renderer.info.render.calls);
    ui.tris.textContent = fmtCount(renderer.info.render.triangles);
    ui.pos.textContent = `${player.pos.x.toFixed(0)}, ${player.pos.z.toFixed(0)}`;
    // compass
    const deg = ((-player.yaw * 180) / Math.PI) % 360;
    ui.needle.style.transform = `rotate(${deg}deg)`;
    statsAccum = 0; frames = 0;
  }
}
let frameNo = 0;

function fmtCount(n) {
  if (n > 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n > 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

/* ------------------------------------------------------------ interaction */
function probeInteraction() {
  if (!player) return;
  const hit = player.probe(scene);
  if (hit) {
    ui.reticle.classList.add('hot');
    ui.prompt.innerHTML = `<em>E</em> ${hit.object.userData.interact}`;
    ui.prompt.classList.add('on');
  } else {
    ui.reticle.classList.remove('hot');
    ui.prompt.classList.remove('on');
  }
}

/* --------------------------------------------------------------------- UI */
function bindUI() {
  // dock
  document.querySelectorAll('#dock [data-cam]').forEach((btn) => {
    btn.onclick = () => {
      const m = btn.dataset.cam;
      if (player.mode !== m) player.toggleMode();
      document.querySelectorAll('#dock [data-cam]').forEach((b) => b.classList.toggle('active', b === btn));
      toast(m === 'fly' ? 'Fly mode — Q/Z for altitude' : 'Walk mode');
    };
  });
  document.querySelectorAll('#dock [data-view]').forEach((btn) => {
    btn.onclick = () => gotoView(btn.dataset.view);
  });
  el('btn-ui').onclick = () => togglePanel();
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') { ui.hud.classList.toggle('on'); }
    if (e.code === 'KeyP' || e.code === 'Tab') { e.preventDefault(); togglePanel(); }
    if (e.code === 'KeyT') {
      state.hour = state.hour >= 17.5 ? 6.0 : state.hour + 1.5;
      setHour(state.hour);
      toast(`Sun ${fmtHour(state.hour)}`);
    }
  });

  // panel: quality
  el('q-preset').onchange = (e) => { applyQuality(e.target.value); toast(`Quality: ${e.target.value}`); };
  el('q-scale').oninput = (e) => { state.renderScale = +e.target.value / 100; onResize(); };
  el('q-shadow').oninput = (e) => {
    state.shadowLevel = +e.target.value;
    sky.setShadowQuality(state.shadowLevel);
  };
  el('q-hour').oninput = (e) => setHour(+e.target.value);
  el('q-haze').oninput = (e) => { state.haze = +e.target.value / 100; sky.setHaze(state.haze); };
  el('q-exposure').oninput = (e) => { state.exposure = +e.target.value / 100; post.exposure = state.exposure; };
  el('q-ssao').oninput = (e) => { post.aoEnabled = e.target.value === '1'; };
  el('q-bloom').oninput = (e) => { post.bloomEnabled = e.target.value === '1'; };
  el('q-aa').oninput = (e) => { post.fxaaEnabled = e.target.value === '1'; };

  document.querySelectorAll('#chips-debug button').forEach((btn) => {
    btn.onclick = () => {
      const k = btn.dataset.dbg;
      state.debug[k] = !state.debug[k];
      btn.classList.toggle('on', state.debug[k]);
      applyDebug();
    };
  });
}

function fmtHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function setHour(h) {
  state.hour = h;
  sky.setTime(h);
  el('q-hour').value = String(h);
}
window.setHour = setHour;

function togglePanel() {
  state.panelVisible = !state.panelVisible;
  ui.panel.classList.toggle('hidden', !state.panelVisible);
}

function applyDebug() {
  // Wireframe
  scene.traverse((o) => {
    if (o.isMesh && o.material && 'wireframe' in o.material) {
      if (!o.userData._origWire) o.userData._origWire = o.material.wireframe;
      o.material.wireframe = state.debug.wire;
    }
  });
  if (state.debug.collide) drawColliders(); else clearColliders();
}

let colliderHelper = null;
function drawColliders() {
  if (colliderHelper) return;
  const g = new THREE.Group();
  g.name = 'colliderDebug';
  for (const c of world.colliders) {
    const geo = new THREE.BoxGeometry(c.max.x - c.min.x, c.max.y - c.min.y, c.max.z - c.min.z);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.35 }));
    m.position.set((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
    g.add(m);
  }
  colliderHelper = g;
  scene.add(g);
}
function clearColliders() {
  if (!colliderHelper) return;
  scene.remove(colliderHelper);
  colliderHelper.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  colliderHelper = null;
}

/* -------------------------------------------------------------- viewpoints */
const VIEWS = {
  gate:    { pos: [0, 0, 14], look: [-30, 4, 10] },
  church:  { pos: [-74, 0, 26], look: [-74, 7, 8] },
  plaza:   { pos: [-46, 0, -38], look: [-46, 3, -62] },
  aerial:  { pos: [-40, 0, -10], look: [-46, 0, -58], fly: true, flyPos: [-46, 52, -120] },
};

function gotoView(name) {
  const v = VIEWS[name];
  if (!v) return;
  if (v.fly) {
    if (player.mode !== 'fly') { player.toggleMode(); document.querySelectorAll('#dock [data-cam]').forEach((b) => b.classList.toggle('active', b.dataset.cam === 'fly')); }
    player.teleport(v.flyPos, Math.PI, -0.62);
    player.lookAt(v.look);
  } else {
    if (player.mode !== 'walk') { player.toggleMode(); document.querySelectorAll('#dock [data-cam]').forEach((b) => b.classList.toggle('active', b.dataset.cam === 'walk')); }
    player.teleport(v.pos);
    player.lookAt(v.look);
  }
  toast(name.charAt(0).toUpperCase() + name.slice(1));
}
window.gotoView = gotoView;

function buildDestinationChips() {
  const box = el('chips-dest');
  box.innerHTML = '';
  for (const p of world.places) {
    const btn = document.createElement('button');
    btn.textContent = p.name.replace('Dominican College of Tarlac', 'DCT').replace('San Nicolas de Tolentino', 'SNDT Shrine').replace('Capas ', '');
    btn.onclick = () => {
      player.teleport(p.pos);
      player.lookAt(p.view);
      showPlace(p.name, p.sub);
    };
    box.appendChild(btn);
  }
}

function showPlace(name, sub) {
  ui.place.querySelector('.n').textContent = name;
  ui.place.querySelector('.k').textContent = sub || 'Now entering';
  ui.place.classList.add('on');
  setTimeout(() => ui.place.classList.remove('on'), 2400);
}

/* ------------------------------------------------------------------- go */
boot().catch((err) => {
  console.error(err);
  progress(1, 'failed — see console');
  ui.bootTask.textContent = String(err.message || err);
});

/**
 * Sky + lighting rig.
 *
 * A single directional sun drives:
 *   • a procedural Preetham-style sky dome (gradient + sun disc + horizon haze)
 *   • a PMREM environment map regenerated from that sky, so every PBR surface
 *     gets correct sky/bounce light without baking anything
 *   • a shadow camera fitted to the walkable area at high resolution
 *
 * Capas is at 15.33°N — the sun is high and hard, shadows are short and dark,
 * the sky is a deep saturated blue after the monsoon, with a hazy white
 * horizon band. That look is the whole point of the reference photos.
 */
import * as THREE from 'three';

const DEG = Math.PI / 180;
export const SITE_LAT = 15.3323;

/** Solar position (elevation/azimuth) for a given local hour. */
export function sunAngles(hour, lat = SITE_LAT, dayOfYear = 150) {
  // Simplified but accurate-enough solar geometry (±0.7°).
  const decl = 23.44 * DEG * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
  const H = (hour - 12) * 15 * DEG;
  const phi = lat * DEG;
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // Azimuth measured from north, clockwise.
  const cosAz = (Math.sin(decl) - Math.sin(el) * Math.sin(phi)) / (Math.cos(el) * Math.cos(phi) || 1e-5);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  az = H > 0 ? Math.PI * 2 - az : az;
  return { elevation: el, azimuth: az, declination: decl };
}

/** Sun colour ramp from horizon-red to high-noon white. */
const SUN_RAMP = [
  { e: -3, c: new THREE.Color(0xff5a1e), i: 0.0 },
  { e: 0, c: new THREE.Color(0xff7b33), i: 2.3 },
  { e: 4, c: new THREE.Color(0xffa057), i: 5.5 },
  { e: 10, c: new THREE.Color(0xffca8c), i: 8.5 },
  { e: 25, c: new THREE.Color(0xfff0d6), i: 11.5 },
  { e: 45, c: new THREE.Color(0xfffaee), i: 13.0 },
  { e: 75, c: new THREE.Color(0xffffff), i: 14.0 },
];
function sampleRamp(e) {
  let a = SUN_RAMP[0], b = SUN_RAMP[SUN_RAMP.length - 1];
  for (let i = 0; i < SUN_RAMP.length - 1; i++) {
    if (e >= SUN_RAMP[i].e && e <= SUN_RAMP[i + 1].e) { a = SUN_RAMP[i]; b = SUN_RAMP[i + 1]; break; }
  }
  if (e < SUN_RAMP[0].e) return { color: SUN_RAMP[0].c.clone(), intensity: 0 };
  if (e > SUN_RAMP[SUN_RAMP.length - 1].e) return { color: SUN_RAMP[SUN_RAMP.length - 1].c.clone(), intensity: SUN_RAMP[SUN_RAMP.length - 1].i };
  const t = (e - a.e) / (b.e - a.e);
  return {
    color: a.c.clone().lerp(b.c, t),
    intensity: a.i + (b.i - a.i) * t,
  };
}

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // push to far plane
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform float uHaze;
uniform float uSunSize;
uniform float uNight;
varying vec3 vWorld;

// Cheap atmospheric scattering approximation (Preetham-inspired ramp).
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);

  // Sky gradient: zenith -> horizon, with a warm band near the sun.
  float t = pow(clamp(1.0 - h, 0.0, 1.0), 2.4);
  vec3 col = mix(uZenith, uHorizon, t);

  // Sun-relative glow near the horizon (forward scattering).
  float cosSun = max(dot(d, uSunDir), 0.0);
  float forward = pow(cosSun, 4.0) * uHaze;
  float tight = pow(cosSun, 220.0);
  col += uSunColor * forward * 0.55;
  col += uSunColor * tight * 1.4;

  // Sun disc.
  float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.45, cosSun);
  col += uSunColor * disc * 14.0 * (1.0 - uNight);

  // Below horizon: ground haze, never pure black.
  float below = smoothstep(0.0, -0.16, h);
  col = mix(col, uGround, below);

  // Moon-ish zenith at night, faint stars.
  if (uNight > 0.01) {
    float st = fract(sin(dot(floor(d.xz * 900.0), vec2(12.9898, 78.233))) * 43758.5453);
    float star = step(0.9975, st) * smoothstep(0.02, 0.3, h);
    col += vec3(0.85, 0.9, 1.0) * star * 0.9 * uNight;
  }

  // Dither to kill banding in the gradient (very visible on 8-bit displays).
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  col += dither;

  gl_FragColor = vec4(col, 1.0);
}`;

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color(0x2f6cc4) },
      uHorizon: { value: new THREE.Color(0xcfe2f2) },
      uGround: { value: new THREE.Color(0x6e7c74) },
      uSunColor: { value: new THREE.Color(0xfff0d8) },
      uHaze: { value: 0.34 },
      uSunSize: { value: 0.0009 },
      uNight: { value: 0.0 },
    };

    this.geo = new THREE.SphereGeometry(1, 32, 20);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT.replace('varying vec3 vWorld;', ''),
      fragmentShader: SKY_FRAG.replace('varying vec3 vWorld;', ''),
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(this.geo, this.mat);
    this.dome.scale.setScalar(4000);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    scene.add(this.dome);

    // Sun light
    this.sun = new THREE.DirectionalLight(0xfff3e0, 11.5);
    this.sun.castShadow = true;
    const sc = this.sun.shadow;
    sc.mapSize.set(2048, 2048);
    sc.bias = -0.0006;
    sc.normalBias = 0.035;
    sc.camera.near = 1;
    sc.camera.far = 520;
    sc.camera.left = -130; sc.camera.right = 130;
    sc.camera.top = 130; sc.camera.bottom = -130;
    sc.blurSamples = 8;
    this.sun.target = new THREE.Object3D();
    this.sun.target.position.set(-30, 0, -20);
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Fill light standing in for the bright sky bounce off concrete + grass.
    // Kept low: the PMREM environment already carries most of the ambient, and
    // stacking the two is what flattens an image.
    this.fill = new THREE.HemisphereLight(0xc6dcf2, 0x8e8c7a, 0.18);
    scene.add(this.fill);

    // Tiny ambient so deep interiors never go fully black.
    this.ambient = new THREE.AmbientLight(0x9db4c8, 0.04);
    scene.add(this.ambient);

    // Env map (PMREM from a small render of the sky).
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(this.geo, this.mat);
    this.envDome.scale.setScalar(100);
    this.envScene.add(this.envDome);
    this.envRT = null;
    this.envDirty = true;

    this.hour = 9.5;
    this.night = 0;
    this.setTime(9.5);
  }

  setHaze(v) { this.uniforms.uHaze.value = v; this.envDirty = true; }

  setTime(hour) {
    this.hour = hour;
    const { elevation, azimuth } = sunAngles(hour);
    const el = elevation / DEG;
    const az = azimuth;

    // Direction *toward* the sun.
    const y = Math.sin(elevation);
    const horiz = Math.cos(elevation);
    // azimuth measured clockwise from north; -Z is north → x = sin(az), z = -cos(az)
    const dir = new THREE.Vector3(Math.sin(az) * horiz, y, -Math.cos(az) * horiz).normalize();
    this.sunDir = dir;
    this.uniforms.uSunDir.value.copy(dir);

    const ramp = sampleRamp(el);
    this.sun.color.copy(ramp.color);
    this.sun.intensity = ramp.intensity;
    this.sun.position.copy(dir).multiplyScalar(240).add(this.sun.target.position);
    this.uniforms.uSunColor.value.copy(ramp.color).multiplyScalar(1.0);

    // Sky palette by elevation. High sun → deep blue; low sun → warm horizon.
    const day = THREE.MathUtils.smoothstep(el, -6, 12);
    const golden = THREE.MathUtils.smoothstep(el, 0, 22);
    const zenith = new THREE.Color(0x0a1c42).lerp(new THREE.Color(0x1f5fb8), day);
    zenith.lerp(new THREE.Color(0x3f7cc4), golden * 0.3);
    const horizon = new THREE.Color(0x1a1c28)
      .lerp(new THREE.Color(0xffb27a), 1 - golden)
      .lerp(new THREE.Color(0xc2d9ef), golden);
    const ground = new THREE.Color(0x1c1c22).lerp(new THREE.Color(0x8d8a76), day * 0.85);
    this.uniforms.uZenith.value.copy(zenith);
    this.uniforms.uHorizon.value.copy(horizon);
    this.uniforms.uGround.value.copy(ground);

    // Night factor for stars and lamp glow.
    this.night = 1 - THREE.MathUtils.smoothstep(el, -4, 6);
    this.uniforms.uNight.value = this.night;

    // Fill light follows the sky.
    this.fill.intensity = 0.06 + day * 0.20;
    this.fill.color.copy(new THREE.Color(0x22304a).lerp(new THREE.Color(0xc6dcf2), day));
    this.fill.groundColor.copy(new THREE.Color(0x14161a).lerp(new THREE.Color(0x7e7d6c), day));
    this.ambient.intensity = 0.02 + day * 0.035;

    // Shadow strength: hard at noon, softer at golden hour.
    this.sun.shadow.radius = 1.2 + (1 - golden) * 2.4;

    // Fog matches the horizon so distant geometry dissolves instead of popping.
    // Capas has real haze, but at ground level it only reads beyond ~300 m —
    // anything stronger turns the whole image milky.
    const fogCol = horizon.clone().lerp(zenith, 0.42).multiplyScalar(0.95);
    this.scene.fog = new THREE.FogExp2(fogCol.getHex(), 0.00040 + (1 - golden) * 0.0008);

    this.envDirty = true;
    return this;
  }

  /** Regenerate IBL. Called lazily (max ~2 Hz) to avoid stalling the GPU. */
  refreshEnv() {
    if (!this.envDirty) return;
    this.envDirty = false;
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.04, 1, 400);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.9;
  }

  setShadowQuality(level) {
    // 0 = off, 1 = 1k, 2 = 2k, 3 = 4k
    this.sun.castShadow = level > 0;
    if (level <= 0) return;
    const size = [0, 1024, 2048, 4096][level];
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const extent = [0, 95, 130, 180][level];
    const cam = this.sun.shadow.camera;
    cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent;
    cam.updateProjectionMatrix();
  }

  /** Keeps the shadow frustum centred on the viewer. */
  followTarget(pos) {
    const t = this.sun.target.position;
    // snap to texel grid to avoid shimmering
    const texel = (this.sun.shadow.camera.right * 2) / this.sun.shadow.mapSize.x;
    const x = Math.round(pos.x / texel) * texel;
    const z = Math.round(pos.z / texel) * texel;
    t.set(x, 0, z);
    this.sun.position.copy(this.sunDir).multiplyScalar(240).add(t);
    this.sun.target.updateMatrixWorld();
  }
}

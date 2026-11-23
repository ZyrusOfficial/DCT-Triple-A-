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

/**
 * Sun colour and intensity against elevation.
 *
 * The intensity here is not physical irradiance — it is the value that looks
 * right through ACES after the sky's own brightness is accounted for. What
 * matters for believability is that a low sun is still a *strong* light with a
 * warm colour: the atmosphere reddens it and cuts it, but it does not turn it
 * off. An earlier ramp dropped to 5.5 at 4° while the sky was still fully lit,
 * which produced a bright sky with no shadows and flat, washed-out ground.
 */
const SUN_RAMP = [
  { e: -2.0, c: new THREE.Color(0xff5a1e), i: 0.0 },
  { e: 0.0, c: new THREE.Color(0xff7a3a), i: 1.7 },
  { e: 3.0, c: new THREE.Color(0xff9a55), i: 3.7 },
  { e: 8.0, c: new THREE.Color(0xffbb80), i: 5.0 },
  { e: 16.0, c: new THREE.Color(0xffd9ae), i: 5.9 },
  { e: 30.0, c: new THREE.Color(0xfff2dd), i: 6.6 },
  { e: 50.0, c: new THREE.Color(0xfffaf1), i: 7.1 },
  { e: 80.0, c: new THREE.Color(0xffffff), i: 7.4 },
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

/**
 * Sky dome shading.
 *
 * An analytic approximation rather than a full Rayleigh/Mie integration (which
 * needs a LUT — too much for an iGPU at 1080p), but built the way real
 * scattering behaves, which is what stops it reading as a painted gradient:
 *
 *   • Rayleigh body: blue overhead, whiter toward the horizon.
 *   • Mie halo: TWO lobes — a wide soft wash plus a narrow bright aureole. A
 *     single lobe is what makes cheap skies look like they have a stamped-on
 *     circle.
 *   • The disc is limb-darkened (a real photosphere is dimmer at its edge) and
 *     is anti-aliased in ANGULAR units so it stays round at any FOV.
 *   • All output is linear HDR well above 1.0 where the sun is; the tone mapper
 *     in post.js blows it out on purpose, exactly like a camera.
 */
const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform float uHaze;
uniform float uNight;
uniform float uSunAngRadius;

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  float cosSun = clamp(dot(d, uSunDir), -1.0, 1.0);

  // ---- Rayleigh body -------------------------------------------------------
  float t = pow(clamp(1.0 - h, 0.0, 1.0), 2.6);
  vec3 col = mix(uZenith, uHorizon, t);

  // Extra whitening in the last few degrees above the horizon.
  col = mix(col, uHorizon * 1.06, pow(clamp(1.0 - h, 0.0, 1.0), 9.0) * 0.7);

  // ---- Mie halo: wide wash + narrow aureole --------------------------------
  float wide = pow(max(cosSun, 0.0), 5.0);
  float tight = pow(max(cosSun, 0.0), 260.0);
  col += uSunColor * wide * 0.22 * uHaze;
  col += uSunColor * tight * 0.55;

  // ---- Solar disc ----------------------------------------------------------
  float ang = acos(cosSun);
  float r = ang / max(uSunAngRadius, 1e-6);
  float limb = mix(0.55, 1.0, sqrt(max(0.0, 1.0 - min(r * r, 1.0))));
  float disc = (1.0 - smoothstep(0.86, 1.0, r)) * limb;
  col += uSunColor * disc * 60.0 * (1.0 - uNight);

  // ---- Below the horizon ---------------------------------------------------
  float below = smoothstep(0.0, -0.10, h);
  col = mix(col, uGround, below);

  // ---- Night ---------------------------------------------------------------
  if (uNight > 0.01) {
    float st = fract(sin(dot(floor(d.xz * 900.0), vec2(12.9898, 78.233))) * 43758.5453);
    float star = step(0.9975, st) * smoothstep(0.02, 0.3, h);
    col += vec3(0.85, 0.9, 1.0) * star * 0.9 * uNight;
  }

  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0) + dither, 1.0);
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
      // True solar angular radius is 0.266 deg = 0.00464 rad. Anything much
      // larger reads as a glowing balloon rather than the sun.
      uSunAngRadius: { value: 0.0047 },
      uNight: { value: 0.0 },
    };

    // Segments matter: with too few the dome's silhouette shows faceting along
    // the horizon, which reads as a hard ring in the distance.
    this.geo = new THREE.SphereGeometry(1, 48, 28);
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
    /**
     * The dome radius MUST stay inside every camera's far plane, or it is
     * clipped and you get a hard arc across the sky (a pale dome edge sitting
     * above the hills). The walk camera's far plane is 2600.
     */
    this.dome.scale.setScalar(2400);
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
    // Sky/ground fill. This is what stands in for global illumination, so it
    // has to be strong enough that a surface in shade still shows its albedo.
    this.fill = new THREE.HemisphereLight(0xcfe3f7, 0xa39684, 1.05);
    scene.add(this.fill);

    // Tiny ambient so deep interiors never go fully black.
    this.ambient = new THREE.AmbientLight(0xa8bfd4, 0.16);
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
    // Sky palette. `golden` is 0 at/below the horizon and 1 well above it, so
    // the warm horizon band has to be driven by (1 - golden) but must never let
    // the zenith collapse to black while the sun is still up.
    const zenith = new THREE.Color(0x14284f)          // dusk navy
      .lerp(new THREE.Color(0x1d5cb4), day)           // full daytime blue
      .lerp(new THREE.Color(0x4a7fc0), (1 - golden) * 0.22);
    const horizon = new THREE.Color(0x2a2a36)         // dusk
      .lerp(new THREE.Color(0xffc08a), (1 - golden) * 0.92)  // warm band
      .lerp(new THREE.Color(0xcfe3f5), golden * 0.85);
    const ground = new THREE.Color(0x232326).lerp(new THREE.Color(0x9a9682), day * 0.9);
    this.uniforms.uZenith.value.copy(zenith);
    this.uniforms.uHorizon.value.copy(horizon);
    this.uniforms.uGround.value.copy(ground);

    // Night factor for stars and lamp glow.
    this.night = 1 - THREE.MathUtils.smoothstep(el, -4, 6);
    this.uniforms.uNight.value = this.night;

    // Fill light follows the sky.
    /**
     * Sky/ground fill — this is the stand-in for global illumination.
     *
     * It must be strong enough that a surface in shadow still reads its albedo.
     * These were previously set to 0.06 + 0.20·day, which crushed every shaded
     * face to pure black and made porches, arcades and north walls look like
     * holes punched in the render. Shadowed concrete outdoors is roughly a fifth
     * of sunlit concrete, not a hundredth.
     */
    this.fill.intensity = 0.34 + day * 0.78;
    this.fill.color.copy(new THREE.Color(0x2a3a58).lerp(new THREE.Color(0xcfe3f7), day));
    this.fill.groundColor.copy(new THREE.Color(0x22201c).lerp(new THREE.Color(0xa39684), day));
    this.ambient.intensity = 0.05 + day * 0.14;

    // Shadow strength: hard at noon, softer at golden hour.
    // Softer and longer shadows at low sun, but they never disappear.
    this.sun.shadow.radius = 1.0 + (1 - golden) * 1.8;
    this.sun.shadow.bias = -0.0004 - (1 - golden) * 0.0006;

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
    this.scene.environmentIntensity = 1.55;
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

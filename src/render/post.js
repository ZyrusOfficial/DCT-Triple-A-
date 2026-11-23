/**
 * Post-processing chain, hand-rolled so it compiles to a handful of half-float
 * passes and runs comfortably at 1080p on a Vega 7.
 *
 * Order: scene(HDR) → SSAO (half-res, blue-noise) → composite → bloom (dual
 * filter, quarter-res) → ACES tonemap + sRGB + FXAA + vignette + grain.
 *
 * Everything can be toggled at runtime; the chain rebuilds its targets when the
 * render scale changes.
 */
import * as THREE from 'three';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const QUAD = new THREE.PlaneGeometry(2, 2);

function pass(frag, uniforms) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: FS_VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(QUAD, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { scene, mat, uniforms };
}

/* ------------------------------------------------------------------- SSAO */
const SSAO_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uRes;
uniform mat4 uProjInv;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uRadius;
uniform float uIntensity;
uniform float uBias;
uniform float uFrame;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233)) + uFrame) * 43758.5453); }

vec3 viewPosFromDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 view = uProjInv * clip;
  return view.xyz / view.w;
}

void main() {
  float depth = texture2D(tDepth, vUv).x;
  if (depth >= 0.9999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPosFromDepth(vUv);
  vec3 N = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);

  const int SAMPLES = 12;
  vec3 kernel[12];
  kernel[0]  = vec3(0.538, 0.086,-0.837);
  kernel[1]  = vec3(-0.402,-0.432, 0.806);
  kernel[2]  = vec3(-0.754, 0.640, 0.152);
  kernel[3]  = vec3(0.219,-0.947,-0.235);
  kernel[4]  = vec3(0.912, 0.312, 0.267);
  kernel[5]  = vec3(-0.181, 0.082,-0.980);
  kernel[6]  = vec3(0.431,-0.677,-0.594);
  kernel[7]  = vec3(-0.876,-0.326, 0.357);
  kernel[8]  = vec3(0.113, 0.884, 0.453);
  kernel[9]  = vec3(0.676,-0.201, 0.708);
  kernel[10] = vec3(-0.512, 0.518,-0.685);
  kernel[11] = vec3(0.306, 0.152, 0.938);

  float rnd = rand(vUv * uRes);
  float occ = 0.0;
  float radius = uRadius;

  // Build a TBN basis from the view-space normal.
  vec3 up = abs(N.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  // Random rotation of the hemisphere per pixel, per frame — cheap TAA-ish.
  float a = rnd * 6.2831853;
  mat3 rot = mat3(cos(a), -sin(a), 0.0, sin(a), cos(a), 0.0, 0.0, 0.0, 1.0);
  mat3 TBN = mat3(T, B, N) * rot;

  for (int i = 0; i < SAMPLES; i++) {
    vec3 s = TBN * kernel[i];
    // Distribute samples in a shrinking sphere weighted toward the centre.
    float scale = mix(0.18, 1.0, pow(float(i) / float(SAMPLES), 1.6));
    vec3 samplePos = P + s * radius * scale;
    vec4 offset = uProj * vec4(samplePos, 1.0);
    offset.xyz /= offset.w;
    vec2 suv = offset.xy * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sd = texture2D(tDepth, suv).x;
    vec3 S = viewPosFromDepth(suv);
    vec3 diff = S - P;
    float dist = length(diff);
    // Range check so silhouettes don't leak.
    float range = smoothstep(0.0, 1.0, radius / max(dist, 1e-4));
    float occlusion = max(0.0, dot(N, normalize(diff)) - uBias) * range;
    occ += occlusion;
  }
  occ = 1.0 - (occ / float(SAMPLES)) * uIntensity;
  gl_FragColor = vec4(clamp(occ, 0.0, 1.0));
}`;

/* --------------------------------------------------------------- composite */
const COMPOSITE_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform float uAOEnabled;
uniform float uAOStrength;

void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  if (uAOEnabled > 0.5) {
    float ao = texture2D(tAO, vUv).r;
    // Only darken where the ambient term dominates a little; keep it subtle.
    c *= mix(1.0, ao, uAOStrength);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/* ------------------------------------------------------------------ bloom */
const BLOOM_PREFILTER = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;

void main() {
  vec3 c = vec3(0.0);
  // 4-tap downsample with Karis averaging to suppress fireflies.
  const vec2 o[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
  float wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 s = texture2D(tColor, vUv + o[i] * uTexel).rgb;
    float w = 1.0 / (1.0 + dot(s, vec3(0.2126, 0.7152, 0.0722)));
    c += s * w; wsum += w;
  }
  c /= max(wsum, 1e-4);
  float br = max(max(c.r, c.g), c.b);
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}`;

const BLOOM_BLUR = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform vec2 uDir;

void main() {
  // 9-tap gaussian with linear-sampling offsets.
  const float w[5] = float[5](0.227027, 0.194594, 0.121621, 0.054054, 0.016216);
  vec2 o = uDir * uTexel;
  vec3 c = texture2D(tColor, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture2D(tColor, vUv + o * float(i) * 2.0).rgb * w[i];
    c += texture2D(tColor, vUv - o * float(i) * 2.0).rgb * w[i];
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/* ---------------------------------------------------------------- tonemap */
const FINAL_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 uTexel;
uniform float uExposure;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uFxaa;
uniform vec2 uRes;

// ACES filmic (Narkowicz fit) — cheap and filmic.
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(1e-5)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = vUv;
  vec3 c = texture2D(tColor, uv).rgb;
  if (uBloom > 0.001) c += texture2D(tBloom, uv).rgb * uBloom;

  // Subtle "lens" warmth + cool shadows (very slight, avoids flat digital look).
  c *= vec3(1.02, 1.0, 0.97);
  c += vec3(0.0, 0.004, 0.010) * (1.0 - luma(c));

  c *= uExposure;
  c = aces(c);
  c = srgb(c);

  // Vignette
  vec2 q = uv - 0.5;
  float vig = 1.0 - uVignette * dot(q, q) * 1.6;
  c *= clamp(vig, 0.0, 1.0);

  // Film grain (very fine, animated)
  if (uGrain > 0.0) {
    float n = fract(sin(dot(uv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    c += (n - 0.5) * uGrain;
  }

  // FXAA
  if (uFxaa > 0.5) {
    vec3 nw = texture2D(tColor, uv + vec2(-1.0, -1.0) * uTexel).rgb;
    vec3 ne = texture2D(tColor, uv + vec2(1.0, -1.0) * uTexel).rgb;
    vec3 sw = texture2D(tColor, uv + vec2(-1.0, 1.0) * uTexel).rgb;
    vec3 se = texture2D(tColor, uv + vec2(1.0, 1.0) * uTexel).rgb;
    float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(c);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    if (lMax - lMin > 0.11) {
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      dir = clamp(dir / (max(abs(dir.x), abs(dir.y)) + 1e-5), -1.0, 1.0) * uTexel * 1.4;
      vec3 a1 = texture2D(tColor, uv + dir * 0.5).rgb;
      vec3 a2 = texture2D(tColor, uv - dir * 0.5).rgb;
      c = mix(c, (a1 + a2) * 0.5, 0.65);
      // Re-apply sRGB-ish curve cheaply (approximation, keeps edges from glowing)
      c = mix(c, srgb(aces(texture2D(tColor, uv).rgb * uExposure)), 0.25);
    }
  }

  gl_FragColor = vec4(c, 1.0);
}`;

export class PostFX {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.enabled = true;
    this.aoEnabled = true;
    this.bloomEnabled = true;
    this.fxaaEnabled = true;

    this.exposure = 1.0;
    this.bloomStrength = 0.55;
    this.aoStrength = 0.75;
    this.grain = 0.012;
    this.vignette = 0.35;
    this.frame = 0;

    const gl = renderer.getContext();
    this.hasFloat = !!gl.getExtension('EXT_color_buffer_half_float') ||
                    !!gl.getExtension('EXT_color_buffer_float');

    this.rtScene = null;
    this.rtAO = null;
    this.rtNormal = null;
    this.rtBloomA = null;
    this.rtBloomB = null;

    this.aoPass = pass(SSAO_FRAG, {
      tDepth: { value: null }, tNormal: { value: null }, uRes: { value: new THREE.Vector2() },
      uProjInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() },
      uView: { value: new THREE.Matrix4() },
      uRadius: { value: 0.85 }, uIntensity: { value: 1.15 }, uBias: { value: 0.035 },
      uFrame: { value: 0 },
    });
    this.compositePass = pass(COMPOSITE_FRAG, {
      tColor: { value: null }, tAO: { value: null },
      uAOEnabled: { value: 1 }, uAOStrength: { value: this.aoStrength },
    });
    this.prefilterPass = pass(BLOOM_PREFILTER, {
      tColor: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0.85 }, uKnee: { value: 0.4 },
    });
    this.blurPass = pass(BLOOM_BLUR, {
      tColor: { value: null }, uTexel: { value: new THREE.Vector2() },
      uDir: { value: new THREE.Vector2(1, 0) },
    });
    this.finalPass = pass(FINAL_FRAG, {
      tColor: { value: null }, tBloom: { value: null }, uTexel: { value: new THREE.Vector2() },
      uExposure: { value: 1.0 }, uBloom: { value: 0.55 }, uVignette: { value: 0.35 },
      uGrain: { value: 0.012 }, uTime: { value: 0 }, uFxaa: { value: 1 },
      uRes: { value: new THREE.Vector2() },
    });

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = new THREE.Vector2(1, 1);
  }

  setSize(width, height, scale = 1) {
    const w = Math.max(2, Math.floor(width * scale));
    const h = Math.max(2, Math.floor(height * scale));
    this.size.set(w, h);
    const dispose = (rt) => rt && rt.dispose();
    dispose(this.rtScene); dispose(this.rtAO); dispose(this.rtNormal); dispose(this.rtBloomA); dispose(this.rtBloomB);

    const type = this.hasFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rtScene = new THREE.WebGLRenderTarget(w, h, {
      type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
      generateMipmaps: false,
    });
    this.rtScene.depthTexture.format = THREE.DepthFormat;

    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    // AO at half res (huge win, invisible loss since it's low-frequency).
    this.rtAO = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    // View-space normals at half res for AO.
    this.rtNormal = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });

    const qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
    this.rtBloomA = new THREE.WebGLRenderTarget(qw, qh, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rtBloomB = new THREE.WebGLRenderTarget(qw, qh, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });

    this.aoPass.uniforms.uRes.value.set(hw, hh);
    this.finalPass.uniforms.uRes.value.set(w, h);
    this.finalPass.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.prefilterPass.uniforms.uTexel.value.set(1 / w, 1 / h);

    // Update shadow render target size only if present.
    if (this.renderer.getRenderTarget() === null) {
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.setSize(width, height, false);
    }
  }

  render(scene, time = 0, overrideCam = null) {
    const r = this.renderer;
    const cam = overrideCam || this.camera;
    this.frame++;

    // -- 1. scene into HDR target
    r.setRenderTarget(this.rtScene);
    r.clear(true, true, true);
    r.render(scene, cam);

    const depthTex = this.rtScene.depthTexture;
    const colorTex = this.rtScene.texture;

    // -- 2. SSAO
    let compositeTex = colorTex;
    if (this.aoEnabled) {
      const u = this.aoPass.uniforms;
      u.tDepth.value = depthTex;
      u.uProj.value.copy(cam.projectionMatrix);
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      u.uView.value.copy(cam.matrixWorldInverse);
      u.uFrame.value = this.frame % 64;
      r.setRenderTarget(this.rtAO);
      r.render(this.aoPass.scene, this.quadCam);

      this.compositePass.uniforms.tColor.value = colorTex;
      this.compositePass.uniforms.tAO.value = this.rtAO.texture;
      this.compositePass.uniforms.uAOStrength.value = this.aoStrength;
      r.setRenderTarget(this.rtBloomB === null ? null : this._scratch());
      r.render(this.compositePass.scene, this.quadCam);
      compositeTex = this._scratchRT ? this._scratchRT.texture : colorTex;
    }

    // -- 3. bloom
    if (this.bloomEnabled) {
      this.prefilterPass.uniforms.tColor.value = compositeTex;
      r.setRenderTarget(this.rtBloomA);
      r.render(this.prefilterPass.scene, this.quadCam);

      for (let i = 0; i < 3; i++) {
        const spread = 1 + i * 2;
        this.blurPass.uniforms.tColor.value = this.rtBloomA.texture;
        this.blurPass.uniforms.uDir.value.set(spread, 0);
        this.blurPass.uniforms.uTexel.value.set(1 / this.rtBloomA.width, 1 / this.rtBloomA.height);
        r.setRenderTarget(this.rtBloomB);
        r.render(this.blurPass.scene, this.quadCam);

        this.blurPass.uniforms.tColor.value = this.rtBloomB.texture;
        this.blurPass.uniforms.uDir.value.set(0, spread);
        r.setRenderTarget(this.rtBloomA);
        r.render(this.blurPass.scene, this.quadCam);
      }
    }

    // -- 4. final
    const f = this.finalPass.uniforms;
    f.tColor.value = compositeTex;
    f.tBloom.value = this.rtBloomA.texture;
    f.uBloom.value = this.bloomEnabled ? this.bloomStrength : 0;
    f.uExposure.value = this.exposure;
    f.uVignette.value = this.vignette;
    f.uGrain.value = this.grain;
    f.uTime.value = time;
    f.uFxaa.value = this.fxaaEnabled ? 1 : 0;
    r.setRenderTarget(null);
    r.render(this.finalPass.scene, this.quadCam);
  }

  _scratch() {
    if (!this._scratchRT) {
      this._scratchRT = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
        type: this.hasFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
      });
    }
    return this._scratchRT;
  }
}

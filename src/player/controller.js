/**
 * First-person controller: walking, running, head bob, stairs, and a free-fly
 * mode for inspecting the model. Written to feel calm rather than gamey — no
 * sprint bar, no stamina, just a person strolling through the campus.
 */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0, 0, 12);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = -0.02;
    this.mode = 'walk';       // 'walk' | 'fly'
    this.eyeHeight = 1.68;
    this.radius = 0.34;
    this.bob = 0;
    this.bobAmp = 0;
    this.keys = new Set();
    this.locked = false;
    this.sensitivity = 0.0022;
    this.fov = 62;
    this.fovTarget = 62;
    this.walkSpeed = 2.4;
    this.runSpeed = 5.6;
    this.flySpeed = 14;
    this.velSmooth = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this.enabled = true;
    this.onInteract = null;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.2;
    this.hover = null;
  }

  attach(dom) {
    this.dom = dom;
    dom.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    dom.addEventListener('mousedown', () => {
      if (!this.locked && this.enabled) dom.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      document.body.classList.toggle('locked', this.locked);
    });
    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.toggleMode();
      if (e.code === 'KeyE' && this.onInteract) this.onInteract(this.hover);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  toggleMode() {
    this.mode = this.mode === 'walk' ? 'fly' : 'walk';
    if (this.mode === 'walk') {
      this.pos.y = Math.max(this.world.groundAt(this.pos.x, this.pos.z), 0);
      this.vel.set(0, 0, 0);
    }
    return this.mode;
  }

  teleport(pos, yaw = null, pitch = 0) {
    this.pos.set(pos[0], pos[1] ?? 0, pos[2]);
    if (yaw !== null) this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.updateCamera(0);
  }

  lookAt(target) {
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    const d = new THREE.Vector3(...target).sub(eye);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let fwd = 0, strafe = 0, up = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
    if (k.has('KeyQ') || k.has('Space')) up += 1;
    if (k.has('KeyZ') || k.has('ControlLeft')) up -= 1;

    const running = k.has('ShiftLeft') || k.has('ShiftRight');

    // Camera basis on the horizontal plane.
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.crossVectors(this._forward, UP).normalize().negate();

    if (this.mode === 'fly') {
      const dir = new THREE.Vector3();
      const camFwd = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      const camRight = new THREE.Vector3().crossVectors(camFwd, UP).normalize().negate();
      dir.addScaledVector(camFwd, fwd);
      dir.addScaledVector(camRight, strafe);
      dir.addScaledVector(UP, up);
      if (dir.lengthSq() > 0) dir.normalize();
      const sp = this.flySpeed * (running ? 2.4 : 1);
      this.vel.lerp(dir.multiplyScalar(sp), 1 - Math.exp(-8 * dt));
      this.pos.addScaledVector(this.vel, dt);
      this.fovTarget = 62 + (running ? 6 : 0);
    } else {
      const wish = new THREE.Vector3();
      wish.addScaledVector(this._forward, fwd);
      wish.addScaledVector(this._right, strafe);
      if (wish.lengthSq() > 1e-6) wish.normalize();
      const speed = running ? this.runSpeed : this.walkSpeed;
      const target = wish.multiplyScalar(speed);
      const accel = 1 - Math.exp(-12 * dt);
      this.vel.x += (target.x - this.vel.x) * accel;
      this.vel.z += (target.z - this.vel.z) * accel;

      const before = this.pos.clone();
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.world.resolveCollisions(this.pos, this.radius);
      // If we got pushed back, bleed speed so we don't grind a wall.
      const pushed = Math.hypot(this.pos.x - before.x - this.vel.x * dt, this.pos.z - before.z - this.vel.z * dt);
      if (pushed > 1e-4) {
        this.vel.x *= 0.4; this.vel.z *= 0.4;
      }

      const groundY = this.world.groundAt(this.pos.x, this.pos.z);
      this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * 12);

      // Head bob scaled by actual speed.
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.bobAmp += ((sp > 0.2 ? Math.min(sp / this.runSpeed, 1) : 0) - this.bobAmp) * Math.min(1, dt * 6);
      this.bob += dt * sp * 2.6;
      this.fovTarget = 62 + (running && sp > 1 ? 4 : 0);
    }

    // Smooth FOV (subtle speed cue, cheap and effective)
    if (Math.abs(this.camera.fov - this.fovTarget) > 0.01) {
      this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }

    this.updateCamera(dt);
  }

  updateCamera() {
    const cam = this.camera;
    const bobY = this.mode === 'walk' ? Math.sin(this.bob * 2) * 0.028 * this.bobAmp : 0;
    const bobX = this.mode === 'walk' ? Math.cos(this.bob) * 0.02 * this.bobAmp : 0;
    cam.position.set(this.pos.x + bobX, this.pos.y + this.eyeHeight + bobY, this.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = this.mode === 'walk' ? Math.sin(this.bob * 2) * 0.004 * this.bobAmp : 0;
  }

  /** Raycast for interactables in front of the camera. */
  probe(scene) {
    if (this.mode !== 'walk' || !this.enabled) { this.hover = null; return null; }
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects(scene.children, true);
    this.hover = hits.find((h) => h.object.userData?.interact) || null;
    return this.hover;
  }
}

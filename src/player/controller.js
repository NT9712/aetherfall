// Third-person controller: run/sprint/jump/glide with stamina, smooth
// camera orbit (pointer lock), terrain grounding and camera collision.

import * as THREE from 'three';
import { heightAt, SEA_LEVEL } from '../world/heightfield.js';

const WALK_SPEED = 4.6;
const SPRINT_SPEED = 8.0;
const GLIDE_SPEED = 6.2;
const GRAVITY = -22;
const JUMP_V = 8.4;

export class Controller {
  constructor(camera, input, character) {
    this.camera = camera;
    this.input = input;
    this.character = character;

    this.pos = new THREE.Vector3(14, heightAt(14, -20), -20);
    this.vy = 0;
    this.grounded = true;
    this.gliding = false;
    this.facing = Math.PI;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 6.5;
    this.velH = new THREE.Vector2();
    this.enabled = false;
  }

  get sprinting() {
    return this.input.isDown('ShiftLeft') && this.speed01 > 0.5 && this.stamina > 0 && this.grounded;
  }
  get speed01() { return this.velH.length() / SPRINT_SPEED; }

  update(dt) {
    const input = this.input;
    const mouse = input.consumeMouse();
    this.camYaw -= mouse.dx * 0.0026;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + mouse.dy * 0.0022, -0.25, 1.15);
    const wheel = input.consumeWheel();
    this.camDist = THREE.MathUtils.clamp(this.camDist + wheel * 0.7, 3.2, 11);

    // ---- desired horizontal direction (camera-relative) ----
    let ix = 0, iz = 0;
    if (this.enabled) {
      if (input.isDown('KeyW')) iz += 1;
      if (input.isDown('KeyS')) iz -= 1;
      if (input.isDown('KeyA')) ix -= 1;
      if (input.isDown('KeyD')) ix += 1;
    }
    const moving = ix !== 0 || iz !== 0;
    let wishX = 0, wishZ = 0;
    if (moving) {
      const len = Math.hypot(ix, iz);
      ix /= len; iz /= len;
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      // Camera orbits at offset (sin yaw, cos yaw) from the player, so the
      // direction the player runs on W is forward = (-sin, -cos), and the
      // right-hand strafe vector is right = (cos, -sin).
      //   wish = forward * iz + right * ix
      wishX = -sin * iz + cos * ix;
      wishZ = -cos * iz - sin * ix;
      const wl = Math.hypot(wishX, wishZ);
      wishX /= wl; wishZ /= wl;
    }

    // ---- state transitions ----
    const groundY = heightAt(this.pos.x, this.pos.z);
    if (input.wasPressed('Space') && this.enabled) {
      if (this.grounded) {
        this.vy = JUMP_V;
        this.grounded = false;
        this.gliding = false;
      } else if (!this.gliding && this.vy < 2 && this.stamina > 5) {
        this.gliding = true;
        this.vy = Math.max(this.vy, -2);
      } else if (this.gliding) {
        this.gliding = false;
      }
    }

    const sprinting = this.sprinting;
    const targetSpeed = this.gliding ? GLIDE_SPEED : (sprinting ? SPRINT_SPEED : WALK_SPEED);

    // ---- horizontal velocity ----
    const k = Math.min(1, dt * (this.grounded ? 10 : 4));
    this.velH.x += ((wishX * targetSpeed) - this.velH.x) * k;
    this.velH.y += ((wishZ * targetSpeed) - this.velH.y) * k;
    if (this.gliding && moving) {
      // Glide steers the whole body toward camera-forward.
      this.facing = shortAngle(this.facing, Math.atan2(wishX, wishZ), dt * 3);
    } else if (moving) {
      this.facing = shortAngle(this.facing, Math.atan2(this.velH.x, this.velH.y), dt * 10);
    }

    // ---- integrate ----
    this.pos.x += this.velH.x * dt;
    this.pos.z += this.velH.y * dt;

    // Shoreline guard: don't swim past chest-deep water.
    const aheadH = heightAt(this.pos.x, this.pos.z);
    if (aheadH < -0.35) {
      this.pos.x -= this.velH.x * dt;
      this.pos.z -= this.velH.y * dt;
      this.velH.multiplyScalar(0.2);
    }
    // Hard island bound. Scale only the horizontal components: using
    // Vector3.multiplyScalar here also shrank Y, dragging the player downward
    // every frame they were held against the ring.
    const dCenter = Math.hypot(this.pos.x, this.pos.z);
    if (dCenter > 205) {
      const k2 = 205 / dCenter;
      this.pos.x *= k2;
      this.pos.z *= k2;
    }

    // ---- vertical ----
    if (this.gliding) {
      this.vy = Math.max(this.vy + GRAVITY * 0.12 * dt, -2.3);
      this.stamina -= dt * 5.5;
      this.staminaDelay = 1.2;
      if (this.stamina <= 0) { this.stamina = 0; this.gliding = false; }
    } else if (!this.grounded) {
      this.vy += GRAVITY * dt;
    }

    this.pos.y += this.vy * dt;
    const gy = heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      this.vy = 0;
      this.grounded = true;
      this.gliding = false;
    } else if (this.pos.y > gy + 0.05) {
      this.grounded = false;
    }

    // ---- stamina regen ----
    if (!sprinting && !this.gliding) {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + dt * 22);
    }

    // ---- push state to character ----
    this.character.setPosition(this.pos.x, this.pos.y, this.pos.z);
    this.character.setYaw(this.facing);
    this.character.setGliding(this.gliding);
    this.character.update(dt, {
      speed01: this.speed01,
      grounded: this.grounded,
      vy: this.vy,
      gliding: this.gliding,
      sprinting,
    });

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const target = new THREE.Vector3(this.pos.x, this.pos.y + 1.65, this.pos.z);
    const cp = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    ).multiplyScalar(this.camDist).add(target);

    // Terrain collision: keep the camera above ground.
    const gh = heightAt(cp.x, cp.z) + 0.45;
    if (cp.y < gh) cp.y = gh;

    const lerpK = Math.min(1, dt * 14);
    this.camera.position.lerp(cp, lerpK);
    this.camera.lookAt(target.x, target.y + 0.15, target.z);
  }
}

function shortAngle(from, to, t) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, t);
}

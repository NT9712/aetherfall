// Quality manager: three user-facing levels plus an adaptive controller that
// walks them up and down to hold a target framerate.
//
//   0 distance   — how far sectors/fog/grass reach
//   1 density    — vegetation instance budget
//   2 effects    — post-processing, shadow resolution, pixel ratio
//
// Adaptive mode samples a rolling FPS average and nudges one level at a time,
// with hysteresis and a cooldown so it never oscillates visibly.

export const LEVEL_LABELS = ['Render Distance', 'Vegetation Density', 'Effects Quality'];

// Per-level presets, index 0..4 (Potato → Ultra).
const PRESETS = {
  distance: [
    { cull: 90,  fogNear: 32, fogFar: 190, grassTile: 46 },
    { cull: 130, fogNear: 40, fogFar: 260, grassTile: 60 },
    { cull: 175, fogNear: 48, fogFar: 340, grassTile: 76 },
    { cull: 230, fogNear: 55, fogFar: 430, grassTile: 96 },
    { cull: 300, fogNear: 62, fogFar: 520, grassTile: 112 },
  ],
  density: [
    { grass: 0.18, flowers: 0.15, shrubs: 0.35 },
    { grass: 0.36, flowers: 0.35, shrubs: 0.60 },
    { grass: 0.58, flowers: 0.60, shrubs: 0.80 },
    { grass: 0.80, flowers: 0.85, shrubs: 1.00 },
    { grass: 1.00, flowers: 1.00, shrubs: 1.00 },
  ],
  effects: [
    { bloom: false, pixelRatio: 0.7,  shadowMap: 512,  shadows: false, motes: 0.0 },
    { bloom: false, pixelRatio: 0.85, shadowMap: 1024, shadows: true,  motes: 0.4 },
    { bloom: true,  pixelRatio: 1.0,  shadowMap: 1024, shadows: true,  motes: 0.7 },
    { bloom: true,  pixelRatio: 1.0,  shadowMap: 2048, shadows: true,  motes: 1.0 },
    { bloom: true,  pixelRatio: 2.0,  shadowMap: 4096, shadows: true,  motes: 1.0 },
  ],
};

const KEYS = ['distance', 'density', 'effects'];

export class Quality {
  constructor({ onChange, targetFps = 60 } = {}) {
    this.levels = [3, 3, 3];          // start at High
    this.auto = true;
    this.targetFps = targetFps;
    this.onChange = onChange || (() => {});

    // FPS metering.
    this._frames = 0;
    this._acc = 0;
    this._fps = 60;
    this._smooth = 60;
    this._cooldown = 2.0;             // seconds before adaptive may act again
    this._settleAfterChange = 1.2;
  }

  get fps() { return this._smooth; }

  preset(i) { return PRESETS[KEYS[i]][this.levels[i]]; }
  settings() {
    return {
      distance: this.preset(0),
      density: this.preset(1),
      effects: this.preset(2),
    };
  }

  setLevel(i, v) {
    const nv = Math.max(0, Math.min(4, Math.round(v)));
    if (nv === this.levels[i]) return false;
    this.levels[i] = nv;
    this.onChange(this.settings(), i);
    return true;
  }

  setAuto(on) { this.auto = on; this._cooldown = 1.5; }

  // Called once per frame with the frame delta.
  update(dt) {
    this._frames++;
    this._acc += dt;
    if (this._acc >= 0.5) {
      this._fps = this._frames / this._acc;
      // Asymmetric smoothing: react fast to drops, slowly to gains, so a
      // brief stall doesn't yank quality but sustained load does.
      const k = this._fps < this._smooth ? 0.5 : 0.18;
      this._smooth += (this._fps - this._smooth) * k;
      this._frames = 0;
      this._acc = 0;
    }

    if (!this.auto) return;
    this._cooldown -= dt;
    if (this._cooldown > 0) return;

    const fps = this._smooth;
    const t = this.targetFps;

    // Down-shift: clearly missing target. Shed the most expensive thing first
    // (effects), then draw distance, then density.
    if (fps < t * 0.75) {
      if (this._down(2) || this._down(0) || this._down(1)) {
        this._cooldown = this._settleAfterChange;
      }
      return;
    }
    // Up-shift: comfortably above target with headroom to spare.
    if (fps > t * 1.12) {
      if (this._up(1) || this._up(0) || this._up(2)) {
        this._cooldown = 2.5;         // longer, to avoid ping-ponging
      }
    }
  }

  _down(i) { return this.levels[i] > 0 && this.setLevel(i, this.levels[i] - 1); }
  _up(i) { return this.levels[i] < 4 && this.setLevel(i, this.levels[i] + 1); }
}

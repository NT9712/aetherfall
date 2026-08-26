// Generative ambience: airy synth pad + pentatonic chimes with echo,
// in the spirit of a serene open-world score. No audio assets needed.

const PENTA = [220.0, 261.63, 293.66, 329.63, 392.0]; // A minor pentatonic
const CHORDS = [
  [110.0, 164.81, 220.0],   // Am
  [87.31, 130.81, 174.61],  // F
  [98.0, 146.83, 196.0],    // G
  [110.0, 164.81, 261.63],  // Am(add9)-ish
];

export class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.chordIndex = 0;
    this.timers = [];
  }

  start() {
    if (this.ctx) { this.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(ctx.destination);

    // Shared feedback delay for spaciousness.
    this.delay = ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.45;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.38;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.delay.connect(this.feedback); this.feedback.connect(this.delay);
    this.delay.connect(this.wet); this.wet.connect(this.master);

    // Warm pad voice.
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0001;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.4;
    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.master);

    this.padOscs = [];
    this._setChord(0);
    this.padGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 6);

    // Slow filter breathing.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 350;
    lfo.connect(lfoAmt); lfoAmt.connect(this.padFilter.frequency);
    lfo.start();

    this._scheduleChords();
    this._scheduleChime();
  }

  _setChord(i) {
    const ctx = this.ctx;
    const freqs = CHORDS[i % CHORDS.length];
    for (const o of this.padOscs) { try { o.stop(); } catch {} }
    this.padOscs = [];
    freqs.forEach((f, k) => {
      for (const det of [-3, 2.5]) {
        const osc = ctx.createOscillator();
        osc.type = k === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f * 2 * (det ? 1 : 1);
        osc.detune.value = det;
        const g = ctx.createGain(); g.gain.value = 0.33;
        osc.connect(g); g.connect(this.padGain);
        osc.start();
        this.padOscs.push(osc);
      }
    });
  }

  _scheduleChords() {
    const tick = () => {
      this.chordIndex++;
      this._setChord(this.chordIndex);
      this.timers.push(setTimeout(tick, 12000));
    };
    this.timers.push(setTimeout(tick, 12000));
  }

  _scheduleChime() {
    const play = () => {
      if (this.enabled && this.ctx.state === 'running') {
        const ctx = this.ctx;
        const f = PENTA[Math.floor(Math.random() * PENTA.length)] *
                  [1, 1, 2, 2, 4][Math.floor(Math.random() * 5)];
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        osc.connect(g); g.connect(this.master); g.connect(this.delay);
        osc.start(t); osc.stop(t + 3);
      }
      this.timers.push(setTimeout(play, 2500 + Math.random() * 5500));
    };
    this.timers.push(setTimeout(play, 1800));
  }

  resume() { this.ctx?.resume?.(); }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.22 : 0.0, this.ctx.currentTime, 0.3);
    }
    return this.enabled;
  }

  // Bright arpeggio when collecting a shard.
  pickupSting() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    [0, 2, 4].forEach((step, i) => {
      const f = PENTA[step % 5] * 2 * (i >= 2 ? 2 : 1);
      const t = t0 + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(g); g.connect(this.master); g.connect(this.delay);
      osc.start(t); osc.stop(t + 1.5);
    });
  }
}

// Keyboard + pointer-lock mouse input.

export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.pressed = new Set();      // edge-triggered, cleared each frame
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.locked = false;
    this.onInteract = null;        // callback for E key
    this.onGliderToggle = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      this.pressed.add(k);
      if (k === 'KeyE' && this.onInteract) this.onInteract();
      if (k === 'KeyF' && this.onGliderToggle) this.onGliderToggle();
      if (k === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    document.addEventListener('wheel', (e) => {
      if (this.locked) this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });
  }

  lock() {
    if (!this.locked) this.dom.requestPointerLock?.();
  }
  unlock() {
    if (this.locked) document.exitPointerLock?.();
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // Consume accumulated mouse motion (called once per frame by camera).
  consumeMouse() {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }
  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  endFrame() { this.pressed.clear(); }
}

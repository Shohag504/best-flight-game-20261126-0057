// Coral Bay Air Rally — input.
// One clear job: turn keyboard and mouse into a small, stable control
// state the physics step reads. Nothing here draws or simulates.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointer = { down: false, x: 0, y: 0, active: false };
    this.pressed = new Set(); // edge-triggered keys, consumed by the game
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key);
      this.keys.add(e.key);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointer.down = false;
    });

    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.down = true;
      this.pointer.active = true;
      this.pointer.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.pointer.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.pointer.down) return;
      const r = canvas.getBoundingClientRect();
      this.pointer.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.pointer.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    window.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
  }

  down(key) {
    return this.keys.has(key);
  }

  // True once per physical press; the game clears it after reading.
  wasPressed(key) {
    return this.pressed.has(key);
  }

  clearPressed() {
    this.pressed.clear();
  }

  // -1..1 pitch/bank intent from keys, overridden by a held pointer drag.
  // Pointer steering: drag above centre to climb, below to dive, left/right
  // of centre to bank.
  steer() {
    let pitch = 0;
    let bank = 0;
    if (this.down('ArrowUp')) pitch += 1;
    if (this.down('ArrowDown')) pitch -= 1;
    if (this.down('ArrowLeft')) bank -= 1;
    if (this.down('ArrowRight')) bank += 1;
    if (this.pointer.down && this.pointer.active) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height * 0.55;
      bank = Math.max(-1, Math.min(1, (this.pointer.x - cx) / 260));
      pitch = Math.max(-1, Math.min(1, (cy - this.pointer.y) / 220));
    }
    let throttle = 0;
    if (this.down('w') || this.down('W') || this.down('Shift')) throttle += 1;
    if (this.down('s') || this.down('S') || this.down('Control')) throttle -= 1;
    return { pitch, bank, throttle };
  }
}

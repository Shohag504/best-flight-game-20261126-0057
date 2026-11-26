// Coral Bay Air Rally — game loop and flight model.
// One clear job: own the state machine, step the physics at a fixed rate,
// and hand a snapshot to the renderer. No drawing happens here.

import { CFG } from './config.js';
import { buildCourse } from './world.js';
import { Input } from './input.js';
import { render } from './render.js';

// Tiny synth: engine hum, ring chime, landing fanfare, crash thud.
// Everything is generated with WebAudio — no sound files, no network.
class Sfx {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.engine = this.ctx.createOscillator();
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engine.start();
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle, flying) {
    if (!this.ctx || this.muted) return;
    const target = flying ? 0.02 + throttle * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engine.frequency.setTargetAtTime(48 + throttle * 55, this.ctx.currentTime, 0.1);
  }

  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  ring() {
    this.blip(880, 0.18);
    setTimeout(() => this.blip(1318, 0.3), 90);
  }

  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'triangle', 0.14), i * 130));
  }

  crash() {
    this.blip(90, 0.5, 'sawtooth', 0.2);
    this.blip(55, 0.7, 'square', 0.12);
  }
}

function freshPlane() {
  return {
    x: 0,
    y: 2.2, // parked on the departure runway
    z: 0,
    heading: 90, // degrees: 90 = due east, down the course
    pitchDeg: 0,
    bank: 0,
    speed: 0,
    vy: 0,
    throttle: 0,
    fuel: CFG.fuelMax,
  };
}

export class Game {
  constructor(canvas, seed = 1) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seed;
    this.course = buildCourse(seed);
    this.input = new Input(canvas);
    this.sfx = new Sfx();
    this.state = 'title';
    this.plane = freshPlane();
    this.score = 0;
    this.time = 0; // flight time in seconds
    this.t = 0; // wall-clock animation time
    this.message = null;
    this.crashReason = '';
    this.ringsLeft = CFG.ringCount;
    this.landedAt = 0;
    this.shot = new URLSearchParams(window.location.search).get('shot') || null;
    this.applyShot();
    this.last = performance.now();
    this.acc = 0;
  }

  // Deterministic staged scenes for screenshots: the same query always
  // shows the same moment of the same flight.
  applyShot() {
    if (this.shot === 'start') {
      this.state = 'title';
      this.plane = freshPlane();
    } else if (this.shot === 'play') {
      this.state = 'fly';
      this.plane = freshPlane();
      this.plane.x = 1560;
      this.plane.y = 34;
      this.plane.z = -14;
      this.plane.heading = 92;
      this.plane.speed = 34;
      this.plane.throttle = 0.72;
      this.plane.fuel = 82;
      this.course.rings[0].passed = true;
      this.course.rings[1].passed = true;
      this.ringsLeft = CFG.ringCount - 2;
      this.score = 200;
      this.time = 41;
      this.t = 2.4;
    } else if (this.shot === 'end') {
      this.state = 'landed';
      this.plane = freshPlane();
      this.plane.x = CFG.runwayStartX + 320;
      this.plane.y = 0.4;
      this.plane.z = 1;
      this.plane.speed = 0;
      this.plane.throttle = 0;
      this.plane.fuel = 31;
      this.course.rings.forEach((r) => { r.passed = true; });
      this.ringsLeft = 0;
      this.score = 800 + 500;
      this.time = 148;
      this.t = 3.1;
    }
  }

  start() {
    this.sfx.ensure();
    if (this.ctx) this.ctx.resume?.();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.acc += dt;
      const step = 1 / 60;
      while (this.acc >= step) {
        this.step(step);
        this.acc -= step;
      }
      render(this.ctx, this.snapshot());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  snapshot() {
    return {
      t: this.t,
      state: this.state,
      plane: this.plane,
      course: this.course,
      score: this.score,
      timeLeft: this.time,
      ringsLeft: this.ringsLeft,
      message: this.message,
      crashReason: this.crashReason,
    };
  }

  showMessage(text, color = '#ffcf5c') {
    this.message = { text, color, alpha: 1 };
  }

  step(dt) {
    // Message fade.
    if (this.message) {
      this.message.alpha -= dt * 0.45;
      if (this.message.alpha <= 0) this.message = null;
    }

    if (this.state === 'title') {
      if (this.input.wasPressed('Enter') || this.input.wasPressed(' ') || this.input.pointer.down) {
        this.beginFlight();
      }
      this.input.clearPressed();
      return;
    }

    if (this.state === 'landed' || this.state === 'crashed') {
      if (this.input.wasPressed('r') || this.input.wasPressed('R') || this.input.wasPressed('Enter')) {
        this.reset();
      }
      this.input.clearPressed();
      return;
    }

    // --- flying ---
    const steer = this.input.steer();
    const p = this.plane;

    // Mute toggle.
    if (this.input.wasPressed('m') || this.input.wasPressed('M')) {
      this.sfx.muted = !this.sfx.muted;
    }
    this.input.clearPressed();

    // Throttle eases toward its target; speed chases the throttle.
    p.throttle = Math.max(0, Math.min(1, p.throttle + steer.throttle * dt * 0.8));
    const targetSpeed = CFG.minSpeed + p.throttle * (CFG.maxSpeed - CFG.minSpeed);
    p.speed += Math.max(-CFG.accel * 1.4, Math.min(CFG.accel, targetSpeed - p.speed)) * dt;

    // Bank steers the heading; pitch steers the climb.
    const bankTarget = steer.bank * CFG.bankMax;
    p.bank += (bankTarget - p.bank) * Math.min(1, dt * 5);
    p.heading += (p.bank / CFG.bankMax) * CFG.turnRate * dt;
    const pitchTarget = steer.pitch * 22;
    p.pitchDeg += (pitchTarget - p.pitchDeg) * Math.min(1, dt * 4);

    // Vertical speed: pitch lift minus sink when slow or unpowered.
    const lift = (p.pitchDeg * Math.PI) / 180 * p.speed * 0.9;
    const sink = p.speed < CFG.stallSpeed ? CFG.gravitySink * (1.6 - p.speed / CFG.stallSpeed) : CFG.gravitySink * 0.25;
    p.vy = lift - sink * (1 - p.throttle * 0.6);
    p.y += p.vy * dt;

    // Forward and lateral motion follow the heading.
    const hRad = ((90 - p.heading) * Math.PI) / 180;
    p.x += p.speed * Math.cos(hRad) * dt;
    p.z += p.speed * Math.sin(hRad) * dt;
    // Soft walls keep the rally over the bay.
    p.z = Math.max(-240, Math.min(240, p.z));

    // Fuel: throttle burns it, rings top it up.
    p.fuel = Math.max(0, p.fuel - CFG.fuelDrain * (0.35 + p.throttle) * dt);
    this.time += dt;
    this.sfx.setEngine(p.throttle, true);

    // Rings: fly through the gold hoop.
    const next = this.course.rings.find((r) => !r.passed);
    if (next) {
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const dz = next.z - p.z;
      if (Math.abs(dx) < 12 && Math.hypot(dy, dz) < next.r) {
        next.passed = true;
        this.ringsLeft -= 1;
        this.score += CFG.ringScore;
        p.fuel = Math.min(CFG.fuelMax, p.fuel + CFG.fuelRingBonus);
        this.showMessage(`RING ${next.index + 1} — +${CFG.ringScore}  ·  FUEL +${CFG.fuelRingBonus}%`, '#7be0a3');
        this.sfx.ring();
        if (this.ringsLeft === 0) {
          this.showMessage('ALL RINGS DONE — LAND ON RUNWAY 27', '#ffcf5c');
        }
      }
    }

    // Landing: on the arrival runway, slow and gentle.
    const onRunway = p.x > CFG.runwayStartX && p.x < CFG.runwayEndX && Math.abs(p.z) < CFG.runwayHalfWidth;
    if (p.y <= 0.4) {
      if (onRunway && p.speed < 42 && p.vy > -7) {
        p.y = 0.4;
        p.speed = 0;
        p.throttle = 0;
        this.state = 'landed';
        this.score += CFG.landingScore + Math.round(p.fuel);
        this.showMessage(`LANDED! +${CFG.landingScore}`, '#7be0a3');
        this.sfx.fanfare();
        this.sfx.setEngine(0, false);
      } else {
        this.crash(onRunway ? 'Too fast and too hard for runway 27.' : p.y <= 0.4 && Math.abs(p.z) > CFG.seaZ ? 'Ditched in the bay.' : 'You hit the ground.');
      }
      return;
    }

    // Out of fuel: the engine quits and the glide ends in the drink or dirt.
    if (p.fuel <= 0 && p.throttle > 0) {
      p.throttle = 0;
      this.showMessage('FUEL EMPTY — GLIDING!', '#ff6b5e');
    }
  }

  crash(reason) {
    this.state = 'crashed';
    this.crashReason = reason;
    this.sfx.crash();
    this.sfx.setEngine(0, false);
  }

  beginFlight() {
    this.state = 'fly';
    this.plane.throttle = 0.55;
    this.showMessage('THROTTLE UP — FLY THROUGH THE GOLD RINGS', '#eaf6ff');
  }

  reset() {
    this.course = buildCourse(this.seed);
    this.plane = freshPlane();
    this.score = 0;
    this.time = 0;
    this.message = null;
    this.crashReason = '';
    this.ringsLeft = CFG.ringCount;
    this.state = 'title';
  }
}

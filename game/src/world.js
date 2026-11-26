// Coral Bay Air Rally — the world: course, scenery and projection.
// One clear job: build the course from a seed and answer "where does this
// 3D point land on the 2D screen?" for the renderer.

import { CFG } from './config.js';
import { makeRng, range } from './random.js';

// Build the whole course. Deterministic: same seed, same course.
export function buildCourse(seed) {
  const rng = makeRng(seed);
  const rings = [];
  for (let i = 0; i < CFG.ringCount; i += 1) {
    rings.push({
      index: i,
      x: CFG.ringStartX + i * CFG.ringGapX,
      // A gentle slalom: altitude and lateral offset weave so the pilot
      // must actually steer instead of flying straight.
      y: 30 + 16 * Math.sin(i * 1.25 + 0.6),
      z: 42 * Math.sin(i * 0.9 + 0.2),
      r: CFG.ringRadius,
      passed: false,
    });
  }

  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: range(rng, -200, 6400),
      y: range(rng, 55, 130),
      z: range(rng, -260, 260),
      s: range(rng, 18, 46),
    });
  }

  const peaks = [];
  for (let i = 0; i < 14; i += 1) {
    peaks.push({
      // Screen-space anchor along the horizon, with slow parallax.
      u: rng(),
      h: range(rng, 40, 130),
      w: range(rng, 90, 240),
      far: rng() < 0.5,
    });
  }

  const islands = [];
  for (let i = 0; i < 10; i += 1) {
    islands.push({
      x: range(rng, 300, 5400),
      z: (rng() < 0.5 ? -1 : 1) * range(rng, 90, 220),
      r: range(rng, 26, 70),
    });
  }

  return { seed, rings, clouds, peaks, islands };
}

// The shoreline wobbles with distance so the coast never looks ruled.
export function coastZ(x) {
  return CFG.sandZ + CFG.coastWobble * Math.sin(x * 0.008) + 4 * Math.sin(x * 0.021 + 1.7);
}

// Chase camera: behind and just above the plane, looking down the course.
export function cameraFor(plane) {
  return {
    x: plane.x - CFG.camBack,
    y: plane.y + CFG.camUp,
    z: plane.z,
  };
}

// Project a world point to screen space. Returns null when behind camera.
export function project(cam, px, py, pz, out) {
  const d = px - cam.x;
  if (d < 1.5) return null;
  const s = CFG.focal / d;
  out.x = CFG.width / 2 + (pz - cam.z) * s;
  out.y = CFG.horizonY - (py - cam.y) * s;
  out.s = s;
  out.d = d;
  return out;
}

// Ground height at (x, z): the bay is flat; the sea is the ground too.
export function groundY() {
  return 0;
}

// Coral Bay Air Rally — rendering.
// One clear job: draw everything the pilot sees. No physics, no input,
// no state changes: given a snapshot of the world it paints one frame.

import { CFG, COLORS } from './config.js';
import { project, cameraFor, coastZ } from './world.js';

const TAU = Math.PI * 2;

function quad(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,220,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = '600') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function drawSky(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, CFG.horizonY + 40);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.55, COLORS.skyMid);
  g.addColorStop(1, COLORS.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CFG.width, CFG.horizonY + 40);
  // Sun with a soft halo.
  const sx = CFG.width - 190;
  const sy = 108;
  const halo = ctx.createRadialGradient(sx, sy, 8, sx, sy, 130);
  halo.addColorStop(0, 'rgba(255,240,180,0.9)');
  halo.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 140, sy - 140, 280, 280);
  ctx.fillStyle = COLORS.sunCore;
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 44, 0, TAU);
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPeaks(ctx, cam, peaks) {
  for (const peak of peaks) {
    const span = CFG.width + 480;
    let sx = ((peak.u * span - cam.x * (peak.far ? 0.05 : 0.12)) % span + span) % span - 240;
    ctx.fillStyle = peak.far ? COLORS.mountainFar : COLORS.mountain;
    ctx.beginPath();
    ctx.moveTo(sx - peak.w / 2, CFG.horizonY + 2);
    ctx.lineTo(sx, CFG.horizonY - peak.h);
    ctx.lineTo(sx + peak.w / 2, CFG.horizonY + 2);
    ctx.closePath();
    ctx.fill();
    // Snow cap on the taller peaks.
    if (peak.h > 80) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(sx - peak.w * 0.14, CFG.horizonY - peak.h * 0.72);
      ctx.lineTo(sx, CFG.horizonY - peak.h);
      ctx.lineTo(sx + peak.w * 0.14, CFG.horizonY - peak.h * 0.72);
      ctx.lineTo(sx + peak.w * 0.05, CFG.horizonY - peak.h * 0.62);
      ctx.lineTo(sx - peak.w * 0.05, CFG.horizonY - peak.h * 0.62);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawClouds(ctx, cam, clouds) {
  const sorted = [...clouds].sort((a, b) => b.x - a.x);
  const p = { x: 0, y: 0, s: 0, d: 0 };
  ctx.fillStyle = COLORS.cloud;
  for (const c of sorted) {
    if (!project(cam, c.x, c.y, c.z, p)) continue;
    if (p.x < -120 || p.x > CFG.width + 120 || p.y < -40 || p.y > CFG.horizonY) continue;
    const r = Math.max(3, c.s * p.s);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 1.6, r * 0.55, 0, 0, TAU);
    ctx.ellipse(p.x - r, p.y + r * 0.15, r * 0.9, r * 0.45, 0, 0, TAU);
    ctx.ellipse(p.x + r, p.y + r * 0.12, r, r * 0.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGround(ctx, cam) {
  // Depth bands, far to near, each split into sea / sand / grass by the
  // wobbling coastline at that depth.
  const bands = [];
  let d = 18;
  while (d < CFG.groundFar) {
    bands.push(d);
    d *= 1.22;
  }
  bands.push(CFG.groundFar);
  const p00 = { x: 0, y: 0, s: 0, d: 0 };
  const p01 = { x: 0, y: 0, s: 0, d: 0 };
  const p10 = { x: 0, y: 0, s: 0, d: 0 };
  const p11 = { x: 0, y: 0, s: 0, d: 0 };
  for (let bi = bands.length - 1; bi >= 1; bi -= 1) {
    const dFar = bands[bi];
    const dNear = bands[bi - 1];
    const xFar = cam.x + dFar;
    const xNear = cam.x + dNear;
    const cFar = coastZ(xFar);
    const cNear = coastZ(xNear);
    const shade = bi % 2 === 0;
    const segs = [
      { z0: -260, z1: -(cFar + 10), w0: -260, w1: -(cNear + 10), col: shade ? COLORS.sea : COLORS.seaDeep },
      { z0: -(cFar + 10), z1: -cFar, w0: -(cNear + 10), w1: -cNear, col: shade ? COLORS.sand : COLORS.sandDark },
      { z0: -cFar, z1: cFar, w0: -cNear, w1: cNear, col: shade ? COLORS.grass : COLORS.grassDark },
      { z0: cFar, z1: cFar + 10, w0: cNear, w1: cNear + 10, col: shade ? COLORS.sand : COLORS.sandDark },
      { z0: cFar + 10, z1: 260, w0: cNear + 10, w1: 260, col: shade ? COLORS.sea : COLORS.seaDeep },
    ];
    for (const seg of segs) {
      if (!project(cam, xFar, 0, seg.z0, p00)) continue;
      if (!project(cam, xFar, 0, seg.z1, p01)) continue;
      if (!project(cam, xNear, 0, seg.w1, p11)) continue;
      if (!project(cam, xNear, 0, seg.w0, p10)) continue;
      ctx.fillStyle = seg.col;
      quad(ctx, p00, p01, p11, p10);
    }
  }
}

function drawIslands(ctx, cam, islands) {
  const p = { x: 0, y: 0, s: 0, d: 0 };
  const sorted = [...islands].sort((a, b) => b.x - a.x);
  for (const isl of sorted) {
    if (!project(cam, isl.x, 0, isl.z, p)) continue;
    if (p.x < -160 || p.x > CFG.width + 160) continue;
    const rx = Math.max(2, isl.r * p.s);
    const ry = Math.max(1, isl.r * p.s * 0.3);
    ctx.fillStyle = COLORS.sand;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.grass;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - ry * 0.25, rx * 0.72, ry * 0.6, 0, 0, TAU);
    ctx.fill();
  }
}

function drawRunwayStrip(ctx, cam, x0, x1, halfW) {
  const a = { x: 0, y: 0, s: 0, d: 0 };
  const b = { x: 0, y: 0, s: 0, d: 0 };
  const c = { x: 0, y: 0, s: 0, d: 0 };
  const d2 = { x: 0, y: 0, s: 0, d: 0 };
  if (!project(cam, x0, 0, -halfW, a)) return;
  if (!project(cam, x0, 0, halfW, b)) return;
  if (!project(cam, x1, 0, halfW, c)) return;
  if (!project(cam, x1, 0, -halfW, d2)) return;
  ctx.fillStyle = COLORS.runway;
  quad(ctx, a, b, c, d2);
  ctx.strokeStyle = COLORS.runwayEdge;
  ctx.lineWidth = Math.max(1, 2.5 * a.s);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  // Centreline dashes.
  ctx.fillStyle = '#f8f8f8';
  for (let x = x0 + 26; x < x1 - 14; x += 52) {
    const q1 = { x: 0, y: 0, s: 0, d: 0 };
    const q2 = { x: 0, y: 0, s: 0, d: 0 };
    const q3 = { x: 0, y: 0, s: 0, d: 0 };
    const q4 = { x: 0, y: 0, s: 0, d: 0 };
    if (!project(cam, x, 0, -1.4, q1)) continue;
    if (!project(cam, x, 0, 1.4, q2)) continue;
    if (!project(cam, x + 24, 0, 1.4, q3)) continue;
    if (!project(cam, x + 24, 0, -1.4, q4)) continue;
    quad(ctx, q1, q2, q3, q4);
  }
}

function drawRings(ctx, cam, rings, nextIndex, t) {
  const p = { x: 0, y: 0, s: 0, d: 0 };
  const sorted = [...rings].sort((a, b) => b.x - a.x);
  for (const ring of sorted) {
    if (!project(cam, ring.x, ring.y, ring.z, p)) continue;
    if (p.d < 6) continue;
    const rx = Math.max(2, ring.r * p.s);
    const ry = Math.max(2, ring.r * p.s);
    const isNext = ring.index === nextIndex;
    const pulse = isNext ? 1 + 0.18 * Math.sin(t * 5) : 1;
    ctx.save();
    ctx.strokeStyle = ring.passed ? COLORS.ringDone : COLORS.ringGold;
    ctx.globalAlpha = ring.passed ? 0.55 : 1;
    ctx.lineWidth = Math.max(2.5, Math.min(16, ring.r * p.s * 0.22 * pulse));
    ctx.shadowColor = ring.passed ? COLORS.ringDone : COLORS.ringGold;
    ctx.shadowBlur = 18 * pulse;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * pulse, ry * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, rx * 0.05);
    ctx.globalAlpha = ring.passed ? 0.4 : 0.85;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.62 * pulse, ry * 0.62 * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (isNext) {
      text(ctx, `RING ${ring.index + 1} · ${Math.max(0, Math.round(p.d))}m`, p.x, p.y - ry - 14, 15, COLORS.hudAmber, 'center', '700');
    }
  }
}

function drawPlane(ctx, plane, cam, t) {
  // Ground shadow first.
  const sh = { x: 0, y: 0, s: 0, d: 0 };
  if (project(cam, plane.x, 0, plane.z, sh)) {
    const hFrac = Math.max(0.15, 1 - plane.y / 90);
    ctx.fillStyle = `rgba(10,20,30,${0.35 * hFrac})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, 52 * hFrac + 8, 10 * hFrac + 3, 0, 0, TAU);
    ctx.fill();
  }
  const px = CFG.width / 2;
  const py = CFG.height * 0.66;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((plane.bank * Math.PI) / 180);
  // Wings (rear view, slight dihedral).
  ctx.fillStyle = COLORS.planeRed;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  ctx.lineTo(-84, -12);
  ctx.lineTo(-88, -2);
  ctx.lineTo(-16, 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 2);
  ctx.lineTo(84, -12);
  ctx.lineTo(88, -2);
  ctx.lineTo(16, 10);
  ctx.closePath();
  ctx.fill();
  // White wingtip stripes.
  ctx.fillStyle = COLORS.planeWhite;
  ctx.beginPath();
  ctx.moveTo(-84, -12);
  ctx.lineTo(-88, -2);
  ctx.lineTo(-78, -3);
  ctx.lineTo(-76, -10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(84, -12);
  ctx.lineTo(88, -2);
  ctx.lineTo(78, -3);
  ctx.lineTo(76, -10);
  ctx.closePath();
  ctx.fill();
  // Tailplane + fin.
  ctx.fillStyle = COLORS.planeRed;
  ctx.beginPath();
  ctx.moveTo(-8, -26);
  ctx.lineTo(-34, -34);
  ctx.lineTo(-34, -26);
  ctx.lineTo(-8, -18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -26);
  ctx.lineTo(34, -34);
  ctx.lineTo(34, -26);
  ctx.lineTo(8, -18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -22);
  ctx.lineTo(0, -52);
  ctx.lineTo(7, -22);
  ctx.closePath();
  ctx.fill();
  // Fuselage (seen from behind).
  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, '#c7d3dd');
  body.addColorStop(0.5, COLORS.planeWhite);
  body.addColorStop(1, '#9fb0bf');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -2, 17, 30, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = COLORS.planeDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Canopy glint.
  ctx.fillStyle = '#16324a';
  ctx.beginPath();
  ctx.ellipse(0, -22, 9, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-3, -26, 3, 6, -0.4, 0, TAU);
  ctx.fill();
  // Exhaust glow at high throttle.
  if (plane.throttle > 0.55) {
    ctx.fillStyle = `rgba(255,${Math.round(140 + 60 * plane.throttle)},40,${0.5 + 0.3 * plane.throttle})`;
    ctx.beginPath();
    ctx.ellipse(-8, 26, 5, 7 + 6 * plane.throttle, 0, 0, TAU);
    ctx.ellipse(8, 26, 5, 7 + 6 * plane.throttle, 0, 0, TAU);
    ctx.fill();
  }
  // Navigation lights: red port, green starboard, strobe on the tail.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-86, -7, 3.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2fd673';
  ctx.beginPath();
  ctx.arc(86, -7, 3.5, 0, TAU);
  ctx.fill();
  if (Math.sin(t * 6) > 0.2) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -52, 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawAttitude(ctx, cx, cy, r, bank, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate((-bank * Math.PI) / 180);
  const dy = Math.max(-r, Math.min(r, (pitch * Math.PI) / 180 * r * 1.4));
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r, -r + dy - r, r * 2, r * 2);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-r, dy, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, dy);
  ctx.lineTo(r, dy);
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = COLORS.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + 7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(180,220,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
}

function drawHud(ctx, g) {
  const { plane, score, timeLeft, ringsLeft, message } = g;
  // Top-left: flight instruments.
  panel(ctx, 18, 16, 250, 108);
  text(ctx, 'ALT', 34, 44, 13, '#9fc4e0', 'left', '700');
  text(ctx, `${Math.round(plane.y * 32).toLocaleString('en-US')} FT`, 252, 44, 20, COLORS.hudText, 'right', '700');
  text(ctx, 'SPD', 34, 74, 13, '#9fc4e0', 'left', '700');
  text(ctx, `${Math.round(plane.speed * 1.9)} KT`, 252, 74, 20, COLORS.hudText, 'right', '700');
  text(ctx, 'V/S', 34, 104, 13, '#9fc4e0', 'left', '700');
  const vs = Math.round(plane.vy * 32 * 60);
  text(ctx, `${vs >= 0 ? '+' : ''}${vs.toLocaleString('en-US')} FPM`, 252, 104, 20, vs < -600 ? COLORS.hudRed : COLORS.hudText, 'right', '700');

  // Top-centre: heading compass strip.
  const hdg = Math.round(((plane.heading % 360) + 360) % 360);
  panel(ctx, CFG.width / 2 - 170, 16, 340, 52);
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, CFG.width / 2 - 170, 16, 340, 52, 10);
  ctx.clip();
  for (let off = -60; off <= 60; off += 5) {
    const h = ((hdg + off) % 360 + 360) % 360;
    const x = CFG.width / 2 + off * 2.6;
    const major = h % 30 === 0;
    ctx.strokeStyle = major ? COLORS.hudText : 'rgba(160,200,230,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x, major ? 56 : 50);
    ctx.stroke();
    if (major) {
      const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : String(h).padStart(3, '0');
      text(ctx, label, x, 36, 12, COLORS.hudText, 'center', '700');
    }
  }
  ctx.restore();
  ctx.fillStyle = COLORS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(CFG.width / 2 - 7, 16);
  ctx.lineTo(CFG.width / 2 + 7, 16);
  ctx.lineTo(CFG.width / 2, 28);
  ctx.closePath();
  ctx.fill();
  text(ctx, `HDG ${String(hdg).padStart(3, '0')}°`, CFG.width / 2, 62, 13, COLORS.hudAmber, 'center', '700');

  // Top-right: mission status.
  panel(ctx, CFG.width - 268, 16, 250, 108);
  text(ctx, 'RINGS', CFG.width - 252, 44, 13, '#9fc4e0', 'left', '700');
  text(ctx, `${CFG.ringCount - ringsLeft} / ${CFG.ringCount}`, CFG.width - 34, 44, 20, COLORS.hudText, 'right', '700');
  text(ctx, 'SCORE', CFG.width - 252, 74, 13, '#9fc4e0', 'left', '700');
  text(ctx, `${score.toLocaleString('en-US')}`, CFG.width - 34, 74, 20, COLORS.hudText, 'right', '700');
  text(ctx, 'FUEL', CFG.width - 252, 104, 13, '#9fc4e0', 'left', '700');
  const fw = 108;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, CFG.width - 142, 90, fw, 14, 7);
  ctx.fill();
  ctx.fillStyle = plane.fuel < 25 ? COLORS.hudRed : plane.fuel < 50 ? COLORS.hudAmber : COLORS.hudGreen;
  roundRect(ctx, CFG.width - 142, 90, Math.max(8, (fw * plane.fuel) / 100), 14, 7);
  ctx.fill();
  text(ctx, `${Math.round(plane.fuel)}%`, CFG.width - 34, 104, 14, COLORS.hudText, 'right', '700');

  // Bottom-centre: attitude indicator + throttle.
  drawAttitude(ctx, CFG.width / 2, CFG.height - 78, 46, plane.bank, plane.pitchDeg);
  text(ctx, 'ATTITUDE', CFG.width / 2, CFG.height - 16, 11, '#9fc4e0', 'center', '700');
  panel(ctx, 18, CFG.height - 96, 210, 78);
  text(ctx, 'THROTTLE', 34, CFG.height - 68, 12, '#9fc4e0', 'left', '700');
  text(ctx, `${Math.round(plane.throttle * 100)}%`, 212, CFG.height - 68, 16, COLORS.hudText, 'right', '700');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, 34, CFG.height - 56, 178, 12, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.hudAmber;
  roundRect(ctx, 34, CFG.height - 56, Math.max(6, 178 * plane.throttle), 12, 6);
  ctx.fill();
  text(ctx, '↑↓ pitch · ←→ bank · W/S throttle · M mute', 34, CFG.height - 26, 12, '#cfe4f5', 'left', '400');

  // Bottom-right: next objective.
  const obj = ringsLeft > 0
    ? `NEXT: RING ${CFG.ringCount - ringsLeft + 1} OF ${CFG.ringCount}`
    : 'ALL RINGS DONE — LAND ON RUNWAY 27';
  panel(ctx, CFG.width - 318, CFG.height - 96, 300, 78);
  text(ctx, obj, CFG.width - 168, CFG.height - 66, 14, COLORS.hudAmber, 'center', '700');
  text(ctx, ringsLeft > 0 ? 'Fly through the gold ring' : 'Gentle descent, slow speed', CFG.width - 168, CFG.height - 40, 13, COLORS.hudText, 'center', '400');

  if (timeLeft != null) {
    text(ctx, `T+ ${Math.floor(timeLeft)}s`, CFG.width - 168, CFG.height - 26, 12, '#9fc4e0', 'center', '400');
  }

  // Floating event message.
  if (message && message.alpha > 0.02) {
    ctx.globalAlpha = Math.min(1, message.alpha);
    text(ctx, message.text, CFG.width / 2, 150, 34, message.color, 'center', '800');
    ctx.globalAlpha = 1;
  }
}

function drawTitle(ctx, g) {
  ctx.fillStyle = 'rgba(6,14,24,0.45)';
  ctx.fillRect(0, 0, CFG.width, CFG.height);
  text(ctx, 'CORAL BAY', CFG.width / 2, 190, 74, '#ffffff', 'center', '800');
  text(ctx, 'AIR RALLY', CFG.width / 2, 262, 74, COLORS.hudAmber, 'center', '800');
  text(ctx, 'Eight gold rings over the bay — then bring her home on runway 27.', CFG.width / 2, 306, 21, '#dceefb', 'center', '400');
  panel(ctx, CFG.width / 2 - 300, 350, 600, 132);
  text(ctx, 'HOW TO FLY', CFG.width / 2, 382, 15, COLORS.hudAmber, 'center', '700');
  text(ctx, '↑ / ↓  pitch up and down      ← / →  bank and turn', CFG.width / 2, 412, 17, COLORS.hudText, 'center', '400');
  text(ctx, 'W / S  throttle up and down      drag with the mouse to steer', CFG.width / 2, 440, 17, COLORS.hudText, 'center', '400');
  text(ctx, 'Rings refill fuel. Land gently on the runway to finish.', CFG.width / 2, 468, 17, COLORS.hudText, 'center', '400');
  const blink = 0.55 + 0.45 * Math.sin(g.t * 4);
  ctx.globalAlpha = blink;
  text(ctx, 'PRESS ENTER OR CLICK TO FLY', CFG.width / 2, 560, 26, '#ffffff', 'center', '800');
  ctx.globalAlpha = 1;
}

function drawEndCard(ctx, g, won) {
  ctx.fillStyle = won ? 'rgba(8,40,22,0.55)' : 'rgba(50,10,8,0.55)';
  ctx.fillRect(0, 0, CFG.width, CFG.height);
  text(ctx, won ? 'LANDED — WELL FLOWN!' : 'CRASHED', CFG.width / 2, 250, 64, won ? COLORS.hudGreen : COLORS.hudRed, 'center', '800');
  text(ctx, won ? 'Coral Bay Tower welcomes you. The rally is complete.' : g.crashReason || 'The rally ends here.', CFG.width / 2, 300, 22, '#dceefb', 'center', '400');
  panel(ctx, CFG.width / 2 - 260, 350, 520, 150);
  text(ctx, 'RINGS', CFG.width / 2 - 220, 392, 15, '#9fc4e0', 'left', '700');
  text(ctx, `${CFG.ringCount - g.ringsLeft} / ${CFG.ringCount}`, CFG.width / 2 + 220, 392, 20, COLORS.hudText, 'right', '700');
  text(ctx, 'SCORE', CFG.width / 2 - 220, 428, 15, '#9fc4e0', 'left', '700');
  text(ctx, `${g.score.toLocaleString('en-US')}`, CFG.width / 2 + 220, 428, 20, COLORS.hudText, 'right', '700');
  text(ctx, 'TIME', CFG.width / 2 - 220, 464, 15, '#9fc4e0', 'left', '700');
  text(ctx, `${Math.floor(g.timeLeft)}s`, CFG.width / 2 + 220, 464, 20, COLORS.hudText, 'right', '700');
  const blink = 0.55 + 0.45 * Math.sin(g.t * 4);
  ctx.globalAlpha = blink;
  text(ctx, 'PRESS R TO FLY AGAIN', CFG.width / 2, 560, 24, '#ffffff', 'center', '800');
  ctx.globalAlpha = 1;
}

// Paint one frame. `g` is the game snapshot (see main.js).
export function render(ctx, g) {
  const cam = cameraFor(g.plane);
  drawSky(ctx, g.t);
  drawPeaks(ctx, cam, g.course.peaks);
  drawClouds(ctx, cam, g.course.clouds);
  drawGround(ctx, cam);
  drawIslands(ctx, cam, g.course.islands);
  drawRunwayStrip(ctx, cam, CFG.startRunwayStartX, CFG.startRunwayEndX, CFG.runwayHalfWidth);
  drawRunwayStrip(ctx, cam, CFG.runwayStartX, CFG.runwayEndX, CFG.runwayHalfWidth);
  const nextIndex = g.course.rings.findIndex((r) => !r.passed);
  drawRings(ctx, cam, g.course.rings, nextIndex, g.t);
  drawPlane(ctx, g.plane, cam, g.t);
  drawHud(ctx, g);
  if (g.state === 'title') drawTitle(ctx, g);
  if (g.state === 'landed') drawEndCard(ctx, g, true);
  if (g.state === 'crashed') drawEndCard(ctx, g, false);
}

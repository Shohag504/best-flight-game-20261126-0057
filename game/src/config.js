// Coral Bay Air Rally — tuning constants and palette.
// One clear job: every number the game balances on lives here, so tuning
// never means hunting through the renderer or the physics.

export const CFG = {
  // Canvas (fixed internal resolution; CSS scales it to the window).
  width: 1280,
  height: 800,
  horizonY: 336,

  // Camera / projection.
  focal: 430, // pixels of screen per world unit at depth 1
  camBack: 14, // camera sits this far behind the plane
  camUp: 3.2, // camera sits this far above the plane

  // Flight model.
  maxSpeed: 58, // world units per second at full throttle
  minSpeed: 16, // below this the plane mushes and sinks
  accel: 14, // speed gained per second toward throttle target
  climbRate: 16, // vertical speed at full pitch up
  turnRate: 26, // degrees of heading per second at full bank
  bankMax: 38, // visual bank in degrees
  gravitySink: 7, // sink rate when slow or unpowered
  stallSpeed: 20, // below this, extra sink

  // Fuel.
  fuelMax: 100,
  fuelDrain: 1.05, // % per second at full throttle
  fuelRingBonus: 12, // % refuelled by each ring

  // Course.
  ringCount: 8,
  ringRadius: 14,
  ringStartX: 600,
  ringGapX: 550,
  runwayStartX: 5600,
  runwayEndX: 5920,
  runwayHalfWidth: 9,
  startRunwayStartX: -60,
  startRunwayEndX: 170,

  // Scoring.
  ringScore: 100,
  landingScore: 500,
  timeBonusPerSecond: 4,

  // Ground drawing.
  groundFar: 720,
  seaZ: 34, // |z| beyond this is open sea
  sandZ: 20, // |z| between sandZ and seaZ is beach
  coastWobble: 9,
};

export const COLORS = {
  skyTop: '#1d4e89',
  skyMid: '#6fa8d8',
  skyLow: '#cfe8f2',
  sun: '#ffe9a8',
  sunCore: '#fff6cf',
  sea: '#2a6ea6',
  seaDeep: '#1e5688',
  sand: '#d9c48a',
  sandDark: '#cbb273',
  grass: '#5da24a',
  grassDark: '#4d8f3e',
  mountain: '#7d8aa5',
  mountainFar: '#9db1c9',
  cloud: 'rgba(255,255,255,0.92)',
  runway: '#4c4f55',
  runwayEdge: '#f2f2f2',
  ringGold: '#ffc93c',
  ringGlow: 'rgba(255,201,60,0.35)',
  ringDone: '#7be0a3',
  planeRed: '#e8483f',
  planeWhite: '#f4f6f8',
  planeDark: '#2b3440',
  hudPanel: 'rgba(8,18,30,0.72)',
  hudText: '#eaf6ff',
  hudAmber: '#ffcf5c',
  hudGreen: '#7be0a3',
  hudRed: '#ff6b5e',
};

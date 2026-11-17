/**
 * Shared constants between client and server.
 * ESM (Node 20 needs the server in ESM too — see server/package.json).
 *
 * Tuned for a realistic, controllable feel:
 *   - Player jog ≈ 2.8 m/s, sprint ≈ 5 m/s (real human values on a 20×10 m court)
 *   - Ball top speed under 18 m/s on normal shots, ~25 m/s on a smash
 *   - Drag high enough that the ball loses pace through the rally
 */

export const COURT = {
  WIDTH: 10,
  LENGTH: 20,
  WALL_HEIGHT: 4,
  MESH_HEIGHT: 3,
  NET_HEIGHT: 0.92,
  FLOOR_FRICTION: 0.55,
  GLASS_RESTITUTION: 0.6,
};

export const BALL = {
  RADIUS: 0.13,
  MASS: 0.45,
  RESTITUTION: 0.72,
  AIR_DRAG: 0.24,
  MAGNUS: 0.5,
  SPIN_DECAY: 1.6,
};

// Player physics matches the visual avatar (TARGET_HEIGHT in Player.js).
// The hit volume is a vertical capsule centred on the player: horizontal radius
// = REACH, vertical extent from 0 to MAX_HIT_HEIGHT.
export const PLAYER = {
  RADIUS: 0.35,
  HEIGHT: 1.7,
  MASS: 75,
  WALK_SPEED: 2.8,
  RUN_SPEED: 5.0,
  TURN_SPEED: 9.0,
  REACH: 1.15,
  MAX_HIT_HEIGHT: 2.5,
};

// Shot archetypes. distFactor is kept for any code that still references it
// but the new direction logic in MatchRoom uses (rotY, aim) instead. Power and
// vy are the dominant tuning levers now — calibrated so the ball drops inside
// the opposite half on a normal shot from the baseline.
export const SHOTS = {
  normal:  { label: 'Normal',   power: 9.5, vy:  3.5, distFactor: 0.70, spin: 0   },
  picada:  { label: 'Picada',   power: 5.2, vy:  3.9, distFactor: 0.28, spin: 0   },
  remate:  { label: 'Remate',   power: 14.5, vy: -1.0, distFactor: 0.60, spin: 0,   requireHeight: 1.4 },
  especial:{ label: 'Especial', power: 11,  vy:  3.7, distFactor: 0.80, spin: 1.2 },
};

export const PHYSICS = {
  GRAVITY: -9.81,
  TICK_HZ: 60,
  STEP: 1 / 60,
};

export const SCORING = {
  POINT_LADDER: [0, 15, 30, 40],
  GAMES_PER_SET: 6,
  SETS_TO_WIN: 2,
  TIEBREAK_AT: 6,
};

const _envHost =
  (typeof process !== 'undefined' && process.env && process.env.FUTPADEL_HOST) ||
  (typeof globalThis !== 'undefined' && globalThis.__FUTPADEL_HOST__) ||
  null;

export const NET = {
  HOST: _envHost || '127.0.0.1',
  PORT: 2567,
  URL() { return `ws://${this.HOST}:${this.PORT}`; },
};

export const COURTS = [
  { id: 'classic', name: 'Premier Turf',    floor: '#2d8a4e', walls: '#e2e8f0', accent: '#00ff87' },
  { id: 'sunset',  name: 'Desert Arena',    floor: '#3d7c47', walls: '#fef3c7', accent: '#f59e0b' },
  { id: 'neon',    name: 'Night Champions', floor: '#1e6b42', walls: '#67e8f9', accent: '#a78bfa' },
];

export const SKINS = [
  {
    id: 'red', name: 'Marcus Cole', primary: '#dc2626', secondary: '#fef08a',
    skin: '#e8b896', hairColor: '#1c1208', hairStyle: 'fade', eyeColor: '#4a3728',
    build: 'athletic', number: 9,
  },
  {
    id: 'blue', name: 'James Rivera', primary: '#2563eb', secondary: '#0f172a',
    skin: '#c68642', hairColor: '#2d1810', hairStyle: 'short', eyeColor: '#3d2b1f',
    build: 'lean', number: 7,
  },
  {
    id: 'green', name: 'Alex Okonkwo', primary: '#059669', secondary: '#ffffff',
    skin: '#6b4423', hairColor: '#0a0a0a', hairStyle: 'afro', eyeColor: '#2d1f14',
    build: 'power', number: 11,
  },
  {
    id: 'purple', name: 'Sofia Martín', primary: '#9333ea', secondary: '#fde68a',
    skin: '#f1c27d', hairColor: '#3d2314', hairStyle: 'ponytail', eyeColor: '#5c4033',
    build: 'lean', number: 4,
  },
];

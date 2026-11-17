/**
 * Game — broadcast renderer with stadium, post-FX and EA Sports presentation.
 */

import * as THREE from 'three';
import { Callbacks } from '@colyseus/sdk';
import { Court } from './Court.js';
import { Player } from './Player.js';
import { Ball } from './Ball.js';
import { CameraRig } from './CameraRig.js';
import { Input } from './Input.js';
import { Network } from './Network.js';
import { PostFX } from './PostFX.js';
import { Environment } from './Environment.js';
import { Stadium } from './Stadium.js';
import { COURTS, SKINS, BALL, PHYSICS } from '../../../shared/constants.js';

/**
 * Integrate the ball forward in time (gravity + linear drag) until it hits
 * the ground, mirroring the server's stepBall. Used for the landing reticle.
 * Returns null if the ball doesn't land within ~3 seconds.
 */
function predictLanding(state) {
  let x = state.x, y = state.y, z = state.z;
  let vx = state.vx, vy = state.vy, vz = state.vz;
  const dt = 0.025;          // 40 Hz integration is plenty for visual prediction
  const maxSteps = 120;      // up to 3 s of look-ahead
  for (let i = 0; i < maxSteps; i++) {
    vy += PHYSICS.GRAVITY * dt;
    const dragK = BALL.AIR_DRAG * dt;
    vx -= vx * dragK; vy -= vy * dragK; vz -= vz * dragK;
    x += vx * dt; y += vy * dt; z += vz * dt;
    if (y <= BALL.RADIUS && vy < 0) return { x, z };
  }
  return null;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // Pixel ratio capped at 1.25 — pixelRatio=2 on a 4K display triples GPU
    // load on shaders/postfx for a barely-noticeable quality bump.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0c1a3a, 0.012);

    this.cameraRig = new CameraRig();
    this.scene.add(this.cameraRig.camera);

    this.environment = new Environment(this.scene, this.renderer);
    // PostFX (bloom + colour grade + output) was the single biggest GPU cost
    // and made the game stutter on mid-range hardware. It is disabled by
    // default — flip the URL param ?postfx=1 to turn it back on.
    this.usePostFX = new URLSearchParams(window.location.search).get('postfx') === '1';
    this.postfx = this.usePostFX
      ? new PostFX(this.renderer, this.scene, this.cameraRig.camera)
      : null;

    this.input = new Input();
    this.network = null;
    this.stadium = null;
    this.court = null;
    this.ball = null;
    this.players = new Map();
    this.localSessionId = null;
    this.courtDef = COURTS[0];

    this.hud = null;
    this.session = null;
    this.onExit = null;

    this._fillLights();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    this._lastT = performance.now();
    this._running = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  _fillLights() {
    this.scene.add(new THREE.AmbientLight(0x8fa4c4, 0.28));
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.35);
    this.scene.add(hemi);
  }

  handleResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cameraRig.setAspect(w / h);
    if (this.postfx) this.postfx.setSize(w, h);
  }

  clearScene() {
    if (this.stadium) {
      this.stadium.dispose();
      this.scene.remove(this.stadium.group);
      this.stadium = null;
    }
    if (this.court) {
      this.scene.remove(this.court.group);
      this.court = null;
    }
    if (this.ball) {
      this.scene.remove(this.ball.mesh);
      if (this.ball.shadow) this.scene.remove(this.ball.shadow);
      this.ball = null;
    }
    if (this.reticle) {
      this.scene.remove(this.reticle);
      this.reticle.geometry.dispose();
      this.reticle.material.dispose();
      this.reticle = null;
    }
    for (const p of this.players.values()) {
      if (p && p !== 'pending' && p.group) {
        this.scene.remove(p.group);
        p.dispose?.();
      }
    }
    this.players.clear();
  }

  _loadArena(courtDef) {
    this.courtDef = courtDef;
    this.stadium = new Stadium(courtDef, this.scene);
    this.court = new Court(courtDef);
    this.scene.add(this.court.group);
  }

  idleScene() {
    this.clearScene();
    this._loadArena(COURTS[0]);
    this.ball = new Ball();
    this.ball.mesh.position.set(0, 0.55, 0);
    this.scene.add(this.ball.mesh);
    this.scene.add(this.ball.shadow);
    this.cameraRig.setOrbit({
      radius: 22,
      height: 11,
      target: new THREE.Vector3(0, 1.2, 0),
    });
    this.mode = 'idle';
  }

  async startMatch(room, session, hud, onExit) {
    this.clearScene();
    this.hud = hud;
    this.session = session;
    this.onExit = onExit;

    const courtDef = COURTS.find((c) => c.id === session.court) || COURTS[0];
    this._loadArena(courtDef);
    this.ball = new Ball();
    this.scene.add(this.ball.mesh);
    this.scene.add(this.ball.shadow);

    this.network = new Network(room);
    this.localSessionId = room.sessionId;

    // Landing reticle: a thin ring on the floor that previews where the ball
    // will hit the ground. Critical for positioning yourself to return shots.
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.40, 32),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.position.y = 0.04;
    this.reticle.renderOrder = 999;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    const callbacks = Callbacks.get(room);
    callbacks.onAdd('players', (player, sessionId) => this.spawnPlayer(player, sessionId));
    callbacks.onRemove('players', (_, sessionId) => this.removePlayer(sessionId));
    room.onStateChange(() => this.onStateChange());
    room.onLeave(() => this.exit());

    this.cameraRig.setBroadcast();
    this.mode = 'match';
  }

  async spawnPlayer(playerState, sessionId) {
    if (this.players.has(sessionId)) return;
    // Reserve the slot synchronously so concurrent onAdd events for the same
    // session ID cannot race through and create a second model while we await.
    this.players.set(sessionId, 'pending');

    const skinDef = SKINS.find((s) => s.id === playerState.skin) || SKINS[0];
    const p = new Player(skinDef, playerState.team);
    await p.load();

    if (this.players.get(sessionId) !== 'pending') {
      p.dispose?.();
      return;
    }

    p.setName(playerState.name);
    p.state = playerState;
    p.group.position.set(playerState.x, 0, playerState.z);
    this.players.set(sessionId, p);
    this.scene.add(p.group);
    if (sessionId === this.localSessionId) p.markLocal();
  }

  removePlayer(sessionId) {
    const p = this.players.get(sessionId);
    if (!p) return;
    this.players.delete(sessionId);
    if (p === 'pending') return;
    p.dispose?.();
    this.scene.remove(p.group);
  }

  onStateChange() {
    if (!this.hud) return;
    const s = this.network.room.state;
    this.hud.update({
      pointsA: s.score.pointsTextA,
      pointsB: s.score.pointsTextB,
      gamesA: Array.from(s.score.gamesA),
      gamesB: Array.from(s.score.gamesB),
      setsA: s.score.setsA,
      setsB: s.score.setsB,
      currentSet: s.score.currentSet,
      phase: s.phase,
      message: s.message,
      connected: true,
    });
  }

  exit() {
    this.clearScene();
    if (this.onExit) this.onExit();
    this.onExit = null;
    this.network = null;
  }

  loop(t) {
    if (!this._running) return;
    const dt = Math.min(0.05, (t - this._lastT) / 1000);
    this._lastT = t;

    if (this.mode === 'idle') {
      this.cameraRig.tickIdle(dt);
      if (this.ball) {
        this.ball.mesh.rotation.y += dt * 0.4;
        this.ball.mesh.rotation.x += dt * 0.15;
      }
    } else if (this.mode === 'match') {
      this.tickMatch(dt);
    }

    if (this.postfx) this.postfx.render();
    else this.renderer.render(this.scene, this.cameraRig.camera);
    requestAnimationFrame((tt) => this.loop(tt));
  }

  tickMatch(dt) {
    if (!this.network?.room) return;
    const room = this.network.room;

    const inputState = this.input.sample(this.cameraRig.camera);
    room.send('input', inputState);
    if (inputState.kick && room.state.phase === 'serving') {
      room.send('serve');
    }

    for (const [, p] of this.players.entries()) {
      if (!p || p === 'pending') continue;
      const target = p.state;
      if (!target) continue;
      p.group.position.x += (target.x - p.group.position.x) * Math.min(1, dt * 16);
      p.group.position.z += (target.z - p.group.position.z) * Math.min(1, dt * 16);
      p.group.rotation.y += this.shortestAngle(p.group.rotation.y, target.rotY) * Math.min(1, dt * 14);
      p.tickAnim(dt, {
        speed: Math.hypot(target.vx, target.vz),
        inKick: target.inKick,
        inSmash: target.inSmash,
        inHeader: target.inHeader,
      });
      const isLocal = p === this.players.get(this.localSessionId);
      p.setPower?.(
        isLocal ? inputState.shotPower : target.shotPower,
        isLocal ? inputState.charging : target.shotPower > 0.02,
      );
    }

    const b = room.state.ball;
    this.ball.mesh.position.x += (b.x - this.ball.mesh.position.x) * Math.min(1, dt * 20);
    this.ball.mesh.position.y += (b.y - this.ball.mesh.position.y) * Math.min(1, dt * 20);
    this.ball.mesh.position.z += (b.z - this.ball.mesh.position.z) * Math.min(1, dt * 20);
    this.ball.tick(dt, b);

    // Update landing reticle by integrating the ball's predicted trajectory
    // using the same gravity + drag model the server uses.
    if (this.reticle) {
      const inAir = b.y > BALL.RADIUS * 1.5 && room.state.phase === 'rally';
      if (inAir) {
        const landing = predictLanding(b);
        if (landing) {
          this.reticle.position.x = landing.x;
          this.reticle.position.z = landing.z;
          // Scale ring with how far the ball still has to travel so it
          // contracts as the ball approaches (extra tension on returns).
          const remaining = Math.max(0, b.y - BALL.RADIUS);
          const scale = 0.7 + Math.min(1, remaining / 3) * 0.6;
          this.reticle.scale.setScalar(scale);
          this.reticle.visible = true;
        } else {
          this.reticle.visible = false;
        }
      } else {
        this.reticle.visible = false;
      }
    }

    const localPlayer = this.players.get(this.localSessionId);
    if (localPlayer && localPlayer !== 'pending') {
      this.cameraRig.tickBroadcast(localPlayer.group, dt, localPlayer.state?.team ?? 0);
      if (!this._loggedCamera) {
        this._loggedCamera = true;
        setTimeout(() => {
          const cam = this.cameraRig.camera;
          const lp = this.players.get(this.localSessionId);
          if (!lp || lp === 'pending') return;
          const dx = cam.position.x - lp.group.position.x;
          const dy = cam.position.y - lp.group.position.y;
          const dz = cam.position.z - lp.group.position.z;
          const dist = Math.hypot(dx, dy, dz);
          console.log('[camera] position:', cam.position.toArray().map(v=>v.toFixed(2)).join(','),
            '| player at:', lp.group.position.toArray().map(v=>v.toFixed(2)).join(','),
            '| distance:', dist.toFixed(2),
            '| FOV:', cam.fov);
        }, 1500);
      }
    }
  }

  shortestAngle(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
}

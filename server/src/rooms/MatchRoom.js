/**
 * MatchRoom — authoritative 1v1 padel-with-foot room.
 *
 * Responsibilities:
 *  - Assign players to teams (0 and 1) on join.
 *  - Run a fixed-rate physics simulation of the ball and player capsules.
 *  - Enforce the rule machine: serve → rally → point_won → next serve.
 *  - Replicate state to clients via Colyseus schema.
 */

import { Room } from '@colyseus/core';
import { MatchState, PlayerState } from '../schemas/MatchState.js';
import { tickBot, CPU_ID } from '../ai/BotBrain.js';
import {
  COURT, COURTS, SKINS, BALL, PLAYER, PHYSICS, SCORING, SHOTS,
} from '../../../shared/constants.js';

const HALF_W = COURT.WIDTH / 2;
const HALF_L = COURT.LENGTH / 2;
const SERVE_HEIGHT = 1.2;
const POINT_DELAY_MS = 1800;

export class MatchRoom extends Room {
  onCreate(options = {}) {
    this.vsCpu = options.vsCpu === true;
    this.maxClients = this.vsCpu ? 1 : 2;
    this.state = new MatchState();
    this.state.court = COURTS.some(court => court.id === options.court) ? options.court : 'classic';

    this.lastBallY = this.state.ball.y;
    this.justBouncedFloor = false;
    this.pointPending = false;

    this.onMessage('input', (client, data) => this.applyInput(client, data));
    this.onMessage('serve', (client) => this.tryServe(client));
    this.onMessage('ready', (client) => this.markReady(client));

    this.setTimestep((dt) => this.step(dt / 1000), 1000 / PHYSICS.TICK_HZ);

    console.log('[match] room created', this.roomId, 'court=', this.state.court);
  }

  onJoin(client, options = {}) {
    const team = Array.from(this.state.players.values()).some(player => player.team === 0) ? 1 : 0;
    const player = new PlayerState();
    player.name = (typeof options.name === 'string' && options.name.trim().slice(0, 28)) || `Player-${client.sessionId.slice(0, 4)}`;
    player.skin = SKINS.some(skin => skin.id === options.skin) ? options.skin : 'red';
    player.team = team;
    player.z = team === 0 ? HALF_L - 1.5 : -HALF_L + 1.5;
    player.x = 0;
    player.y = 0;
    player.rotY = team === 0 ? Math.PI : 0;
    this.state.players.set(client.sessionId, player);
    console.log(`[match] ${player.name} joined as team ${team}`);

    if (this.vsCpu) this.spawnCpu();

    if (this.state.players.size >= 2) {
      this.startMatch();
    }
  }

  spawnCpu() {
    if (this.state.players.has(CPU_ID)) return;
    const player = new PlayerState();
    player.name = 'CPU Rival';
    player.skin = 'blue';
    player.team = 1;
    player.z = -HALF_L + 1.5;
    player.x = 0;
    player.rotY = 0;
    player.connected = true;
    this.state.players.set(CPU_ID, player);
    console.log('[match] CPU opponent spawned');
  }

  onLeave(client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.state.players.delete(client.sessionId);
    if (this.state.phase === 'rally' || this.state.phase === 'serving') {
      this.state.phase = 'waiting';
      this.state.message = `${player.name} disconnected`;
    }
  }

  startMatch() {
    this.state.phase = 'serving';
    this.state.servingTeam = 0;
    this.state.serveBox = 0;
    this.state.message = 'Press SPACE to serve';
    this.resetBallToServer();
  }

  markReady(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.ready = true;
  }

  applyInput(client, data) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !data || typeof data !== 'object') return;
    p.inUp = !!data.up;
    p.inDown = !!data.down;
    p.inLeft = !!data.left;
    p.inRight = !!data.right;
    p.inKick = !!data.kick;
    p.inLob = !!data.lob;
    p.inSmash = !!data.smash;
    p.inHeader = !!data.header;
    if (Number.isFinite(data.aimX)) p.aimX = Math.max(-1, Math.min(1, data.aimX));
    if (Number.isFinite(data.aimZ)) p.aimZ = Math.max(-1, Math.min(1, data.aimZ));
    if (Number.isFinite(data.shotPower)) {
      p.shotPower = Math.max(0, Math.min(1, data.shotPower));
    }
  }

  tryServe(client) {
    if (this.state.phase !== 'serving') return;
    const server = this.serverPlayer();
    const player = this.state.players.get(client.sessionId);
    if (!server || server !== player) return;
    this.executeServe(server, client.sessionId);
  }

  executeServe(server, sessionId) {
    if (this.state.phase !== 'serving') return;
    const dir = server.team === 0 ? -1 : 1;
    const power01 = Math.max(0, Math.min(1, server.shotPower || 0));
    const powerScale = 0.55 + power01 * 0.9;
    this.state.ball.held = '';
    this.state.ball.vx = (server.aimX || 0) * 0.6 * powerScale;
    this.state.ball.vy = 7.1 * (0.75 + power01 * 0.35);
    this.state.ball.vz = dir * 7.6 * powerScale;
    this.state.ball.spin = 0;
    this.state.ball.lastShot = 'normal';
    server.shotPower = 0;
    this.state.phase = 'rally';
    this.state.lastTouchTeam = server.team;
    this.state.lastTouchSession = sessionId;
    this.state.bouncesOnSide = 0;
    this.state.sideOfBall = server.team;
    this.state.crossedNet = false;
    this.state.message = '';
  }

  serverPlayer() {
    for (const p of this.state.players.values()) {
      if (p.team === this.state.servingTeam) return p;
    }
    return null;
  }

  step(dt) {
    this.state.tick++;

    if (this.vsCpu) {
      const cpu = this.state.players.get(CPU_ID);
      if (cpu) {
        tickBot(cpu, this.state.ball, this.state, dt);
        const server = this.serverPlayer();
        if (this.state.phase === 'serving' && server === cpu) {
          this._cpuServeT = (this._cpuServeT || 0) + dt;
          if (this._cpuServeT > 1.4) {
            this.executeServe(cpu, CPU_ID);
            this._cpuServeT = 0;
          }
        } else {
          this._cpuServeT = 0;
        }
      }
    }

    for (const p of this.state.players.values()) {
      if (p.connected === false) continue;
      this.stepPlayer(p, dt);
    }

    if (this.state.phase === 'serving') {
      const server = this.serverPlayer();
      if (server) {
        this.state.ball.x = server.x;
        this.state.ball.y = SERVE_HEIGHT;
        this.state.ball.z = server.z + (server.team === 0 ? -0.5 : 0.5);
        this.state.ball.vx = this.state.ball.vy = this.state.ball.vz = 0;
        this.state.ball.held = '__server__';
      }
    } else if (this.state.phase === 'rally') {
      this.stepBall(dt);
      this.checkBallCollisions();
    }

    if (this.state.phase === 'rally') {
      this.evaluateRules();
    }
  }

  stepPlayer(p, dt) {
    if (!p.connected) return;

    // Lock the server to their baseline while waiting to serve, but allow
    // lateral movement so the player can choose the serve angle.
    if (this.state.phase === 'serving' && p === this.serverPlayer()) {
      let mx = 0;
      if (p.inLeft) mx -= 1;
      if (p.inRight) mx += 1;
      if (mx !== 0) {
        p.vx = mx * PLAYER.WALK_SPEED;
      } else {
        p.vx *= 0.65;
      }
      p.x += p.vx * dt;
      p.z = p.team === 0 ? HALF_L - 0.4 : -HALF_L + 0.4;
      p.vz = 0;
      p.rotY = p.team === 0 ? Math.PI : 0;
      const minX = -HALF_W + PLAYER.RADIUS;
      const maxX = HALF_W - PLAYER.RADIUS;
      if (p.x < minX) p.x = minX;
      if (p.x > maxX) p.x = maxX;
      return;
    }

    const forward = p.team === 0 ? -1 : 1;
    let mx = 0; let mz = 0;
    if (p.inUp) mz += forward;
    if (p.inDown) mz -= forward;
    if (p.inLeft) mx -= 1;
    if (p.inRight) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const speed = PLAYER.RUN_SPEED;
      p.vx = mx * speed;
      p.vz = mz * speed;
      p.rotY = Math.atan2(mx, mz);
    } else {
      p.vx *= 0.7;
      p.vz *= 0.7;
      // Auto-face the ball when standing still, so shots from a stationary
      // player point in a sensible direction (toward the ball / opponent)
      // instead of stuck at whatever rotY the player happened to have.
      // Smoothly rotate toward the ball with a max angular velocity.
      if (this.state.phase === 'rally' || this.state.phase === 'serving') {
        const b = this.state.ball;
        const dx = b.x - p.x;
        const dz = b.z - p.z;
        if (Math.hypot(dx, dz) > 0.1) {
          const targetRot = Math.atan2(dx, dz);
          let delta = targetRot - p.rotY;
          // Wrap to [-π, π]
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          const maxStep = PLAYER.TURN_SPEED * dt;
          p.rotY += Math.max(-maxStep, Math.min(maxStep, delta));
        }
      }
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const minZ = p.team === 0 ? 0.2 : -HALF_L + PLAYER.RADIUS;
    const maxZ = p.team === 0 ? HALF_L - PLAYER.RADIUS : -0.2;
    if (p.z < minZ) p.z = minZ;
    if (p.z > maxZ) p.z = maxZ;
    if (p.x < -HALF_W + PLAYER.RADIUS) p.x = -HALF_W + PLAYER.RADIUS;
    if (p.x > HALF_W - PLAYER.RADIUS) p.x = HALF_W - PLAYER.RADIUS;
  }

  stepBall(dt) {
    const b = this.state.ball;
    // Gravity + air drag.
    b.vy += PHYSICS.GRAVITY * dt;
    const dragK = BALL.AIR_DRAG * dt;
    b.vx -= b.vx * dragK;
    b.vy -= b.vy * dragK;
    b.vz -= b.vz * dragK;

    // Magnus effect: spin × horizontal velocity → lateral acceleration.
    // Positive spin curves right (toward +X) for a ball moving forward.
    if (Math.abs(b.spin) > 0.01) {
      const horizSpeed = Math.hypot(b.vx, b.vz);
      if (horizSpeed > 0.001) {
        const nx = -b.vz / horizSpeed;
        const nz = b.vx / horizSpeed;
        const force = b.spin * BALL.MAGNUS * dt;
        b.vx += nx * force;
        b.vz += nz * force;
      }
      // Spin decays.
      b.spin *= Math.max(0, 1 - BALL.SPIN_DECAY * dt);
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
  }

  checkBallCollisions() {
    const b = this.state.ball;

    if (b.y - BALL.RADIUS <= 0 && b.vy < 0) {
      b.y = BALL.RADIUS;
      b.vy = -b.vy * BALL.RESTITUTION;
      b.vx *= 0.78; b.vz *= 0.78;
      this.justBouncedFloor = true;
      const bounceSide = b.z > 0 ? 0 : 1;
      if (bounceSide === this.state.sideOfBall) {
        this.state.bouncesOnSide++;
      } else {
        this.state.sideOfBall = bounceSide;
        this.state.bouncesOnSide = 1;
        this.state.crossedNet = true;
      }
    }

    if (Math.abs(b.z) < 0.05 && b.y < COURT.NET_HEIGHT) {
      if ((b.vz > 0 && this.state.lastTouchTeam === 1) ||
          (b.vz < 0 && this.state.lastTouchTeam === 0)) {
        b.vz = -b.vz * 0.2;
        b.vy = Math.abs(b.vy) * 0.2;
        this.awardPointAgainst(this.state.lastTouchTeam);
        return;
      }
    } else if (Math.sign(b.z) !== Math.sign(b.z - b.vz * (1 / PHYSICS.TICK_HZ))) {
      if (b.y >= COURT.NET_HEIGHT) {
        this.state.crossedNet = true;
        this.state.sideOfBall = b.z > 0 ? 0 : 1;
        this.state.bouncesOnSide = 0;
      }
    }

    // Back walls — touching glass before the receiving side has bounced
    // counts as a direct-glass fault and gives the point to the hitter.
    if (b.z > HALF_L - BALL.RADIUS && b.vz > 0) {
      if (b.y < COURT.WALL_HEIGHT) {
        if (this.state.bouncesOnSide === 0 && this.state.lastTouchTeam !== -1) {
          this.awardPointAgainst(this.state.lastTouchTeam);
          return;
        }
        b.z = HALF_L - BALL.RADIUS;
        b.vz = -b.vz * COURT.GLASS_RESTITUTION;
      } else {
        this.awardPointAgainst(this.state.lastTouchTeam);
        return;
      }
    }
    if (b.z < -HALF_L + BALL.RADIUS && b.vz < 0) {
      if (b.y < COURT.WALL_HEIGHT) {
        if (this.state.bouncesOnSide === 0 && this.state.lastTouchTeam !== -1) {
          this.awardPointAgainst(this.state.lastTouchTeam);
          return;
        }
        b.z = -HALF_L + BALL.RADIUS;
        b.vz = -b.vz * COURT.GLASS_RESTITUTION;
      } else {
        this.awardPointAgainst(this.state.lastTouchTeam);
        return;
      }
    }

    // Side walls — same rule.
    if (b.x > HALF_W - BALL.RADIUS && b.vx > 0) {
      if (b.y < COURT.MESH_HEIGHT) {
        if (this.state.bouncesOnSide === 0 && this.state.lastTouchTeam !== -1) {
          this.awardPointAgainst(this.state.lastTouchTeam);
          return;
        }
        b.x = HALF_W - BALL.RADIUS;
        b.vx = -b.vx * 0.4;
      } else {
        this.awardPointAgainst(this.state.lastTouchTeam);
        return;
      }
    }
    if (b.x < -HALF_W + BALL.RADIUS && b.vx < 0) {
      if (b.y < COURT.MESH_HEIGHT) {
        if (this.state.bouncesOnSide === 0 && this.state.lastTouchTeam !== -1) {
          this.awardPointAgainst(this.state.lastTouchTeam);
          return;
        }
        b.x = -HALF_W + BALL.RADIUS;
        b.vx = -b.vx * 0.4;
      } else {
        this.awardPointAgainst(this.state.lastTouchTeam);
        return;
      }
    }

    for (const [sid, p] of this.state.players.entries()) {
      if (p.connected === false) continue;

      // Require an actual shot input. Without it the player just stands near
      // the ball — they don't shove it around with their body.
      const wantsShot = p.inKick || p.inLob || p.inSmash || p.inHeader;
      if (!wantsShot) continue;

      // Horizontal range check (foot/leg reach).
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const horiz = Math.hypot(dx, dz);
      if (horiz > PLAYER.REACH) continue;

      // Vertical reach: the ball must be inside the player's hit volume
      // (ground up to MAX_HIT_HEIGHT — slightly above the player's head).
      if (b.y > PLAYER.MAX_HIT_HEIGHT || b.y < 0) continue;

      const shotName = this.pickShot(p, b);
      const shot = SHOTS[shotName];
      this.applyShot(b, p, shot, shotName);
      p.shotPower = 0;
      this.state.ball.lastShot = shotName;

      const push = (PLAYER.REACH + BALL.RADIUS - horiz) || 0;
      if (horiz > 0) {
        b.x += (dx / horiz) * (push + 0.05);
        b.z += (dz / horiz) * (push + 0.05);
      }
      this.state.lastTouchTeam = p.team;
      this.state.lastTouchSession = sid;
      this.state.bouncesOnSide = 0;
      this.state.crossedNet = false;
      break;
    }
  }

  /**
   * Selects which of the four shots a player attempts on contact, with the
   * smash priority gated on ball height.
   */
  pickShot(p, b) {
    if (p.inSmash && b.y >= (SHOTS.remate.requireHeight ?? 0.3)) return 'remate';
    if (p.inHeader) return 'especial';
    if (p.inLob) return 'picada';
    return 'normal';
  }

  /**
   * Apply a shot. Direction comes from where the player is *facing* (rotY),
   * not a fixed target on the far baseline. Aim input (mouse / right stick)
   * adds a lateral world-space bias matching the screen's left/right.
   *
   * Two safeguards keep stationary shots from going into your own back wall:
   *   - if the player isn't moving fast, rotY is overridden to "face opponent"
   *   - if the player happens to face their own half, same override applies
   */
  applyShot(b, p, shot, name) {
    // Power is charged client-side and clamped server-side. A tap still
    // produces a weak shot; holding too long can overhit into the back glass.
    const power01 = Math.max(0, Math.min(1, p.shotPower || 0));
    const powerScale = 0.55 + power01 * 0.9; // 55% .. 145%

    let fwdX = Math.sin(p.rotY);
    let fwdZ = Math.cos(p.rotY);

    const movingFast = Math.hypot(p.vx, p.vz) > 0.5;
    const facingOpponent = (p.team === 0 && fwdZ < 0) || (p.team === 1 && fwdZ > 0);
    if (!movingFast || !facingOpponent) {
      const defaultRot = p.team === 0 ? Math.PI : 0;
      fwdX = Math.sin(defaultRot);
      fwdZ = Math.cos(defaultRot);
    }

    // Mouse aim is reported in *screen* coordinates (+1 = right of screen).
    // The camera for team 0 sits at +Z (screen-right = world +X); for team 1
    // it sits at -Z (screen-right = world -X). We map aim into world +X.
    const aimX = Math.max(-1, Math.min(1, p.aimX || 0));
    const screenRightSign = p.team === 0 ? 1 : -1;
    const lateralX = aimX * screenRightSign * 0.7;

    let dirX = fwdX + lateralX;
    let dirZ = fwdZ;
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len; dirZ /= len;

    b.vx = dirX * shot.power * powerScale;
    b.vz = dirZ * shot.power * powerScale;
    b.vy = shot.vy * (0.75 + power01 * 0.35);

    if (shot.spin !== 0) {
      b.spin = shot.spin * powerScale * Math.sign(aimX || (Math.random() - 0.5));
    } else {
      b.spin = 0;
    }
    if (name === 'picada') {
      b.vy *= 0.85;
    }
  }

  evaluateRules() {
    if (this.state.bouncesOnSide >= 2) {
      const losingTeam = this.state.sideOfBall;
      this.awardPointAgainst(losingTeam);
    }
    const b = this.state.ball;
    if (b.y < -2 || Math.abs(b.x) > 50 || Math.abs(b.z) > 50) {
      this.awardPointAgainst(this.state.lastTouchTeam);
    }
  }

  awardPointAgainst(team) {
    if (this.state.phase !== 'rally' || this.pointPending) return;
    this.pointPending = true;
    const winner = team === 0 ? 1 : 0;
    if (winner === 0) this.state.score.pointsA++; else this.state.score.pointsB++;
    this.state.message = `Point for ${winner === 0 ? 'A' : 'B'}!`;
    this.state.phase = 'point_won';
    this.checkGame();
    this.refreshPointStrings();
    setTimeout(() => this.nextServe(winner), POINT_DELAY_MS);
  }

  refreshPointStrings() {
    const ladder = SCORING.POINT_LADDER;
    const a = this.state.score.pointsA;
    const b = this.state.score.pointsB;
    if (a >= 3 && b >= 3) {
      if (a === b) { this.state.score.pointsTextA = '40'; this.state.score.pointsTextB = '40'; }
      else if (a > b) { this.state.score.pointsTextA = 'Ad'; this.state.score.pointsTextB = '40'; }
      else { this.state.score.pointsTextA = '40'; this.state.score.pointsTextB = 'Ad'; }
    } else {
      this.state.score.pointsTextA = String(ladder[Math.min(a, 3)]);
      this.state.score.pointsTextB = String(ladder[Math.min(b, 3)]);
    }
  }

  checkGame() {
    const s = this.state.score;
    const a = s.pointsA; const b = s.pointsB;
    let gameWinner = -1;
    if (a >= 4 && a - b >= 2) gameWinner = 0;
    else if (b >= 4 && b - a >= 2) gameWinner = 1;
    if (gameWinner === -1) return;

    if (s.gamesA.length <= s.currentSet) {
      while (s.gamesA.length <= s.currentSet) { s.gamesA.push(0); s.gamesB.push(0); }
    }
    if (gameWinner === 0) s.gamesA[s.currentSet]++; else s.gamesB[s.currentSet]++;
    s.pointsA = 0; s.pointsB = 0;
    this.state.servingTeam = 1 - this.state.servingTeam;

    const gA = s.gamesA[s.currentSet]; const gB = s.gamesB[s.currentSet];
    if ((gA >= 6 && gA - gB >= 2) || gA >= 7) { s.setsA++; this.advanceSet(); }
    else if ((gB >= 6 && gB - gA >= 2) || gB >= 7) { s.setsB++; this.advanceSet(); }

    if (s.setsA >= SCORING.SETS_TO_WIN || s.setsB >= SCORING.SETS_TO_WIN) {
      this.state.phase = 'match_won';
      this.state.message = `Match won by ${s.setsA > s.setsB ? 'A' : 'B'}!`;
    }
  }

  advanceSet() {
    const s = this.state.score;
    s.currentSet++;
    s.gamesA.push(0);
    s.gamesB.push(0);
  }

  nextServe(serveTeam) {
    if (this.state.phase === 'match_won') return;
    this.pointPending = false;
    this.state.servingTeam = serveTeam;
    this.state.serveBox = 1 - this.state.serveBox;
    this.state.phase = 'serving';
    this.state.message = 'Press SPACE / A to serve';
    this.state.bouncesOnSide = 0;
    this.state.crossedNet = false;
    this.resetBallToServer();
  }

  resetBallToServer() {
    const server = this.serverPlayer();
    if (!server) return;
    const boxSign = this.state.serveBox === 0 ? 1 : -1;
    server.x = boxSign * (COURT.WIDTH / 4);
    server.z = server.team === 0 ? HALF_L - 0.4 : -HALF_L + 0.4;
    this.state.ball.x = server.x;
    this.state.ball.y = SERVE_HEIGHT;
    this.state.ball.z = server.z + (server.team === 0 ? -0.5 : 0.5);
    this.state.ball.vx = this.state.ball.vy = this.state.ball.vz = 0;
    this.state.ball.held = '__server__';
  }
}

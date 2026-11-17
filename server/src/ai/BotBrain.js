/**
 * Simple padel bot — tracks the ball, stays on its own half, and only attempts
 * to strike when the ball is inside the same hit volume a human player has
 * (REACH horizontally, 0..MAX_HIT_HEIGHT vertically). This keeps the bot's
 * intent aligned with what the server actually accepts as a contact.
 */

import { COURT, PLAYER, PHYSICS, BALL } from '../../../shared/constants.js';

const HALF_W = COURT.WIDTH / 2;
const HALF_L = COURT.LENGTH / 2;
const CPU_ID = '__cpu__';

export { CPU_ID };

export function tickBot(player, ball, match, dt) {
  player.inUp = false;
  player.inDown = false;
  player.inLeft = false;
  player.inRight = false;
  player.inKick = false;
  player.inLob = false;
  player.inSmash = false;
  player.inHeader = false;

  if (match.phase !== 'rally' && match.phase !== 'serving') return;

  const team = player.team;
  if (match.phase === 'serving' && match.servingTeam === team) {
    player.shotPower = 0.7;
    return;
  }

  const onOurSide = team === 0 ? ball.z > 0 : ball.z < 0;
  const incomingToUs = team === 0 ? ball.vz > 0 : ball.vz < 0;

  // Anticipate the bounce/contact point. Waiting until the ball crosses the net
  // gives the CPU too little time on serves, so it starts moving as soon as the
  // ball is travelling toward its half.
  const tGround = timeUntilGround(ball);
  const lead = incomingToUs ? clamp(tGround * 0.75, 0.45, 1.2) : 0.35;
  const predictX = ball.x + ball.vx * lead;
  const predictZ = ball.z + ball.vz * lead;

  let targetX;
  let targetZ;
  if (onOurSide || incomingToUs) {
    targetX = predictX * 0.9;
    targetZ = team === 0
      ? Math.max(1.0, Math.min(predictZ + 0.3, HALF_L - PLAYER.RADIUS - 0.2))
      : Math.min(-1.0, Math.max(predictZ - 0.3, -HALF_L + PLAYER.RADIUS + 0.2));
  } else {
    // Idle near the centre of own service area when waiting.
    targetX = 0;
    targetZ = team === 0 ? HALF_L - 2.5 : -HALF_L + 2.5;
  }

  const dx = targetX - player.x;
  const dz = targetZ - player.z;

  // stepPlayer treats inUp as "forward" relative to team — so for team 1 we
  // flip the dz comparison.
  if (Math.abs(dz) > 0.25) {
    if (team === 0) {
      if (dz < 0) player.inUp = true; else player.inDown = true;
    } else {
      if (dz > 0) player.inUp = true; else player.inDown = true;
    }
  }
  if (Math.abs(dx) > 0.25) {
    if (dx < 0) player.inLeft = true; else player.inRight = true;
  }

  // Only request a shot if the ball is actually inside the hit volume the
  // server enforces. Otherwise the bot would keep "trying" and look stuck.
  const dist = Math.hypot(ball.x - player.x, ball.z - player.z);
  const inHorizontalRange = dist < PLAYER.REACH + 0.05;
  const inVerticalRange = ball.y >= BALL.RADIUS && ball.y <= PLAYER.MAX_HIT_HEIGHT;

  if (match.phase === 'rally' && inHorizontalRange && inVerticalRange) {
    player.shotPower = 0.65;
    if (ball.y > 1.4 && Math.random() > 0.4) {
      // High ball → smash if not too high, otherwise especial header.
      if (ball.y < 2.2) player.inSmash = true;
      else player.inHeader = true;
    } else if (onOurSide && Math.random() > 0.85) {
      // Occasionally drop a picada from low balls.
      player.inLob = true;
    } else {
      player.inKick = true;
    }
  }

  player.aimX = clamp((ball.x - player.x) / HALF_W, -1, 1);
  player.aimZ = clamp((targetZ - player.z) / HALF_L, -1, 1);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function timeUntilGround(ball) {
  const groundY = BALL.RADIUS;
  const a = 0.5 * PHYSICS.GRAVITY;
  const b = ball.vy;
  const c = ball.y - groundY;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || Math.abs(a) < 0.0001) return 0.5;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / (2 * a);
  const t2 = (-b + sqrt) / (2 * a);
  const candidates = [t1, t2].filter((t) => Number.isFinite(t) && t > 0);
  return candidates.length ? Math.min(...candidates) : 0.5;
}

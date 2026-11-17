/**
 * Input — unifies keyboard + gamepad into a per-frame snapshot:
 *   { up, down, left, right, kick, lob, smash, header, aimX, aimZ }
 *
 * Keyboard: WASD move,
 *   SPACE → Golpe normal
 *   SHIFT → Picada (drop shot)
 *   CTRL  → Remate (smash, requires ball >7.5m)
 *   E     → Especial (curve / power)
 * Gamepad (standard mapping): left stick move, A kick, X lob, B smash,
 *   Y header, right stick aim.
 */

const KEYS = {
  up:     ['KeyW', 'ArrowUp'],
  down:   ['KeyS', 'ArrowDown'],
  left:   ['KeyA', 'ArrowLeft'],
  right:  ['KeyD', 'ArrowRight'],
  kick:   ['Space'],
  lob:    ['ShiftLeft', 'ShiftRight'],
  smash:  ['ControlLeft', 'ControlRight'],
  header: ['KeyE'],
};

export class Input {
  constructor() {
    this.pressed = new Set();
    this.mouseAimX = 0;
    this.mouseAimZ = 0;
    this.activeShot = null;
    this.charge = 0;
    this.lastT = performance.now();
    window.addEventListener('keydown', (e) => this.pressed.add(e.code));
    window.addEventListener('keyup',   (e) => this.pressed.delete(e.code));
    window.addEventListener('blur', () => this.pressed.clear());
    window.addEventListener('mousemove', (e) => {
      // Aim relative to screen center, normalised to [-1, 1].
      const w = window.innerWidth, h = window.innerHeight;
      this.mouseAimX = ((e.clientX / w) * 2 - 1);
      this.mouseAimZ = ((e.clientY / h) * 2 - 1);
    });
  }

  keyDown(action) {
    return KEYS[action].some((k) => this.pressed.has(k));
  }

  gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  sample() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;

    const g = this.gamepad();
    let up = this.keyDown('up'), down = this.keyDown('down'),
        left = this.keyDown('left'), right = this.keyDown('right'),
        kickHeld = this.keyDown('kick'), lobHeld = this.keyDown('lob'),
        smashHeld = this.keyDown('smash'), headerHeld = this.keyDown('header');
    let aimX = this.mouseAimX, aimZ = this.mouseAimZ;

    if (g) {
      const dz = 0.18;
      const lx = Math.abs(g.axes[0]) > dz ? g.axes[0] : 0;
      const ly = Math.abs(g.axes[1]) > dz ? g.axes[1] : 0;
      const rx = Math.abs(g.axes[2]) > dz ? g.axes[2] : 0;
      const ry = Math.abs(g.axes[3]) > dz ? g.axes[3] : 0;
      if (ly < 0) up = true;
      if (ly > 0) down = true;
      if (lx < 0) left = true;
      if (lx > 0) right = true;
      if (rx !== 0 || ry !== 0) { aimX = rx; aimZ = ry; }
      // Standard mapping: 0=A, 1=B, 2=X, 3=Y
      if (g.buttons[0]?.pressed) kickHeld = true;
      if (g.buttons[2]?.pressed) lobHeld = true;
      if (g.buttons[1]?.pressed) smashHeld = true;
      if (g.buttons[3]?.pressed) headerHeld = true;
    }

    const held = {
      smash: smashHeld,
      header: headerHeld,
      lob: lobHeld,
      kick: kickHeld,
    };
    const priority = ['smash', 'header', 'lob', 'kick'];
    const current = priority.find((name) => held[name]) || null;

    let kick = false, lob = false, smash = false, header = false;
    if (!this.activeShot && current) {
      this.activeShot = current;
      this.charge = 0;
    }

    if (this.activeShot) {
      if (held[this.activeShot]) {
        // Full charge in ~1.1 seconds.
        this.charge = Math.min(1, this.charge + dt / 1.1);
      } else {
        // Fire on release.
        if (this.activeShot === 'kick') kick = true;
        if (this.activeShot === 'lob') lob = true;
        if (this.activeShot === 'smash') smash = true;
        if (this.activeShot === 'header') header = true;
        this.activeShot = null;
      }
    }

    let shotPower = this.charge;
    if (!this.activeShot && (kick || lob || smash || header)) {
      // Keep shotPower for this release frame, clear afterwards on next sample.
      this._clearChargeNext = true;
    } else if (this._clearChargeNext) {
      this.charge = 0;
      shotPower = 0;
      this._clearChargeNext = false;
    }

    return {
      up, down, left, right,
      kick, lob, smash, header,
      kickHeld, lobHeld, smashHeld, headerHeld,
      charging: !!this.activeShot,
      shotPower,
      aimX,
      aimZ,
    };
  }
}

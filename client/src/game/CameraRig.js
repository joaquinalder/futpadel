/**
 * CameraRig — three modes:
 *   - orbit: slow camera spin around centre (menu background)
 *   - chase: third-person behind the player (tennis broadcast feel)
 *   - tv:    high static broadcast angle behind baseline (no follow)
 *
 * The match cycles between chase and tv with Tab; chase is the default.
 */

import * as THREE from 'three';
import { COURT } from '../../../shared/constants.js';

const HALF_L = COURT.LENGTH / 2;

const VIEW_CONFIG = {
  chase: {
    height: 3.5,
    distance: 6,
    xBias: 0.3,
    maxX: 3.5,
    lookAhead: 7,
    lookHeight: 0.8,
    fov: 50,
  },
  tv: {
    height: 7,
    distance: 11,
    xBias: 0.15,
    maxX: 2.5,
    lookAhead: 0,
    lookHeight: 0.6,
    fov: 38,
  },
};

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 250);
    this.mode = 'orbit';
    this.view = 'chase';
    this.orbit = { radius: 26, height: 12, target: new THREE.Vector3(), angle: 0 };
    this._look = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._installViewToggle();
  }

  _installViewToggle() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' && this.mode !== 'orbit') {
        e.preventDefault();
        this.view = this.view === 'chase' ? 'tv' : 'chase';
        const fov = VIEW_CONFIG[this.view].fov;
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    });
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setOrbit(opts) {
    this.mode = 'orbit';
    Object.assign(this.orbit, opts);
  }

  setBroadcast() {
    this.mode = 'chase';
    this.view = 'chase';
    this.camera.fov = VIEW_CONFIG.chase.fov;
    this.camera.updateProjectionMatrix();
  }

  setFollow() { this.setBroadcast(); }

  tickIdle(dt) {
    this.orbit.angle += dt * 0.1;
    const r = this.orbit.radius;
    this.camera.position.set(
      Math.cos(this.orbit.angle) * r,
      this.orbit.height,
      Math.sin(this.orbit.angle) * r * 0.7,
    );
    this.camera.lookAt(this.orbit.target);
  }

  tickBroadcast(targetObj, dt, team) { this.tickChase(targetObj, dt, team); }
  tickFollow(targetObj, dt, team) { this.tickChase(targetObj, dt, team); }

  tickChase(targetObj, dt, team) {
    const c = VIEW_CONFIG[this.view] || VIEW_CONFIG.chase;
    const p = targetObj.position;
    const dir = team === 0 ? 1 : -1;

    // Camera stays behind the player's baseline (between back wall and stands).
    const baselineZ = team === 0 ? HALF_L : -HALF_L;
    const camZ = this.view === 'tv'
      ? baselineZ + dir * c.distance
      : p.z + dir * c.distance;
    const camX = THREE.MathUtils.clamp(p.x * c.xBias, -c.maxX, c.maxX);

    this._desired.set(camX, c.height, camZ);
    const smooth = 1 - Math.exp(-dt * 5);
    this.camera.position.lerp(this._desired, smooth);

    // Look slightly ahead toward the net.
    const lookZ = team === 0 ? Math.max(-HALF_L, p.z - c.lookAhead) : Math.min(HALF_L, p.z + c.lookAhead);
    this._look.set(p.x * 0.4, c.lookHeight, lookZ);
    this.camera.lookAt(this._look);
  }
}

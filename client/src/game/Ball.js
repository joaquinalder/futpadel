/**
 * Ball — classic soccer ball with squash, spin and ground shadow disk.
 */

import * as THREE from 'three';
import { BALL } from '../../../shared/constants.js';
import { ballTexture, ballNormalMap } from './textures.js';

export class Ball {
  constructor() {
    const map = ballTexture();
    const normalMap = ballNormalMap();

    const geom = new THREE.SphereGeometry(BALL.RADIUS, 40, 28);
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.42,
      metalness: 0.02,
      envMapIntensity: 0.55,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL.RADIUS * 1.4, 24),
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.005;

    this._spin = new THREE.Vector3();
    this._lastY = null;
    this._vy = 0;
  }

  tick(dt, state) {
    if (!state) return;

    if (this._lastY === null) {
      this._lastY = state.y;
      return;
    }

    this._vy = (state.y - this._lastY) / Math.max(dt, 0.001);
    this._lastY = state.y;

    const speed = Math.hypot(state.vx, state.vy, state.vz);
    this._spin.x += speed * dt * 2.4;
    this._spin.z += speed * dt * 1.6;
    this.mesh.rotation.x = this._spin.x;
    this.mesh.rotation.z = this._spin.z;

    const squash = THREE.MathUtils.clamp(Math.abs(this._vy) * 0.06, 0, 0.2);
    const sy = 1 - squash * 0.4;
    const sxz = 1 + squash * 0.25;
    this.mesh.scale.set(sxz, sy, sxz);

    this.shadow.position.x = this.mesh.position.x;
    this.shadow.position.z = this.mesh.position.z;
    const heightFactor = THREE.MathUtils.clamp(state.y / 4, 0, 1);
    this.shadow.material.opacity = 0.42 * (1 - heightFactor);
    const shadowScale = 1 + heightFactor * 1.5;
    this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
  }
}

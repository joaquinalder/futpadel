/**
 * Stadium sky dome + PMREM environment for PBR reflections.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class Environment {
  constructor(scene, renderer) {
    this.group = new THREE.Group();
    this._buildSky();
    scene.add(this.group);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.background = null;
    this.envMap = env;
    pmrem.dispose();
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(120, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#0c1a3a') },
        horizonColor: { value: new THREE.Color('#1e3a5f') },
        bottomColor: { value: new THREE.Color('#0f172a') },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y * 0.5 + 0.5;
          vec3 col = h > 0.5
            ? mix(horizonColor, topColor, (h - 0.5) * 2.0)
            : mix(bottomColor, horizonColor, h * 2.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.group.add(new THREE.Mesh(geo, mat));
  }

  dispose() {
    this.group.clear();
    this.envMap?.dispose?.();
  }
}

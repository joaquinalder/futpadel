/**
 * Broadcast stadium — stands, roof, LED boards, floodlights (EA Sports atmosphere).
 */

import * as THREE from 'three';
import { createCanvasTexture } from './textures.js';

export class Stadium {
  constructor(def, scene) {
    this.def = def;
    this.group = new THREE.Group();
    this.lights = [];
    this.build();
    scene.add(this.group);
    for (const l of this.lights) scene.add(l);
  }

  build() {
    const def = this.def;
    const accent = new THREE.Color(def.accent);
    const W = 10;
    const L = 20;

    const standMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.85,
      metalness: 0.15,
    });
    const seatMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.7,
      metalness: 0.1,
    });

    const buildStand = (x, z, rotY, w, d) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      const tiers = 6;
      for (let t = 0; t < tiers; t++) {
        const h = 1.2 + t * 1.1;
        const depth = d + t * 0.8;
        const stand = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), standMat);
        stand.position.set(0, h / 2, -depth / 2);
        stand.castShadow = t === 0;
        stand.receiveShadow = true;
        g.add(stand);

        const seats = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.35, depth * 0.85), seatMat);
        seats.position.set(0, h + 0.15, -depth / 2);
        g.add(seats);
      }
      this.group.add(g);
    };

    buildStand(0, -L / 2 - 14, 0, W + 18, 5);
    buildStand(0, L / 2 + 14, Math.PI, W + 18, 5);
    buildStand(-W / 2 - 12, 0, Math.PI / 2, L + 18, 5);
    buildStand(W / 2 + 12, 0, -Math.PI / 2, L + 18, 5);

    const roofMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      metalness: 0.55,
      roughness: 0.35,
    });
    const roof = new THREE.Mesh(new THREE.TorusGeometry(22, 0.35, 8, 64), roofMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.y = 9.5;
    this.group.add(roof);

    const trussMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 6), trussMat);
      truss.position.set(Math.cos(a) * 18, 4.5, Math.sin(a) * 18);
      truss.rotation.z = Math.atan2(Math.cos(a), 0.3);
      this.group.add(truss);
    }

    const ledTex = createCanvasTexture((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#0f172a');
      g.addColorStop(0.5, def.accent);
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 72px Oswald, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('FUTPADEL', w / 2, h * 0.55);
      ctx.font = '600 28px Oswald, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('LIVE BROADCAST', w / 2, h * 0.78);
    }, { width: 1024, height: 128, key: `led-${def.id}` });

    const ledMat = new THREE.MeshStandardMaterial({
      map: ledTex,
      emissive: accent,
      emissiveIntensity: 0.65,
      roughness: 0.4,
    });
    for (const [x, z, ry] of [[0, -L / 2 - 2.2, 0], [0, L / 2 + 2.2, Math.PI]]) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, 1.2), ledMat);
      board.position.set(x, 5.5, z);
      board.rotation.y = ry;
      this.group.add(board);
    }

    const positions = [
      [-14, 14, -14], [14, 14, -14], [-14, 14, 14], [14, 14, 14],
      [-18, 12, 0], [18, 12, 0],
    ];
    for (const [x, y, z] of positions) {
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.25 }),
      );
      housing.position.set(x, y, z);
      this.group.add(housing);

      const spot = new THREE.SpotLight(0xfff5e6, 2.2, 55, Math.PI / 5, 0.35, 1.2);
      spot.position.set(x, y, z);
      spot.target.position.set(0, 0, 0);
      // Only the first spot casts shadows, at a modest 1024² map — the others
      // are pure illumination. This was previously 2048² which dominated the
      // GPU frame budget.
      spot.castShadow = this.lights.length === 0;
      if (spot.castShadow) {
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0002;
      }
      this.lights.push(spot, spot.target);
    }

    // 220 fans were 220 individual meshes + 220 unique materials, which
    // exploded draw-call count and material upload cost. Rendering them as a
    // single InstancedMesh with per-instance colour collapses everything into
    // one draw call.
    const crowdColors = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f8fafc']
      .map((c) => new THREE.Color(c));
    const FAN_COUNT = 220;
    const bodyGeom = new THREE.BoxGeometry(0.3, 0.75, 0.3);
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    const crowd = new THREE.InstancedMesh(bodyGeom, crowdMat, FAN_COUNT);
    crowd.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const m = new THREE.Matrix4();
    for (let i = 0; i < FAN_COUNT; i++) {
      const tier = Math.floor(Math.random() * 5) + 1;
      const r = 13 + tier * 1.4 + Math.random();
      const a = Math.random() * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * r, 1.5 + tier * 0.9, Math.sin(a) * r);
      crowd.setMatrixAt(i, m);
      crowd.setColorAt(i, crowdColors[Math.floor(Math.random() * crowdColors.length)]);
    }
    crowd.instanceMatrix.needsUpdate = true;
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    this.group.add(crowd);
  }

  dispose() {
    for (const l of this.lights) l.parent?.remove(l);
    this.lights = [];
    this.group.clear();
  }
}

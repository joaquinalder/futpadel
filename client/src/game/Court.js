/**
 * Professional padel court surface — broadcast turf, glass, net.
 * Stadium atmosphere is handled by Stadium.js.
 */

import * as THREE from 'three';
import { COURT } from '../../../shared/constants.js';
import { courtFloorTexture, courtRoughnessMap, netTexture } from './textures.js';

export class Court {
  constructor(def) {
    this.def = def;
    this.group = new THREE.Group();
    this.build();
  }

  build() {
    const W = COURT.WIDTH;
    const L = COURT.LENGTH;
    const wallH = COURT.WALL_HEIGHT;
    const meshH = COURT.MESH_HEIGHT;
    const courtId = this.def.id || 'classic';

    const floorMap = courtFloorTexture(this.def.floor, this.def.accent, courtId);
    const roughMap = courtRoughnessMap(courtId);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorMap,
      roughnessMap: roughMap,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.45,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    this.group.add(floor);

    const lineMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.25,
      metalness: 0.08,
      emissive: '#ffffff',
      emissiveIntensity: 0.15,
    });
    const addLine = (x, z, w, l) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
      g.rotation.x = -Math.PI / 2;
      g.position.set(x, 0.015, z);
      this.group.add(g);
    };

    addLine(0, L / 2 - 0.05, W, 0.09);
    addLine(0, -L / 2 + 0.05, W, 0.09);
    addLine(-W / 2 + 0.04, 0, 0.09, L);
    addLine(W / 2 - 0.04, 0, 0.09, L);
    addLine(0, 0, W, 0.06);
    addLine(0, 3, W, 0.07);
    addLine(0, -3, W, 0.07);
    addLine(0, 1.5, 0.06, 3);
    addLine(0, -1.5, 0.06, 3);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.05,
      roughness: 0,
      metalness: 0,
      transmission: 1,
      thickness: 0.05,
      ior: 1.45,
      attenuationColor: new THREE.Color('#e0f2fe'),
      attenuationDistance: 8,
      envMapIntensity: 1,
      depthWrite: false,
      side: THREE.FrontSide,
      premultipliedAlpha: true,
    });

    const glassEdgeMat = new THREE.LineBasicMaterial({
      color: '#cbd5e1',
      transparent: true,
      opacity: 0.5,
    });

    for (const z of [-L / 2, L / 2]) {
      const wallGeom = new THREE.PlaneGeometry(W, wallH);
      const wall = new THREE.Mesh(wallGeom, glassMat);
      wall.position.set(0, wallH / 2, z);
      wall.rotation.y = z > 0 ? Math.PI : 0;
      wall.renderOrder = 2;
      this.group.add(wall);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(wallGeom),
        glassEdgeMat,
      );
      edges.position.copy(wall.position);
      edges.rotation.copy(wall.rotation);
      this.group.add(edges);
    }

    const frameMat = new THREE.MeshStandardMaterial({
      color: this.def.accent,
      metalness: 0.55,
      roughness: 0.28,
      emissive: new THREE.Color(this.def.accent),
      emissiveIntensity: 0.2,
    });
    for (const z of [-L / 2, L / 2]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.12, 0.2), frameMat);
      frame.position.set(0, wallH, z);
      this.group.add(frame);
    }

    const meshMat = new THREE.LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.5 });
    for (const sx of [-1, 1]) {
      const points = [];
      for (let z = -L / 2; z <= L / 2; z += 0.4) {
        points.push(new THREE.Vector3(sx * W / 2, 0, z));
        points.push(new THREE.Vector3(sx * W / 2, meshH, z));
      }
      this.group.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        meshMat,
      ));
    }

    const netMap = netTexture();
    const netH = COURT.NET_HEIGHT;
    const netMat = new THREE.MeshStandardMaterial({
      map: netMap,
      alphaMap: netMap,
      transparent: true,
      opacity: 0.95,
      color: '#f1f5f9',
      side: THREE.DoubleSide,
      roughness: 0.95,
    });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(W, netH), netMat);
    net.position.set(0, netH / 2, 0);
    this.group.add(net);

    const band = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.07, 0.06),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 0.2,
        roughness: 0.2,
      }),
    );
    band.position.set(0, netH, 0);
    this.group.add(band);

    const postMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.75, roughness: 0.2 });
    for (const x of [-W / 2, W / 2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, netH + 0.15, 10), postMat);
      post.position.set(x, netH / 2, 0);
      this.group.add(post);
    }
  }
}

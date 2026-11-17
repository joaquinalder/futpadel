/**
 * Player — fully procedural humanoid built from primitives, sized to a real
 * 1.70 m height. No external GLB / texture / asset loads; everything is
 * generated in code so the avatar can never end up the wrong scale.
 *
 * Animation is also procedural:
 *   - walk / run: alternating leg + arm swing whose frequency and amplitude
 *     scale with movement speed.
 *   - idle: subtle breathing scale on the torso.
 *   - kick: short forward swing of the right leg, layered on top of locomotion.
 *   - smash: both arms reach up + slight chest tilt.
 *   - header: small upward bob + head tilt forward.
 *
 * Group origin is at the floor between the feet (y=0). The body extends up
 * to y ≈ 1.70 m so it matches PLAYER.HEIGHT in shared/constants.js.
 */

import * as THREE from 'three';

const H = {
  ankle: 0.04,
  legBottom: 0.04,
  legTop: 0.95,          // hip joint height
  pelvis: 1.00,
  waist: 1.05,
  torsoTop: 1.42,
  shoulder: 1.40,
  neck: 1.46,
  chin: 1.55,
  headCenter: 1.60,
  crown: 1.72,
};

const W = {
  // Shoulders need to sit clearly OUTSIDE the torso silhouette, otherwise the
  // arm geometry hides inside the chest mesh. With torsoDepth=0.20 and the
  // torso x-scale 1.25, the torso extends to ±0.238 in X — shoulder at ±0.35
  // gives us a clean 10cm gap on each side for the arm cylinders to be visible.
  shoulder: 0.70,
  hip: 0.30,
  torsoDepth: 0.20,
  armRadius: 0.075,
  legRadius: 0.10,
  headRadius: 0.12,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

export class Player {
  constructor(skinDef, team) {
    this.skin = skinDef;
    this.team = team;
    this.group = new THREE.Group();

    this._kickT = 0;
    this._kickDur = 0.35;
    this._smashT = 0;
    this._smashDur = 0.45;
    this._headerT = 0;
    this._headerDur = 0.30;

    this._prevKick = false;
    this._prevSmash = false;
    this._prevHeader = false;

    this._stridePhase = 0;     // 0..2π
    this._strideSpeed = 0;     // smoothed 0..1
    this._breathT = 0;

    this._build();
  }

  // The Player ctor is sync, but Game.js awaits `load()` — keep the contract.
  async load() { /* nothing async to do */ }

  _build() {
    const skinDef = this.skin;
    const primary = skinDef.primary || '#ef4444';
    const secondary = skinDef.secondary || '#fde68a';
    const skinTone = skinDef.skin || '#e8b896';
    const hair = skinDef.hairColor || '#1c1208';

    const jerseyMat = mat(primary, { roughness: 0.6 });
    const trimMat = mat(secondary, { roughness: 0.55 });
    const shortsMat = mat('#0f172a', { roughness: 0.65 });
    const skinMat = mat(skinTone, { roughness: 0.78 });
    const hairMat = mat(hair, { roughness: 0.85 });
    const shoeMat = mat('#1e293b', { roughness: 0.4, metalness: 0.2 });
    const sockMat = mat('#f8fafc', { roughness: 0.85 });

    // ---- TORSO --------------------------------------------------------------
    // A short capsule = body. Built with two sphere caps + a cylinder.
    const torsoH = H.torsoTop - H.pelvis;
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(W.torsoDepth * 0.95, W.torsoDepth * 0.85, torsoH, 14, 1, true),
      jerseyMat,
    );
    torso.position.y = (H.pelvis + H.torsoTop) / 2;
    torso.scale.set(1.25, 1, 1); // wider across shoulders (X) than depth (Z)
    torso.castShadow = true;
    this.group.add(torso);
    this.torso = torso;

    // Front trim band (jersey accent stripe across the chest).
    const trim = new THREE.Mesh(
      new THREE.CylinderGeometry(W.torsoDepth * 0.96, W.torsoDepth * 0.96, 0.10, 14, 1, true),
      trimMat,
    );
    trim.position.y = H.torsoTop - 0.18;
    trim.scale.set(1.25, 1, 1);
    this.group.add(trim);

    // Jersey number plate on the back.
    const numberCanvas = document.createElement('canvas');
    numberCanvas.width = 128; numberCanvas.height = 128;
    const ctx = numberCanvas.getContext('2d');
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = secondary;
    ctx.font = 'bold 96px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(skinDef.number ?? '0'), 64, 70);
    const numTex = new THREE.CanvasTexture(numberCanvas);
    numTex.colorSpace = THREE.SRGBColorSpace;
    const numberPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.30, 0.30),
      new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.7 }),
    );
    numberPlate.position.set(0, H.pelvis + torsoH * 0.55, -W.torsoDepth * 0.96);
    numberPlate.rotation.y = Math.PI;
    this.group.add(numberPlate);

    // ---- HEAD ---------------------------------------------------------------
    const head = new THREE.Mesh(new THREE.SphereGeometry(W.headRadius, 18, 14), skinMat);
    head.position.y = H.headCenter;
    head.castShadow = true;
    this.group.add(head);
    this.head = head;

    // Hair cap (upper half of head).
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(W.headRadius * 1.03, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat,
    );
    hairCap.position.y = H.headCenter;
    this.group.add(hairCap);

    // Hair style accents.
    if (skinDef.hairStyle === 'afro') {
      hairCap.scale.set(1.25, 1.15, 1.25);
    } else if (skinDef.hairStyle === 'ponytail') {
      const tail = new THREE.Mesh(
        new THREE.SphereGeometry(W.headRadius * 0.55, 12, 10),
        hairMat,
      );
      tail.scale.set(0.7, 1.4, 0.7);
      tail.position.set(0, H.headCenter, -W.headRadius * 0.9);
      this.group.add(tail);
    } else if (skinDef.hairStyle === 'fade') {
      hairCap.scale.set(1.0, 0.7, 1.0);
    }

    // Tiny eye dots so the face has a focal point.
    const eyeMat = mat(skinDef.eyeColor || '#1e293b', { roughness: 0.4 });
    for (const ex of [-0.04, 0.04]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyeMat);
      eye.position.set(ex, H.headCenter + 0.02, W.headRadius * 0.92);
      this.group.add(eye);
    }

    // Neck stub.
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, H.headCenter - W.headRadius - H.torsoTop + 0.02, 10),
      skinMat,
    );
    neck.position.y = (H.torsoTop + H.headCenter - W.headRadius) / 2;
    this.group.add(neck);

    // ---- ARMS ---------------------------------------------------------------
    // Each arm is a small Group whose origin is the shoulder. Inside, we add
    // an upper-arm + forearm + hand all anchored so the group can rotate from
    // the shoulder joint for swing animations.
    this.armL = this._buildArm(jerseyMat, skinMat, +1);
    this.armR = this._buildArm(jerseyMat, skinMat, -1);
    this.armL.position.set(-W.shoulder / 2, H.shoulder, 0);
    this.armR.position.set( W.shoulder / 2, H.shoulder, 0);
    this.group.add(this.armL);
    this.group.add(this.armR);

    // ---- HIPS / SHORTS ------------------------------------------------------
    const hips = new THREE.Mesh(
      new THREE.CylinderGeometry(W.hip * 1.1, W.hip * 0.9, 0.22, 14),
      shortsMat,
    );
    hips.position.y = H.pelvis - 0.05;
    hips.scale.set(1.1, 1, 1);
    this.group.add(hips);

    // ---- LEGS ---------------------------------------------------------------
    this.legL = this._buildLeg(skinMat, shoeMat, sockMat);
    this.legR = this._buildLeg(skinMat, shoeMat, sockMat);
    this.legL.position.set(-W.hip * 0.55, H.legTop, 0);
    this.legR.position.set( W.hip * 0.55, H.legTop, 0);
    this.group.add(this.legL);
    this.group.add(this.legR);

    // ---- LOCAL-PLAYER MARKER -----------------------------------------------
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 40),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.02;
    this.marker.visible = false;
    this.group.add(this.marker);

    // Power arc around the local-player ring. Green = safe, yellow = strong,
    // red = overhit risk. Geometry is rebuilt only while charging.
    this.powerArcMat = new THREE.MeshBasicMaterial({
      color: '#22c55e',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.powerArc = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.92, 36, 1, 0, 0.001), this.powerArcMat);
    this.powerArc.rotation.x = -Math.PI / 2;
    this.powerArc.position.y = 0.035;
    this.powerArc.visible = false;
    this.group.add(this.powerArc);

    // Team ring (team colour halo on the ground, always visible).
    const teamRing = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.85, 40),
      new THREE.MeshBasicMaterial({
        color: this.team === 0 ? '#3b82f6' : '#ef4444',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    teamRing.rotation.x = -Math.PI / 2;
    teamRing.position.y = 0.015;
    this.group.add(teamRing);
  }

  _buildArm(jerseyMat, skinMat) {
    const armGroup = new THREE.Group();
    const upperLen = 0.32;
    const foreLen = 0.30;
    // Upper arm — pivot is at the top (shoulder), so we shift -upperLen/2 down.
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(W.armRadius, W.armRadius * 0.9, upperLen, 10),
      jerseyMat,
    );
    upper.position.y = -upperLen / 2;
    upper.castShadow = true;
    armGroup.add(upper);
    // Forearm (skin)
    const fore = new THREE.Mesh(
      new THREE.CylinderGeometry(W.armRadius * 0.9, W.armRadius * 0.8, foreLen, 10),
      skinMat,
    );
    fore.position.y = -upperLen - foreLen / 2;
    fore.castShadow = true;
    armGroup.add(fore);
    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(W.armRadius * 1.05, 10, 8), skinMat);
    hand.position.y = -upperLen - foreLen - 0.04;
    armGroup.add(hand);
    return armGroup;
  }

  _buildLeg(skinMat, shoeMat, sockMat) {
    const legGroup = new THREE.Group();
    const thighLen = 0.48;
    const shinLen = 0.40;
    // Shorts already cover above the thigh — make thigh skin.
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(W.legRadius * 1.05, W.legRadius * 0.95, thighLen, 12),
      skinMat,
    );
    thigh.position.y = -thighLen / 2;
    thigh.castShadow = true;
    legGroup.add(thigh);
    // Knee
    const knee = new THREE.Mesh(new THREE.SphereGeometry(W.legRadius * 1.05, 10, 8), skinMat);
    knee.position.y = -thighLen;
    legGroup.add(knee);
    // Shin (sock)
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(W.legRadius * 0.95, W.legRadius * 0.85, shinLen, 12),
      sockMat,
    );
    shin.position.y = -thighLen - shinLen / 2;
    shin.castShadow = true;
    legGroup.add(shin);
    // Shoe
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.30), shoeMat);
    shoe.position.set(0, -thighLen - shinLen - 0.04, 0.05);
    shoe.castShadow = true;
    legGroup.add(shoe);
    return legGroup;
  }

  setName(name) {
    this.name = name;
    // (Name label sprite skipped to avoid font texture overhead.)
  }

  markLocal() {
    if (this.marker) this.marker.visible = true;
  }

  setPower(power = 0, charging = false) {
    if (!this.powerArc) return;
    const p = Math.max(0, Math.min(1, power));
    this.powerArc.visible = charging || p > 0.02;

    if (p < 0.55) this.powerArcMat.color.set('#22c55e');
    else if (p < 0.82) this.powerArcMat.color.set('#facc15');
    else this.powerArcMat.color.set('#ef4444');

    this.powerArc.geometry.dispose();
    const theta = Math.max(0.001, p * Math.PI * 2);
    // Starts at top (-90°) and fills clockwise.
    this.powerArc.geometry = new THREE.RingGeometry(0.78, 0.92, 48, 1, -Math.PI / 2, theta);
  }

  /**
   * @param dt seconds since last frame
   * @param info { speed, inKick, inSmash, inHeader }
   */
  tickAnim(dt, info = {}) {
    const speed = info.speed || 0;
    const inKick = !!info.inKick;
    const inSmash = !!info.inSmash;
    const inHeader = !!info.inHeader;

    // Trigger animations on rising edge.
    if (inKick && !this._prevKick) this._kickT = this._kickDur;
    if (inSmash && !this._prevSmash) this._smashT = this._smashDur;
    if (inHeader && !this._prevHeader) this._headerT = this._headerDur;
    this._prevKick = inKick;
    this._prevSmash = inSmash;
    this._prevHeader = inHeader;

    // Smooth target stride intensity (0 idle, 1 sprint at RUN_SPEED=5).
    const target = Math.min(1, speed / 5.0);
    this._strideSpeed += (target - this._strideSpeed) * Math.min(1, dt * 8);
    // Cycle frequency — 1.6 Hz at sprint (natural human cadence ~2 steps/sec).
    const freq = 0.8 + this._strideSpeed * 1.8;
    this._stridePhase += dt * freq * Math.PI * 2;

    // Natural human stride: legs swing ~25°, arms ~30°. Larger amplitudes look
    // cartoony / Wii Sports. We also stop arms from clipping the torso by
    // offsetting them slightly outward when they swing forward.
    const swing = this._strideSpeed * 0.5;        // ~28° peak
    const armSwing = this._strideSpeed * 0.55;    // ~31° peak
    const s = Math.sin(this._stridePhase);

    this.legL.rotation.x =  s * swing;
    this.legR.rotation.x = -s * swing;
    this.armL.rotation.x = -s * armSwing;
    this.armR.rotation.x =  s * armSwing;

    // Subtle vertical bob (heel-strike). Half of what it was previously.
    this.group.position.y = Math.abs(s) * this._strideSpeed * 0.02;

    // Breathing on idle.
    this._breathT += dt;
    if (this._strideSpeed < 0.1) {
      const breath = 1 + Math.sin(this._breathT * 1.6) * 0.015;
      this.torso.scale.set(1.25, breath, 1);
    } else {
      this.torso.scale.set(1.25, 1, 1);
    }

    // ---- Procedural shot overlays ------------------------------------------
    // Kick: right leg swings forward (negative X rotation), then back.
    if (this._kickT > 0) {
      this._kickT = Math.max(0, this._kickT - dt);
      const t = 1 - this._kickT / this._kickDur;        // 0 → 1
      const kick = Math.sin(t * Math.PI) * 1.4;          // bell curve
      this.legR.rotation.x -= kick;
    }

    // Smash: both arms up, chest tilted back, then forward.
    if (this._smashT > 0) {
      this._smashT = Math.max(0, this._smashT - dt);
      const t = 1 - this._smashT / this._smashDur;
      const lift = Math.sin(t * Math.PI);
      this.armL.rotation.x -= lift * 2.4;
      this.armR.rotation.x -= lift * 2.4;
      this.torso.rotation.x = -lift * 0.25;
      this.head.position.y = H.headCenter + lift * 0.05;
    } else {
      this.torso.rotation.x = 0;
      this.head.position.y = H.headCenter;
    }

    // Header: small forward head dip + tiny jump.
    if (this._headerT > 0) {
      this._headerT = Math.max(0, this._headerT - dt);
      const t = 1 - this._headerT / this._headerDur;
      const dip = Math.sin(t * Math.PI);
      this.head.rotation.x = dip * 0.6;
      this.group.position.y += dip * 0.12;
    } else {
      this.head.rotation.x = 0;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
      else m?.dispose?.();
    });
    this.powerArc?.geometry?.dispose?.();
    this.powerArc?.material?.dispose?.();
    this.group.clear();
  }
}

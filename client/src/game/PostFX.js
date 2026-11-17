/**
 * Broadcast post-processing — bloom, contrast, saturation, vignette (EA Sports TV look).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1.12 },
    contrast: { value: 1.08 },
    saturation: { value: 1.22 },
    vignette: { value: 0.38 },
    warmth: { value: 0.04 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float exposure;
    uniform float contrast;
    uniform float saturation;
    uniform float vignette;
    uniform float warmth;
    varying vec2 vUv;

    vec3 adjustSaturation(vec3 c, float s) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(l), c, s);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb * exposure;
      c += vec3(warmth, warmth * 0.5, 0.0);
      c = (c - 0.5) * contrast + 0.5;
      c = adjustSaturation(c, saturation);
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));

      vec2 uv = vUv * 2.0 - 1.0;
      float vig = 1.0 - dot(uv, uv) * vignette;
      c *= clamp(vig, 0.0, 1.0);

      gl_FragColor = vec4(c, tex.a);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const size = renderer.getSize(new THREE.Vector2());
    this.bloom = new UnrealBloomPass(size, 0.42, 0.55, 0.82);
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(ColorGradeShader);
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}

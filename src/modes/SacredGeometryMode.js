import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uLayers;
  uniform float uGlow;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform vec2 uResolution;

  #define PI 3.14159265359

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  float sdLine(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  mat2 rotate2d(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  float flowerOfLife(vec2 uv, float scale, float rotation) {
    uv *= scale;
    uv = rotate2d(rotation) * uv;

    float d = 1.0;
    float r = 0.3;

    // Center circle
    d = min(d, abs(sdCircle(uv, r)));

    // Six surrounding circles
    for (float i = 0.0; i < 6.0; i++) {
      float angle = i * PI / 3.0;
      vec2 offset = vec2(cos(angle), sin(angle)) * r * 2.0;
      d = min(d, abs(sdCircle(uv - offset, r)));
    }

    // Second ring of circles
    for (float i = 0.0; i < 6.0; i++) {
      float angle = i * PI / 3.0 + PI / 6.0;
      vec2 offset = vec2(cos(angle), sin(angle)) * r * 3.464; // sqrt(12)
      d = min(d, abs(sdCircle(uv - offset, r)));
    }

    // Third ring
    for (float i = 0.0; i < 12.0; i++) {
      float angle = i * PI / 6.0;
      vec2 offset = vec2(cos(angle), sin(angle)) * r * 4.0;
      d = min(d, abs(sdCircle(uv - offset, r)));
    }

    return d;
  }

  float metatronsCube(vec2 uv, float scale, float rotation) {
    uv *= scale;
    uv = rotate2d(rotation) * uv;

    float d = 1.0;

    // Inner hexagon vertices
    vec2 innerPoints[6];
    for (int i = 0; i < 6; i++) {
      float angle = float(i) * PI / 3.0;
      innerPoints[i] = vec2(cos(angle), sin(angle)) * 0.3;
    }

    // Outer hexagon vertices
    vec2 outerPoints[6];
    for (int i = 0; i < 6; i++) {
      float angle = float(i) * PI / 3.0 + PI / 6.0;
      outerPoints[i] = vec2(cos(angle), sin(angle)) * 0.52;
    }

    // Center point
    d = min(d, abs(sdCircle(uv, 0.02)));

    // Draw circles at each vertex
    for (int i = 0; i < 6; i++) {
      d = min(d, abs(sdCircle(uv - innerPoints[i], 0.02)));
      d = min(d, abs(sdCircle(uv - outerPoints[i], 0.02)));
    }

    // Connect all points with lines
    for (int i = 0; i < 6; i++) {
      for (int j = 0; j < 6; j++) {
        d = min(d, sdLine(uv, innerPoints[i], innerPoints[j]));
        d = min(d, sdLine(uv, innerPoints[i], outerPoints[j]));
        d = min(d, sdLine(uv, outerPoints[i], outerPoints[j]));
      }
      // Connect to center
      d = min(d, sdLine(uv, vec2(0.0), innerPoints[i]));
    }

    return d;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
    float t = uTime * uSpeed;

    vec3 color = vec3(0.0);
    float audioScale = 1.0 + uAudioBass * 0.3;

    // Multiple rotating layers
    for (float i = 0.0; i < 4.0; i++) {
      if (i >= uLayers) break;

      float layerScale = 1.5 + i * 0.5;
      float rotation = t * (0.1 + i * 0.05) * (mod(i, 2.0) == 0.0 ? 1.0 : -1.0);
      rotation += uAudioMid * 0.5;

      float d;
      if (mod(i, 2.0) == 0.0) {
        d = flowerOfLife(uv, layerScale * audioScale, rotation);
      } else {
        d = metatronsCube(uv, layerScale * audioScale, rotation);
      }

      // Glow effect
      float glow = uGlow * 0.01 / (d + 0.01);

      // Color per layer
      float hue = fract(0.6 + i * 0.15 + t * 0.02);
      vec3 layerColor = hsv2rgb(vec3(hue, 0.7, 1.0));

      color += layerColor * glow * (1.0 - i * 0.2);
    }

    // Add subtle background
    color += vec3(0.02, 0.0, 0.04);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class SacredGeometryMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 0.3,
      layers: 4,
      glow: 1.0
    };

    this.uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: this.params.speed },
      uLayers: { value: this.params.layers },
      uGlow: { value: this.params.glow },
      uAudioBass: { value: 0 },
      uAudioMid: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  update(delta, elapsed, audioData) {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uSpeed.value = this.params.speed;
    this.uniforms.uLayers.value = this.params.layers;
    this.uniforms.uGlow.value = this.params.glow;

    if (audioData) {
      this.uniforms.uAudioBass.value += (audioData.bass - this.uniforms.uAudioBass.value) * 0.15;
      this.uniforms.uAudioMid.value += (audioData.mid - this.uniforms.uAudioMid.value) * 0.15;
    } else {
      this.uniforms.uAudioBass.value *= 0.95;
      this.uniforms.uAudioMid.value *= 0.95;
    }
  }

  onResize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }

  setupGUI(folder) {
    folder.add(this.params, 'speed', 0.1, 1.0).name('Rotation Speed');
    folder.add(this.params, 'layers', 1, 4).step(1).name('Layers');
    folder.add(this.params, 'glow', 0.2, 3.0).name('Glow');
  }
}

import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uScale;
  uniform float uSpeed;
  uniform float uComplexity;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform vec2 uResolution;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution * uScale;
    float t = uTime * uSpeed;

    float audioBoost = 1.0 + uAudioBass * 0.5;

    // Classic plasma formula with multiple sine waves
    float v = 0.0;

    v += sin((uv.x + t) * uComplexity);
    v += sin((uv.y + t) * uComplexity * 0.5);
    v += sin((uv.x + uv.y + t) * uComplexity * 0.7);

    float cx = uv.x + 0.5 * sin(t * 0.3) * audioBoost;
    float cy = uv.y + 0.5 * cos(t * 0.4) * audioBoost;
    v += sin(sqrt((cx * cx + cy * cy + 1.0) * uComplexity) + t);

    v += sin(sqrt(uv.x * uv.x + uv.y * uv.y) * uComplexity - t);

    // Second layer
    vec2 uv2 = uv + vec2(sin(t * 0.1), cos(t * 0.15)) * 2.0;
    v += sin(uv2.x * uComplexity * 0.3 + t) * 0.5;
    v += sin(uv2.y * uComplexity * 0.4 + t * 1.1) * 0.5;

    v *= 0.5;

    // Color cycling
    float hue = fract(v * 0.5 + uTime * 0.02 + uAudioMid * 0.2);
    float sat = 0.8;
    float val = 0.5 + 0.5 * sin(v * 3.14159);

    vec3 color = hsv2rgb(vec3(hue, sat, val));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class PlasmaMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      scale: 5.0,
      speed: 1.0,
      complexity: 3.0
    };

    this.uniforms = {
      uTime: { value: 0 },
      uScale: { value: this.params.scale },
      uSpeed: { value: this.params.speed },
      uComplexity: { value: this.params.complexity },
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
    this.uniforms.uScale.value = this.params.scale;
    this.uniforms.uSpeed.value = this.params.speed;
    this.uniforms.uComplexity.value = this.params.complexity;

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
    folder.add(this.params, 'scale', 1, 15).name('Scale');
    folder.add(this.params, 'speed', 0.1, 3).name('Speed');
    folder.add(this.params, 'complexity', 1, 8).name('Complexity');
  }
}

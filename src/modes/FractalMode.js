import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform float uAudioTreble;
  uniform float uSpeed;
  uniform float uComplexity;
  uniform float uColorShift;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  varying vec2 vUv;

  vec3 palette(float t) {
    return uColor1 + uColor2 * cos(6.28318 * (uColor3 * t + uColorShift));
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);

    float audioInfluence = 1.0 + uAudioBass * 0.5;

    for (float i = 0.0; i < 4.0; i++) {
      uv = fract(uv * (1.5 + uComplexity * 0.5)) - 0.5;

      float d = length(uv) * exp(-length(uv0));

      vec3 col = palette(length(uv0) + i * 0.4 + uTime * uSpeed * 0.4);

      d = sin(d * (8.0 + uAudioMid * 4.0) + uTime * uSpeed) / 8.0;
      d = abs(d);
      d = pow(0.01 / d, 1.2) * audioInfluence;

      finalColor += col * d;
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class FractalMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 0.5,
      complexity: 1.0,
      colorShift: 0.0,
      color1: '#5080ff',
      color2: '#80ff50',
      color3: '#ff5080'
    };

    // Fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);

    this.uniforms = {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioMid: { value: 0 },
      uAudioTreble: { value: 0 },
      uSpeed: { value: this.params.speed },
      uComplexity: { value: this.params.complexity },
      uColorShift: { value: this.params.colorShift },
      uColor1: { value: new THREE.Color(this.params.color1) },
      uColor2: { value: new THREE.Color(this.params.color2) },
      uColor3: { value: new THREE.Color(this.params.color3) }
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Use orthographic camera for fullscreen shader
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  update(delta, elapsed, audioData) {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uSpeed.value = this.params.speed;
    this.uniforms.uComplexity.value = this.params.complexity;
    this.uniforms.uColorShift.value = this.params.colorShift;

    // Update colors from GUI
    this.uniforms.uColor1.value.set(this.params.color1);
    this.uniforms.uColor2.value.set(this.params.color2);
    this.uniforms.uColor3.value.set(this.params.color3);

    if (audioData) {
      // Smooth audio values
      this.uniforms.uAudioBass.value += (audioData.bass - this.uniforms.uAudioBass.value) * 0.1;
      this.uniforms.uAudioMid.value += (audioData.mid - this.uniforms.uAudioMid.value) * 0.1;
      this.uniforms.uAudioTreble.value += (audioData.treble - this.uniforms.uAudioTreble.value) * 0.1;
    } else {
      this.uniforms.uAudioBass.value *= 0.95;
      this.uniforms.uAudioMid.value *= 0.95;
      this.uniforms.uAudioTreble.value *= 0.95;
    }
  }

  setupGUI(folder) {
    folder.add(this.params, 'speed', 0.1, 2.0).name('Speed');
    folder.add(this.params, 'complexity', 0.5, 3.0).name('Complexity');
    folder.add(this.params, 'colorShift', 0, 1).name('Color Shift');
    folder.addColor(this.params, 'color1').name('Color 1');
    folder.addColor(this.params, 'color2').name('Color 2');
    folder.addColor(this.params, 'color3').name('Color 3');
  }

  onResize() {
    // Orthographic camera doesn't need aspect ratio updates for fullscreen quad
  }
}

import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uTwist;
  uniform float uColorSpeed;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform vec2 uResolution;

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

    // Convert to polar coordinates
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Tunnel effect - inverse radius gives depth
    float depth = 1.0 / (radius + 0.1);

    // Twist based on depth
    float twist = angle + depth * uTwist + uTime * 0.2;

    // Moving through tunnel
    float z = depth + uTime * uSpeed * (1.0 + uAudioBass * 0.5);

    // Create pattern on tunnel walls
    float pattern = sin(twist * 6.0) * cos(z * 3.0);
    pattern += sin(twist * 3.0 + z * 2.0) * 0.5;

    // Color based on angle and depth
    vec3 color;
    float hue = fract(angle / 6.28318 + uTime * uColorSpeed + uAudioMid * 0.3);

    // HSV to RGB
    vec3 c = vec3(hue, 0.8, 0.9);
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    color = c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);

    // Apply pattern
    color *= 0.5 + 0.5 * pattern;

    // Darken edges (vignette)
    color *= smoothstep(0.0, 0.3, radius);

    // Glow in center
    color += vec3(0.1, 0.05, 0.2) * (1.0 - smoothstep(0.0, 0.15, radius));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class TunnelMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 1.0,
      twist: 0.5,
      colorSpeed: 0.1
    };

    this.uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: this.params.speed },
      uTwist: { value: this.params.twist },
      uColorSpeed: { value: this.params.colorSpeed },
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
    this.uniforms.uTwist.value = this.params.twist;
    this.uniforms.uColorSpeed.value = this.params.colorSpeed;

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
    folder.add(this.params, 'speed', 0.1, 3.0).name('Speed');
    folder.add(this.params, 'twist', 0, 2.0).name('Twist');
    folder.add(this.params, 'colorSpeed', 0, 0.5).name('Color Cycle');
  }
}

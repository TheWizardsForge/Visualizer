import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uSegments;
  uniform float uZoom;
  uniform float uRotation;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform float uAudioTreble;
  uniform vec2 uResolution;

  #define PI 3.14159265359

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

    // Polar coordinates
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Kaleidoscope fold
    float segments = uSegments;
    float segmentAngle = PI * 2.0 / segments;
    angle = mod(angle, segmentAngle);
    angle = abs(angle - segmentAngle * 0.5);

    // Rotate over time
    angle += uTime * uRotation + uAudioBass * 0.5;

    // Back to cartesian
    vec2 p = vec2(cos(angle), sin(angle)) * radius;

    // Zoom and offset
    p *= uZoom * (1.0 + uAudioMid * 0.3);
    p += vec2(uTime * 0.1, uTime * 0.15);

    // Create interesting pattern
    float pattern = 0.0;
    for (float i = 1.0; i < 5.0; i++) {
      p = abs(p) / dot(p, p) - 0.8;
      pattern += sin(p.x * i + uTime) * cos(p.y * i + uTime * 0.7);
    }

    // Color
    float hue = fract(pattern * 0.1 + uTime * 0.05 + radius * 0.3);
    float sat = 0.7 + 0.3 * sin(pattern);
    float val = 0.6 + 0.4 * cos(pattern * 0.5);

    vec3 color = hsv2rgb(vec3(hue, sat, val));

    // Audio glow
    color += vec3(0.1, 0.0, 0.15) * uAudioTreble * 2.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class KaleidoscopeMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      segments: 8,
      zoom: 2.0,
      rotation: 0.1
    };

    this.uniforms = {
      uTime: { value: 0 },
      uSegments: { value: this.params.segments },
      uZoom: { value: this.params.zoom },
      uRotation: { value: this.params.rotation },
      uAudioBass: { value: 0 },
      uAudioMid: { value: 0 },
      uAudioTreble: { value: 0 },
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
    this.uniforms.uSegments.value = this.params.segments;
    this.uniforms.uZoom.value = this.params.zoom;
    this.uniforms.uRotation.value = this.params.rotation;

    if (audioData) {
      this.uniforms.uAudioBass.value += (audioData.bass - this.uniforms.uAudioBass.value) * 0.15;
      this.uniforms.uAudioMid.value += (audioData.mid - this.uniforms.uAudioMid.value) * 0.15;
      this.uniforms.uAudioTreble.value += (audioData.treble - this.uniforms.uAudioTreble.value) * 0.15;
    } else {
      this.uniforms.uAudioBass.value *= 0.95;
      this.uniforms.uAudioMid.value *= 0.95;
      this.uniforms.uAudioTreble.value *= 0.95;
    }
  }

  onResize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }

  setupGUI(folder) {
    folder.add(this.params, 'segments', 3, 16).step(1).name('Segments');
    folder.add(this.params, 'zoom', 0.5, 5.0).name('Zoom');
    folder.add(this.params, 'rotation', 0, 0.5).name('Rotation');
  }
}

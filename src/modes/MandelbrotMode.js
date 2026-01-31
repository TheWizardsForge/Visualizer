import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uZoom;
  uniform vec2 uCenter;
  uniform float uMaxIter;
  uniform float uColorSpeed;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform vec2 uResolution;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

    // Apply zoom (exponential for smooth infinite zoom)
    float zoom = exp(uZoom);
    vec2 c = uv / zoom + uCenter;

    // Mandelbrot iteration
    vec2 z = vec2(0.0);
    float iter = 0.0;
    float maxIter = uMaxIter;

    for (float i = 0.0; i < 500.0; i++) {
      if (i >= maxIter) break;

      // z = z^2 + c
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

      if (dot(z, z) > 4.0) {
        iter = i;
        break;
      }
      iter = i;
    }

    // Smooth coloring using escape angle
    float smoothIter = iter;
    if (iter < maxIter - 1.0) {
      float log_zn = log(dot(z, z)) / 2.0;
      float nu = log(log_zn / log(2.0)) / log(2.0);
      smoothIter = iter + 1.0 - nu;
    }

    // Color based on iteration count
    vec3 color;
    if (iter >= maxIter - 1.0) {
      // Inside the set - make it pulse with audio
      color = vec3(0.02, 0.0, 0.05) * (1.0 + uAudioBass * 2.0);
    } else {
      // Outside - psychedelic coloring
      float hue = fract(smoothIter * 0.02 + uTime * uColorSpeed + uAudioMid * 0.3);
      float sat = 0.8 + 0.2 * sin(smoothIter * 0.1);
      float val = 0.9;
      color = hsv2rgb(vec3(hue, sat, val));

      // Add some variation
      color *= 0.8 + 0.2 * sin(smoothIter * 0.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class MandelbrotMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      autoZoom: true,
      zoomSpeed: 0.3,
      colorSpeed: 0.05,
      maxIter: 150,
      centerX: -0.745,
      centerY: 0.186
    };

    this.zoom = 0;

    // Interesting points to zoom into
    this.targets = [
      { x: -0.745, y: 0.186 },      // Seahorse valley
      { x: -0.235125, y: 0.827215 }, // Spiral
      { x: -1.25066, y: 0.02012 },   // Elephant valley
      { x: -0.748, y: 0.1 },         // Another seahorse
      { x: 0.282, y: 0.01 }          // Lightning
    ];
    this.currentTarget = 0;

    this.uniforms = {
      uTime: { value: 0 },
      uZoom: { value: 0 },
      uCenter: { value: new THREE.Vector2(this.params.centerX, this.params.centerY) },
      uMaxIter: { value: this.params.maxIter },
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
    this.uniforms.uMaxIter.value = this.params.maxIter;
    this.uniforms.uColorSpeed.value = this.params.colorSpeed;

    if (this.params.autoZoom) {
      this.zoom += delta * this.params.zoomSpeed;

      // Reset zoom and change target after zooming in far enough
      if (this.zoom > 12) {
        this.zoom = 0;
        this.currentTarget = (this.currentTarget + 1) % this.targets.length;
        const target = this.targets[this.currentTarget];
        this.params.centerX = target.x;
        this.params.centerY = target.y;
      }
    }

    this.uniforms.uZoom.value = this.zoom;
    this.uniforms.uCenter.value.set(this.params.centerX, this.params.centerY);

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
    folder.add(this.params, 'autoZoom').name('Auto Zoom');
    folder.add(this.params, 'zoomSpeed', 0.1, 1.0).name('Zoom Speed');
    folder.add(this.params, 'colorSpeed', 0, 0.2).name('Color Cycle');
    folder.add(this.params, 'maxIter', 50, 300).step(10).name('Detail');
    folder.add(this, 'nextTarget').name('Next Location');
  }

  nextTarget() {
    this.zoom = 0;
    this.currentTarget = (this.currentTarget + 1) % this.targets.length;
    const target = this.targets[this.currentTarget];
    this.params.centerX = target.x;
    this.params.centerY = target.y;
  }
}

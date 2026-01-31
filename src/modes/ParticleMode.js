import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

export class ParticleMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      particleCount: 5000,
      particleSize: 2.0,
      rotationSpeed: 0.1,
      colorHue: 0.6,
      spread: 50,
      pulseStrength: 1.0
    };

    this.camera.position.z = 100;

    this.createParticles();
  }

  createParticles() {
    // Remove existing particles if any
    if (this.particles) {
      this.scene.remove(this.particles);
      this.geometry?.dispose();
      this.material?.dispose();
    }

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.params.particleCount * 3);
    const colors = new Float32Array(this.params.particleCount * 3);
    const sizes = new Float32Array(this.params.particleCount);
    const randoms = new Float32Array(this.params.particleCount);

    for (let i = 0; i < this.params.particleCount; i++) {
      const i3 = i * 3;

      // Spiral galaxy distribution
      const radius = Math.random() * this.params.spread;
      const spinAngle = radius * 0.5;
      const branchAngle = (i % 3) * ((Math.PI * 2) / 3);

      const randomX = (Math.random() - 0.5) * radius * 0.3;
      const randomY = (Math.random() - 0.5) * radius * 0.3;
      const randomZ = (Math.random() - 0.5) * radius * 0.3;

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      // Colors based on distance from center
      const color = new THREE.Color();
      color.setHSL(this.params.colorHue + radius / this.params.spread * 0.2, 0.8, 0.6);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * this.params.particleSize;
      randoms[i] = Math.random();
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
        uAudioOverall: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uPulseStrength: { value: this.params.pulseStrength }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uAudioBass;
        uniform float uAudioOverall;
        uniform float uPixelRatio;
        uniform float uPulseStrength;

        attribute float size;
        attribute vec3 aColor;

        varying vec3 vColor;

        void main() {
          vColor = aColor;

          vec3 pos = position;

          // Pulse with audio
          float pulse = 1.0 + uAudioBass * uPulseStrength * 0.5;
          pos *= pulse;

          // Gentle wave motion
          pos.y += sin(uTime * 0.5 + pos.x * 0.05) * 2.0;
          pos.x += cos(uTime * 0.3 + pos.z * 0.05) * 2.0;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
          gl_PointSize *= (1.0 + uAudioOverall * 0.5);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vColor;

        void main() {
          // Circular particle with soft edge
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particles);
  }

  update(delta, elapsed, audioData) {
    if (!this.particles) return;

    this.material.uniforms.uTime.value = elapsed;

    // Rotate the whole particle system
    this.particles.rotation.y += delta * this.params.rotationSpeed;

    if (audioData) {
      this.material.uniforms.uAudioBass.value += (audioData.bass - this.material.uniforms.uAudioBass.value) * 0.1;
      this.material.uniforms.uAudioOverall.value += (audioData.overall - this.material.uniforms.uAudioOverall.value) * 0.1;
    } else {
      this.material.uniforms.uAudioBass.value *= 0.95;
      this.material.uniforms.uAudioOverall.value *= 0.95;
    }

    this.material.uniforms.uPulseStrength.value = this.params.pulseStrength;
  }

  setupGUI(folder) {
    folder.add(this.params, 'rotationSpeed', 0, 0.5).name('Rotation Speed');
    folder.add(this.params, 'particleSize', 0.5, 5).name('Particle Size').onChange(() => this.createParticles());
    folder.add(this.params, 'colorHue', 0, 1).name('Color Hue').onChange(() => this.createParticles());
    folder.add(this.params, 'spread', 20, 100).name('Spread').onChange(() => this.createParticles());
    folder.add(this.params, 'pulseStrength', 0, 3).name('Audio Pulse');
  }
}

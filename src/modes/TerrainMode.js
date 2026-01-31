import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

export class TerrainMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 1.0,
      wireframe: true,
      colorShift: 0.0,
      waveHeight: 1.0
    };

    // Setup camera for flyover view
    this.camera.position.set(0, 3, 5);
    this.camera.lookAt(0, 0, -10);
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();

    // Create terrain mesh
    this.createTerrain();

    // Add fog for depth
    this.scene.fog = new THREE.FogExp2(0x000011, 0.05);
    this.scene.background = new THREE.Color(0x000011);
  }

  createTerrain() {
    const geometry = new THREE.PlaneGeometry(40, 80, 100, 200);
    geometry.rotateX(-Math.PI / 2.5);

    this.geometry = geometry;
    this.originalPositions = geometry.attributes.position.array.slice();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorShift: { value: 0 },
        uAudioBass: { value: 0 },
        uAudioMid: { value: 0 }
      },
      vertexShader: `
        varying float vElevation;
        varying vec3 vPosition;

        void main() {
          vElevation = position.y;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uColorShift;
        uniform float uAudioBass;
        uniform float uAudioMid;

        varying float vElevation;
        varying vec3 vPosition;

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          float elevation = vElevation;

          // Color based on height
          float hue = fract(0.7 + elevation * 0.1 + uColorShift + uAudioMid * 0.2);
          float sat = 0.8;
          float val = 0.3 + elevation * 0.3 + uAudioBass * 0.3;

          vec3 color = hsv2rgb(vec3(hue, sat, val));

          // Grid lines
          float grid = 0.0;
          grid += step(0.95, fract(vPosition.x * 0.5));
          grid += step(0.95, fract(vPosition.z * 0.5));
          color += vec3(0.1, 0.3, 0.5) * grid;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      wireframe: this.params.wireframe,
      side: THREE.DoubleSide
    });

    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = -20;
    this.scene.add(this.mesh);
  }

  update(delta, elapsed, audioData) {
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uColorShift.value = this.params.colorShift;
    this.material.wireframe = this.params.wireframe;

    // Scroll terrain
    const scrollSpeed = this.params.speed * delta * 5;
    this.mesh.position.z += scrollSpeed;
    if (this.mesh.position.z > 10) {
      this.mesh.position.z = -20;
    }

    // Animate terrain heights
    const positions = this.geometry.attributes.position.array;
    const time = elapsed * 0.5;

    let audioBoost = 1.0;
    if (audioData) {
      audioBoost = 1.0 + audioData.bass * this.params.waveHeight;
      this.material.uniforms.uAudioBass.value += (audioData.bass - this.material.uniforms.uAudioBass.value) * 0.15;
      this.material.uniforms.uAudioMid.value += (audioData.mid - this.material.uniforms.uAudioMid.value) * 0.15;
    } else {
      this.material.uniforms.uAudioBass.value *= 0.95;
      this.material.uniforms.uAudioMid.value *= 0.95;
    }

    for (let i = 0; i < positions.length; i += 3) {
      const x = this.originalPositions[i];
      const z = this.originalPositions[i + 2];

      // Layered noise for terrain
      let height = 0;
      height += Math.sin(x * 0.3 + time) * Math.cos(z * 0.2 + time * 0.5) * 1.5;
      height += Math.sin(x * 0.7 + time * 1.3) * Math.cos(z * 0.5 + time * 0.3) * 0.5;
      height += Math.sin(x * 1.5 + z * 1.5 + time * 2.0) * 0.2;

      positions[i + 1] = height * this.params.waveHeight * audioBoost;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  setupGUI(folder) {
    folder.add(this.params, 'speed', 0.1, 3.0).name('Speed');
    folder.add(this.params, 'wireframe').name('Wireframe');
    folder.add(this.params, 'colorShift', 0, 1).name('Color Shift');
    folder.add(this.params, 'waveHeight', 0.2, 3.0).name('Wave Height');
  }
}

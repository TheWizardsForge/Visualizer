import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uWaveCount;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform float uAudioTreble;
  uniform vec2 uResolution;

  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float t = uTime * uSpeed;

    // Sky gradient (dark blue to black)
    vec3 skyColor = mix(vec3(0.0, 0.0, 0.02), vec3(0.0, 0.02, 0.08), uv.y);

    // Aurora layers
    vec3 aurora = vec3(0.0);
    float audioBoost = 1.0 + uAudioBass * 0.5;

    for (float i = 0.0; i < 4.0; i++) {
      float offset = i * 0.15;
      float speed = (1.0 + i * 0.2) * t;

      // Wave pattern
      float wave = 0.0;
      for (float j = 0.0; j < 3.0; j++) {
        float freq = uWaveCount * (1.0 + j * 0.5);
        wave += sin(uv.x * freq + speed + j + uAudioMid * 2.0) * (0.5 / (j + 1.0));
      }

      // Noise for organic movement
      float noise = snoise(vec2(uv.x * 2.0 + speed * 0.3, i + t * 0.1)) * 0.2;

      // Vertical position of this aurora band
      float bandY = 0.3 + offset + wave * 0.15 * audioBoost + noise;

      // Aurora intensity based on distance from band
      float dist = abs(uv.y - bandY);
      float intensity = exp(-dist * 8.0) * uIntensity;

      // Color varies by layer and position
      vec3 auroraColor;
      float hue = 0.3 + i * 0.1 + uv.x * 0.1 + uAudioTreble * 0.2; // Green to cyan
      if (i > 1.0) hue = 0.8 + uv.x * 0.1; // Purple/pink for upper layers

      auroraColor = vec3(
        0.2 + 0.8 * sin(hue * 6.28),
        0.8 - 0.3 * i * 0.25,
        0.3 + 0.7 * cos(hue * 6.28)
      );

      aurora += auroraColor * intensity * (1.0 - i * 0.15);
    }

    // Stars
    vec2 starUV = uv * 100.0;
    float stars = step(0.998, fract(sin(dot(floor(starUV), vec2(12.9898, 78.233))) * 43758.5453));
    stars *= smoothstep(0.3, 0.8, uv.y); // More stars at top

    vec3 finalColor = skyColor + aurora + vec3(stars) * 0.5;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class AuroraMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 0.3,
      intensity: 1.5,
      waveCount: 3.0
    };

    this.uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: this.params.speed },
      uIntensity: { value: this.params.intensity },
      uWaveCount: { value: this.params.waveCount },
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
    this.uniforms.uSpeed.value = this.params.speed;
    this.uniforms.uIntensity.value = this.params.intensity;
    this.uniforms.uWaveCount.value = this.params.waveCount;

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
    folder.add(this.params, 'speed', 0.1, 1.0).name('Speed');
    folder.add(this.params, 'intensity', 0.5, 3.0).name('Intensity');
    folder.add(this.params, 'waveCount', 1, 8).name('Wave Count');
  }
}

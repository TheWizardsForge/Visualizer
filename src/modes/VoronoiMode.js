import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uCellCount;
  uniform float uEdgeWidth;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform vec2 uResolution;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec2 random2(vec2 p) {
    return fract(sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    uv.x *= uResolution.x / uResolution.y;

    float t = uTime * uSpeed;
    float cells = uCellCount * (1.0 + uAudioBass * 0.3);

    // Scale for voronoi
    vec2 st = uv * cells;
    vec2 ist = floor(st);
    vec2 fst = fract(st);

    float minDist = 1.0;
    float secondDist = 1.0;
    vec2 minPoint;
    float minIdx = 0.0;

    // Check neighboring cells
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = random2(ist + neighbor);

        // Animate points
        point = 0.5 + 0.5 * sin(t + 6.2831 * point);

        vec2 diff = neighbor + point - fst;
        float dist = length(diff);

        if (dist < minDist) {
          secondDist = minDist;
          minDist = dist;
          minPoint = point;
          minIdx = dot(ist + neighbor, vec2(1.0, cells));
        } else if (dist < secondDist) {
          secondDist = dist;
        }
      }
    }

    // Edge detection
    float edge = secondDist - minDist;
    float edgeLine = 1.0 - smoothstep(0.0, uEdgeWidth, edge);

    // Cell color based on cell index
    float hue = fract(minIdx * 0.1 + t * 0.05 + uAudioMid * 0.3);
    vec3 cellColor = hsv2rgb(vec3(hue, 0.7, 0.5 + 0.3 * minDist));

    // Edge color
    vec3 edgeColor = hsv2rgb(vec3(hue + 0.5, 0.8, 1.0));

    // Combine
    vec3 color = mix(cellColor, edgeColor, edgeLine);

    // Inner glow
    color += vec3(0.1, 0.05, 0.15) * (1.0 - minDist * 2.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export class VoronoiMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 0.5,
      cellCount: 8,
      edgeWidth: 0.05
    };

    this.uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: this.params.speed },
      uCellCount: { value: this.params.cellCount },
      uEdgeWidth: { value: this.params.edgeWidth },
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
    this.uniforms.uCellCount.value = this.params.cellCount;
    this.uniforms.uEdgeWidth.value = this.params.edgeWidth;

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
    folder.add(this.params, 'speed', 0.1, 2.0).name('Speed');
    folder.add(this.params, 'cellCount', 3, 20).step(1).name('Cell Count');
    folder.add(this.params, 'edgeWidth', 0.01, 0.2).name('Edge Width');
  }
}

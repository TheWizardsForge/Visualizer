import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise.js';

/**
 * TerrainSystem - Handles terrain generation, biomes, and terrain-related features
 */
export class TerrainSystem {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.noise = new SimplexNoise(config.seed || Date.now());

    // Configuration with defaults (spread config first, then apply defaults for missing/null values)
    this.config = {
      ...config,
      terrainScale: config.terrainScale ?? 0.0005,
      terrainHeight: config.terrainHeight ?? 35,
      terrainSize: config.terrainSize ?? 200,
      terrainSegments: config.terrainSegments ?? 150,
      biomes: config.biomes || this.getDefaultBiomes(), // Use || to also handle null
      biomeCount: config.biomeCount ?? 15,
      biomeCycleSpeed: config.biomeCycleSpeed ?? 0.0001
    };

    this.roverPosition = new THREE.Vector3(0, 0, 0);
    this.time = 0;

    this.terrain = null;
    this.terrainGeometry = null;
  }

  getDefaultBiomes() {
    // Returns the 15 default biome definitions
    return [
      { name: 'Purple Alien Desert', low: [0.20, 0.14, 0.30], mid: [0.35, 0.20, 0.45], high: [0.50, 0.35, 0.60] },
      { name: 'Crystal Blue Tundra', low: [0.15, 0.25, 0.38], mid: [0.22, 0.38, 0.55], high: [0.35, 0.52, 0.70] },
      { name: 'Volcanic Hellscape', low: [0.32, 0.10, 0.06], mid: [0.55, 0.20, 0.10], high: [0.80, 0.35, 0.15] },
      { name: 'Dense Jungle', low: [0.08, 0.15, 0.05], mid: [0.12, 0.28, 0.08], high: [0.18, 0.38, 0.12] },
      { name: 'Golden Savanna', low: [0.30, 0.24, 0.14], mid: [0.52, 0.42, 0.20], high: [0.72, 0.58, 0.30] },
      { name: 'Frozen Tundra', low: [0.70, 0.75, 0.80], mid: [0.80, 0.85, 0.90], high: [0.90, 0.92, 0.95] },
      { name: 'Toxic Swamp', low: [0.10, 0.22, 0.10], mid: [0.18, 0.42, 0.15], high: [0.28, 0.58, 0.22] },
      { name: 'Ocean Depths', low: [0.02, 0.08, 0.15], mid: [0.05, 0.15, 0.25], high: [0.08, 0.22, 0.35] },
      { name: 'Coral Reef', low: [0.12, 0.28, 0.32], mid: [0.18, 0.45, 0.52], high: [0.30, 0.62, 0.68] },
      { name: 'Rust Wastes', low: [0.28, 0.18, 0.10], mid: [0.48, 0.32, 0.18], high: [0.65, 0.42, 0.25] },
      { name: 'Alpine Mountains', low: [0.25, 0.22, 0.18], mid: [0.40, 0.38, 0.35], high: [0.85, 0.88, 0.92] },
      { name: 'Bamboo Forest', low: [0.15, 0.12, 0.08], mid: [0.35, 0.45, 0.25], high: [0.50, 0.60, 0.35] },
      { name: 'Bioluminescent Caves', low: [0.08, 0.06, 0.12], mid: [0.15, 0.10, 0.25], high: [0.25, 0.18, 0.40] },
      { name: 'Desert Canyons', low: [0.60, 0.35, 0.20], mid: [0.75, 0.50, 0.30], high: [0.85, 0.65, 0.45] },
      { name: 'Mushroom Forest', low: [0.22, 0.12, 0.18], mid: [0.45, 0.22, 0.38], high: [0.60, 0.35, 0.52] }
    ];
  }

  create() {
    const { terrainSize, terrainSegments } = this.config;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    geometry.rotateX(-Math.PI / 2);

    this.terrainGeometry = geometry;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
        uWeatherTint: { value: new THREE.Color(1, 1, 1) },
        uRoverZ: { value: 0 },
        uEnergyPulseTime: { value: 0 },
        uEnergyPulseOrigin: { value: new THREE.Vector2(0, 0) },
        uEnergyPulseActive: { value: 0 },
        uAlienVeins: { value: this.config.alienVeins ?? 1.0 },
        uGrassShadows: { value: this.config.grassShadows ?? 0.0 },
        fogColor: { value: new THREE.Color(0x0a0a15) },
        fogDensity: { value: 0.006 }
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      fog: true
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.position.y = -2;
    this.scene.add(this.terrain);

    this.updateGeometry(0);
    return this.terrain;
  }

  getVertexShader() {
    return `
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying float vElevation;
      varying vec3 vNormal;
      varying float vFogDepth;
      uniform float uRoverZ;
      void main() {
        vPosition = position;
        vWorldPos = position;
        vWorldPos.z -= uRoverZ;
        vElevation = position.y;
        vNormal = normal;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
  }

  getFragmentShader() {
    // Generate biome color arrays from config
    const biomes = this.config.biomes;
    let biomeDeclarations = '';
    for (let i = 0; i < biomes.length; i++) {
      const b = biomes[i];
      biomeDeclarations += `
        vec3 low${i} = vec3(${b.low[0].toFixed(2)}, ${b.low[1].toFixed(2)}, ${b.low[2].toFixed(2)});
        vec3 mid${i} = vec3(${b.mid[0].toFixed(2)}, ${b.mid[1].toFixed(2)}, ${b.mid[2].toFixed(2)});
        vec3 high${i} = vec3(${b.high[0].toFixed(2)}, ${b.high[1].toFixed(2)}, ${b.high[2].toFixed(2)});
      `;
    }

    // Generate biome selection logic
    let biomeSelection = '';
    const biomeCount = biomes.length;
    for (let i = 0; i < biomeCount; i++) {
      const nextI = (i + 1) % biomeCount;
      if (i === 0) {
        biomeSelection += `if (biome < biomeWidth) {
          float t = biome / biomeWidth;
          lowColor = mix(low0, low1, t);
          midColor = mix(mid0, mid1, t);
          highColor = mix(high0, high1, t);
        }`;
      } else if (i === biomeCount - 1) {
        biomeSelection += ` else {
          float t = (biome - biomeWidth * ${i}.0) / biomeWidth;
          lowColor = mix(low${i}, low0, t);
          midColor = mix(mid${i}, mid0, t);
          highColor = mix(high${i}, high0, t);
        }`;
      } else {
        biomeSelection += ` else if (biome < biomeWidth * ${i + 1}.0) {
          float t = (biome - biomeWidth * ${i}.0) / biomeWidth;
          lowColor = mix(low${i}, low${nextI}, t);
          midColor = mix(mid${i}, mid${nextI}, t);
          highColor = mix(high${i}, high${nextI}, t);
        }`;
      }
    }

    return `
      uniform float uTime;
      uniform float uAudioBass;
      uniform vec3 uWeatherTint;
      uniform float uRoverZ;
      uniform float uEnergyPulseTime;
      uniform vec2 uEnergyPulseOrigin;
      uniform float uEnergyPulseActive;
      uniform float uAlienVeins;
      uniform float uGrassShadows;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying float vElevation;
      varying vec3 vNormal;
      varying float vFogDepth;

      #ifdef USE_FOG
        uniform vec3 fogColor;
        #ifdef FOG_EXP2
          uniform float fogDensity;
        #else
          uniform float fogNear;
          uniform float fogFar;
        #endif
      #endif

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        float zBiome = vWorldPos.z * ${this.config.biomeCycleSpeed.toFixed(6)};
        float xVariation = noise(vec2(vWorldPos.x * 0.002, vWorldPos.z * 0.0015)) * 0.08;
        float localNoise = noise(vec2(vWorldPos.x * 0.005, vWorldPos.z * 0.005)) * 0.03;
        float biome = fract(zBiome + xVariation + localNoise);

        ${biomeDeclarations}

        vec3 lowColor, midColor, highColor;
        float biomeWidth = 1.0 / ${biomeCount}.0;

        ${biomeSelection}

        float e = clamp(vElevation / 10.0, 0.0, 1.0);
        vec3 color;
        if (e < 0.3) color = mix(lowColor, midColor, e / 0.3);
        else if (e < 0.6) color = mix(midColor, highColor, (e - 0.3) / 0.3);
        else color = mix(highColor, highColor * 1.3 + vec3(0.08), (e - 0.6) / 0.4);

        // Emissive glow patches (alien only)
        if (uAlienVeins > 0.0) {
          float glowNoise = noise(vWorldPos.xz * 0.02 + uTime * 0.02);
          float glowPatch = smoothstep(0.62, 0.82, glowNoise);
          color += highColor * 1.4 * glowPatch * 0.35 * uAlienVeins;

          // Glowing terrain veins
          float veinWarp = noise(vWorldPos.xz * 0.03);
          vec2 warpedPos = vWorldPos.xz + veinWarp * 15.0;
          float veinPattern = noise(warpedPos * 0.08);
          float vein = smoothstep(0.46, 0.5, veinPattern) * smoothstep(0.54, 0.5, veinPattern);
          vec3 veinColor = vec3(0.4, 0.9, 1.0) * (0.7 + sin(uTime * 2.0) * 0.3);
          color += veinColor * vein * 0.45 * uAlienVeins;
        }

        // Energy pulse
        if (uEnergyPulseActive > 0.0) {
          float dist = length(vWorldPos.xz - uEnergyPulseOrigin);
          float pulseRadius = uEnergyPulseTime * 60.0;
          float pulse = smoothstep(pulseRadius - 8.0, pulseRadius, dist)
                      * smoothstep(pulseRadius + 8.0, pulseRadius, dist);
          pulse *= (1.0 - uEnergyPulseTime);
          color += vec3(0.3, 0.8, 1.0) * pulse * uEnergyPulseActive * 1.5;
        }

        // Grass ambient occlusion - simple uniform darkening
        if (uGrassShadows > 0.0) {
          // Just darken the terrain slightly to simulate grass coverage shadow
          // No pattern = no visible movement artifacts
          color *= (1.0 - 0.15 * uGrassShadows);

          // Slight green tint from grass color bleeding onto ground
          color += vec3(-0.01, 0.02, -0.01) * uGrassShadows;
        }

        color += color * uAudioBass * 0.25;

        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
        float light = max(dot(vNormal, lightDir), 0.0) * 0.35 + 0.65;
        color *= light * uWeatherTint;
        color = clamp(color, vec3(0.05), vec3(0.85));

        gl_FragColor = vec4(color, 1.0);

        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
        #endif
      }
    `;
  }

  updateGeometry(offsetZ) {
    if (!this.terrainGeometry) return;

    const positions = this.terrainGeometry.attributes.position.array;
    const segments = this.config.terrainSegments;
    const size = this.config.terrainSize;

    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const index = (i * (segments + 1) + j) * 3;
        const x = (j / segments - 0.5) * size;
        const z = (i / segments - 0.5) * size + offsetZ;
        positions[index + 1] = this.getHeight(x, z);
      }
    }
    this.terrainGeometry.attributes.position.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();
  }

  getHeight(x, z) {
    const scale = this.config.terrainScale;
    const terrainHeight = this.config.terrainHeight;

    // Get biome at this position
    const biome = this.getBiomeAtPosition(x, z);
    const biomeId = Math.floor(biome * this.config.biomeCount);

    // Domain warping
    const warpScale = scale * 0.4;
    const warpX = this.noise.fbm(x * warpScale, z * warpScale, 2) * 200;
    const warpZ = this.noise.fbm(x * warpScale + 1000, z * warpScale + 1000, 2) * 200;

    // Base terrain
    let height = this.noise.fbm((x + warpX) * scale, (z + warpZ) * scale, 4) * terrainHeight * 0.7;
    height += this.noise.fbm(x * scale * 2.5, z * scale * 2.5, 3) * terrainHeight * 0.5;
    height += this.noise.fbm(x * scale * 6, z * scale * 6, 2) * terrainHeight * 0.15;

    // Ridged noise for peaks
    const ridged = this.noise.ridgedFbm(x * scale * 3, z * scale * 3, 3);
    height += ridged * terrainHeight * 0.35;

    // Large-scale undulation
    height += this.noise.fbm(x * scale * 0.3, z * scale * 0.3, 2) * terrainHeight * 0.25;

    // Dips/pools
    const dipNoise = this.noise.noise2D(x * scale * 0.8, z * scale * 0.8);
    if (dipNoise < -0.6) {
      const dipDepth = (-0.6 - dipNoise) * 2.5;
      height -= dipDepth * dipDepth * terrainHeight * 0.5;
    }

    // Craters
    const craterNoise = this.noise.noise2D(x * 0.004, z * 0.004);
    if (craterNoise > 0.7) {
      const craterDepth = (craterNoise - 0.7) * 8;
      height -= craterDepth * craterDepth * 2;
    }

    // Biome-specific terrain modifiers
    height = this.applyBiomeTerrainModifier(height, biomeId, x, z, terrainHeight, scale);

    return height;
  }

  applyBiomeTerrainModifier(height, biomeId, x, z, terrainHeight, scale) {
    switch (biomeId) {
      case 3: // Dense Jungle
        return height * 0.6;

      case 5: // Frozen Tundra
        return height * 0.4;

      case 7: // Ocean Depths
        height *= 0.15;
        height += Math.sin(x * 0.05 + this.time * 0.5) * 0.5;
        height += Math.sin(z * 0.03 + this.time * 0.3) * 0.3;
        return height;

      case 10: // Alpine Mountains
        height *= 1.5;
        height += this.noise.ridgedFbm(x * scale * 3, z * scale * 3, 3) * terrainHeight * 0.8;
        return height;

      case 11: // Bamboo Forest - terraced
        const terraceCount = 8;
        height = Math.round(height / (terrainHeight / terraceCount)) * (terrainHeight / terraceCount);
        return height * 0.7;

      case 12: // Bioluminescent Caves
        height *= 0.5;
        const caveNoise = this.noise.noise2D(x * scale * 0.5, z * scale * 0.5);
        if (caveNoise < -0.3) {
          height -= ((-0.3 - caveNoise) * 3) * terrainHeight * 0.4;
        }
        return height;

      case 13: // Desert Canyons
        const mesaTerraces = 6;
        height = Math.round(height / (terrainHeight / mesaTerraces)) * (terrainHeight / mesaTerraces);
        height *= 0.8;
        const canyonNoise = this.noise.noise2D(x * 0.01, z * 0.01);
        if (canyonNoise < -0.5) {
          height -= terrainHeight * 0.6;
        }
        return height;

      case 14: // Mushroom Forest
        height *= 0.6;
        height += Math.sin(x * 0.15) * Math.cos(z * 0.12) * terrainHeight * 0.15;
        return height;

      default:
        return height;
    }
  }

  getBiomeAtPosition(worldX, worldZ) {
    const zBiome = worldZ * this.config.biomeCycleSpeed;
    const xVar = Math.sin(worldX * 0.002) * Math.cos(worldZ * 0.0015) * 0.08;
    const localNoise = Math.sin(worldX * 0.005 + worldZ * 0.005) * 0.03;
    return ((zBiome + xVar + localNoise) % 1 + 1) % 1;
  }

  update(delta, elapsed, audioData, roverZ) {
    this.time = elapsed;
    this.roverPosition.z = roverZ;

    this.updateGeometry(roverZ);

    if (this.terrain) {
      if (audioData) {
        this.terrain.material.uniforms.uAudioBass.value +=
          (audioData.bass - this.terrain.material.uniforms.uAudioBass.value) * 0.1;
      } else {
        this.terrain.material.uniforms.uAudioBass.value *= 0.95;
      }
      this.terrain.material.uniforms.uTime.value = elapsed;
      this.terrain.material.uniforms.uRoverZ.value = roverZ;
    }
  }

  setWeatherTint(color) {
    if (this.terrain) {
      this.terrain.material.uniforms.uWeatherTint.value.copy(color);
    }
  }

  triggerEnergyPulse(originX, originZ) {
    if (this.terrain) {
      this.terrain.material.uniforms.uEnergyPulseOrigin.value.set(originX, originZ);
      this.terrain.material.uniforms.uEnergyPulseActive.value = 1.0;
      this.terrain.material.uniforms.uEnergyPulseTime.value = 0;
    }
  }

  updateEnergyPulse(delta) {
    if (!this.terrain) return;

    const uniforms = this.terrain.material.uniforms;
    if (uniforms.uEnergyPulseActive.value > 0) {
      uniforms.uEnergyPulseTime.value += delta * 0.4;
      if (uniforms.uEnergyPulseTime.value >= 1.0) {
        uniforms.uEnergyPulseActive.value = 0;
      }
    }
  }

  setSeed(seed) {
    this.noise = new SimplexNoise(seed);
    this.updateGeometry(this.roverPosition.z);
  }

  dispose() {
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
    }
  }
}

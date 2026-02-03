import * as THREE from 'three';
import { GPUHeightSampler } from './GPUHeightSampler.js';
import { NOISE_FUNCTIONS, TERRAIN_HEIGHT_FUNCTION } from '../shaders/terrainNoise.glsl.js';

/**
 * TerrainSystem - Handles terrain generation, biomes, and terrain-related features
 *
 * Uses GPU-first approach: all terrain height calculations happen on GPU.
 * The GPUHeightSampler reads back heights for systems that need them on CPU.
 */
export class TerrainSystem {
  constructor(scene, config = {}) {
    this.scene = scene;

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

    // GPU height sampler - initialized when renderer is available
    this.heightSampler = null;

    // Height request queue for batching
    this.heightRequests = [];
    this.heightRequestId = 0;
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

  /**
   * Initialize the GPU height sampler
   * Must be called after renderer is available
   */
  initHeightSampler(renderer) {
    this.heightSampler = new GPUHeightSampler(renderer, {
      terrainHeight: this.config.terrainHeight,
      terrainScale: this.config.terrainScale,
      textureSize: 128, // Heightmap resolution
      worldSize: 300    // World units covered by heightmap
    });
    // Initial render of heightmap centered at origin
    this.heightSampler.updateCenter(0, 0);
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
        uTerrainHeight: { value: this.config.terrainHeight },
        uTerrainScale: { value: this.config.terrainScale },
        uSeed: { value: this.config.seed || 12345 },
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

    // No longer need CPU-side geometry updates - terrain is computed on GPU
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
      uniform float uTerrainHeight;
      uniform float uTerrainScale;
      uniform float uTime;
      uniform float uSeed;

      ${NOISE_FUNCTIONS}
      ${TERRAIN_HEIGHT_FUNCTION}

      void main() {
        // Calculate world position
        // Screen Z is inverted (camera looks at -Z), so negate position.z
        vec2 worldPos = vec2(position.x, -position.z - uRoverZ);

        // GPU-computed terrain height
        float terrainY = getTerrainHeight(worldPos);

        vec3 displacedPos = vec3(position.x, terrainY, position.z);

        vPosition = displacedPos;
        vWorldPos = vec3(position.x, terrainY, position.z - uRoverZ);
        vElevation = terrainY;

        // Calculate normal from neighboring heights (GPU-side)
        float eps = 1.0;
        float hL = getTerrainHeight(worldPos + vec2(-eps, 0.0));
        float hR = getTerrainHeight(worldPos + vec2(eps, 0.0));
        float hD = getTerrainHeight(worldPos + vec2(0.0, -eps));
        float hU = getTerrainHeight(worldPos + vec2(0.0, eps));
        vNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

        vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
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

  /**
   * Request a terrain height sample at world position (x, z)
   * The height will be available next frame via getHeightResult()
   *
   * @param {number} x - World X position
   * @param {number} z - World Z position
   * @param {string} id - Unique identifier for this request
   */
  requestHeight(x, z, id) {
    if (!this.heightSampler) {
      console.warn('TerrainSystem: heightSampler not initialized');
      return;
    }
    this.heightSampler.requestHeight(x, z, id);
  }

  /**
   * Get the result of a previous height request
   * @param {string} id - The id used in requestHeight()
   * @returns {number|undefined} The height, or undefined if not yet available
   */
  getHeightResult(id) {
    if (!this.heightSampler) return undefined;
    return this.heightSampler.getHeight(id);
  }

  /**
   * Get terrain height at world position (x, z) - SYNCHRONOUS
   * Uses GPU sampling with immediate readback.
   *
   * @param {number} x - World X position
   * @param {number} z - World Z position (use -roverZ for positions relative to rover)
   */
  getHeight(x, z) {
    if (!this.heightSampler) {
      // Fallback: return 0 if sampler not initialized
      console.warn('TerrainSystem: heightSampler not initialized, returning 0');
      return 0;
    }
    // Don't re-center on every query - use the cached heightmap
    // The heightmap is centered once per frame in update()
    return this.heightSampler.getHeight(x, z);
  }

  /**
   * Get multiple terrain heights at once - more efficient than multiple getHeight calls
   * @param {Array<{x: number, z: number}>} positions
   * @returns {Array<number>} heights
   */
  getHeights(positions) {
    if (!this.heightSampler) {
      return positions.map(() => 0);
    }
    return this.heightSampler.sampleHeightsSync(positions);
  }

  /**
   * Process pending height requests
   * Call this once per frame after all requestHeight() calls
   */
  processHeightRequests() {
    if (this.heightSampler) {
      this.heightSampler.update();
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

    // GPU handles all terrain height calculations now - just update uniforms
    if (this.terrain) {
      if (audioData) {
        this.terrain.material.uniforms.uAudioBass.value +=
          (audioData.bass - this.terrain.material.uniforms.uAudioBass.value) * 0.1;
      } else {
        this.terrain.material.uniforms.uAudioBass.value *= 0.95;
      }
      this.terrain.material.uniforms.uTime.value = elapsed;
      this.terrain.material.uniforms.uRoverZ.value = roverZ;
      // Sync terrain params in case they changed via UI
      this.terrain.material.uniforms.uTerrainHeight.value = this.config.terrainHeight;
      this.terrain.material.uniforms.uTerrainScale.value = this.config.terrainScale;
    }

    // Sync height sampler with terrain params and update center position
    if (this.heightSampler) {
      this.heightSampler.syncTerrainParams(
        this.config.terrainHeight,
        this.config.terrainScale
      );
      // Update heightmap center to current world position (0, -roverZ)
      // This keeps the heightmap centered on visible terrain
      this.heightSampler.updateCenter(0, -roverZ);

      // Debug: Compare heightmap value with terrain shader uniforms
      if (this._terrainDebugCount === undefined) this._terrainDebugCount = 0;
      if (this._terrainDebugCount < 3) {
        const screenCenterWorldZ = -roverZ;
        const heightmapHeight = this.heightSampler.getHeight(0, screenCenterWorldZ);
        const terrainUniforms = this.terrain.material.uniforms;
        console.log(`TerrainDebug: heightmapH=${heightmapHeight.toFixed(2)}, terrain shader uniforms: scale=${terrainUniforms.uTerrainScale.value}, height=${terrainUniforms.uTerrainHeight.value}, roverZ=${terrainUniforms.uRoverZ.value.toFixed(1)}`);
        this._terrainDebugCount++;
      }
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
    // GPU terrain uses seedless deterministic noise
    // The seed uniform affects terrain variation
    if (this.terrain) {
      this.terrain.material.uniforms.uSeed.value = seed;
    }
  }

  dispose() {
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
    }
    if (this.heightSampler) {
      this.heightSampler.dispose();
    }
  }
}

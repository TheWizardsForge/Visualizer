import * as THREE from 'three';
import { NOISE_FUNCTIONS, TERRAIN_HEIGHT_FUNCTION } from '../shaders/terrainNoise.glsl.js';

// Smoothstep helper (matches GLSL smoothstep)
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * FireflySystem - GPU-based firefly particles with dynamic lighting
 *
 * Uses instanced rendering for thousands of fireflies with all movement
 * and blinking computed on the GPU. Provides a data texture of light
 * positions for other systems to sample for dynamic illumination.
 *
 * Fireflies appear at night and cast warm orange light onto the environment.
 */
export class FireflySystem {
  constructor(scene, config = {}) {
    this.scene = scene;

    this.config = {
      count: config.count ?? 200,
      maxLights: config.maxLights ?? 32,  // Max lights passed to other shaders
      areaSize: config.areaSize ?? 80,
      minHeight: config.minHeight ?? 0.5,
      maxHeight: config.maxHeight ?? 6,
      // Gentle warm yellow-green firefly color (like real fireflies)
      baseColor: config.baseColor ?? new THREE.Color(0.9, 0.95, 0.3),
      glowColor: config.glowColor ?? new THREE.Color(0.7, 0.9, 0.2),
      intensity: config.intensity ?? 1.2,
      lightRadius: config.lightRadius ?? 1.5,
      lightIntensity: config.lightIntensity ?? 0.03, // Minimal ground illumination (visual glow is separate)
      size: config.size ?? 0.08,
      // Night visibility settings
      nightOnly: config.nightOnly ?? true,
      fadeThreshold: config.fadeThreshold ?? 0.3, // sunBrightness below this = full visibility
      ...config
    };

    this.roverZ = 0;
    this.terrainY = 0;
    this.terrainSystem = null;
    this.elapsed = 0;
    this.sunBrightness = 0; // 0 = night, 1 = day

    // Dynamic light data texture for other shaders
    // Format: RGBA float texture where each pixel = one light
    // R = worldX, G = worldY, B = worldZ, A = intensity (0 = off)
    this.lightDataTexture = null;
    this.lightDataArray = null;

    this.mesh = null;
    this.init();
  }

  init() {
    const { count, areaSize, minHeight, maxHeight } = this.config;

    // Create instanced geometry - simple quad for each firefly
    const geometry = new THREE.PlaneGeometry(1, 1);
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    instancedGeometry.index = geometry.index;
    instancedGeometry.attributes.position = geometry.attributes.position;
    instancedGeometry.attributes.uv = geometry.attributes.uv;

    // Instance attributes
    const offsets = new Float32Array(count * 3);
    const phases = new Float32Array(count * 4); // blinkPhase, blinkSpeed, wanderPhaseX, wanderPhaseZ
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random positions across the area
      offsets[i * 3] = (Math.random() - 0.5) * areaSize;
      offsets[i * 3 + 1] = minHeight + Math.random() * (maxHeight - minHeight);
      offsets[i * 3 + 2] = (Math.random() - 0.5) * areaSize;

      // Blink and wander phases
      phases[i * 4] = Math.random() * Math.PI * 2;     // blinkPhase
      phases[i * 4 + 1] = 1.5 + Math.random() * 3;     // blinkSpeed
      phases[i * 4 + 2] = Math.random() * Math.PI * 2; // wanderPhaseX
      phases[i * 4 + 3] = Math.random() * Math.PI * 2; // wanderPhaseZ

      // Size variation
      scales[i] = 0.7 + Math.random() * 0.6;
    }

    instancedGeometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
    instancedGeometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 4));
    instancedGeometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1));
    instancedGeometry.instanceCount = count;

    // Create material with GPU-computed movement and blinking
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRoverZ: { value: 0 },
        uTerrainY: { value: 0 },
        uTerrainHeight: { value: 35.0 },
        uTerrainScale: { value: 0.0005 },
        uColor: { value: this.config.baseColor },
        uGlowColor: { value: this.config.glowColor },
        uSize: { value: this.config.size },
        uIntensity: { value: this.config.intensity },
        uNightFactor: { value: 1.0 }, // 0 = day (hidden), 1 = night (visible)
        uWrapRange: { value: this.config.areaSize },
        uCameraPosition: { value: new THREE.Vector3() }
      },
      vertexShader: `
        attribute vec3 offset;
        attribute vec4 phase;
        attribute float scale;

        uniform float uTime;
        uniform float uRoverZ;
        uniform float uTerrainY;
        uniform float uTerrainHeight;
        uniform float uTerrainScale;
        uniform float uSize;
        uniform float uWrapRange;
        uniform float uNightFactor;

        varying float vBrightness;
        varying vec2 vUv;

        ${NOISE_FUNCTIONS}
        ${TERRAIN_HEIGHT_FUNCTION}

        void main() {
          vUv = uv;

          // Calculate blink brightness - gentle pulsing, always somewhat visible
          float blinkPhase = phase.x;
          float blinkSpeed = phase.y;

          // Gentle sine wave pulsing - never goes fully dark
          float t = uTime * blinkSpeed * 0.5 + blinkPhase;
          float blink = sin(t) * 0.5 + 0.5;

          // Softer curve - maintains visibility
          blink = 0.4 + blink * 0.6; // Range: 0.4 to 1.0

          // Add subtle secondary variation
          float slowMod = sin(uTime * 0.15 + blinkPhase * 2.0) * 0.15;
          blink += slowMod;

          vBrightness = clamp(blink, 0.3, 1.0) * uNightFactor;

          // Gentle floating/bobbing movement like real fireflies
          float wanderX = sin(uTime * 0.3 + phase.z) * 0.8 + sin(uTime * 0.7 + phase.w) * 0.4;
          float wanderZ = cos(uTime * 0.25 + phase.w) * 0.8 + cos(uTime * 0.6 + phase.z) * 0.4;
          // More pronounced vertical bobbing
          float wanderY = sin(uTime * 0.8 + phase.x) * 0.6 + sin(uTime * 0.4 + phase.z) * 0.4;

          // Position with wrapping
          vec3 pos = offset;
          pos.x += wanderX;
          pos.z += wanderZ;

          // Wrap Z position relative to rover
          float relZ = pos.z - uRoverZ;
          float halfRange = uWrapRange * 0.5;
          float wrappedZ = mod(relZ + halfRange, uWrapRange) - halfRange;
          pos.z = wrappedZ;

          // Sample terrain height at firefly's world position
          // Screen Z is inverted, so use -wrappedZ - uRoverZ for world Z
          vec2 worldPos = vec2(pos.x, -wrappedZ - uRoverZ);
          float terrainHeight = getTerrainHeight(worldPos);

          // Set Y position: terrain height + firefly's floating height + bobbing + terrain mesh offset
          pos.y = terrainHeight + offset.y + wanderY + uTerrainY;

          // Billboard - face camera
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          // Consistent size with subtle pulse
          float finalSize = uSize * scale * (0.8 + vBrightness * 0.4);

          // Offset vertex position for billboard
          vec2 quadOffset = (position.xy) * finalSize;
          mvPosition.xy += quadOffset;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uGlowColor;
        uniform float uIntensity;
        uniform float uNightFactor;

        varying float vBrightness;
        varying vec2 vUv;

        void main() {
          // Distance from center
          float dist = length(vUv - 0.5) * 2.0;

          // Soft glowing core
          float core = 1.0 - smoothstep(0.0, 0.4, dist);

          // Gentle outer glow falloff
          float glow = 1.0 - smoothstep(0.0, 1.0, dist);
          glow = pow(glow, 1.5);

          // Combine - softer overall
          float combined = core * 0.6 + glow * 0.4;

          // Apply brightness and intensity
          float alpha = combined * vBrightness * uIntensity;

          // Color - warm yellow-green like real fireflies
          // Bright center fading to the glow color at edges
          vec3 color = mix(uGlowColor, uColor, core * 0.8);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(instancedGeometry, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    // Initialize light data texture
    this.initLightDataTexture();
  }

  initLightDataTexture() {
    const size = this.config.maxLights;
    this.lightDataArray = new Float32Array(size * 4);

    this.lightDataTexture = new THREE.DataTexture(
      this.lightDataArray,
      size,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.lightDataTexture.needsUpdate = true;
  }

  setTerrainSystem(terrainSystem) {
    this.terrainSystem = terrainSystem;
    // Copy terrain parameters to shader uniforms
    if (terrainSystem && this.mesh) {
      const uniforms = this.mesh.material.uniforms;
      uniforms.uTerrainHeight.value = terrainSystem.config.terrainHeight ?? 35.0;
      uniforms.uTerrainScale.value = terrainSystem.config.terrainScale ?? 0.0005;
    }
  }

  update(delta, elapsed, roverZ, terrainY, sunBrightness = 0, audioData = null) {
    this.elapsed = elapsed;
    this.roverZ = roverZ;
    this.terrainY = terrainY;
    this.sunBrightness = sunBrightness;

    if (!this.mesh) return;

    // Calculate night factor - fireflies appear at night
    let nightFactor = 1.0;
    if (this.config.nightOnly) {
      // Fade in as sun goes down, full brightness when sunBrightness < fadeThreshold
      nightFactor = 1.0 - smoothstep(0, this.config.fadeThreshold, sunBrightness);
    }

    const uniforms = this.mesh.material.uniforms;
    uniforms.uTime.value = elapsed;
    uniforms.uRoverZ.value = roverZ;
    uniforms.uTerrainY.value = terrainY;
    uniforms.uNightFactor.value = nightFactor;

    // Audio reactivity - fireflies dance with treble
    let intensityMult = 1.0;
    if (audioData) {
      intensityMult = 1.0 + audioData.treble * 0.8 + audioData.mid * 0.3;
    }
    uniforms.uIntensity.value = this.config.intensity * intensityMult;

    // Update light data texture for other shaders (only if visible)
    if (nightFactor > 0.01) {
      this.updateLightDataTexture(nightFactor);
    } else {
      // Clear lights during day
      this.clearLightDataTexture();
    }
  }

  clearLightDataTexture() {
    for (let i = 0; i < this.config.maxLights * 4; i++) {
      this.lightDataArray[i] = 0;
    }
    this.lightDataTexture.needsUpdate = true;
  }

  updateLightDataTexture(nightFactor = 1.0) {
    // Sample firefly positions and brightness for the light texture
    // We compute which fireflies are brightest/closest and export those

    const { count, maxLights, areaSize, lightIntensity } = this.config;
    const geometry = this.mesh.geometry;
    const offsets = geometry.attributes.offset.array;
    const phases = geometry.attributes.phase.array;

    const halfRange = areaSize * 0.5;
    const lights = [];

    // Calculate current state of each firefly (must match shader calculations)
    for (let i = 0; i < count; i++) {
      const blinkPhase = phases[i * 4];
      const blinkSpeed = phases[i * 4 + 1];
      const wanderPhaseX = phases[i * 4 + 2];
      const wanderPhaseZ = phases[i * 4 + 3];

      // Match shader blink calculation - gentle pulsing, never fully dark
      const t = this.elapsed * blinkSpeed * 0.5 + blinkPhase;
      let blink = Math.sin(t) * 0.5 + 0.5;
      blink = 0.4 + blink * 0.6; // Range: 0.4 to 1.0

      // Subtle secondary variation
      const slowMod = Math.sin(this.elapsed * 0.15 + blinkPhase * 2.0) * 0.15;
      blink = Math.max(0.3, Math.min(1.0, blink + slowMod));

      const brightness = blink * nightFactor;

      if (brightness > 0.2) {
        // Calculate world position (match shader wander)
        const wanderX = Math.sin(this.elapsed * 0.3 + wanderPhaseX) * 0.8 +
                        Math.sin(this.elapsed * 0.7 + wanderPhaseZ) * 0.4;
        const wanderZ = Math.cos(this.elapsed * 0.25 + wanderPhaseZ) * 0.8 +
                        Math.cos(this.elapsed * 0.6 + wanderPhaseX) * 0.4;
        const wanderY = Math.sin(this.elapsed * 0.8 + blinkPhase) * 0.6 +
                        Math.sin(this.elapsed * 0.4 + wanderPhaseX) * 0.4;

        let x = offsets[i * 3] + wanderX;
        let y = offsets[i * 3 + 1] + wanderY + this.terrainY;
        let z = offsets[i * 3 + 2] + wanderZ;

        // Wrap Z to screen space
        const relZ = z - this.roverZ;
        const wrappedZ = ((relZ % areaSize) + areaSize * 1.5) % areaSize - halfRange;

        // Store screen-space Z for simpler coordinate matching
        lights.push({
          x, y, z: wrappedZ,
          intensity: brightness * lightIntensity
        });
      }
    }

    // Sort by intensity (brightest first) and take top maxLights
    lights.sort((a, b) => b.intensity - a.intensity);

    // Fill the data texture
    for (let i = 0; i < this.config.maxLights; i++) {
      const idx = i * 4;
      if (i < lights.length) {
        this.lightDataArray[idx] = lights[i].x;
        this.lightDataArray[idx + 1] = lights[i].y;
        this.lightDataArray[idx + 2] = lights[i].z;
        this.lightDataArray[idx + 3] = lights[i].intensity;
      } else {
        // No light - set intensity to 0
        this.lightDataArray[idx] = 0;
        this.lightDataArray[idx + 1] = 0;
        this.lightDataArray[idx + 2] = 0;
        this.lightDataArray[idx + 3] = 0;
      }
    }

    this.lightDataTexture.needsUpdate = true;
  }

  /**
   * Get the light data texture for use in other shaders
   * Format: RGBA float texture, each pixel = one light
   * R = worldX, G = worldY, B = worldZ, A = intensity
   */
  getLightDataTexture() {
    return this.lightDataTexture;
  }

  /**
   * Get uniforms to add to other materials for dynamic lighting
   */
  getLightingUniforms() {
    return {
      uFireflyLights: { value: this.lightDataTexture },
      uFireflyLightCount: { value: this.config.maxLights },
      uFireflyLightColor: { value: this.config.baseColor },
      uFireflyLightRadius: { value: this.config.lightRadius }
    };
  }

  /**
   * GLSL code to include in other shaders for firefly lighting
   */
  static getLightingGLSL() {
    return `
      uniform sampler2D uFireflyLights;
      uniform int uFireflyLightCount;
      uniform vec3 uFireflyLightColor;
      uniform float uFireflyLightRadius;

      vec3 calculateFireflyLighting(vec3 worldPos, vec3 normal) {
        vec3 totalLight = vec3(0.0);

        for (int i = 0; i < 64; i++) {
          if (i >= uFireflyLightCount) break;

          vec4 lightData = texture2D(uFireflyLights, vec2((float(i) + 0.5) / float(uFireflyLightCount), 0.5));
          vec3 lightPos = lightData.xyz;
          float intensity = lightData.w;

          if (intensity > 0.01) {
            vec3 toLight = lightPos - worldPos;
            float dist = length(toLight);

            // Attenuation
            float attenuation = 1.0 / (1.0 + dist * dist / (uFireflyLightRadius * uFireflyLightRadius));
            attenuation *= smoothstep(uFireflyLightRadius * 2.0, 0.0, dist);

            // Simple diffuse
            float NdotL = max(0.0, dot(normal, normalize(toLight)));

            totalLight += uFireflyLightColor * intensity * attenuation * (0.5 + 0.5 * NdotL);
          }
        }

        return totalLight;
      }
    `;
  }

  setConfig(newConfig) {
    Object.assign(this.config, newConfig);

    if (this.mesh) {
      this.mesh.material.uniforms.uColor.value = this.config.baseColor;
      this.mesh.material.uniforms.uIntensity.value = this.config.intensity;
      this.mesh.material.uniforms.uSize.value = this.config.size;
    }
  }

  setVisible(visible) {
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.scene.remove(this.mesh);
    }
    if (this.lightDataTexture) {
      this.lightDataTexture.dispose();
    }
  }
}

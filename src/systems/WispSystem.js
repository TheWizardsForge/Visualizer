import * as THREE from 'three';
import { NOISE_FUNCTIONS, TERRAIN_HEIGHT_FUNCTION } from '../shaders/terrainNoise.glsl.js';
import { smoothstep } from '../utils/math.js';

/**
 * WispSystem - Ethereal floating lights that illuminate the night
 *
 * Larger and brighter than fireflies, wisps drift through the forest
 * casting warm light on terrain, grass, and trees. They move in smooth
 * arcs and have a gentle pulsing glow.
 */
export class WispSystem {
  constructor(scene, config = {}) {
    this.scene = scene;

    this.config = {
      count: config.count ?? 40,
      maxLights: config.maxLights ?? 40,
      areaSize: config.areaSize ?? 100,
      minHeight: config.minHeight ?? 1.0,
      maxHeight: config.maxHeight ?? 8.0,
      // Warm orange wisp color
      baseColor: config.baseColor ?? new THREE.Color(1.0, 0.6, 0.2),
      coreColor: config.coreColor ?? new THREE.Color(1.0, 0.9, 0.6),
      intensity: config.intensity ?? 2.0,
      lightRadius: config.lightRadius ?? 15.0,
      lightIntensity: config.lightIntensity ?? 0.5,
      size: config.size ?? 0.4,
      // Movement
      moveSpeed: config.moveSpeed ?? 0.3,
      // Night visibility
      nightOnly: config.nightOnly ?? true,
      fadeThreshold: config.fadeThreshold ?? 0.25,
      ...config
    };

    this.roverZ = 0;
    this.terrainY = 0;
    this.terrainSystem = null;
    this.elapsed = 0;
    this.sunBrightness = 0;

    // Light data texture for other shaders
    this.lightDataTexture = null;
    this.lightDataArray = null;

    this.mesh = null;
    this.init();
  }

  init() {
    const { count, areaSize, minHeight, maxHeight } = this.config;

    // Create instanced geometry - quad for each wisp
    const geometry = new THREE.PlaneGeometry(1, 1);
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    instancedGeometry.index = geometry.index;
    instancedGeometry.attributes.position = geometry.attributes.position;
    instancedGeometry.attributes.uv = geometry.attributes.uv;

    // Instance attributes
    const offsets = new Float32Array(count * 3);
    const phases = new Float32Array(count * 4); // phase, speed, pathType, colorVariation
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread wisps across the area
      offsets[i * 3] = (Math.random() - 0.5) * areaSize;
      offsets[i * 3 + 1] = minHeight + Math.random() * (maxHeight - minHeight);
      offsets[i * 3 + 2] = (Math.random() - 0.5) * areaSize;

      // Movement phases
      phases[i * 4] = Math.random() * Math.PI * 2;       // phase offset
      phases[i * 4 + 1] = 0.5 + Math.random() * 0.5;     // speed multiplier
      phases[i * 4 + 2] = Math.floor(Math.random() * 3); // path type (0, 1, 2)
      phases[i * 4 + 3] = Math.random();                 // color variation

      // Size variation
      scales[i] = 0.8 + Math.random() * 0.4;
    }

    instancedGeometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
    instancedGeometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 4));
    instancedGeometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    instancedGeometry.instanceCount = count;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRoverZ: { value: 0 },
        uTerrainY: { value: 0 },
        uTerrainHeight: { value: 35.0 },
        uTerrainScale: { value: 0.0005 },
        uBaseColor: { value: this.config.baseColor },
        uCoreColor: { value: this.config.coreColor },
        uSize: { value: this.config.size },
        uIntensity: { value: this.config.intensity },
        uNightFactor: { value: 1.0 },
        uWrapRange: { value: this.config.areaSize },
        uMoveSpeed: { value: this.config.moveSpeed }
      },
      vertexShader: `
        attribute vec3 offset;
        attribute vec4 phase;
        attribute float aScale;

        uniform float uTime;
        uniform float uRoverZ;
        uniform float uTerrainY;
        uniform float uTerrainHeight;
        uniform float uTerrainScale;
        uniform float uSize;
        uniform float uWrapRange;
        uniform float uNightFactor;
        uniform float uMoveSpeed;

        varying float vBrightness;
        varying vec2 vUv;
        varying float vColorVar;

        ${NOISE_FUNCTIONS}
        ${TERRAIN_HEIGHT_FUNCTION}

        void main() {
          vUv = uv;
          vColorVar = phase.w;

          float phaseOffset = phase.x;
          float speedMult = phase.y;
          float pathType = phase.z;

          // Gentle pulsing glow
          float pulse = sin(uTime * 1.5 + phaseOffset) * 0.5 + 0.5;
          pulse = 0.7 + pulse * 0.3;
          vBrightness = pulse * uNightFactor;

          // Smooth, graceful movement patterns
          float t = uTime * uMoveSpeed * speedMult + phaseOffset;

          float moveX, moveZ, moveY;

          // Different movement patterns for variety
          if (pathType < 1.0) {
            // Figure-8 pattern
            moveX = sin(t) * 3.0;
            moveZ = sin(t * 2.0) * 1.5;
            moveY = sin(t * 0.7) * 1.0;
          } else if (pathType < 2.0) {
            // Circular drift
            moveX = sin(t * 0.8) * 4.0 + sin(t * 0.3) * 2.0;
            moveZ = cos(t * 0.8) * 4.0 + cos(t * 0.3) * 2.0;
            moveY = sin(t * 0.5) * 1.5;
          } else {
            // Wandering path
            moveX = sin(t * 0.6) * 3.0 + sin(t * 1.1) * 1.5;
            moveZ = cos(t * 0.5) * 3.0 + sin(t * 0.9) * 1.5;
            moveY = sin(t * 0.4) * 1.2 + sin(t * 0.8) * 0.5;
          }

          vec3 pos = offset;
          pos.x += moveX;
          pos.z += moveZ;

          // Wrap Z position
          float relZ = pos.z - uRoverZ;
          float halfRange = uWrapRange * 0.5;
          float wrappedZ = mod(relZ + halfRange, uWrapRange) - halfRange;
          pos.z = wrappedZ;

          // Sample terrain height
          vec2 worldPos = vec2(pos.x, -wrappedZ - uRoverZ);
          float terrainH = getTerrainHeight(worldPos);

          // Float above terrain
          pos.y = terrainH + offset.y + moveY + uTerrainY;

          // Billboard
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float finalSize = uSize * aScale * (0.9 + vBrightness * 0.2);
          mvPosition.xy += position.xy * finalSize;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        uniform vec3 uCoreColor;
        uniform float uIntensity;

        varying float vBrightness;
        varying vec2 vUv;
        varying float vColorVar;

        void main() {
          float dist = length(vUv - 0.5) * 2.0;

          // Bright core
          float core = 1.0 - smoothstep(0.0, 0.25, dist);
          core = pow(core, 1.5);

          // Soft glow halo
          float glow = 1.0 - smoothstep(0.0, 1.0, dist);
          glow = pow(glow, 2.0);

          // Outer ethereal haze
          float haze = 1.0 - smoothstep(0.3, 1.0, dist);
          haze = pow(haze, 3.0);

          float combined = core * 0.6 + glow * 0.3 + haze * 0.2;
          float alpha = combined * vBrightness * uIntensity;

          // Color: white core -> base color -> slightly tinted edge
          vec3 color = mix(uBaseColor, uCoreColor, core);

          // Subtle warm color variation per wisp (orange to gold)
          vec3 warmTint = vec3(1.0, 0.85, 0.6);  // Golden
          vec3 hotTint = vec3(1.0, 0.5, 0.2);    // Deep orange
          color = mix(color, mix(hotTint, warmTint, vColorVar), 0.15 * (1.0 - core));

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

    this.initLightDataTexture();
  }

  initLightDataTexture() {
    const size = this.config.maxLights;
    this.lightDataArray = new Float32Array(size * 4);
    this.lightDataTexture = new THREE.DataTexture(
      this.lightDataArray,
      size, 1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.lightDataTexture.needsUpdate = true;
  }

  setTerrainSystem(terrainSystem) {
    this.terrainSystem = terrainSystem;
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

    // Night factor
    let nightFactor = 1.0;
    if (this.config.nightOnly) {
      nightFactor = 1.0 - smoothstep(0, this.config.fadeThreshold, sunBrightness);
    }

    const uniforms = this.mesh.material.uniforms;
    uniforms.uTime.value = elapsed;
    uniforms.uRoverZ.value = roverZ;
    uniforms.uTerrainY.value = terrainY;
    uniforms.uNightFactor.value = nightFactor;

    // Audio reactivity
    if (audioData) {
      uniforms.uIntensity.value = this.config.intensity * (1.0 + audioData.mid * 0.5);
    }

    if (nightFactor > 0.01) {
      this.updateLightDataTexture(nightFactor);
    } else {
      this.clearLightDataTexture();
    }
  }

  clearLightDataTexture() {
    for (let i = 0; i < this.config.maxLights * 4; i++) {
      this.lightDataArray[i] = 0;
    }
    this.lightDataTexture.needsUpdate = true;
  }

  updateLightDataTexture(nightFactor) {
    const { count, areaSize, lightIntensity, moveSpeed } = this.config;
    const geometry = this.mesh.geometry;
    const offsets = geometry.attributes.offset.array;
    const phases = geometry.attributes.phase.array;

    const halfRange = areaSize * 0.5;

    for (let i = 0; i < count && i < this.config.maxLights; i++) {
      const phaseOffset = phases[i * 4];
      const speedMult = phases[i * 4 + 1];
      const pathType = phases[i * 4 + 2];

      const t = this.elapsed * moveSpeed * speedMult + phaseOffset;

      let moveX, moveZ, moveY;
      if (pathType < 1.0) {
        moveX = Math.sin(t) * 3.0;
        moveZ = Math.sin(t * 2.0) * 1.5;
        moveY = Math.sin(t * 0.7) * 1.0;
      } else if (pathType < 2.0) {
        moveX = Math.sin(t * 0.8) * 4.0 + Math.sin(t * 0.3) * 2.0;
        moveZ = Math.cos(t * 0.8) * 4.0 + Math.cos(t * 0.3) * 2.0;
        moveY = Math.sin(t * 0.5) * 1.5;
      } else {
        moveX = Math.sin(t * 0.6) * 3.0 + Math.sin(t * 1.1) * 1.5;
        moveZ = Math.cos(t * 0.5) * 3.0 + Math.sin(t * 0.9) * 1.5;
        moveY = Math.sin(t * 0.4) * 1.2 + Math.sin(t * 0.8) * 0.5;
      }

      let x = offsets[i * 3] + moveX;
      let baseY = offsets[i * 3 + 1];
      let z = offsets[i * 3 + 2] + moveZ;

      // Wrap Z to screen space (matching how the wisp mesh shader does it)
      const relZ = z - this.roverZ;
      const wrappedZ = ((relZ % areaSize) + areaSize * 1.5) % areaSize - halfRange;

      // Store screen-space coordinates for simpler matching with grass/terrain
      const screenZ = wrappedZ;

      // Estimate Y position to roughly match terrain/grass vWorldPos.y
      // Use a value in the middle of typical terrain height range
      const terrainMidpoint = this.terrainSystem?.config?.terrainHeight
        ? this.terrainSystem.config.terrainHeight * 0.4
        : 12;
      const y = terrainMidpoint + baseY + moveY;

      // Gentle flickering pulse - combination of slow drift and subtle flicker
      const slowPulse = Math.sin(this.elapsed * 0.5 + phaseOffset) * 0.5 + 0.5;
      const flicker = Math.sin(this.elapsed * 3.0 + phaseOffset * 7.0) * 0.5 + 0.5;
      // Combine: mostly slow pulse with subtle flicker overlay
      const pulse = slowPulse * 0.85 + flicker * 0.15;
      // Brightness varies from 0.6 to 1.0 for visible pulsing
      const brightness = (0.6 + pulse * 0.4) * nightFactor;

      const idx = i * 4;
      this.lightDataArray[idx] = x;
      this.lightDataArray[idx + 1] = y;
      this.lightDataArray[idx + 2] = screenZ;
      // Final intensity with hard cap
      this.lightDataArray[idx + 3] = Math.min(0.5, brightness * lightIntensity);
    }

    this.lightDataTexture.needsUpdate = true;
  }

  getLightDataTexture() {
    return this.lightDataTexture;
  }

  getLightingUniforms() {
    return {
      uWispLights: { value: this.lightDataTexture },
      uWispLightCount: { value: this.config.maxLights },
      uWispLightColor: { value: this.config.baseColor },
      uWispLightRadius: { value: this.config.lightRadius }
    };
  }

  setVisible(visible) {
    if (this.mesh) this.mesh.visible = visible;
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

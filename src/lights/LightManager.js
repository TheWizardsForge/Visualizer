import * as THREE from 'three';

/**
 * LightManager - Central registry for dynamic lights
 *
 * Manages all dynamic light sources (fireflies, wisps, etc.) and provides
 * a unified interface for systems that need to receive lighting.
 *
 * Benefits:
 * - Add new light type = register with LightManager, all shaders get it
 * - Single place to manage light textures and uniforms
 * - Automatic consolidation when needed
 *
 * Usage:
 *   const lightManager = new LightManager();
 *   lightManager.registerSource('firefly', { color: new Color(0.9, 0.95, 0.3), radius: 1.5, maxLights: 32 });
 *   lightManager.registerSource('wisp', { color: new Color(1.0, 0.6, 0.2), radius: 15.0, maxLights: 40 });
 *
 *   // In light system update:
 *   lightManager.updateSource('firefly', lightsArray);
 *
 *   // In consuming system:
 *   const uniforms = lightManager.getUniforms();
 */
export class LightManager {
  constructor() {
    // Registered light sources: name → config
    this.sources = new Map();

    // Light data: name → { texture, array, count }
    this.lightData = new Map();

    // Cached uniforms (rebuilt when sources change)
    this._uniformsCache = null;
    this._uniformsDirty = true;
  }

  /**
   * Register a new light source type
   *
   * @param {string} name - Unique identifier (e.g., 'firefly', 'wisp')
   * @param {Object} config - Light source configuration
   * @param {THREE.Color} config.color - Default light color
   * @param {number} config.radius - Light falloff radius
   * @param {number} config.maxLights - Maximum number of lights of this type
   * @param {number} [config.intensity=1.0] - Base intensity multiplier
   */
  registerSource(name, config) {
    const sourceConfig = {
      color: config.color || new THREE.Color(1, 1, 1),
      radius: config.radius || 5.0,
      maxLights: config.maxLights || 32,
      intensity: config.intensity || 1.0
    };

    this.sources.set(name, sourceConfig);

    // Create data texture for this source
    const size = sourceConfig.maxLights;
    const array = new Float32Array(size * 4);
    const texture = new THREE.DataTexture(
      array,
      size,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;

    this.lightData.set(name, {
      texture,
      array,
      count: 0
    });

    this._uniformsDirty = true;
  }

  /**
   * Update light positions and intensities for a source
   *
   * @param {string} name - Source name
   * @param {Array<{x: number, y: number, z: number, intensity: number}>} lights - Light data
   */
  updateSource(name, lights) {
    const data = this.lightData.get(name);
    if (!data) {
      console.warn(`LightManager: Unknown source '${name}'`);
      return;
    }

    const config = this.sources.get(name);
    const maxLights = config.maxLights;

    // Fill the data array
    const count = Math.min(lights.length, maxLights);
    for (let i = 0; i < maxLights; i++) {
      const idx = i * 4;
      if (i < count) {
        const light = lights[i];
        data.array[idx] = light.x;
        data.array[idx + 1] = light.y;
        data.array[idx + 2] = light.z;
        data.array[idx + 3] = light.intensity * config.intensity;
      } else {
        // Clear unused slots
        data.array[idx] = 0;
        data.array[idx + 1] = 0;
        data.array[idx + 2] = 0;
        data.array[idx + 3] = 0;
      }
    }

    data.count = count;
    data.texture.needsUpdate = true;
  }

  /**
   * Update light data directly from a Float32Array (more efficient than updateSource)
   * The array should be in RGBA format: [x, y, z, intensity, x, y, z, intensity, ...]
   *
   * @param {string} name - Source name
   * @param {Float32Array} sourceArray - Raw light data array
   * @param {number} [lightCount] - Number of active lights (optional, will count non-zero intensities if not provided)
   */
  updateSourceFromArray(name, sourceArray, lightCount) {
    const data = this.lightData.get(name);
    if (!data) {
      console.warn(`LightManager: Unknown source '${name}'`);
      return;
    }

    const config = this.sources.get(name);
    const maxLights = config.maxLights;
    const copyLength = Math.min(sourceArray.length, maxLights * 4);

    // Direct copy from source array
    data.array.set(sourceArray.subarray(0, copyLength));

    // Clear remaining slots if source is smaller
    for (let i = copyLength; i < data.array.length; i++) {
      data.array[i] = 0;
    }

    // Count active lights if not provided
    if (lightCount !== undefined) {
      data.count = lightCount;
    } else {
      let count = 0;
      for (let i = 0; i < maxLights; i++) {
        if (data.array[i * 4 + 3] > 0.01) count++;
      }
      data.count = count;
    }

    data.texture.needsUpdate = true;
  }

  /**
   * Clear all lights for a source (e.g., during daytime)
   *
   * @param {string} name - Source name
   */
  clearSource(name) {
    const data = this.lightData.get(name);
    if (!data) return;

    for (let i = 0; i < data.array.length; i++) {
      data.array[i] = 0;
    }
    data.count = 0;
    data.texture.needsUpdate = true;
  }

  /**
   * Clear all light sources
   */
  clearAll() {
    for (const name of this.sources.keys()) {
      this.clearSource(name);
    }
  }

  /**
   * Get uniforms for all registered light sources
   * These should be merged into material uniforms
   *
   * @returns {Object} Uniforms object
   */
  getUniforms() {
    if (!this._uniformsDirty && this._uniformsCache) {
      return this._uniformsCache;
    }

    const uniforms = {};

    // Generate uniforms for each source
    // Naming convention: u{SourceName}Lights, u{SourceName}LightCount, etc.
    for (const [name, config] of this.sources) {
      const data = this.lightData.get(name);
      const capitalName = name.charAt(0).toUpperCase() + name.slice(1);

      uniforms[`u${capitalName}Lights`] = { value: data.texture };
      uniforms[`u${capitalName}LightCount`] = { value: config.maxLights };
      uniforms[`u${capitalName}LightColor`] = { value: config.color };
      uniforms[`u${capitalName}LightRadius`] = { value: config.radius };
    }

    this._uniformsCache = uniforms;
    this._uniformsDirty = false;
    return uniforms;
  }

  /**
   * Get uniforms for a specific light source
   *
   * @param {string} name - Source name
   * @returns {Object} Uniforms for this source
   */
  getSourceUniforms(name) {
    const config = this.sources.get(name);
    const data = this.lightData.get(name);
    if (!config || !data) return {};

    const capitalName = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      [`u${capitalName}Lights`]: { value: data.texture },
      [`u${capitalName}LightCount`]: { value: config.maxLights },
      [`u${capitalName}LightColor`]: { value: config.color },
      [`u${capitalName}LightRadius`]: { value: config.radius }
    };
  }

  /**
   * Get the data texture for a light source
   *
   * @param {string} name - Source name
   * @returns {THREE.DataTexture|null}
   */
  getTexture(name) {
    return this.lightData.get(name)?.texture ?? null;
  }

  /**
   * Update a source's configuration (color, radius, etc.)
   *
   * @param {string} name - Source name
   * @param {Object} config - Updated configuration
   */
  updateConfig(name, config) {
    const existing = this.sources.get(name);
    if (!existing) return;

    if (config.color) existing.color = config.color;
    if (config.radius !== undefined) existing.radius = config.radius;
    if (config.intensity !== undefined) existing.intensity = config.intensity;

    this._uniformsDirty = true;
  }

  /**
   * Check if a source is registered
   *
   * @param {string} name
   * @returns {boolean}
   */
  hasSource(name) {
    return this.sources.has(name);
  }

  /**
   * Get list of registered source names
   *
   * @returns {string[]}
   */
  getSourceNames() {
    return Array.from(this.sources.keys());
  }

  /**
   * Get active light count for a source
   *
   * @param {string} name
   * @returns {number}
   */
  getLightCount(name) {
    return this.lightData.get(name)?.count ?? 0;
  }

  /**
   * Dispose all textures
   */
  dispose() {
    for (const data of this.lightData.values()) {
      data.texture.dispose();
    }
    this.lightData.clear();
    this.sources.clear();
    this._uniformsCache = null;
  }
}

export default LightManager;

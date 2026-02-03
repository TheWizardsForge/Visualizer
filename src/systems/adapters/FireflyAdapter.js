import * as THREE from 'three';
import { BaseSystem } from '../../core/BaseSystem.js';
import { FireflySystem } from '../FireflySystem.js';

/**
 * FireflyAdapter - Adapts FireflySystem to use LightManager and WorldContext
 *
 * Key changes from direct usage:
 * - Reads state from WorldContext instead of parameters
 * - Registers with LightManager instead of managing own texture distribution
 * - Other systems get lighting through LightManager.getUniforms()
 */
export class FireflyAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // The wrapped system
    this.system = null;
  }

  create() {
    // Create the underlying FireflySystem
    this.system = new FireflySystem(this.scene, {
      count: this.config.count ?? 200,
      maxLights: this.config.maxLights ?? 32,
      areaSize: this.config.areaSize ?? 80,
      minHeight: this.config.minHeight ?? 0.5,
      maxHeight: this.config.maxHeight ?? 6,
      baseColor: this.config.baseColor ?? new THREE.Color(0.9, 0.95, 0.3),
      glowColor: this.config.glowColor ?? new THREE.Color(0.7, 0.9, 0.2),
      intensity: this.config.intensity ?? 1.2,
      lightRadius: this.config.lightRadius ?? 1.5,
      lightIntensity: this.config.lightIntensity ?? 0.03,
      size: this.config.size ?? 0.08,
      nightOnly: this.config.nightOnly ?? true,
      fadeThreshold: this.config.fadeThreshold ?? 0.3
    });

    // Connect to terrain system from context
    if (this.context.terrainSystem) {
      this.system.setTerrainSystem(this.context.terrainSystem);
    }

    // Register with LightManager if available
    if (this.lightManager) {
      this.lightManager.registerSource('firefly', {
        color: this.config.baseColor ?? new THREE.Color(0.9, 0.95, 0.3),
        radius: this.config.lightRadius ?? 1.5,
        maxLights: this.config.maxLights ?? 32,
        intensity: 1.0
      });
    }
  }

  init(renderer) {
    // FireflySystem initializes in constructor, nothing needed here
  }

  update() {
    if (!this.system) return;

    // Read from context
    const { delta, elapsed, roverZ, terrainY, sunBrightness, audioData } = this.context;

    // Update the underlying system
    this.system.update(delta, elapsed, roverZ, terrainY, sunBrightness, audioData);

    // Push light data to LightManager
    if (this.lightManager && this.lightManager.hasSource('firefly')) {
      this._pushLightsToManager();
    }
  }

  /**
   * Push light data directly to LightManager (zero allocation)
   * @private
   */
  _pushLightsToManager() {
    // Direct array copy - no intermediate object allocation
    this.lightManager.updateSourceFromArray('firefly', this.system.lightDataArray);
  }

  dispose() {
    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSTHROUGH METHODS - Expose FireflySystem's API
  // ─────────────────────────────────────────────────────────────────────────────

  setTerrainSystem(terrainSystem) {
    if (this.system) {
      this.system.setTerrainSystem(terrainSystem);
    }
  }

  getLightDataTexture() {
    return this.system?.getLightDataTexture();
  }

  getLightingUniforms() {
    // Prefer LightManager uniforms if available
    if (this.lightManager) {
      return this.lightManager.getSourceUniforms('firefly');
    }
    return this.system?.getLightingUniforms() ?? {};
  }

  setConfig(newConfig) {
    if (this.system) {
      this.system.setConfig(newConfig);
    }
    Object.assign(this.config, newConfig);
  }

  setVisible(visible) {
    if (this.system) {
      this.system.setVisible(visible);
    }
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }
}

export default FireflyAdapter;

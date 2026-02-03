import * as THREE from 'three';
import { BaseSystem } from '../../core/BaseSystem.js';
import { GrassSystem } from '../GrassSystem.js';

/**
 * GrassAdapter - Adapts GrassSystem to use WorldContext and LightManager
 */
export class GrassAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // The wrapped system
    this.system = null;
  }

  create() {
    // Get terrain system from context
    const terrainSystem = this.context.terrainSystem;

    // Create the underlying GrassSystem
    this.system = new GrassSystem(this.scene, terrainSystem, {
      enabled: this.config.enabled ?? true,
      instanceCount: this.config.instanceCount ?? 50000,
      grassColor: this.config.grassColor ?? new THREE.Color(0.1, 0.4, 0.05),
      clutterEnabled: this.config.clutterEnabled ?? false,
      clutterDensity: this.config.clutterDensity ?? 100
    });
    this.system.create();
  }

  init(renderer) {
    // GrassSystem initializes in create(), nothing needed here
  }

  update() {
    if (!this.system) return;

    // Read from context
    const { delta, elapsed, audioData, roverZ, sunBrightness } = this.context;

    // Update the underlying system
    this.system.update(delta, elapsed, audioData, roverZ, sunBrightness);

    // Apply lighting from LightManager if available
    if (this.lightManager) {
      const fireflyTexture = this.lightManager.getTexture('firefly');
      const wispTexture = this.lightManager.getTexture('wisp');

      if (fireflyTexture) {
        const fireflyConfig = this.lightManager.sources.get('firefly');
        this.system.setFireflyLights(fireflyTexture, fireflyConfig?.color, fireflyConfig?.radius);
      }
      if (wispTexture) {
        const wispConfig = this.lightManager.sources.get('wisp');
        this.system.setWispLights(wispTexture, wispConfig?.color, wispConfig?.radius);
      }
    }
  }

  dispose() {
    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSTHROUGH METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  setFireflyLights(lightTexture, lightColor, lightRadius) {
    if (this.system) {
      this.system.setFireflyLights(lightTexture, lightColor, lightRadius);
    }
  }

  setWispLights(lightTexture, lightColor, lightRadius) {
    if (this.system) {
      this.system.setWispLights(lightTexture, lightColor, lightRadius);
    }
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }
}

export default GrassAdapter;

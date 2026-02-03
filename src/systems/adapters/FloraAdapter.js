import { BaseSystem } from '../../core/BaseSystem.js';
import { FloraSystem } from '../FloraSystem.js';

/**
 * FloraAdapter - Adapts FloraSystem to use WorldContext and LightManager
 */
export class FloraAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // The wrapped system
    this.system = null;
  }

  create() {
    // Get terrain system from context
    const terrainSystem = this.context.terrainSystem;

    // Create the underlying FloraSystem
    this.system = new FloraSystem(this.scene, terrainSystem, {
      enabled: this.config.enabled ?? true,
      floraTypes: this.config.floraTypes,
      sporeCount: this.config.sporeCount ?? 300
    });
    this.system.create();
  }

  init(renderer) {
    // FloraSystem initializes in create(), nothing needed here
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

  getFloraInPath(minZ, maxZ, xRange, trunkRadius) {
    return this.system?.getFloraInPath(minZ, maxZ, xRange, trunkRadius) ?? [];
  }

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

export default FloraAdapter;

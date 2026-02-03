import { BaseSystem } from '../../core/BaseSystem.js';
import { ShadowSystem } from '../ShadowSystem.js';

/**
 * ShadowAdapter - Adapts ShadowSystem to use WorldContext
 *
 * Provides:
 * - Reads roverZ, sunBrightness from context
 * - Exposes shadowSystem to context for FloraSystem to use
 * - Handles quality-based configuration
 */
export class ShadowAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // The wrapped system
    this.system = null;
  }

  create() {
    // Get terrain system from context
    const terrainSystem = this.context.terrainSystem;

    // Determine max shadows based on quality (if not explicitly set)
    const maxShadows = this.config.maxShadows ?? this._getMaxShadowsForQuality();

    // Create the underlying ShadowSystem
    this.system = new ShadowSystem(this.scene, terrainSystem, {
      enabled: this.config.enabled ?? true,
      maxShadows: maxShadows,
      baseOpacity: this.config.baseOpacity ?? 0.5,
      dappleEnabled: this.config.dappleEnabled ?? true,
      wrapRange: this.context.wrapRange ?? 200,
      ...this.config
    });

    this.system.create();

    // Expose shadow system to context for FloraSystem to use
    this.context.shadowSystem = this.system;
  }

  /**
   * Get max shadows based on quality setting in context
   * @private
   */
  _getMaxShadowsForQuality() {
    const quality = this.context.qualityLevel ?? 'high';
    const qualityMap = {
      low: 0,      // Shadows disabled on low
      medium: 200,
      high: 500
    };
    return qualityMap[quality] ?? 500;
  }

  init(renderer) {
    // ShadowSystem initializes in create(), nothing needed here
  }

  update() {
    if (!this.system) return;

    // Read from context
    const { delta, elapsed, roverZ, sunBrightness } = this.context;

    // Update the underlying system
    this.system.update(delta, elapsed, roverZ, sunBrightness);
  }

  dispose() {
    // Remove from context
    if (this.context.shadowSystem === this.system) {
      this.context.shadowSystem = null;
    }

    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSTHROUGH METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  registerShadow(x, z, radius, type = 'solid') {
    return this.system?.registerShadow(x, z, radius, type) ?? -1;
  }

  registerShadows(shadows) {
    if (this.system) {
      this.system.registerShadows(shadows);
    }
  }

  clearShadows() {
    if (this.system) {
      this.system.clearShadows();
    }
  }

  setVisible(visible) {
    if (this.system) {
      this.system.setVisible(visible);
    }
  }

  setConfig(newConfig) {
    if (this.system) {
      this.system.setConfig(newConfig);
    }
    Object.assign(this._config, newConfig);
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }
}

export default ShadowAdapter;

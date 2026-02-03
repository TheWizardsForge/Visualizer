import { BaseSystem } from '../../core/BaseSystem.js';
import { AtmosphereSystem } from '../AtmosphereSystem.js';

/**
 * AtmosphereAdapter - Adapts AtmosphereSystem to the new BaseSystem interface
 *
 * This allows AtmosphereSystem to work with the SystemManager while
 * maintaining backward compatibility.
 *
 * The adapter reads from and writes to WorldContext, bridging the gap
 * between the old parameter-passing style and the new context-based style.
 */
export class AtmosphereAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // Store references needed for AtmosphereSystem
    this.camera = config.camera;
    this.renderer = config.renderer;

    // The wrapped system
    this.system = null;
  }

  create() {
    // Create the underlying AtmosphereSystem
    this.system = new AtmosphereSystem(
      this.scene,
      this.camera,
      this.renderer,
      {
        fogDensity: this.config.fogDensity ?? 0.006,
        fogColor: this.config.fogColor ?? 0x0a0a15,
        nightFogColor: this.config.nightFogColor ?? null,
        skyColor: this.config.skyColor ?? 0x000008,
        nightSkyColor: this.config.nightSkyColor ?? null,
        bloomStrength: this.config.bloomStrength ?? 0.3,
        bloomRadius: this.config.bloomRadius ?? 0.3,
        bloomThreshold: this.config.bloomThreshold ?? 0.6,
        scanlines: this.config.scanlines ?? 0.0,
        chromaticAberration: this.config.chromaticAberration ?? 0.0,
        vignette: this.config.vignette ?? 0.0,
        glitchEnabled: this.config.glitchEnabled ?? true
      }
    );
    this.system.create();

    // Sync initial day/night settings from context if available
    if (this.context.dayNightCycle !== undefined) {
      this.system.dayNightCycle = this.context.dayNightCycle;
    }
    if (this.config.dayNightSpeed !== undefined) {
      this.system.dayNightSpeed = this.config.dayNightSpeed;
    }
  }

  init(renderer) {
    // AtmosphereSystem sets up post-processing in create(), nothing needed here
  }

  update() {
    if (!this.system) return;

    // Read from context
    const { delta, elapsed, audioData } = this.context;

    // Sync day/night speed if it changed
    if (this.config.dayNightSpeed !== undefined) {
      this.system.dayNightSpeed = this.config.dayNightSpeed;
    }

    // Update the underlying system
    if (this.config.weatherEnabled !== false) {
      this.system.update(delta, elapsed, audioData);
    } else {
      this.system.updateDayNight(delta);
      this.system.updateGlitch(delta);
    }

    // Write results back to context
    this.context.setDayNightState(
      this.system.dayNightCycle,
      this.system.sunBrightness
    );
  }

  /**
   * Render using the post-processing composer
   */
  render() {
    if (this.system) {
      this.system.render();
    }
  }

  dispose() {
    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSTHROUGH METHODS - Expose AtmosphereSystem's API
  // ─────────────────────────────────────────────────────────────────────────────

  get dayNightCycle() {
    return this.system?.dayNightCycle ?? 0;
  }

  set dayNightCycle(value) {
    if (this.system) {
      this.system.dayNightCycle = value;
    }
  }

  get sunBrightness() {
    return this.system?.sunBrightness ?? 1;
  }

  get dayNightSpeed() {
    return this.system?.dayNightSpeed ?? 0.01;
  }

  set dayNightSpeed(value) {
    if (this.system) {
      this.system.dayNightSpeed = value;
    }
    this.config.dayNightSpeed = value;
  }

  setUnderwater(isUnderwater, depth = 0) {
    if (this.system) {
      this.system.setUnderwater(isUnderwater, depth);
    }
  }

  setWeather(weather) {
    if (this.system) {
      this.system.setWeather(weather);
    }
  }

  triggerGlitch(intensity = 0.5) {
    if (this.system) {
      this.system.triggerGlitch(intensity);
    }
  }

  setBloomStrength(value) {
    if (this.system) {
      this.system.setBloomStrength(value);
    }
  }

  setBloomRadius(value) {
    if (this.system) {
      this.system.setBloomRadius(value);
    }
  }

  setBloomThreshold(value) {
    if (this.system) {
      this.system.setBloomThreshold(value);
    }
  }

  setFogDensity(value) {
    if (this.system) {
      this.system.setFogDensity(value);
    }
  }

  onResize(width, height) {
    if (this.system) {
      this.system.onResize(width, height);
    }
  }
}

export default AtmosphereAdapter;

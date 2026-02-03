import { BaseSystem } from '../../core/BaseSystem.js';
import { SkySystem } from '../SkySystem.js';

/**
 * SkyAdapter - Adapts SkySystem to use WorldContext
 */
export class SkyAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);
    this.system = null;
  }

  create() {
    this.system = new SkySystem(this.scene, {
      seed: this.config.seed,
      starDensity: this.config.starDensity ?? 5000,
      nebulaIntensity: this.config.nebulaIntensity ?? 0.5,
      moonCount: this.config.moonCount ?? 6,
      showGasPlanet: this.config.showGasPlanet ?? true,
      showAurora: this.config.showAurora ?? true,
      showPulsars: this.config.showPulsars ?? true,
      skyType: this.config.skyType || 'space'
    });
    this.system.create();
  }

  init(renderer) {
    // SkySystem initializes in create()
  }

  update() {
    if (!this.system) return;

    const { delta, elapsed, audioData, dayNightCycle } = this.context;
    this.system.update(delta, elapsed, audioData, dayNightCycle);
  }

  dispose() {
    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
  }

  // Passthrough methods
  setAuroraIntensity(intensity) {
    if (this.system) {
      this.system.setAuroraIntensity(intensity);
    }
  }

  setNebulaIntensity(intensity) {
    if (this.system) {
      this.system.setNebulaIntensity(intensity);
    }
  }

  triggerMeteorShower() {
    if (this.system) {
      this.system.triggerMeteorShower();
    }
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }
}

export default SkyAdapter;

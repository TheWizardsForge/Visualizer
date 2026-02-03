import { BaseSystem } from '../../core/BaseSystem.js';
import { FaunaSystem } from '../FaunaSystem.js';

/**
 * FaunaAdapter - Adapts FaunaSystem to use WorldContext
 */
export class FaunaAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);
    this.system = null;
  }

  create() {
    // Get terrain system from context
    const terrainSystem = this.context.terrainSystem;

    this.system = new FaunaSystem(this.scene, terrainSystem, {
      enabled: this.config.enabled ?? true,
      faunaTypes: this.config.faunaTypes
    });
    this.system.create();
  }

  init(renderer) {
    // FaunaSystem initializes in create()
  }

  update() {
    if (!this.system) return;

    const { delta, elapsed, audioData, roverZ, terrainY } = this.context;
    this.system.update(delta, elapsed, audioData, roverZ, terrainY);
  }

  dispose() {
    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }
}

export default FaunaAdapter;

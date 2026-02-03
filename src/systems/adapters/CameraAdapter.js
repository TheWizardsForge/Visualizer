import { BaseSystem } from '../../core/BaseSystem.js';
import { CameraSystem } from '../CameraSystem.js';

/**
 * CameraAdapter - Adapts CameraSystem to use WorldContext
 */
export class CameraAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // Camera is required in config
    this.camera = config.camera;
    this.system = null;
  }

  create() {
    // Get terrain system from context
    const terrainSystem = this.context.terrainSystem;

    this.system = new CameraSystem(this.camera, terrainSystem, {
      fov: this.config.fov ?? 90,
      cameraHeight: this.config.cameraHeight ?? 4.0
    });
  }

  init(renderer) {
    // CameraSystem initializes in constructor
  }

  update() {
    if (!this.system) return;

    const { delta, elapsed, roverZ, terrainY, roverX } = this.context;
    this.system.update(delta, elapsed, roverZ, terrainY, roverX);
  }

  dispose() {
    // CameraSystem doesn't have dispose, nothing to clean up
    this.system = null;
  }

  // Passthrough properties and methods
  get mode() {
    return this.system?.mode;
  }

  set mode(value) {
    if (this.system) {
      this.system.mode = value;
    }
  }

  setMode(mode) {
    if (this.system) {
      this.system.setMode(mode);
    }
  }

  onResize(width, height) {
    if (this.system?.onResize) {
      this.system.onResize(width, height);
    }
    // Also update camera aspect ratio directly
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }
}

export default CameraAdapter;

/**
 * BaseSystem - Abstract base class for all visual systems
 *
 * Provides:
 * - Consistent lifecycle (create → init → update → dispose)
 * - Access to WorldContext for shared state
 * - Convenience getters for common state values
 *
 * Systems extend this and implement the lifecycle methods they need.
 */
export class BaseSystem {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {WorldContext} context - Shared world state
   * @param {Object} config - System-specific configuration
   */
  constructor(scene, context, config = {}) {
    this.scene = scene;
    this.context = context;
    this.config = config;

    // Track initialization state
    this._created = false;
    this._initialized = false;
    this._disposed = false;

    // Optional name for debugging
    this.name = config.name || this.constructor.name;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE METHODS - Override these in subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create geometry, materials, meshes
   * Called once during setup, before renderer is available
   */
  create() {
    // Override in subclass
  }

  /**
   * Initialize GPU resources that require renderer
   * Called once after renderer is ready
   * @param {THREE.WebGLRenderer} renderer
   */
  init(renderer) {
    // Override in subclass
  }

  /**
   * Per-frame update
   * Reads state from this.context, updates system state
   * Called every frame by SystemManager
   */
  update() {
    // Override in subclass
  }

  /**
   * Clean up all resources
   * Called when system is being destroyed
   */
  dispose() {
    // Override in subclass
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE MANAGEMENT - Called by SystemManager
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * @internal Called by SystemManager
   */
  _create() {
    if (this._created) return;
    this.create();
    this._created = true;
  }

  /**
   * @internal Called by SystemManager
   */
  _init(renderer) {
    if (this._initialized) return;
    if (!this._created) {
      this._create();
    }
    this.init(renderer);
    this._initialized = true;
  }

  /**
   * @internal Called by SystemManager
   */
  _update() {
    if (!this._initialized || this._disposed) return;
    this.update();
  }

  /**
   * @internal Called by SystemManager
   */
  _dispose() {
    if (this._disposed) return;
    this.dispose();
    this._disposed = true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVENIENCE GETTERS - Access common WorldContext values
  // ─────────────────────────────────────────────────────────────────────────────

  /** Time since last frame in seconds */
  get delta() {
    return this.context.delta;
  }

  /** Total elapsed time in seconds */
  get elapsed() {
    return this.context.elapsed;
  }

  /** Rover Z position (viewer location along forward axis) */
  get roverZ() {
    return this.context.roverZ;
  }

  /** Rover X position (viewer lateral position) */
  get roverX() {
    return this.context.roverX;
  }

  /** Current terrain Y offset */
  get terrainY() {
    return this.context.terrainY;
  }

  /** Sun brightness (0=night, 1=noon) */
  get sunBrightness() {
    return this.context.sunBrightness;
  }

  /** Day/night cycle (0-1) */
  get dayNightCycle() {
    return this.context.dayNightCycle;
  }

  /** Audio data object (null if disabled) */
  get audioData() {
    return this.context.audioData;
  }

  /** Audio bass level (0 if no audio) */
  get bass() {
    return this.context.bass;
  }

  /** Audio mid level (0 if no audio) */
  get mid() {
    return this.context.mid;
  }

  /** Audio treble level (0 if no audio) */
  get treble() {
    return this.context.treble;
  }

  /** Z-wrap range for infinite scrolling */
  get wrapRange() {
    return this.context.wrapRange;
  }

  /** Light manager reference */
  get lightManager() {
    return this.context.lightManager;
  }

  /** Night factor (0=day, 1=night) */
  get nightFactor() {
    return this.context.nightFactor;
  }

  /** Whether it's currently night */
  get isNight() {
    return this.context.isNight;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get uniforms for dynamic lighting from LightManager
   * Returns empty object if no LightManager available
   */
  getLightingUniforms() {
    if (!this.lightManager) return {};
    return this.lightManager.getUniforms();
  }

  /**
   * Dispose a Three.js object and its resources
   * @param {THREE.Object3D} object
   */
  disposeObject(object) {
    if (!object) return;

    // Dispose geometry
    if (object.geometry) {
      object.geometry.dispose();
    }

    // Dispose material(s)
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => this.disposeMaterial(mat));
      } else {
        this.disposeMaterial(object.material);
      }
    }

    // Remove from parent
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  /**
   * Dispose a material and its textures
   * @param {THREE.Material} material
   */
  disposeMaterial(material) {
    if (!material) return;

    // Dispose textures
    for (const key of Object.keys(material)) {
      const value = material[key];
      if (value && value.isTexture) {
        value.dispose();
      }
    }

    material.dispose();
  }
}

export default BaseSystem;

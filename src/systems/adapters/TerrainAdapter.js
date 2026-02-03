import { BaseSystem } from '../../core/BaseSystem.js';
import { TerrainSystem } from '../TerrainSystem.js';

/**
 * TerrainAdapter - Adapts TerrainSystem to the new BaseSystem interface
 *
 * Reads state from WorldContext and provides terrain height to other systems.
 */
export class TerrainAdapter extends BaseSystem {
  constructor(scene, context, config = {}) {
    super(scene, context, config);

    // Renderer is required in config for height sampler initialization
    this.renderer = config.renderer;

    // The wrapped system
    this.system = null;
  }

  create() {
    // Create the underlying TerrainSystem
    this.system = new TerrainSystem(this.scene, {
      seed: this.config.seed,
      terrainScale: this.config.terrainScale ?? 0.0005,
      terrainHeight: this.config.terrainHeight ?? 35,
      terrainSize: this.config.terrainSize ?? 200,
      terrainSegments: this.config.terrainSegments ?? 150,
      biomes: this.config.biomes,
      biomeCount: this.config.biomeCount ?? 15,
      biomeCycleSpeed: this.config.biomeCycleSpeed ?? 0.0001,
      alienVeins: this.config.alienVeins ?? 1.0,
      grassShadows: this.config.grassShadows ?? 0.0
    });
    this.system.create();

    // Initialize height sampler immediately so other systems can use it during their create()
    if (this.renderer) {
      this.system.initHeightSampler(this.renderer);
    }

    // Store terrain system in context for other systems to access
    this.context.terrainSystem = this.system;
  }

  init(renderer) {
    // Height sampler already initialized in create(), but init again if renderer wasn't available
    if (this.system && !this.system.heightSampler && renderer) {
      this.system.initHeightSampler(renderer);
    }
  }

  update() {
    if (!this.system) return;

    // Read from context
    const { delta, elapsed, audioData, roverZ } = this.context;

    // Update the underlying system
    this.system.update(delta, elapsed, audioData, roverZ);

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

    // Write terrain Y position to context
    if (this.system.terrain) {
      this.context.setTerrainState(
        this.system.terrain.position.y,
        this.config.terrainHeight,
        this.config.terrainScale
      );
    }
  }

  dispose() {
    if (this.system) {
      this.system.dispose();
      this.system = null;
    }
    if (this.context.terrainSystem === this.system) {
      this.context.terrainSystem = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSTHROUGH METHODS - Expose TerrainSystem's API
  // ─────────────────────────────────────────────────────────────────────────────

  get terrain() {
    return this.system?.terrain;
  }

  get config() {
    return this._config;
  }

  set config(value) {
    this._config = value;
  }

  getHeight(x, z) {
    return this.system?.getHeight(x, z) ?? 0;
  }

  getHeights(positions) {
    return this.system?.getHeights(positions) ?? positions.map(() => 0);
  }

  getBiomeAtPosition(worldX, worldZ) {
    return this.system?.getBiomeAtPosition(worldX, worldZ) ?? 0;
  }

  getDefaultBiomes() {
    return this.system?.getDefaultBiomes() ?? [];
  }

  setWeatherTint(color) {
    if (this.system) {
      this.system.setWeatherTint(color);
    }
  }

  triggerEnergyPulse(originX, originZ) {
    if (this.system) {
      this.system.triggerEnergyPulse(originX, originZ);
    }
  }

  setSeed(seed) {
    if (this.system) {
      this.system.setSeed(seed);
    }
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
}

export default TerrainAdapter;

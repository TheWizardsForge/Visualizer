/**
 * WorldContext - Shared state container for all systems
 *
 * Single source of truth for world state. Systems read what they need
 * instead of having state threaded through method parameters.
 *
 * Usage:
 *   const context = new WorldContext();
 *   context.update(delta, elapsed, audioData);
 *   // Systems read: this.context.roverZ, this.context.sunBrightness, etc.
 */
export class WorldContext {
  constructor() {
    // Time
    this.delta = 0;
    this.elapsed = 0;

    // Movement / Rover position
    this.roverZ = 0;
    this.roverX = 0;
    this.roverVelocity = 0;

    // Terrain
    this.terrainY = 0;
    this.terrainHeight = 50;
    this.terrainScale = 1;
    this.wrapRange = 200;

    // Day/Night cycle
    this.dayNightCycle = 0;      // 0-1 normalized time of day
    this.sunBrightness = 1;      // 0=night, 1=noon
    this.sunHeight = 1;          // Sun position for sky calculations

    // Audio (null when disabled)
    this.audioData = null;

    // Services (set by PlanarMode)
    this.lightManager = null;
    this.terrainSystem = null;   // For height sampling

    // Realm info
    this.currentRealm = null;
    this.realmTransitioning = false;

    // Quality settings
    this.quality = {
      terrainSegments: 256,
      grassCount: 50000,
      clutterDensity: 1.0
    };
  }

  /**
   * Update time and audio state each frame
   * Called by PlanarMode before system updates
   */
  update(delta, elapsed, audioData) {
    this.delta = delta;
    this.elapsed = elapsed;
    this.audioData = audioData;
  }

  /**
   * Update rover position
   * Called by PlanarMode after movement calculations
   */
  setRoverPosition(x, z, velocity = 0) {
    this.roverX = x;
    this.roverZ = z;
    this.roverVelocity = velocity;
  }

  /**
   * Update day/night state
   * Called by AtmosphereSystem after cycle update
   */
  setDayNightState(cycle, sunBrightness, sunHeight = null) {
    this.dayNightCycle = cycle;
    this.sunBrightness = sunBrightness;
    if (sunHeight !== null) {
      this.sunHeight = sunHeight;
    }
  }

  /**
   * Update terrain state
   * Called by TerrainSystem after mesh updates
   */
  setTerrainState(terrainY, height = null, scale = null) {
    this.terrainY = terrainY;
    if (height !== null) this.terrainHeight = height;
    if (scale !== null) this.terrainScale = scale;
  }

  /**
   * Set quality settings
   */
  setQuality(quality) {
    this.quality = { ...this.quality, ...quality };
  }

  /**
   * Set current realm
   */
  setRealm(realm, transitioning = false) {
    this.currentRealm = realm;
    this.realmTransitioning = transitioning;
  }

  /**
   * Helper: Check if audio is enabled
   */
  get hasAudio() {
    return this.audioData !== null;
  }

  /**
   * Helper: Get audio bass (0 if disabled)
   */
  get bass() {
    return this.audioData?.bass ?? 0;
  }

  /**
   * Helper: Get audio mid (0 if disabled)
   */
  get mid() {
    return this.audioData?.mid ?? 0;
  }

  /**
   * Helper: Get audio treble (0 if disabled)
   */
  get treble() {
    return this.audioData?.treble ?? 0;
  }

  /**
   * Helper: Get audio overall (0 if disabled)
   */
  get overall() {
    return this.audioData?.overall ?? 0;
  }

  /**
   * Helper: Check if it's night time
   */
  get isNight() {
    return this.sunBrightness < 0.3;
  }

  /**
   * Helper: Get night factor (0=day, 1=night)
   */
  get nightFactor() {
    return 1 - this.sunBrightness;
  }
}

export default WorldContext;

/**
 * RealmBase - Base configuration interface for realms
 *
 * Each realm exports a configuration object that defines:
 * - Terrain biomes and terrain modifiers
 * - Sky/atmosphere settings
 * - Flora and fauna definitions (future)
 * - Weather types available
 * - Special effects and post-processing
 */

/**
 * @typedef {Object} BiomeDefinition
 * @property {string} name - Display name of the biome
 * @property {number[]} low - RGB color array for low elevation [r, g, b] (0-1)
 * @property {number[]} mid - RGB color array for mid elevation [r, g, b] (0-1)
 * @property {number[]} high - RGB color array for high elevation [r, g, b] (0-1)
 * @property {string} [terrainModifier] - Optional terrain shape modifier
 * @property {Object} [flora] - Flora types for this biome (future)
 * @property {Object} [fauna] - Fauna types for this biome (future)
 */

/**
 * @typedef {Object} RealmConfig
 * @property {string} id - Unique identifier for the realm
 * @property {string} name - Display name of the realm
 * @property {string} description - Description of the realm
 *
 * // Terrain
 * @property {BiomeDefinition[]} biomes - Array of biome definitions
 * @property {number} [biomeCount] - Number of biomes (default: biomes.length)
 * @property {number} [biomeCycleSpeed] - How fast biomes cycle (default: 0.0001)
 * @property {number} [terrainScale] - Base terrain noise scale
 * @property {number} [terrainHeight] - Max terrain height
 * @property {Function} [terrainModifier] - Custom terrain height modifier function
 *
 * // Sky
 * @property {number} skyColor - Background color (hex)
 * @property {number} [moonCount] - Number of moons (0-6)
 * @property {boolean} [hasGasPlanet] - Whether to show gas planet
 * @property {boolean} [hasAurora] - Whether to show aurora
 * @property {number} [starDensity] - Star count
 * @property {number} [nebulaIntensity] - Nebula brightness
 *
 * // Atmosphere
 * @property {number} fogColor - Fog color (hex)
 * @property {number} [fogDensity] - Fog density
 * @property {string[]} [weatherTypes] - Available weather types
 * @property {number} [bloomStrength] - Post-processing bloom strength
 *
 * // Special effects
 * @property {boolean} [underwaterAlways] - Always apply underwater effect
 * @property {boolean} [heatDistortion] - Apply heat shimmer effect
 * @property {boolean} [oversaturated] - Boost color saturation
 * @property {boolean} [floatingIslands] - Enable floating terrain (future)
 *
 * // Audio reactivity
 * @property {Object} [audioReactivity] - Audio response settings
 */

export const RealmBase = {
  id: 'base',
  name: 'Base Realm',
  description: 'Base configuration - extend this for custom realms',

  // Terrain
  biomes: [],
  biomeCount: 1,
  biomeCycleSpeed: 0.0001,
  terrainScale: 0.0005,
  terrainHeight: 35,
  terrainModifier: null,

  // Sky
  skyColor: 0x000008,
  moonCount: 6,
  hasGasPlanet: true,
  hasAurora: true,
  starDensity: 5000,
  nebulaIntensity: 0.5,

  // Atmosphere
  fogColor: 0x0a0a15,
  fogDensity: 0.006,
  weatherTypes: ['clear', 'dust', 'rain', 'lightning', 'snow'],
  bloomStrength: 0.3,

  // Special effects
  underwaterAlways: false,
  heatDistortion: false,
  oversaturated: false,
  floatingIslands: false,

  // Audio reactivity
  audioReactivity: {
    terrainPulse: true,
    auroraResponse: true,
    nebulaResponse: true
  }
};

/**
 * Helper function to create a realm config by merging with base
 * @param {Partial<RealmConfig>} config - Partial realm configuration
 * @returns {RealmConfig} Complete realm configuration
 */
export function createRealmConfig(config) {
  return {
    ...RealmBase,
    ...config,
    audioReactivity: {
      ...RealmBase.audioReactivity,
      ...(config.audioReactivity || {})
    }
  };
}

/**
 * Helper to create a biome definition
 * @param {string} name - Biome name
 * @param {number[]} low - Low elevation color [r, g, b]
 * @param {number[]} mid - Mid elevation color [r, g, b]
 * @param {number[]} high - High elevation color [r, g, b]
 * @param {Object} [options] - Additional options
 * @returns {BiomeDefinition}
 */
export function createBiome(name, low, mid, high, options = {}) {
  return {
    name,
    low,
    mid,
    high,
    ...options
  };
}

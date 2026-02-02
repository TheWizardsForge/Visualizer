import { createRealmConfig, createBiome } from './RealmBase.js';

/**
 * The Verdant Wild - A realm of untamed natural magic
 *
 * Inspired by the Feywild - an oversaturated, magical forest realm
 * with giant mushrooms, crystal glades, and twilight meadows.
 * Colors are more vibrant and plant life is impossibly lush.
 */
export const TheVerdantWild = createRealmConfig({
  id: 'verdant',
  name: 'The Verdant Wild',
  description: 'A realm of untamed natural magic and impossible beauty',

  biomes: [
    createBiome('Fey Grove',
      [0.12, 0.25, 0.10],
      [0.25, 0.50, 0.20],
      [0.40, 0.70, 0.35],
      { terrainModifier: 'rolling', hasAncientTrees: true }
    ),
    createBiome('Giant Mushroom Forest',
      [0.25, 0.15, 0.20],
      [0.50, 0.30, 0.45],
      [0.70, 0.45, 0.65],
      { terrainModifier: 'mushroom', hasGiantMushrooms: true }
    ),
    createBiome('Crystal Glade',
      [0.20, 0.25, 0.30],
      [0.40, 0.50, 0.55],
      [0.65, 0.75, 0.80],
      { terrainModifier: 'gentle', hasCrystals: true }
    ),
    createBiome('Twilight Meadow',
      [0.18, 0.12, 0.25],
      [0.35, 0.25, 0.50],
      [0.55, 0.40, 0.70],
      { terrainModifier: 'gentle', hasFireflies: true }
    ),
    createBiome('Rainbow Falls',
      [0.15, 0.20, 0.15],
      [0.30, 0.45, 0.30],
      [0.50, 0.65, 0.50],
      { terrainModifier: 'terraced', hasWaterfalls: true }
    ),
    createBiome('Enchanted Swamp',
      [0.10, 0.18, 0.12],
      [0.20, 0.35, 0.22],
      [0.32, 0.52, 0.35],
      { terrainModifier: 'flat', hasWillOWisps: true }
    ),
    createBiome('Moonlit Garden',
      [0.15, 0.15, 0.22],
      [0.30, 0.30, 0.45],
      [0.50, 0.50, 0.70],
      { terrainModifier: 'gentle', hasNightBlooms: true }
    ),
    createBiome('Sunburst Clearing',
      [0.30, 0.28, 0.12],
      [0.55, 0.52, 0.25],
      [0.78, 0.75, 0.40],
      { terrainModifier: 'gentle', hasButterflies: true }
    )
  ],

  biomeCount: 8,
  biomeCycleSpeed: 0.00008,
  terrainScale: 0.0004,
  terrainHeight: 30,

  // Sky - perpetual twilight with vibrant colors
  skyColor: 0x0a1510,
  moonCount: 3, // Multiple colorful moons
  hasGasPlanet: false,
  hasAurora: true, // Magical aurora
  starDensity: 3000,
  nebulaIntensity: 0.7, // Vibrant magical clouds

  // Atmosphere - mystical green-tinged fog
  fogColor: 0x102018,
  fogDensity: 0.004, // Lighter fog for visibility
  weatherTypes: ['clear', 'pollen', 'fireflies', 'rainbow_mist'],
  bloomStrength: 0.4,

  // Special effects
  underwaterAlways: false,
  heatDistortion: false,
  oversaturated: true, // Boost all colors

  // Custom verdant settings
  saturationBoost: 1.3,
  magicParticles: true,
  floatingPollen: true,

  // Audio reactivity
  audioReactivity: {
    terrainPulse: true,
    auroraResponse: true,
    nebulaResponse: true,
    floraPulse: true, // Plants sway with music
    fireflyDance: true, // Fireflies respond to treble
    magicSparkle: true // Ambient particles pulse with beat
  }
});

export default TheVerdantWild;

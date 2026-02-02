import { createRealmConfig, createBiome } from './RealmBase.js';

/**
 * The Drift - A realm of endless sky and floating islands
 *
 * Inspired by the Plane of Air - a realm of cloud peaks, floating islands,
 * and perpetual wind. Features dramatic sunsets, storm islands, and
 * crystal spires reaching into the heavens.
 */
export const TheDrift = createRealmConfig({
  id: 'drift',
  name: 'The Drift',
  description: 'A realm of endless sky and floating islands among the clouds',

  biomes: [
    createBiome('Cloud Peaks',
      [0.60, 0.65, 0.75],
      [0.75, 0.80, 0.90],
      [0.92, 0.94, 0.98],
      { terrainModifier: 'peaks', hasCloudCaps: true }
    ),
    createBiome('Storm Islands',
      [0.30, 0.35, 0.45],
      [0.45, 0.50, 0.60],
      [0.60, 0.65, 0.75],
      { terrainModifier: 'jagged', hasLightning: true }
    ),
    createBiome('Sunset Cliffs',
      [0.50, 0.35, 0.30],
      [0.70, 0.50, 0.45],
      [0.85, 0.70, 0.60],
      { terrainModifier: 'cliffs' }
    ),
    createBiome('Crystal Spires',
      [0.40, 0.50, 0.60],
      [0.60, 0.70, 0.80],
      [0.82, 0.90, 0.98],
      { terrainModifier: 'spires', hasCrystalFormations: true }
    ),
    createBiome('Wind Gardens',
      [0.35, 0.45, 0.35],
      [0.55, 0.65, 0.55],
      [0.75, 0.85, 0.75],
      { terrainModifier: 'gentle', hasWindFlowers: true }
    ),
    createBiome('Aurora Heights',
      [0.25, 0.30, 0.45],
      [0.45, 0.52, 0.68],
      [0.65, 0.75, 0.88],
      { terrainModifier: 'plateau', hasAuroraWells: true }
    ),
    createBiome('Mist Valleys',
      [0.50, 0.55, 0.60],
      [0.65, 0.70, 0.75],
      [0.80, 0.84, 0.88],
      { terrainModifier: 'valley', hasMistFalls: true }
    ),
    createBiome('Skyfire Plains',
      [0.55, 0.40, 0.35],
      [0.72, 0.55, 0.48],
      [0.88, 0.72, 0.62],
      { terrainModifier: 'gentle' }
    )
  ],

  biomeCount: 8,
  biomeCycleSpeed: 0.00006, // Slower transitions for vast spaces
  terrainScale: 0.0003,
  terrainHeight: 45, // Higher peaks

  // Sky - bright and expansive
  skyColor: 0x203040,
  moonCount: 4,
  hasGasPlanet: true,
  hasAurora: true,
  starDensity: 4000,
  nebulaIntensity: 0.6,

  // Atmosphere - light and airy
  fogColor: 0x405060,
  fogDensity: 0.002, // Very light fog for vast visibility
  weatherTypes: ['clear', 'wind', 'storm', 'rainbow', 'cloud_burst'],
  bloomStrength: 0.35,

  // Special effects
  underwaterAlways: false,
  heatDistortion: false,
  oversaturated: false,
  floatingIslands: true, // Enable floating terrain chunks

  // Custom drift settings
  windStrength: 1.5,
  cloudLayers: 5,
  floatingDebrisCount: 200,
  airCurrentVisibility: true,

  // Audio reactivity
  audioReactivity: {
    terrainPulse: true,
    auroraResponse: true,
    nebulaResponse: true,
    windResponse: true, // Wind intensity follows music
    cloudMovement: true, // Clouds flow with rhythm
    crystalResonance: true // Crystals hum with frequencies
  }
});

export default TheDrift;

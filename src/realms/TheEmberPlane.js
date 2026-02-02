import { createRealmConfig, createBiome } from './RealmBase.js';

/**
 * The Ember Plane - A realm of eternal fire and volcanic fury
 *
 * Inspired by the Plane of Fire - a hellish landscape of lava fields,
 * obsidian wastes, and infernal peaks. Features heat distortion effects,
 * ember particles, and dramatic volcanic lighting.
 */
export const TheEmberPlane = createRealmConfig({
  id: 'ember',
  name: 'The Ember Plane',
  description: 'A realm of eternal fire and volcanic fury',

  biomes: [
    createBiome('Lava Fields',
      [0.40, 0.10, 0.05],
      [0.70, 0.20, 0.08],
      [1.00, 0.45, 0.18],
      { terrainModifier: 'flat', hasLavaPools: true, glowIntensity: 2.0 }
    ),
    createBiome('Obsidian Wastes',
      [0.08, 0.06, 0.08],
      [0.15, 0.12, 0.15],
      [0.25, 0.20, 0.25],
      { terrainModifier: 'jagged', reflective: true }
    ),
    createBiome('Ash Dunes',
      [0.25, 0.22, 0.20],
      [0.40, 0.35, 0.32],
      [0.55, 0.50, 0.45],
      { terrainModifier: 'dunes', hasAshClouds: true }
    ),
    createBiome('Infernal Peaks',
      [0.30, 0.08, 0.05],
      [0.55, 0.15, 0.10],
      [0.85, 0.35, 0.22],
      { terrainModifier: 'alpine', hasVolcanos: true }
    ),
    createBiome('Ember Gardens',
      [0.20, 0.12, 0.08],
      [0.42, 0.25, 0.15],
      [0.68, 0.42, 0.28],
      { terrainModifier: 'gentle', hasEmberPlants: true }
    ),
    createBiome('Molten Rivers',
      [0.50, 0.15, 0.05],
      [0.75, 0.28, 0.12],
      [0.95, 0.48, 0.22],
      { terrainModifier: 'canyon', hasLavaRivers: true }
    ),
    createBiome('Cinder Flats',
      [0.18, 0.15, 0.14],
      [0.32, 0.28, 0.25],
      [0.48, 0.42, 0.38],
      { terrainModifier: 'flat', hasCinderCones: true }
    ),
    createBiome('Flame Spires',
      [0.35, 0.12, 0.08],
      [0.60, 0.22, 0.15],
      [0.88, 0.38, 0.25],
      { terrainModifier: 'spires', hasFlameTips: true }
    )
  ],

  biomeCount: 8,
  biomeCycleSpeed: 0.00012,
  terrainScale: 0.0005,
  terrainHeight: 40,

  // Sky - dark red and smoky
  skyColor: 0x100505,
  moonCount: 2, // Dim, red-tinted moons
  hasGasPlanet: false,
  hasAurora: false,
  starDensity: 1500, // Obscured by smoke
  nebulaIntensity: 0.3, // Smoke clouds instead of nebulae

  // Atmosphere - thick with smoke and heat
  fogColor: 0x1a0808,
  fogDensity: 0.008,
  weatherTypes: ['clear', 'ash_storm', 'ember_rain', 'pyroclastic'],
  bloomStrength: 0.6, // Higher for glowing lava

  // Special effects
  underwaterAlways: false,
  heatDistortion: true, // Shimmer effect everywhere
  oversaturated: false,

  // Custom ember settings
  emberParticleCount: 500,
  heatShimmerIntensity: 0.8,
  lavaGlowPulse: true,
  smokeColumns: true,

  // Audio reactivity
  audioReactivity: {
    terrainPulse: true,
    auroraResponse: false,
    nebulaResponse: true, // Smoke responds
    lavaPulse: true, // Lava pools pulse with bass
    emberBurst: true, // Ember particles burst with beats
    heatWave: true // Heat distortion intensifies with music
  }
});

export default TheEmberPlane;

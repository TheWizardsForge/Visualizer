import { createRealmConfig, createBiome } from './RealmBase.js';

/**
 * The Deep - An underwater realm of crushing depths and bioluminescence
 *
 * Inspired by abyssal ocean trenches and alien underwater ecosystems.
 * Features thermal vents, kelp forests, and bioluminescent creatures.
 * The entire realm has an underwater visual filter applied.
 */
export const TheDeep = createRealmConfig({
  id: 'deep',
  name: 'The Deep',
  description: 'An underwater realm of crushing depths and bioluminescence',

  biomes: [
    createBiome('Abyssal Plain',
      [0.02, 0.05, 0.12],
      [0.04, 0.10, 0.20],
      [0.08, 0.18, 0.30],
      { terrainModifier: 'flat' }
    ),
    createBiome('Thermal Vents',
      [0.15, 0.08, 0.05],
      [0.30, 0.15, 0.10],
      [0.50, 0.25, 0.15],
      { terrainModifier: 'volcanic', hasVents: true }
    ),
    createBiome('Bioluminescent Fields',
      [0.05, 0.15, 0.20],
      [0.10, 0.30, 0.35],
      [0.20, 0.50, 0.55],
      { glowIntensity: 1.5 }
    ),
    createBiome('Kelp Forest',
      [0.05, 0.12, 0.08],
      [0.10, 0.25, 0.15],
      [0.15, 0.35, 0.20],
      { terrainModifier: 'gentle', hasKelp: true }
    ),
    createBiome('Coral Caverns',
      [0.15, 0.10, 0.18],
      [0.30, 0.20, 0.35],
      [0.50, 0.35, 0.55],
      { terrainModifier: 'caves', hasCoral: true }
    ),
    createBiome('Crystalline Depths',
      [0.08, 0.12, 0.22],
      [0.15, 0.22, 0.38],
      [0.25, 0.35, 0.55],
      { terrainModifier: 'crystal' }
    ),
    createBiome('The Trench',
      [0.01, 0.02, 0.05],
      [0.02, 0.04, 0.10],
      [0.04, 0.08, 0.18],
      { terrainModifier: 'canyon', extreme: true }
    )
  ],

  biomeCount: 7,
  biomeCycleSpeed: 0.00012,
  terrainScale: 0.0004,
  terrainHeight: 25,

  // Sky - very dark, no visible sky
  skyColor: 0x010308,
  moonCount: 0,
  hasGasPlanet: false,
  hasAurora: false,
  starDensity: 500, // Distant bioluminescent particles instead of stars
  nebulaIntensity: 0.2, // Murky water columns

  // Atmosphere - heavy blue-green fog
  fogColor: 0x051520,
  fogDensity: 0.012, // Denser fog for underwater feel
  weatherTypes: ['clear', 'current', 'bubble_storm'],
  bloomStrength: 0.5, // Higher for bioluminescence

  // Special effects
  underwaterAlways: true,
  heatDistortion: false, // Unless near thermal vents
  oversaturated: false,

  // Custom underwater settings
  waterColor: [0.05, 0.15, 0.25],
  causticIntensity: 0.8,
  bubbleFrequency: 0.3,

  // Audio reactivity
  audioReactivity: {
    terrainPulse: true,
    auroraResponse: false,
    nebulaResponse: true,
    bioluminescencePulse: true, // Creatures pulse with bass
    currentFlow: true // Currents respond to mid frequencies
  }
});

export default TheDeep;

import { createRealmConfig, createBiome } from './RealmBase.js';

/**
 * The Material - The prime plane of existence
 *
 * An alien world with diverse biomes ranging from crystalline tundras
 * to volcanic hellscapes, dense jungles to bioluminescent caves.
 * This is the "default" realm that showcases all biome types.
 */
export const TheMaterial = createRealmConfig({
  id: 'material',
  name: 'The Material',
  description: 'The prime plane of existence - an alien world of diverse landscapes',

  // 15 diverse biomes
  biomes: [
    createBiome('Purple Alien Desert',
      [0.20, 0.14, 0.30],
      [0.35, 0.20, 0.45],
      [0.50, 0.35, 0.60]
    ),
    createBiome('Crystal Blue Tundra',
      [0.15, 0.25, 0.38],
      [0.22, 0.38, 0.55],
      [0.35, 0.52, 0.70]
    ),
    createBiome('Volcanic Hellscape',
      [0.32, 0.10, 0.06],
      [0.55, 0.20, 0.10],
      [0.80, 0.35, 0.15]
    ),
    createBiome('Dense Jungle',
      [0.08, 0.15, 0.05],
      [0.12, 0.28, 0.08],
      [0.18, 0.38, 0.12],
      { terrainModifier: 'jungle' }
    ),
    createBiome('Golden Savanna',
      [0.30, 0.24, 0.14],
      [0.52, 0.42, 0.20],
      [0.72, 0.58, 0.30]
    ),
    createBiome('Frozen Tundra',
      [0.70, 0.75, 0.80],
      [0.80, 0.85, 0.90],
      [0.90, 0.92, 0.95],
      { terrainModifier: 'tundra' }
    ),
    createBiome('Toxic Swamp',
      [0.10, 0.22, 0.10],
      [0.18, 0.42, 0.15],
      [0.28, 0.58, 0.22]
    ),
    createBiome('Ocean Depths',
      [0.02, 0.08, 0.15],
      [0.05, 0.15, 0.25],
      [0.08, 0.22, 0.35],
      { terrainModifier: 'ocean' }
    ),
    createBiome('Coral Reef',
      [0.12, 0.28, 0.32],
      [0.18, 0.45, 0.52],
      [0.30, 0.62, 0.68]
    ),
    createBiome('Rust Wastes',
      [0.28, 0.18, 0.10],
      [0.48, 0.32, 0.18],
      [0.65, 0.42, 0.25]
    ),
    createBiome('Alpine Mountains',
      [0.25, 0.22, 0.18],
      [0.40, 0.38, 0.35],
      [0.85, 0.88, 0.92],
      { terrainModifier: 'alpine' }
    ),
    createBiome('Bamboo Forest',
      [0.15, 0.12, 0.08],
      [0.35, 0.45, 0.25],
      [0.50, 0.60, 0.35],
      { terrainModifier: 'terraced' }
    ),
    createBiome('Bioluminescent Caves',
      [0.08, 0.06, 0.12],
      [0.15, 0.10, 0.25],
      [0.25, 0.18, 0.40],
      { terrainModifier: 'caves' }
    ),
    createBiome('Desert Canyons',
      [0.60, 0.35, 0.20],
      [0.75, 0.50, 0.30],
      [0.85, 0.65, 0.45],
      { terrainModifier: 'canyon' }
    ),
    createBiome('Mushroom Forest',
      [0.22, 0.12, 0.18],
      [0.45, 0.22, 0.38],
      [0.60, 0.35, 0.52],
      { terrainModifier: 'mushroom' }
    )
  ],

  biomeCount: 15,
  biomeCycleSpeed: 0.0001,
  terrainScale: 0.0005,
  terrainHeight: 35,

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

  // Audio reactivity
  audioReactivity: {
    terrainPulse: true,
    auroraResponse: true,
    nebulaResponse: true,
    floraPulse: true
  }
});

export default TheMaterial;

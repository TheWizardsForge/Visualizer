import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';

// Unified Architecture
import { WorldContext, SystemManager } from '../core/index.js';
import { LightManager } from '../lights/index.js';
import {
  AtmosphereAdapter,
  TerrainAdapter,
  GrassAdapter,
  FloraAdapter,
  FaunaAdapter,
  FireflyAdapter,
  WispAdapter,
  SkyAdapter,
  CameraAdapter
} from '../systems/adapters/index.js';

/**
 * PlanarMode - Orchestrates multiple visual systems to create realm experiences
 * This is the main mode that will support multiple realms/planes of existence
 */
export class PlanarMode extends BaseMode {
  constructor(renderer, qualitySettings = {}) {
    super(renderer);

    // Store quality settings
    this.qualitySettings = {
      terrainSegments: qualitySettings.terrainSegments ?? 150,
      grassCount: qualitySettings.grassCount ?? 50000,
      clutterDensity: qualitySettings.clutterDensity ?? 100
    };

    // Initialize parameters
    this.params = {
      speed: 0.5,
      fov: 90,
      terrainScale: 0.0005,
      terrainHeight: 35,
      cameraHeight: 4.0,
      starDensity: 5000,
      nebulaIntensity: 0.5,
      fogDensity: 0.006,
      bloomStrength: 0.3,
      bloomRadius: 0.3,
      bloomThreshold: 0.6,
      scanlines: 0.0,
      chromaticAberration: 0.0,
      vignette: 0.0,
      floraEnabled: true,
      faunaEnabled: true,
      weatherEnabled: true,
      eventsEnabled: true,
      cameraMode: 'normal'
    };

    // Initialize seed
    this.currentSeed = Date.now() % 1000000;
    this.seedInput = this.currentSeed.toString();

    // Rover/movement state
    this.roverPosition = new THREE.Vector3(0, 0, 0);
    this.roverTargetX = 0;     // Target X position for smooth steering
    this.treeAvoidanceEnabled = true;
    this.pathLookAhead = 80;   // How far ahead to plan (units) - extended for smoother avoidance
    this.steeringSmoothness = 0.6; // How quickly to steer toward target
    this.time = 0;

    // Day/night (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
    this.dayNightCycle = 0.3; // Start just after sunrise
    this.dayNightSpeed = 0.005; // Slower day/night cycle

    // Current realm
    this.currentRealm = 'material';
    this.realmTransitioning = false;
    this.realmTransitionProgress = 0;

    // System references (populated by adapters via SystemManager)
    this.terrainSystem = null;
    this.skySystem = null;
    this.atmosphereSystem = null;
    this.cameraSystem = null;
    this.floraSystem = null;
    this.faunaSystem = null;
    this.grassSystem = null;
    this.fireflySystem = null;
    this.wispSystem = null;

    // Unified Architecture components
    this.context = null;
    this.systemManager = null;
    this.lightManager = null;

    this.setupScene();
  }

  getRealmConfig(realmName) {
    // Returns configuration for the specified realm
    const realms = {
      material: {
        name: 'The Material',
        // Terrain - earthlike variety
        biomes: [
          { name: 'Grasslands', low: [0.15, 0.25, 0.08], mid: [0.25, 0.45, 0.12], high: [0.35, 0.55, 0.18] },
          { name: 'Forest', low: [0.08, 0.18, 0.05], mid: [0.12, 0.28, 0.08], high: [0.18, 0.38, 0.12] },
          { name: 'Mountains', low: [0.25, 0.22, 0.20], mid: [0.40, 0.38, 0.35], high: [0.55, 0.52, 0.50] },
          { name: 'Desert', low: [0.55, 0.45, 0.30], mid: [0.70, 0.58, 0.38], high: [0.85, 0.72, 0.50] },
          { name: 'Tundra', low: [0.50, 0.55, 0.58], mid: [0.70, 0.75, 0.78], high: [0.88, 0.90, 0.92] }
        ],
        biomeCount: 5,
        biomeCycleSpeed: 0.00008,
        terrainHeight: 30,
        terrainScale: 0.0004,
        alienVeins: 0, // No glowing alien veins for earthlike realm
        // Sky - earthlike with day/night
        skyType: 'terrestrial',
        skyColor: 0x87CEEB, // Day sky blue
        nightSkyColor: 0x0a0a18,
        starDensity: 3000,
        nebulaIntensity: 0.0,
        moonCount: 1,
        showGasPlanet: false,
        showAurora: false,
        showPulsars: false,
        showSun: true,
        // Atmosphere
        fogColor: 0x8090a0,
        nightFogColor: 0x101520,
        fogDensity: 0.004,
        bloomStrength: 0.15,
        bloomRadius: 0.2,
        underwaterAlways: false,
        heatDistortion: false,
        glitchEnabled: false, // No glitch for natural forest realm
        // Grass & ground cover
        grassEnabled: true,
        grassDensity: 60000,
        grassColor: 0x2d8528, // Brighter forest green
        grassShadows: 0.0, // Per-blade shadows now handled by GrassSystem
        clutterEnabled: true,
        clutterDensity: 150,
        // Flora - realistic procedural trees for earthlike realm
        floraTypes: {
          0: 'proceduralMixed',  // Mixed forest with oaks, pines, willows
          1: 'proceduralOak',    // Oak forests
          2: 'proceduralPine',   // Pine forests in mountains
          3: 'desertCanyon',     // Desert shrubs
          4: 'proceduralPine'    // Snowy pines in tundra
        },
        sporeCount: 100,
        // Fauna - earthlike
        faunaTypes: {
          flying: 'birds',
          ground: 'critters',
          swimming: null,
          special: null
        }
      },
      astral: {
        name: 'The Astral Void',
        // Terrain - alien world
        biomes: null, // Uses default 15 alien biomes
        biomeCount: 15,
        biomeCycleSpeed: 0.0001,
        terrainHeight: 35,
        terrainScale: 0.0005,
        // Sky - full space
        skyType: 'space',
        skyColor: 0x000008,
        starDensity: 5000,
        nebulaIntensity: 0.5,
        moonCount: 6,
        showGasPlanet: true,
        showAurora: true,
        showPulsars: true,
        showSun: false,
        // Atmosphere
        fogColor: 0x0a0a15,
        fogDensity: 0.006,
        bloomStrength: 0.3,
        bloomRadius: 0.3,
        underwaterAlways: false,
        heatDistortion: false,
        // Flora - alien space colonization structures
        floraTypes: {
          0: 'alienTendril',    // Tendril plants for alien worlds
          1: 'alienCoral',      // Coral-like alien structures
          2: 'alienCrystal',    // Crystal growths
          3: 'purpleDesert',    // Spore pods
          4: 'alienTendril'     // More tendrils
        },
        sporeCount: 300,
        // Fauna - alien creatures
        faunaTypes: {
          flying: 'alienFlyers',
          ground: 'glowingCritters',
          swimming: null,
          special: 'giantWorm'
        }
      },
      deep: {
        name: 'The Deep',
        // Terrain - smooth ocean floor with trenches
        biomes: [
          { name: 'Abyssal Plain', low: [0.02, 0.05, 0.12], mid: [0.04, 0.10, 0.20], high: [0.08, 0.18, 0.30] },
          { name: 'Thermal Vents', low: [0.15, 0.08, 0.05], mid: [0.30, 0.15, 0.10], high: [0.50, 0.25, 0.15] },
          { name: 'Bioluminescent Fields', low: [0.05, 0.15, 0.20], mid: [0.10, 0.30, 0.35], high: [0.20, 0.50, 0.55] },
          { name: 'Kelp Forest', low: [0.05, 0.12, 0.08], mid: [0.10, 0.25, 0.15], high: [0.15, 0.35, 0.20] },
          { name: 'Coral Caverns', low: [0.15, 0.10, 0.18], mid: [0.30, 0.20, 0.35], high: [0.50, 0.35, 0.55] }
        ],
        biomeCount: 5,
        biomeCycleSpeed: 0.00015,
        terrainHeight: 20, // Smoother ocean floor
        terrainScale: 0.0003,
        // Sky - no stars, just murky ocean above
        skyType: 'underwater',
        skyColor: 0x020810,
        starDensity: 0,
        nebulaIntensity: 0,
        moonCount: 0,
        showGasPlanet: false,
        showAurora: false,
        showPulsars: false,
        // Atmosphere - heavy underwater effects
        fogColor: 0x051525,
        fogDensity: 0.015,
        bloomStrength: 0.4,
        bloomRadius: 0.5,
        underwaterAlways: true,
        underwaterDepth: 0.8,
        heatDistortion: false,
        glitchEnabled: false, // No glitch for underwater realm
        // Flora - deep sea with procedural abyssal tendrils and coral
        floraTypes: {
          0: 'abyssalTendril',  // Bioluminescent deep tendrils
          1: 'thermalVent',     // Thermal vent structures
          2: 'alienCoral',      // Coral structures using space colonization
          3: 'kelp',            // Kelp forests
          4: 'coralReef'        // Traditional coral
        },
        sporeCount: 400,
        // Fauna - underwater creatures
        faunaTypes: {
          flying: null,
          ground: null,
          swimming: 'fish',
          special: 'leviathan'
        }
      },
      verdant: {
        name: 'The Verdant Wild',
        // Terrain - lush rolling hills
        biomes: [
          { name: 'Fey Grove', low: [0.12, 0.25, 0.10], mid: [0.25, 0.50, 0.20], high: [0.40, 0.70, 0.35] },
          { name: 'Giant Mushroom', low: [0.25, 0.15, 0.20], mid: [0.50, 0.30, 0.45], high: [0.70, 0.45, 0.65] },
          { name: 'Crystal Glade', low: [0.20, 0.25, 0.30], mid: [0.40, 0.50, 0.55], high: [0.65, 0.75, 0.80] },
          { name: 'Twilight Meadow', low: [0.18, 0.12, 0.25], mid: [0.35, 0.25, 0.50], high: [0.55, 0.40, 0.70] },
          { name: 'Rainbow Falls', low: [0.15, 0.20, 0.15], mid: [0.30, 0.45, 0.30], high: [0.50, 0.65, 0.50] }
        ],
        biomeCount: 5,
        biomeCycleSpeed: 0.00012,
        terrainHeight: 25,
        terrainScale: 0.0004,
        // Sky - twilight with magical colors
        skyType: 'twilight',
        skyColor: 0x0a1520,
        starDensity: 2000,
        nebulaIntensity: 0.8,
        moonCount: 3,
        showGasPlanet: false,
        showAurora: true,
        showPulsars: false,
        // Atmosphere - magical, slightly foggy
        fogColor: 0x152030,
        fogDensity: 0.008,
        bloomStrength: 0.5,
        bloomRadius: 0.4,
        underwaterAlways: false,
        heatDistortion: false,
        glitchEnabled: false, // No glitch for magical forest realm
        oversaturated: true,
        // Grass - magical purple/teal tinted grass
        grassEnabled: true,
        grassDensity: 50000,
        grassColor: 0x2a6050, // Teal-tinted magical grass
        clutterEnabled: true,
        clutterDensity: 120,
        // Flora - magical fey with procedural branches
        floraTypes: {
          0: 'feyBranches',     // Magical procedural fey branches
          1: 'giantMushroom',   // Giant mushrooms
          2: 'proceduralWillow', // Weeping willow-like trees
          3: 'mushroomForest',  // Smaller mushrooms
          4: 'feyTree'          // Magical trees with lights
        },
        sporeCount: 500,
        // Fauna - fey creatures
        faunaTypes: {
          flying: 'faeries',
          ground: 'mushrooms',
          swimming: null,
          special: null
        }
      },
      drift: {
        name: 'The Drift',
        // Terrain - floating island peaks
        biomes: [
          { name: 'Cloud Peaks', low: [0.60, 0.65, 0.75], mid: [0.75, 0.80, 0.90], high: [0.90, 0.92, 0.98] },
          { name: 'Storm Islands', low: [0.30, 0.35, 0.45], mid: [0.45, 0.50, 0.60], high: [0.60, 0.65, 0.75] },
          { name: 'Sunset Cliffs', low: [0.50, 0.35, 0.30], mid: [0.70, 0.50, 0.45], high: [0.85, 0.70, 0.60] },
          { name: 'Crystal Spires', low: [0.40, 0.50, 0.60], mid: [0.60, 0.70, 0.80], high: [0.80, 0.88, 0.95] },
          { name: 'Wind Gardens', low: [0.35, 0.45, 0.35], mid: [0.55, 0.65, 0.55], high: [0.75, 0.85, 0.75] }
        ],
        biomeCount: 5,
        biomeCycleSpeed: 0.00008,
        terrainHeight: 45, // Dramatic peaks
        terrainScale: 0.0006,
        // Sky - bright, open sky
        skyType: 'daylight',
        skyColor: 0x304560,
        starDensity: 500, // Faint stars
        nebulaIntensity: 0.1,
        moonCount: 2,
        showGasPlanet: false,
        showAurora: false,
        showPulsars: false,
        // Atmosphere - light and airy
        fogColor: 0x506080,
        fogDensity: 0.003,
        bloomStrength: 0.2,
        bloomRadius: 0.2,
        underwaterAlways: false,
        heatDistortion: false,
        glitchEnabled: false, // No glitch for floating islands realm
        floatingIslands: true,
        // Flora - ethereal floating island flora
        floraTypes: {
          0: 'cloudMoss',       // Fluffy cloud-like plants
          1: 'alienCrystal',    // Crystal growth structures
          2: 'proceduralPine',  // Wind-sculpted pines
          3: 'crystalTundra',   // Ice crystals
          4: 'bamboo'           // Flexible bamboo
        },
        sporeCount: 200,
        // Fauna - sky creatures
        faunaTypes: {
          flying: 'skyJellyfish',
          ground: 'crystalCreatures',
          swimming: null,
          special: null
        }
      },
      ember: {
        name: 'The Ember Plane',
        // Terrain - jagged volcanic landscape
        biomes: [
          { name: 'Lava Fields', low: [0.40, 0.10, 0.05], mid: [0.70, 0.20, 0.08], high: [1.00, 0.40, 0.15] },
          { name: 'Obsidian Wastes', low: [0.08, 0.06, 0.08], mid: [0.15, 0.12, 0.15], high: [0.25, 0.20, 0.25] },
          { name: 'Ash Dunes', low: [0.25, 0.22, 0.20], mid: [0.40, 0.35, 0.32], high: [0.55, 0.50, 0.45] },
          { name: 'Infernal Peaks', low: [0.30, 0.08, 0.05], mid: [0.55, 0.15, 0.10], high: [0.80, 0.30, 0.20] },
          { name: 'Ember Gardens', low: [0.20, 0.12, 0.08], mid: [0.40, 0.25, 0.15], high: [0.65, 0.40, 0.25] }
        ],
        biomeCount: 5,
        biomeCycleSpeed: 0.00015,
        terrainHeight: 40, // Jagged peaks
        terrainScale: 0.0007,
        // Sky - smoky, obscured
        skyType: 'infernal',
        skyColor: 0x150505,
        starDensity: 200, // Barely visible through smoke
        nebulaIntensity: 0.0,
        moonCount: 1, // Dim red sun/moon
        showGasPlanet: false,
        showAurora: false,
        showPulsars: false,
        // Atmosphere - smoky, heat distortion
        fogColor: 0x1a0a08,
        fogDensity: 0.012,
        bloomStrength: 0.6,
        bloomRadius: 0.5,
        underwaterAlways: false,
        heatDistortion: true,
        // Flora - volcanic with glowing ember veins
        floraTypes: {
          0: 'emberVeins',      // Glowing procedural ember structures
          1: 'rustWastes',      // Metallic rust plants
          2: 'ashTree',         // Charred dead trees
          3: 'emberPlant',      // Glowing ember pods
          4: 'volcanic'         // Volcanic flora
        },
        sporeCount: 150,
        // Fauna - fire creatures
        faunaTypes: {
          flying: 'embers',
          ground: 'fireElementals',
          swimming: null,
          special: null
        }
      }
    };

    return realms[realmName] || realms.material;
  }

  createAmbientParticles() {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x8866aa,
      size: 0.3,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    this.ambientParticles = new THREE.Points(geometry, material);
    this.scene.add(this.ambientParticles);
  }

  /**
   * Setup scene using the unified architecture (WorldContext, SystemManager, LightManager)
   */
  setupScene() {
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      this.params.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 2, 0);

    // Get realm configuration
    const realmConfig = this.getRealmConfig(this.currentRealm);

    // Create WorldContext - single source of truth for shared state
    this.context = new WorldContext();
    this.context.setQuality(this.qualitySettings);
    this.context.setRealm(this.currentRealm);

    // Create LightManager - central registry for dynamic lights
    this.lightManager = new LightManager();
    this.context.lightManager = this.lightManager;

    // Create SystemManager - handles lifecycle and dependencies
    this.systemManager = new SystemManager(this.context);

    // Register systems with dependencies
    // Order matters: systems are updated in dependency order

    // 1. Terrain (no dependencies, other systems need it)
    const terrainAdapter = new TerrainAdapter(this.scene, this.context, {
      renderer: this.renderer,  // Needed for height sampler initialization
      seed: this.currentSeed,
      terrainScale: realmConfig.terrainScale || this.params.terrainScale,
      terrainHeight: realmConfig.terrainHeight || this.params.terrainHeight,
      terrainSegments: this.qualitySettings.terrainSegments,
      biomes: realmConfig.biomes,
      biomeCount: realmConfig.biomeCount || 15,
      biomeCycleSpeed: realmConfig.biomeCycleSpeed || 0.0001,
      alienVeins: realmConfig.alienVeins ?? 1.0,
      grassShadows: realmConfig.grassShadows ?? 0.0
    });
    this.systemManager.register('terrain', terrainAdapter);

    // 2. Atmosphere (depends on nothing, provides sunBrightness)
    const atmosphereAdapter = new AtmosphereAdapter(this.scene, this.context, {
      camera: this.camera,
      renderer: this.renderer,
      fogDensity: realmConfig.fogDensity || this.params.fogDensity,
      fogColor: realmConfig.fogColor || 0x0a0a15,
      nightFogColor: realmConfig.nightFogColor || null,
      skyColor: realmConfig.skyColor || 0x000008,
      nightSkyColor: realmConfig.nightSkyColor || null,
      bloomStrength: realmConfig.bloomStrength ?? this.params.bloomStrength,
      bloomRadius: realmConfig.bloomRadius ?? this.params.bloomRadius,
      bloomThreshold: this.params.bloomThreshold,
      scanlines: this.params.scanlines,
      chromaticAberration: this.params.chromaticAberration,
      vignette: this.params.vignette,
      dayNightSpeed: this.dayNightSpeed,
      weatherEnabled: this.params.weatherEnabled,
      underwaterAlways: realmConfig.underwaterAlways,
      underwaterDepth: realmConfig.underwaterDepth,
      glitchEnabled: realmConfig.glitchEnabled ?? true
    });
    this.systemManager.register('atmosphere', atmosphereAdapter);

    // 3. Sky (depends on atmosphere for day/night)
    const skyAdapter = new SkyAdapter(this.scene, this.context, {
      seed: this.currentSeed,
      starDensity: realmConfig.starDensity ?? this.params.starDensity,
      nebulaIntensity: realmConfig.nebulaIntensity ?? this.params.nebulaIntensity,
      moonCount: realmConfig.moonCount ?? 6,
      showGasPlanet: realmConfig.showGasPlanet ?? true,
      showAurora: realmConfig.showAurora ?? true,
      showPulsars: realmConfig.showPulsars ?? true,
      skyType: realmConfig.skyType || 'space'
    });
    this.systemManager.register('sky', skyAdapter, ['atmosphere']);

    // 4. Flora (depends on terrain)
    const floraAdapter = new FloraAdapter(this.scene, this.context, {
      enabled: this.params.floraEnabled,
      floraTypes: realmConfig.floraTypes,
      sporeCount: realmConfig.sporeCount || 300
    });
    this.systemManager.register('flora', floraAdapter, ['terrain']);

    // 5. Grass (depends on terrain)
    const grassAdapter = new GrassAdapter(this.scene, this.context, {
      enabled: realmConfig.grassEnabled ?? false,
      instanceCount: Math.min(realmConfig.grassDensity ?? 50000, this.qualitySettings.grassCount),
      grassColor: realmConfig.grassColor ? new THREE.Color(realmConfig.grassColor) : new THREE.Color(0.1, 0.4, 0.05),
      clutterEnabled: realmConfig.clutterEnabled ?? false,
      clutterDensity: Math.min(realmConfig.clutterDensity ?? 100, this.qualitySettings.clutterDensity)
    });
    this.systemManager.register('grass', grassAdapter, ['terrain']);

    // 6. Fauna (depends on terrain)
    const faunaAdapter = new FaunaAdapter(this.scene, this.context, {
      enabled: this.params.faunaEnabled,
      faunaTypes: realmConfig.faunaTypes
    });
    this.systemManager.register('fauna', faunaAdapter, ['terrain']);

    // 7. Firefly (depends on terrain, atmosphere for night check)
    const fireflyAdapter = new FireflyAdapter(this.scene, this.context, {
      count: realmConfig.fireflyCount ?? 300,
      areaSize: 80,
      minHeight: 0.5,
      maxHeight: 6,
      baseColor: realmConfig.fireflyColor ? new THREE.Color(realmConfig.fireflyColor) : new THREE.Color(0.9, 0.95, 0.3),
      intensity: realmConfig.fireflyIntensity ?? 1.2,
      lightRadius: 1.5,
      lightIntensity: 0.03,
      nightOnly: true
    });
    this.systemManager.register('firefly', fireflyAdapter, ['terrain', 'atmosphere']);

    // 8. Wisp (depends on terrain, atmosphere)
    const wispAdapter = new WispAdapter(this.scene, this.context, {
      count: realmConfig.wispCount ?? 40,
      maxLights: realmConfig.wispCount ?? 40,
      areaSize: 100,
      minHeight: 1.5,
      maxHeight: 10,
      baseColor: realmConfig.wispColor ? new THREE.Color(realmConfig.wispColor) : new THREE.Color(1.0, 0.6, 0.2),
      coreColor: new THREE.Color(1.0, 0.9, 0.6),
      intensity: realmConfig.wispIntensity ?? 2.0,
      lightRadius: 15.0,
      lightIntensity: 0.5,
      nightOnly: true
    });
    this.systemManager.register('wisp', wispAdapter, ['terrain', 'atmosphere']);

    // 9. Camera (depends on terrain)
    const cameraAdapter = new CameraAdapter(this.scene, this.context, {
      camera: this.camera,
      fov: this.params.fov,
      cameraHeight: this.params.cameraHeight
    });
    this.systemManager.register('camera', cameraAdapter, ['terrain']);

    // Initialize all systems
    this.systemManager.createAll();
    this.systemManager.initAll(this.renderer);

    // Store references for backward compatibility
    this.terrainSystem = this.systemManager.get('terrain');
    this.atmosphereSystem = this.systemManager.get('atmosphere');
    this.skySystem = this.systemManager.get('sky');
    this.floraSystem = this.systemManager.get('flora');
    this.grassSystem = this.systemManager.get('grass');
    this.faunaSystem = this.systemManager.get('fauna');
    this.fireflySystem = this.systemManager.get('firefly');
    this.wispSystem = this.systemManager.get('wisp');
    this.cameraSystem = this.systemManager.get('camera');

    // Apply realm-specific atmosphere effects
    if (realmConfig.underwaterAlways) {
      this.atmosphereSystem.setUnderwater(true, realmConfig.underwaterDepth || 0.5);
    }

    // Create ambient particles
    this.createAmbientParticles();

    // Debug output
    console.log('Unified Architecture initialized');
    this.systemManager.debugPrintOrder();
  }

  switchRealm(realmName) {
    if (this.realmTransitioning || realmName === this.currentRealm) return;

    this.realmTransitioning = true;
    this.realmTransitionProgress = 0;
    this.nextRealm = realmName;

    // Fade out, switch, fade in will be handled in update
  }

  /**
   * Update all systems via WorldContext and SystemManager
   */
  update(delta, elapsed, audioData) {
    this.time = elapsed;
    const speed = this.params.speed * delta * 10;
    this.roverPosition.z -= speed;

    // Tree trunk avoidance (same as legacy)
    if (this.treeAvoidanceEnabled && this.floraSystem) {
      const nearbyFlora = this.floraSystem.getFloraInPath(3, -this.pathLookAhead, 15, 1.2);
      let bestX = 0;
      let bestScore = -Infinity;
      const laneWidth = 2.5;

      for (let testX = -12; testX <= 12; testX += 1.5) {
        let score = -Math.abs(testX) * 0.1 - Math.abs(testX - this.roverPosition.x) * 0.3;
        for (const flora of nearbyFlora) {
          if (flora.z < 3 && flora.z > -this.pathLookAhead) {
            const distFromLane = Math.abs(testX - flora.x);
            if (distFromLane < laneWidth + flora.radius) {
              const proximityPenalty = (1.0 - Math.abs(flora.z) / this.pathLookAhead);
              score -= (laneWidth + flora.radius - distFromLane) * 5 * (1 + proximityPenalty * 2);
            }
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestX = testX;
        }
      }

      this.roverTargetX += (bestX - this.roverTargetX) * Math.min(1, delta * 0.8);
      this.roverPosition.x += (this.roverTargetX - this.roverPosition.x) * this.steeringSmoothness * delta;
      this.roverPosition.x = Math.max(-12, Math.min(12, this.roverPosition.x));
    }

    // Handle realm transition
    if (this.realmTransitioning) {
      this.realmTransitionProgress += delta * 2;
      if (this.realmTransitionProgress >= 1) {
        this.realmTransitioning = false;
        this.currentRealm = this.nextRealm;
        this.rebuildForRealm(this.currentRealm);
      }
    }

    // Update WorldContext with current state
    this.context.update(delta, elapsed, audioData);
    this.context.setRoverPosition(this.roverPosition.x, this.roverPosition.z, speed);

    // Sync day/night settings TO atmosphere system (allows GUI control)
    if (this.atmosphereSystem) {
      this.atmosphereSystem.dayNightCycle = this.dayNightCycle;
      this.atmosphereSystem.dayNightSpeed = this.dayNightSpeed;
    }

    // Update all systems via SystemManager (automatic dependency ordering)
    this.systemManager.update();

    // Sync day/night cycle back from atmosphere system (for display)
    this.dayNightCycle = this.context.dayNightCycle;
    this.timeOfDay = this.dayNightCycle * 24;

    // Apply night tint to terrain (same as legacy)
    const sunBrightness = this.context.sunBrightness;
    const ambientLevel = 0.15 + sunBrightness * 0.85;
    if (!this._nightTint) this._nightTint = new THREE.Color();
    this._nightTint.setRGB(
      ambientLevel * (0.7 + sunBrightness * 0.3),
      ambientLevel * (0.7 + sunBrightness * 0.3),
      ambientLevel * (0.8 + sunBrightness * 0.2)
    );
    if (this.terrainSystem?.terrain?.material?.uniforms?.uWeatherTint) {
      this.terrainSystem.terrain.material.uniforms.uWeatherTint.value.copy(this._nightTint);
    }

    // Update ambient particles
    if (this.ambientParticles) {
      const positions = this.ambientParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += speed;
        if (positions[i + 2] > 50) positions[i + 2] -= 100;
      }
      this.ambientParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Sync sky effects with day/night
    const sunHeight = -Math.cos(this.dayNightCycle * Math.PI * 2);
    this.skySystem?.setAuroraIntensity(Math.max(0, -sunHeight + 0.3));
    const baseIntensity = this.params.nebulaIntensity;
    const nightBoost = Math.max(0, -sunHeight) * 0.5;
    this.skySystem?.setNebulaIntensity(baseIntensity * (0.5 + nightBoost + (sunHeight < 0 ? 0.5 : 0)));
  }

  rebuildForRealm(realmName) {
    console.log('Rebuilding scene for realm:', realmName);

    // Full scene rebuild via SystemManager
    // Preserve current position and time state
    const preservedState = {
      roverX: this.roverPosition.x,
      roverZ: this.roverPosition.z,
      dayNightCycle: this.dayNightCycle,
      dayNightSpeed: this.dayNightSpeed
    };

    // Dispose all systems
    if (this.systemManager) {
      this.systemManager.disposeAll();
    }
    if (this.lightManager) {
      this.lightManager.dispose();
    }
    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      this.ambientParticles.material.dispose();
      this.ambientParticles = null;
    }

    // Update realm and rebuild
    this.currentRealm = realmName;
    this.context.setRealm(realmName);
    this.setupScene();

    // Restore preserved state
    this.roverPosition.x = preservedState.roverX;
    this.roverPosition.z = preservedState.roverZ;
    this.dayNightCycle = preservedState.dayNightCycle;
    this.dayNightSpeed = preservedState.dayNightSpeed;

    console.log('Realm rebuild complete');
  }

  render(renderer) {
    this.atmosphereSystem.render();
  }

  onResize(width, height) {
    this.cameraSystem.onResize(width, height);
    this.atmosphereSystem.onResize(width, height);
  }

  setupGUI(folder) {
    // World Seed controls
    const seedFolder = folder.addFolder('World Seed');
    seedFolder.add(this, 'seedInput').name('Seed').listen();
    seedFolder.add({
      applySeed: () => {
        const newSeed = parseInt(this.seedInput) || Date.now() % 1000000;
        this.regenerateWorld(newSeed);
      }
    }, 'applySeed').name('Apply Seed');
    seedFolder.add({
      randomSeed: () => {
        const newSeed = Date.now() % 1000000;
        this.seedInput = newSeed.toString();
        this.regenerateWorld(newSeed);
      }
    }, 'randomSeed').name('Random Seed');

    // Realm selector
    const realmOptions = {
      'The Material': 'material',
      'The Astral Void': 'astral',
      'The Deep': 'deep',
      'The Verdant Wild': 'verdant',
      'The Drift': 'drift',
      'The Ember Plane': 'ember'
    };
    folder.add(this, 'currentRealm', realmOptions).name('Realm').onChange(v => {
      this.switchRealm(v);
    });

    // Camera mode
    const cameraModes = {
      'Normal': 'normal',
      'Cinematic': 'cinematic',
      'Orbit': 'orbit',
      'Low': 'low',
      'Scenic': 'scenic'
    };
    folder.add(this.params, 'cameraMode', cameraModes).name('Camera').onChange(v => {
      this.cameraSystem.setMode(v);
    });

    // Basic controls
    folder.add(this.params, 'speed', 0.1, 5).name('Speed');
    folder.add(this.params, 'terrainHeight', 2, 50).name('Terrain Height').onChange(v => {
      this.terrainSystem.config.terrainHeight = v;
    });

    // Toggle controls
    folder.add(this.params, 'weatherEnabled').name('Auto Weather');
    folder.add(this.params, 'eventsEnabled').name('Auto Events');

    // Atmosphere controls
    folder.add(this.params, 'nebulaIntensity', 0, 1.5).name('Nebula').onChange(v => {
      this.skySystem.setNebulaIntensity(v);
    });
    folder.add(this.params, 'fogDensity', 0, 0.02).name('Fog').onChange(v => {
      this.atmosphereSystem.setFogDensity(v);
    });
    folder.add(this, 'dayNightSpeed', 0, 0.05).name('Day/Night Speed');

    // Time of day in 24-hour format (0 = midnight, 12 = noon)
    // dayNightCycle 0 = midnight, 0.25 = 6am, 0.5 = noon, 0.75 = 6pm
    this.timeOfDay = this.dayNightCycle * 24;
    folder.add(this, 'timeOfDay', 0, 24).step(0.1).name('Time (24h)').onChange(v => {
      this.dayNightCycle = v / 24;
    }).listen();

    // Bloom controls
    const bloomFolder = folder.addFolder('Bloom');
    bloomFolder.add(this.params, 'bloomStrength', 0, 2).name('Strength').onChange(v => {
      this.atmosphereSystem.setBloomStrength(v);
    });
    bloomFolder.add(this.params, 'bloomRadius', 0, 1).name('Radius').onChange(v => {
      this.atmosphereSystem.setBloomRadius(v);
    });
    bloomFolder.add(this.params, 'bloomThreshold', 0, 1).name('Threshold').onChange(v => {
      this.atmosphereSystem.setBloomThreshold(v);
    });

    // Weather controls
    const weatherFolder = folder.addFolder('Weather');
    const weatherFuncs = {
      clear: () => this.atmosphereSystem.setWeather('clear'),
      dust: () => this.atmosphereSystem.setWeather('dust'),
      rain: () => this.atmosphereSystem.setWeather('rain'),
      lightning: () => this.atmosphereSystem.setWeather('lightning'),
      snow: () => this.atmosphereSystem.setWeather('snow')
    };
    weatherFolder.add(weatherFuncs, 'clear').name('Clear');
    weatherFolder.add(weatherFuncs, 'dust').name('Dust Storm');
    weatherFolder.add(weatherFuncs, 'rain').name('Rain');
    weatherFolder.add(weatherFuncs, 'lightning').name('Lightning');
    weatherFolder.add(weatherFuncs, 'snow').name('Snow');

    // Events controls
    const eventsFolder = folder.addFolder('Events');
    eventsFolder.add({ meteorShower: () => this.skySystem.triggerMeteorShower() }, 'meteorShower').name('Meteor Shower');
    eventsFolder.add({ glitch: () => this.atmosphereSystem.triggerGlitch() }, 'glitch').name('Trigger Glitch');
    eventsFolder.add({ energyPulse: () => this.triggerEnergyPulse() }, 'energyPulse').name('Energy Pulse');
  }

  regenerateWorld(seed) {
    console.log('Regenerating world with seed:', seed);
    this.currentSeed = seed;

    // Full scene rebuild via SystemManager
    // Preserve current position and time state
    const preservedState = {
      roverX: this.roverPosition.x,
      roverZ: this.roverPosition.z,
      dayNightCycle: this.dayNightCycle,
      dayNightSpeed: this.dayNightSpeed
    };

    // Dispose all systems
    if (this.systemManager) {
      this.systemManager.disposeAll();
    }
    if (this.lightManager) {
      this.lightManager.dispose();
    }
    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      this.ambientParticles.material.dispose();
      this.ambientParticles = null;
    }

    // Rebuild scene with new seed
    this.setupScene();

    // Restore preserved state
    this.roverPosition.x = preservedState.roverX;
    this.roverPosition.z = preservedState.roverZ;
    this.dayNightCycle = preservedState.dayNightCycle;
    this.dayNightSpeed = preservedState.dayNightSpeed;

    console.log('World regeneration complete');
  }

  triggerEnergyPulse() {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    this.terrainSystem.triggerEnergyPulse(x, z);
  }

  dispose() {
    // Dispose all systems via SystemManager
    if (this.systemManager) {
      this.systemManager.disposeAll();
    }
    if (this.lightManager) {
      this.lightManager.dispose();
    }

    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      this.ambientParticles.material.dispose();
    }
  }
}

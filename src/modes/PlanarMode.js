import * as THREE from 'three';
import { BaseMode } from './BaseMode.js';
import { TerrainSystem } from '../systems/TerrainSystem.js';
import { SkySystem } from '../systems/SkySystem.js';
import { AtmosphereSystem } from '../systems/AtmosphereSystem.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { FloraSystem } from '../systems/FloraSystem.js';
import { FaunaSystem } from '../systems/FaunaSystem.js';
import { GrassSystem } from '../systems/GrassSystem.js';
import { SimplexNoise } from '../systems/SimplexNoise.js';

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
    this.time = 0;

    // Day/night (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
    this.dayNightCycle = 0.3; // Start just after sunrise
    this.dayNightSpeed = 0.005; // Slower day/night cycle

    // Current realm
    this.currentRealm = 'material';
    this.realmTransitioning = false;
    this.realmTransitionProgress = 0;

    // Systems will be initialized in setupScene
    this.terrainSystem = null;
    this.skySystem = null;
    this.atmosphereSystem = null;
    this.cameraSystem = null;
    this.floraSystem = null;
    this.faunaSystem = null;
    this.grassSystem = null;

    this.setupScene();
  }

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

    // Initialize Terrain System (use quality settings for segments)
    this.terrainSystem = new TerrainSystem(this.scene, {
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
    this.terrainSystem.create();

    // Initialize Flora System
    this.floraSystem = new FloraSystem(this.scene, this.terrainSystem, {
      enabled: this.params.floraEnabled,
      floraTypes: realmConfig.floraTypes || undefined,
      sporeCount: realmConfig.sporeCount || 300
    });
    this.floraSystem.create();

    // Initialize Fauna System with realm-specific creatures
    this.faunaSystem = new FaunaSystem(this.scene, this.terrainSystem, {
      enabled: this.params.faunaEnabled,
      faunaTypes: realmConfig.faunaTypes || undefined
    });
    this.faunaSystem.create();

    // Initialize Grass System for terrestrial realms (use quality settings)
    this.grassSystem = new GrassSystem(this.scene, this.terrainSystem, {
      enabled: realmConfig.grassEnabled ?? false,
      instanceCount: Math.min(realmConfig.grassDensity ?? 50000, this.qualitySettings.grassCount),
      grassColor: realmConfig.grassColor ? new THREE.Color(realmConfig.grassColor) : new THREE.Color(0.1, 0.4, 0.05),
      clutterEnabled: realmConfig.clutterEnabled ?? false,
      clutterDensity: Math.min(realmConfig.clutterDensity ?? 100, this.qualitySettings.clutterDensity)
    });
    this.grassSystem.create();

    // Initialize Sky System with realm-specific settings
    this.skySystem = new SkySystem(this.scene, {
      seed: this.currentSeed,
      starDensity: realmConfig.starDensity ?? this.params.starDensity,
      nebulaIntensity: realmConfig.nebulaIntensity ?? this.params.nebulaIntensity,
      moonCount: realmConfig.moonCount ?? 6,
      showGasPlanet: realmConfig.showGasPlanet ?? true,
      showAurora: realmConfig.showAurora ?? true,
      showPulsars: realmConfig.showPulsars ?? true,
      skyType: realmConfig.skyType || 'space'
    });
    this.skySystem.create();

    // Initialize Atmosphere System with realm-specific settings
    this.atmosphereSystem = new AtmosphereSystem(
      this.scene,
      this.camera,
      this.renderer,
      {
        fogDensity: realmConfig.fogDensity || this.params.fogDensity,
        fogColor: realmConfig.fogColor || 0x0a0a15,
        bloomStrength: realmConfig.bloomStrength ?? this.params.bloomStrength,
        bloomRadius: realmConfig.bloomRadius ?? this.params.bloomRadius,
        bloomThreshold: this.params.bloomThreshold,
        scanlines: this.params.scanlines,
        chromaticAberration: this.params.chromaticAberration,
        vignette: this.params.vignette,
        skyColor: realmConfig.skyColor || 0x000008
      }
    );
    this.atmosphereSystem.create();
    this.atmosphereSystem.dayNightSpeed = this.dayNightSpeed;

    // Apply realm-specific atmosphere effects
    if (realmConfig.underwaterAlways) {
      this.atmosphereSystem.setUnderwater(true, realmConfig.underwaterDepth || 0.5);
    } else {
      this.atmosphereSystem.setUnderwater(false, 0);
    }

    // Initialize Camera System
    this.cameraSystem = new CameraSystem(this.camera, this.terrainSystem, {
      fov: this.params.fov,
      cameraHeight: this.params.cameraHeight
    });

    // Create ambient particles
    this.createAmbientParticles();
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

  switchRealm(realmName) {
    if (this.realmTransitioning || realmName === this.currentRealm) return;

    this.realmTransitioning = true;
    this.realmTransitionProgress = 0;
    this.nextRealm = realmName;

    // Fade out, switch, fade in will be handled in update
  }

  update(delta, elapsed, audioData) {
    this.time = elapsed;
    const speed = this.params.speed * delta * 10;
    this.roverPosition.z -= speed;

    // Handle realm transition
    if (this.realmTransitioning) {
      this.realmTransitionProgress += delta * 2;
      if (this.realmTransitionProgress >= 1) {
        this.realmTransitioning = false;
        this.currentRealm = this.nextRealm;
        this.rebuildForRealm(this.currentRealm);
      }
    }

    // Calculate ambient light based on sun (for night darkening)
    const sunBrightness = this.atmosphereSystem.sunBrightness;
    const ambientLevel = 0.15 + sunBrightness * 0.85; // 0.15 at night, 1.0 at noon

    // Reuse cached color object to avoid allocations
    if (!this._nightTint) this._nightTint = new THREE.Color();
    this._nightTint.setRGB(
      ambientLevel * (0.7 + sunBrightness * 0.3), // Slightly blue at night
      ambientLevel * (0.7 + sunBrightness * 0.3),
      ambientLevel * (0.8 + sunBrightness * 0.2)
    );
    const nightTint = this._nightTint;

    // Update terrain with day/night tint
    this.terrainSystem.update(delta, elapsed, audioData, this.roverPosition.z);
    if (this.terrainSystem.terrain?.material?.uniforms?.uWeatherTint) {
      this.terrainSystem.terrain.material.uniforms.uWeatherTint.value.copy(nightTint);
    }

    // Update sky (pass day/night cycle for terrestrial skies)
    this.skySystem.update(delta, elapsed, audioData, this.dayNightCycle);

    // Update atmosphere (weather, day/night, post-processing)
    this.atmosphereSystem.dayNightCycle = this.dayNightCycle;
    this.atmosphereSystem.dayNightSpeed = this.dayNightSpeed;
    if (this.params.weatherEnabled) {
      this.atmosphereSystem.update(delta, elapsed, audioData);
    } else {
      this.atmosphereSystem.updateDayNight(delta);
      this.atmosphereSystem.updateGlitch(delta);
    }

    // Update camera
    this.cameraSystem.update(
      delta,
      elapsed,
      this.roverPosition.z,
      this.terrainSystem.terrain.position.y
    );

    // Update flora (pass sun brightness for foliage lighting)
    if (this.params.floraEnabled && this.floraSystem) {
      this.floraSystem.update(delta, elapsed, audioData, this.roverPosition.z, this.atmosphereSystem.sunBrightness);
    }

    // Update grass (pass sun brightness for shadow intensity)
    if (this.grassSystem) {
      this.grassSystem.update(delta, elapsed, audioData, this.roverPosition.z, this.atmosphereSystem.sunBrightness);
    }

    // Update fauna
    if (this.params.faunaEnabled && this.faunaSystem) {
      this.faunaSystem.update(delta, elapsed, audioData, this.roverPosition.z, this.terrainSystem.terrain.position.y);
    }

    // Update day/night cycle
    this.dayNightCycle = this.atmosphereSystem.dayNightCycle;
    this.timeOfDay = this.dayNightCycle * 24; // Sync for GUI display

    // Update ambient particles
    if (this.ambientParticles) {
      const positions = this.ambientParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += speed;
        if (positions[i + 2] > 50) positions[i + 2] -= 100;
      }
      this.ambientParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Sync sky aurora intensity with day/night
    const sunHeight = Math.sin(this.dayNightCycle * Math.PI * 2);
    const auroraIntensity = Math.max(0, -sunHeight + 0.3);
    this.skySystem.setAuroraIntensity(auroraIntensity);

    // Nebula visibility
    const baseIntensity = this.params.nebulaIntensity;
    const nightBoost = Math.max(0, -sunHeight) * 0.5;
    this.skySystem.setNebulaIntensity(baseIntensity * (0.5 + nightBoost + (sunHeight < 0 ? 0.5 : 0)));
  }

  rebuildForRealm(realmName) {
    const config = this.getRealmConfig(realmName);

    // Update terrain with new biomes and settings
    this.terrainSystem.config.biomes = config.biomes || this.terrainSystem.getDefaultBiomes();
    this.terrainSystem.config.biomeCount = config.biomeCount || 15;
    this.terrainSystem.config.biomeCycleSpeed = config.biomeCycleSpeed || 0.0001;
    this.terrainSystem.config.terrainHeight = config.terrainHeight || 35;
    this.terrainSystem.config.terrainScale = config.terrainScale || 0.0005;

    // Rebuild flora for new realm
    if (this.floraSystem) {
      this.floraSystem.dispose();
      this.floraSystem = new FloraSystem(this.scene, this.terrainSystem, {
        enabled: this.params.floraEnabled,
        floraTypes: config.floraTypes || undefined,
        sporeCount: config.sporeCount || 300
      });
      this.floraSystem.create();
    }

    // Rebuild fauna for new realm
    if (this.faunaSystem) {
      this.faunaSystem.dispose();
      this.faunaSystem = new FaunaSystem(this.scene, this.terrainSystem, {
        enabled: this.params.faunaEnabled,
        faunaTypes: config.faunaTypes || undefined
      });
      this.faunaSystem.create();
    }

    // Rebuild grass system for new realm
    if (this.grassSystem) {
      this.grassSystem.dispose();
      this.grassSystem = new GrassSystem(this.scene, this.terrainSystem, {
        enabled: config.grassEnabled ?? false,
        instanceCount: config.grassDensity ?? 50000,
        grassColor: config.grassColor ? new THREE.Color(config.grassColor) : new THREE.Color(0.1, 0.4, 0.05),
        clutterEnabled: config.clutterEnabled ?? false,
        clutterDensity: config.clutterDensity ?? 100
      });
      this.grassSystem.create();
    }

    // Rebuild sky system for new realm
    if (this.skySystem) {
      this.skySystem.dispose();
      this.skySystem = new SkySystem(this.scene, {
        seed: this.currentSeed,
        starDensity: config.starDensity ?? this.params.starDensity,
        nebulaIntensity: config.nebulaIntensity ?? this.params.nebulaIntensity,
        moonCount: config.moonCount ?? 6,
        showGasPlanet: config.showGasPlanet ?? true,
        showAurora: config.showAurora ?? true,
        showPulsars: config.showPulsars ?? true,
        skyType: config.skyType || 'space'
      });
      this.skySystem.create();
    }

    // Update atmosphere settings
    this.atmosphereSystem.setFogDensity(config.fogDensity || this.params.fogDensity);
    this.atmosphereSystem.setBloomStrength(config.bloomStrength ?? this.params.bloomStrength);
    this.atmosphereSystem.setBloomRadius(config.bloomRadius ?? this.params.bloomRadius);

    if (config.fogColor) {
      this.scene.fog.color.setHex(config.fogColor);
    }
    if (config.skyColor) {
      this.scene.background.setHex(config.skyColor);
    }

    // Apply realm-specific effects
    if (config.underwaterAlways) {
      this.atmosphereSystem.setUnderwater(true, config.underwaterDepth || 0.5);
    } else {
      this.atmosphereSystem.setUnderwater(false, 0);
    }
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
    this.currentSeed = seed;
    this.terrainSystem.setSeed(seed);
    this.skySystem.noise = new SimplexNoise(seed);
  }

  triggerEnergyPulse() {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    this.terrainSystem.triggerEnergyPulse(x, z);
  }

  dispose() {
    this.terrainSystem?.dispose();
    this.skySystem?.dispose();
    this.atmosphereSystem?.dispose();
    this.floraSystem?.dispose();
    this.faunaSystem?.dispose();

    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      this.ambientParticles.material.dispose();
    }
  }
}

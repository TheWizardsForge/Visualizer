import * as THREE from 'three';
import { ProceduralFloraSystem } from './ProceduralFloraSystem.js';

/**
 * FloraSystem - Handles biome-specific flora creation and updates
 */
export class FloraSystem {
  constructor(scene, terrainSystem, config = {}) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;

    this.config = {
      enabled: config.enabled ?? true,
      floraTypes: config.floraTypes || this.getDefaultFloraTypes(),
      sporeCount: config.sporeCount ?? 300,
      useProceduralTrees: config.useProceduralTrees ?? false,
      useSpaceColonization: config.useSpaceColonization ?? false,
      ...config
    };

    // Flora organized by biome
    this.biomeFlora = {};
    this.flora = [];

    // Floating spores
    this.spores = null;
    this.sporeVelocities = null;

    // Shared materials (for shader updates)
    this.shaderMaterials = {
      crystal: null,
      ember: null,
      toxic: null,
      coral: null,
      glow: null
    };

    // Audio tracking
    this.floraAudioBass = 0;
    this.floraAudioMid = 0;

    // Movement tracking
    this.roverZ = 0;

    // Procedural flora system for advanced generation
    this.proceduralFlora = new ProceduralFloraSystem();
  }

  getDefaultFloraTypes() {
    // Maps biome IDs to flora creation functions
    return {
      0: 'purpleDesert',
      1: 'crystalTundra',
      2: 'volcanic',
      3: 'jungle',
      4: 'savanna',
      5: 'frozenTundra',
      6: 'toxicSwamp',
      7: 'oceanDepths',
      8: 'coralReef',
      9: 'rustWastes',
      10: 'alpine',
      11: 'bamboo',
      12: 'bioluminescentCaves',
      13: 'desertCanyon',
      14: 'mushroomForest'
    };
  }

  create() {
    if (!this.config.enabled) return;

    // Create flora for each biome type specified in config (fall back to defaults)
    const floraTypes = this.config.floraTypes || this.getDefaultFloraTypes();

    for (const [biomeId, floraType] of Object.entries(floraTypes)) {
      const id = parseInt(biomeId);
      this.createFloraForBiome(id, floraType);
    }

    // Create floating spores (universal)
    this.createFloatingSpores();
  }

  createFloraForBiome(biomeId, floraType) {
    this.biomeFlora[biomeId] = [];

    const creators = {
      purpleDesert: () => this.createPurpleDesertFlora(biomeId),
      crystalTundra: () => this.createCrystalTundraFlora(biomeId),
      volcanic: () => this.createVolcanicFlora(biomeId),
      jungle: () => this.createJungleFlora(biomeId),
      savanna: () => this.createSavannaFlora(biomeId),
      frozenTundra: () => this.createFrozenTundraFlora(biomeId),
      toxicSwamp: () => this.createToxicSwampFlora(biomeId),
      oceanDepths: () => this.createOceanDepthsFlora(biomeId),
      coralReef: () => this.createCoralReefFlora(biomeId),
      rustWastes: () => this.createRustWastesFlora(biomeId),
      alpine: () => this.createAlpineFlora(biomeId),
      bamboo: () => this.createBambooFlora(biomeId),
      bioluminescentCaves: () => this.createCaveFlora(biomeId),
      desertCanyon: () => this.createCanyonFlora(biomeId),
      mushroomForest: () => this.createMushroomFlora(biomeId),
      // Realm-specific types
      kelp: () => this.createKelpFlora(biomeId),
      thermalVent: () => this.createThermalVentFlora(biomeId),
      giantMushroom: () => this.createGiantMushroomFlora(biomeId),
      feyTree: () => this.createFeyTreeFlora(biomeId),
      cloudMoss: () => this.createCloudMossFlora(biomeId),
      emberPlant: () => this.createEmberPlantFlora(biomeId),
      ashTree: () => this.createAshTreeFlora(biomeId),
      abyssal: () => this.createAbyssalFlora(biomeId),
      // Procedural flora types (proctree.js)
      proceduralOak: () => this.createProceduralOakFlora(biomeId),
      proceduralPine: () => this.createProceduralPineFlora(biomeId),
      proceduralWillow: () => this.createProceduralWillowFlora(biomeId),
      proceduralMixed: () => this.createProceduralMixedForest(biomeId),
      // Space colonization flora types
      alienTendril: () => this.createAlienTendrilFlora(biomeId),
      alienCoral: () => this.createAlienCoralFlora(biomeId),
      alienCrystal: () => this.createAlienCrystalFlora(biomeId),
      abyssalTendril: () => this.createAbyssalTendrilFlora(biomeId),
      feyBranches: () => this.createFeyBranchesFlora(biomeId),
      emberVeins: () => this.createEmberVeinsFlora(biomeId)
    };

    if (creators[floraType]) {
      creators[floraType]();
    }
  }

  // Helper to add flora to scene and tracking
  addFlora(flora, biomeId) {
    flora.userData.biome = biomeId;
    flora.visible = false;
    this.scene.add(flora);
    this.biomeFlora[biomeId].push(flora);
    this.flora.push(flora);
  }

  // Biome 0: Purple alien desert - spore pods
  createPurpleDesertFlora(biomeId) {
    const podGeom = new THREE.SphereGeometry(1, 8, 8);
    podGeom.scale(1, 1.3, 1);
    const podMat = new THREE.MeshBasicMaterial({ color: 0x8844aa, transparent: true, opacity: 0.9 });

    for (let i = 0; i < 40; i++) {
      const pod = new THREE.Group();
      const body = new THREE.Mesh(podGeom, podMat.clone());
      const scale = 0.3 + Math.random() * 0.8;
      body.scale.setScalar(scale);
      pod.add(body);

      for (let t = 0; t < 3; t++) {
        const tendril = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.1, scale * 2, 6),
          new THREE.MeshBasicMaterial({ color: 0x663388 })
        );
        tendril.position.y = -scale;
        tendril.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
        pod.add(tendril);
      }

      pod.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      pod.userData.worldX = pod.position.x;
      pod.userData.worldZ = pod.position.z;
      this.addFlora(pod, biomeId);
    }
  }

  // Biome 1: Crystal tundra - ice crystals
  createCrystalTundraFlora(biomeId) {
    const crystalMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vNormal; varying vec3 vPos; void main() { vNormal = normal; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          float shimmer = sin(vPos.y * 8.0 + uTime * 2.0) * 0.15 + 0.85;
          vec3 color = vec3(0.6, 0.85, 1.0) * shimmer + vec3(1.0) * fresnel * 0.5;
          gl_FragColor = vec4(color, 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.shaderMaterials.crystal = crystalMat;

    for (let i = 0; i < 50; i++) {
      const cluster = new THREE.Group();
      const numCrystals = 2 + Math.floor(Math.random() * 4);

      for (let c = 0; c < numCrystals; c++) {
        const height = 1 + Math.random() * 4;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), crystalMat.clone());
        crystal.scale.set(0.3 + Math.random() * 0.5, height, 0.3 + Math.random() * 0.5);
        crystal.position.set((Math.random() - 0.5) * 2, height / 2, (Math.random() - 0.5) * 2);
        crystal.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        cluster.add(crystal);
      }

      cluster.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      cluster.userData.worldX = cluster.position.x;
      cluster.userData.worldZ = cluster.position.z;
      this.addFlora(cluster, biomeId);
    }
  }

  // Biome 2: Volcanic - ember plants
  createVolcanicFlora(biomeId) {
    const emberMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vPos;
        void main() {
          float glow = sin(uTime * 3.0 + vPos.y * 5.0) * 0.3 + 0.7;
          vec3 color = mix(vec3(0.3, 0.05, 0.0), vec3(1.0, 0.4, 0.1), glow * (1.0 - vPos.y * 0.3));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    this.shaderMaterials.ember = emberMat;

    for (let i = 0; i < 35; i++) {
      const plant = new THREE.Group();

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.3, 2 + Math.random() * 2, 6),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
      );
      trunk.position.y = 1;
      plant.add(trunk);

      for (let e = 0; e < 3 + Math.floor(Math.random() * 3); e++) {
        const ember = new THREE.Mesh(
          new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 8, 8),
          emberMat.clone()
        );
        ember.position.set((Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8);
        plant.add(ember);
      }

      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      this.addFlora(plant, biomeId);
    }
  }

  // Biome 3: Jungle - trees and ferns
  createJungleFlora(biomeId) {
    // Trees
    for (let i = 0; i < 50; i++) {
      const tree = new THREE.Group();
      const height = 4 + Math.random() * 6;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.4, height, 8),
        new THREE.MeshBasicMaterial({ color: 0x3d2817 })
      );
      trunk.position.y = height / 2;
      tree.add(trunk);

      const leafCount = 4 + Math.floor(Math.random() * 4);
      for (let l = 0; l < leafCount; l++) {
        const leaf = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5 + Math.random() * 1, 0.6 + Math.random() * 0.4),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.7, 0.2 + Math.random() * 0.1),
            side: THREE.DoubleSide
          })
        );
        leaf.position.set((Math.random() - 0.5) * 1, height - 0.5 + Math.random() * 1, (Math.random() - 0.5) * 1);
        leaf.rotation.set(0.2 + Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.3);
        tree.add(leaf);
      }

      tree.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      this.addFlora(tree, biomeId);
    }

    // Ferns
    for (let i = 0; i < 40; i++) {
      const fern = new THREE.Group();
      const frondCount = 5 + Math.floor(Math.random() * 4);

      for (let f = 0; f < frondCount; f++) {
        const frond = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.2),
          new THREE.MeshBasicMaterial({ color: 0x1a3d0c, side: THREE.DoubleSide })
        );
        frond.position.y = 0.3;
        frond.rotation.set(-0.5, (f / frondCount) * Math.PI * 2, 0);
        fern.add(frond);
      }

      const scale = 0.5 + Math.random() * 0.8;
      fern.scale.setScalar(scale);
      fern.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      fern.userData.worldX = fern.position.x;
      fern.userData.worldZ = fern.position.z;
      this.addFlora(fern, biomeId);
    }
  }

  // Biome 4: Savanna - cacti
  createSavannaFlora(biomeId) {
    for (let i = 0; i < 40; i++) {
      const cactus = new THREE.Group();
      const height = 1.5 + Math.random() * 3;

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, height, 8),
        new THREE.MeshBasicMaterial({ color: 0x556633 })
      );
      body.position.y = height / 2;
      cactus.add(body);

      const armCount = Math.floor(Math.random() * 3);
      for (let a = 0; a < armCount; a++) {
        const armHeight = 0.5 + Math.random() * 1;
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.2, armHeight, 6),
          new THREE.MeshBasicMaterial({ color: 0x556633 })
        );
        arm.position.set(Math.random() > 0.5 ? 0.4 : -0.4, height * 0.4 + Math.random() * height * 0.3, 0);
        arm.rotation.z = (arm.position.x > 0 ? -1 : 1) * (0.3 + Math.random() * 0.5);
        cactus.add(arm);
      }

      if (Math.random() > 0.5) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffcc44 })
        );
        flower.position.y = height + 0.2;
        cactus.add(flower);
      }

      cactus.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      cactus.userData.worldX = cactus.position.x;
      cactus.userData.worldZ = cactus.position.z;
      this.addFlora(cactus, biomeId);
    }
  }

  // Biome 5: Frozen tundra - snow pines and ice
  createFrozenTundraFlora(biomeId) {
    for (let i = 0; i < 40; i++) {
      const pine = new THREE.Group();
      const height = 3 + Math.random() * 5;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.2, height * 0.3, 6),
        new THREE.MeshBasicMaterial({ color: 0x4a3828 })
      );
      trunk.position.y = height * 0.15;
      pine.add(trunk);

      const layers = 3 + Math.floor(Math.random() * 2);
      for (let l = 0; l < layers; l++) {
        const layerHeight = height * 0.3 + l * (height * 0.2);
        const coneSize = (1 - l * 0.25) * 1.5;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(coneSize, height * 0.25, 8),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.35, 0.3, 0.85 - l * 0.1)
          })
        );
        cone.position.y = layerHeight;
        pine.add(cone);
      }

      pine.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      pine.userData.worldX = pine.position.x;
      pine.userData.worldZ = pine.position.z;
      this.addFlora(pine, biomeId);
    }

    // Ice formations
    for (let i = 0; i < 30; i++) {
      const height = 1 + Math.random() * 2;
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, height, 6),
        new THREE.MeshBasicMaterial({ color: 0xc0e8ff, transparent: true, opacity: 0.75 })
      );
      shard.position.set((Math.random() - 0.5) * 200, height / 2, (Math.random() - 0.5) * 200);
      shard.userData.worldX = shard.position.x;
      shard.userData.worldZ = shard.position.z;
      this.addFlora(shard, biomeId);
    }
  }

  // Biome 6: Toxic swamp
  createToxicSwampFlora(biomeId) {
    const toxicMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vPos;
        void main() {
          float pulse = sin(uTime * 3.0 + vPos.x * 5.0) * 0.2 + 0.8;
          vec3 color = vec3(0.2, 0.9, 0.1) * pulse;
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    this.shaderMaterials.toxic = toxicMat;

    for (let i = 0; i < 45; i++) {
      const plant = new THREE.Group();

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.12, 1.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x334422 })
      );
      stem.position.y = 0.75;
      stem.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
      plant.add(stem);

      const bulb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), toxicMat.clone());
      bulb.position.y = 1.5;
      plant.add(bulb);

      const scale = 0.6 + Math.random() * 1.0;
      plant.scale.setScalar(scale);
      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      this.addFlora(plant, biomeId);
    }
  }

  // Biome 7: Ocean depths - kelp and anemones
  createOceanDepthsFlora(biomeId) {
    // Kelp
    for (let i = 0; i < 50; i++) {
      const kelp = new THREE.Group();
      const height = 3 + Math.random() * 5;
      const segments = 5 + Math.floor(Math.random() * 4);

      for (let s = 0; s < segments; s++) {
        const segHeight = height / segments;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.08, segHeight, 4),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.3, 0.5, 0.15 + Math.random() * 0.1)
          })
        );
        seg.position.y = s * segHeight + segHeight / 2;
        seg.rotation.x = (Math.random() - 0.5) * 0.2;
        seg.rotation.z = (Math.random() - 0.5) * 0.2;
        kelp.add(seg);

        if (s > 1 && Math.random() > 0.4) {
          const blade = new THREE.Mesh(
            new THREE.PlaneGeometry(0.4, 0.15),
            new THREE.MeshBasicMaterial({ color: 0x1a4d26, side: THREE.DoubleSide })
          );
          blade.position.set(0.15, s * segHeight, 0);
          blade.rotation.y = Math.random() * Math.PI;
          kelp.add(blade);
        }
      }

      kelp.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      kelp.userData.worldX = kelp.position.x;
      kelp.userData.worldZ = kelp.position.z;
      this.addFlora(kelp, biomeId);
    }

    // Anemones
    for (let i = 0; i < 30; i++) {
      const anemone = new THREE.Group();

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0x2a1a3a })
      );
      base.position.y = 0.15;
      anemone.add(base);

      const tentacleCount = 8 + Math.floor(Math.random() * 6);
      const tentacleColor = new THREE.Color().setHSL(Math.random() > 0.5 ? 0.55 : 0.85, 0.6, 0.4);

      for (let t = 0; t < tentacleCount; t++) {
        const tentacle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.5 + Math.random() * 0.3, 4),
          new THREE.MeshBasicMaterial({ color: tentacleColor })
        );
        const angle = (t / tentacleCount) * Math.PI * 2;
        tentacle.position.set(Math.cos(angle) * 0.2, 0.5, Math.sin(angle) * 0.2);
        tentacle.rotation.x = 0.3 + Math.random() * 0.3;
        tentacle.rotation.y = angle;
        anemone.add(tentacle);
      }

      const scale = 0.6 + Math.random() * 0.8;
      anemone.scale.setScalar(scale);
      anemone.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      anemone.userData.worldX = anemone.position.x;
      anemone.userData.worldZ = anemone.position.z;
      this.addFlora(anemone, biomeId);
    }
  }

  // Biome 8: Coral reef
  createCoralReefFlora(biomeId) {
    const coralMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.2, 0.8, 0.7) } },
      vertexShader: `varying vec3 vNormal; void main() { vNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float wave = sin(uTime * 2.0) * 0.15 + 0.85;
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0))), 1.5);
          vec3 color = uColor * wave + vec3(0.3, 1.0, 0.9) * rim * 0.4;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    this.shaderMaterials.coral = coralMat;

    for (let i = 0; i < 50; i++) {
      const coral = new THREE.Group();

      if (Math.random() > 0.5) {
        // Branch coral
        for (let b = 0; b < 4 + Math.floor(Math.random() * 4); b++) {
          const branchHeight = 0.5 + Math.random() * 1.5;
          const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.15, branchHeight, 6),
            coralMat.clone()
          );
          branch.material.uniforms.uColor.value.setHSL(0.45 + Math.random() * 0.15, 0.8, 0.5);
          branch.position.set((Math.random() - 0.5) * 1, branchHeight / 2, (Math.random() - 0.5) * 1);
          branch.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
          coral.add(branch);
        }
      } else {
        // Brain coral
        const brain = new THREE.Mesh(
          new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 12, 8),
          coralMat.clone()
        );
        brain.scale.y = 0.6;
        brain.position.y = 0.3;
        brain.material.uniforms.uColor.value.setHSL(0.5, 0.7, 0.45);
        coral.add(brain);
      }

      coral.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      coral.userData.worldX = coral.position.x;
      coral.userData.worldZ = coral.position.z;
      this.addFlora(coral, biomeId);
    }
  }

  // Biome 9: Rust wastes
  createRustWastesFlora(biomeId) {
    for (let i = 0; i < 40; i++) {
      const metalPlant = new THREE.Group();
      const height = 1 + Math.random() * 2.5;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.15, height, 6),
        new THREE.MeshBasicMaterial({ color: 0x884422 })
      );
      stem.position.y = height / 2;
      metalPlant.add(stem);

      for (let l = 0; l < 2 + Math.floor(Math.random() * 3); l++) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.02, 0.2),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.08, 0.7, 0.25 + Math.random() * 0.15)
          })
        );
        leaf.position.set(0, height * (0.3 + l * 0.25), 0);
        leaf.rotation.set(0.3 + Math.random() * 0.5, Math.random() * Math.PI * 2, 0);
        metalPlant.add(leaf);
      }

      metalPlant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      metalPlant.userData.worldX = metalPlant.position.x;
      metalPlant.userData.worldZ = metalPlant.position.z;
      this.addFlora(metalPlant, biomeId);
    }
  }

  // Biome 10: Alpine
  createAlpineFlora(biomeId) {
    // Windswept pines
    for (let i = 0; i < 25; i++) {
      const pine = new THREE.Group();
      const height = 2 + Math.random() * 3;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.15, height * 0.6, 5),
        new THREE.MeshBasicMaterial({ color: 0x3d3028 })
      );
      trunk.position.y = height * 0.3;
      trunk.rotation.z = (Math.random() - 0.5) * 0.3;
      pine.add(trunk);

      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, height * 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x2d4a28 })
      );
      foliage.position.y = height * 0.7;
      pine.add(foliage);

      pine.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      pine.userData.worldX = pine.position.x;
      pine.userData.worldZ = pine.position.z;
      this.addFlora(pine, biomeId);
    }

    // Rocky outcrops
    for (let i = 0; i < 35; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.6, 0),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.1, 0.35 + Math.random() * 0.15)
        })
      );
      rock.scale.y = 0.5 + Math.random() * 0.5;
      rock.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      rock.userData.worldX = rock.position.x;
      rock.userData.worldZ = rock.position.z;
      this.addFlora(rock, biomeId);
    }
  }

  // Biome 11: Bamboo
  createBambooFlora(biomeId) {
    for (let i = 0; i < 60; i++) {
      const bamboo = new THREE.Group();
      const height = 5 + Math.random() * 8;
      const segments = Math.floor(height / 1.5);

      for (let s = 0; s < segments; s++) {
        const segHeight = height / segments;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.1, segHeight - 0.05, 8),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.22, 0.4, 0.45 + Math.random() * 0.1)
          })
        );
        seg.position.y = s * segHeight + segHeight / 2;
        bamboo.add(seg);

        const node = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.02, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0x5d7a48 })
        );
        node.position.y = s * segHeight;
        node.rotation.x = Math.PI / 2;
        bamboo.add(node);

        if (s > segments * 0.5 && Math.random() > 0.5) {
          const leafGroup = new THREE.Group();
          for (let l = 0; l < 3; l++) {
            const leaf = new THREE.Mesh(
              new THREE.PlaneGeometry(0.6, 0.12),
              new THREE.MeshBasicMaterial({ color: 0x4a6b35, side: THREE.DoubleSide })
            );
            leaf.rotation.set(-0.3, l * 2.1, 0);
            leafGroup.add(leaf);
          }
          leafGroup.position.y = s * segHeight;
          bamboo.add(leafGroup);
        }
      }

      bamboo.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      bamboo.userData.worldX = bamboo.position.x;
      bamboo.userData.worldZ = bamboo.position.z;
      this.addFlora(bamboo, biomeId);
    }
  }

  // Biome 12: Bioluminescent caves
  createCaveFlora(biomeId) {
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.3, 0.5, 1.0) } },
      vertexShader: `varying vec3 vNormal; void main() { vNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float pulse = sin(uTime * 1.5) * 0.3 + 0.7;
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0))), 1.5);
          vec3 color = uColor * pulse * (0.5 + rim * 0.5);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    this.shaderMaterials.glow = glowMat;

    // Stalagmites
    for (let i = 0; i < 40; i++) {
      const stalagmite = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 + Math.random() * 0.3, 1 + Math.random() * 2, 6),
        glowMat.clone()
      );
      stalagmite.material.uniforms.uColor.value.setHSL(0.55 + Math.random() * 0.15, 0.7, 0.5);
      stalagmite.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      stalagmite.userData.worldX = stalagmite.position.x;
      stalagmite.userData.worldZ = stalagmite.position.z;
      this.addFlora(stalagmite, biomeId);
    }

    // Cave mushrooms
    for (let i = 0; i < 35; i++) {
      const mushroom = new THREE.Group();

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.1, 0.6, 5),
        new THREE.MeshBasicMaterial({ color: 0x2a2035 })
      );
      stem.position.y = 0.3;
      mushroom.add(stem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        glowMat.clone()
      );
      cap.scale.set(1, 0.5, 1);
      cap.position.y = 0.65;
      cap.material.uniforms.uColor.value.setHSL(Math.random() > 0.5 ? 0.75 : 0.55, 0.8, 0.5);
      mushroom.add(cap);

      const scale = 0.6 + Math.random() * 1.2;
      mushroom.scale.setScalar(scale);
      mushroom.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      mushroom.userData.worldX = mushroom.position.x;
      mushroom.userData.worldZ = mushroom.position.z;
      this.addFlora(mushroom, biomeId);
    }
  }

  // Biome 13: Desert canyon
  createCanyonFlora(biomeId) {
    // Desert shrubs
    for (let i = 0; i < 35; i++) {
      const shrub = new THREE.Group();
      const branchCount = 4 + Math.floor(Math.random() * 4);

      for (let b = 0; b < branchCount; b++) {
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.5 + Math.random() * 0.3, 4),
          new THREE.MeshBasicMaterial({ color: 0x6b5a42 })
        );
        branch.position.y = 0.3;
        branch.rotation.set(0.5 + Math.random() * 0.5, (b / branchCount) * Math.PI * 2, 0);
        shrub.add(branch);
      }

      for (let l = 0; l < 6; l++) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 4, 4),
          new THREE.MeshBasicMaterial({ color: 0x7a8a65 })
        );
        leaf.position.set((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
        shrub.add(leaf);
      }

      const scale = 0.6 + Math.random() * 0.8;
      shrub.scale.setScalar(scale);
      shrub.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      shrub.userData.worldX = shrub.position.x;
      shrub.userData.worldZ = shrub.position.z;
      this.addFlora(shrub, biomeId);
    }

    // Rock formations
    for (let i = 0; i < 30; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5 + Math.random() * 1, 0),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.4, 0.4 + Math.random() * 0.15)
        })
      );
      rock.scale.set(1, 0.5 + Math.random() * 0.5, 1);
      rock.rotation.y = Math.random() * Math.PI;
      rock.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      rock.userData.worldX = rock.position.x;
      rock.userData.worldZ = rock.position.z;
      this.addFlora(rock, biomeId);
    }
  }

  // Biome 14: Mushroom forest
  createMushroomFlora(biomeId) {
    for (let i = 0; i < 50; i++) {
      const mushroom = new THREE.Group();
      const height = 1.5 + Math.random() * 4;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, height, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.2, 0.7)
        })
      );
      stem.position.y = height / 2;
      mushroom.add(stem);

      const capSize = 0.8 + Math.random() * 1.2;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capSize, 12, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(
            Math.random() > 0.5 ? 0.85 + Math.random() * 0.1 : 0.75 + Math.random() * 0.08,
            0.6,
            0.4 + Math.random() * 0.2
          )
        })
      );
      cap.scale.set(1, 0.4, 1);
      cap.position.y = height;
      mushroom.add(cap);

      const spotCount = 3 + Math.floor(Math.random() * 5);
      for (let s = 0; s < spotCount; s++) {
        const spot = new THREE.Mesh(
          new THREE.CircleGeometry(0.1 + Math.random() * 0.1, 6),
          new THREE.MeshBasicMaterial({ color: 0xffeedd, side: THREE.DoubleSide })
        );
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * capSize * 0.7;
        spot.position.set(Math.cos(angle) * radius, height + 0.15, Math.sin(angle) * radius);
        spot.rotation.x = -Math.PI / 2;
        mushroom.add(spot);
      }

      mushroom.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      mushroom.userData.worldX = mushroom.position.x;
      mushroom.userData.worldZ = mushroom.position.z;
      this.addFlora(mushroom, biomeId);
    }
  }

  // === REALM-SPECIFIC FLORA ===

  // The Deep: Kelp forests
  createKelpFlora(biomeId) {
    for (let i = 0; i < 60; i++) {
      const kelp = new THREE.Group();
      const height = 5 + Math.random() * 10;
      const segments = 8 + Math.floor(Math.random() * 6);

      for (let s = 0; s < segments; s++) {
        const segHeight = height / segments;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.1, segHeight, 4),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.28, 0.6, 0.12 + Math.random() * 0.08)
          })
        );
        seg.position.y = s * segHeight + segHeight / 2;
        seg.rotation.x = (Math.random() - 0.5) * 0.15;
        seg.rotation.z = (Math.random() - 0.5) * 0.15;
        kelp.add(seg);

        if (s > 2 && Math.random() > 0.3) {
          const blade = new THREE.Mesh(
            new THREE.PlaneGeometry(0.6 + Math.random() * 0.3, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x1a5d26, side: THREE.DoubleSide })
          );
          blade.position.set(0.2, s * segHeight, 0);
          blade.rotation.y = Math.random() * Math.PI;
          kelp.add(blade);
        }
      }

      kelp.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      kelp.userData.worldX = kelp.position.x;
      kelp.userData.worldZ = kelp.position.z;
      this.addFlora(kelp, biomeId);
    }
  }

  // The Deep: Thermal vents
  createThermalVentFlora(biomeId) {
    for (let i = 0; i < 25; i++) {
      const vent = new THREE.Group();

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.8 + Math.random() * 0.5, 2 + Math.random() * 2, 8),
        new THREE.MeshBasicMaterial({ color: 0x2a1a1a })
      );
      cone.position.y = 1;
      vent.add(cone);

      // Tube worms around vent
      const wormCount = 5 + Math.floor(Math.random() * 8);
      for (let w = 0; w < wormCount; w++) {
        const worm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.05, 0.8 + Math.random() * 0.5, 4),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.0, 0.8, 0.4 + Math.random() * 0.2)
          })
        );
        const angle = (w / wormCount) * Math.PI * 2;
        const radius = 0.6 + Math.random() * 0.4;
        worm.position.set(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
        vent.add(worm);
      }

      vent.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      vent.userData.worldX = vent.position.x;
      vent.userData.worldZ = vent.position.z;
      this.addFlora(vent, biomeId);
    }
  }

  // The Verdant Wild: Giant mushrooms - towering fungal forest
  createGiantMushroomFlora(biomeId) {
    // Massive canopy mushrooms
    const giantPositions = this.generateSparsePositions(15, 200, 25);
    for (const pos of giantPositions) {
      const mushroom = new THREE.Group();
      const height = 15 + Math.random() * 20; // Towering 15-35 units tall

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2.5, height, 12),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.15, 0.7 + Math.random() * 0.1)
        })
      );
      stem.position.y = height / 2;
      mushroom.add(stem);

      const capSize = 6 + Math.random() * 8;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capSize, 16, 12),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(
            Math.random() > 0.5 ? 0.85 : 0.75,
            0.65,
            0.35 + Math.random() * 0.2
          )
        })
      );
      cap.scale.set(1, 0.35, 1);
      cap.position.y = height;
      mushroom.add(cap);

      // Glowing spots on cap
      const spotCount = 8 + Math.floor(Math.random() * 10);
      for (let s = 0; s < spotCount; s++) {
        const spot = new THREE.Mesh(
          new THREE.CircleGeometry(0.4 + Math.random() * 0.5, 8),
          new THREE.MeshBasicMaterial({
            color: 0xaaffcc,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
          })
        );
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * capSize * 0.7;
        spot.position.set(Math.cos(angle) * radius, height + 0.3, Math.sin(angle) * radius);
        spot.rotation.x = -Math.PI / 2;
        mushroom.add(spot);
      }

      mushroom.position.set(pos.x, 0, pos.z);
      mushroom.userData.worldX = mushroom.position.x;
      mushroom.userData.worldZ = mushroom.position.z;
      this.addFlora(mushroom, biomeId);
    }

    // Medium mushrooms in clusters
    const mediumPositions = this.generateForestPositions(10, 5, 18);
    for (const pos of mediumPositions) {
      const mushroom = new THREE.Group();
      const height = 5 + Math.random() * 10;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 1, height, 10),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.15, 0.75)
        })
      );
      stem.position.y = height / 2;
      mushroom.add(stem);

      const capSize = 2.5 + Math.random() * 3;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capSize, 12, 10),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(
            Math.random() > 0.5 ? 0.85 : 0.75,
            0.6,
            0.4 + Math.random() * 0.2
          )
        })
      );
      cap.scale.set(1, 0.4, 1);
      cap.position.y = height;
      mushroom.add(cap);

      mushroom.position.set(pos.x, 0, pos.z);
      mushroom.userData.worldX = mushroom.position.x;
      mushroom.userData.worldZ = mushroom.position.z;
      this.addFlora(mushroom, biomeId);
    }

    // Small ground mushrooms
    const smallPositions = this.generateForestPositions(15, 8, 15);
    for (const pos of smallPositions) {
      const mushroom = new THREE.Group();
      const height = 1 + Math.random() * 2;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.25, height, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.2, 0.8)
        })
      );
      stem.position.y = height / 2;
      mushroom.add(stem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.6 + Math.random() * 0.5, 8, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(Math.random(), 0.7, 0.45)
        })
      );
      cap.scale.set(1, 0.5, 1);
      cap.position.y = height;
      mushroom.add(cap);

      mushroom.position.set(pos.x, 0, pos.z);
      mushroom.userData.worldX = mushroom.position.x;
      mushroom.userData.worldZ = mushroom.position.z;
      this.addFlora(mushroom, biomeId);
    }
  }

  // The Verdant Wild: Fey trees - towering magical forest
  createFeyTreeFlora(biomeId) {
    // Ancient giant fey trees
    const ancientPositions = this.generateSparsePositions(12, 200, 30);
    for (const pos of ancientPositions) {
      const tree = new THREE.Group();
      const height = 20 + Math.random() * 25; // Towering 20-45 units

      // Massive twisted trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 2, height, 10),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.35, 0.22)
        })
      );
      trunk.position.y = height / 2;
      trunk.rotation.z = (Math.random() - 0.5) * 0.15;
      tree.add(trunk);

      // Glowing leaves in layers - massive canopy
      const layerCount = 4 + Math.floor(Math.random() * 3);
      for (let l = 0; l < layerCount; l++) {
        const layerY = height * (0.5 + l * 0.15);
        const leafSize = (8 - l * 1) * (1 + Math.random() * 0.3);
        const leaves = new THREE.Mesh(
          new THREE.IcosahedronGeometry(leafSize, 1),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.35 + Math.random() * 0.15, 0.7, 0.3 + l * 0.08),
            transparent: true,
            opacity: 0.85
          })
        );
        leaves.scale.y = 0.5;
        leaves.position.set((Math.random() - 0.5) * 3, layerY, (Math.random() - 0.5) * 3);
        tree.add(leaves);
      }

      // Floating magical lights
      const lightCount = 8 + Math.floor(Math.random() * 10);
      for (let li = 0; li < lightCount; li++) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.2 + Math.random() * 0.3, 6, 6),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.15 + Math.random() * 0.7, 0.9, 0.7),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          })
        );
        light.position.set(
          (Math.random() - 0.5) * 12,
          height * 0.3 + Math.random() * height * 0.6,
          (Math.random() - 0.5) * 12
        );
        tree.add(light);
      }

      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      this.addFlora(tree, biomeId);
    }

    // Medium fey trees
    const mediumPositions = this.generateForestPositions(8, 5, 22);
    for (const pos of mediumPositions) {
      const tree = new THREE.Group();
      const height = 10 + Math.random() * 12;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 1, height, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.3, 0.25)
        })
      );
      trunk.position.y = height / 2;
      trunk.rotation.z = (Math.random() - 0.5) * 0.2;
      tree.add(trunk);

      const layerCount = 3 + Math.floor(Math.random() * 2);
      for (let l = 0; l < layerCount; l++) {
        const layerY = height * (0.5 + l * 0.18);
        const leafSize = (4 - l * 0.6) * (1 + Math.random() * 0.3);
        const leaves = new THREE.Mesh(
          new THREE.IcosahedronGeometry(leafSize, 1),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.35 + Math.random() * 0.15, 0.7, 0.35 + l * 0.1),
            transparent: true,
            opacity: 0.85
          })
        );
        leaves.scale.y = 0.5;
        leaves.position.y = layerY;
        tree.add(leaves);
      }

      // Floating lights
      const lightCount = 4 + Math.floor(Math.random() * 5);
      for (let li = 0; li < lightCount; li++) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 6, 6),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.15 + Math.random() * 0.7, 0.9, 0.7),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          })
        );
        light.position.set(
          (Math.random() - 0.5) * 6,
          height * 0.3 + Math.random() * height * 0.6,
          (Math.random() - 0.5) * 6
        );
        tree.add(light);
      }

      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      this.addFlora(tree, biomeId);
    }
  }

  // The Drift: Cloud moss and air plants
  createCloudMossFlora(biomeId) {
    for (let i = 0; i < 50; i++) {
      const plant = new THREE.Group();

      // Fluffy cloud-like base
      const puffCount = 3 + Math.floor(Math.random() * 4);
      for (let p = 0; p < puffCount; p++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 8, 6),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.55, 0.2, 0.85 + Math.random() * 0.1),
            transparent: true,
            opacity: 0.8
          })
        );
        puff.position.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 0.3,
          (Math.random() - 0.5) * 0.5
        );
        plant.add(puff);
      }

      // Wispy tendrils
      const tendrilCount = 2 + Math.floor(Math.random() * 3);
      for (let t = 0; t < tendrilCount; t++) {
        const tendril = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.04, 0.5 + Math.random() * 0.5, 4),
          new THREE.MeshBasicMaterial({
            color: 0xccddff,
            transparent: true,
            opacity: 0.6
          })
        );
        tendril.position.set(
          (Math.random() - 0.5) * 0.4,
          -0.3,
          (Math.random() - 0.5) * 0.4
        );
        plant.add(tendril);
      }

      const scale = 0.8 + Math.random() * 1.5;
      plant.scale.setScalar(scale);
      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      this.addFlora(plant, biomeId);
    }
  }

  // The Ember Plane: Ember plants
  createEmberPlantFlora(biomeId) {
    const emberMat = this.shaderMaterials.ember || new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vPos;
        void main() {
          float glow = sin(uTime * 3.0 + vPos.y * 5.0) * 0.3 + 0.7;
          vec3 color = mix(vec3(0.3, 0.05, 0.0), vec3(1.0, 0.4, 0.1), glow * (1.0 - vPos.y * 0.3));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    if (!this.shaderMaterials.ember) this.shaderMaterials.ember = emberMat;

    for (let i = 0; i < 40; i++) {
      const plant = new THREE.Group();

      // Charred base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.3, 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
      );
      base.position.y = 0.25;
      plant.add(base);

      // Glowing ember pods
      const podCount = 3 + Math.floor(Math.random() * 4);
      for (let e = 0; e < podCount; e++) {
        const pod = new THREE.Mesh(
          new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 8, 8),
          emberMat.clone()
        );
        const angle = (e / podCount) * Math.PI * 2;
        const height = 0.5 + Math.random() * 1;
        pod.position.set(
          Math.cos(angle) * 0.3,
          height,
          Math.sin(angle) * 0.3
        );
        plant.add(pod);

        // Stem to pod
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.03, height - 0.3, 4),
          new THREE.MeshBasicMaterial({ color: 0x2a1a1a })
        );
        stem.position.set(
          Math.cos(angle) * 0.15,
          height / 2 + 0.1,
          Math.sin(angle) * 0.15
        );
        stem.rotation.x = (Math.random() - 0.5) * 0.2;
        plant.add(stem);
      }

      const scale = 0.8 + Math.random() * 1.2;
      plant.scale.setScalar(scale);
      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      this.addFlora(plant, biomeId);
    }
  }

  // The Ember Plane: Ash trees
  createAshTreeFlora(biomeId) {
    for (let i = 0; i < 25; i++) {
      const tree = new THREE.Group();
      const height = 3 + Math.random() * 5;

      // Blackened trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.3, height, 6),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
      );
      trunk.position.y = height / 2;
      tree.add(trunk);

      // Bare branches
      const branchCount = 3 + Math.floor(Math.random() * 4);
      for (let b = 0; b < branchCount; b++) {
        const branchLength = 1 + Math.random() * 1.5;
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.06, branchLength, 4),
          new THREE.MeshBasicMaterial({ color: 0x252525 })
        );
        const angle = (b / branchCount) * Math.PI * 2;
        branch.position.set(
          Math.cos(angle) * 0.1,
          height * 0.6 + Math.random() * height * 0.3,
          Math.sin(angle) * 0.1
        );
        branch.rotation.set(
          0.5 + Math.random() * 0.5,
          angle,
          0
        );
        tree.add(branch);
      }

      // Occasional ember glow
      if (Math.random() > 0.5) {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
          })
        );
        glow.position.y = height * 0.4 + Math.random() * height * 0.3;
        tree.add(glow);
      }

      tree.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      this.addFlora(tree, biomeId);
    }
  }

  // The Deep: Abyssal floor flora
  createAbyssalFlora(biomeId) {
    // Anglerfish-like lure plants
    for (let i = 0; i < 20; i++) {
      const plant = new THREE.Group();

      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.06, 1.5 + Math.random(), 4),
        new THREE.MeshBasicMaterial({ color: 0x151520 })
      );
      stalk.position.y = 0.75;
      stalk.rotation.x = (Math.random() - 0.5) * 0.3;
      plant.add(stalk);

      // Glowing lure
      const lure = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x44aaff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        })
      );
      lure.position.y = 1.5 + Math.random();
      plant.add(lure);

      const scale = 0.6 + Math.random() * 1;
      plant.scale.setScalar(scale);
      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      this.addFlora(plant, biomeId);
    }

    // Tube worms
    for (let i = 0; i < 30; i++) {
      const worm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.08, 0.5 + Math.random() * 0.8, 5),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.0, 0.7, 0.35 + Math.random() * 0.15)
        })
      );
      worm.position.set((Math.random() - 0.5) * 200, 0.25, (Math.random() - 0.5) * 200);
      worm.userData.worldX = worm.position.x;
      worm.userData.worldZ = worm.position.z;
      this.addFlora(worm, biomeId);
    }
  }

  // Floating spores (universal)
  createFloatingSpores() {
    const sporeCount = this.config.sporeCount;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(sporeCount * 3);
    const velocities = new Float32Array(sporeCount * 3);

    for (let i = 0; i < sporeCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 15 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = Math.random() * 0.2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sporeVelocities = velocities;

    const material = new THREE.PointsMaterial({
      color: 0x88ffaa,
      size: 0.4,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.spores = new THREE.Points(geometry, material);
    this.scene.add(this.spores);
  }

  update(delta, elapsed, audioData, roverZ, sunBrightness = 1.0) {
    if (!this.config.enabled) return;

    this.roverZ = roverZ;

    // Audio tracking
    const bass = audioData?.bass || 0;
    const mid = audioData?.mid || 0;
    this.floraAudioBass += (bass - this.floraAudioBass) * 0.15;
    this.floraAudioMid += (mid - this.floraAudioMid) * 0.15;

    // Update shader materials
    if (this.shaderMaterials.crystal?.uniforms) this.shaderMaterials.crystal.uniforms.uTime.value = elapsed;
    if (this.shaderMaterials.ember?.uniforms) this.shaderMaterials.ember.uniforms.uTime.value = elapsed;
    if (this.shaderMaterials.toxic?.uniforms) this.shaderMaterials.toxic.uniforms.uTime.value = elapsed;
    if (this.shaderMaterials.coral?.uniforms) this.shaderMaterials.coral.uniforms.uTime.value = elapsed;
    if (this.shaderMaterials.glow?.uniforms) this.shaderMaterials.glow.uniforms.uTime.value = elapsed;

    // Update procedural flora materials (rim lighting, sun brightness)
    const sunDirection = new THREE.Vector3(0.5, sunBrightness, 0.3).normalize();
    this.proceduralFlora.updateMaterials(sunDirection, sunBrightness, elapsed);

    // Update floating spores
    if (this.spores) {
      const positions = this.spores.geometry.attributes.position.array;
      const audioBoost = 1 + this.floraAudioMid * 2;

      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += this.sporeVelocities[i] * delta * audioBoost;
        positions[i + 1] += Math.sin(elapsed + i) * delta * 0.5 * audioBoost;
        positions[i + 2] += this.sporeVelocities[i + 2] * delta * audioBoost;

        if (positions[i] > 50) positions[i] -= 100;
        if (positions[i] < -50) positions[i] += 100;
        if (positions[i + 2] > 50) positions[i + 2] -= 100;
        if (positions[i + 2] < -50) positions[i + 2] += 100;
      }
      this.spores.geometry.attributes.position.needsUpdate = true;
      this.spores.material.opacity = 0.5 + this.floraAudioMid * 0.5;
      this.spores.material.size = 0.3 + this.floraAudioBass * 0.3;
    }

    // Update biome flora
    this.updateBiomeFlora(delta, elapsed, sunBrightness);
  }

  updateBiomeFlora(delta, elapsed, sunBrightness) {
    const wrapRange = 200;
    const halfRange = wrapRange / 2;
    const biomeCount = this.terrainSystem.config.biomeCount;

    for (const [biomeIdStr, floraList] of Object.entries(this.biomeFlora)) {
      const targetBiome = parseInt(biomeIdStr);
      if (!floraList) continue;

      floraList.forEach(flora => {
        // Calculate display position with wrapping
        const worldZ = flora.userData.worldZ - this.roverZ;
        const wrappedZ = ((worldZ % wrapRange) + wrapRange * 1.5) % wrapRange - halfRange;
        const actualWorldZ = wrappedZ + this.roverZ;

        // Check biome match
        const biomeAtPosition = this.terrainSystem.getBiomeAtPosition(flora.userData.worldX, actualWorldZ);
        const biomeMatch = Math.abs(biomeAtPosition * biomeCount - targetBiome) < 1.5 ||
                          Math.abs(biomeAtPosition * biomeCount - targetBiome - biomeCount) < 1.5 ||
                          Math.abs(biomeAtPosition * biomeCount - targetBiome + biomeCount) < 1.5;

        flora.visible = biomeMatch;

        if (flora.visible) {
          flora.position.z = wrappedZ;
          flora.position.y = this.terrainSystem.getHeight(flora.userData.worldX, actualWorldZ) +
                            this.terrainSystem.terrain.position.y;

          // Gentle sway
          flora.rotation.x = Math.sin(elapsed * 0.5 + flora.position.x * 0.1) * 0.03;
          flora.rotation.z = Math.cos(elapsed * 0.3 + flora.position.z * 0.1) * 0.03;

          // Update shader uniforms and apply night darkening
          const ambientLevel = 0.15 + sunBrightness * 0.85;
          const nightTint = { r: 0.7, g: 0.75, b: 0.9 };

          flora.traverse(child => {
            if (child.material?.uniforms?.uTime) {
              child.material.uniforms.uTime.value = elapsed + this.floraAudioBass;
            }

            // Apply night darkening to MeshBasicMaterial objects
            if (child.material && child.material.isMeshBasicMaterial) {
              // Store base color if not already stored
              if (!child.userData.baseColor && child.material.color) {
                child.userData.baseColor = child.material.color.clone();
              }
              // Apply night darkening
              if (child.userData.baseColor) {
                const base = child.userData.baseColor;
                const tintedR = base.r * (nightTint.r + (1 - nightTint.r) * sunBrightness) * ambientLevel;
                const tintedG = base.g * (nightTint.g + (1 - nightTint.g) * sunBrightness) * ambientLevel;
                const tintedB = base.b * (nightTint.b + (1 - nightTint.b) * sunBrightness) * ambientLevel;
                child.material.color.setRGB(tintedR, tintedG, tintedB);
              }
            }
          });
        }
      });
    }
  }

  // === PROCEDURAL FLORA ===

  /**
   * Generate clustered positions for forest-like distribution
   * @param {number} clusterCount - Number of tree clusters
   * @param {number} treesPerCluster - Trees per cluster
   * @param {number} clusterRadius - Spread within each cluster
   * @param {number} areaSize - Total area size
   * @returns {Array} Array of {x, z} positions
   */
  generateForestPositions(clusterCount, treesPerCluster, clusterRadius, areaSize = 200) {
    const positions = [];
    const halfArea = areaSize / 2;

    for (let c = 0; c < clusterCount; c++) {
      // Cluster center
      const cx = (Math.random() - 0.5) * areaSize;
      const cz = (Math.random() - 0.5) * areaSize;

      for (let t = 0; t < treesPerCluster; t++) {
        // Position within cluster using gaussian-like distribution
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * Math.random() * clusterRadius; // Squared for center-bias
        const x = cx + Math.cos(angle) * dist;
        const z = cz + Math.sin(angle) * dist;

        // Keep within bounds
        if (Math.abs(x) < halfArea && Math.abs(z) < halfArea) {
          positions.push({ x, z });
        }
      }
    }

    // Add some scattered individual trees
    const scattered = Math.floor(clusterCount * treesPerCluster * 0.2);
    for (let i = 0; i < scattered; i++) {
      positions.push({
        x: (Math.random() - 0.5) * areaSize,
        z: (Math.random() - 0.5) * areaSize
      });
    }

    return positions;
  }

  /**
   * Generate sparse positions (for savanna, tundra)
   */
  generateSparsePositions(count, areaSize = 200, minDistance = 15) {
    const positions = [];
    const halfArea = areaSize / 2;
    let attempts = 0;
    const maxAttempts = count * 10;

    while (positions.length < count && attempts < maxAttempts) {
      const x = (Math.random() - 0.5) * areaSize;
      const z = (Math.random() - 0.5) * areaSize;

      // Check minimum distance from other trees
      let valid = true;
      for (const pos of positions) {
        const dist = Math.sqrt((x - pos.x) ** 2 + (z - pos.z) ** 2);
        if (dist < minDistance) {
          valid = false;
          break;
        }
      }

      if (valid) {
        positions.push({ x, z });
      }
      attempts++;
    }

    return positions;
  }

  // Procedural oak forest - large deciduous trees in clusters
  createProceduralOakFlora(biomeId) {
    const positions = this.generateForestPositions(8, 6, 25); // 8 clusters, 6 trees each, 25 unit radius

    for (const pos of positions) {
      // Large trees: scale 3-6 (roughly 15-30 units tall)
      const scale = 3 + Math.random() * 3;
      const tree = this.proceduralFlora.createOakTree(scale);

      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }

    // Add understory - smaller trees and saplings
    const understory = this.generateForestPositions(6, 4, 20);
    for (const pos of understory) {
      const scale = 1 + Math.random() * 1.5;
      const tree = this.proceduralFlora.createOakTree(scale);
      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }
  }

  // Procedural pine forest - tall conifers
  createProceduralPineFlora(biomeId) {
    const positions = this.generateForestPositions(10, 8, 20); // Denser pine forests

    for (const pos of positions) {
      // Tall pines: scale 4-8 (roughly 25-50 units tall)
      const scale = 4 + Math.random() * 4;
      const tree = this.proceduralFlora.createPineTree(scale);

      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }

    // Younger pines
    const young = this.generateForestPositions(5, 5, 15);
    for (const pos of young) {
      const scale = 1.5 + Math.random() * 2;
      const tree = this.proceduralFlora.createPineTree(scale);
      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }
  }

  // Procedural willow grove - graceful trees near water
  createProceduralWillowFlora(biomeId) {
    // Willows grow in loose groups
    const positions = this.generateForestPositions(5, 3, 30);

    for (const pos of positions) {
      // Large willows: scale 4-7
      const scale = 4 + Math.random() * 3;
      const tree = this.proceduralFlora.createWillowTree(scale);

      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }
  }

  // Mixed procedural forest - diverse temperate forest
  createProceduralMixedForest(biomeId) {
    // Large oaks as dominant trees
    const oakPositions = this.generateForestPositions(6, 4, 30);
    for (const pos of oakPositions) {
      const scale = 4 + Math.random() * 3;
      const tree = this.proceduralFlora.createOakTree(scale);
      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }

    // Pines mixed in
    const pinePositions = this.generateForestPositions(5, 5, 25);
    for (const pos of pinePositions) {
      const scale = 3.5 + Math.random() * 4;
      const tree = this.proceduralFlora.createPineTree(scale);
      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }

    // Occasional willows
    const willowPositions = this.generateSparsePositions(8, 200, 25);
    for (const pos of willowPositions) {
      const scale = 3 + Math.random() * 3;
      const tree = this.proceduralFlora.createWillowTree(scale);
      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }

    // Understory saplings
    const saplings = this.generateForestPositions(8, 5, 20);
    for (const pos of saplings) {
      const scale = 0.8 + Math.random() * 1.2;
      const tree = Math.random() > 0.5
        ? this.proceduralFlora.createOakTree(scale)
        : this.proceduralFlora.createPineTree(scale);
      tree.position.set(pos.x, 0, pos.z);
      tree.userData.worldX = tree.position.x;
      tree.userData.worldZ = tree.position.z;
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tree, biomeId);
    }
  }

  // === ALIEN / FANTASY FLORA ===

  // Alien tendril plants - towering alien structures
  createAlienTendrilFlora(biomeId) {
    // Large dominant tendrils in clusters
    const positions = this.generateForestPositions(6, 4, 25);
    for (const pos of positions) {
      const scale = 3 + Math.random() * 4; // Large alien plants
      const plant = this.proceduralFlora.createTendrilPlant(scale);
      plant.position.set(pos.x, 0, pos.z);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      plant.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(plant, biomeId);
    }

    // Smaller scattered tendrils
    const scattered = this.generateSparsePositions(20, 200, 10);
    for (const pos of scattered) {
      const scale = 1 + Math.random() * 2;
      const plant = this.proceduralFlora.createTendrilPlant(scale);
      plant.position.set(pos.x, 0, pos.z);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      plant.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(plant, biomeId);
    }
  }

  // Coral-like structures - reef-like clusters
  createAlienCoralFlora(biomeId) {
    // Coral grows in dense patches
    const positions = this.generateForestPositions(10, 6, 15);
    for (const pos of positions) {
      const scale = 2 + Math.random() * 3;
      const coral = this.proceduralFlora.createCoralStructure(scale);
      coral.position.set(pos.x, 0, pos.z);
      coral.userData.worldX = coral.position.x;
      coral.userData.worldZ = coral.position.z;
      coral.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(coral, biomeId);
    }

    // Small coral polyps
    const small = this.generateForestPositions(8, 8, 20);
    for (const pos of small) {
      const scale = 0.5 + Math.random() * 1;
      const coral = this.proceduralFlora.createCoralStructure(scale);
      coral.position.set(pos.x, 0, pos.z);
      coral.userData.worldX = coral.position.x;
      coral.userData.worldZ = coral.position.z;
      coral.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(coral, biomeId);
    }
  }

  // Crystal growth - towering crystalline formations
  createAlienCrystalFlora(biomeId) {
    // Large crystal formations
    const positions = this.generateSparsePositions(15, 200, 20);
    for (const pos of positions) {
      const scale = 3 + Math.random() * 5; // Tall crystals
      const crystal = this.proceduralFlora.createCrystalGrowth(scale);
      crystal.position.set(pos.x, 0, pos.z);
      crystal.userData.worldX = crystal.position.x;
      crystal.userData.worldZ = crystal.position.z;
      crystal.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(crystal, biomeId);
    }

    // Crystal clusters
    const clusters = this.generateForestPositions(6, 5, 12);
    for (const pos of clusters) {
      const scale = 1 + Math.random() * 2;
      const crystal = this.proceduralFlora.createCrystalGrowth(scale);
      crystal.position.set(pos.x, 0, pos.z);
      crystal.userData.worldX = crystal.position.x;
      crystal.userData.worldZ = crystal.position.z;
      crystal.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(crystal, biomeId);
    }
  }

  // Abyssal tendrils - tall bioluminescent stalks
  createAbyssalTendrilFlora(biomeId) {
    // Tall lure stalks
    const positions = this.generateSparsePositions(25, 200, 12);
    for (const pos of positions) {
      const scale = 2 + Math.random() * 4;
      const tendril = this.proceduralFlora.createAbyssalTendril(scale);
      tendril.position.set(pos.x, 0, pos.z);
      tendril.userData.worldX = tendril.position.x;
      tendril.userData.worldZ = tendril.position.z;
      tendril.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tendril, biomeId);
    }

    // Dense patches of smaller tendrils
    const dense = this.generateForestPositions(5, 8, 10);
    for (const pos of dense) {
      const scale = 0.8 + Math.random() * 1.5;
      const tendril = this.proceduralFlora.createAbyssalTendril(scale);
      tendril.position.set(pos.x, 0, pos.z);
      tendril.userData.worldX = tendril.position.x;
      tendril.userData.worldZ = tendril.position.z;
      tendril.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(tendril, biomeId);
    }
  }

  // Fey branches - magical enchanted forest
  createFeyBranchesFlora(biomeId) {
    // Large magical trees
    const positions = this.generateForestPositions(8, 4, 25);
    for (const pos of positions) {
      const scale = 4 + Math.random() * 4; // Large magical trees
      const fey = this.proceduralFlora.createFeyBranches(scale);
      fey.position.set(pos.x, 0, pos.z);
      fey.userData.worldX = fey.position.x;
      fey.userData.worldZ = fey.position.z;
      fey.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(fey, biomeId);
    }

    // Smaller magical shrubs
    const shrubs = this.generateForestPositions(10, 6, 18);
    for (const pos of shrubs) {
      const scale = 1.5 + Math.random() * 2;
      const fey = this.proceduralFlora.createFeyBranches(scale);
      fey.position.set(pos.x, 0, pos.z);
      fey.userData.worldX = fey.position.x;
      fey.userData.worldZ = fey.position.z;
      fey.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(fey, biomeId);
    }
  }

  // Ember veins - volcanic glowing formations
  createEmberVeinsFlora(biomeId) {
    // Large ember formations
    const positions = this.generateSparsePositions(20, 200, 15);
    for (const pos of positions) {
      const scale = 2 + Math.random() * 3;
      const ember = this.proceduralFlora.createEmberVeins(scale);
      ember.position.set(pos.x, 0, pos.z);
      ember.userData.worldX = ember.position.x;
      ember.userData.worldZ = ember.position.z;
      ember.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(ember, biomeId);
    }

    // Clusters of smaller vents
    const clusters = this.generateForestPositions(8, 5, 12);
    for (const pos of clusters) {
      const scale = 0.8 + Math.random() * 1.5;
      const ember = this.proceduralFlora.createEmberVeins(scale);
      ember.position.set(pos.x, 0, pos.z);
      ember.userData.worldX = ember.position.x;
      ember.userData.worldZ = ember.position.z;
      ember.rotation.y = Math.random() * Math.PI * 2;
      this.addFlora(ember, biomeId);
    }
  }

  dispose() {
    this.flora.forEach(f => {
      this.scene.remove(f);
      f.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });

    if (this.spores) {
      this.scene.remove(this.spores);
      this.spores.geometry.dispose();
      this.spores.material.dispose();
    }
  }
}

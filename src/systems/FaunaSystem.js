import * as THREE from 'three';

/**
 * FaunaSystem - Handles realm-specific creatures and their behaviors
 */
export class FaunaSystem {
  constructor(scene, terrainSystem, config = {}) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;

    this.config = {
      enabled: config.enabled ?? true,
      faunaTypes: config.faunaTypes || this.getDefaultFaunaTypes(),
      ...config
    };

    // Creature collections
    this.flyingCreatures = [];
    this.groundCreatures = [];
    this.swimmingCreatures = [];
    this.specialCreatures = [];

    // Giant worm state
    this.worm = null;
    this.wormSegments = [];
    this.wormState = { active: false, time: 0, x: 0, z: 0 };

    // Movement tracking
    this.roverZ = 0;
    this.terrainY = 0;
  }

  getDefaultFaunaTypes() {
    return {
      flying: 'birds',
      ground: 'critters',
      swimming: null,
      special: 'giantWorm'
    };
  }

  create() {
    if (!this.config.enabled) return;

    const types = this.config.faunaTypes;

    // Create flying creatures
    if (types.flying) {
      this.createFlyingCreatures(types.flying);
    }

    // Create ground creatures
    if (types.ground) {
      this.createGroundCreatures(types.ground);
    }

    // Create swimming creatures
    if (types.swimming) {
      this.createSwimmingCreatures(types.swimming);
    }

    // Create special/rare creatures
    if (types.special) {
      this.createSpecialCreatures(types.special);
    }
  }

  // === FLYING CREATURES ===

  createFlyingCreatures(type) {
    const creators = {
      birds: () => this.createBirds(),
      alienFlyers: () => this.createAlienFlyers(),
      fireflies: () => this.createFireflies(),
      ashMotes: () => this.createAshMotes(),
      skyJellyfish: () => this.createSkyJellyfish(),
      faeries: () => this.createFaeries(),
      embers: () => this.createFlyingEmbers()
    };

    if (creators[type]) {
      creators[type]();
    }
  }

  createBirds() {
    const wingGeom = new THREE.PlaneGeometry(2, 0.5);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x222233, side: THREE.DoubleSide });

    for (let i = 0; i < 15; i++) {
      const bird = new THREE.Group();
      const leftWing = new THREE.Mesh(wingGeom, wingMat);
      const rightWing = new THREE.Mesh(wingGeom, wingMat);
      leftWing.position.x = -1;
      rightWing.position.x = 1;
      bird.add(leftWing, rightWing);

      // Body
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1.5, 4),
        new THREE.MeshBasicMaterial({ color: 0x333344 })
      );
      body.rotation.z = Math.PI / 2;
      bird.add(body);

      bird.position.set(
        (Math.random() - 0.5) * 300,
        40 + Math.random() * 80,
        (Math.random() - 0.5) * 300
      );

      bird.userData = {
        type: 'bird',
        baseY: bird.position.y,
        speed: 0.5 + Math.random() * 0.5,
        wingPhase: Math.random() * Math.PI * 2,
        circleRadius: 50 + Math.random() * 100,
        circleSpeed: 0.0005 + Math.random() * 0.001,
        circlePhase: Math.random() * Math.PI * 2
      };

      this.scene.add(bird);
      this.flyingCreatures.push(bird);
    }
  }

  createAlienFlyers() {
    for (let i = 0; i < 12; i++) {
      const flyer = new THREE.Group();

      // Translucent body
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8, 1),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.7, 0.5),
          transparent: true,
          opacity: 0.7
        })
      );
      flyer.add(body);

      // Glowing core
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xaaffff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        })
      );
      flyer.add(core);

      // Trailing tentacles
      for (let t = 0; t < 4; t++) {
        const tentacle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.02, 2 + Math.random(), 4),
          new THREE.MeshBasicMaterial({
            color: 0x6688ff,
            transparent: true,
            opacity: 0.5
          })
        );
        tentacle.position.y = -1;
        tentacle.rotation.set(Math.random() * 0.3, t * Math.PI / 2, 0);
        flyer.add(tentacle);
      }

      flyer.position.set(
        (Math.random() - 0.5) * 200,
        30 + Math.random() * 60,
        (Math.random() - 0.5) * 200
      );

      flyer.userData = {
        type: 'alienFlyer',
        baseY: flyer.position.y,
        floatSpeed: 0.3 + Math.random() * 0.3,
        floatPhase: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * 0.5,
        driftZ: (Math.random() - 0.5) * 0.5
      };

      this.scene.add(flyer);
      this.flyingCreatures.push(flyer);
    }
  }

  createSkyJellyfish() {
    for (let i = 0; i < 8; i++) {
      const jelly = new THREE.Group();

      // Bell
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(1.5 + Math.random(), 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.6, 0.6),
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        })
      );
      bell.rotation.x = Math.PI;
      jelly.add(bell);

      // Glowing inner
      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 8),
        new THREE.MeshBasicMaterial({
          color: 0xaaddff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending
        })
      );
      inner.position.y = 0.3;
      jelly.add(inner);

      // Tentacles
      for (let t = 0; t < 8; t++) {
        const tentacle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.01, 3 + Math.random() * 2, 4),
          new THREE.MeshBasicMaterial({
            color: 0x88aaff,
            transparent: true,
            opacity: 0.4
          })
        );
        const angle = (t / 8) * Math.PI * 2;
        tentacle.position.set(Math.cos(angle) * 0.8, -1.5, Math.sin(angle) * 0.8);
        jelly.add(tentacle);
      }

      jelly.position.set(
        (Math.random() - 0.5) * 250,
        50 + Math.random() * 100,
        (Math.random() - 0.5) * 250
      );

      jelly.userData = {
        type: 'skyJellyfish',
        baseY: jelly.position.y,
        pulsePhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.1 + Math.random() * 0.2,
        driftAngle: Math.random() * Math.PI * 2
      };

      this.scene.add(jelly);
      this.flyingCreatures.push(jelly);
    }
  }

  createFaeries() {
    for (let i = 0; i < 20; i++) {
      const faerie = new THREE.Group();

      // Glowing body
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(Math.random(), 0.8, 0.7),
          blending: THREE.AdditiveBlending
        })
      );
      faerie.add(body);

      // Wings
      const wingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const wingGeom = new THREE.CircleGeometry(0.3, 8);

      const leftWing = new THREE.Mesh(wingGeom, wingMat);
      leftWing.position.set(-0.2, 0, 0);
      leftWing.rotation.y = -0.3;
      faerie.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeom, wingMat);
      rightWing.position.set(0.2, 0, 0);
      rightWing.rotation.y = 0.3;
      faerie.add(rightWing);

      faerie.position.set(
        (Math.random() - 0.5) * 100,
        2 + Math.random() * 15,
        (Math.random() - 0.5) * 100
      );

      faerie.userData = {
        type: 'faerie',
        baseY: faerie.position.y,
        speed: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        wanderAngle: Math.random() * Math.PI * 2,
        hue: Math.random()
      };

      this.scene.add(faerie);
      this.flyingCreatures.push(faerie);
    }
  }

  createFlyingEmbers() {
    for (let i = 0; i < 30; i++) {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 6, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 1, 0.5 + Math.random() * 0.3),
          blending: THREE.AdditiveBlending
        })
      );

      ember.position.set(
        (Math.random() - 0.5) * 150,
        2 + Math.random() * 30,
        (Math.random() - 0.5) * 150
      );

      ember.userData = {
        type: 'ember',
        baseY: ember.position.y,
        riseSpeed: 0.5 + Math.random() * 1.5,
        driftX: (Math.random() - 0.5) * 2,
        driftZ: (Math.random() - 0.5) * 2,
        life: Math.random(),
        maxLife: 5 + Math.random() * 10
      };

      this.scene.add(ember);
      this.flyingCreatures.push(ember);
    }
  }

  createFireflies() {
    for (let i = 0; i < 25; i++) {
      const firefly = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xffff44,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending
        })
      );

      firefly.position.set(
        (Math.random() - 0.5) * 80,
        1 + Math.random() * 8,
        (Math.random() - 0.5) * 80
      );

      firefly.userData = {
        type: 'firefly',
        baseY: firefly.position.y,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkSpeed: 2 + Math.random() * 3,
        wanderX: firefly.position.x,
        wanderZ: firefly.position.z,
        wanderSpeed: 0.5 + Math.random()
      };

      this.scene.add(firefly);
      this.flyingCreatures.push(firefly);
    }
  }

  createAshMotes() {
    for (let i = 0; i < 40; i++) {
      const ash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2 + Math.random() * 0.2, 0.2 + Math.random() * 0.2),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.3),
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        })
      );

      ash.position.set(
        (Math.random() - 0.5) * 150,
        Math.random() * 30,
        (Math.random() - 0.5) * 150
      );

      ash.userData = {
        type: 'ashMote',
        fallSpeed: 0.5 + Math.random() * 1,
        driftX: (Math.random() - 0.5) * 2,
        driftZ: (Math.random() - 0.5) * 2,
        spinSpeed: (Math.random() - 0.5) * 3
      };

      this.scene.add(ash);
      this.flyingCreatures.push(ash);
    }
  }

  // === GROUND CREATURES ===

  createGroundCreatures(type) {
    const creators = {
      critters: () => this.createCritters(),
      glowingCritters: () => this.createGlowingCritters(),
      fireElementals: () => this.createFireElementals(),
      crystalCreatures: () => this.createCrystalCreatures(),
      mushrooms: () => this.createWalkingMushrooms(),
      rocklings: () => this.createRocklings()
    };

    if (creators[type]) {
      creators[type]();
    }
  }

  createCritters() {
    for (let i = 0; i < 15; i++) {
      const critter = new THREE.Group();

      // Body
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x665544 })
      );
      body.scale.set(1.2, 0.8, 1);
      critter.add(body);

      // Head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x554433 })
      );
      head.position.set(0.3, 0.1, 0);
      critter.add(head);

      critter.position.set(
        (Math.random() - 0.5) * 100,
        0,
        (Math.random() - 0.5) * 100
      );

      critter.userData = {
        type: 'critter',
        worldX: critter.position.x,
        worldZ: critter.position.z,
        targetX: critter.position.x,
        targetZ: critter.position.z,
        speed: 2 + Math.random() * 3,
        nextMoveTime: Math.random() * 5
      };

      this.scene.add(critter);
      this.groundCreatures.push(critter);
    }
  }

  createGlowingCritters() {
    const creatureGeom = new THREE.SphereGeometry(0.3, 8, 8);

    for (let i = 0; i < 20; i++) {
      const creature = new THREE.Mesh(
        creatureGeom,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.4 + Math.random() * 0.3, 0.8, 0.5),
          transparent: true,
          opacity: 0.9
        })
      );

      creature.position.set(
        (Math.random() - 0.5) * 100,
        0,
        (Math.random() - 0.5) * 100
      );

      creature.userData = {
        type: 'glowingCritter',
        worldX: creature.position.x,
        worldZ: creature.position.z,
        targetX: creature.position.x,
        targetZ: creature.position.z,
        speed: 2 + Math.random() * 3,
        nextMoveTime: Math.random() * 5,
        hue: 0.4 + Math.random() * 0.3
      };

      this.scene.add(creature);
      this.groundCreatures.push(creature);
    }
  }

  createFireElementals() {
    for (let i = 0; i < 10; i++) {
      const elemental = new THREE.Group();

      // Core
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 1),
        new THREE.MeshBasicMaterial({
          color: 0xff4400,
          blending: THREE.AdditiveBlending
        })
      );
      elemental.add(core);

      // Outer flame
      const flame = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8, 0),
        new THREE.MeshBasicMaterial({
          color: 0xff8800,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending
        })
      );
      elemental.add(flame);

      elemental.position.set(
        (Math.random() - 0.5) * 120,
        0.5,
        (Math.random() - 0.5) * 120
      );

      elemental.userData = {
        type: 'fireElemental',
        worldX: elemental.position.x,
        worldZ: elemental.position.z,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderSpeed: 1 + Math.random() * 2,
        pulsePhase: Math.random() * Math.PI * 2
      };

      this.scene.add(elemental);
      this.groundCreatures.push(elemental);
    }
  }

  createCrystalCreatures() {
    for (let i = 0; i < 12; i++) {
      const crystal = new THREE.Group();

      // Main crystal body
      const body = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4, 0),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.6, 0.6),
          transparent: true,
          opacity: 0.8
        })
      );
      body.scale.y = 1.5;
      crystal.add(body);

      // Legs (small crystals)
      for (let l = 0; l < 4; l++) {
        const leg = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.1, 0),
          body.material
        );
        const angle = (l / 4) * Math.PI * 2;
        leg.position.set(Math.cos(angle) * 0.3, -0.3, Math.sin(angle) * 0.3);
        crystal.add(leg);
      }

      crystal.position.set(
        (Math.random() - 0.5) * 100,
        0.3,
        (Math.random() - 0.5) * 100
      );

      crystal.userData = {
        type: 'crystalCreature',
        worldX: crystal.position.x,
        worldZ: crystal.position.z,
        targetX: crystal.position.x,
        targetZ: crystal.position.z,
        speed: 0.5 + Math.random(),
        nextMoveTime: Math.random() * 8
      };

      this.scene.add(crystal);
      this.groundCreatures.push(crystal);
    }
  }

  createWalkingMushrooms() {
    for (let i = 0; i < 12; i++) {
      const mushroom = new THREE.Group();

      // Cap
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.85 + Math.random() * 0.1, 0.6, 0.4)
        })
      );
      cap.scale.set(1, 0.5, 1);
      cap.position.y = 0.5;
      mushroom.add(cap);

      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 0.4, 6),
        new THREE.MeshBasicMaterial({ color: 0xeeddcc })
      );
      stem.position.y = 0.2;
      mushroom.add(stem);

      // Eyes (bioluminescent)
      const eyeMat = new THREE.MeshBasicMaterial({
        color: 0x88ffaa,
        blending: THREE.AdditiveBlending
      });
      const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), eyeMat);
      leftEye.position.set(-0.1, 0.45, 0.25);
      mushroom.add(leftEye);
      const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), eyeMat);
      rightEye.position.set(0.1, 0.45, 0.25);
      mushroom.add(rightEye);

      mushroom.position.set(
        (Math.random() - 0.5) * 80,
        0,
        (Math.random() - 0.5) * 80
      );

      mushroom.userData = {
        type: 'walkingMushroom',
        worldX: mushroom.position.x,
        worldZ: mushroom.position.z,
        targetX: mushroom.position.x,
        targetZ: mushroom.position.z,
        speed: 0.3 + Math.random() * 0.5,
        nextMoveTime: Math.random() * 10,
        bobPhase: Math.random() * Math.PI * 2
      };

      this.scene.add(mushroom);
      this.groundCreatures.push(mushroom);
    }
  }

  createRocklings() {
    for (let i = 0; i < 10; i++) {
      const rockling = new THREE.Group();

      // Body (irregular rock)
      const body = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4, 0),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08, 0.2, 0.35 + Math.random() * 0.1)
        })
      );
      body.scale.y = 0.7;
      rockling.add(body);

      // Glowing cracks
      const crack = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xff6600,
          blending: THREE.AdditiveBlending
        })
      );
      crack.position.set(0.1, 0, 0.2);
      rockling.add(crack);

      rockling.position.set(
        (Math.random() - 0.5) * 100,
        0.3,
        (Math.random() - 0.5) * 100
      );

      rockling.userData = {
        type: 'rockling',
        worldX: rockling.position.x,
        worldZ: rockling.position.z,
        targetX: rockling.position.x,
        targetZ: rockling.position.z,
        speed: 0.5 + Math.random() * 0.5,
        nextMoveTime: Math.random() * 8,
        rollPhase: 0
      };

      this.scene.add(rockling);
      this.groundCreatures.push(rockling);
    }
  }

  // === SWIMMING CREATURES ===

  createSwimmingCreatures(type) {
    const creators = {
      fish: () => this.createFish(),
      jellyfish: () => this.createJellyfish(),
      eels: () => this.createEels(),
      whales: () => this.createWhales()
    };

    if (creators[type]) {
      creators[type]();
    }
  }

  createFish() {
    for (let i = 0; i < 30; i++) {
      const fish = new THREE.Group();

      // Body
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.6, 4),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.5 + Math.random() * 0.3, 0.6, 0.4 + Math.random() * 0.2),
          transparent: true,
          opacity: 0.8
        })
      );
      body.rotation.z = Math.PI / 2;
      fish.add(body);

      // Tail
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.2, 3),
        body.material
      );
      tail.position.x = -0.35;
      tail.rotation.z = Math.PI / 2;
      fish.add(tail);

      // Bioluminescent spot
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0x44ffff,
          blending: THREE.AdditiveBlending
        })
      );
      glow.position.x = 0.15;
      fish.add(glow);

      fish.position.set(
        (Math.random() - 0.5) * 150,
        -2 - Math.random() * 10,
        (Math.random() - 0.5) * 150
      );

      fish.userData = {
        type: 'fish',
        worldX: fish.position.x,
        worldZ: fish.position.z,
        swimAngle: Math.random() * Math.PI * 2,
        swimSpeed: 1 + Math.random() * 2,
        swimRadius: 5 + Math.random() * 10,
        depth: fish.position.y,
        schoolId: Math.floor(Math.random() * 5)
      };

      this.scene.add(fish);
      this.swimmingCreatures.push(fish);
    }
  }

  createJellyfish() {
    for (let i = 0; i < 15; i++) {
      const jelly = new THREE.Group();

      // Bell
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.5, 0.5),
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide
        })
      );
      bell.rotation.x = Math.PI;
      jelly.add(bell);

      // Tentacles
      for (let t = 0; t < 6; t++) {
        const tentacle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.01, 1.5 + Math.random(), 4),
          new THREE.MeshBasicMaterial({
            color: 0x8888ff,
            transparent: true,
            opacity: 0.4
          })
        );
        const angle = (t / 6) * Math.PI * 2;
        tentacle.position.set(Math.cos(angle) * 0.2, -0.8, Math.sin(angle) * 0.2);
        jelly.add(tentacle);
      }

      jelly.position.set(
        (Math.random() - 0.5) * 150,
        -3 - Math.random() * 15,
        (Math.random() - 0.5) * 150
      );

      jelly.userData = {
        type: 'jellyfish',
        worldX: jelly.position.x,
        worldZ: jelly.position.z,
        pulsePhase: Math.random() * Math.PI * 2,
        driftAngle: Math.random() * Math.PI * 2,
        depth: jelly.position.y
      };

      this.scene.add(jelly);
      this.swimmingCreatures.push(jelly);
    }
  }

  createEels() {
    for (let i = 0; i < 8; i++) {
      const eel = new THREE.Group();
      const segmentCount = 12;

      for (let s = 0; s < segmentCount; s++) {
        const size = 0.15 * (1 - s * 0.05);
        const segment = new THREE.Mesh(
          new THREE.SphereGeometry(size, 6, 6),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.1, 0.3, 0.25),
            transparent: true,
            opacity: 0.8
          })
        );
        segment.position.x = -s * 0.2;
        eel.add(segment);
      }

      // Glowing eyes
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 4, 4),
        new THREE.MeshBasicMaterial({
          color: 0xffff00,
          blending: THREE.AdditiveBlending
        })
      );
      eye.position.set(0.1, 0.05, 0.08);
      eel.add(eye);

      eel.position.set(
        (Math.random() - 0.5) * 150,
        -5 - Math.random() * 10,
        (Math.random() - 0.5) * 150
      );

      eel.userData = {
        type: 'eel',
        worldX: eel.position.x,
        worldZ: eel.position.z,
        swimPhase: Math.random() * Math.PI * 2,
        swimSpeed: 0.5 + Math.random(),
        depth: eel.position.y
      };

      this.scene.add(eel);
      this.swimmingCreatures.push(eel);
    }
  }

  createWhales() {
    for (let i = 0; i < 3; i++) {
      const whale = new THREE.Group();

      // Body
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0x334455,
          transparent: true,
          opacity: 0.7
        })
      );
      body.scale.set(2, 0.8, 1);
      whale.add(body);

      // Tail
      const tail = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 1.5),
        new THREE.MeshBasicMaterial({
          color: 0x334455,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7
        })
      );
      tail.position.set(-5, 0, 0);
      tail.rotation.y = Math.PI / 2;
      whale.add(tail);

      // Bioluminescent markings
      for (let m = 0; m < 5; m++) {
        const mark = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 4, 4),
          new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            blending: THREE.AdditiveBlending
          })
        );
        mark.position.set(-1 + m * 0.8, 0.5, 1.5);
        whale.add(mark);
      }

      whale.position.set(
        (Math.random() - 0.5) * 300,
        -15 - Math.random() * 20,
        (Math.random() - 0.5) * 300
      );

      whale.userData = {
        type: 'whale',
        worldX: whale.position.x,
        worldZ: whale.position.z,
        swimAngle: Math.random() * Math.PI * 2,
        swimSpeed: 0.2 + Math.random() * 0.2,
        depth: whale.position.y
      };

      this.scene.add(whale);
      this.swimmingCreatures.push(whale);
    }
  }

  // === SPECIAL CREATURES ===

  createSpecialCreatures(type) {
    const creators = {
      giantWorm: () => this.createGiantWorm(),
      leviathan: () => this.createLeviathan()
    };

    if (creators[type]) {
      creators[type]();
    }
  }

  createGiantWorm() {
    const wormSegments = 20;
    const wormGeom = new THREE.SphereGeometry(3, 16, 16);
    const wormMat = new THREE.MeshBasicMaterial({ color: 0x553344 });

    this.worm = new THREE.Group();
    this.wormSegments = [];

    for (let i = 0; i < wormSegments; i++) {
      const segment = new THREE.Mesh(wormGeom, wormMat);
      segment.scale.setScalar(1 - i * 0.03);
      this.worm.add(segment);
      this.wormSegments.push(segment);
    }

    this.worm.visible = false;
    this.wormState = { active: false, time: 0, x: 0, z: 0 };
    this.scene.add(this.worm);
  }

  createLeviathan() {
    // Giant underwater creature - similar to worm but for deep realm
    const segments = 25;
    const segGeom = new THREE.SphereGeometry(4, 16, 16);
    const segMat = new THREE.MeshBasicMaterial({
      color: 0x223344,
      transparent: true,
      opacity: 0.7
    });

    this.leviathan = new THREE.Group();
    this.leviathanSegments = [];

    for (let i = 0; i < segments; i++) {
      const segment = new THREE.Mesh(segGeom, segMat.clone());
      segment.scale.setScalar(1 - i * 0.025);

      // Bioluminescent spots
      if (i % 3 === 0) {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 4, 4),
          new THREE.MeshBasicMaterial({
            color: 0x44ffff,
            blending: THREE.AdditiveBlending
          })
        );
        glow.position.y = 2;
        segment.add(glow);
      }

      this.leviathan.add(segment);
      this.leviathanSegments.push(segment);
    }

    this.leviathan.visible = false;
    this.leviathanState = { active: false, time: 0, x: 0, z: 0 };
    this.scene.add(this.leviathan);
    this.specialCreatures.push(this.leviathan);
  }

  // === UPDATE ===

  update(delta, elapsed, audioData, roverZ, terrainY) {
    if (!this.config.enabled) return;

    this.roverZ = roverZ;
    this.terrainY = terrainY;

    this.updateFlyingCreatures(delta, elapsed);
    this.updateGroundCreatures(delta, elapsed);
    this.updateSwimmingCreatures(delta, elapsed);
    this.updateSpecialCreatures(delta, elapsed);
  }

  updateFlyingCreatures(delta, elapsed) {
    this.flyingCreatures.forEach(creature => {
      const d = creature.userData;

      switch (d.type) {
        case 'bird':
          const birdAngle = elapsed * d.circleSpeed + d.circlePhase;
          creature.position.x = Math.cos(birdAngle) * d.circleRadius;
          creature.position.z = Math.sin(birdAngle) * d.circleRadius - 50;
          creature.position.y = d.baseY + Math.sin(elapsed * 0.5) * 10;
          const wingAngle = Math.sin(elapsed * d.speed * 10 + d.wingPhase) * 0.5;
          if (creature.children[0]) creature.children[0].rotation.z = wingAngle;
          if (creature.children[1]) creature.children[1].rotation.z = -wingAngle;
          creature.rotation.y = birdAngle + Math.PI / 2;
          break;

        case 'alienFlyer':
          creature.position.x += d.driftX * delta;
          creature.position.z += d.driftZ * delta;
          creature.position.y = d.baseY + Math.sin(elapsed * d.floatSpeed + d.floatPhase) * 5;
          creature.rotation.y += delta * 0.2;
          // Wrap position
          if (Math.abs(creature.position.x) > 150) d.driftX *= -1;
          if (Math.abs(creature.position.z) > 150) d.driftZ *= -1;
          break;

        case 'skyJellyfish':
          creature.position.x += Math.cos(d.driftAngle) * d.driftSpeed * delta;
          creature.position.z += Math.sin(d.driftAngle) * d.driftSpeed * delta;
          creature.position.y = d.baseY + Math.sin(elapsed * 0.3 + d.pulsePhase) * 8;
          // Pulse animation
          const pulse = Math.sin(elapsed * 2 + d.pulsePhase) * 0.1 + 1;
          creature.scale.set(pulse, 1 / pulse, pulse);
          // Wrap
          if (Math.abs(creature.position.x) > 150) creature.position.x *= -0.9;
          if (Math.abs(creature.position.z) > 150) creature.position.z *= -0.9;
          break;

        case 'faerie':
          d.wanderAngle += (Math.random() - 0.5) * delta * 2;
          creature.position.x += Math.cos(d.wanderAngle) * d.speed * delta;
          creature.position.z += Math.sin(d.wanderAngle) * d.speed * delta;
          creature.position.y = d.baseY + Math.sin(elapsed * 3 + d.phase) * 2;
          // Wing flutter
          if (creature.children[1]) creature.children[1].rotation.z = Math.sin(elapsed * 20) * 0.3;
          if (creature.children[2]) creature.children[2].rotation.z = -Math.sin(elapsed * 20) * 0.3;
          // Color pulse
          const hue = (d.hue + elapsed * 0.1) % 1;
          creature.children[0].material.color.setHSL(hue, 0.8, 0.6);
          // Wrap
          if (Math.abs(creature.position.x) > 60) creature.position.x *= 0.5;
          if (Math.abs(creature.position.z) > 60) creature.position.z *= 0.5;
          break;

        case 'ember':
          creature.position.y += d.riseSpeed * delta;
          creature.position.x += d.driftX * delta;
          creature.position.z += d.driftZ * delta;
          d.life += delta;
          // Fade and reset
          creature.material.opacity = Math.max(0, 1 - d.life / d.maxLife);
          if (d.life > d.maxLife) {
            d.life = 0;
            creature.position.set(
              (Math.random() - 0.5) * 150,
              2,
              (Math.random() - 0.5) * 150
            );
          }
          break;

        case 'firefly':
          creature.position.x += Math.sin(elapsed + d.blinkPhase) * d.wanderSpeed * delta;
          creature.position.z += Math.cos(elapsed * 0.7 + d.blinkPhase) * d.wanderSpeed * delta;
          creature.position.y = d.baseY + Math.sin(elapsed * 2) * 0.5;
          // Blink
          const blink = Math.sin(elapsed * d.blinkSpeed + d.blinkPhase);
          creature.material.opacity = blink > 0.7 ? 1 : 0.2;
          creature.scale.setScalar(blink > 0.7 ? 1.5 : 1);
          break;

        case 'ashMote':
          creature.position.y -= d.fallSpeed * delta;
          creature.position.x += d.driftX * delta;
          creature.position.z += d.driftZ * delta;
          creature.rotation.x += d.spinSpeed * delta;
          creature.rotation.y += d.spinSpeed * 0.7 * delta;
          // Reset when too low
          if (creature.position.y < -5) {
            creature.position.y = 30;
            creature.position.x = (Math.random() - 0.5) * 150;
            creature.position.z = (Math.random() - 0.5) * 150;
          }
          break;
      }
    });
  }

  updateGroundCreatures(delta, elapsed) {
    this.groundCreatures.forEach(creature => {
      const d = creature.userData;

      // Common movement for wandering creatures
      if (d.nextMoveTime !== undefined) {
        d.nextMoveTime -= delta;
        if (d.nextMoveTime <= 0) {
          d.targetX = (Math.random() - 0.5) * 80;
          d.targetZ = (Math.random() - 0.5) * 80;
          d.nextMoveTime = 2 + Math.random() * 8;
        }

        const dx = d.targetX - d.worldX;
        const dz = d.targetZ - d.worldZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.5) {
          d.worldX += (dx / dist) * d.speed * delta;
          d.worldZ += (dz / dist) * d.speed * delta;
          creature.rotation.y = Math.atan2(dx, dz);
        }
      }

      // Position on terrain
      // GPU terrain samples at (-screenZ - roverZ), so negate the screen Z
      creature.position.x = d.worldX;
      creature.position.z = d.worldZ;
      const height = this.terrainSystem.getHeight(d.worldX, -d.worldZ - this.roverZ);
      creature.position.y = height + this.terrainY + 0.3;

      // Type-specific updates
      switch (d.type) {
        case 'glowingCritter':
          const pulse = Math.sin(elapsed * 3 + d.worldX) * 0.3 + 0.7;
          creature.material.color.setHSL(d.hue, 0.8, 0.3 + pulse * 0.3);
          break;

        case 'fireElemental':
          d.wanderAngle += delta * 0.5;
          d.worldX += Math.cos(d.wanderAngle) * d.wanderSpeed * delta;
          d.worldZ += Math.sin(d.wanderAngle) * d.wanderSpeed * delta;
          const flamePulse = Math.sin(elapsed * 5 + d.pulsePhase) * 0.2 + 1;
          creature.scale.setScalar(flamePulse);
          break;

        case 'walkingMushroom':
          creature.position.y += Math.abs(Math.sin(elapsed * 5 + d.bobPhase)) * 0.1;
          break;

        case 'rockling':
          if (dist > 0.5) {
            d.rollPhase += delta * 5;
            creature.rotation.z = d.rollPhase;
          }
          break;
      }
    });
  }

  updateSwimmingCreatures(delta, elapsed) {
    this.swimmingCreatures.forEach(creature => {
      const d = creature.userData;

      switch (d.type) {
        case 'fish':
          d.swimAngle += d.swimSpeed * delta;
          creature.position.x = d.worldX + Math.cos(d.swimAngle) * d.swimRadius;
          creature.position.z = d.worldZ + Math.sin(d.swimAngle) * d.swimRadius;
          creature.position.y = d.depth + Math.sin(elapsed * 2 + d.swimAngle) * 0.5;
          creature.rotation.y = -d.swimAngle + Math.PI / 2;
          creature.rotation.z = Math.sin(elapsed * 8) * 0.1;
          break;

        case 'jellyfish':
          const jellyPulse = Math.sin(elapsed * 2 + d.pulsePhase);
          creature.position.y = d.depth + jellyPulse * 2;
          creature.position.x += Math.cos(d.driftAngle) * 0.5 * delta;
          creature.position.z += Math.sin(d.driftAngle) * 0.5 * delta;
          creature.scale.set(1 + jellyPulse * 0.1, 1 - jellyPulse * 0.1, 1 + jellyPulse * 0.1);
          break;

        case 'eel':
          d.swimPhase += d.swimSpeed * delta;
          creature.position.x = d.worldX + Math.sin(d.swimPhase) * 10;
          creature.position.z = d.worldZ + Math.cos(d.swimPhase * 0.5) * 10;
          // Undulate body
          creature.children.forEach((seg, i) => {
            seg.position.y = Math.sin(elapsed * 3 + i * 0.5) * 0.2;
          });
          creature.rotation.y = d.swimPhase;
          break;

        case 'whale':
          d.swimAngle += d.swimSpeed * delta;
          creature.position.x = d.worldX + Math.cos(d.swimAngle) * 100;
          creature.position.z = d.worldZ + Math.sin(d.swimAngle) * 100;
          creature.position.y = d.depth + Math.sin(elapsed * 0.2) * 5;
          creature.rotation.y = -d.swimAngle + Math.PI;
          // Tail movement
          if (creature.children[1]) {
            creature.children[1].rotation.z = Math.sin(elapsed * 0.5) * 0.3;
          }
          break;
      }
    });
  }

  updateSpecialCreatures(delta, elapsed) {
    // Giant worm
    if (this.worm) {
      if (!this.wormState.active && Math.random() < 0.00003) {
        this.wormState.active = true;
        this.wormState.time = 0;
        this.wormState.x = (Math.random() - 0.5) * 100;
        this.wormState.z = -50 - Math.random() * 50;
        this.worm.visible = true;
      }

      if (this.wormState.active) {
        this.wormState.time += delta;

        this.wormSegments.forEach((segment, i) => {
          const t = this.wormState.time - i * 0.1;
          const y = Math.sin(t * 2) * 20 - 5;
          const x = Math.sin(t + i * 0.3) * 5;
          const z = i * 2;
          segment.position.set(x, Math.max(-10, y), z);
        });

        this.worm.position.set(this.wormState.x, this.terrainY, this.wormState.z);

        if (this.wormState.time > 5) {
          this.wormState.active = false;
          this.worm.visible = false;
        }
      }
    }

    // Leviathan
    if (this.leviathan && this.leviathanState) {
      if (!this.leviathanState.active && Math.random() < 0.00002) {
        this.leviathanState.active = true;
        this.leviathanState.time = 0;
        this.leviathanState.x = (Math.random() - 0.5) * 150;
        this.leviathanState.z = -80 - Math.random() * 80;
        this.leviathan.visible = true;
      }

      if (this.leviathanState.active) {
        this.leviathanState.time += delta;

        this.leviathanSegments?.forEach((segment, i) => {
          const t = this.leviathanState.time - i * 0.12;
          const y = Math.sin(t * 1.5) * 15 - 20;
          const x = Math.sin(t * 0.8 + i * 0.2) * 8;
          const z = i * 3;
          segment.position.set(x, y, z);
        });

        this.leviathan.position.set(this.leviathanState.x, 0, this.leviathanState.z);

        if (this.leviathanState.time > 8) {
          this.leviathanState.active = false;
          this.leviathan.visible = false;
        }
      }
    }
  }

  dispose() {
    [...this.flyingCreatures, ...this.groundCreatures, ...this.swimmingCreatures].forEach(c => {
      this.scene.remove(c);
      c.traverse(child => {
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

    if (this.worm) {
      this.scene.remove(this.worm);
      this.wormSegments.forEach(s => {
        s.geometry.dispose();
        s.material.dispose();
      });
    }

    if (this.leviathan) {
      this.scene.remove(this.leviathan);
    }

    this.flyingCreatures = [];
    this.groundCreatures = [];
    this.swimmingCreatures = [];
    this.specialCreatures = [];
  }
}

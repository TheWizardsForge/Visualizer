import * as THREE from 'three';

/**
 * ProceduralFloraSystem - Visually appealing procedural flora generation
 *
 * Creates good-looking trees and alien flora using simple but effective geometry
 */
export class ProceduralFloraSystem {
  constructor() {
    // Seeded random for reproducibility
    this.seed = 12345;

    // Shared materials (for performance)
    this.foliageMaterials = new Map();
    this.trunkMaterials = new Map();
  }

  /**
   * Create a foliage shader material with rim lighting and color variation
   */
  createFoliageMaterial(baseColor, options = {}) {
    const color = baseColor.clone();
    const colorKey = color.getHexString() + JSON.stringify(options);

    // Return cached material if exists
    if (this.foliageMaterials.has(colorKey)) {
      return this.foliageMaterials.get(colorKey);
    }

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: color },
        uSunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        uSunBrightness: { value: 1.0 },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vLocalPos;
        varying vec3 vViewDir;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vLocalPos = position; // Use local position for stable noise
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - worldPosition.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        uniform vec3 uSunDirection;
        uniform float uSunBrightness;
        uniform float uTime;

        varying vec3 vNormal;
        varying vec3 vLocalPos;
        varying vec3 vViewDir;

        // Simple noise for color variation
        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        void main() {
          vec3 normal = normalize(vNormal);

          // Base color with subtle noise variation (using local position - stable)
          float colorNoise = hash(floor(vLocalPos * 4.0)) * 0.15 - 0.075;
          vec3 color = uBaseColor + vec3(colorNoise * 0.5, colorNoise, colorNoise * 0.3);

          // Simple diffuse lighting
          float diffuse = max(dot(normal, uSunDirection), 0.0) * 0.4 + 0.6;
          color *= diffuse;

          // Rim lighting - bright edges when backlit by sun
          float rimDot = 1.0 - max(dot(vViewDir, normal), 0.0);
          float rim = pow(rimDot, 3.0);

          // Rim is stronger when sun is behind the foliage
          float backlight = max(dot(-vViewDir, uSunDirection), 0.0);
          rim *= backlight * 0.8 + 0.2;

          // Add warm rim color (sunlight through leaves)
          vec3 rimColor = vec3(0.4, 0.6, 0.1) * uSunBrightness;
          color += rimColor * rim * 0.6;

          // Day/night ambient lighting - darken significantly at night
          float ambientLevel = 0.15 + uSunBrightness * 0.85; // 0.15 at night, 1.0 at day
          vec3 nightTint = vec3(0.7, 0.75, 0.9); // Slight blue tint at night
          vec3 ambientColor = mix(nightTint, vec3(1.0), uSunBrightness);
          color *= ambientColor * ambientLevel;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.FrontSide
    });

    this.foliageMaterials.set(colorKey, material);
    return material;
  }

  /**
   * Create a trunk/bark shader material that responds to day/night
   */
  createTrunkMaterial(baseColor) {
    const color = baseColor.clone();
    const colorKey = 'trunk_' + color.getHexString();

    if (this.trunkMaterials.has(colorKey)) {
      return this.trunkMaterials.get(colorKey);
    }

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: color },
        uSunBrightness: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        uniform float uSunBrightness;
        varying vec3 vNormal;

        void main() {
          // Simple diffuse shading
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
          float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
          vec3 color = uBaseColor * diffuse;

          // Day/night ambient lighting
          float ambientLevel = 0.15 + uSunBrightness * 0.85;
          vec3 nightTint = vec3(0.7, 0.75, 0.9);
          vec3 ambientColor = mix(nightTint, vec3(1.0), uSunBrightness);
          color *= ambientColor * ambientLevel;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.FrontSide
    });

    this.trunkMaterials.set(colorKey, material);
    return material;
  }

  /**
   * Update all materials (call from main update loop)
   */
  updateMaterials(sunDirection, sunBrightness, time) {
    for (const material of this.foliageMaterials.values()) {
      if (material.uniforms) {
        material.uniforms.uSunDirection.value.copy(sunDirection);
        material.uniforms.uSunBrightness.value = sunBrightness;
        material.uniforms.uTime.value = time;
      }
    }
    for (const material of this.trunkMaterials.values()) {
      if (material.uniforms) {
        material.uniforms.uSunBrightness.value = sunBrightness;
      }
    }
  }

  /**
   * Seeded random number generator
   */
  random(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  nextRandom() {
    this.seed++;
    return this.random(this.seed);
  }

  /**
   * Create a realistic deciduous tree (oak-like)
   */
  createOakTree(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    // Trunk
    const trunkHeight = 2 + r() * 1.5;
    const trunkRadius = 0.15 + r() * 0.1;
    const trunkColor = new THREE.Color().setHSL(0.08, 0.5, 0.25 + r() * 0.1);

    const trunkGeom = new THREE.CylinderGeometry(
      trunkRadius * 0.6, trunkRadius, trunkHeight, 8
    );
    const trunkMat = this.createTrunkMaterial(trunkColor);
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);

    // Main branches
    const branchCount = 3 + Math.floor(r() * 3);
    for (let i = 0; i < branchCount; i++) {
      const branch = this.createBranch(
        trunkRadius * 0.4,
        1 + r() * 1.5,
        trunkColor.clone()
      );
      const angle = (i / branchCount) * Math.PI * 2 + r() * 0.5;
      branch.position.set(
        Math.cos(angle) * trunkRadius * 0.3,
        trunkHeight * (0.5 + r() * 0.3),
        Math.sin(angle) * trunkRadius * 0.3
      );
      branch.rotation.set(0.4 + r() * 0.4, angle, 0);
      group.add(branch);
    }

    // Foliage clusters (multiple layered spheres)
    const foliageColor = new THREE.Color().setHSL(0.28 + r() * 0.08, 0.6, 0.25 + r() * 0.15);
    const foliageMaterial = this.createFoliageMaterial(foliageColor);
    const foliageLayers = 4 + Math.floor(r() * 3);

    for (let i = 0; i < foliageLayers; i++) {
      const size = (1.2 + r() * 0.8) * (1 - i * 0.1);
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 1),
        foliageMaterial
      );
      foliage.position.set(
        (r() - 0.5) * 1.5,
        trunkHeight + 0.5 + r() * 1.5,
        (r() - 0.5) * 1.5
      );
      foliage.scale.y = 0.7 + r() * 0.3;
      group.add(foliage);
    }

    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Create a pine/conifer tree
   */
  createPineTree(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    // Trunk
    const trunkHeight = 3 + r() * 2;
    const trunkRadius = 0.1 + r() * 0.05;
    const trunkColor = new THREE.Color().setHSL(0.06, 0.6, 0.2 + r() * 0.1);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkRadius * 0.5, trunkRadius, trunkHeight, 6),
      this.createTrunkMaterial(trunkColor)
    );
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);

    // Layered cone foliage
    const layers = 4 + Math.floor(r() * 3);
    const baseColor = new THREE.Color().setHSL(0.3 + r() * 0.05, 0.5, 0.18 + r() * 0.08);
    const foliageMaterial = this.createFoliageMaterial(baseColor);

    for (let i = 0; i < layers; i++) {
      const layerY = trunkHeight * 0.3 + i * (trunkHeight * 0.18);
      const coneRadius = (1.2 - i * 0.15) * (0.8 + r() * 0.4);
      const coneHeight = 1 + r() * 0.5;

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneRadius, coneHeight, 8),
        foliageMaterial
      );
      cone.position.y = layerY;
      group.add(cone);
    }

    // Snow caps for some trees
    if (r() > 0.6) {
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.3, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      snow.position.y = trunkHeight + 0.5;
      group.add(snow);
    }

    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Create a willow tree with drooping branches
   */
  createWillowTree(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    // Trunk
    const trunkHeight = 2.5 + r() * 1.5;
    const trunkRadius = 0.2 + r() * 0.1;
    const trunkColor = new THREE.Color().setHSL(0.1, 0.4, 0.28);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 8),
      this.createTrunkMaterial(trunkColor)
    );
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);

    // Drooping branch tendrils
    const tendrilCount = 15 + Math.floor(r() * 10);
    const foliageColor = new THREE.Color().setHSL(0.25 + r() * 0.1, 0.55, 0.3);
    const foliageMaterial = this.createFoliageMaterial(foliageColor);

    for (let i = 0; i < tendrilCount; i++) {
      const angle = (i / tendrilCount) * Math.PI * 2 + r() * 0.3;
      const radius = 1 + r() * 1;
      const length = 1.5 + r() * 2;

      // Create curved tendril using multiple segments
      const tendril = new THREE.Group();
      const segments = 5;

      for (let s = 0; s < segments; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.03, length / segments, 4),
          foliageMaterial
        );
        seg.position.y = -s * (length / segments) * 0.8;
        seg.position.x = s * 0.1;
        seg.rotation.z = s * 0.15;
        tendril.add(seg);

        // Add leaf clusters along tendril
        if (s > 0) {
          const leafCluster = new THREE.Mesh(
            new THREE.SphereGeometry(0.15 + r() * 0.1, 4, 4),
            foliageMaterial
          );
          leafCluster.position.copy(seg.position);
          tendril.add(leafCluster);
        }
      }

      tendril.position.set(
        Math.cos(angle) * radius,
        trunkHeight + r() * 0.5,
        Math.sin(angle) * radius
      );
      tendril.rotation.x = 0.3;
      tendril.rotation.y = angle;
      group.add(tendril);
    }

    // Central foliage mass
    for (let i = 0; i < 5; i++) {
      const mass = new THREE.Mesh(
        new THREE.SphereGeometry(0.8 + r() * 0.5, 6, 6),
        foliageMaterial
      );
      mass.position.set(
        (r() - 0.5) * 1.5,
        trunkHeight + r() * 0.5,
        (r() - 0.5) * 1.5
      );
      group.add(mass);
    }

    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Create a simple branch
   */
  createBranch(radius, length, color) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.5, radius, length, 5),
      new THREE.MeshBasicMaterial({ color })
    );
    branch.geometry.translate(0, length / 2, 0);
    return branch;
  }

  // === SPACE COLONIZATION / ALIEN FLORA ===

  /**
   * Create alien tendril plant using iterative growth
   */
  createTendrilPlant(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    const baseColor = new THREE.Color().setHSL(0.5 + r() * 0.3, 0.7, 0.25);
    const tipColor = new THREE.Color().setHSL(0.45 + r() * 0.2, 0.9, 0.5);

    // Create multiple tendrils from base
    const tendrilCount = 4 + Math.floor(r() * 4);

    for (let t = 0; t < tendrilCount; t++) {
      const tendril = this.createGrowingTendril(
        baseColor.clone(),
        tipColor.clone(),
        8 + Math.floor(r() * 6),
        0.08,
        r
      );

      const angle = (t / tendrilCount) * Math.PI * 2 + r() * 0.5;
      tendril.rotation.set(0.2 + r() * 0.3, angle, 0);
      group.add(tendril);
    }

    // Base bulb
    const base = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: baseColor })
    );
    base.scale.y = 0.6;
    group.add(base);

    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Create a single growing tendril with segments
   */
  createGrowingTendril(baseColor, tipColor, segments, radius, r) {
    const tendril = new THREE.Group();

    let currentPos = new THREE.Vector3(0, 0, 0);
    let direction = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const segLength = 0.3 + r() * 0.2;
      const segRadius = radius * (1 - t * 0.7);

      // Slight random direction change
      direction.x += (r() - 0.5) * 0.4;
      direction.z += (r() - 0.5) * 0.4;
      direction.normalize();

      const segment = new THREE.Mesh(
        new THREE.CylinderGeometry(segRadius * 0.7, segRadius, segLength, 5),
        new THREE.MeshBasicMaterial({
          color: baseColor.clone().lerp(tipColor, t)
        })
      );

      segment.position.copy(currentPos);
      segment.position.y += segLength / 2;

      // Orient segment along direction
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
      segment.quaternion.copy(quaternion);

      tendril.add(segment);

      // Move to next position
      currentPos.add(direction.clone().multiplyScalar(segLength));
    }

    // Glowing tip
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.5, 6, 6),
      new THREE.MeshBasicMaterial({
        color: tipColor,
        transparent: true,
        opacity: 0.9
      })
    );
    tip.position.copy(currentPos);
    tendril.add(tip);

    return tendril;
  }

  /**
   * Create coral-like branching structure
   */
  createCoralStructure(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    const hue = 0.85 + r() * 0.15; // Pink to purple range
    const baseColor = new THREE.Color().setHSL(hue, 0.6, 0.35);
    const tipColor = new THREE.Color().setHSL(hue, 0.8, 0.55);

    // Recursive branching
    this.addCoralBranch(group, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0),
      1.5, 0.15, 3, baseColor, tipColor, r);

    group.scale.setScalar(scale);
    return group;
  }

  addCoralBranch(parent, position, direction, length, radius, depth, baseColor, tipColor, r) {
    if (depth <= 0 || radius < 0.02) return;

    const t = 1 - depth / 3;

    // Create branch segment
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius, length, 6),
      new THREE.MeshBasicMaterial({
        color: baseColor.clone().lerp(tipColor, t)
      })
    );

    branch.position.copy(position);
    branch.position.addScaledVector(direction, length / 2);

    // Orient along direction
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    branch.quaternion.copy(quaternion);

    parent.add(branch);

    // End position for children
    const endPos = position.clone().addScaledVector(direction, length);

    // Add child branches
    const childCount = 2 + Math.floor(r() * 2);
    for (let i = 0; i < childCount; i++) {
      const newDir = direction.clone();
      newDir.x += (r() - 0.5) * 1.2;
      newDir.z += (r() - 0.5) * 1.2;
      newDir.y += r() * 0.3;
      newDir.normalize();

      this.addCoralBranch(
        parent, endPos, newDir,
        length * (0.6 + r() * 0.2),
        radius * 0.7,
        depth - 1,
        baseColor, tipColor, r
      );
    }

    // Add bulb at tips
    if (depth === 1) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 2, 6, 6),
        new THREE.MeshBasicMaterial({
          color: tipColor,
          transparent: true,
          opacity: 0.8
        })
      );
      bulb.position.copy(endPos);
      parent.add(bulb);
    }
  }

  /**
   * Create crystal growth structure
   */
  createCrystalGrowth(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    const hue = 0.55 + r() * 0.15; // Cyan to blue
    const crystalColor = new THREE.Color().setHSL(hue, 0.5, 0.45);
    const glowColor = new THREE.Color().setHSL(hue, 0.7, 0.65);

    // Central large crystal
    const mainCrystal = this.createCrystal(1.5 + r(), crystalColor);
    mainCrystal.position.y = 0.5;
    group.add(mainCrystal);

    // Surrounding smaller crystals
    const count = 4 + Math.floor(r() * 5);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + r() * 0.5;
      const dist = 0.3 + r() * 0.5;
      const height = 0.5 + r() * 1;

      const crystal = this.createCrystal(height, crystalColor.clone().offsetHSL(0, 0, (r() - 0.5) * 0.1));
      crystal.position.set(
        Math.cos(angle) * dist,
        0,
        Math.sin(angle) * dist
      );
      crystal.rotation.set((r() - 0.5) * 0.3, r() * Math.PI, (r() - 0.5) * 0.3);
      group.add(crystal);
    }

    // Glow at base
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.5
      })
    );
    glow.scale.y = 0.3;
    group.add(glow);

    group.scale.setScalar(scale);
    return group;
  }

  createCrystal(height, color) {
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(height * 0.2, height, 6),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85
      })
    );
    crystal.geometry.translate(0, height / 2, 0);
    return crystal;
  }

  /**
   * Create abyssal deep-sea tendril
   */
  createAbyssalTendril(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    const stalkColor = new THREE.Color(0x1a1a2d);
    const glowColor = new THREE.Color().setHSL(0.55 + r() * 0.1, 0.9, 0.5);

    // Main stalk
    const stalkHeight = 2 + r() * 2;
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.08, stalkHeight, 5),
      new THREE.MeshBasicMaterial({ color: stalkColor })
    );
    stalk.position.y = stalkHeight / 2;
    stalk.rotation.x = (r() - 0.5) * 0.2;
    stalk.rotation.z = (r() - 0.5) * 0.2;
    group.add(stalk);

    // Bioluminescent lure
    const lure = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 + r() * 0.08, 8, 8),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.9
      })
    );
    lure.position.y = stalkHeight + 0.1;
    group.add(lure);

    // Smaller secondary tendrils
    const secondaryCount = 2 + Math.floor(r() * 3);
    for (let i = 0; i < secondaryCount; i++) {
      const angle = r() * Math.PI * 2;
      const height = 0.5 + r() * 1;

      const secondary = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.03, height, 4),
        new THREE.MeshBasicMaterial({ color: stalkColor })
      );
      secondary.position.set(
        Math.cos(angle) * 0.1,
        stalkHeight * (0.3 + r() * 0.4),
        Math.sin(angle) * 0.1
      );
      secondary.rotation.set(0.5 + r() * 0.5, angle, 0);
      group.add(secondary);

      // Small glow
      const smallGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        new THREE.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: 0.7
        })
      );
      smallGlow.position.copy(secondary.position);
      smallGlow.position.y += height * 0.4;
      group.add(smallGlow);
    }

    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Create magical fey branches
   */
  createFeyBranches(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    const branchColor = new THREE.Color().setHSL(0.8 + r() * 0.1, 0.4, 0.25);
    const glowHue = r() * 0.3; // Warm colors: red/orange/yellow
    const glowColor = new THREE.Color().setHSL(glowHue, 0.9, 0.6);

    // Twisted main trunk
    const trunkHeight = 1.5 + r() * 1;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.15, trunkHeight, 6),
      new THREE.MeshBasicMaterial({ color: branchColor })
    );
    trunk.position.y = trunkHeight / 2;
    trunk.rotation.z = (r() - 0.5) * 0.3;
    group.add(trunk);

    // Spiraling branches
    const branchCount = 5 + Math.floor(r() * 4);
    for (let i = 0; i < branchCount; i++) {
      const t = i / branchCount;
      const angle = t * Math.PI * 3 + r() * 0.5; // Spiral
      const branchLength = 0.5 + r() * 0.8;

      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.04, branchLength, 4),
        new THREE.MeshBasicMaterial({ color: branchColor })
      );

      branch.position.set(
        Math.cos(angle) * 0.1,
        trunkHeight * (0.3 + t * 0.6),
        Math.sin(angle) * 0.1
      );
      branch.rotation.set(0.5 + r() * 0.5, angle, 0);
      group.add(branch);
    }

    // Floating magical lights
    const lightCount = 5 + Math.floor(r() * 6);
    for (let i = 0; i < lightCount; i++) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + r() * 0.05, 6, 6),
        new THREE.MeshBasicMaterial({
          color: glowColor.clone().offsetHSL(r() * 0.2, 0, 0),
          transparent: true,
          opacity: 0.8
        })
      );
      light.position.set(
        (r() - 0.5) * 1.5,
        trunkHeight * 0.3 + r() * trunkHeight,
        (r() - 0.5) * 1.5
      );
      group.add(light);
    }

    // Leaf clusters
    const leafColor = new THREE.Color().setHSL(0.35 + r() * 0.1, 0.7, 0.3);
    for (let i = 0; i < 4; i++) {
      const leaves = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3 + r() * 0.2, 0),
        new THREE.MeshBasicMaterial({ color: leafColor })
      );
      leaves.position.set(
        (r() - 0.5) * 0.8,
        trunkHeight + r() * 0.5,
        (r() - 0.5) * 0.8
      );
      group.add(leaves);
    }

    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Create ember/volcanic veins
   */
  createEmberVeins(scale = 1) {
    const group = new THREE.Group();
    const r = () => this.nextRandom();

    const rockColor = new THREE.Color(0x1a1a1a);
    const emberColor = new THREE.Color().setHSL(0.05 + r() * 0.05, 0.9, 0.5);

    // Charred base rock
    const base = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + r() * 0.2, 0),
      new THREE.MeshBasicMaterial({ color: rockColor })
    );
    base.scale.y = 0.5;
    base.position.y = 0.2;
    group.add(base);

    // Glowing veins/cracks spreading upward
    const veinCount = 4 + Math.floor(r() * 4);
    for (let i = 0; i < veinCount; i++) {
      const angle = (i / veinCount) * Math.PI * 2 + r() * 0.5;

      // Create vein as series of glowing segments
      let pos = new THREE.Vector3(
        Math.cos(angle) * 0.2,
        0.1,
        Math.sin(angle) * 0.2
      );

      const segCount = 3 + Math.floor(r() * 3);
      for (let s = 0; s < segCount; s++) {
        const segLength = 0.3 + r() * 0.3;
        const thickness = 0.04 * (1 - s / segCount * 0.5);

        const vein = new THREE.Mesh(
          new THREE.CylinderGeometry(thickness * 0.5, thickness, segLength, 4),
          new THREE.MeshBasicMaterial({
            color: emberColor,
            transparent: true,
            opacity: 0.9 - s * 0.15
          })
        );

        vein.position.copy(pos);
        vein.position.y += segLength / 2;
        vein.rotation.x = (r() - 0.5) * 0.4;
        vein.rotation.z = (r() - 0.5) * 0.4;
        group.add(vein);

        pos.y += segLength * 0.7;
        pos.x += (r() - 0.5) * 0.2;
        pos.z += (r() - 0.5) * 0.2;
      }

      // Glowing ember at tip
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + r() * 0.06, 6, 6),
        new THREE.MeshBasicMaterial({
          color: emberColor,
          transparent: true,
          opacity: 0.9
        })
      );
      ember.position.copy(pos);
      group.add(ember);
    }

    group.scale.setScalar(scale);
    return group;
  }
}

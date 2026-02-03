import * as THREE from 'three';

/**
 * GrassSystem - Instanced grass rendering with wind animation
 * Based on Al-Ro's grass implementation: https://al-ro.github.io/projects/grass/
 *
 * Also includes blob shadows and forest floor clutter
 */
export class GrassSystem {
  constructor(scene, terrainSystem, config = {}) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;

    this.config = {
      enabled: config.enabled ?? true,
      instanceCount: config.instanceCount ?? 50000,
      width: config.width ?? 200,
      bladeWidth: config.bladeWidth ?? 0.1,
      bladeHeight: config.bladeHeight ?? 0.8,
      joints: config.joints ?? 3,
      grassColor: config.grassColor ?? new THREE.Color(0.1, 0.4, 0.05),
      grassColorVariation: config.grassColorVariation ?? 0.15,
      windStrength: config.windStrength ?? 0.3,
      // Shadows
      shadowsEnabled: config.shadowsEnabled ?? true,
      // Clutter
      clutterEnabled: config.clutterEnabled ?? true,
      clutterDensity: config.clutterDensity ?? 100,
      ...config
    };

    this.grass = null;
    this.grassMaterial = null;
    this.grassShadows = null;
    this.grassShadowMaterial = null;
    this.baseOffsets = null;
    this.shadows = [];
    this.clutter = [];
    this.roverZ = 0;
    this.time = 0;

    // Fireflies
    this.fireflies = null;
    this.fireflyData = [];
  }

  create() {
    if (!this.config.enabled) return;

    this.createGrass();

    if (this.config.clutterEnabled) {
      this.createFloorClutter();
    }

    // Create fireflies for nighttime ambiance
    this.createFireflies();
  }

  createFireflies() {
    const fireflyCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(fireflyCount * 3);
    const sizes = new Float32Array(fireflyCount);

    this.fireflyData = [];

    for (let i = 0; i < fireflyCount; i++) {
      // Random starting positions - spread across visible area
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = 1 + Math.random() * 5; // Float above ground
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      sizes[i] = 0.8 + Math.random() * 0.6; // Larger for visibility

      // Store movement data for each firefly
      this.fireflyData.push({
        baseX: positions[i * 3],
        baseY: positions[i * 3 + 1],
        baseZ: positions[i * 3 + 2],
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        glowPhase: Math.random() * Math.PI * 2,
        glowSpeed: 1 + Math.random() * 2,
        radius: 1 + Math.random() * 2
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        varying float vSize;

        void main() {
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying float vSize;

        void main() {
          // Soft circular glow
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          float glow = smoothstep(0.5, 0.0, dist);

          // Warm orange-yellow firefly color - distinctly orange
          vec3 coreColor = vec3(1.0, 0.85, 0.3);  // Bright yellow-orange core
          vec3 glowColor = vec3(1.0, 0.4, 0.1);   // Deep orange outer glow
          vec3 color = mix(glowColor, coreColor, glow * glow);

          // Boost brightness for additive blending
          color *= 1.5;

          float alpha = glow * uOpacity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.fireflies = new THREE.Points(geometry, material);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  updateFireflies(delta, elapsed, sunBrightness, roverZ = 0) {
    if (!this.fireflies) return;

    // Fireflies visible from dusk through night (fade in when sun goes below 0.6)
    const nightAmount = Math.max(0, 1 - sunBrightness * 1.5);
    this.fireflies.material.uniforms.uOpacity.value = nightAmount;
    this.fireflies.material.uniforms.uTime.value = elapsed;

    if (nightAmount < 0.05) return; // Skip update if barely visible

    const positions = this.fireflies.geometry.attributes.position.array;
    const sizes = this.fireflies.geometry.attributes.size.array;

    const wrapRange = 100;
    const halfRange = wrapRange / 2;

    for (let i = 0; i < this.fireflyData.length; i++) {
      const data = this.fireflyData[i];

      // Gentle floating movement around base position
      const localX = Math.sin(elapsed * data.speed + data.phase) * data.radius;
      const localY = Math.sin(elapsed * data.speed * 0.7 + data.phase * 1.3) * 0.5;
      const localZ = Math.cos(elapsed * data.speed * 0.8 + data.phase) * data.radius;

      // Wrap Z position relative to rover (like grass does)
      let wrappedZ = data.baseZ - roverZ;
      wrappedZ = ((wrappedZ % wrapRange) + wrapRange + halfRange) % wrapRange - halfRange;

      positions[i * 3] = data.baseX + localX;
      positions[i * 3 + 1] = data.baseY + localY;
      positions[i * 3 + 2] = wrappedZ + localZ;

      // Pulsing glow - more dramatic
      const glow = 0.5 + Math.sin(elapsed * data.glowSpeed + data.glowPhase) * 0.5;
      sizes[i] = (0.6 + glow * 0.8) * (0.5 + nightAmount * 0.5);
    }

    this.fireflies.geometry.attributes.position.needsUpdate = true;
    this.fireflies.geometry.attributes.size.needsUpdate = true;
  }

  createGrass() {
    const { instanceCount, width, bladeWidth, bladeHeight, joints, grassColor } = this.config;

    // Create base blade geometry - a curved plane
    const bladeGeometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, joints);
    bladeGeometry.translate(0, bladeHeight / 2, 0);

    // Bend the blade slightly
    const positions = bladeGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      const frac = y / bladeHeight;
      // Curve forward slightly at top
      positions[i + 2] += frac * frac * bladeWidth * 0.5;
    }
    bladeGeometry.computeVertexNormals();

    // Create instanced geometry
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    instancedGeometry.index = bladeGeometry.index;
    instancedGeometry.attributes.position = bladeGeometry.attributes.position;
    instancedGeometry.attributes.uv = bladeGeometry.attributes.uv;
    instancedGeometry.attributes.normal = bladeGeometry.attributes.normal;

    // Instance attributes
    const offsets = new Float32Array(instanceCount * 3);
    const scales = new Float32Array(instanceCount);
    const rotations = new Float32Array(instanceCount);
    const colors = new Float32Array(instanceCount * 3);

    const halfWidth = width / 2;
    const baseColor = grassColor.clone();

    for (let i = 0; i < instanceCount; i++) {
      // Random position
      const x = (Math.random() - 0.5) * width;
      const z = (Math.random() - 0.5) * width;
      offsets[i * 3] = x;
      offsets[i * 3 + 2] = z;

      // Calculate terrain height at this position
      if (this.terrainSystem) {
        offsets[i * 3 + 1] = this.terrainSystem.getHeight(x, z);
      } else {
        offsets[i * 3 + 1] = 0;
      }

      // Random scale (0.5 to 1.5)
      scales[i] = 0.5 + Math.random();

      // Random rotation
      rotations[i] = Math.random() * Math.PI * 2;

      // Color variation
      const variation = (Math.random() - 0.5) * this.config.grassColorVariation;
      colors[i * 3] = Math.max(0, baseColor.r + variation);
      colors[i * 3 + 1] = Math.max(0, baseColor.g + variation * 2);
      colors[i * 3 + 2] = Math.max(0, baseColor.b + variation * 0.5);
    }

    // Store base Z positions for wrapping calculations
    this.baseOffsets = new Float32Array(instanceCount * 2);
    for (let i = 0; i < instanceCount; i++) {
      this.baseOffsets[i * 2] = offsets[i * 3];     // x
      this.baseOffsets[i * 2 + 1] = offsets[i * 3 + 2]; // z
    }

    instancedGeometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
    instancedGeometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1));
    instancedGeometry.setAttribute('rotation', new THREE.InstancedBufferAttribute(rotations, 1));
    instancedGeometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));

    // Grass shader material - simplified, heights calculated on CPU
    this.grassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: this.config.windStrength },
        uBladeHeight: { value: bladeHeight },
        uAmbientLight: { value: 1.0 }
      },
      vertexShader: `
        attribute vec3 offset;
        attribute float scale;
        attribute float rotation;
        attribute vec3 color;

        uniform float uTime;
        uniform float uWindStrength;
        uniform float uBladeHeight;

        varying vec3 vColor;
        varying float vY;

        void main() {
          vColor = color;

          // Get normalized height along blade
          float heightFrac = position.y / uBladeHeight;
          vY = heightFrac;

          // Apply scale
          vec3 pos = position;
          pos.y *= scale;

          // Apply rotation around Y axis
          float c = cos(rotation);
          float s = sin(rotation);
          vec3 rotatedPos = vec3(
            pos.x * c - pos.z * s,
            pos.y,
            pos.x * s + pos.z * c
          );

          // Wind animation - bend based on height
          float windPhase = offset.x * 0.05 + offset.z * 0.05 + uTime * 2.0;
          float windBend = sin(windPhase) * uWindStrength * heightFrac * heightFrac;
          rotatedPos.x += windBend;
          rotatedPos.z += windBend * 0.5;

          // Apply offset (includes terrain height in Y)
          vec3 worldPos = rotatedPos + offset;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uAmbientLight;
        varying vec3 vColor;
        varying float vY;

        void main() {
          // Start with base color, boosted for visibility
          vec3 col = vColor * 1.4;

          // Fake AO - strong darkening at the base
          float ao = smoothstep(0.0, 0.4, vY);
          col *= 0.25 + ao * 0.75;

          // Add earthy brown tint at base, transitioning to green
          vec3 baseColor = vec3(0.08, 0.05, 0.02); // Dark earth
          col = mix(baseColor, col, smoothstep(0.0, 0.25, vY));

          // Brighten tips with yellow-green highlight
          col += vec3(0.08, 0.15, 0.03) * vY * vY;

          // Subtle subsurface scattering feel - lighter edges at top
          col += vec3(0.02, 0.06, 0.01) * vY;

          // Apply day/night ambient light (slightly blue tint at night)
          vec3 nightTint = vec3(0.7, 0.75, 0.9);
          vec3 ambientColor = mix(nightTint, vec3(1.0), uAmbientLight);
          col *= ambientColor * (0.15 + uAmbientLight * 0.85);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });

    this.grass = new THREE.Mesh(instancedGeometry, this.grassMaterial);
    this.grass.frustumCulled = false;
    this.scene.add(this.grass);

    // Create instanced shadows at grass blade bases
    this.createGrassShadows(instanceCount, offsets, scales);
  }

  createGrassShadows(instanceCount, offsets, scales) {
    // Small circle for each grass blade shadow
    const shadowRadius = 0.15;
    const shadowGeometry = new THREE.CircleGeometry(shadowRadius, 6);
    shadowGeometry.rotateX(-Math.PI / 2);

    // Create instanced geometry for shadows
    const instancedShadowGeom = new THREE.InstancedBufferGeometry();
    instancedShadowGeom.index = shadowGeometry.index;
    instancedShadowGeom.attributes.position = shadowGeometry.attributes.position;
    instancedShadowGeom.attributes.uv = shadowGeometry.attributes.uv;

    // Copy offset data but adjust Y slightly above ground
    const shadowOffsets = new Float32Array(offsets.length);
    for (let i = 0; i < offsets.length; i += 3) {
      shadowOffsets[i] = offsets[i];         // x
      shadowOffsets[i + 1] = offsets[i + 1] + 0.02; // y - slightly above ground
      shadowOffsets[i + 2] = offsets[i + 2]; // z
    }

    // Scale shadows based on grass scale
    const shadowScales = new Float32Array(instanceCount);
    for (let i = 0; i < instanceCount; i++) {
      shadowScales[i] = scales[i] * 0.8; // Slightly smaller than grass
    }

    instancedShadowGeom.setAttribute('offset', new THREE.InstancedBufferAttribute(shadowOffsets, 3));
    instancedShadowGeom.setAttribute('scale', new THREE.InstancedBufferAttribute(shadowScales, 1));

    // Simple shadow shader with sun brightness
    this.grassShadowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunBrightness: { value: 1.0 }
      },
      vertexShader: `
        attribute vec3 offset;
        attribute float scale;

        varying vec2 vUv;

        void main() {
          vUv = uv;

          vec3 pos = position * scale;
          vec3 worldPos = pos + offset;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSunBrightness;
        varying vec2 vUv;

        void main() {
          // Circular falloff from center
          vec2 center = vec2(0.5, 0.5);
          float dist = length(vUv - center) * 2.0;

          // Base shadow alpha, modulated by sun brightness
          float baseAlpha = smoothstep(1.0, 0.3, dist) * 0.4;
          float alpha = baseAlpha * uSunBrightness;

          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.grassShadows = new THREE.Mesh(instancedShadowGeom, this.grassShadowMaterial);
    this.grassShadows.frustumCulled = false;
    this.grassShadows.renderOrder = -1; // Render before grass
    this.scene.add(this.grassShadows);
  }

  /**
   * Create dappled blob shadows under trees
   */
  addTreeShadow(x, z, radius = 3) {
    if (!this.config.shadowsEnabled) return;

    const shadowGeom = new THREE.CircleGeometry(radius, 16);
    shadowGeom.rotateX(-Math.PI / 2);

    // Dappled shadow shader - noise pattern simulates light through leaves
    const shadowMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunBrightness: { value: 1.0 },
        uRadius: { value: radius },
        uTreePos: { value: new THREE.Vector2(x, z) } // Fixed tree position for stable noise
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSunBrightness;
        uniform float uRadius;
        uniform vec2 uTreePos;
        varying vec2 vUv;

        // Simple noise for dappled pattern
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          // Circular falloff from center
          vec2 center = vec2(0.5, 0.5);
          float dist = length(vUv - center) * 2.0;
          float circleFalloff = smoothstep(1.0, 0.4, dist);

          // Dappled light pattern - use fixed tree position + UV for stable pattern
          vec2 noiseCoord = uTreePos + (vUv - 0.5) * uRadius * 2.0;
          float dappleScale = 0.5;
          float dapple1 = noise(noiseCoord * dappleScale * 2.0);
          float dapple2 = noise(noiseCoord * dappleScale * 5.0 + vec2(50.0));
          float dapple = dapple1 * 0.6 + dapple2 * 0.4;

          // Create holes in the shadow where "light comes through"
          float lightThrough = smoothstep(0.35, 0.65, dapple);
          float shadowStrength = mix(0.5, 0.15, lightThrough);

          // Final alpha
          float alpha = circleFalloff * shadowStrength * uSunBrightness;

          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.position.set(x, 0.05, z);
    shadow.userData.worldX = x;
    shadow.userData.worldZ = z;
    shadow.renderOrder = -1;

    this.scene.add(shadow);
    this.shadows.push(shadow);
  }

  /**
   * Create forest floor clutter - rocks, sticks, leaf piles
   */
  createFloorClutter() {
    const density = this.config.clutterDensity;
    const width = this.config.width;

    // Small rocks
    const rockGeom = new THREE.DodecahedronGeometry(0.15, 0);
    const rockMat = new THREE.MeshBasicMaterial({ color: 0x555555 });

    for (let i = 0; i < density; i++) {
      const rock = new THREE.Mesh(rockGeom, rockMat.clone());
      rock.material.color.setHSL(0.08, 0.1, 0.3 + Math.random() * 0.2);
      rock.userData.baseColor = rock.material.color.clone();
      rock.position.set(
        (Math.random() - 0.5) * width,
        0.05,
        (Math.random() - 0.5) * width
      );
      rock.scale.setScalar(0.5 + Math.random() * 1.5);
      rock.scale.y *= 0.5 + Math.random() * 0.5;
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.userData.worldX = rock.position.x;
      rock.userData.worldZ = rock.position.z;
      this.scene.add(rock);
      this.clutter.push(rock);
    }

    // Fallen sticks/twigs
    const stickGeom = new THREE.CylinderGeometry(0.02, 0.03, 0.8, 4);
    stickGeom.rotateZ(Math.PI / 2);
    const stickMat = new THREE.MeshBasicMaterial({ color: 0x3d2817 });

    for (let i = 0; i < density * 0.5; i++) {
      const stick = new THREE.Mesh(stickGeom, stickMat.clone());
      stick.material.color.setHSL(0.08, 0.4, 0.15 + Math.random() * 0.1);
      stick.userData.baseColor = stick.material.color.clone();
      stick.position.set(
        (Math.random() - 0.5) * width,
        0.02,
        (Math.random() - 0.5) * width
      );
      stick.rotation.y = Math.random() * Math.PI;
      stick.scale.setScalar(0.5 + Math.random() * 1.5);
      stick.userData.worldX = stick.position.x;
      stick.userData.worldZ = stick.position.z;
      this.scene.add(stick);
      this.clutter.push(stick);
    }

    // Leaf piles / ground cover patches
    const pileGeom = new THREE.CircleGeometry(0.4, 6);
    pileGeom.rotateX(-Math.PI / 2);

    for (let i = 0; i < density * 0.3; i++) {
      const pile = new THREE.Mesh(pileGeom, new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.5, 0.2 + Math.random() * 0.1),
        transparent: true,
        opacity: 0.7
      }));
      pile.userData.baseColor = pile.material.color.clone();
      pile.position.set(
        (Math.random() - 0.5) * width,
        0.01,
        (Math.random() - 0.5) * width
      );
      pile.scale.setScalar(0.5 + Math.random() * 2);
      pile.userData.worldX = pile.position.x;
      pile.userData.worldZ = pile.position.z;
      this.scene.add(pile);
      this.clutter.push(pile);
    }

    // Small ferns/plants
    for (let i = 0; i < density * 0.4; i++) {
      const fern = this.createSmallFern();
      fern.position.set(
        (Math.random() - 0.5) * width,
        0,
        (Math.random() - 0.5) * width
      );
      fern.userData.worldX = fern.position.x;
      fern.userData.worldZ = fern.position.z;
      this.scene.add(fern);
      this.clutter.push(fern);
    }
  }

  createSmallFern() {
    const group = new THREE.Group();
    const frondCount = 4 + Math.floor(Math.random() * 4);
    const color = new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.6, 0.2 + Math.random() * 0.1);

    for (let i = 0; i < frondCount; i++) {
      const frond = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.4),
        new THREE.MeshBasicMaterial({ color: color.clone(), side: THREE.DoubleSide })
      );
      frond.userData.baseColor = frond.material.color.clone();
      frond.position.y = 0.15;
      const angle = (i / frondCount) * Math.PI * 2;
      frond.rotation.set(-0.6, angle, 0);
      group.add(frond);
    }

    group.scale.setScalar(0.5 + Math.random() * 0.5);
    return group;
  }

  update(delta, elapsed, audioData, roverZ, sunBrightness = 1.0) {
    if (!this.config.enabled) return;

    this.time = elapsed;

    // Update grass shader
    if (this.grassMaterial) {
      this.grassMaterial.uniforms.uTime.value = elapsed;
      this.grassMaterial.uniforms.uAmbientLight.value = sunBrightness;

      // Audio reactivity - wind strength
      if (audioData) {
        const targetWind = this.config.windStrength + audioData.mid * 0.5;
        this.grassMaterial.uniforms.uWindStrength.value +=
          (targetWind - this.grassMaterial.uniforms.uWindStrength.value) * 0.1;
      }
    }

    // Update grass shadow intensity based on sun
    if (this.grassShadowMaterial) {
      this.grassShadowMaterial.uniforms.uSunBrightness.value = sunBrightness;
    }

    // Update fireflies (only at night)
    this.updateFireflies(delta, elapsed, sunBrightness, roverZ);

    // Update grass positions with wrapping (optimized - only recalc height on wrap)
    if (this.grass && this.baseOffsets && this.terrainSystem) {
      const offsets = this.grass.geometry.attributes.offset.array;
      const wrapRange = this.config.width;
      const halfRange = wrapRange / 2;
      const terrainY = this.terrainSystem.terrain ? this.terrainSystem.terrain.position.y : 0;

      // Position grass mesh at terrain Y offset
      this.grass.position.y = terrainY;

      // Get shadow offsets if they exist
      const shadowOffsets = this.grassShadows?.geometry?.attributes?.offset?.array;
      if (this.grassShadows) {
        this.grassShadows.position.y = terrainY;
      }

      const instanceCount = this.config.instanceCount;

      // Initialize height cache if needed
      if (!this.heightCache) {
        this.heightCache = new Float32Array(instanceCount);
        this.lastWrappedZ = new Float32Array(instanceCount);
        for (let i = 0; i < instanceCount; i++) {
          this.heightCache[i] = offsets[i * 3 + 1];
          this.lastWrappedZ[i] = this.baseOffsets[i * 2 + 1];
        }
      }

      for (let i = 0; i < instanceCount; i++) {
        const baseX = this.baseOffsets[i * 2];
        const baseZ = this.baseOffsets[i * 2 + 1];

        // Calculate wrapped Z position
        let wrappedZ = baseZ - roverZ;
        wrappedZ = ((wrappedZ % wrapRange) + wrapRange + halfRange) % wrapRange - halfRange;

        // Only recalculate height if blade wrapped around (sign change or big jump)
        const lastZ = this.lastWrappedZ[i];
        const wrapped = Math.abs(wrappedZ - lastZ) > wrapRange * 0.5;

        if (wrapped) {
          const worldZ = wrappedZ + roverZ;
          this.heightCache[i] = this.terrainSystem.getHeight(baseX, worldZ);
        }
        this.lastWrappedZ[i] = wrappedZ;

        // Update offset
        offsets[i * 3] = baseX;
        offsets[i * 3 + 1] = this.heightCache[i];
        offsets[i * 3 + 2] = wrappedZ;

        // Update shadow positions to match
        if (shadowOffsets) {
          shadowOffsets[i * 3] = baseX;
          shadowOffsets[i * 3 + 1] = this.heightCache[i] + 0.02;
          shadowOffsets[i * 3 + 2] = wrappedZ;
        }
      }

      this.grass.geometry.attributes.offset.needsUpdate = true;
      if (this.grassShadows) {
        this.grassShadows.geometry.attributes.offset.needsUpdate = true;
      }
    }

    // Update shadows and clutter positions (wrap around)
    const wrapRange = 200;
    const halfRange = wrapRange / 2;

    for (const shadow of this.shadows) {
      const relZ = shadow.userData.worldZ - roverZ;
      shadow.position.z = ((relZ % wrapRange) + wrapRange * 1.5) % wrapRange - halfRange;
      shadow.position.y = this.terrainSystem.getHeight(shadow.userData.worldX, shadow.userData.worldZ - roverZ + shadow.position.z) +
                          this.terrainSystem.terrain.position.y + 0.05;
      // Update sun brightness for dappled shadows
      if (shadow.material.uniforms?.uSunBrightness) {
        shadow.material.uniforms.uSunBrightness.value = sunBrightness;
      }
    }

    // Night tint color (blue-ish)
    const nightTint = new THREE.Color(0.7, 0.75, 0.9);
    const ambientLevel = 0.15 + sunBrightness * 0.85;

    for (const item of this.clutter) {
      const relZ = item.userData.worldZ - roverZ;
      item.position.z = ((relZ % wrapRange) + wrapRange * 1.5) % wrapRange - halfRange;
      const actualWorldZ = item.position.z + roverZ;
      item.position.y = this.terrainSystem.getHeight(item.userData.worldX, actualWorldZ) +
                        this.terrainSystem.terrain.position.y + 0.02;

      // Apply night darkening to clutter
      if (item.material && item.userData.baseColor) {
        const base = item.userData.baseColor;
        const tintedR = base.r * (nightTint.r + (1 - nightTint.r) * sunBrightness) * ambientLevel;
        const tintedG = base.g * (nightTint.g + (1 - nightTint.g) * sunBrightness) * ambientLevel;
        const tintedB = base.b * (nightTint.b + (1 - nightTint.b) * sunBrightness) * ambientLevel;
        item.material.color.setRGB(tintedR, tintedG, tintedB);
      }

      // Handle groups (like ferns) with child meshes
      if (item.children) {
        item.traverse(child => {
          if (child.material && child.userData.baseColor) {
            const base = child.userData.baseColor;
            const tintedR = base.r * (nightTint.r + (1 - nightTint.r) * sunBrightness) * ambientLevel;
            const tintedG = base.g * (nightTint.g + (1 - nightTint.g) * sunBrightness) * ambientLevel;
            const tintedB = base.b * (nightTint.b + (1 - nightTint.b) * sunBrightness) * ambientLevel;
            child.material.color.setRGB(tintedR, tintedG, tintedB);
          }
        });
      }
    }
  }

  /**
   * Set grass color for different biomes
   */
  setGrassColor(color) {
    if (!this.grass) return;

    const colors = this.grass.geometry.attributes.color.array;
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < colors.length; i += 3) {
      const variation = (Math.random() - 0.5) * this.config.grassColorVariation;
      colors[i] = Math.max(0, baseColor.r + variation);
      colors[i + 1] = Math.max(0, baseColor.g + variation * 2);
      colors[i + 2] = Math.max(0, baseColor.b + variation * 0.5);
    }

    this.grass.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    if (this.grass) {
      this.scene.remove(this.grass);
      this.grass.geometry.dispose();
      this.grassMaterial.dispose();
    }

    if (this.grassShadows) {
      this.scene.remove(this.grassShadows);
      this.grassShadows.geometry.dispose();
      this.grassShadowMaterial.dispose();
    }

    if (this.fireflies) {
      this.scene.remove(this.fireflies);
      this.fireflies.geometry.dispose();
      this.fireflies.material.dispose();
      this.fireflies = null;
      this.fireflyData = [];
    }

    for (const shadow of this.shadows) {
      this.scene.remove(shadow);
      shadow.geometry.dispose();
      shadow.material.dispose();
    }

    for (const item of this.clutter) {
      this.scene.remove(item);
      if (item.geometry) item.geometry.dispose();
      if (item.material) item.material.dispose();
      item.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    this.shadows = [];
    this.clutter = [];
  }
}

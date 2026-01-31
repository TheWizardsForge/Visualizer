import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BaseMode } from './BaseMode.js';

// Custom CRT/Retro shader with underwater effect
const RetroShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uScanlines: { value: 0.0 },
    uScanlineIntensity: { value: 0.15 },
    uChromaticAberration: { value: 0.0 },
    uVignette: { value: 0.0 },
    uFlicker: { value: 0.0 },
    uUnderwater: { value: 0.0 },
    uGlitch: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uScanlines;
    uniform float uScanlineIntensity;
    uniform float uChromaticAberration;
    uniform float uVignette;
    uniform float uFlicker;
    uniform float uUnderwater;
    uniform float uGlitch;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Glitch effect - random displacement
      if (uGlitch > 0.0) {
        float glitchLine = step(0.99, fract(sin(floor(uv.y * 50.0) + uTime * 100.0) * 43758.5453));
        uv.x += glitchLine * uGlitch * 0.1 * sin(uTime * 500.0);

        // Random block displacement
        float block = step(0.98, fract(sin(floor(uv.y * 20.0 + uTime * 50.0) * 12.9898) * 43758.5453));
        uv.x += block * uGlitch * 0.05;
      }

      // Underwater distortion
      if (uUnderwater > 0.0) {
        uv.x += sin(uv.y * 20.0 + uTime * 3.0) * 0.01 * uUnderwater;
        uv.y += sin(uv.x * 15.0 + uTime * 2.0) * 0.008 * uUnderwater;
      }

      // Chromatic aberration (including glitch boost)
      float aberration = uChromaticAberration + uGlitch * 0.02;
      vec2 offset = (uv - 0.5) * aberration;
      float r = texture2D(tDiffuse, uv + offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - offset).b;
      vec3 color = vec3(r, g, b);

      // Underwater color tint
      if (uUnderwater > 0.0) {
        color.r *= 1.0 - uUnderwater * 0.3;
        color.g *= 1.0 - uUnderwater * 0.1;
        color.b *= 1.0 + uUnderwater * 0.2;

        // Caustic light patterns
        float caustic = sin(uv.x * 30.0 + uTime * 2.0) * sin(uv.y * 30.0 + uTime * 1.5);
        caustic = pow(max(0.0, caustic), 2.0);
        color += vec3(0.1, 0.2, 0.3) * caustic * uUnderwater;

        // Murky depth fade
        float depth = uUnderwater * 0.3;
        color = mix(color, vec3(0.05, 0.15, 0.2), depth);

        // Bubbles (subtle bright spots)
        float bubbles = step(0.995, fract(sin(dot(uv * 100.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453));
        color += vec3(0.3, 0.4, 0.5) * bubbles * uUnderwater;
      }

      // Scanlines (including glitch boost)
      float scanlineAmount = uScanlines + uGlitch * 0.5;
      if (scanlineAmount > 0.0) {
        float scanline = sin(uv.y * 800.0) * 0.5 + 0.5;
        scanline = pow(scanline, 1.5);
        color *= 1.0 - scanline * uScanlineIntensity * scanlineAmount;

        // Horizontal interference lines
        float interference = sin(uv.y * 200.0 + uTime * 10.0) * 0.5 + 0.5;
        interference *= sin(uv.y * 50.0 - uTime * 5.0) * 0.5 + 0.5;
        color *= 1.0 - interference * scanlineAmount * 0.1;
      }

      // Screen flicker (including glitch boost)
      float flickerAmount = uFlicker + uGlitch * 0.3;
      float flicker = 1.0 - flickerAmount * (sin(uTime * 60.0) * 0.5 + 0.5);
      color *= flicker;

      // Vignette
      if (uVignette > 0.0) {
        vec2 vignetteUV = uv * (1.0 - uv.yx);
        float vignette = vignetteUV.x * vignetteUV.y * 15.0;
        vignette = pow(vignette, uVignette);
        color *= vignette;
      }

      // CRT phosphors during glitch
      if (uGlitch > 0.3) {
        float pixelX = mod(gl_FragCoord.x, 3.0);
        vec3 phosphor = vec3(
          pixelX < 1.0 ? 1.0 : 0.85,
          pixelX >= 1.0 && pixelX < 2.0 ? 1.0 : 0.85,
          pixelX >= 2.0 ? 1.0 : 0.85
        );
        color *= mix(vec3(1.0), phosphor, uGlitch * 0.5);
      }

      // Color corruption during heavy glitch
      if (uGlitch > 0.5) {
        float corrupt = step(0.95, fract(sin(uv.y * 100.0 + uTime * 200.0) * 43758.5453));
        color = mix(color, color.gbr, corrupt * uGlitch);
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

// Simplex noise implementation
class SimplexNoise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let n = seed * 256;
    for (let i = 255; i > 0; i--) {
      n = (n * 16807) % 2147483647;
      const j = n % (i + 1);
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }

  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const grad = (hash, x, y) => {
      const h = hash & 7;
      const u = h < 4 ? x : y, v = h < 4 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    };
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * grad(this.perm[ii + this.perm[jj]], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2); }
    return 70 * (n0 + n1 + n2);
  }

  fbm(x, y, octaves = 4) {
    let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value / maxValue;
  }
}

export class RoverMode extends BaseMode {
  constructor(renderer) {
    super(renderer);

    this.params = {
      speed: 1.0,
      fov: 90,
      terrainScale: 0.00015,
      terrainHeight: 15,
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
      cameraMode: 'normal' // 'normal', 'cinematic', 'orbit', 'low'
    };

    this.noise = new SimplexNoise(42);
    this.roverPosition = new THREE.Vector3(0, 0, 0);
    this.time = 0;
    this.cameraY = 0;
    this.cameraTilt = 0;
    this.cameraRoll = 0;

    // Event/state tracking
    this.currentWeather = 'clear';
    this.weatherTimer = 0;
    this.weatherTransition = 0;
    this.dayNightCycle = 0.75; // Start at night (0=noon, 0.5=sunset, 0.75=night, 1=sunrise)
    this.dayNightSpeed = 0.01; // Full cycle in ~100 seconds
    this.activeEvents = [];
    this.isUnderwater = false;
    this.underwaterDepth = 0;
    this.glitchTimer = 0;
    this.glitchActive = false;
    this.glitchIntensity = 0;

    this.setupScene();
  }

  setupScene() {
    this.camera = new THREE.PerspectiveCamera(this.params.fov, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 2, 0);

    this.scene.fog = new THREE.FogExp2(0x0a0a15, this.params.fogDensity);
    this.scene.background = new THREE.Color(0x000008);

    this.createLensflareTextures();
    this.createSkybox();
    this.createPlanetaryRings();
    this.createTerrain();
    this.createMoons();
    this.createNebula();
    this.createShootingStarSystem();
    this.createAmbientParticles();
    this.createDistantMountains();

    // New features
    this.createFlora();
    this.createFauna();
    this.createStructures();
    this.createLocalFeatures();
    this.createWeatherSystems();
    this.createSpaceEvents();
    this.createAurora();
    this.createAlienLakes();
    this.createCloudLayers();

    // Post-processing bloom
    this.setupBloom();
  }

  createCloudLayers() {
    this.clouds = [];
    const layerCount = 3;

    for (let layer = 0; layer < layerCount; layer++) {
      const geometry = new THREE.PlaneGeometry(500, 500, 1, 1);
      geometry.rotateX(-Math.PI / 2);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.3 - layer * 0.08 },
          uSpeed: { value: 0.02 + layer * 0.01 },
          uScale: { value: 1.0 + layer * 0.5 },
          uColor: { value: new THREE.Color(0.4, 0.45, 0.5) }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uOpacity;
          uniform float uSpeed;
          uniform float uScale;
          uniform vec3 uColor;
          varying vec2 vUv;

          // FBM noise for cloud shapes
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

          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec2 uv = vUv * uScale;

            // Animate clouds
            uv.x += uTime * uSpeed;
            uv.y += uTime * uSpeed * 0.3;

            // Multiple noise layers for wispy clouds
            float cloud = fbm(uv * 3.0);
            cloud *= fbm(uv * 5.0 + 10.0);
            cloud = pow(cloud, 1.5);

            // Add wispy tendrils
            float wisps = fbm(uv * 8.0 + uTime * 0.1);
            cloud += wisps * 0.3;

            // Fade at edges
            float edgeFade = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
            edgeFade *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);

            float alpha = cloud * uOpacity * edgeFade;
            alpha = clamp(alpha, 0.0, uOpacity);

            vec3 color = uColor * (0.8 + cloud * 0.4);

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      const cloudLayer = new THREE.Mesh(geometry, material);
      cloudLayer.position.set(0, 80 + layer * 40, -100);

      this.scene.add(cloudLayer);
      this.clouds.push(cloudLayer);
    }
  }

  updateClouds(delta, elapsed) {
    this.clouds?.forEach((cloud, i) => {
      cloud.material.uniforms.uTime.value = elapsed;

      // Clouds drift slowly
      cloud.position.x = Math.sin(elapsed * 0.02 + i) * 50;
      cloud.position.z = -100 + Math.cos(elapsed * 0.015 + i * 2) * 30;

      // Color shifts with day/night
      const nightColor = new THREE.Color(0.15, 0.18, 0.25);
      const dayColor = new THREE.Color(0.5, 0.55, 0.6);
      const sunHeight = Math.sin(this.dayNightCycle * Math.PI * 2);
      const t = (sunHeight + 1) / 2;
      cloud.material.uniforms.uColor.value.copy(nightColor).lerp(dayColor, t);
    });
  }

  createAlienLakes() {
    this.lakes = [];
    this.alienFish = [];
    this.alienCoral = [];
    const lakeCount = 3; // Fewer but larger lakes

    for (let i = 0; i < lakeCount; i++) {
      const size = 30 + Math.random() * 40; // Larger lakes
      const geometry = new THREE.CircleGeometry(size, 32);
      geometry.rotateX(-Math.PI / 2);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSkyColor: { value: new THREE.Color(0x000020) },
          uLakeColor: { value: new THREE.Color(0.1, 0.3, 0.4) },
          uAudioBass: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uSkyColor;
          uniform vec3 uLakeColor;
          uniform float uAudioBass;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          void main() {
            vec2 center = vUv - 0.5;
            float dist = length(center);

            // Ripple effect
            float ripple = sin(dist * 20.0 - uTime * 2.0) * 0.5 + 0.5;
            ripple *= sin(dist * 30.0 - uTime * 3.0 + 1.0) * 0.5 + 0.5;
            ripple = pow(ripple, 2.0);

            // Audio reactive waves
            float audioWave = sin(dist * 15.0 - uTime * 5.0) * uAudioBass * 0.3;

            // Fake reflection - blend sky color with lake color
            float fresnel = pow(1.0 - dist * 1.5, 2.0);
            fresnel = clamp(fresnel, 0.0, 1.0);

            vec3 reflectedColor = mix(uSkyColor, vec3(0.2, 0.4, 0.6), 0.3);
            vec3 color = mix(uLakeColor, reflectedColor, fresnel);

            // Add shimmer
            color += vec3(0.1, 0.2, 0.3) * ripple * 0.3;
            color += vec3(0.1, 0.15, 0.2) * audioWave;

            // Glowing edge
            float edge = smoothstep(0.5, 0.4, dist);
            float glow = smoothstep(0.5, 0.35, dist) - smoothstep(0.4, 0.25, dist);
            color += vec3(0.2, 0.5, 0.6) * glow * 0.5;

            // Bioluminescent spots
            float spots = sin(vWorldPos.x * 0.5 + uTime) * sin(vWorldPos.z * 0.5 - uTime * 0.7);
            spots = max(0.0, spots) * (1.0 - dist * 2.0);
            color += vec3(0.3, 0.8, 0.6) * spots * 0.4;

            float alpha = edge * 0.85;

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const lake = new THREE.Mesh(geometry, material);

      // Position lakes more spread out
      lake.position.set(
        (Math.random() - 0.5) * 250,
        -1.5,
        (Math.random() - 0.5) * 250
      );

      lake.userData = {
        worldX: lake.position.x,
        worldZ: lake.position.z,
        size: size
      };

      this.scene.add(lake);
      this.lakes.push(lake);

      // Add coral around the lake
      this.createCoralForLake(lake, size);

      // Add fish in the lake
      this.createFishForLake(lake, size);
    }
  }

  createCoralForLake(lake, lakeSize) {
    const coralCount = 15 + Math.floor(Math.random() * 12);

    // Vibrant coral color palettes
    const coralPalettes = [
      { h: 0.85, name: 'magenta' },    // Vibrant magenta/pink
      { h: 0.55, name: 'cyan' },       // Electric cyan
      { h: 0.75, name: 'purple' },     // Deep purple
      { h: 0.95, name: 'red' },        // Hot coral red
      { h: 0.45, name: 'teal' },       // Teal
      { h: 0.15, name: 'orange' },     // Bioluminescent orange
      { h: 0.65, name: 'blue' },       // Electric blue
    ];

    // Create glowing coral shader material
    const createCoralMaterial = (baseColor, glowColor) => {
      return new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBaseColor: { value: baseColor },
          uGlowColor: { value: glowColor },
          uPhase: { value: Math.random() * Math.PI * 2 }
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normal;
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uBaseColor;
          uniform vec3 uGlowColor;
          uniform float uPhase;
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            float pulse = sin(uTime * 2.0 + uPhase + vPosition.y * 3.0) * 0.3 + 0.7;
            float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
            vec3 color = mix(uBaseColor, uGlowColor, rim * 0.5 + pulse * 0.3);
            color += uGlowColor * rim * 0.8 * pulse;
            gl_FragColor = vec4(color, 0.9);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
    };

    for (let i = 0; i < coralCount; i++) {
      // Position coral throughout the lake, not just edges
      const angle = (i / coralCount) * Math.PI * 2 + Math.random() * 0.8;
      const dist = lakeSize * (0.15 + Math.random() * 0.6);

      const coralGroup = new THREE.Group();

      // Pick a vibrant color palette
      const palette = coralPalettes[Math.floor(Math.random() * coralPalettes.length)];
      const hue = palette.h + (Math.random() - 0.5) * 0.1;
      const baseColor = new THREE.Color().setHSL(hue, 0.9, 0.4);
      const glowColor = new THREE.Color().setHSL(hue, 1.0, 0.7);

      // Vary coral types
      const coralType = Math.floor(Math.random() * 4);

      if (coralType === 0) {
        // Branching coral - tall with multiple arms
        const branchCount = 4 + Math.floor(Math.random() * 5);
        for (let b = 0; b < branchCount; b++) {
          const height = 1.5 + Math.random() * 3;
          const branchGeom = new THREE.CylinderGeometry(0.08, 0.25, height, 6);
          const branchMat = createCoralMaterial(baseColor, glowColor);
          const branch = new THREE.Mesh(branchGeom, branchMat);

          branch.position.set(
            (Math.random() - 0.5) * 1.2,
            height / 2,
            (Math.random() - 0.5) * 1.2
          );
          branch.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.5
          );
          coralGroup.add(branch);

          // Glowing bulb tips
          const tipGeom = new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 8, 8);
          const tipMat = new THREE.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
          });
          const tip = new THREE.Mesh(tipGeom, tipMat);
          tip.position.copy(branch.position);
          tip.position.y += height / 2 + 0.1;
          coralGroup.add(tip);
        }
      } else if (coralType === 1) {
        // Fan coral - flat spreading shape
        const fanGeom = new THREE.PlaneGeometry(2 + Math.random(), 2 + Math.random() * 1.5, 8, 8);
        // Warp vertices for organic shape
        const positions = fanGeom.attributes.position.array;
        for (let v = 0; v < positions.length; v += 3) {
          positions[v] += (Math.random() - 0.5) * 0.3;
          positions[v + 1] += (Math.random() - 0.5) * 0.3;
          positions[v + 2] += (Math.random() - 0.5) * 0.2;
        }
        fanGeom.attributes.position.needsUpdate = true;
        fanGeom.computeVertexNormals();

        const fanMat = createCoralMaterial(baseColor, glowColor);
        const fan = new THREE.Mesh(fanGeom, fanMat);
        fan.position.y = 1;
        fan.rotation.x = -0.3 + Math.random() * 0.6;
        fan.rotation.y = Math.random() * Math.PI;
        coralGroup.add(fan);
      } else if (coralType === 2) {
        // Brain coral - lumpy sphere
        const brainGeom = new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.6, 2);
        // Deform for organic look
        const positions = brainGeom.attributes.position.array;
        for (let v = 0; v < positions.length; v += 3) {
          const noise = Math.sin(positions[v] * 5) * Math.cos(positions[v + 1] * 5) * 0.15;
          const len = Math.sqrt(positions[v] ** 2 + positions[v + 1] ** 2 + positions[v + 2] ** 2);
          const scale = 1 + noise;
          positions[v] *= scale;
          positions[v + 1] *= scale * 0.7; // Flatten slightly
          positions[v + 2] *= scale;
        }
        brainGeom.attributes.position.needsUpdate = true;
        brainGeom.computeVertexNormals();

        const brainMat = createCoralMaterial(baseColor, glowColor);
        const brain = new THREE.Mesh(brainGeom, brainMat);
        brain.position.y = 0.5;
        coralGroup.add(brain);
      } else {
        // Tube coral - cluster of tubes
        const tubeCount = 6 + Math.floor(Math.random() * 8);
        for (let t = 0; t < tubeCount; t++) {
          const height = 0.8 + Math.random() * 1.5;
          const radius = 0.1 + Math.random() * 0.15;
          const tubeGeom = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8, 1, true);
          const tubeMat = createCoralMaterial(baseColor, glowColor);
          const tube = new THREE.Mesh(tubeGeom, tubeMat);

          const tAngle = (t / tubeCount) * Math.PI * 2;
          const tDist = 0.3 + Math.random() * 0.4;
          tube.position.set(
            Math.cos(tAngle) * tDist,
            height / 2,
            Math.sin(tAngle) * tDist
          );
          tube.rotation.set(
            (Math.random() - 0.5) * 0.3,
            0,
            (Math.random() - 0.5) * 0.3
          );
          coralGroup.add(tube);

          // Inner glow
          const innerGeom = new THREE.CircleGeometry(radius * 0.6, 8);
          const innerMat = new THREE.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
          });
          const inner = new THREE.Mesh(innerGeom, innerMat);
          inner.position.copy(tube.position);
          inner.position.y += height / 2;
          inner.rotation.x = -Math.PI / 2;
          coralGroup.add(inner);
        }
      }

      // Scale variation
      const scale = 0.6 + Math.random() * 0.8;
      coralGroup.scale.setScalar(scale);

      coralGroup.position.set(
        lake.position.x + Math.cos(angle) * dist,
        -2.5 - Math.random() * 1,
        lake.position.z + Math.sin(angle) * dist
      );

      coralGroup.userData = {
        lakeX: lake.userData.worldX,
        lakeZ: lake.userData.worldZ,
        offsetX: Math.cos(angle) * dist,
        offsetZ: Math.sin(angle) * dist,
        phase: Math.random() * Math.PI * 2
      };

      this.scene.add(coralGroup);
      this.alienCoral.push(coralGroup);
    }
  }

  createFishForLake(lake, lakeSize) {
    const fishCount = 5 + Math.floor(Math.random() * 8);

    for (let i = 0; i < fishCount; i++) {
      // Simple glowing fish
      const fishGeom = new THREE.ConeGeometry(0.2, 0.8, 4);
      fishGeom.rotateX(Math.PI / 2);

      const fishColor = new THREE.Color().setHSL(
        Math.random() * 0.3 + 0.5, // Cyan to magenta
        0.8,
        0.5 + Math.random() * 0.3
      );

      const fishMat = new THREE.MeshBasicMaterial({
        color: fishColor,
        transparent: true,
        opacity: 0.8
      });

      const fish = new THREE.Mesh(fishGeom, fishMat);

      // Add glowing tail
      const tailGeom = new THREE.ConeGeometry(0.15, 0.3, 3);
      tailGeom.rotateX(-Math.PI / 2);
      const tailMat = new THREE.MeshBasicMaterial({
        color: fishColor.clone().multiplyScalar(1.3),
        transparent: true,
        opacity: 0.6
      });
      const tail = new THREE.Mesh(tailGeom, tailMat);
      tail.position.z = 0.4;
      fish.add(tail);

      // Random position within lake
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * lakeSize * 0.6;

      fish.position.set(
        lake.position.x + Math.cos(angle) * dist,
        -2.5 - Math.random() * 1.5,
        lake.position.z + Math.sin(angle) * dist
      );

      fish.userData = {
        lakeX: lake.userData.worldX,
        lakeZ: lake.userData.worldZ,
        swimAngle: angle,
        swimRadius: dist,
        swimSpeed: 0.3 + Math.random() * 0.5,
        swimPhase: Math.random() * Math.PI * 2,
        bobSpeed: 1 + Math.random(),
        baseY: fish.position.y
      };

      this.scene.add(fish);
      this.alienFish.push(fish);
    }
  }

  updateLakes(delta, elapsed, audioData) {
    // Check if rover is underwater
    this.isUnderwater = false;
    this.underwaterDepth = 0;

    this.lakes?.forEach(lake => {
      lake.material.uniforms.uTime.value = elapsed;
      lake.material.uniforms.uSkyColor.value.copy(this.scene.background);

      if (audioData) {
        const bass = lake.material.uniforms.uAudioBass;
        bass.value += (audioData.bass - bass.value) * 0.15;
      } else {
        lake.material.uniforms.uAudioBass.value *= 0.95;
      }

      // Position lakes relative to rover (wrap around)
      const worldZ = lake.userData.worldZ - this.roverPosition.z;
      const wrappedZ = ((worldZ % 300) + 450) % 300 - 150;
      lake.position.z = wrappedZ;

      // Check if we're in this lake
      const dx = lake.position.x;
      const dz = lake.position.z;
      const distToLake = Math.sqrt(dx * dx + dz * dz);
      const lakeSize = lake.userData.size || 30;

      if (distToLake < lakeSize * 0.8) {
        this.isUnderwater = true;
        this.underwaterDepth = Math.max(this.underwaterDepth, 1 - distToLake / (lakeSize * 0.8));
      }
    });

    // Update underwater shader uniform
    if (this.retroPass) {
      const targetUnderwater = this.isUnderwater ? this.underwaterDepth : 0;
      this.retroPass.uniforms.uUnderwater.value += (targetUnderwater - this.retroPass.uniforms.uUnderwater.value) * 0.1;
    }

    // Update fish
    this.alienFish?.forEach(fish => {
      const data = fish.userData;

      // Swimming in circles
      data.swimAngle += data.swimSpeed * delta;
      const worldZ = data.lakeZ - this.roverPosition.z;
      const wrappedZ = ((worldZ % 300) + 450) % 300 - 150;

      fish.position.x = data.lakeX + Math.cos(data.swimAngle) * data.swimRadius;
      fish.position.z = wrappedZ + Math.sin(data.swimAngle) * data.swimRadius;

      // Bobbing
      fish.position.y = data.baseY + Math.sin(elapsed * data.bobSpeed + data.swimPhase) * 0.3;

      // Face swimming direction
      fish.rotation.y = -data.swimAngle + Math.PI / 2;

      // Wiggle
      fish.rotation.z = Math.sin(elapsed * 5 + data.swimPhase) * 0.1;
    });

    // Update coral
    this.alienCoral?.forEach(coral => {
      const worldZ = coral.userData.lakeZ - this.roverPosition.z;
      const wrappedZ = ((worldZ % 300) + 450) % 300 - 150;
      coral.position.z = wrappedZ + coral.userData.offsetZ;
      coral.position.x = coral.userData.lakeX + coral.userData.offsetX;

      // Gentle sway
      coral.rotation.x = Math.sin(elapsed * 0.5 + coral.position.x) * 0.08;
      coral.rotation.z = Math.sin(elapsed * 0.3 + coral.position.z) * 0.08;

      // Update shader time for glowing effect
      coral.traverse(child => {
        if (child.material?.uniforms?.uTime) {
          child.material.uniforms.uTime.value = elapsed;
        }
      });
    });

    // Random glitch effect
    this.glitchTimer += delta;
    if (!this.glitchActive && this.glitchTimer > 10 + Math.random() * 30) {
      // Trigger a glitch
      this.glitchActive = true;
      this.glitchTimer = 0;
      this.glitchIntensity = 0.3 + Math.random() * 0.7;
    }

    if (this.glitchActive) {
      this.glitchTimer += delta;
      // Glitch lasts 0.1-0.5 seconds
      if (this.glitchTimer > 0.1 + Math.random() * 0.4) {
        this.glitchActive = false;
        this.glitchTimer = 0;
        this.glitchIntensity = 0;
      }
    }

    // Update glitch shader
    if (this.retroPass) {
      const targetGlitch = this.glitchActive ? this.glitchIntensity : 0;
      this.retroPass.uniforms.uGlitch.value += (targetGlitch - this.retroPass.uniforms.uGlitch.value) * 0.3;
    }
  }

  setupBloom() {
    const renderScene = new RenderPass(this.scene, this.camera);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.params.bloomStrength,
      this.params.bloomRadius,
      this.params.bloomThreshold
    );

    // Retro/CRT shader pass
    this.retroPass = new ShaderPass(RetroShader);
    this.retroPass.uniforms.uScanlines.value = this.params.scanlines;
    this.retroPass.uniforms.uChromaticAberration.value = this.params.chromaticAberration;
    this.retroPass.uniforms.uVignette.value = this.params.vignette;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.retroPass);
  }

  createSkybox() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = this.params.starDensity;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 800 + Math.random() * 200;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const colorType = Math.random();
      if (colorType < 0.7) {
        colors[i * 3] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 2] = 1.0;
      } else if (colorType < 0.9) {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 2] = 0.6;
      } else {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.3;
      }
      sizes[i] = 1 + Math.random() * 3;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float twinkle = sin(uTime * 2.0 + position.x * 0.01) * 0.3 + 0.7;
          gl_PointSize = size * twinkle * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
  }

  createPlanetaryRings() {
    // Gas giant planet in the sky
    const planetGeometry = new THREE.SphereGeometry(120, 64, 64);
    const planetMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          // Gas giant bands
          float bands = sin(vUv.y * 30.0 + uTime * 0.02) * 0.5 + 0.5;
          bands += sin(vUv.y * 60.0 - uTime * 0.01) * 0.2;
          bands += sin(vUv.y * 15.0 + vUv.x * 5.0) * 0.1;

          // Storm spots
          float spot = smoothstep(0.1, 0.0, length(vUv - vec2(0.3, 0.6)) - 0.05);

          vec3 color1 = vec3(0.6, 0.4, 0.3); // Orange/brown
          vec3 color2 = vec3(0.8, 0.7, 0.5); // Tan
          vec3 color3 = vec3(0.5, 0.3, 0.2); // Dark band

          vec3 color = mix(color1, color2, bands);
          color = mix(color, color3, sin(vUv.y * 45.0) * 0.3 + 0.3);
          color = mix(color, vec3(0.8, 0.4, 0.3), spot); // Red spot

          // Lighting
          vec3 lightDir = normalize(vec3(1.0, 0.5, 0.5));
          float light = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
          color *= light;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.gasPlanet = new THREE.Mesh(planetGeometry, planetMaterial);
    this.gasPlanet.position.set(400, 200, -600);

    // Add lens flare to gas giant
    const planetFlare = new Lensflare();
    const planetColor = new THREE.Color(0.9, 0.7, 0.5);
    planetFlare.addElement(new LensflareElement(this.flareTextures.main, 400, 0, planetColor));
    planetFlare.addElement(new LensflareElement(this.flareTextures.ring, 600, 0));
    planetFlare.addElement(new LensflareElement(this.flareTextures.hex, 80, 0.5));
    planetFlare.addElement(new LensflareElement(this.flareTextures.hex, 120, 0.7));
    planetFlare.addElement(new LensflareElement(this.flareTextures.main, 60, 0.9));
    planetFlare.addElement(new LensflareElement(this.flareTextures.hex, 40, 1.1));
    this.gasPlanet.add(planetFlare);

    this.scene.add(this.gasPlanet);

    // Rings around the planet
    const ringGeometry = new THREE.RingGeometry(150, 250, 128);
    const ringMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;

          // Ring bands
          float bands = sin(r * 80.0) * 0.5 + 0.5;
          bands *= sin(r * 200.0) * 0.3 + 0.7;
          bands *= sin(r * 40.0 + 0.5) * 0.2 + 0.8;

          // Gaps in rings
          float gap1 = smoothstep(0.58, 0.6, r) * smoothstep(0.65, 0.63, r);
          bands *= 1.0 - gap1 * 0.7;

          vec3 color = mix(vec3(0.6, 0.5, 0.4), vec3(0.8, 0.7, 0.6), bands);

          // Fade at edges
          float alpha = smoothstep(0.35, 0.45, r) * smoothstep(1.0, 0.85, r) * 0.6;
          alpha *= bands * 0.5 + 0.5;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.planetRings = new THREE.Mesh(ringGeometry, ringMaterial);
    this.planetRings.position.copy(this.gasPlanet.position);
    this.planetRings.rotation.x = Math.PI * 0.35;
    this.scene.add(this.planetRings);
  }

  createTerrain() {
    const terrainSize = 200;
    const segments = 150;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    this.terrainGeometry = geometry;
    this.terrainSize = terrainSize;
    this.terrainSegments = segments;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
        uWeatherTint: { value: new THREE.Color(1, 1, 1) },
        uRoverZ: { value: 0 }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying float vElevation;
        varying vec3 vNormal;
        uniform float uRoverZ;
        void main() {
          vPosition = position;
          vWorldPos = position;
          vWorldPos.z -= uRoverZ; // World space for biome calculation
          vElevation = position.y;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAudioBass;
        uniform vec3 uWeatherTint;
        uniform float uRoverZ;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying float vElevation;
        varying vec3 vNormal;

        // Simple noise for biome blending
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
          // Biome calculation - based primarily on Z position for consistent transitions
          // At speed 1.0, rover moves 10 units/sec
          // Use Z position directly with some X noise for edge variation
          float zBiome = vWorldPos.z * 0.00015; // Cycle every ~6666 units (~11 min full cycle, ~1 min per biome)
          float xVariation = noise(vec2(vWorldPos.x * 0.003, vWorldPos.z * 0.002)) * 0.1;
          float localNoise = noise(vec2(vWorldPos.x * 0.01, vWorldPos.z * 0.01)) * 0.05; // Fine detail
          float biome = fract(zBiome + xVariation + localNoise); // 0-1 range, wrapping

          // 10 diverse biomes with distinct color palettes
          // Arrays: [low, mid, high] colors for each biome

          // Biome 0: Purple alien desert
          vec3 low0 = vec3(0.12, 0.08, 0.18);
          vec3 mid0 = vec3(0.22, 0.12, 0.28);
          vec3 high0 = vec3(0.32, 0.22, 0.38);

          // Biome 1: Crystal blue tundra
          vec3 low1 = vec3(0.08, 0.14, 0.22);
          vec3 mid1 = vec3(0.12, 0.22, 0.35);
          vec3 high1 = vec3(0.2, 0.32, 0.45);

          // Biome 2: Volcanic hellscape
          vec3 low2 = vec3(0.18, 0.06, 0.04);
          vec3 mid2 = vec3(0.35, 0.12, 0.06);
          vec3 high2 = vec3(0.5, 0.2, 0.1);

          // Biome 3: Bioluminescent swamp (pink/magenta)
          vec3 low3 = vec3(0.15, 0.08, 0.12);
          vec3 mid3 = vec3(0.3, 0.12, 0.25);
          vec3 high3 = vec3(0.4, 0.2, 0.35);

          // Biome 4: Golden dunes
          vec3 low4 = vec3(0.18, 0.14, 0.08);
          vec3 mid4 = vec3(0.32, 0.25, 0.12);
          vec3 high4 = vec3(0.45, 0.35, 0.18);

          // Biome 5: Frost plains (cold blue-white)
          vec3 low5 = vec3(0.18, 0.2, 0.25);
          vec3 mid5 = vec3(0.28, 0.32, 0.38);
          vec3 high5 = vec3(0.38, 0.42, 0.48);

          // Biome 6: Toxic marshland (sickly green)
          vec3 low6 = vec3(0.06, 0.12, 0.06);
          vec3 mid6 = vec3(0.1, 0.25, 0.08);
          vec3 high6 = vec3(0.15, 0.35, 0.12);

          // Biome 7: Obsidian wastes (dark grey/black)
          vec3 low7 = vec3(0.06, 0.06, 0.08);
          vec3 mid7 = vec3(0.1, 0.1, 0.12);
          vec3 high7 = vec3(0.16, 0.15, 0.18);

          // Biome 8: Coral reef terrain (teal/cyan)
          vec3 low8 = vec3(0.06, 0.15, 0.18);
          vec3 mid8 = vec3(0.1, 0.28, 0.32);
          vec3 high8 = vec3(0.18, 0.4, 0.42);

          // Biome 9: Rust wastes (copper/orange-brown)
          vec3 low9 = vec3(0.15, 0.1, 0.06);
          vec3 mid9 = vec3(0.28, 0.18, 0.1);
          vec3 high9 = vec3(0.4, 0.25, 0.15);

          // Select biome with smooth blending (10 biomes, each 0.1 range)
          vec3 lowColor, midColor, highColor;
          float biomeWidth = 0.1;

          if (biome < 0.1) {
            float t = biome / biomeWidth;
            lowColor = mix(low0, low1, t);
            midColor = mix(mid0, mid1, t);
            highColor = mix(high0, high1, t);
          } else if (biome < 0.2) {
            float t = (biome - 0.1) / biomeWidth;
            lowColor = mix(low1, low2, t);
            midColor = mix(mid1, mid2, t);
            highColor = mix(high1, high2, t);
          } else if (biome < 0.3) {
            float t = (biome - 0.2) / biomeWidth;
            lowColor = mix(low2, low3, t);
            midColor = mix(mid2, mid3, t);
            highColor = mix(high2, high3, t);
          } else if (biome < 0.4) {
            float t = (biome - 0.3) / biomeWidth;
            lowColor = mix(low3, low4, t);
            midColor = mix(mid3, mid4, t);
            highColor = mix(high3, high4, t);
          } else if (biome < 0.5) {
            float t = (biome - 0.4) / biomeWidth;
            lowColor = mix(low4, low5, t);
            midColor = mix(mid4, mid5, t);
            highColor = mix(high4, high5, t);
          } else if (biome < 0.6) {
            float t = (biome - 0.5) / biomeWidth;
            lowColor = mix(low5, low6, t);
            midColor = mix(mid5, mid6, t);
            highColor = mix(high5, high6, t);
          } else if (biome < 0.7) {
            float t = (biome - 0.6) / biomeWidth;
            lowColor = mix(low6, low7, t);
            midColor = mix(mid6, mid7, t);
            highColor = mix(high6, high7, t);
          } else if (biome < 0.8) {
            float t = (biome - 0.7) / biomeWidth;
            lowColor = mix(low7, low8, t);
            midColor = mix(mid7, mid8, t);
            highColor = mix(high7, high8, t);
          } else if (biome < 0.9) {
            float t = (biome - 0.8) / biomeWidth;
            lowColor = mix(low8, low9, t);
            midColor = mix(mid8, mid9, t);
            highColor = mix(high8, high9, t);
          } else {
            float t = (biome - 0.9) / biomeWidth;
            lowColor = mix(low9, low0, t);
            midColor = mix(mid9, mid0, t);
            highColor = mix(high9, high0, t);
          }

          // Elevation-based color (clamped to avoid extremes)
          float e = clamp(vElevation / 8.0, 0.0, 1.0);
          vec3 color;
          if (e < 0.3) color = mix(lowColor, midColor, e / 0.3);
          else if (e < 0.6) color = mix(midColor, highColor, (e - 0.3) / 0.3);
          else color = mix(highColor, highColor * 1.1, (e - 0.6) / 0.4); // Reduced peak brightness

          // Audio reactivity - subtle pulse
          color += color * uAudioBass * 0.2;

          // Lighting (constrained range to avoid too dark/bright)
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
          float light = max(dot(vNormal, lightDir), 0.0) * 0.35 + 0.65; // Range: 0.65-1.0
          color *= light * uWeatherTint;

          // Clamp final color to avoid pure black or white
          // Allow slightly brighter for volcanic and frost biomes
          color = clamp(color, vec3(0.04), vec3(0.55));

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.position.y = -2;
    this.scene.add(this.terrain);
    this.updateTerrainGeometry(0);
  }

  updateTerrainGeometry(offsetZ) {
    const positions = this.terrainGeometry.attributes.position.array;
    const segments = this.terrainSegments;
    const size = this.terrainSize;

    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const index = (i * (segments + 1) + j) * 3;
        const x = (j / segments - 0.5) * size;
        const z = (i / segments - 0.5) * size + offsetZ;
        let height = this.noise.fbm(x * this.params.terrainScale, z * this.params.terrainScale, 3) * this.params.terrainHeight;
        height += this.noise.fbm(x * this.params.terrainScale * 0.3, z * this.params.terrainScale * 0.3, 2) * this.params.terrainHeight * 0.5;
        const craterNoise = this.noise.noise2D(x * 0.005, z * 0.005);
        if (craterNoise > 0.7) {
          const craterDepth = (craterNoise - 0.7) * 8;
          height -= craterDepth * craterDepth * 2;
        }
        positions[index + 1] = height;
      }
    }
    this.terrainGeometry.attributes.position.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();
  }

  getTerrainHeight(x, z) {
    let height = this.noise.fbm(x * this.params.terrainScale, z * this.params.terrainScale, 3) * this.params.terrainHeight;
    height += this.noise.fbm(x * this.params.terrainScale * 0.3, z * this.params.terrainScale * 0.3, 2) * this.params.terrainHeight * 0.5;
    const craterNoise = this.noise.noise2D(x * 0.005, z * 0.005);
    if (craterNoise > 0.7) {
      const craterDepth = (craterNoise - 0.7) * 8;
      height -= craterDepth * craterDepth * 2;
    }
    return height;
  }

  createLensflareTextures() {
    // Create procedural lens flare textures
    const createFlareTexture = (size, type) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const center = size / 2;

      if (type === 'main') {
        // Main bright flare
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 250, 230, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 200, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 150, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      } else if (type === 'ring') {
        // Ring/halo flare
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.3)';
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.arc(center, center, center * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.2)';
        ctx.lineWidth = size * 0.1;
        ctx.beginPath();
        ctx.arc(center, center, center * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (type === 'hex') {
        // Hexagonal flare
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(180, 200, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(150, 180, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const x = center + Math.cos(angle) * center * 0.8;
          const y = center + Math.sin(angle) * center * 0.8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    this.flareTextures = {
      main: createFlareTexture(256, 'main'),
      ring: createFlareTexture(128, 'ring'),
      hex: createFlareTexture(64, 'hex')
    };
  }

  createMoons() {
    this.moons = [];
    const moonData = [
      { size: 30, distance: 400, color: 0xccbbaa, speed: 0.0001, height: 200, phase: 0 },
      { size: 15, distance: 300, color: 0xaabbcc, speed: 0.0003, height: 150, phase: Math.PI },
      { size: 8, distance: 250, color: 0xffccaa, speed: 0.0005, height: 100, phase: Math.PI / 2 }
    ];

    moonData.forEach((data, index) => {
      const moonGeom = new THREE.SphereGeometry(data.size, 32, 32);
      const moonMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(data.color) }, uTime: { value: 0 } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec2 vUv;
          void main() {
            vNormal = normal;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec2 vUv;
          void main() {
            float crater = sin(vUv.x * 30.0) * sin(vUv.y * 30.0) * 0.1;
            crater += sin(vUv.x * 50.0 + 1.0) * sin(vUv.y * 50.0 + 2.0) * 0.05;
            vec3 lightDir = normalize(vec3(1.0, 0.5, 0.0));
            float light = max(dot(vNormal, lightDir), 0.0);
            vec3 color = uColor * (0.3 + light * 0.7) + crater;
            float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
            color += uColor * rim * rim * 0.3;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
      const moon = new THREE.Mesh(moonGeom, moonMat);
      moon.userData = data;

      // Add lens flare to each moon
      const flareColor = new THREE.Color(data.color);
      const lensflare = new Lensflare();
      const flareSize = data.size * 3;
      lensflare.addElement(new LensflareElement(this.flareTextures.main, flareSize * 2, 0, flareColor));
      lensflare.addElement(new LensflareElement(this.flareTextures.ring, flareSize * 4, 0));
      lensflare.addElement(new LensflareElement(this.flareTextures.hex, flareSize * 0.5, 0.6));
      lensflare.addElement(new LensflareElement(this.flareTextures.hex, flareSize * 0.3, 0.8));
      lensflare.addElement(new LensflareElement(this.flareTextures.main, flareSize * 0.4, 1.2));
      moon.add(lensflare);

      this.moons.push(moon);
      this.scene.add(moon);
    });
  }

  createNebula() {
    const nebulaGeom = new THREE.PlaneGeometry(600, 400);
    const nebulaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: this.params.nebulaIntensity },
        uAudioMid: { value: 0 }
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime, uIntensity, uAudioMid;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
          return v;
        }
        void main() {
          vec3 c1 = vec3(0.5, 0.1, 0.6) * fbm(vUv * 3.0 + uTime * 0.02);
          vec3 c2 = vec3(0.1, 0.3, 0.6) * fbm(vUv * 5.0 - uTime * 0.015 + 100.0);
          vec3 c3 = vec3(0.6, 0.2, 0.3) * fbm(vUv * 2.0 + uTime * 0.01 + 200.0);
          vec3 color = (c1 + c2 + c3) * uIntensity * (1.0 + uAudioMid * 0.5);
          float fade = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          gl_FragColor = vec4(color, fade * 0.6);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const nebula1 = new THREE.Mesh(nebulaGeom, nebulaMat);
    nebula1.position.set(200, 250, -400);
    nebula1.rotation.y = -0.3;
    this.scene.add(nebula1);

    const nebula2 = new THREE.Mesh(nebulaGeom, nebulaMat.clone());
    nebula2.position.set(-300, 200, -350);
    nebula2.rotation.y = 0.4;
    this.scene.add(nebula2);

    this.nebulae = [nebula1, nebula2];
  }

  createShootingStarSystem() {
    this.shootingStarPool = [];
    for (let i = 0; i < 20; i++) {
      const geometry = new THREE.BufferGeometry();
      // More points for a longer, smoother trail
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(90), 3));
      const material = new THREE.LineBasicMaterial({
        color: 0xffffcc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const line = new THREE.Line(geometry, material);
      line.userData = { active: false, life: 0, velocity: new THREE.Vector3(), startPos: new THREE.Vector3() };
      this.shootingStarPool.push(line);
      this.scene.add(line);
    }
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
    const material = new THREE.PointsMaterial({ color: 0x8866aa, size: 0.3, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    this.ambientParticles = new THREE.Points(geometry, material);
    this.scene.add(this.ambientParticles);
  }

  createDistantMountains() {
    const mountainGeom = new THREE.PlaneGeometry(800, 100, 100, 1);
    const positions = mountainGeom.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = Math.abs(this.noise.fbm(positions[i] * 0.01, 0, 4)) * 80;
    }
    mountainGeom.attributes.position.needsUpdate = true;

    const mountainMat = new THREE.MeshBasicMaterial({ color: 0x0a0a12, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const mountain = new THREE.Mesh(mountainGeom.clone(), mountainMat);
      const angle = (i / 4) * Math.PI * 2;
      mountain.position.set(Math.cos(angle) * 350, -10, Math.sin(angle) * 350);
      mountain.rotation.y = -angle + Math.PI / 2;
      this.scene.add(mountain);
    }
  }

  // === BIOME-SPECIFIC FLORA ===
  createFlora() {
    this.flora = [];
    this.biomeFlora = {}; // Organized by biome type

    // Create flora for each biome
    this.createPurpleDesertFlora();      // Biome 0: Purple alien desert
    this.createCrystalTundraFlora();     // Biome 1: Crystal blue tundra
    this.createVolcanicFlora();          // Biome 2: Volcanic hellscape
    this.createSwampFlora();             // Biome 3: Bioluminescent swamp
    this.createDunesFlora();             // Biome 4: Golden dunes
    this.createFrostFlora();             // Biome 5: Frost plains
    this.createToxicFlora();             // Biome 6: Toxic marshland
    this.createObsidianFlora();          // Biome 7: Obsidian wastes
    this.createCoralReefFlora();         // Biome 8: Coral reef terrain
    this.createRustFlora();              // Biome 9: Rust wastes

    // Floating spores (universal)
    this.createFloatingSpores();
  }

  // Helper to calculate biome at a world position (must match shader logic)
  getBiomeAtPosition(worldX, worldZ) {
    const zBiome = worldZ * 0.00015;
    // Simplified noise approximation
    const xVar = Math.sin(worldX * 0.003) * Math.cos(worldZ * 0.002) * 0.1;
    const localNoise = Math.sin(worldX * 0.01 + worldZ * 0.01) * 0.05;
    return ((zBiome + xVar + localNoise) % 1 + 1) % 1; // 0-1 range
  }

  // Biome 0: Purple alien desert - spore pods and alien succulents
  createPurpleDesertFlora() {
    this.biomeFlora[0] = [];

    // Spore pods - bulbous plants
    const podGeom = new THREE.SphereGeometry(1, 8, 8);
    podGeom.scale(1, 1.3, 1);
    const podMat = new THREE.MeshBasicMaterial({
      color: 0x8844aa,
      transparent: true,
      opacity: 0.9
    });

    for (let i = 0; i < 40; i++) {
      const pod = new THREE.Group();
      const body = new THREE.Mesh(podGeom, podMat.clone());
      const scale = 0.3 + Math.random() * 0.8;
      body.scale.setScalar(scale);
      pod.add(body);

      // Tendrils
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
      pod.userData.biome = 0;
      pod.visible = false;
      this.scene.add(pod);
      this.biomeFlora[0].push(pod);
    }
  }

  // Biome 1: Crystal tundra - ice crystals and frozen formations
  createCrystalTundraFlora() {
    this.biomeFlora[1] = [];

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

    for (let i = 0; i < 50; i++) {
      const cluster = new THREE.Group();
      const numCrystals = 2 + Math.floor(Math.random() * 4);

      for (let c = 0; c < numCrystals; c++) {
        const height = 1 + Math.random() * 4;
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5, 0),
          crystalMat.clone()
        );
        crystal.scale.set(0.3 + Math.random() * 0.5, height, 0.3 + Math.random() * 0.5);
        crystal.position.set((Math.random() - 0.5) * 2, height / 2, (Math.random() - 0.5) * 2);
        crystal.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        cluster.add(crystal);
      }

      cluster.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      cluster.userData.worldX = cluster.position.x;
      cluster.userData.worldZ = cluster.position.z;
      cluster.userData.biome = 1;
      cluster.visible = false;
      this.scene.add(cluster);
      this.biomeFlora[1].push(cluster);
    }
    this.crystalMat = crystalMat;
  }

  // Biome 2: Volcanic - ember plants and charred trees
  createVolcanicFlora() {
    this.biomeFlora[2] = [];

    // Ember plants - glowing from within
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

    for (let i = 0; i < 35; i++) {
      const plant = new THREE.Group();

      // Charred trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.3, 2 + Math.random() * 2, 6),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
      );
      trunk.position.y = 1;
      plant.add(trunk);

      // Glowing ember tips
      for (let e = 0; e < 3 + Math.floor(Math.random() * 3); e++) {
        const ember = new THREE.Mesh(
          new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 8, 8),
          emberMat.clone()
        );
        ember.position.set(
          (Math.random() - 0.5) * 0.8,
          1.5 + Math.random() * 1.5,
          (Math.random() - 0.5) * 0.8
        );
        plant.add(ember);
      }

      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      plant.userData.biome = 2;
      plant.visible = false;
      this.scene.add(plant);
      this.biomeFlora[2].push(plant);
    }
    this.emberMat = emberMat;
  }

  // Biome 3: Bioluminescent swamp - glowing mushrooms and hanging vines
  createSwampFlora() {
    this.biomeFlora[3] = [];

    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.3, 0.8) } },
      vertexShader: `varying vec3 vNormal; void main() { vNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float pulse = sin(uTime * 2.0) * 0.3 + 0.7;
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0))), 1.5);
          vec3 color = uColor * pulse * (0.6 + rim * 0.6);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < 60; i++) {
      const mushroom = new THREE.Group();

      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.15, 1, 6),
        new THREE.MeshBasicMaterial({ color: 0x553355 })
      );
      stem.position.y = 0.5;
      mushroom.add(stem);

      // Glowing cap
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 8),
        glowMat.clone()
      );
      cap.scale.set(1, 0.5, 1);
      cap.position.y = 1;
      // Random pink/purple/cyan colors
      const hue = Math.random() > 0.5 ? 0.85 : 0.55;
      cap.material.uniforms.uColor.value.setHSL(hue, 0.9, 0.6);
      mushroom.add(cap);

      const scale = 0.5 + Math.random() * 1.5;
      mushroom.scale.setScalar(scale);
      mushroom.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      mushroom.userData.worldX = mushroom.position.x;
      mushroom.userData.worldZ = mushroom.position.z;
      mushroom.userData.biome = 3;
      mushroom.visible = false;
      this.scene.add(mushroom);
      this.biomeFlora[3].push(mushroom);
    }
    this.glowMat = glowMat;
  }

  // Biome 4: Golden dunes - alien cacti and tumbleweeds
  createDunesFlora() {
    this.biomeFlora[4] = [];

    for (let i = 0; i < 40; i++) {
      const cactus = new THREE.Group();

      // Main body
      const height = 1.5 + Math.random() * 3;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, height, 8),
        new THREE.MeshBasicMaterial({ color: 0x556633 })
      );
      body.position.y = height / 2;
      cactus.add(body);

      // Arms
      const armCount = Math.floor(Math.random() * 3);
      for (let a = 0; a < armCount; a++) {
        const armHeight = 0.5 + Math.random() * 1;
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.2, armHeight, 6),
          new THREE.MeshBasicMaterial({ color: 0x556633 })
        );
        arm.position.set(
          (Math.random() > 0.5 ? 0.4 : -0.4),
          height * 0.4 + Math.random() * height * 0.3,
          0
        );
        arm.rotation.z = (arm.position.x > 0 ? -1 : 1) * (0.3 + Math.random() * 0.5);
        cactus.add(arm);
      }

      // Golden flower on top
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
      cactus.userData.biome = 4;
      cactus.visible = false;
      this.scene.add(cactus);
      this.biomeFlora[4].push(cactus);
    }
  }

  // Biome 5: Frost plains - ice spikes and frozen grass
  createFrostFlora() {
    this.biomeFlora[5] = [];

    for (let i = 0; i < 50; i++) {
      const iceSpike = new THREE.Group();

      // Main spike
      const height = 1 + Math.random() * 3;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, height, 6),
        new THREE.MeshBasicMaterial({
          color: 0xaaddff,
          transparent: true,
          opacity: 0.7
        })
      );
      spike.position.y = height / 2;
      iceSpike.add(spike);

      // Smaller surrounding spikes
      for (let s = 0; s < 2 + Math.floor(Math.random() * 3); s++) {
        const smallHeight = height * (0.3 + Math.random() * 0.4);
        const small = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, smallHeight, 5),
          new THREE.MeshBasicMaterial({
            color: 0xcceeFF,
            transparent: true,
            opacity: 0.6
          })
        );
        small.position.set(
          (Math.random() - 0.5) * 0.8,
          smallHeight / 2,
          (Math.random() - 0.5) * 0.8
        );
        small.rotation.set(
          (Math.random() - 0.5) * 0.3,
          0,
          (Math.random() - 0.5) * 0.3
        );
        iceSpike.add(small);
      }

      iceSpike.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      iceSpike.userData.worldX = iceSpike.position.x;
      iceSpike.userData.worldZ = iceSpike.position.z;
      iceSpike.userData.biome = 5;
      iceSpike.visible = false;
      this.scene.add(iceSpike);
      this.biomeFlora[5].push(iceSpike);
    }
  }

  // Biome 6: Toxic marshland - poison mushrooms and bubbling pools
  createToxicFlora() {
    this.biomeFlora[6] = [];

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

    for (let i = 0; i < 45; i++) {
      const plant = new THREE.Group();

      // Sickly stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.12, 1.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x334422 })
      );
      stem.position.y = 0.75;
      stem.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
      plant.add(stem);

      // Glowing toxic bulb
      const bulb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.3, 0),
        toxicMat.clone()
      );
      bulb.position.y = 1.5;
      plant.add(bulb);

      // Dripping tendrils
      for (let d = 0; d < 2; d++) {
        const drip = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.3, 4),
          new THREE.MeshBasicMaterial({ color: 0x55ff33, transparent: true, opacity: 0.7 })
        );
        drip.position.set((Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3);
        drip.rotation.x = Math.PI;
        plant.add(drip);
      }

      const scale = 0.6 + Math.random() * 1.0;
      plant.scale.setScalar(scale);
      plant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      plant.userData.worldX = plant.position.x;
      plant.userData.worldZ = plant.position.z;
      plant.userData.biome = 6;
      plant.visible = false;
      this.scene.add(plant);
      this.biomeFlora[6].push(plant);
    }
    this.toxicMat = toxicMat;
  }

  // Biome 7: Obsidian wastes - dead trees and dark crystals
  createObsidianFlora() {
    this.biomeFlora[7] = [];

    for (let i = 0; i < 35; i++) {
      const deadTree = new THREE.Group();

      // Twisted dead trunk
      const height = 2 + Math.random() * 4;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.4, height, 6),
        new THREE.MeshBasicMaterial({ color: 0x111115 })
      );
      trunk.position.y = height / 2;
      trunk.rotation.set(
        (Math.random() - 0.5) * 0.2,
        0,
        (Math.random() - 0.5) * 0.3
      );
      deadTree.add(trunk);

      // Dead branches
      for (let b = 0; b < 2 + Math.floor(Math.random() * 3); b++) {
        const branchLen = 0.5 + Math.random() * 1.5;
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.08, branchLen, 4),
          new THREE.MeshBasicMaterial({ color: 0x0a0a0e })
        );
        branch.position.set(
          0,
          height * (0.5 + Math.random() * 0.4),
          0
        );
        branch.rotation.set(
          (Math.random() - 0.5) * 1.5,
          Math.random() * Math.PI,
          Math.random() * 0.8 + 0.3
        );
        deadTree.add(branch);
      }

      deadTree.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      deadTree.userData.worldX = deadTree.position.x;
      deadTree.userData.worldZ = deadTree.position.z;
      deadTree.userData.biome = 7;
      deadTree.visible = false;
      this.scene.add(deadTree);
      this.biomeFlora[7].push(deadTree);
    }
  }

  // Biome 8: Coral reef terrain - land coral and anemones
  createCoralReefFlora() {
    this.biomeFlora[8] = [];

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

    for (let i = 0; i < 50; i++) {
      const coral = new THREE.Group();

      // Branch coral or brain coral
      if (Math.random() > 0.5) {
        // Branch coral
        for (let b = 0; b < 4 + Math.floor(Math.random() * 4); b++) {
          const branchHeight = 0.5 + Math.random() * 1.5;
          const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.15, branchHeight, 6),
            coralMat.clone()
          );
          branch.material.uniforms.uColor.value.setHSL(
            0.45 + Math.random() * 0.15, 0.8, 0.5
          );
          branch.position.set(
            (Math.random() - 0.5) * 1,
            branchHeight / 2,
            (Math.random() - 0.5) * 1
          );
          branch.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.5
          );
          coral.add(branch);
        }
      } else {
        // Brain coral - lumpy dome
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
      coral.userData.biome = 8;
      coral.visible = false;
      this.scene.add(coral);
      this.biomeFlora[8].push(coral);
    }
    this.coralMat = coralMat;
  }

  // Biome 9: Rust wastes - metal plants and rusted structures
  createRustFlora() {
    this.biomeFlora[9] = [];

    for (let i = 0; i < 40; i++) {
      const metalPlant = new THREE.Group();

      // Rusted metal "stem"
      const height = 1 + Math.random() * 2.5;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.15, height, 6),
        new THREE.MeshBasicMaterial({ color: 0x884422 })
      );
      stem.position.y = height / 2;
      metalPlant.add(stem);

      // Metal "leaves" - flat angular pieces
      for (let l = 0; l < 2 + Math.floor(Math.random() * 3); l++) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.02, 0.2),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.08, 0.7, 0.25 + Math.random() * 0.15)
          })
        );
        leaf.position.set(
          0,
          height * (0.3 + l * 0.25),
          0
        );
        leaf.rotation.set(
          0.3 + Math.random() * 0.5,
          Math.random() * Math.PI * 2,
          0
        );
        metalPlant.add(leaf);
      }

      // Rust particles/flakes
      if (Math.random() > 0.6) {
        const flake = new THREE.Mesh(
          new THREE.TetrahedronGeometry(0.1),
          new THREE.MeshBasicMaterial({ color: 0xaa5533 })
        );
        flake.position.set(
          (Math.random() - 0.5) * 0.5,
          height * 0.8,
          (Math.random() - 0.5) * 0.5
        );
        metalPlant.add(flake);
      }

      metalPlant.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200);
      metalPlant.userData.worldX = metalPlant.position.x;
      metalPlant.userData.worldZ = metalPlant.position.z;
      metalPlant.userData.biome = 9;
      metalPlant.visible = false;
      this.scene.add(metalPlant);
      this.biomeFlora[9].push(metalPlant);
    }
  }

  createFloatingSpores() {
    const sporeCount = 300;
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

  // === FAUNA ===
  createFauna() {
    this.fauna = [];
    this.createFlyingCreatures();
    this.createGroundCreatures();
    this.createGiantWorm();
  }

  createFlyingCreatures() {
    // Simple bird-like silhouettes
    const wingGeom = new THREE.PlaneGeometry(2, 0.5);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x111122, side: THREE.DoubleSide });

    this.flyingCreatures = [];
    for (let i = 0; i < 15; i++) {
      const bird = new THREE.Group();
      const leftWing = new THREE.Mesh(wingGeom, wingMat);
      const rightWing = new THREE.Mesh(wingGeom, wingMat);
      leftWing.position.x = -1;
      rightWing.position.x = 1;
      bird.add(leftWing, rightWing);
      bird.position.set(
        (Math.random() - 0.5) * 300,
        50 + Math.random() * 100,
        (Math.random() - 0.5) * 300 - 100
      );
      bird.userData = {
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

  createGroundCreatures() {
    // Small glowing creatures that scurry
    const creatureGeom = new THREE.SphereGeometry(0.3, 8, 8);
    const creatureMat = new THREE.MeshBasicMaterial({ color: 0x44ff88 });

    this.groundCreatures = [];
    for (let i = 0; i < 20; i++) {
      const creature = new THREE.Mesh(creatureGeom, creatureMat.clone());
      creature.position.set(
        (Math.random() - 0.5) * 100,
        0,
        (Math.random() - 0.5) * 100
      );
      creature.userData = {
        targetX: creature.position.x,
        targetZ: creature.position.z,
        speed: 2 + Math.random() * 3,
        nextMoveTime: Math.random() * 5
      };
      this.scene.add(creature);
      this.groundCreatures.push(creature);
    }
  }

  createGiantWorm() {
    // Rare giant worm that occasionally breaches
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

  // === STRUCTURES ===
  createStructures() {
    this.structures = [];
    this.createRuins();
    this.createMonoliths();
    this.createCrashedShips();
  }

  createRuins() {
    const ruinGeom = new THREE.BoxGeometry(3, 5, 3);
    const ruinMat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.9 });

    for (let i = 0; i < 25; i++) {
      const ruin = new THREE.Group();
      const numBlocks = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numBlocks; j++) {
        const block = new THREE.Mesh(ruinGeom, ruinMat);
        block.position.set(
          (Math.random() - 0.5) * 8,
          Math.random() * 2,
          (Math.random() - 0.5) * 8
        );
        block.rotation.set(
          (Math.random() - 0.5) * 0.3,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.3
        );
        block.scale.set(
          0.3 + Math.random() * 0.7,
          0.3 + Math.random(),
          0.3 + Math.random() * 0.7
        );
        ruin.add(block);
      }
      ruin.position.set(
        (Math.random() - 0.5) * 250,
        0,
        (Math.random() - 0.5) * 250
      );
      this.scene.add(ruin);
      this.structures.push(ruin);
    }
  }

  createMonoliths() {
    const monolithGeom = new THREE.BoxGeometry(2, 12, 1);
    const monolithMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec3 baseColor = vec3(0.05, 0.05, 0.1);
          float glow = sin(vUv.y * 20.0 + uTime) * 0.5 + 0.5;
          glow *= smoothstep(0.4, 0.5, vUv.y) * smoothstep(0.6, 0.5, vUv.y);
          vec3 glowColor = vec3(0.3, 0.5, 1.0) * glow * 0.5;
          gl_FragColor = vec4(baseColor + glowColor, 1.0);
        }
      `
    });

    this.monoliths = [];
    for (let i = 0; i < 15; i++) {
      const monolith = new THREE.Mesh(monolithGeom, monolithMat.clone());
      monolith.position.set(
        (Math.random() - 0.5) * 200,
        6,
        (Math.random() - 0.5) * 200
      );
      this.scene.add(monolith);
      this.monoliths.push(monolith);
      this.structures.push(monolith);
    }
  }

  createCrashedShips() {
    // Simple crashed ship shapes
    const hullGeom = new THREE.ConeGeometry(3, 10, 8);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.7, metalness: 0.3 });

    for (let i = 0; i < 10; i++) {
      const ship = new THREE.Mesh(hullGeom, hullMat);
      ship.position.set(
        (Math.random() - 0.5) * 250,
        2,
        (Math.random() - 0.5) * 250
      );
      ship.rotation.set(Math.PI * 0.5 + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);

      // Vary ship sizes
      const scale = 0.7 + Math.random() * 1.0;
      ship.scale.setScalar(scale);

      this.scene.add(ship);
      this.structures.push(ship);
    }
  }

  // === LOCAL FEATURES ===
  createLocalFeatures() {
    this.localFeatures = [];
    this.createRockFormations();
    this.createRockPillars();
    this.createAlienArtifacts();
    this.createCraters();
    this.createGeysers();
    this.createBonePiles();
    this.createStoneCircles();
  }

  createRockFormations() {
    // Scattered boulders of various sizes
    const rockGeoms = [
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0)
    ];

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x444455,
      roughness: 0.95,
      metalness: 0.05
    });

    // Create 300 scattered boulders
    this.boulders = [];
    for (let i = 0; i < 300; i++) {
      const geom = rockGeoms[Math.floor(Math.random() * rockGeoms.length)];
      const rock = new THREE.Mesh(geom, rockMat.clone());

      const scale = 0.3 + Math.random() * 2.5;
      rock.scale.set(
        scale * (0.7 + Math.random() * 0.6),
        scale * (0.5 + Math.random() * 0.5),
        scale * (0.7 + Math.random() * 0.6)
      );
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      rock.position.set(
        (Math.random() - 0.5) * 200,
        0,
        (Math.random() - 0.5) * 200
      );

      // Vary rock colors slightly
      const colorShift = Math.random() * 0.1;
      rock.material.color.setRGB(0.25 + colorShift, 0.25 + colorShift, 0.3 + colorShift);

      rock.userData.worldX = rock.position.x;
      rock.userData.worldZ = rock.position.z;

      this.scene.add(rock);
      this.boulders.push(rock);
      this.localFeatures.push(rock);
    }

    // Boulder clusters - groups of rocks together
    for (let i = 0; i < 40; i++) {
      const clusterX = (Math.random() - 0.5) * 200;
      const clusterZ = (Math.random() - 0.5) * 200;
      const clusterSize = 3 + Math.random() * 8;

      for (let j = 0; j < 5 + Math.floor(Math.random() * 8); j++) {
        const geom = rockGeoms[Math.floor(Math.random() * rockGeoms.length)];
        const rock = new THREE.Mesh(geom, rockMat.clone());

        const scale = 0.5 + Math.random() * 2;
        rock.scale.set(scale, scale * 0.6, scale);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

        rock.position.set(
          clusterX + (Math.random() - 0.5) * clusterSize,
          0,
          clusterZ + (Math.random() - 0.5) * clusterSize
        );

        rock.userData.worldX = rock.position.x;
        rock.userData.worldZ = rock.position.z;

        this.scene.add(rock);
        this.boulders.push(rock);
        this.localFeatures.push(rock);
      }
    }
  }

  createRockPillars() {
    // Tall rock spires/pillars
    const pillarGeom = new THREE.CylinderGeometry(0.3, 1, 1, 6);

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a45,
      roughness: 0.9
    });

    this.rockPillars = [];
    for (let i = 0; i < 60; i++) {
      const pillar = new THREE.Mesh(pillarGeom, pillarMat.clone());

      const height = 3 + Math.random() * 12;
      const width = 0.5 + Math.random() * 1.5;
      pillar.scale.set(width, height, width);

      pillar.position.set(
        (Math.random() - 0.5) * 200,
        height / 2,
        (Math.random() - 0.5) * 200
      );

      pillar.rotation.y = Math.random() * Math.PI;
      pillar.rotation.x = (Math.random() - 0.5) * 0.2;
      pillar.rotation.z = (Math.random() - 0.5) * 0.2;

      pillar.userData.worldX = pillar.position.x;
      pillar.userData.worldZ = pillar.position.z;
      pillar.userData.baseHeight = height / 2;

      this.scene.add(pillar);
      this.rockPillars.push(pillar);
      this.localFeatures.push(pillar);
    }
  }

  createAlienArtifacts() {
    // Small glowing alien objects scattered on the ground
    const artifactGeoms = [
      new THREE.TetrahedronGeometry(0.3),
      new THREE.OctahedronGeometry(0.25),
      new THREE.TorusGeometry(0.3, 0.1, 8, 6)
    ];

    const artifactMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0.5, 0.8, 1.0) }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float pulse = sin(uTime * 3.0) * 0.3 + 0.7;
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0))), 2.0);
          vec3 color = uColor * pulse + vec3(1.0) * rim * 0.3;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    this.artifacts = [];
    const colors = [
      new THREE.Color(0.5, 0.8, 1.0),   // Cyan
      new THREE.Color(1.0, 0.5, 0.8),   // Pink
      new THREE.Color(0.5, 1.0, 0.6),   // Green
      new THREE.Color(1.0, 0.8, 0.3),   // Gold
      new THREE.Color(0.8, 0.5, 1.0)    // Purple
    ];

    for (let i = 0; i < 120; i++) {
      const geom = artifactGeoms[Math.floor(Math.random() * artifactGeoms.length)];
      const mat = artifactMat.clone();
      mat.uniforms.uColor.value = colors[Math.floor(Math.random() * colors.length)].clone();
      mat.uniforms.uTime = artifactMat.uniforms.uTime; // Share time uniform

      const artifact = new THREE.Mesh(geom, mat);

      artifact.position.set(
        (Math.random() - 0.5) * 200,
        0.3 + Math.random() * 0.5,
        (Math.random() - 0.5) * 200
      );

      artifact.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const scale = 0.5 + Math.random() * 1.0;
      artifact.scale.setScalar(scale);

      artifact.userData.worldX = artifact.position.x;
      artifact.userData.worldZ = artifact.position.z;
      artifact.userData.floatOffset = Math.random() * Math.PI * 2;
      artifact.userData.baseY = artifact.position.y;

      this.scene.add(artifact);
      this.artifacts.push(artifact);
      this.localFeatures.push(artifact);
    }

    this.artifactTimeUniform = artifactMat.uniforms.uTime;
  }

  createCraters() {
    // Impact craters with debris rings
    this.craters = [];

    for (let i = 0; i < 25; i++) {
      const crater = new THREE.Group();
      const craterSize = 3 + Math.random() * 8;

      // Crater rim - ring of rocks
      const rimRockCount = 8 + Math.floor(Math.random() * 12);
      const rockGeom = new THREE.DodecahedronGeometry(1, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x4a4a55,
        roughness: 0.9
      });

      for (let j = 0; j < rimRockCount; j++) {
        const angle = (j / rimRockCount) * Math.PI * 2 + Math.random() * 0.3;
        const dist = craterSize * (0.8 + Math.random() * 0.4);
        const rock = new THREE.Mesh(rockGeom, rockMat);

        rock.position.set(
          Math.cos(angle) * dist,
          0,
          Math.sin(angle) * dist
        );

        const scale = 0.3 + Math.random() * 0.8;
        rock.scale.set(scale, scale * 0.5, scale);
        rock.rotation.set(Math.random(), Math.random(), Math.random());

        crater.add(rock);
      }

      // Center debris/artifact
      if (Math.random() > 0.5) {
        const centerGeom = new THREE.IcosahedronGeometry(0.5, 0);
        const centerMat = new THREE.MeshStandardMaterial({
          color: 0x666677,
          roughness: 0.5,
          metalness: 0.5,
          emissive: new THREE.Color(0.1, 0.05, 0.15),
          emissiveIntensity: 0.5
        });
        const centerDebris = new THREE.Mesh(centerGeom, centerMat);
        centerDebris.position.y = 0.3;
        crater.add(centerDebris);
      }

      crater.position.set(
        (Math.random() - 0.5) * 200,
        0,
        (Math.random() - 0.5) * 200
      );

      crater.userData.worldX = crater.position.x;
      crater.userData.worldZ = crater.position.z;

      this.scene.add(crater);
      this.craters.push(crater);
      this.localFeatures.push(crater);
    }
  }

  createGeysers() {
    // Steam vents with particle effects
    this.geysers = [];

    for (let i = 0; i < 20; i++) {
      const geyser = new THREE.Group();

      // Vent mound
      const moundGeom = new THREE.ConeGeometry(1.5, 1, 8);
      const moundMat = new THREE.MeshStandardMaterial({
        color: 0x554433,
        roughness: 0.95
      });
      const mound = new THREE.Mesh(moundGeom, moundMat);
      mound.position.y = 0.5;
      geyser.add(mound);

      // Steam particles
      const steamCount = 50;
      const steamGeom = new THREE.BufferGeometry();
      const steamPositions = new Float32Array(steamCount * 3);
      const steamVelocities = new Float32Array(steamCount * 3);

      for (let j = 0; j < steamCount; j++) {
        steamPositions[j * 3] = (Math.random() - 0.5) * 0.5;
        steamPositions[j * 3 + 1] = Math.random() * 8;
        steamPositions[j * 3 + 2] = (Math.random() - 0.5) * 0.5;
        steamVelocities[j * 3] = (Math.random() - 0.5) * 0.5;
        steamVelocities[j * 3 + 1] = 2 + Math.random() * 3;
        steamVelocities[j * 3 + 2] = (Math.random() - 0.5) * 0.5;
      }

      steamGeom.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
      steamGeom.setAttribute('velocity', new THREE.BufferAttribute(steamVelocities, 3));

      const steamMat = new THREE.PointsMaterial({
        color: 0xaabbcc,
        size: 0.8,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const steam = new THREE.Points(steamGeom, steamMat);
      steam.position.y = 1;
      geyser.add(steam);
      geyser.userData.steam = steam;
      geyser.userData.steamVelocities = steamVelocities;

      // Glow at base
      const glowGeom = new THREE.CircleGeometry(1, 16);
      glowGeom.rotateX(-Math.PI / 2);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff6633,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      glow.position.y = 0.1;
      geyser.add(glow);

      geyser.position.set(
        (Math.random() - 0.5) * 200,
        0,
        (Math.random() - 0.5) * 200
      );

      geyser.userData.worldX = geyser.position.x;
      geyser.userData.worldZ = geyser.position.z;
      geyser.userData.phase = Math.random() * Math.PI * 2;

      this.scene.add(geyser);
      this.geysers.push(geyser);
      this.localFeatures.push(geyser);
    }
  }

  createBonePiles() {
    // Alien skeleton/fossil remains
    this.bonePiles = [];

    const boneGeom = new THREE.CylinderGeometry(0.1, 0.15, 1, 6);
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xccbbaa,
      roughness: 0.8
    });

    for (let i = 0; i < 35; i++) {
      const pile = new THREE.Group();
      const boneCount = 5 + Math.floor(Math.random() * 15);

      for (let j = 0; j < boneCount; j++) {
        const bone = new THREE.Mesh(boneGeom, boneMat);
        const length = 0.5 + Math.random() * 2;
        bone.scale.set(1, length, 1);

        bone.position.set(
          (Math.random() - 0.5) * 4,
          length / 4,
          (Math.random() - 0.5) * 4
        );

        bone.rotation.set(
          (Math.random() - 0.5) * Math.PI * 0.8,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * Math.PI * 0.8
        );

        pile.add(bone);
      }

      // Occasional skull-like object
      if (Math.random() > 0.6) {
        const skullGeom = new THREE.SphereGeometry(0.5, 8, 6);
        const skull = new THREE.Mesh(skullGeom, boneMat);
        skull.scale.set(1, 0.8, 1.2);
        skull.position.set((Math.random() - 0.5) * 2, 0.4, (Math.random() - 0.5) * 2);
        pile.add(skull);
      }

      pile.position.set(
        (Math.random() - 0.5) * 200,
        0,
        (Math.random() - 0.5) * 200
      );

      pile.userData.worldX = pile.position.x;
      pile.userData.worldZ = pile.position.z;

      this.scene.add(pile);
      this.bonePiles.push(pile);
      this.localFeatures.push(pile);
    }
  }

  createStoneCircles() {
    // Ancient alien stone circles/henges
    this.stoneCircles = [];

    const stoneGeom = new THREE.BoxGeometry(1, 1, 0.5);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a42,
      roughness: 0.9
    });

    for (let i = 0; i < 12; i++) {
      const circle = new THREE.Group();
      const radius = 4 + Math.random() * 6;
      const stoneCount = 6 + Math.floor(Math.random() * 8);

      for (let j = 0; j < stoneCount; j++) {
        const angle = (j / stoneCount) * Math.PI * 2;
        const stone = new THREE.Mesh(stoneGeom, stoneMat);

        const height = 2 + Math.random() * 4;
        const width = 0.8 + Math.random() * 1.2;
        stone.scale.set(width, height, 0.5);

        stone.position.set(
          Math.cos(angle) * radius,
          height / 2,
          Math.sin(angle) * radius
        );

        stone.rotation.y = angle + Math.PI / 2;
        stone.rotation.x = (Math.random() - 0.5) * 0.1;

        circle.add(stone);
      }

      // Center altar or artifact
      if (Math.random() > 0.3) {
        const altarGeom = new THREE.CylinderGeometry(1, 1.2, 0.5, 8);
        const altar = new THREE.Mesh(altarGeom, stoneMat);
        altar.position.y = 0.25;
        circle.add(altar);

        // Glowing center
        const glowGeom = new THREE.SphereGeometry(0.3, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0x88aaff,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.y = 0.8;
        circle.add(glow);
        circle.userData.glow = glow;
      }

      circle.position.set(
        (Math.random() - 0.5) * 200,
        0,
        (Math.random() - 0.5) * 200
      );

      circle.userData.worldX = circle.position.x;
      circle.userData.worldZ = circle.position.z;

      this.scene.add(circle);
      this.stoneCircles.push(circle);
      this.localFeatures.push(circle);
    }
  }

  // === WEATHER ===
  createWeatherSystems() {
    this.createDustStorm();
    this.createRainSystem();
    this.createLightningSystem();
    this.createSnowSystem();
  }

  createDustStorm() {
    const dustCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    const sizes = new Float32Array(dustCount);
    const randoms = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      sizes[i] = 0.5 + Math.random() * 1.5;
      randoms[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute float random;
        varying float vRandom;
        void main() {
          vRandom = random;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying float vRandom;

        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = gl_PointCoord - 0.5;

          // Irregular cloudy shape
          float d = length(uv);
          float n = noise(uv * 3.0 + vRandom);
          float shape = smoothstep(0.5, 0.2, d + n * 0.2);

          vec3 color = mix(vec3(0.6, 0.5, 0.4), vec3(0.4, 0.35, 0.3), n);
          float alpha = shape * uOpacity * 0.7;

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.dustStorm = new THREE.Points(geometry, material);
    this.scene.add(this.dustStorm);
  }

  createRainSystem() {
    const rainCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      velocities[i] = 0.8 + Math.random() * 0.4; // Varying fall speeds
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 }
      },
      vertexShader: `
        attribute float velocity;
        varying float vVelocity;
        void main() {
          vVelocity = velocity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 80.0 / -mvPosition.z; // Tall for streaks
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vVelocity;

        void main() {
          vec2 uv = gl_PointCoord;

          // Elongated vertical streak
          float xDist = abs(uv.x - 0.5);
          float streak = smoothstep(0.15, 0.0, xDist); // Narrow horizontally

          // Fade at top and bottom, brighter in middle-bottom
          float yFade = smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.4, uv.y);

          float alpha = streak * yFade * uOpacity * vVelocity;

          // Slight blue tint, mostly white
          vec3 color = mix(vec3(0.7, 0.85, 1.0), vec3(0.9, 0.95, 1.0), uv.y);

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.rain = new THREE.Points(geometry, material);
    this.scene.add(this.rain);
  }

  createLightningSystem() {
    this.lightning = {
      active: false,
      timer: 0,
      flash: 0
    };

    // Create lightning bolt geometry - using mesh for thickness
    this.lightningBolts = [];

    // Bright core material
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Outer glow material
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Create a pool of bolt objects
    for (let i = 0; i < 6; i++) {
      const boltGroup = new THREE.Group();
      boltGroup.visible = false;
      boltGroup.userData = { life: 0, active: false, branches: [], glows: [], subBranches: [] };

      // Main bolt - core (bright white)
      const coreGeom = new THREE.BufferGeometry();
      coreGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300), 3)); // 100 segments
      const core = new THREE.Line(coreGeom, coreMaterial.clone());
      boltGroup.add(core);
      boltGroup.userData.core = core;

      // Main bolt - outer glow (wider, blue)
      const outerGeom = new THREE.BufferGeometry();
      outerGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300), 3));
      const outer = new THREE.Line(outerGeom, glowMaterial.clone());
      boltGroup.add(outer);
      boltGroup.userData.outer = outer;

      // Create 8 branch bolts
      for (let j = 0; j < 8; j++) {
        const branchGeom = new THREE.BufferGeometry();
        branchGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(120), 3)); // 40 segments
        const branch = new THREE.Line(branchGeom, coreMaterial.clone());
        branch.material.opacity = 0.8;
        branch.visible = false;
        boltGroup.add(branch);
        boltGroup.userData.branches.push(branch);

        // Branch glow
        const branchGlowGeom = new THREE.BufferGeometry();
        branchGlowGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(120), 3));
        const branchGlow = new THREE.Line(branchGlowGeom, glowMaterial.clone());
        branchGlow.material.opacity = 0.4;
        branchGlow.visible = false;
        boltGroup.add(branchGlow);
        boltGroup.userData.glows.push(branchGlow);

        // Sub-branches (smaller forks)
        const subBranchGeom = new THREE.BufferGeometry();
        subBranchGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60), 3));
        const subBranch = new THREE.Line(subBranchGeom, coreMaterial.clone());
        subBranch.material.opacity = 0.5;
        subBranch.visible = false;
        boltGroup.add(subBranch);
        boltGroup.userData.subBranches.push(subBranch);
      }

      this.scene.add(boltGroup);
      this.lightningBolts.push(boltGroup);
    }

    // Large glow sprites for impact
    const glowTexture = this.createLightningGlowTexture();
    this.lightningGlows = [];
    for (let i = 0; i < 3; i++) {
      const glowSpriteMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xaaccff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const glow = new THREE.Sprite(glowSpriteMat);
      glow.scale.set(80, 80, 1); // Much bigger glow
      glow.visible = false;
      this.scene.add(glow);
      this.lightningGlows.push(glow);
    }

    // Sky flash plane
    const flashGeom = new THREE.PlaneGeometry(600, 200);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xaabbff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.lightningFlash = new THREE.Mesh(flashGeom, flashMat);
    this.lightningFlash.position.set(0, 100, -100);
    this.lightningFlash.rotation.x = -Math.PI / 6;
    this.scene.add(this.lightningFlash);
  }

  createLightningGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.1, 'rgba(200, 220, 255, 0.9)');
    gradient.addColorStop(0.3, 'rgba(150, 180, 255, 0.5)');
    gradient.addColorStop(0.6, 'rgba(100, 150, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(80, 120, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  spawnLightningBolt() {
    const bolt = this.lightningBolts.find(b => !b.userData.active);
    if (!bolt) return;

    // Random position - wider spread across the sky
    const startX = (Math.random() - 0.5) * 250;
    const startZ = -20 - Math.random() * 120;
    const startY = 120 + Math.random() * 60;

    // Generate dramatic jagged bolt path
    const segments = 30 + Math.floor(Math.random() * 40);
    const groundY = this.getTerrainHeight(startX, startZ + this.roverPosition.z) + this.terrain.position.y;

    // Store path for branches
    const path = [];

    let x = startX;
    let y = startY;
    let z = startZ;

    const corePositions = bolt.userData.core.geometry.attributes.position.array;
    const outerPositions = bolt.userData.outer.geometry.attributes.position.array;

    for (let i = 0; i < segments && i < 100; i++) {
      path.push({ x, y, z });
      corePositions[i * 3] = x;
      corePositions[i * 3 + 1] = y;
      corePositions[i * 3 + 2] = z;
      outerPositions[i * 3] = x;
      outerPositions[i * 3 + 1] = y;
      outerPositions[i * 3 + 2] = z;

      // More dramatic jagged movement
      const jag = Math.random() > 0.7 ? 20 : 10; // Occasional big jags
      x += (Math.random() - 0.5) * jag;
      y -= (startY - groundY) / segments + (Math.random() - 0.5) * 5;
      z += (Math.random() - 0.5) * jag * 0.5;
    }

    bolt.userData.core.geometry.setDrawRange(0, segments);
    bolt.userData.core.geometry.attributes.position.needsUpdate = true;
    bolt.userData.outer.geometry.setDrawRange(0, segments);
    bolt.userData.outer.geometry.attributes.position.needsUpdate = true;

    // Position impact glow
    const glow = this.lightningGlows.find(g => !g.visible);
    if (glow) {
      glow.position.set(x, groundY + 5, z);
      glow.visible = true;
      glow.material.opacity = 1;
      glow.scale.set(80, 80, 1);
      bolt.userData.impactGlow = glow;
    }

    // Sky flash
    this.lightningFlash.material.opacity = 0.4;
    this.lightningFlash.position.x = startX;

    // Generate branches with sub-branches
    bolt.userData.branches.forEach((branch, idx) => {
      const shouldBranch = Math.random() > 0.25; // 75% chance of branch
      if (shouldBranch && path.length > 10) {
        const branchStart = 5 + Math.floor(Math.random() * (path.length - 10));
        const branchSegments = 10 + Math.floor(Math.random() * 25);
        const branchPositions = branch.geometry.attributes.position.array;
        const glowPositions = bolt.userData.glows[idx].geometry.attributes.position.array;

        let bx = path[branchStart].x;
        let by = path[branchStart].y;
        let bz = path[branchStart].z;

        // Branch spreads outward dramatically
        const angle = (idx / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const spread = 1.5 + Math.random();

        for (let i = 0; i < branchSegments && i < 40; i++) {
          branchPositions[i * 3] = bx;
          branchPositions[i * 3 + 1] = by;
          branchPositions[i * 3 + 2] = bz;
          glowPositions[i * 3] = bx;
          glowPositions[i * 3 + 1] = by;
          glowPositions[i * 3 + 2] = bz;

          const jag = Math.random() > 0.8 ? 8 : 4;
          bx += Math.sin(angle) * spread * 3 + (Math.random() - 0.5) * jag;
          by -= 4 + Math.random() * 3;
          bz += Math.cos(angle) * spread * 2 + (Math.random() - 0.5) * jag;
        }

        branch.geometry.setDrawRange(0, branchSegments);
        branch.geometry.attributes.position.needsUpdate = true;
        branch.visible = true;

        bolt.userData.glows[idx].geometry.setDrawRange(0, branchSegments);
        bolt.userData.glows[idx].geometry.attributes.position.needsUpdate = true;
        bolt.userData.glows[idx].visible = true;

        // Sub-branch from this branch
        if (Math.random() > 0.5 && branchSegments > 8) {
          const subBranch = bolt.userData.subBranches[idx];
          const subPositions = subBranch.geometry.attributes.position.array;
          const subStart = 3 + Math.floor(Math.random() * (branchSegments - 5));

          let sx = branchPositions[subStart * 3];
          let sy = branchPositions[subStart * 3 + 1];
          let sz = branchPositions[subStart * 3 + 2];

          const subAngle = angle + (Math.random() - 0.5) * Math.PI;
          const subSegments = 5 + Math.floor(Math.random() * 10);

          for (let i = 0; i < subSegments && i < 20; i++) {
            subPositions[i * 3] = sx;
            subPositions[i * 3 + 1] = sy;
            subPositions[i * 3 + 2] = sz;

            sx += Math.sin(subAngle) * 2 + (Math.random() - 0.5) * 3;
            sy -= 2 + Math.random() * 2;
            sz += Math.cos(subAngle) * 1.5 + (Math.random() - 0.5) * 2;
          }

          subBranch.geometry.setDrawRange(0, subSegments);
          subBranch.geometry.attributes.position.needsUpdate = true;
          subBranch.visible = true;
        }
      }
    });

    bolt.visible = true;
    bolt.userData.active = true;
    bolt.userData.life = 0;
  }

  updateLightningBolts(delta) {
    this.lightningBolts.forEach(bolt => {
      if (!bolt.userData.active) return;

      bolt.userData.life += delta;
      const life = bolt.userData.life;

      // Dramatic flicker pattern
      let opacity;
      if (life < 0.03) {
        opacity = 1;
      } else if (life < 0.08) {
        opacity = Math.random() > 0.3 ? 1 : 0.4; // Intense flicker
      } else if (life < 0.15) {
        opacity = Math.random() > 0.5 ? 0.9 : 0.2; // More flicker
      } else if (life < 0.25) {
        opacity = 0.7 * (1 - (life - 0.15) / 0.1);
      } else {
        opacity = Math.max(0, 0.4 - (life - 0.25) * 2);
      }

      // Update core and outer
      bolt.userData.core.material.opacity = opacity;
      bolt.userData.outer.material.opacity = opacity * 0.5;

      // Update branches
      bolt.userData.branches.forEach((branch, idx) => {
        if (branch.visible) {
          branch.material.opacity = opacity * 0.7;
          bolt.userData.glows[idx].material.opacity = opacity * 0.3;
        }
      });

      // Update sub-branches
      bolt.userData.subBranches.forEach(sub => {
        if (sub.visible) {
          sub.material.opacity = opacity * 0.5;
        }
      });

      // Update impact glow
      if (bolt.userData.impactGlow) {
        bolt.userData.impactGlow.material.opacity = opacity;
        bolt.userData.impactGlow.scale.setScalar(80 + life * 60);
      }

      // Update sky flash
      this.lightningFlash.material.opacity = opacity * 0.3;

      // Deactivate when done
      if (life > 0.5) {
        bolt.visible = false;
        bolt.userData.active = false;
        bolt.userData.branches.forEach(b => b.visible = false);
        bolt.userData.glows.forEach(g => g.visible = false);
        bolt.userData.subBranches.forEach(s => s.visible = false);
        if (bolt.userData.impactGlow) {
          bolt.userData.impactGlow.visible = false;
          bolt.userData.impactGlow = null;
        }
        this.lightningFlash.material.opacity = 0;
      }
    });
  }

  createSnowSystem() {
    const snowCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(snowCount * 3);
    const sizes = new Float32Array(snowCount);
    const rotations = new Float32Array(snowCount);

    for (let i = 0; i < snowCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      sizes[i] = 0.5 + Math.random() * 1.0;
      rotations[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute float rotation;
        varying float vRotation;
        void main() {
          vRotation = rotation;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying float vRotation;

        void main() {
          vec2 uv = gl_PointCoord - 0.5;

          // Rotate UV
          float angle = vRotation + uTime * 0.5;
          float c = cos(angle), s = sin(angle);
          uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

          // Hexagonal snowflake pattern
          float d = length(uv);

          // Six-fold symmetry
          float a = atan(uv.y, uv.x);
          float hex = cos(a * 6.0) * 0.03;

          // Central glow + arms
          float flake = smoothstep(0.5, 0.1, d - hex);

          // Add crystalline arms
          float arms = 0.0;
          for (int i = 0; i < 6; i++) {
            float armAngle = float(i) * 3.14159 / 3.0;
            vec2 armDir = vec2(cos(armAngle), sin(armAngle));
            float armDist = abs(dot(uv, vec2(-armDir.y, armDir.x)));
            float alongArm = dot(uv, armDir);
            if (alongArm > 0.0) {
              arms += smoothstep(0.08, 0.0, armDist) * smoothstep(0.5, 0.1, alongArm);
            }
          }

          float shape = max(flake, arms * 0.7);
          vec3 color = vec3(0.9, 0.95, 1.0);
          float alpha = shape * uOpacity * 0.8;

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.snow = new THREE.Points(geometry, material);
    this.scene.add(this.snow);
  }

  // === SPACE EVENTS ===
  createSpaceEvents() {
    this.createCometSystem();
    this.createUFOSystem();
    this.supernovaFlash = 0;
    this.eclipseProgress = 0;
    this.eclipseActive = false;
  }

  createCometSystem() {
    // Comet group to hold all parts
    this.comet = new THREE.Group();
    this.comet.visible = false;

    // Bright glowing nucleus
    const nucleusGeom = new THREE.SphereGeometry(2, 16, 16);
    const nucleusMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          float flicker = sin(uTime * 20.0) * 0.1 + 0.9;
          vec3 core = vec3(1.0, 1.0, 1.0) * flicker;
          vec3 glow = vec3(0.6, 0.85, 1.0) * fresnel * 2.0;
          gl_FragColor = vec4(core + glow, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    this.cometNucleus = new THREE.Mesh(nucleusGeom, nucleusMat);
    this.comet.add(this.cometNucleus);

    // Inner coma - bright glow
    const innerComaGeom = new THREE.SphereGeometry(8, 24, 24);
    const innerComaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
          float intensity = pow(rim, 1.5) * 0.8;
          float pulse = sin(uTime * 3.0) * 0.1 + 0.9;
          vec3 color = vec3(0.5, 0.8, 1.0) * intensity * pulse;
          gl_FragColor = vec4(color, intensity * 0.7);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    const innerComa = new THREE.Mesh(innerComaGeom, innerComaMat);
    this.comet.add(innerComa);

    // Outer coma - diffuse glow
    const outerComaGeom = new THREE.SphereGeometry(15, 24, 24);
    const outerComaMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
          float intensity = pow(rim, 2.0) * 0.4;
          vec3 color = vec3(0.4, 0.6, 0.9) * intensity;
          gl_FragColor = vec4(color, intensity * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    const outerComa = new THREE.Mesh(outerComaGeom, outerComaMat);
    this.comet.add(outerComa);

    // Ion tail (blue, straight, points away from sun)
    const ionTailCount = 800;
    const ionTailGeom = new THREE.BufferGeometry();
    const ionPositions = new Float32Array(ionTailCount * 3);
    const ionSizes = new Float32Array(ionTailCount);
    const ionOffsets = new Float32Array(ionTailCount); // For animation variety

    for (let i = 0; i < ionTailCount; i++) {
      ionPositions[i * 3] = 0;
      ionPositions[i * 3 + 1] = 0;
      ionPositions[i * 3 + 2] = 0;
      ionSizes[i] = 2 + Math.random() * 4;
      ionOffsets[i] = Math.random() * Math.PI * 2;
    }

    ionTailGeom.setAttribute('position', new THREE.BufferAttribute(ionPositions, 3));
    ionTailGeom.setAttribute('size', new THREE.BufferAttribute(ionSizes, 1));
    ionTailGeom.setAttribute('offset', new THREE.BufferAttribute(ionOffsets, 1));

    const ionTailMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute float offset;
        varying float vAlpha;
        varying float vOffset;
        void main() {
          vOffset = offset;
          vAlpha = 1.0 - length(position) / 200.0;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vAlpha;
        varying float vOffset;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float softness = 1.0 - d * 2.0;
          float flicker = sin(uTime * 10.0 + vOffset * 5.0) * 0.2 + 0.8;
          float alpha = softness * vAlpha * flicker * 0.8;
          vec3 color = mix(vec3(0.3, 0.6, 1.0), vec3(0.6, 0.8, 1.0), softness);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.ionTail = new THREE.Points(ionTailGeom, ionTailMat);
    this.comet.add(this.ionTail);

    // Dust tail (yellow/white, curved, affected by solar radiation pressure)
    const dustTailCount = 600;
    const dustTailGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustTailCount * 3);
    const dustSizes = new Float32Array(dustTailCount);
    const dustOffsets = new Float32Array(dustTailCount);

    for (let i = 0; i < dustTailCount; i++) {
      dustPositions[i * 3] = 0;
      dustPositions[i * 3 + 1] = 0;
      dustPositions[i * 3 + 2] = 0;
      dustSizes[i] = 1.5 + Math.random() * 3;
      dustOffsets[i] = Math.random() * Math.PI * 2;
    }

    dustTailGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustTailGeom.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));
    dustTailGeom.setAttribute('offset', new THREE.BufferAttribute(dustOffsets, 1));

    const dustTailMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute float offset;
        varying float vAlpha;
        varying float vOffset;
        void main() {
          vOffset = offset;
          vAlpha = 1.0 - length(position) / 150.0;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (250.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vAlpha;
        varying float vOffset;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float softness = 1.0 - d * 2.0;
          float shimmer = sin(uTime * 5.0 + vOffset * 3.0) * 0.15 + 0.85;
          float alpha = softness * vAlpha * shimmer * 0.6;
          vec3 color = mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 1.0, 0.9), softness);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.dustTail = new THREE.Points(dustTailGeom, dustTailMat);
    this.comet.add(this.dustTail);

    this.scene.add(this.comet);
    this.cometState = {
      active: false,
      time: 0,
      arcCenter: new THREE.Vector3(),
      arcRadius: 0,
      arcStartAngle: 0,
      arcEndAngle: 0,
      arcAxis: new THREE.Vector3()
    };
  }

  createUFOSystem() {
    const ufoGeom = new THREE.TorusGeometry(1, 0.3, 8, 16);
    const ufoMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        void main() {
          float pulse = sin(uTime * 10.0) * 0.5 + 0.5;
          vec3 color = mix(vec3(0.2, 0.5, 0.2), vec3(0.5, 1.0, 0.5), pulse);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.ufo = new THREE.Mesh(ufoGeom, ufoMat);
    this.ufo.rotation.x = Math.PI / 2;
    this.ufo.visible = false;
    this.scene.add(this.ufo);
    this.ufoState = { active: false, time: 0, path: [] };
  }

  // === AURORA ===
  createAurora() {
    // Large sky-spanning aurora dome
    this.auroraCurtains = [];

    // Create a large curved surface that spans the sky
    const geometry = new THREE.SphereGeometry(500, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
        uAudioMid: { value: 0 },
        uAudioTreble: { value: 0 },
        uIntensity: { value: 1.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uAudioBass;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vWave;

        void main() {
          vUv = uv;
          vPosition = position;
          vec3 pos = position;

          // Very slow, large-scale flowing wave motion
          float wave = sin(pos.x * 0.005 + uTime * 0.1) * 20.0;
          wave += sin(pos.z * 0.008 - uTime * 0.08) * 15.0;
          wave += sin((pos.x + pos.z) * 0.003 + uTime * 0.05) * 25.0;
          wave *= (1.0 + uAudioBass * 0.3);

          pos.y += wave;

          // Gentle ripple
          float ripple = sin(pos.x * 0.02 + pos.z * 0.02 + uTime * 0.3) * 5.0;
          pos.y += ripple * (1.0 + uAudioBass * 0.5);

          vWave = wave * 0.01;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAudioBass;
        uniform float uAudioMid;
        uniform float uAudioTreble;
        uniform float uIntensity;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vWave;

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          // Use world position for seamless patterns
          vec2 worldUV = vPosition.xz * 0.002;

          // Slow-moving curtain bands
          float bands = sin(worldUV.x * 10.0 + uTime * 0.1) * 0.5 + 0.5;
          bands *= sin(worldUV.x * 5.0 - uTime * 0.05 + worldUV.y * 2.0) * 0.5 + 0.5;
          bands = pow(bands, 0.8);

          // Large flowing patterns
          float flow = sin(worldUV.x * 3.0 + worldUV.y * 2.0 + uTime * 0.08) * 0.5 + 0.5;
          flow *= sin(worldUV.y * 4.0 - uTime * 0.06) * 0.5 + 0.5;

          // Shimmer
          float shimmer = sin(worldUV.x * 50.0 + worldUV.y * 30.0 + uTime * 0.5) * 0.5 + 0.5;
          shimmer = pow(shimmer, 4.0) * 0.5;

          // Color variation across the sky
          float hue = 0.35 + sin(worldUV.x * 2.0 + uTime * 0.03) * 0.15;
          hue += sin(worldUV.y * 3.0 - uTime * 0.02) * 0.1;
          hue += uAudioMid * 0.1;
          hue += vWave;

          float saturation = 0.6 + uAudioTreble * 0.2;
          float brightness = 0.5 + bands * 0.3 + shimmer + uAudioBass * 0.3;

          vec3 color = hsv2rgb(vec3(fract(hue), saturation, brightness));

          // Vertical rays effect
          float rays = sin(worldUV.x * 30.0 + uTime * 0.2) * 0.3 + 0.7;

          // Alpha based on patterns
          float alpha = bands * flow * rays * uIntensity;
          alpha *= 0.3 + uAudioBass * 0.2;

          // Fade at horizon (bottom of dome)
          float horizonFade = smoothstep(0.0, 0.4, vUv.y);
          alpha *= horizonFade;

          // Fade at top
          alpha *= smoothstep(1.0, 0.6, vUv.y);

          alpha = clamp(alpha, 0.0, 0.6);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });

    const aurora = new THREE.Mesh(geometry, material);
    aurora.position.set(0, -50, 0);
    aurora.rotation.x = Math.PI;

    this.scene.add(aurora);
    this.auroraCurtains.push(aurora);
  }

  updateAurora(delta, elapsed, audioData) {
    this.auroraCurtains.forEach((curtain) => {
      curtain.material.uniforms.uTime.value = elapsed;

      if (audioData) {
        const bass = curtain.material.uniforms.uAudioBass;
        const mid = curtain.material.uniforms.uAudioMid;
        const treble = curtain.material.uniforms.uAudioTreble;

        bass.value += (audioData.bass - bass.value) * 0.15;
        mid.value += (audioData.mid - mid.value) * 0.15;
        treble.value += (audioData.treble - treble.value) * 0.15;
      } else {
        curtain.material.uniforms.uAudioBass.value *= 0.95;
        curtain.material.uniforms.uAudioMid.value *= 0.95;
        curtain.material.uniforms.uAudioTreble.value *= 0.95;
      }

      // Very slow rotation
      curtain.rotation.y += delta * 0.005;
    });
  }

  // === UPDATE METHODS ===
  updateDayNight(delta) {
    // Advance the day/night cycle
    this.dayNightCycle = (this.dayNightCycle + delta * this.dayNightSpeed) % 1;

    // Calculate sun position (0=noon, 0.25=sunset, 0.5=midnight, 0.75=sunrise)
    const sunAngle = this.dayNightCycle * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle); // -1 to 1, negative = night

    // Sky colors based on time of day
    const nightColor = new THREE.Color(0x000008);
    const dayColor = new THREE.Color(0x1a1a3a);
    const sunsetColor = new THREE.Color(0x2a1525);
    const sunriseColor = new THREE.Color(0x1a2535);

    let skyColor;
    if (sunHeight > 0.3) {
      // Day
      skyColor = dayColor.clone();
    } else if (sunHeight > 0) {
      // Sunset/Sunrise transition
      const t = sunHeight / 0.3;
      if (this.dayNightCycle < 0.5) {
        skyColor = sunsetColor.clone().lerp(dayColor, t);
      } else {
        skyColor = sunriseColor.clone().lerp(dayColor, t);
      }
    } else if (sunHeight > -0.3) {
      // Twilight
      const t = (sunHeight + 0.3) / 0.3;
      if (this.dayNightCycle < 0.5) {
        skyColor = nightColor.clone().lerp(sunsetColor, t);
      } else {
        skyColor = nightColor.clone().lerp(sunriseColor, t);
      }
    } else {
      // Night
      skyColor = nightColor.clone();
    }

    // Apply sky color (unless weather is overriding)
    if (this.currentWeather === 'clear') {
      this.scene.background.copy(skyColor);
    }

    // Adjust fog color
    const fogColor = skyColor.clone().multiplyScalar(1.5);
    this.scene.fog.color.copy(fogColor);

    // Adjust star visibility (fade in at night)
    const starOpacity = Math.max(0, -sunHeight * 2);
    if (this.stars && this.stars.material.uniforms) {
      // Stars are always visible but brighter at night
    }

    // Adjust aurora visibility (stronger at night)
    const auroraIntensity = Math.max(0, -sunHeight + 0.3);
    this.auroraCurtains?.forEach(curtain => {
      curtain.material.uniforms.uIntensity.value = auroraIntensity;
    });

    // Adjust nebula visibility
    this.nebulae?.forEach(n => {
      const baseIntensity = this.params.nebulaIntensity;
      const nightBoost = Math.max(0, -sunHeight) * 0.5;
      n.material.uniforms.uIntensity.value = baseIntensity * (0.5 + nightBoost + (sunHeight < 0 ? 0.5 : 0));
    });

    // Terrain tint based on time
    if (sunHeight > 0) {
      // Daytime - warmer
      this.terrain.material.uniforms.uWeatherTint?.value.setRGB(1.0 + sunHeight * 0.1, 1.0, 1.0 - sunHeight * 0.1);
    } else if (this.currentWeather === 'clear') {
      // Nighttime - cooler blue tint
      this.terrain.material.uniforms.uWeatherTint?.value.setRGB(0.8, 0.85, 1.0);
    }
  }

  updateWeather(delta, elapsed, audioData) {
    this.weatherTimer += delta;

    // Track audio for weather reactivity
    this.weatherAudioBass = this.weatherAudioBass || 0;
    this.weatherAudioBass += ((audioData?.bass || 0) - this.weatherAudioBass) * 0.1;

    // Change weather every 30-60 seconds (chance per frame)
    // Bass hits can trigger weather changes!
    const bassTriggeredChange = this.weatherAudioBass > 0.8 && Math.random() < 0.001;
    if ((this.weatherTimer > 30 && Math.random() < 0.001) || bassTriggeredChange) {
      const weathers = ['clear', 'dust', 'rain', 'lightning', 'snow'];
      const newWeather = weathers[Math.floor(Math.random() * weathers.length)];
      if (newWeather !== this.currentWeather) {
        this.currentWeather = newWeather;
        this.weatherTimer = 0;
      }
    }

    // Transition weather effects using shader uniforms
    const dustTarget = this.currentWeather === 'dust' ? 0.8 : 0;
    const rainTarget = this.currentWeather === 'rain' ? 1.0 : 0;
    const snowTarget = this.currentWeather === 'snow' ? 0.8 : 0;

    const dustOpacity = this.dustStorm.material.uniforms.uOpacity;
    const rainOpacity = this.rain.material.uniforms.uOpacity;
    const snowOpacity = this.snow.material.uniforms.uOpacity;

    dustOpacity.value += (dustTarget - dustOpacity.value) * delta * 2;
    rainOpacity.value += (rainTarget - rainOpacity.value) * delta * 2;
    snowOpacity.value += (snowTarget - snowOpacity.value) * delta * 2;

    // Update dust storm - swirling horizontal movement
    if (dustOpacity.value > 0.01) {
      this.dustStorm.material.uniforms.uTime.value = elapsed;
      const positions = this.dustStorm.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += delta * 25;
        positions[i + 1] += Math.sin(elapsed * 2 + positions[i] * 0.1) * delta * 3;
        if (positions[i] > 100) positions[i] -= 200;
      }
      this.dustStorm.geometry.attributes.position.needsUpdate = true;
      this.terrain.material.uniforms.uWeatherTint.value.setRGB(0.8, 0.7, 0.6);
    }

    // Update rain - fast vertical streaks
    if (rainOpacity.value > 0.01) {
      const positions = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= delta * 50; // Fast fall
        positions[i] += delta * 3; // Slight wind
        if (positions[i + 1] < 0) {
          positions[i + 1] += 50;
          positions[i] = (Math.random() - 0.5) * 100;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // Update snow - gentle tumbling descent
    if (snowOpacity.value > 0.01) {
      this.snow.material.uniforms.uTime.value = elapsed;
      const positions = this.snow.geometry.attributes.position.array;
      const rotations = this.snow.geometry.attributes.rotation.array;
      for (let i = 0; i < positions.length / 3; i++) {
        const idx = i * 3;
        // Gentle swaying
        positions[idx] += Math.sin(elapsed * 0.5 + i * 0.1) * delta * 3;
        positions[idx + 1] -= delta * 4; // Slow fall
        positions[idx + 2] += Math.cos(elapsed * 0.3 + i * 0.15) * delta * 2;
        // Tumble rotation
        rotations[i] += delta * (0.5 + Math.sin(i) * 0.3);
        if (positions[idx + 1] < 0) {
          positions[idx + 1] += 40;
          positions[idx] = (Math.random() - 0.5) * 100;
          positions[idx + 2] = (Math.random() - 0.5) * 100;
        }
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
      this.snow.geometry.attributes.rotation.needsUpdate = true;
    }

    // Lightning - with rain
    if (this.currentWeather === 'lightning') {
      // Also show rain during lightning storms
      rainOpacity.value += (0.6 - rainOpacity.value) * delta * 2;

      this.lightning.timer += delta;
      if (this.lightning.timer > 2 + Math.random() * 5) {
        this.lightning.flash = 1;
        this.lightning.timer = 0;
        // Spawn actual lightning bolt
        this.spawnLightningBolt();
        // Sometimes spawn multiple bolts for dramatic effect
        if (Math.random() > 0.6) {
          setTimeout(() => this.spawnLightningBolt(), 50 + Math.random() * 100);
        }
      }
      if (this.lightning.flash > 0) {
        this.lightning.flash -= delta * 5;
        this.scene.background.setRGB(
          0.02 + this.lightning.flash * 0.6,
          0.02 + this.lightning.flash * 0.6,
          0.1 + this.lightning.flash * 0.6
        );
      } else {
        this.scene.background.setRGB(0.02, 0.02, 0.05);
      }
    } else if (this.currentWeather === 'clear') {
      this.terrain.material.uniforms.uWeatherTint.value.setRGB(1, 1, 1);
      this.scene.background.setRGB(0, 0, 0.03);
    }

    // Always update lightning bolts (they fade out even when weather changes)
    this.updateLightningBolts(delta);
  }

  updateSpaceEvents(delta, elapsed) {
    // Meteor shower (more intense shooting stars) - 5% chance every 30 sec
    if (Math.random() < 0.00015) {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => this.spawnShootingStar(), i * 200);
      }
    }

    // Comet - rare, ~2% chance per minute
    if (!this.cometState.active && Math.random() < 0.0003) {
      this.startComet();
    }

    if (this.cometState.active) {
      this.updateComet(delta, elapsed);
    }

    // UFO - rare, ~1% chance per minute
    if (!this.ufoState.active && Math.random() < 0.00015) {
      this.ufoState.active = true;
      this.ufoState.time = 0;
      this.ufo.visible = true;
      this.ufo.position.set(
        (Math.random() - 0.5) * 200,
        50 + Math.random() * 50,
        -100 - Math.random() * 100
      );
    }

    if (this.ufoState.active) {
      this.ufoState.time += delta;
      this.ufo.material.uniforms.uTime.value = elapsed;

      // Erratic movement
      this.ufo.position.x += Math.sin(elapsed * 5) * delta * 20;
      this.ufo.position.y += Math.cos(elapsed * 3) * delta * 10;
      this.ufo.position.z += delta * 30;

      if (this.ufoState.time > 5 || this.ufo.position.z > 100) {
        this.ufoState.active = false;
        this.ufo.visible = false;
      }
    }

    // Supernova flash - very rare, ~0.5% per minute
    if (this.supernovaFlash <= 0 && Math.random() < 0.00008) {
      this.supernovaFlash = 1;
    }
    if (this.supernovaFlash > 0) {
      this.supernovaFlash -= delta * 0.3;
      // Flash the whole scene
      const flash = Math.max(0, this.supernovaFlash);
      this.scene.background.setRGB(flash * 0.3, flash * 0.2, flash * 0.4);
    }

    // Eclipse - moon passes in front of another - very rare
    if (!this.eclipseActive && Math.random() < 0.00005 && this.moons.length >= 2) {
      this.eclipseActive = true;
      this.eclipseProgress = 0;
    }
    if (this.eclipseActive) {
      this.eclipseProgress += delta * 0.02;
      // Move one moon toward another
      const moon1 = this.moons[0];
      const moon2 = this.moons[1];
      const originalPos = moon1.userData.originalPos || moon1.position.clone();
      moon1.userData.originalPos = originalPos;

      if (this.eclipseProgress < 0.5) {
        moon1.position.lerp(moon2.position, this.eclipseProgress * 0.1);
      } else {
        moon1.position.lerp(originalPos, (this.eclipseProgress - 0.5) * 0.1);
      }

      if (this.eclipseProgress > 1) {
        this.eclipseActive = false;
        moon1.position.copy(originalPos);
      }
    }
  }

  updateFlora(delta, elapsed, audioData) {
    // Audio values for reactivity
    const bass = audioData?.bass || 0;
    const mid = audioData?.mid || 0;

    // Smooth audio tracking
    this.floraAudioBass = this.floraAudioBass || 0;
    this.floraAudioMid = this.floraAudioMid || 0;
    this.floraAudioBass += (bass - this.floraAudioBass) * 0.15;
    this.floraAudioMid += (mid - this.floraAudioMid) * 0.15;

    // Update shader time uniforms for animated flora materials
    if (this.crystalMat?.uniforms) this.crystalMat.uniforms.uTime.value = elapsed;
    if (this.emberMat?.uniforms) this.emberMat.uniforms.uTime.value = elapsed;
    if (this.glowMat?.uniforms) this.glowMat.uniforms.uTime.value = elapsed;
    if (this.toxicMat?.uniforms) this.toxicMat.uniforms.uTime.value = elapsed;
    if (this.coralMat?.uniforms) this.coralMat.uniforms.uTime.value = elapsed;

    // Update floating spores (universal)
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

    // Update biome-specific flora
    const wrapRange = 200;
    const halfRange = wrapRange / 2;

    // Update each biome's flora
    for (let biomeId = 0; biomeId < 10; biomeId++) {
      const floraList = this.biomeFlora[biomeId];
      if (!floraList) continue;

      floraList.forEach(flora => {
        // Calculate world position
        const worldZ = flora.userData.worldZ - this.roverPosition.z;
        const wrappedZ = ((worldZ % wrapRange) + wrapRange * 1.5) % wrapRange - halfRange;

        // Calculate actual world Z for biome check
        const actualWorldZ = flora.userData.worldZ;

        // Check if this flora should be visible based on biome
        const biomeAtPosition = this.getBiomeAtPosition(flora.userData.worldX, actualWorldZ);
        const targetBiome = flora.userData.biome;

        // Each biome spans 0.1 of the range (10 biomes total)
        // Flora is visible if current position's biome matches, with some tolerance for transitions
        const biomeMatch = Math.abs(biomeAtPosition * 10 - targetBiome) < 1.5 ||
                          Math.abs(biomeAtPosition * 10 - targetBiome - 10) < 1.5 ||
                          Math.abs(biomeAtPosition * 10 - targetBiome + 10) < 1.5;

        flora.visible = biomeMatch;

        if (flora.visible) {
          // Update position
          flora.position.z = wrappedZ;
          flora.position.y = this.getTerrainHeight(flora.userData.worldX, actualWorldZ) + this.terrain.position.y;

          // Gentle sway animation
          flora.rotation.x = Math.sin(elapsed * 0.5 + flora.position.x * 0.1) * 0.03;
          flora.rotation.z = Math.cos(elapsed * 0.3 + flora.position.z * 0.1) * 0.03;

          // Update shader uniforms for children with materials
          flora.traverse(child => {
            if (child.material?.uniforms?.uTime) {
              child.material.uniforms.uTime.value = elapsed + this.floraAudioBass;
            }
          });
        }
      });
    }
  }

  updateFauna(delta, elapsed) {
    // Flying creatures
    this.flyingCreatures?.forEach(bird => {
      const d = bird.userData;
      const angle = elapsed * d.circleSpeed + d.circlePhase;
      bird.position.x = Math.cos(angle) * d.circleRadius;
      bird.position.z = Math.sin(angle) * d.circleRadius - 50;
      bird.position.y = d.baseY + Math.sin(elapsed * 0.5) * 10;

      // Wing flap
      const wingAngle = Math.sin(elapsed * d.speed * 10 + d.wingPhase) * 0.5;
      bird.children[0].rotation.z = wingAngle;
      bird.children[1].rotation.z = -wingAngle;

      // Face direction of movement
      bird.rotation.y = angle + Math.PI / 2;
    });

    // Ground creatures
    this.groundCreatures?.forEach(creature => {
      creature.userData.nextMoveTime -= delta;

      if (creature.userData.nextMoveTime <= 0) {
        creature.userData.targetX = (Math.random() - 0.5) * 80;
        creature.userData.targetZ = (Math.random() - 0.5) * 80;
        creature.userData.nextMoveTime = 2 + Math.random() * 5;
      }

      const dx = creature.userData.targetX - creature.position.x;
      const dz = creature.userData.targetZ - creature.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        creature.position.x += (dx / dist) * creature.userData.speed * delta;
        creature.position.z += (dz / dist) * creature.userData.speed * delta;
      }

      creature.position.y = this.getTerrainHeight(creature.position.x, creature.position.z + this.roverPosition.z) + this.terrain.position.y + 0.3;

      // Pulse glow
      const pulse = Math.sin(elapsed * 3 + creature.position.x) * 0.3 + 0.7;
      creature.material.color.setRGB(0.2 * pulse, 1.0 * pulse, 0.5 * pulse);
    });

    // Giant worm - very rare breach, ~0.2% chance per minute
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
        const x = this.wormState.x + Math.sin(t + i * 0.3) * 5;
        const z = this.wormState.z + i * 2;
        segment.position.set(x - this.wormState.x, Math.max(-10, y), z - this.wormState.z);
      });

      this.worm.position.set(this.wormState.x, this.terrain.position.y, this.wormState.z);

      if (this.wormState.time > 5) {
        this.wormState.active = false;
        this.worm.visible = false;
      }
    }
  }

  updateStructures(elapsed) {
    // Update monolith glow
    this.monoliths?.forEach(m => {
      if (m.material?.uniforms) {
        m.material.uniforms.uTime.value = elapsed;
      }
    });

    // Position structures on terrain
    this.structures?.forEach(structure => {
      if (!structure.userData.worldZ) {
        structure.userData.worldX = structure.position.x;
        structure.userData.worldZ = structure.position.z;
      }
      const worldZ = structure.userData.worldZ - this.roverPosition.z;
      const wrappedZ = ((worldZ % 200) + 300) % 200 - 100;
      structure.position.z = wrappedZ;
      const terrainY = this.getTerrainHeight(structure.userData.worldX, structure.userData.worldZ) + this.terrain.position.y;
      structure.position.y = terrainY + (structure.geometry?.parameters?.height || 0) / 2;
    });
  }

  updateLocalFeatures(delta, elapsed) {
    const wrapRange = 200;
    const halfRange = wrapRange / 2;

    // Helper to position objects on terrain with wrapping
    const updatePosition = (obj, yOffset = 0) => {
      if (!obj.userData.worldX) {
        obj.userData.worldX = obj.position.x;
        obj.userData.worldZ = obj.position.z;
      }
      const worldZ = obj.userData.worldZ - this.roverPosition.z;
      const wrappedZ = ((worldZ % wrapRange) + wrapRange * 1.5) % wrapRange - halfRange;
      obj.position.z = wrappedZ;
      const terrainY = this.getTerrainHeight(obj.userData.worldX, obj.userData.worldZ) + this.terrain.position.y;
      obj.position.y = terrainY + yOffset;
    };

    // Update boulders
    this.boulders?.forEach(rock => updatePosition(rock, rock.scale.y * 0.3));

    // Update rock pillars
    this.rockPillars?.forEach(pillar => {
      updatePosition(pillar, pillar.userData.baseHeight || pillar.scale.y / 2);
    });

    // Update artifacts - with floating animation
    if (this.artifactTimeUniform) {
      this.artifactTimeUniform.value = elapsed;
    }
    this.artifacts?.forEach(artifact => {
      updatePosition(artifact, artifact.userData.baseY || 0.5);
      // Gentle floating motion
      const float = Math.sin(elapsed * 2 + artifact.userData.floatOffset) * 0.2;
      artifact.position.y += float;
      // Slow rotation
      artifact.rotation.y += delta * 0.5;
    });

    // Update craters
    this.craters?.forEach(crater => updatePosition(crater, 0));

    // Update geysers with steam animation
    this.geysers?.forEach(geyser => {
      updatePosition(geyser, 0);

      // Animate steam particles
      if (geyser.userData.steam) {
        const positions = geyser.userData.steam.geometry.attributes.position.array;
        const velocities = geyser.userData.steamVelocities;
        const phase = geyser.userData.phase;
        const intensity = (Math.sin(elapsed * 0.5 + phase) * 0.5 + 0.5) * 0.8 + 0.2;

        for (let i = 0; i < positions.length / 3; i++) {
          positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * intensity;

          // Reset particles that go too high
          if (positions[i * 3 + 1] > 8) {
            positions[i * 3] = (Math.random() - 0.5) * 0.5;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
          }

          // Horizontal drift
          positions[i * 3] += velocities[i * 3] * delta * 0.3;
          positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 0.3;
        }
        geyser.userData.steam.geometry.attributes.position.needsUpdate = true;
        geyser.userData.steam.material.opacity = 0.2 + intensity * 0.3;
      }
    });

    // Update bone piles
    this.bonePiles?.forEach(pile => updatePosition(pile, 0));

    // Update stone circles with glowing animation
    this.stoneCircles?.forEach(circle => {
      updatePosition(circle, 0);

      // Animate center glow
      if (circle.userData.glow) {
        const pulse = Math.sin(elapsed * 2) * 0.3 + 0.7;
        circle.userData.glow.material.opacity = pulse * 0.6;
        circle.userData.glow.scale.setScalar(0.8 + pulse * 0.4);
      }
    });
  }

  spawnShootingStar() {
    const star = this.shootingStarPool.find(s => !s.userData.active);
    if (!star) return;

    // Spawn in front of camera (negative z) and above, within visible FOV
    const spreadX = (Math.random() - 0.5) * 200; // Side spread
    const startZ = -100 - Math.random() * 200; // Always in front of camera
    const startY = 80 + Math.random() * 150; // High in the sky

    star.userData.startPos.set(spreadX, startY, startZ);

    // Velocity: moving down and slightly toward camera for visibility
    const vx = (Math.random() - 0.5) * 50;
    const vy = -80 - Math.random() * 60; // Falling down
    const vz = 20 + Math.random() * 40; // Moving toward camera
    star.userData.velocity.set(vx, vy, vz);

    star.userData.active = true;
    star.userData.life = 0;
    star.material.opacity = 1;
    star.material.color.setHex(0xffffaa); // Slightly golden color
  }

  updateShootingStars(delta) {
    this.shootingStarPool.forEach(star => {
      if (!star.userData.active) return;
      star.userData.life += delta;
      if (star.userData.life > 2.5) {
        star.userData.active = false;
        star.material.opacity = 0;
        return;
      }
      const positions = star.geometry.attributes.position.array;
      const trailPoints = 30; // More points for smoother trail
      const trailLength = 0.15; // How far back the trail extends in time

      for (let i = 0; i < trailPoints; i++) {
        const t = i / trailPoints;
        // Trail extends backward in time from current position
        const timeOffset = star.userData.life - t * trailLength;
        const pos = star.userData.startPos.clone().add(
          star.userData.velocity.clone().multiplyScalar(Math.max(0, timeOffset))
        );
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
      }
      star.geometry.attributes.position.needsUpdate = true;

      // Fade out over time, but stay bright initially
      const fadeStart = 1.5;
      if (star.userData.life < fadeStart) {
        star.material.opacity = 1;
      } else {
        star.material.opacity = Math.max(0, 1 - (star.userData.life - fadeStart) / 1.0);
      }
    });
  }

  update(delta, elapsed, audioData) {
    this.time = elapsed;
    const speed = this.params.speed * delta * 10;
    this.roverPosition.z -= speed;

    this.updateTerrainGeometry(this.roverPosition.z);

    // Camera following terrain
    const terrainHeightAtRover = this.getTerrainHeight(0, this.roverPosition.z);
    const sampleDist = 5;
    const terrainHeightAhead = this.getTerrainHeight(0, this.roverPosition.z - sampleDist);
    const terrainHeightLeft = this.getTerrainHeight(-sampleDist, this.roverPosition.z);
    const terrainHeightRight = this.getTerrainHeight(sampleDist, this.roverPosition.z);

    const forwardSlope = (terrainHeightAhead - terrainHeightAtRover) / sampleDist;
    const sideSlope = (terrainHeightRight - terrainHeightLeft) / (sampleDist * 2);

    // Camera mode handling
    const mode = this.params.cameraMode;

    if (mode === 'normal') {
      // Standard first-person rover view
      const targetY = terrainHeightAtRover + this.params.cameraHeight + this.terrain.position.y;
      this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 4);

      const targetPitch = Math.atan(forwardSlope) * 0.8;
      this.cameraTilt += (targetPitch - this.cameraTilt) * Math.min(1, delta * 3);

      const targetRoll = Math.atan(sideSlope) * 0.4;
      this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, delta * 3);

      this.camera.position.x = Math.sin(elapsed * 1.5) * 0.015;
      this.camera.position.y = this.cameraY + Math.sin(elapsed * 2) * 0.008;
      this.camera.rotation.x = this.cameraTilt;
      this.camera.rotation.z = this.cameraRoll + Math.sin(elapsed * 0.5) * 0.003;
      this.camera.rotation.y = 0;

    } else if (mode === 'cinematic') {
      // Smooth cinematic sweeping view
      const targetY = terrainHeightAtRover + this.params.cameraHeight * 1.5 + this.terrain.position.y;
      this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 2);

      // Gentle side-to-side pan
      this.camera.position.x = Math.sin(elapsed * 0.15) * 15;
      this.camera.position.y = this.cameraY;

      // Look slightly to the side while panning
      this.camera.rotation.y = Math.sin(elapsed * 0.15) * 0.3;
      this.camera.rotation.x = -0.1 + Math.sin(elapsed * 0.1) * 0.05;
      this.camera.rotation.z = Math.sin(elapsed * 0.2) * 0.02;

    } else if (mode === 'orbit') {
      // Orbiting view around a point ahead
      const orbitRadius = 20;
      const orbitSpeed = 0.2;
      const targetY = terrainHeightAtRover + this.params.cameraHeight * 2 + this.terrain.position.y;
      this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 3);

      this.camera.position.x = Math.sin(elapsed * orbitSpeed) * orbitRadius;
      this.camera.position.y = this.cameraY + 10;
      this.camera.position.z = Math.cos(elapsed * orbitSpeed) * orbitRadius * 0.5;

      // Look at center point ahead
      this.camera.lookAt(0, this.cameraY - 5, -20);

    } else if (mode === 'low') {
      // Low dramatic angle
      const targetY = terrainHeightAtRover + 1.5 + this.terrain.position.y;
      this.cameraY += (targetY - this.cameraY) * Math.min(1, delta * 4);

      const targetPitch = Math.atan(forwardSlope) * 0.5 - 0.1; // Look slightly up
      this.cameraTilt += (targetPitch - this.cameraTilt) * Math.min(1, delta * 3);

      this.camera.position.x = Math.sin(elapsed * 0.8) * 0.03;
      this.camera.position.y = this.cameraY;
      this.camera.rotation.x = this.cameraTilt;
      this.camera.rotation.z = Math.sin(elapsed * 0.3) * 0.01;
      this.camera.rotation.y = 0;
    }

    // Update all systems
    this.stars.material.uniforms.uTime.value = elapsed;
    this.planetRings.material.uniforms.uTime.value = elapsed;

    this.moons.forEach((moon) => {
      const d = moon.userData;
      const angle = elapsed * d.speed + d.phase;
      moon.position.set(Math.cos(angle) * d.distance, d.height + Math.sin(angle * 0.5) * 50, Math.sin(angle) * d.distance - 200);
      moon.rotation.y = elapsed * 0.01;
      moon.material.uniforms.uTime.value = elapsed;
    });

    this.nebulae.forEach(n => {
      n.material.uniforms.uTime.value = elapsed;
      if (audioData) n.material.uniforms.uAudioMid.value += (audioData.mid - n.material.uniforms.uAudioMid.value) * 0.1;
    });

    if (Math.random() < 0.02) this.spawnShootingStar();
    this.updateShootingStars(delta);

    const particlePositions = this.ambientParticles.geometry.attributes.position.array;
    for (let i = 0; i < particlePositions.length; i += 3) {
      particlePositions[i + 2] += speed;
      if (particlePositions[i + 2] > 50) particlePositions[i + 2] -= 100;
    }
    this.ambientParticles.geometry.attributes.position.needsUpdate = true;

    if (audioData) {
      this.terrain.material.uniforms.uAudioBass.value += (audioData.bass - this.terrain.material.uniforms.uAudioBass.value) * 0.1;
    } else {
      this.terrain.material.uniforms.uAudioBass.value *= 0.95;
    }
    this.terrain.material.uniforms.uTime.value = elapsed;
    this.terrain.material.uniforms.uRoverZ.value = this.roverPosition.z;

    // Update new systems
    this.updateDayNight(delta);
    if (this.params.weatherEnabled) this.updateWeather(delta, elapsed, audioData);
    if (this.params.eventsEnabled) this.updateSpaceEvents(delta, elapsed);
    if (this.params.floraEnabled) this.updateFlora(delta, elapsed, audioData);
    if (this.params.faunaEnabled) this.updateFauna(delta, elapsed);
    this.updateStructures(elapsed);
    this.updateLocalFeatures(delta, elapsed);
    this.updateAurora(delta, elapsed, audioData);
    this.updateLakes(delta, elapsed, audioData);
    this.updateClouds(delta, elapsed);
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  render(renderer) {
    if (this.composer) {
      // Update retro shader time
      if (this.retroPass) {
        this.retroPass.uniforms.uTime.value = this.time || 0;
      }
      this.composer.render();
    } else {
      renderer.render(this.scene, this.camera);
    }
  }

  setupGUI(folder) {
    folder.add(this.params, 'speed', 0.2, 3.0).name('Rover Speed');
    folder.add(this.params, 'fov', 60, 120).name('Field of View').onChange(v => {
      this.camera.fov = v;
      this.camera.updateProjectionMatrix();
    });
    folder.add(this.params, 'cameraHeight', 0.5, 10.0).name('Camera Height');
    folder.add(this.params, 'cameraMode', ['normal', 'cinematic', 'orbit', 'low']).name('Camera Mode');
    folder.add(this.params, 'terrainHeight', 2, 30).name('Terrain Height');
    folder.add(this.params, 'terrainScale', 0.00005, 0.002).name('Terrain Scale');
    folder.add(this.params, 'floraEnabled').name('Flora');
    folder.add(this.params, 'faunaEnabled').name('Fauna');
    folder.add(this.params, 'weatherEnabled').name('Auto Weather');
    folder.add(this.params, 'eventsEnabled').name('Auto Events');
    folder.add(this.params, 'nebulaIntensity', 0, 1.5).name('Nebula').onChange(v => {
      this.nebulae.forEach(n => n.material.uniforms.uIntensity.value = v);
    });
    folder.add(this.params, 'fogDensity', 0, 0.02).name('Fog').onChange(v => {
      this.scene.fog.density = v;
    });
    folder.add(this, 'dayNightSpeed', 0, 0.05).name('Day/Night Speed');
    folder.add(this, 'dayNightCycle', 0, 1).name('Time of Day').listen();

    // Bloom controls
    const bloomFolder = folder.addFolder('Bloom');
    bloomFolder.add(this.params, 'bloomStrength', 0, 2).name('Strength').onChange(v => {
      this.bloomPass.strength = v;
    });
    bloomFolder.add(this.params, 'bloomRadius', 0, 1).name('Radius').onChange(v => {
      this.bloomPass.radius = v;
    });
    bloomFolder.add(this.params, 'bloomThreshold', 0, 1).name('Threshold').onChange(v => {
      this.bloomPass.threshold = v;
    });

    // Screen effects controls (glitches happen randomly)
    const screenFolder = folder.addFolder('Screen Effects');
    screenFolder.add(this.params, 'scanlines', 0, 1).name('Base Scanlines').onChange(v => {
      this.retroPass.uniforms.uScanlines.value = v;
      this.retroPass.uniforms.uScanlineIntensity.value = v * 0.5;
    });
    screenFolder.add(this.params, 'chromaticAberration', 0, 0.02).name('Base Aberration').onChange(v => {
      this.retroPass.uniforms.uChromaticAberration.value = v;
    });
    // Manual glitch trigger for testing
    screenFolder.add({ triggerGlitch: () => {
      this.glitchActive = true;
      this.glitchTimer = 0;
      this.glitchIntensity = 0.5 + Math.random() * 0.5;
    }}, 'triggerGlitch').name('Trigger Glitch');

    // Weather controls
    const weatherFolder = folder.addFolder('Weather');
    this.manualWeather = {
      clear: () => this.setWeather('clear'),
      dust: () => this.setWeather('dust'),
      rain: () => this.setWeather('rain'),
      lightning: () => this.setWeather('lightning'),
      snow: () => this.setWeather('snow')
    };
    weatherFolder.add(this.manualWeather, 'clear').name('Clear');
    weatherFolder.add(this.manualWeather, 'dust').name('Dust Storm');
    weatherFolder.add(this.manualWeather, 'rain').name('Alien Rain');
    weatherFolder.add(this.manualWeather, 'lightning').name('Lightning');
    weatherFolder.add(this.manualWeather, 'snow').name('Snow/Ash');
    weatherFolder.add({ strike: () => this.spawnLightningBolt() }, 'strike').name('⚡ Strike!');

    // Space events controls
    const eventsFolder = folder.addFolder('Space Events');
    this.triggerEvents = {
      meteorShower: () => this.triggerMeteorShower(),
      comet: () => this.triggerComet(),
      ufo: () => this.triggerUFO(),
      supernova: () => this.triggerSupernova(),
      eclipse: () => this.triggerEclipse(),
      giantWorm: () => this.triggerGiantWorm()
    };
    eventsFolder.add(this.triggerEvents, 'meteorShower').name('Meteor Shower');
    eventsFolder.add(this.triggerEvents, 'comet').name('Comet');
    eventsFolder.add(this.triggerEvents, 'ufo').name('UFO');
    eventsFolder.add(this.triggerEvents, 'supernova').name('Supernova Flash');
    eventsFolder.add(this.triggerEvents, 'eclipse').name('Eclipse');
    eventsFolder.add(this.triggerEvents, 'giantWorm').name('Giant Worm');
  }

  // Manual weather setter
  setWeather(weather) {
    this.currentWeather = weather;
    this.weatherTimer = 0;
  }

  // Event triggers
  triggerMeteorShower() {
    // First wave - immediate burst
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.spawnShootingStar(), i * 80);
    }
    // Second wave
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.spawnShootingStar(), 1000 + i * 100);
    }
    // Third wave - trailing
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.spawnShootingStar(), 2200 + i * 150);
    }
  }

  triggerComet() {
    this.startComet();
  }

  startComet() {
    this.cometState.active = true;
    this.cometState.time = 0;
    this.cometState.duration = 12 + Math.random() * 8; // 12-20 seconds to cross sky

    // Create an arc trajectory across the sky
    // Start from one side, arc up and across, exit other side
    const startSide = Math.random() > 0.5 ? 1 : -1;
    const startX = startSide * (400 + Math.random() * 200);
    const startY = 80 + Math.random() * 100;
    const startZ = -300 - Math.random() * 200;

    const endX = -startSide * (400 + Math.random() * 200);
    const endY = 50 + Math.random() * 80;
    const endZ = -200 - Math.random() * 100;

    // Arc peak height
    const peakY = Math.max(startY, endY) + 100 + Math.random() * 150;

    this.cometState.startPos = new THREE.Vector3(startX, startY, startZ);
    this.cometState.endPos = new THREE.Vector3(endX, endY, endZ);
    this.cometState.peakY = peakY;
    this.cometState.prevPos = this.cometState.startPos.clone();

    this.comet.visible = true;
    this.comet.position.copy(this.cometState.startPos);
  }

  updateComet(delta, elapsed) {
    this.cometState.time += delta;
    const t = Math.min(this.cometState.time / this.cometState.duration, 1);

    // Smooth easing for more natural motion
    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Parabolic arc trajectory
    const arcT = t;
    const arcHeight = 4 * (arcT - arcT * arcT); // Peaks at t=0.5

    // Interpolate position along arc
    const x = this.cometState.startPos.x + (this.cometState.endPos.x - this.cometState.startPos.x) * easeT;
    const baseY = this.cometState.startPos.y + (this.cometState.endPos.y - this.cometState.startPos.y) * easeT;
    const y = baseY + arcHeight * (this.cometState.peakY - baseY);
    const z = this.cometState.startPos.z + (this.cometState.endPos.z - this.cometState.startPos.z) * easeT;

    this.comet.position.set(x, y, z);

    // Calculate velocity direction for tail
    const velocity = this.comet.position.clone().sub(this.cometState.prevPos);
    if (velocity.length() > 0.001) {
      velocity.normalize();
    } else {
      velocity.set(1, 0, 0);
    }
    this.cometState.prevPos.copy(this.comet.position);

    // Update uniforms
    this.cometNucleus.material.uniforms.uTime.value = elapsed;
    this.comet.children[1].material.uniforms.uTime.value = elapsed; // inner coma
    this.ionTail.material.uniforms.uTime.value = elapsed;
    this.dustTail.material.uniforms.uTime.value = elapsed;

    // "Sun" direction (light source for tail direction) - roughly opposite to travel
    const sunDir = new THREE.Vector3(0.5, -0.3, 0.8).normalize();

    // Update ion tail - streams straight away from sun, narrow
    const ionPositions = this.ionTail.geometry.attributes.position.array;
    const ionOffsets = this.ionTail.geometry.attributes.offset.array;
    const ionCount = ionPositions.length / 3;

    for (let i = 0; i < ionCount; i++) {
      const it = i / ionCount;
      const tailLength = it * 180; // Long ion tail
      const spread = it * 8; // Narrow spread

      // Wavy motion in the tail
      const wave = Math.sin(elapsed * 4 + it * 15 + ionOffsets[i]) * spread;
      const wave2 = Math.cos(elapsed * 3 + it * 12 + ionOffsets[i] * 2) * spread * 0.5;

      ionPositions[i * 3] = sunDir.x * tailLength + wave;
      ionPositions[i * 3 + 1] = sunDir.y * tailLength + wave2;
      ionPositions[i * 3 + 2] = sunDir.z * tailLength + wave * 0.3;
    }
    this.ionTail.geometry.attributes.position.needsUpdate = true;

    // Update dust tail - curves away, influenced by both sun and velocity, wider
    const dustPositions = this.dustTail.geometry.attributes.position.array;
    const dustOffsets = this.dustTail.geometry.attributes.offset.array;
    const dustCount = dustPositions.length / 3;

    // Dust tail curves between velocity direction and sun direction
    const dustDir = sunDir.clone().lerp(velocity.clone().negate(), 0.4).normalize();

    for (let i = 0; i < dustCount; i++) {
      const dt = i / dustCount;
      const tailLength = dt * 120; // Shorter than ion tail
      const spread = dt * dt * 25; // Wider spread that increases along length

      // Curve the tail
      const curveFactor = dt * dt * 30;
      const curveOffset = new THREE.Vector3(
        velocity.x * curveFactor,
        velocity.y * curveFactor * 0.5 - dt * 10, // Slight droop
        velocity.z * curveFactor
      );

      // Particle scatter
      const scatter = Math.sin(elapsed * 2 + dt * 20 + dustOffsets[i]) * spread;
      const scatter2 = Math.cos(elapsed * 2.5 + dt * 18 + dustOffsets[i] * 1.5) * spread * 0.7;

      dustPositions[i * 3] = dustDir.x * tailLength + curveOffset.x + scatter;
      dustPositions[i * 3 + 1] = dustDir.y * tailLength + curveOffset.y + scatter2;
      dustPositions[i * 3 + 2] = dustDir.z * tailLength + curveOffset.z + scatter * 0.5;
    }
    this.dustTail.geometry.attributes.position.needsUpdate = true;

    // End comet when it completes trajectory
    if (t >= 1) {
      this.cometState.active = false;
      this.comet.visible = false;
    }
  }

  triggerUFO() {
    this.ufoState.active = true;
    this.ufoState.time = 0;
    this.ufo.visible = true;
    this.ufo.position.set(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      -100 - Math.random() * 100
    );
  }

  triggerSupernova() {
    this.supernovaFlash = 1;
  }

  triggerEclipse() {
    if (this.moons.length >= 2) {
      this.eclipseActive = true;
      this.eclipseProgress = 0;
    }
  }

  triggerGiantWorm() {
    this.wormState.active = true;
    this.wormState.time = 0;
    this.wormState.x = (Math.random() - 0.5) * 60;
    this.wormState.z = -30 - Math.random() * 30;
    this.worm.visible = true;
  }
}

import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { SimplexNoise } from './SimplexNoise.js';

/**
 * SkySystem - Handles stars, nebulae, moons, gas planet, aurora, and space effects
 */
export class SkySystem {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.noise = new SimplexNoise(config.seed || Date.now());

    this.config = {
      starDensity: config.starDensity ?? 5000,
      nebulaIntensity: config.nebulaIntensity ?? 0.5,
      moonCount: config.moonCount ?? 6,
      showGasPlanet: config.showGasPlanet ?? true,
      showAurora: config.showAurora ?? true,
      showPulsars: config.showPulsars ?? true,
      showSun: config.showSun ?? false,
      showClouds: config.showClouds ?? false,
      cloudCoverage: config.cloudCoverage ?? 0.5,
      cloudSpeed: config.cloudSpeed ?? 0.02,
      skyType: config.skyType || 'space',
      ...config
    };

    // Components
    this.stars = null;
    this.nebulae = [];
    this.moons = [];
    this.sun = null;
    this.gasPlanet = null;
    this.planetRings = null;
    this.auroraCurtains = [];
    this.shootingStarPool = [];
    this.pulsars = [];

    // Day/night state (passed in from update)
    this.dayNightCycle = 0.5; // 0-1, 0.5 = noon, 0 or 1 = midnight
    this.starOpacity = 1.0;

    // State
    this.gasPlanetOrbit = { angle: 0, speed: 0.003, radius: 500, centerY: 200 };

    // Flare textures
    this.flareTextures = null;
  }

  create() {
    this.createLensflareTextures();

    // Stars - only if density > 0
    if (this.config.starDensity > 0) {
      this.createStars();
    }

    // Nebulae - only if intensity > 0
    if (this.config.nebulaIntensity > 0) {
      this.createNebulae();
    }

    // Sun (for terrestrial sky types)
    if (this.config.showSun) {
      this.createSun();
    }

    // Moons
    if (this.config.moonCount > 0) {
      this.createMoons();
    }

    // Gas planet and rings
    if (this.config.showGasPlanet) {
      this.createGasPlanet();
      this.createPlanetaryRings();
    }

    // Shooting stars - only in space-like skies
    if (this.config.skyType === 'space' || this.config.skyType === 'twilight') {
      this.createShootingStarSystem();
    }

    // Aurora
    if (this.config.showAurora) {
      this.createAurora();
    }

    // Pulsars
    if (this.config.showPulsars) {
      this.createPulsars();
    }

    // Distant mountains - not for underwater
    if (this.config.skyType !== 'underwater') {
      this.createDistantMountains();
    }
  }

  createLensflareTextures() {
    const createFlareTexture = (size, type) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const center = size / 2;

      if (type === 'main') {
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 250, 230, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 200, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 150, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      } else if (type === 'ring') {
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

      return new THREE.CanvasTexture(canvas);
    };

    this.flareTextures = {
      main: createFlareTexture(256, 'main'),
      ring: createFlareTexture(128, 'ring'),
      hex: createFlareTexture(64, 'hex')
    };
  }

  createStars() {
    const geometry = new THREE.BufferGeometry();
    const starCount = this.config.starDensity;
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

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1.0 }
      },
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
        uniform float uOpacity;
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * uOpacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  createNebulae() {
    const geometry = new THREE.PlaneGeometry(600, 400);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: this.config.nebulaIntensity },
        uAudioMid: { value: 0 }
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime, uIntensity, uAudioMid;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot * p * 2.0; a *= 0.5; }
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

    const nebula1 = new THREE.Mesh(geometry, material);
    nebula1.position.set(200, 250, -400);
    nebula1.rotation.y = -0.3;
    this.scene.add(nebula1);

    const nebula2 = new THREE.Mesh(geometry, material.clone());
    nebula2.position.set(-300, 200, -350);
    nebula2.rotation.y = 0.4;
    this.scene.add(nebula2);

    this.nebulae = [nebula1, nebula2];
  }

  createMoons() {
    const moonData = [
      { size: 30, distance: 400, color: 0xccbbaa, speed: 0.0001, height: 200, phase: 0 },
      { size: 15, distance: 300, color: 0xaabbcc, speed: 0.0003, height: 150, phase: Math.PI },
      { size: 8, distance: 250, color: 0xffccaa, speed: 0.0005, height: 100, phase: Math.PI / 2 },
      { size: 5, distance: 180, color: 0x888899, speed: 0.0008, height: 90, phase: 0.5 },
      { size: 3, distance: 350, color: 0x999988, speed: 0.001, height: 220, phase: 1.2 },
      { size: 2, distance: 220, color: 0x777788, speed: 0.0015, height: 130, phase: 2.5 }
    ];

    moonData.slice(0, this.config.moonCount).forEach((data) => {
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

      // Add lens flare
      const flareColor = new THREE.Color(data.color);
      const lensflare = new Lensflare();
      const flareSize = data.size * 3;
      lensflare.addElement(new LensflareElement(this.flareTextures.main, flareSize * 2, 0, flareColor));
      lensflare.addElement(new LensflareElement(this.flareTextures.ring, flareSize * 4, 0));
      lensflare.addElement(new LensflareElement(this.flareTextures.hex, flareSize * 0.5, 0.6));
      moon.add(lensflare);

      this.moons.push(moon);
      this.scene.add(moon);
    });
  }

  createSun() {
    const sunGeom = new THREE.SphereGeometry(50, 32, 32);
    const sunMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 }
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
        uniform float uIntensity;
        varying vec3 vNormal;
        void main() {
          float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
          vec3 coreColor = vec3(1.0, 0.98, 0.9);
          vec3 edgeColor = vec3(1.0, 0.7, 0.3);
          vec3 color = mix(coreColor, edgeColor, pow(rim, 0.5));
          float corona = pow(rim, 3.0) * 2.0;
          color += vec3(1.0, 0.6, 0.2) * corona;
          gl_FragColor = vec4(color * uIntensity, 1.0);
        }
      `,
      blending: THREE.AdditiveBlending
    });

    this.sun = new THREE.Mesh(sunGeom, sunMat);
    this.sun.position.set(0, 300, -500); // Will be updated based on day/night

    // Sun lens flare
    const sunFlare = new Lensflare();
    const sunColor = new THREE.Color(1.0, 0.95, 0.8);
    sunFlare.addElement(new LensflareElement(this.flareTextures.main, 700, 0, sunColor));
    sunFlare.addElement(new LensflareElement(this.flareTextures.ring, 300, 0.1));
    sunFlare.addElement(new LensflareElement(this.flareTextures.hex, 100, 0.3));
    this.sun.add(sunFlare);

    this.scene.add(this.sun);
  }

  createGasPlanet() {
    const geometry = new THREE.SphereGeometry(120, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
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
          float bands = sin(vUv.y * 30.0 + uTime * 0.02) * 0.5 + 0.5;
          bands += sin(vUv.y * 60.0 - uTime * 0.01) * 0.2;
          bands += sin(vUv.y * 15.0 + vUv.x * 5.0) * 0.1;
          float spot = smoothstep(0.1, 0.0, length(vUv - vec2(0.3, 0.6)) - 0.05);
          vec3 color1 = vec3(0.6, 0.4, 0.3);
          vec3 color2 = vec3(0.8, 0.7, 0.5);
          vec3 color3 = vec3(0.5, 0.3, 0.2);
          vec3 color = mix(color1, color2, bands);
          color = mix(color, color3, sin(vUv.y * 45.0) * 0.3 + 0.3);
          color = mix(color, vec3(0.8, 0.4, 0.3), spot);
          vec3 lightDir = normalize(vec3(1.0, 0.5, 0.5));
          float light = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
          color *= light;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.gasPlanet = new THREE.Mesh(geometry, material);
    this.gasPlanet.position.set(400, 200, -600);

    // Add lens flare
    const planetFlare = new Lensflare();
    const planetColor = new THREE.Color(0.9, 0.7, 0.5);
    planetFlare.addElement(new LensflareElement(this.flareTextures.main, 400, 0, planetColor));
    planetFlare.addElement(new LensflareElement(this.flareTextures.ring, 600, 0));
    planetFlare.addElement(new LensflareElement(this.flareTextures.hex, 80, 0.5));
    this.gasPlanet.add(planetFlare);

    this.scene.add(this.gasPlanet);
  }

  createPlanetaryRings() {
    const geometry = new THREE.RingGeometry(150, 250, 128);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
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
          float bands = sin(r * 80.0) * 0.5 + 0.5;
          bands *= sin(r * 200.0) * 0.3 + 0.7;
          bands *= sin(r * 40.0 + 0.5) * 0.2 + 0.8;
          float gap1 = smoothstep(0.58, 0.6, r) * smoothstep(0.65, 0.63, r);
          bands *= 1.0 - gap1 * 0.7;
          vec3 color = mix(vec3(0.6, 0.5, 0.4), vec3(0.8, 0.7, 0.6), bands);
          float alpha = smoothstep(0.35, 0.45, r) * smoothstep(1.0, 0.85, r) * 0.6;
          alpha *= bands * 0.5 + 0.5;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.planetRings = new THREE.Mesh(geometry, material);
    this.planetRings.position.copy(this.gasPlanet.position);
    this.planetRings.rotation.x = Math.PI * 0.35;
    this.scene.add(this.planetRings);
  }

  createShootingStarSystem() {
    for (let i = 0; i < 20; i++) {
      const geometry = new THREE.BufferGeometry();
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

  createAurora() {
    const geometry = new THREE.SphereGeometry(500, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.5);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uAudioBass: { value: 0 },
        uAudioMid: { value: 0 },
        uAudioTreble: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vWave;
        uniform float uTime;
        void main() {
          vUv = uv;
          vPosition = position;
          vWave = sin(position.x * 0.015 + uTime * 0.2) * cos(position.z * 0.01) * 0.1;
          vec3 pos = position;
          pos.y += sin(pos.x * 0.02 + uTime * 0.3) * 15.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uAudioBass;
        uniform float uAudioMid;
        uniform float uAudioTreble;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vWave;

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          vec2 worldUV = vPosition.xz * 0.002;
          float bands = sin(worldUV.x * 10.0 + uTime * 0.1) * 0.5 + 0.5;
          bands *= sin(worldUV.x * 5.0 - uTime * 0.05 + worldUV.y * 2.0) * 0.5 + 0.5;
          float flow = sin(worldUV.x * 3.0 + worldUV.y * 2.0 + uTime * 0.08) * 0.5 + 0.5;
          float shimmer = pow(sin(worldUV.x * 50.0 + worldUV.y * 30.0 + uTime * 0.5) * 0.5 + 0.5, 4.0) * 0.5;
          float hue = 0.35 + sin(worldUV.x * 2.0 + uTime * 0.03) * 0.15 + vWave;
          float brightness = 0.5 + bands * 0.3 + shimmer + uAudioBass * 0.3;
          vec3 color = hsv2rgb(vec3(fract(hue), 0.6 + uAudioTreble * 0.2, brightness));
          float alpha = bands * flow * (sin(worldUV.x * 30.0 + uTime * 0.2) * 0.3 + 0.7) * uIntensity;
          alpha *= smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
          gl_FragColor = vec4(color, clamp(alpha * 0.3, 0.0, 0.6));
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

  createPulsars() {
    const pulsarCount = 5;

    for (let i = 0; i < pulsarCount; i++) {
      const pulsar = new THREE.Mesh(
        new THREE.SphereGeometry(2, 8, 8),
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uPhase: { value: Math.random() * Math.PI * 2 },
            uFrequency: { value: 3 + Math.random() * 7 },
            uColor: { value: new THREE.Color().setHSL(Math.random(), 0.6, 0.8) }
          },
          vertexShader: `
            void main() {
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float uTime;
            uniform float uPhase;
            uniform float uFrequency;
            uniform vec3 uColor;
            void main() {
              float pulse = step(0.75, sin(uTime * uFrequency + uPhase));
              vec3 color = uColor * pulse * 2.5;
              gl_FragColor = vec4(color, pulse * 0.9);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.35;
      pulsar.position.set(
        Math.sin(phi) * Math.cos(theta) * 700,
        Math.cos(phi) * 500 + 150,
        Math.sin(phi) * Math.sin(theta) * 700 - 200
      );

      this.scene.add(pulsar);
      this.pulsars.push(pulsar);
    }
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

  spawnShootingStar(bright = false) {
    const star = this.shootingStarPool.find(s => !s.userData.active);
    if (!star) return;

    star.userData.active = true;
    star.userData.life = 0;
    star.userData.bright = bright;

    const startX = (Math.random() - 0.5) * 600;
    const startY = 150 + Math.random() * 200;
    const startZ = -200 - Math.random() * 300;

    star.userData.startPos.set(startX, startY, startZ);
    star.userData.velocity.set(
      (Math.random() - 0.5) * 100,
      -50 - Math.random() * 50,
      50 + Math.random() * 50
    );

    star.material.opacity = bright ? 1.0 : 0.7;
    star.material.color.setHex(bright ? 0xffffff : 0xffffcc);
  }

  updateShootingStars(delta) {
    this.shootingStarPool.forEach(star => {
      if (!star.userData.active) return;

      star.userData.life += delta;
      const maxLife = star.userData.bright ? 2.5 : 1.5;

      if (star.userData.life > maxLife) {
        star.userData.active = false;
        star.material.opacity = 0;
        return;
      }

      const positions = star.geometry.attributes.position.array;
      const trailLength = star.userData.bright ? 30 : 20;

      for (let i = 0; i < 30; i++) {
        const t = i / 30;
        const trailFactor = t * trailLength;
        positions[i * 3] = star.userData.startPos.x + star.userData.velocity.x * star.userData.life - star.userData.velocity.x * trailFactor * 0.05;
        positions[i * 3 + 1] = star.userData.startPos.y + star.userData.velocity.y * star.userData.life - star.userData.velocity.y * trailFactor * 0.05;
        positions[i * 3 + 2] = star.userData.startPos.z + star.userData.velocity.z * star.userData.life - star.userData.velocity.z * trailFactor * 0.05;
      }
      star.geometry.attributes.position.needsUpdate = true;

      const fadeStart = maxLife * 0.5;
      if (star.userData.life > fadeStart) {
        star.material.opacity = (1 - (star.userData.life - fadeStart) / (maxLife - fadeStart)) * (star.userData.bright ? 1.0 : 0.7);
      }
    });
  }

  update(delta, elapsed, audioData, dayNightCycle = null) {
    // Update day/night cycle if provided
    if (dayNightCycle !== null) {
      this.dayNightCycle = dayNightCycle;
    }

    // Calculate sun height (-1 to 1, positive = day)
    // Shift by -0.25 so: cycle 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
    const sunAngle = (this.dayNightCycle - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);

    // Update sun position and visibility
    if (this.sun) {
      const sunDistance = 600;
      const sunX = Math.cos(sunAngle) * sunDistance * 0.3;
      const sunY = sunHeight * 400 + 100;
      const sunZ = -Math.abs(Math.cos(sunAngle)) * sunDistance - 200;
      this.sun.position.set(sunX, sunY, sunZ);

      // Fade sun near horizon
      const sunIntensity = Math.max(0, sunHeight + 0.1);
      this.sun.material.uniforms.uIntensity.value = sunIntensity;
      this.sun.visible = sunHeight > -0.2;
    }

    // Stars fade based on daylight (only for terrestrial skies)
    if (this.stars) {
      this.stars.material.uniforms.uTime.value = elapsed;

      if (this.config.skyType === 'terrestrial') {
        // Fade stars during day
        const targetOpacity = sunHeight > 0.1 ? 0 : sunHeight > -0.2 ? (0.1 - sunHeight) / 0.3 : 1;
        this.starOpacity += (targetOpacity - this.starOpacity) * delta * 2;
        this.stars.material.uniforms.uOpacity.value = this.starOpacity;
      }
    }

    // Gas planet orbital motion
    if (this.gasPlanet) {
      this.gasPlanetOrbit.angle += delta * this.gasPlanetOrbit.speed;
      const gAngle = this.gasPlanetOrbit.angle;
      this.gasPlanet.position.set(
        Math.cos(gAngle) * this.gasPlanetOrbit.radius + 300,
        this.gasPlanetOrbit.centerY + Math.sin(gAngle * 0.5) * 40,
        Math.sin(gAngle) * this.gasPlanetOrbit.radius * 0.4 - 500
      );
      this.gasPlanet.material.uniforms.uTime.value = elapsed;

      if (this.planetRings) {
        this.planetRings.position.copy(this.gasPlanet.position);
        this.planetRings.rotation.z += delta * 0.008;
        this.planetRings.material.uniforms.uTime.value = elapsed;
      }
    }

    // Moons
    this.moons.forEach((moon) => {
      const d = moon.userData;
      const angle = elapsed * d.speed + d.phase;
      moon.position.set(Math.cos(angle) * d.distance, d.height + Math.sin(angle * 0.5) * 50, Math.sin(angle) * d.distance - 200);
      moon.rotation.y = elapsed * 0.01;
      moon.material.uniforms.uTime.value = elapsed;
    });

    // Nebulae
    this.nebulae.forEach(n => {
      n.material.uniforms.uTime.value = elapsed;
      if (audioData) {
        n.material.uniforms.uAudioMid.value += (audioData.mid - n.material.uniforms.uAudioMid.value) * 0.1;
      }
    });

    // Shooting stars (only if pool exists)
    if (this.shootingStarPool.length > 0) {
      if (Math.random() < 0.04) this.spawnShootingStar(Math.random() > 0.7);
      this.updateShootingStars(delta);
    }

    // Aurora
    this.auroraCurtains.forEach((curtain) => {
      curtain.material.uniforms.uTime.value = elapsed;
      if (audioData) {
        curtain.material.uniforms.uAudioBass.value += (audioData.bass - curtain.material.uniforms.uAudioBass.value) * 0.15;
        curtain.material.uniforms.uAudioMid.value += (audioData.mid - curtain.material.uniforms.uAudioMid.value) * 0.15;
        curtain.material.uniforms.uAudioTreble.value += (audioData.treble - curtain.material.uniforms.uAudioTreble.value) * 0.15;
      } else {
        curtain.material.uniforms.uAudioBass.value *= 0.95;
        curtain.material.uniforms.uAudioMid.value *= 0.95;
        curtain.material.uniforms.uAudioTreble.value *= 0.95;
      }
      curtain.rotation.y += delta * 0.005;
    });

    // Pulsars
    this.pulsars.forEach(pulsar => {
      pulsar.material.uniforms.uTime.value = elapsed;
    });
  }

  setNebulaIntensity(value) {
    this.nebulae.forEach(n => {
      n.material.uniforms.uIntensity.value = value;
    });
  }

  setAuroraIntensity(value) {
    this.auroraCurtains.forEach(curtain => {
      curtain.material.uniforms.uIntensity.value = value;
    });
  }

  triggerMeteorShower() {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.spawnShootingStar(true), i * 80);
    }
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.spawnShootingStar(), 1000 + i * 100);
    }
  }

  dispose() {
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.stars = null;
    }
    this.nebulae.forEach(n => {
      this.scene.remove(n);
      n.geometry.dispose();
      n.material.dispose();
    });
    this.nebulae = [];

    this.moons.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    this.moons = [];

    if (this.sun) {
      this.scene.remove(this.sun);
      this.sun.geometry.dispose();
      this.sun.material.dispose();
      this.sun = null;
    }
    if (this.gasPlanet) {
      this.scene.remove(this.gasPlanet);
      this.gasPlanet.geometry.dispose();
      this.gasPlanet.material.dispose();
      this.gasPlanet = null;
    }
    if (this.planetRings) {
      this.scene.remove(this.planetRings);
      this.planetRings.geometry.dispose();
      this.planetRings.material.dispose();
      this.planetRings = null;
    }

    this.auroraCurtains.forEach(a => {
      this.scene.remove(a);
      a.geometry.dispose();
      a.material.dispose();
    });
    this.auroraCurtains = [];

    this.shootingStarPool.forEach(s => {
      this.scene.remove(s);
      s.geometry.dispose();
      s.material.dispose();
    });
    this.shootingStarPool = [];

    this.pulsars.forEach(p => {
      this.scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    });
    this.pulsars = [];
  }
}

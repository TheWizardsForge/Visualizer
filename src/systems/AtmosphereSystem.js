import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

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

      // Glitch effect
      if (uGlitch > 0.0) {
        float glitchLine = step(0.99, fract(sin(floor(uv.y * 50.0) + uTime * 100.0) * 43758.5453));
        uv.x += glitchLine * uGlitch * 0.1 * sin(uTime * 500.0);
        float block = step(0.98, fract(sin(floor(uv.y * 20.0 + uTime * 50.0) * 12.9898) * 43758.5453));
        uv.x += block * uGlitch * 0.05;
      }

      // Underwater distortion
      if (uUnderwater > 0.0) {
        uv.x += sin(uv.y * 20.0 + uTime * 3.0) * 0.01 * uUnderwater;
        uv.y += sin(uv.x * 15.0 + uTime * 2.0) * 0.008 * uUnderwater;
      }

      // Chromatic aberration
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

        // Bubbles
        float bubbles = step(0.995, fract(sin(dot(uv * 100.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453));
        color += vec3(0.3, 0.4, 0.5) * bubbles * uUnderwater;
      }

      // Scanlines
      float scanlineAmount = uScanlines + uGlitch * 0.5;
      if (scanlineAmount > 0.0) {
        float scanline = sin(uv.y * 800.0) * 0.5 + 0.5;
        scanline = pow(scanline, 1.5);
        color *= 1.0 - scanline * uScanlineIntensity * scanlineAmount;
        float interference = sin(uv.y * 200.0 + uTime * 10.0) * 0.5 + 0.5;
        interference *= sin(uv.y * 50.0 - uTime * 5.0) * 0.5 + 0.5;
        color *= 1.0 - interference * scanlineAmount * 0.1;
      }

      // Screen flicker
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

/**
 * AtmosphereSystem - Handles fog, bloom, post-processing, day/night, and weather
 */
export class AtmosphereSystem {
  constructor(scene, camera, renderer, config = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.config = {
      fogDensity: config.fogDensity ?? 0.006,
      fogColor: config.fogColor ?? 0x0a0a15,
      nightFogColor: config.nightFogColor ?? null, // If null, uses fogColor always
      skyColor: config.skyColor ?? 0x000008,
      nightSkyColor: config.nightSkyColor ?? null, // If null, uses skyColor always
      bloomStrength: config.bloomStrength ?? 0.3,
      bloomRadius: config.bloomRadius ?? 0.3,
      bloomThreshold: config.bloomThreshold ?? 0.6,
      scanlines: config.scanlines ?? 0.0,
      chromaticAberration: config.chromaticAberration ?? 0.0,
      vignette: config.vignette ?? 0.0,
      ...config
    };

    // Color objects for lerping
    this.daySkyColor = new THREE.Color(this.config.skyColor);
    this.nightSkyColor = new THREE.Color(this.config.nightSkyColor || this.config.skyColor);
    this.dayFogColor = new THREE.Color(this.config.fogColor);
    this.nightFogColor = new THREE.Color(this.config.nightFogColor || this.config.fogColor);

    // Post-processing
    this.composer = null;
    this.bloomPass = null;
    this.retroPass = null;

    // Day/night state
    this.dayNightCycle = 0.75; // Start at night
    this.dayNightSpeed = 0.01;
    this.sunBrightness = 0; // Exposed for other systems (0 = night, 1 = noon)

    // Weather state
    this.currentWeather = 'clear';
    this.weatherTimer = 0;
    this.weatherParticles = {
      dust: null,
      rain: null,
      snow: null
    };
    this.lightning = { flash: 0, timer: 0 };

    // Glitch state
    this.glitchTimer = 0;
    this.glitchActive = false;
    this.glitchIntensity = 0;

    // Underwater state
    this.isUnderwater = false;
    this.underwaterDepth = 0;
  }

  create() {
    // Setup fog
    this.scene.fog = new THREE.FogExp2(this.config.fogColor, this.config.fogDensity);
    this.scene.background = new THREE.Color(this.config.skyColor);

    // Setup post-processing
    this.setupPostProcessing();

    // Create weather particle systems
    this.createWeatherSystems();
  }

  setupPostProcessing() {
    const renderScene = new RenderPass(this.scene, this.camera);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.config.bloomStrength,
      this.config.bloomRadius,
      this.config.bloomThreshold
    );

    this.retroPass = new ShaderPass(RetroShader);
    this.retroPass.uniforms.uScanlines.value = this.config.scanlines;
    this.retroPass.uniforms.uChromaticAberration.value = this.config.chromaticAberration;
    this.retroPass.uniforms.uVignette.value = this.config.vignette;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.retroPass);
  }

  createWeatherSystems() {
    // Dust storm particles
    const dustGeom = new THREE.BufferGeometry();
    const dustCount = 3000;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPositions[i] = (Math.random() - 0.5) * 200;
      dustPositions[i + 1] = Math.random() * 30;
      dustPositions[i + 2] = (Math.random() - 0.5) * 200;
    }
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        void main() {
          vec3 pos = position;
          pos.x += sin(uTime + position.y * 0.5) * 2.0;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 3.0 * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * uOpacity;
          gl_FragColor = vec4(0.7, 0.6, 0.5, alpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    this.weatherParticles.dust = new THREE.Points(dustGeom, dustMat);
    this.scene.add(this.weatherParticles.dust);

    // Rain particles
    const rainGeom = new THREE.BufferGeometry();
    const rainCount = 5000;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPositions[i] = (Math.random() - 0.5) * 100;
      rainPositions[i + 1] = Math.random() * 50;
      rainPositions[i + 2] = (Math.random() - 0.5) * 100;
    }
    rainGeom.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 4.0 * (50.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float alpha = (1.0 - abs(uv.y) * 2.0) * uOpacity * 0.5;
          gl_FragColor = vec4(0.6, 0.7, 0.9, alpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    this.weatherParticles.rain = new THREE.Points(rainGeom, rainMat);
    this.scene.add(this.weatherParticles.rain);

    // Snow particles
    const snowGeom = new THREE.BufferGeometry();
    const snowCount = 2000;
    const snowPositions = new Float32Array(snowCount * 3);
    const snowRotations = new Float32Array(snowCount);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 100;
      snowPositions[i * 3 + 1] = Math.random() * 40;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      snowRotations[i] = Math.random() * Math.PI * 2;
    }
    snowGeom.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    snowGeom.setAttribute('rotation', new THREE.BufferAttribute(snowRotations, 1));
    const snowMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        attribute float rotation;
        varying float vRotation;
        void main() {
          vRotation = rotation;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 5.0 * (50.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vRotation;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float c = cos(vRotation), s = sin(vRotation);
          uv = mat2(c, -s, s, c) * uv;
          float shape = smoothstep(0.5, 0.3, length(uv));
          shape *= smoothstep(0.5, 0.2, abs(uv.x) + abs(uv.y));
          gl_FragColor = vec4(0.9, 0.95, 1.0, shape * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    this.weatherParticles.snow = new THREE.Points(snowGeom, snowMat);
    this.scene.add(this.weatherParticles.snow);
  }

  update(delta, elapsed, audioData) {
    this.updateDayNight(delta);
    this.updateWeather(delta, elapsed, audioData);
    this.updateGlitch(delta);
    this.updateUnderwater();

    // Update retro shader time
    if (this.retroPass) {
      this.retroPass.uniforms.uTime.value = elapsed;
    }
  }

  updateDayNight(delta) {
    this.dayNightCycle = (this.dayNightCycle + delta * this.dayNightSpeed) % 1;

    const sunAngle = this.dayNightCycle * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);

    // Expose sun brightness for other systems (0 at night, 1 at noon)
    this.sunBrightness = Math.max(0, sunHeight);

    // Check if we have distinct day/night colors (terrestrial mode)
    const hasDayNightColors = this.config.nightSkyColor !== null;

    let skyColor, fogColor;

    if (hasDayNightColors) {
      // Terrestrial sky - lerp between day and night colors
      // sunHeight: -1 (midnight) to 1 (noon)
      const dayAmount = (sunHeight + 1) / 2; // 0 at midnight, 1 at noon

      // Add sunrise/sunset tints
      const sunsetColor = new THREE.Color(0xff6633);
      const sunriseColor = new THREE.Color(0xffaa66);

      skyColor = this.nightSkyColor.clone().lerp(this.daySkyColor, dayAmount);
      fogColor = this.nightFogColor.clone().lerp(this.dayFogColor, dayAmount);

      // Add sunset/sunrise tint near horizon
      if (sunHeight > -0.3 && sunHeight < 0.3) {
        const horizonAmount = 1 - Math.abs(sunHeight) / 0.3;
        const tintColor = this.dayNightCycle < 0.5 ? sunsetColor : sunriseColor;
        skyColor.lerp(tintColor, horizonAmount * 0.3);
        fogColor.lerp(tintColor, horizonAmount * 0.2);
      }
    } else {
      // Space/alien sky - subtle variations only
      const nightColor = new THREE.Color(this.config.skyColor);
      const dayColor = nightColor.clone().multiplyScalar(1.3);
      const sunsetColor = new THREE.Color(0x2a1525);

      if (sunHeight > 0.3) {
        skyColor = dayColor.clone();
      } else if (sunHeight > 0) {
        const t = sunHeight / 0.3;
        skyColor = sunsetColor.clone().lerp(dayColor, t);
      } else if (sunHeight > -0.3) {
        const t = (sunHeight + 0.3) / 0.3;
        skyColor = nightColor.clone().lerp(sunsetColor, t);
      } else {
        skyColor = nightColor.clone();
      }

      fogColor = skyColor.clone().multiplyScalar(1.5);
    }

    if (this.currentWeather === 'clear') {
      this.scene.background.copy(skyColor);
    }

    this.scene.fog.color.copy(fogColor);
  }

  updateWeather(delta, elapsed, audioData) {
    this.weatherTimer += delta;

    // Auto weather changes (optional)
    const bassTriggered = (audioData?.bass || 0) > 0.8 && Math.random() < 0.001;
    if ((this.weatherTimer > 30 && Math.random() < 0.001) || bassTriggered) {
      const weathers = ['clear', 'dust', 'rain', 'lightning', 'snow'];
      const newWeather = weathers[Math.floor(Math.random() * weathers.length)];
      if (newWeather !== this.currentWeather) {
        this.currentWeather = newWeather;
        this.weatherTimer = 0;
      }
    }

    // Update particle opacities
    const dustTarget = this.currentWeather === 'dust' ? 0.8 : 0;
    const rainTarget = this.currentWeather === 'rain' || this.currentWeather === 'lightning' ? 1.0 : 0;
    const snowTarget = this.currentWeather === 'snow' ? 0.8 : 0;

    const dustOpacity = this.weatherParticles.dust.material.uniforms.uOpacity;
    const rainOpacity = this.weatherParticles.rain.material.uniforms.uOpacity;
    const snowOpacity = this.weatherParticles.snow.material.uniforms.uOpacity;

    dustOpacity.value += (dustTarget - dustOpacity.value) * delta * 2;
    rainOpacity.value += (rainTarget - rainOpacity.value) * delta * 2;
    snowOpacity.value += (snowTarget - snowOpacity.value) * delta * 2;

    // Update dust storm
    if (dustOpacity.value > 0.01) {
      this.weatherParticles.dust.material.uniforms.uTime.value = elapsed;
      const positions = this.weatherParticles.dust.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += delta * 25;
        positions[i + 1] += Math.sin(elapsed * 2 + positions[i] * 0.1) * delta * 3;
        if (positions[i] > 100) positions[i] -= 200;
      }
      this.weatherParticles.dust.geometry.attributes.position.needsUpdate = true;
    }

    // Update rain
    if (rainOpacity.value > 0.01) {
      const positions = this.weatherParticles.rain.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= delta * 50;
        positions[i] += delta * 3;
        if (positions[i + 1] < 0) {
          positions[i + 1] += 50;
          positions[i] = (Math.random() - 0.5) * 100;
        }
      }
      this.weatherParticles.rain.geometry.attributes.position.needsUpdate = true;
    }

    // Update snow
    if (snowOpacity.value > 0.01) {
      this.weatherParticles.snow.material.uniforms.uTime.value = elapsed;
      const positions = this.weatherParticles.snow.geometry.attributes.position.array;
      const rotations = this.weatherParticles.snow.geometry.attributes.rotation.array;
      for (let i = 0; i < positions.length / 3; i++) {
        const idx = i * 3;
        positions[idx] += Math.sin(elapsed * 0.5 + i * 0.1) * delta * 3;
        positions[idx + 1] -= delta * 4;
        positions[idx + 2] += Math.cos(elapsed * 0.3 + i * 0.15) * delta * 2;
        rotations[i] += delta * (0.5 + Math.sin(i) * 0.3);
        if (positions[idx + 1] < 0) {
          positions[idx + 1] += 40;
          positions[idx] = (Math.random() - 0.5) * 100;
          positions[idx + 2] = (Math.random() - 0.5) * 100;
        }
      }
      this.weatherParticles.snow.geometry.attributes.position.needsUpdate = true;
      this.weatherParticles.snow.geometry.attributes.rotation.needsUpdate = true;
    }

    // Lightning
    if (this.currentWeather === 'lightning') {
      this.lightning.timer += delta;
      if (this.lightning.timer > 2 + Math.random() * 5) {
        this.lightning.flash = 1;
        this.lightning.timer = 0;
      }
      if (this.lightning.flash > 0) {
        this.lightning.flash -= delta * 5;
        this.scene.background.setRGB(
          0.02 + this.lightning.flash * 0.6,
          0.02 + this.lightning.flash * 0.6,
          0.1 + this.lightning.flash * 0.6
        );
      }
    }
  }

  updateGlitch(delta) {
    this.glitchTimer += delta;

    if (!this.glitchActive && this.glitchTimer > 10 + Math.random() * 30) {
      this.glitchActive = true;
      this.glitchTimer = 0;
      this.glitchIntensity = 0.3 + Math.random() * 0.7;
    }

    if (this.glitchActive) {
      if (this.glitchTimer > 0.1 + Math.random() * 0.4) {
        this.glitchActive = false;
        this.glitchTimer = 0;
        this.glitchIntensity = 0;
      }
    }

    if (this.retroPass) {
      const targetGlitch = this.glitchActive ? this.glitchIntensity : 0;
      this.retroPass.uniforms.uGlitch.value += (targetGlitch - this.retroPass.uniforms.uGlitch.value) * 0.3;
    }
  }

  updateUnderwater() {
    if (this.retroPass) {
      const targetUnderwater = this.isUnderwater ? this.underwaterDepth : 0;
      this.retroPass.uniforms.uUnderwater.value += (targetUnderwater - this.retroPass.uniforms.uUnderwater.value) * 0.1;
    }
  }

  setUnderwater(isUnderwater, depth = 0) {
    this.isUnderwater = isUnderwater;
    this.underwaterDepth = depth;

    // Immediately set the uniform to 0 when disabling underwater
    // to prevent caustics from lingering
    if (!isUnderwater && this.retroPass) {
      this.retroPass.uniforms.uUnderwater.value = 0;
    }
  }

  setWeather(weather) {
    this.currentWeather = weather;
    this.weatherTimer = 0;
  }

  triggerGlitch(intensity = 0.5) {
    this.glitchActive = true;
    this.glitchTimer = 0;
    this.glitchIntensity = intensity;
  }

  render() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  setBloomStrength(value) {
    if (this.bloomPass) {
      this.bloomPass.strength = value;
    }
  }

  setBloomRadius(value) {
    if (this.bloomPass) {
      this.bloomPass.radius = value;
    }
  }

  setBloomThreshold(value) {
    if (this.bloomPass) {
      this.bloomPass.threshold = value;
    }
  }

  setFogDensity(value) {
    if (this.scene.fog) {
      this.scene.fog.density = value;
    }
  }

  dispose() {
    if (this.composer) {
      this.composer.dispose();
    }
    Object.values(this.weatherParticles).forEach(particles => {
      if (particles) {
        this.scene.remove(particles);
        particles.geometry.dispose();
        particles.material.dispose();
      }
    });
  }
}

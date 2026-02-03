import * as THREE from 'three';
import { NOISE_FUNCTIONS, TERRAIN_HEIGHT_FUNCTION } from '../shaders/terrainNoise.glsl.js';

/**
 * GPUHeightSampler - Renders a heightmap texture and samples from it
 *
 * This ensures all systems (camera, flora, fauna) use the exact same
 * terrain height calculation as the GPU terrain shader.
 *
 * Uses a heightmap texture that covers a region around the current position,
 * re-rendered each frame to stay centered on the camera.
 */
export class GPUHeightSampler {
  constructor(renderer, config = {}) {
    this.renderer = renderer;

    this.config = {
      textureSize: config.textureSize ?? 128, // Resolution of heightmap
      worldSize: config.worldSize ?? 300,     // World units covered by heightmap
      ...config
    };

    // Terrain uniforms (synced from TerrainSystem)
    this.terrainHeight = config.terrainHeight ?? 35;
    this.terrainScale = config.terrainScale ?? 0.0005;

    // Current center of the heightmap in world coordinates
    this.centerX = 0;
    this.centerZ = 0;

    // Check for float texture support, fall back to half float
    const gl = this.renderer.getContext();
    const hasFloatTextures = gl.getExtension('EXT_color_buffer_float') ||
                             gl.getExtension('WEBGL_color_buffer_float');

    // Render target for heightmap
    this.renderTarget = new THREE.WebGLRenderTarget(
      this.config.textureSize,
      this.config.textureSize,
      {
        format: THREE.RGBAFormat,
        type: hasFloatTextures ? THREE.FloatType : THREE.HalfFloatType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping
      }
    );

    // Readback buffer - use Float32 regardless (Three.js handles conversion)
    this.readBuffer = new Float32Array(this.config.textureSize * this.config.textureSize * 4);
    this.heightData = new Float32Array(this.config.textureSize * this.config.textureSize);
    this.needsReadback = true;
    this.debugLastHeight = 0; // For debugging

    // Create rendering scene
    this.setupRenderScene();
  }

  setupRenderScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    // Fullscreen quad geometry
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Shader that outputs terrain height for each pixel
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTerrainHeight: { value: this.terrainHeight },
        uTerrainScale: { value: this.terrainScale },
        uCenterX: { value: 0 },
        uCenterZ: { value: 0 },
        uWorldSize: { value: this.config.worldSize }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTerrainHeight;
        uniform float uTerrainScale;
        uniform float uCenterX;
        uniform float uCenterZ;
        uniform float uWorldSize;
        varying vec2 vUv;

        ${NOISE_FUNCTIONS}
        ${TERRAIN_HEIGHT_FUNCTION}

        void main() {
          // Map UV (0-1) to world position centered on (uCenterX, uCenterZ)
          vec2 worldPos = vec2(
            uCenterX + (vUv.x - 0.5) * uWorldSize,
            uCenterZ + (vUv.y - 0.5) * uWorldSize
          );

          float height = getTerrainHeight(worldPos);
          gl_FragColor = vec4(height, 0.0, 0.0, 1.0);
        }
      `
    });

    this.quad = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.quad);
  }

  /**
   * Sync terrain parameters from TerrainSystem
   */
  syncTerrainParams(terrainHeight, terrainScale) {
    if (this.terrainHeight !== terrainHeight || this.terrainScale !== terrainScale) {
      this.terrainHeight = terrainHeight;
      this.terrainScale = terrainScale;
      this.material.uniforms.uTerrainHeight.value = terrainHeight;
      this.material.uniforms.uTerrainScale.value = terrainScale;
      this.needsReadback = true;
    }
  }

  /**
   * Update the heightmap center position
   * Call this each frame with the current world position to keep heightmap centered
   */
  updateCenter(worldX, worldZ) {
    // Only re-render if center has moved significantly
    const dx = Math.abs(worldX - this.centerX);
    const dz = Math.abs(worldZ - this.centerZ);
    const threshold = this.config.worldSize * 0.1; // Re-render if moved 10% of heightmap size

    if (dx > threshold || dz > threshold || this.needsReadback) {
      this.centerX = worldX;
      this.centerZ = worldZ;
      this.renderHeightmap();
    }
  }

  /**
   * Render the heightmap texture
   */
  renderHeightmap() {
    // Update uniforms
    this.material.uniforms.uCenterX.value = this.centerX;
    this.material.uniforms.uCenterZ.value = this.centerZ;

    // Render to heightmap texture
    const oldTarget = this.renderer.getRenderTarget();
    const oldClearColor = this.renderer.getClearColor(new THREE.Color());
    const oldClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);

    // Read back the entire heightmap
    this.renderer.readRenderTargetPixels(
      this.renderTarget,
      0, 0,
      this.config.textureSize, this.config.textureSize,
      this.readBuffer
    );

    this.renderer.setRenderTarget(oldTarget);
    this.renderer.setClearColor(oldClearColor, oldClearAlpha);

    // Extract heights from RGBA buffer (R channel only)
    for (let i = 0; i < this.heightData.length; i++) {
      this.heightData[i] = this.readBuffer[i * 4];
    }

    this.needsReadback = false;
  }

  /**
   * Get terrain height at world position (x, z)
   * Uses bilinear interpolation of cached heightmap
   */
  getHeight(x, z) {
    const size = this.config.textureSize;
    const worldSize = this.config.worldSize;

    // Convert world position to UV coordinates
    const u = (x - this.centerX) / worldSize + 0.5;
    const v = (z - this.centerZ) / worldSize + 0.5;

    // Clamp to valid range
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      // Position is outside heightmap - do a direct sample
      return this.sampleDirect(x, z);
    }

    // Convert to pixel coordinates
    const px = u * (size - 1);
    const py = v * (size - 1);

    // Bilinear interpolation
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = Math.min(x0 + 1, size - 1);
    const y1 = Math.min(y0 + 1, size - 1);

    const fx = px - x0;
    const fy = py - y0;

    const h00 = this.heightData[y0 * size + x0];
    const h10 = this.heightData[y0 * size + x1];
    const h01 = this.heightData[y1 * size + x0];
    const h11 = this.heightData[y1 * size + x1];

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    const height = h0 * (1 - fy) + h1 * fy;

    return height;
  }

  /**
   * Direct GPU sample for positions outside the cached heightmap
   * This is slower but ensures we always get correct heights
   */
  sampleDirect(x, z) {
    // Temporarily move center to the requested position and render a small area
    const oldCenterX = this.centerX;
    const oldCenterZ = this.centerZ;

    this.centerX = x;
    this.centerZ = z;
    this.renderHeightmap();

    // Sample from center of heightmap
    const centerIdx = Math.floor(this.config.textureSize / 2);
    const height = this.heightData[centerIdx * this.config.textureSize + centerIdx];

    // Restore original center
    this.centerX = oldCenterX;
    this.centerZ = oldCenterZ;
    this.needsReadback = true; // Force re-render on next update

    return height;
  }

  /**
   * Get multiple terrain heights at once
   * More efficient if positions are within the cached heightmap
   */
  getHeights(positions) {
    return positions.map(pos => this.getHeight(pos.x, pos.z));
  }

  /**
   * Legacy compatibility - synchronous height sample
   */
  sampleHeightSync(x, z) {
    return this.getHeight(x, z);
  }

  /**
   * Legacy compatibility - synchronous batch sample
   */
  sampleHeightsSync(positions) {
    return this.getHeights(positions);
  }

  // Legacy methods for compatibility
  requestHeight(x, z, id) {
    // No-op for heightmap approach - heights are always available
  }

  update() {
    // No-op for heightmap approach - rendering happens in updateCenter
  }

  dispose() {
    this.renderTarget.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}

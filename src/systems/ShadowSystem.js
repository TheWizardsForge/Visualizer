import * as THREE from 'three';
import {
  BLOB_SHADOW_VERTEX,
  BLOB_SHADOW_FRAGMENT,
  SHADOW_UNIFORMS
} from '../glsl/shadows/index.js';

/**
 * ShadowSystem - GPU-instanced blob shadows for flora
 *
 * Features:
 * - Instanced rendering for performance
 * - Terrain-conforming shadows via vertex shader
 * - Support for solid and dappled shadow types
 * - Z-wrapping for infinite scroll
 * - Fades with sun brightness (day/night)
 */
export class ShadowSystem {
  constructor(scene, terrainSystem, config = {}) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;

    this.config = {
      enabled: config.enabled ?? true,
      maxShadows: config.maxShadows ?? 500,
      baseOpacity: config.baseOpacity ?? 0.5,
      dappleEnabled: config.dappleEnabled ?? true,
      wrapRange: config.wrapRange ?? 200,
      ...config
    };

    // Shadow data arrays
    this.shadowCount = 0;
    this.positions = null;     // vec3 positions
    this.scales = null;        // float radius
    this.types = null;         // float (0=solid, 1=dappled)

    // Three.js objects
    this.mesh = null;
    this.geometry = null;
    this.material = null;

    // Track uniforms for updates
    this.uniforms = null;
  }

  create() {
    if (!this.config.enabled) return;

    const maxShadows = this.config.maxShadows;

    // Initialize data arrays
    this.positions = new Float32Array(maxShadows * 3);
    this.scales = new Float32Array(maxShadows);
    this.types = new Float32Array(maxShadows);

    // Create base circle geometry (flat on XZ plane)
    const baseGeometry = new THREE.CircleGeometry(1, 16);
    baseGeometry.rotateX(-Math.PI / 2);

    // Create instanced geometry
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = baseGeometry.index;
    this.geometry.attributes.position = baseGeometry.attributes.position;
    this.geometry.attributes.uv = baseGeometry.attributes.uv;

    // Instance attributes
    this.geometry.setAttribute(
      'instancePosition',
      new THREE.InstancedBufferAttribute(this.positions, 3)
    );
    this.geometry.setAttribute(
      'instanceScale',
      new THREE.InstancedBufferAttribute(this.scales, 1)
    );
    this.geometry.setAttribute(
      'instanceType',
      new THREE.InstancedBufferAttribute(this.types, 1)
    );

    // Get terrain parameters
    const terrainHeight = this.terrainSystem?.config?.terrainHeight ?? 35.0;
    const terrainScale = this.terrainSystem?.config?.terrainScale ?? 0.0005;

    // Create uniforms
    this.uniforms = {
      uSunBrightness: { value: 1.0 },
      uBaseOpacity: { value: this.config.baseOpacity },
      uRoverZ: { value: 0 },
      uWrapRange: { value: this.config.wrapRange },
      uTerrainHeight: { value: terrainHeight },
      uTerrainScale: { value: terrainScale }
    };

    // Create material
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: BLOB_SHADOW_VERTEX,
      fragmentShader: BLOB_SHADOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2; // Render before grass shadows (-1) and other objects
    this.mesh.visible = this.config.enabled;

    // Start with 0 instances
    this.geometry.instanceCount = 0;

    this.scene.add(this.mesh);
  }

  /**
   * Register a shadow for a flora instance
   * @param {number} x - World X position
   * @param {number} z - World Z position
   * @param {number} radius - Shadow radius
   * @param {string} type - 'solid' or 'dappled'
   * @returns {number} Shadow index, or -1 if at capacity
   */
  registerShadow(x, z, radius, type = 'solid') {
    if (!this.config.enabled || this.shadowCount >= this.config.maxShadows) {
      return -1;
    }

    const index = this.shadowCount;
    const i3 = index * 3;

    // Store position (Y will be computed in shader)
    this.positions[i3] = x;
    this.positions[i3 + 1] = 0; // Y placeholder
    this.positions[i3 + 2] = z;

    // Store scale (radius)
    this.scales[index] = radius;

    // Store type (0=solid, 1=dappled)
    const isDappled = type === 'dappled' && this.config.dappleEnabled;
    this.types[index] = isDappled ? 1.0 : 0.0;

    this.shadowCount++;

    // Update geometry instance count
    if (this.geometry) {
      this.geometry.instanceCount = this.shadowCount;
    }

    return index;
  }

  /**
   * Batch register multiple shadows
   * @param {Array} shadows - Array of {x, z, radius, type}
   */
  registerShadows(shadows) {
    for (const shadow of shadows) {
      this.registerShadow(shadow.x, shadow.z, shadow.radius, shadow.type);
    }
    this._updateAttributes();
  }

  /**
   * Clear all shadows
   */
  clearShadows() {
    this.shadowCount = 0;
    if (this.geometry) {
      this.geometry.instanceCount = 0;
    }
  }

  /**
   * Update instance attributes on GPU
   * @private
   */
  _updateAttributes() {
    if (!this.geometry) return;

    const posAttr = this.geometry.getAttribute('instancePosition');
    const scaleAttr = this.geometry.getAttribute('instanceScale');
    const typeAttr = this.geometry.getAttribute('instanceType');

    if (posAttr) posAttr.needsUpdate = true;
    if (scaleAttr) scaleAttr.needsUpdate = true;
    if (typeAttr) typeAttr.needsUpdate = true;
  }

  /**
   * Update per frame
   * @param {number} delta - Time since last frame
   * @param {number} elapsed - Total elapsed time
   * @param {number} roverZ - Camera Z position
   * @param {number} sunBrightness - Sun brightness (0-1)
   */
  update(delta, elapsed, roverZ, sunBrightness) {
    if (!this.config.enabled || !this.uniforms) return;

    // Update uniforms
    this.uniforms.uRoverZ.value = roverZ;
    this.uniforms.uSunBrightness.value = sunBrightness;
  }

  /**
   * Set visibility
   */
  setVisible(visible) {
    if (this.mesh) {
      this.mesh.visible = visible && this.config.enabled;
    }
  }

  /**
   * Set configuration
   */
  setConfig(newConfig) {
    Object.assign(this.config, newConfig);

    if (this.uniforms) {
      if (newConfig.baseOpacity !== undefined) {
        this.uniforms.uBaseOpacity.value = newConfig.baseOpacity;
      }
      if (newConfig.wrapRange !== undefined) {
        this.uniforms.uWrapRange.value = newConfig.wrapRange;
      }
    }

    if (this.mesh && newConfig.enabled !== undefined) {
      this.mesh.visible = newConfig.enabled;
    }
  }

  /**
   * Get shadow radius based on flora type and size
   * @param {string} floraType - Type of flora
   * @param {number} height - Flora height
   * @param {Object} userData - Additional flora data
   * @returns {{radius: number, type: string}}
   */
  static getShadowParams(floraType, height, userData = {}) {
    // Shadow parameters per flora type
    const params = {
      // Procedural trees
      proceduralOak: { baseRadius: 2.5, heightMult: 0.3, type: 'dappled' },
      proceduralPine: { baseRadius: 1.5, heightMult: 0.2, type: 'solid' },
      proceduralWillow: { baseRadius: 3.0, heightMult: 0.3, type: 'dappled' },
      proceduralMixed: { baseRadius: 2.0, heightMult: 0.25, type: 'dappled' },

      // Giant mushrooms
      giantMushroom: { baseRadius: 1.5, heightMult: 0.4, type: 'solid' },
      mushroomForest: { baseRadius: 1.2, heightMult: 0.3, type: 'solid' },

      // Shrubs and small plants
      alpine: { baseRadius: 0.8, heightMult: 0.1, type: 'dappled' },
      desertCanyon: { baseRadius: 1.0, heightMult: 0.15, type: 'dappled' },

      // Alien/fey trees
      feyTree: { baseRadius: 2.0, heightMult: 0.25, type: 'dappled' },
      ashTree: { baseRadius: 1.8, heightMult: 0.2, type: 'solid' },

      // Default
      default: { baseRadius: 1.5, heightMult: 0.2, type: 'solid' }
    };

    const p = params[floraType] || params.default;
    const radius = p.baseRadius + height * p.heightMult;

    // Cap shadows for mushroom caps
    if (userData.capRadius) {
      return { radius: userData.capRadius * 1.2, type: 'solid' };
    }

    return { radius, type: p.type };
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }

    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.positions = null;
    this.scales = null;
    this.types = null;
  }
}

export default ShadowSystem;

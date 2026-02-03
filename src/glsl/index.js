/**
 * GLSL Module System
 *
 * Provides consolidated, reusable GLSL code for all shaders.
 * Eliminates duplication and provides a single source of truth.
 *
 * Usage:
 *   import { GLSL } from '../glsl/index.js';
 *
 *   fragmentShader: GLSL.lighting.complete + `
 *     void main() {
 *       vec3 light = calculateDynamicLighting(vWorldPos, vNormal);
 *       // ...
 *     }
 *   `
 */

// Noise modules
import {
  HASH_SIMPLE,
  HASH_VEC2,
  VALUE_NOISE,
  PERMUTE,
  ALL_HASH
} from './noise/hash.glsl.js';

import {
  SIMPLEX_2D,
  SIMPLEX_3D
} from './noise/simplex.glsl.js';

import {
  FBM,
  RIDGED_FBM,
  TURBULENCE,
  WARPED_FBM,
  ALL_FBM,
  FBM_ONLY
} from './noise/fbm.glsl.js';

import { NOISE_STANDARD, NOISE_COMPLETE } from './noise/index.js';

// Lighting modules
import {
  DYNAMIC_LIGHT_UNIFORMS,
  FIREFLY_LIGHT_UNIFORMS,
  WISP_LIGHT_UNIFORMS,
  CALCULATE_FIREFLY_LIGHTING,
  CALCULATE_WISP_LIGHTING,
  CALCULATE_ALL_DYNAMIC_LIGHTING,
  DYNAMIC_LIGHTING_COMPLETE,
  FIREFLY_LIGHTING,
  WISP_LIGHTING
} from './lighting/dynamic.glsl.js';

import {
  FOG_EXP2,
  FOG_LINEAR,
  FOG_HEIGHT,
  APPLY_FOG,
  FOG_COMPLETE
} from './lighting/fog.glsl.js';

// Terrain modules
import {
  TERRAIN_HEIGHT,
  TERRAIN_COMPLETE,
  TERRAIN_UNIFORMS
} from './terrain/height.glsl.js';

/**
 * GLSL module namespace
 *
 * Organized by category for easy discovery:
 * - GLSL.noise.*    - Procedural noise functions
 * - GLSL.lighting.* - Dynamic lighting calculations
 * - GLSL.fog.*      - Fog effects
 * - GLSL.terrain.*  - Terrain height calculations
 */
export const GLSL = {
  // Noise functions
  noise: {
    hash: HASH_SIMPLE,
    hashVec2: HASH_VEC2,
    valueNoise: VALUE_NOISE,
    permute: PERMUTE,
    allHash: ALL_HASH,

    simplex2D: SIMPLEX_2D,
    simplex3D: SIMPLEX_3D,

    fbm: FBM,
    ridgedFbm: RIDGED_FBM,
    turbulence: TURBULENCE,
    warpedFbm: WARPED_FBM,
    allFbm: ALL_FBM,
    fbmNoSimplex: FBM_ONLY,

    // Convenience bundles
    standard: NOISE_STANDARD,   // simplex2D + fbm + ridgedFbm
    complete: NOISE_COMPLETE    // everything
  },

  // Lighting
  lighting: {
    uniforms: {
      dynamic: DYNAMIC_LIGHT_UNIFORMS,
      firefly: FIREFLY_LIGHT_UNIFORMS,
      wisp: WISP_LIGHT_UNIFORMS
    },

    fireflyCalc: CALCULATE_FIREFLY_LIGHTING,
    wispCalc: CALCULATE_WISP_LIGHTING,
    dynamicCalc: CALCULATE_ALL_DYNAMIC_LIGHTING,

    // Complete modules (uniforms + functions)
    firefly: FIREFLY_LIGHTING,
    wisp: WISP_LIGHTING,
    complete: DYNAMIC_LIGHTING_COMPLETE
  },

  // Fog
  fog: {
    exp2: FOG_EXP2,
    linear: FOG_LINEAR,
    height: FOG_HEIGHT,
    apply: APPLY_FOG,
    complete: FOG_COMPLETE
  },

  // Terrain
  terrain: {
    height: TERRAIN_HEIGHT,           // Just the function (needs noise)
    complete: TERRAIN_COMPLETE,       // Includes noise dependencies
    uniforms: TERRAIN_UNIFORMS        // JavaScript uniform definitions
  }
};

// Named exports for direct imports
export {
  // Noise
  HASH_SIMPLE,
  SIMPLEX_2D,
  SIMPLEX_3D,
  FBM,
  RIDGED_FBM,
  NOISE_STANDARD,
  NOISE_COMPLETE,

  // Lighting
  FIREFLY_LIGHT_UNIFORMS,
  WISP_LIGHT_UNIFORMS,
  CALCULATE_FIREFLY_LIGHTING,
  CALCULATE_WISP_LIGHTING,
  DYNAMIC_LIGHTING_COMPLETE,

  // Fog
  FOG_EXP2,
  FOG_COMPLETE,

  // Terrain
  TERRAIN_HEIGHT,
  TERRAIN_COMPLETE,
  TERRAIN_UNIFORMS
};

export default GLSL;

/**
 * Noise module exports
 */
export * from './hash.glsl.js';
export * from './simplex.glsl.js';
export * from './fbm.glsl.js';

// Convenience combined exports
import { ALL_HASH } from './hash.glsl.js';
import { SIMPLEX_2D, SIMPLEX_3D } from './simplex.glsl.js';
import { FBM, RIDGED_FBM, TURBULENCE, WARPED_FBM, FBM_ONLY } from './fbm.glsl.js';

// Complete noise library - includes everything
export const NOISE_COMPLETE = ALL_HASH + SIMPLEX_2D + SIMPLEX_3D + FBM_ONLY;

// Standard noise - what most shaders need
export const NOISE_STANDARD = SIMPLEX_2D + FBM + RIDGED_FBM;

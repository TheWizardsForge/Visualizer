/**
 * Fractal Brownian Motion (FBM) noise
 *
 * Multi-octave noise for natural-looking procedural terrain and effects.
 * Requires simplex noise to be included first.
 */

import { SIMPLEX_2D } from './simplex.glsl.js';

// Standard FBM - sum of octaves with decreasing amplitude
export const FBM = /* glsl */ `
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / maxValue;
}
`;

// Ridged FBM - creates sharp peaks like mountain ridges
export const RIDGED_FBM = /* glsl */ `
float ridgedFbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(snoise(p * frequency));
    value += amplitude * n * n;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / maxValue;
}
`;

// Turbulence - absolute value of noise for cloud-like effects
export const TURBULENCE = /* glsl */ `
float turbulence(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * abs(snoise(p * frequency));
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / maxValue;
}
`;

// Domain warping FBM - distorts input coordinates for organic shapes
export const WARPED_FBM = /* glsl */ `
float warpedFbm(vec2 p, int octaves, float warpStrength) {
  vec2 q = vec2(
    fbm(p, 2),
    fbm(p + vec2(5.2, 1.3), 2)
  );
  return fbm(p + q * warpStrength, octaves);
}
`;

// All FBM functions combined (includes simplex dependency)
export const ALL_FBM = SIMPLEX_2D + FBM + RIDGED_FBM + TURBULENCE + WARPED_FBM;

// FBM only (assumes simplex is already included)
export const FBM_ONLY = FBM + RIDGED_FBM + TURBULENCE + WARPED_FBM;

export default {
  fbm: FBM,
  ridged: RIDGED_FBM,
  turbulence: TURBULENCE,
  warped: WARPED_FBM,
  all: ALL_FBM,
  noSimplex: FBM_ONLY
};

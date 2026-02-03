/**
 * Terrain height calculation GLSL module
 *
 * GPU-computed terrain height using FBM and domain warping.
 * This is the single source of truth for terrain shape.
 *
 * Required uniforms:
 * - uTerrainScale: float (default 0.0005)
 * - uTerrainHeight: float (default 35.0)
 */

import { NOISE_STANDARD } from '../noise/index.js';

// Terrain height function - requires noise functions
export const TERRAIN_HEIGHT = /* glsl */ `
// Requires: uTerrainScale, uTerrainHeight uniforms
float getTerrainHeight(vec2 worldPos) {
  float scale = uTerrainScale;
  float terrainHeight = uTerrainHeight;

  // Domain warping for organic look
  float warpScale = scale * 0.4;
  float warpX = fbm(worldPos * warpScale, 2) * 200.0;
  float warpZ = fbm(worldPos * warpScale + vec2(1000.0), 2) * 200.0;
  vec2 warpedPos = worldPos + vec2(warpX, warpZ);

  // Multi-octave terrain
  float height = fbm(warpedPos * scale, 4) * terrainHeight * 0.7;
  height += fbm(worldPos * scale * 2.5, 3) * terrainHeight * 0.5;
  height += fbm(worldPos * scale * 6.0, 2) * terrainHeight * 0.15;

  // Ridged noise for peaks
  height += ridgedFbm(worldPos * scale * 3.0, 3) * terrainHeight * 0.35;

  // Large undulation
  height += fbm(worldPos * scale * 0.3, 2) * terrainHeight * 0.25;

  // Dips/pools
  float dipNoise = snoise(worldPos * scale * 0.8);
  if (dipNoise < -0.6) {
    float dipDepth = (-0.6 - dipNoise) * 2.5;
    height -= dipDepth * dipDepth * terrainHeight * 0.5;
  }

  // Craters
  float craterNoise = snoise(worldPos * 0.004);
  if (craterNoise > 0.7) {
    float craterDepth = (craterNoise - 0.7) * 8.0;
    height -= craterDepth * craterDepth * 2.0;
  }

  return height;
}
`;

// Complete terrain module (includes all dependencies)
export const TERRAIN_COMPLETE = NOISE_STANDARD + TERRAIN_HEIGHT;

// Terrain uniforms for JavaScript
export const TERRAIN_UNIFORMS = {
  uTerrainHeight: { value: 35.0 },
  uTerrainScale: { value: 0.0005 }
};

export default {
  height: TERRAIN_HEIGHT,
  complete: TERRAIN_COMPLETE,
  uniforms: TERRAIN_UNIFORMS
};

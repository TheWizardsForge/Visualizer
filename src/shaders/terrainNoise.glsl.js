/**
 * Shared GLSL terrain noise functions
 * Used by TerrainSystem, GrassSystem, and any other system needing terrain height
 *
 * IMPORTANT: Any changes here affect all systems using these functions.
 * This ensures terrain, grass, flora, etc. all use the same height calculation.
 */

// Core noise functions - include these in vertex shaders that need terrain height
export const NOISE_FUNCTIONS = `
// ============ GPU SIMPLEX NOISE ============
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion
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

// Ridged FBM for peaks
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

// Terrain height function - requires uniforms: uTerrainScale, uTerrainHeight
export const TERRAIN_HEIGHT_FUNCTION = `
// ============ TERRAIN HEIGHT CALCULATION ============
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

// Combined export for convenience
export const TERRAIN_NOISE_GLSL = NOISE_FUNCTIONS + TERRAIN_HEIGHT_FUNCTION;

// Required uniforms for any shader using terrain height
export const TERRAIN_UNIFORMS = {
  uTerrainHeight: { value: 35.0 },
  uTerrainScale: { value: 0.0005 }
};

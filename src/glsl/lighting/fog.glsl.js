/**
 * Fog GLSL module
 *
 * Various fog calculations for atmospheric depth effects.
 */

// Exponential fog (Three.js compatible)
export const FOG_EXP2 = /* glsl */ `
float calculateFogExp2(float depth, float density) {
  float fogFactor = 1.0 - exp(-density * density * depth * depth);
  return clamp(fogFactor, 0.0, 1.0);
}
`;

// Linear fog
export const FOG_LINEAR = /* glsl */ `
float calculateFogLinear(float depth, float near, float far) {
  return clamp((depth - near) / (far - near), 0.0, 1.0);
}
`;

// Height-based fog (denser near ground)
export const FOG_HEIGHT = /* glsl */ `
float calculateHeightFog(float depth, float worldY, float density, float heightFalloff) {
  float baseFog = 1.0 - exp(-density * density * depth * depth);
  float heightMod = exp(-max(0.0, worldY) * heightFalloff);
  return clamp(baseFog * heightMod, 0.0, 1.0);
}
`;

// Apply fog to a color
export const APPLY_FOG = /* glsl */ `
vec3 applyFog(vec3 color, float fogFactor, vec3 fogColor) {
  return mix(color, fogColor, fogFactor);
}
`;

// Complete fog module
export const FOG_COMPLETE = FOG_EXP2 + FOG_LINEAR + FOG_HEIGHT + APPLY_FOG;

export default {
  exp2: FOG_EXP2,
  linear: FOG_LINEAR,
  height: FOG_HEIGHT,
  apply: APPLY_FOG,
  complete: FOG_COMPLETE
};

/**
 * Hash functions for procedural noise
 *
 * These are the building blocks for all noise functions.
 * Consolidated from 6+ files that had duplicate implementations.
 */

// Simple hash function - fast, good for non-critical uses
export const HASH_SIMPLE = /* glsl */ `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
`;

// Hash that returns vec2 - useful for gradient noise
export const HASH_VEC2 = /* glsl */ `
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
`;

// Hash that returns vec3 - useful for 3D effects
export const HASH_VEC3 = /* glsl */ `
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
`;

// Permutation function used by simplex noise
export const PERMUTE = /* glsl */ `
vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

vec4 permute4(vec4 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}
`;

// Value noise - smooth random between corners
export const VALUE_NOISE = /* glsl */ `
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);  // Smoothstep interpolation
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
`;

// All hash functions combined
export const ALL_HASH = HASH_SIMPLE + HASH_VEC2 + HASH_VEC3 + PERMUTE + VALUE_NOISE;

export default {
  simple: HASH_SIMPLE,
  vec2: HASH_VEC2,
  vec3: HASH_VEC3,
  permute: PERMUTE,
  valueNoise: VALUE_NOISE,
  all: ALL_HASH
};

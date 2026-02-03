/**
 * Blob Shadow GLSL Module
 *
 * Provides instanced blob shadows for flora that conform to terrain.
 * Supports both solid and dappled (light-through-leaves) shadow types.
 *
 * Required uniforms:
 * - uSunBrightness: float (0=night, 1=noon)
 * - uBaseOpacity: float (max shadow opacity)
 * - uRoverZ: float (camera Z for wrapping)
 * - uWrapRange: float (Z-wrap distance)
 * - uTerrainHeight: float
 * - uTerrainScale: float
 *
 * Instance attributes:
 * - instancePosition: vec3 (world position of shadow center)
 * - instanceScale: float (shadow radius)
 * - instanceType: float (0=solid, 1=dappled)
 */

import { NOISE_STANDARD } from '../noise/index.js';
import { TERRAIN_HEIGHT } from '../terrain/height.glsl.js';

// Shadow uniforms for JavaScript
export const SHADOW_UNIFORMS = {
  uSunBrightness: { value: 1.0 },
  uBaseOpacity: { value: 0.5 },
  uRoverZ: { value: 0 },
  uWrapRange: { value: 200 },
  uTerrainHeight: { value: 35.0 },
  uTerrainScale: { value: 0.0005 }
};

// Vertex shader - positions shadows on terrain with Z-wrapping
export const BLOB_SHADOW_VERTEX = /* glsl */ `
attribute vec3 instancePosition;
attribute float instanceScale;
attribute float instanceType;

uniform float uRoverZ;
uniform float uWrapRange;
uniform float uTerrainHeight;
uniform float uTerrainScale;

varying vec2 vUv;
varying vec2 vWorldXZ;
varying float vType;
varying float vScale;

${NOISE_STANDARD}
${TERRAIN_HEIGHT}

void main() {
  vUv = uv;
  vType = instanceType;
  vScale = instanceScale;

  // GPU-side Z wrapping
  float baseZ = instancePosition.z;
  float relZ = baseZ - uRoverZ;
  float halfRange = uWrapRange * 0.5;
  float wrappedZ = mod(relZ + halfRange, uWrapRange) - halfRange;

  // Calculate terrain height at shadow position
  // Screen Z is inverted (camera looks at -Z), so negate wrappedZ
  vec2 worldPos = vec2(instancePosition.x, -wrappedZ - uRoverZ);
  float terrainY = getTerrainHeight(worldPos) + 0.03; // Slight offset above terrain

  vWorldXZ = worldPos;

  // Scale the shadow circle
  vec3 pos = position * instanceScale;
  vec3 worldOffset = vec3(instancePosition.x, terrainY, wrappedZ);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + worldOffset, 1.0);
}
`;

// Fragment shader - circular falloff with optional dapple pattern
export const BLOB_SHADOW_FRAGMENT = /* glsl */ `
uniform float uSunBrightness;
uniform float uBaseOpacity;

varying vec2 vUv;
varying vec2 vWorldXZ;
varying float vType;
varying float vScale;

// Simple noise for dappled pattern
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  // Circular falloff from center
  vec2 center = vec2(0.5, 0.5);
  float dist = length(vUv - center) * 2.0;
  float circleFalloff = smoothstep(1.0, 0.3, dist);

  // Base shadow strength
  float shadowStrength = uBaseOpacity;

  // Dappled shadow for trees (type > 0.5)
  if (vType > 0.5) {
    // Use world position + UV for stable dapple pattern
    vec2 noiseCoord = vWorldXZ + (vUv - 0.5) * vScale * 2.0;
    float dappleScale = 0.5;
    float dapple1 = noise(noiseCoord * dappleScale * 2.0);
    float dapple2 = noise(noiseCoord * dappleScale * 5.0 + vec2(50.0));
    float dapple = dapple1 * 0.6 + dapple2 * 0.4;

    // Create holes where "light comes through"
    float lightThrough = smoothstep(0.35, 0.65, dapple);
    shadowStrength *= mix(1.0, 0.3, lightThrough);
  }

  // Final alpha - shadows fade with sun
  float alpha = circleFalloff * shadowStrength * uSunBrightness;

  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

// Complete shadow shader (vertex + fragment combined for reference)
export const BLOB_SHADOW_COMPLETE = {
  vertex: BLOB_SHADOW_VERTEX,
  fragment: BLOB_SHADOW_FRAGMENT,
  uniforms: SHADOW_UNIFORMS
};

export default {
  vertex: BLOB_SHADOW_VERTEX,
  fragment: BLOB_SHADOW_FRAGMENT,
  uniforms: SHADOW_UNIFORMS,
  complete: BLOB_SHADOW_COMPLETE
};

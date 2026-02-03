/**
 * Dynamic lighting GLSL module
 *
 * Unified lighting calculations for all dynamic light sources.
 * This eliminates duplication across terrain, grass, and flora shaders.
 *
 * Light types:
 * - Firefly: Small, warm yellow-green, inverse-square falloff
 * - Wisp: Larger, warm orange, exponential falloff
 * - Future: Additional light types register here
 */

// Uniforms declaration - add to any shader that needs dynamic lighting
export const DYNAMIC_LIGHT_UNIFORMS = /* glsl */ `
// Dynamic light data textures
// Format: RGBA float, each pixel = one light (x, y, z, intensity)
uniform sampler2D uDynamicLights;
uniform int uDynamicLightCount;

// Per-type light parameters (packed into arrays for efficiency)
// Index 0 = firefly, 1 = wisp, etc.
uniform vec3 uLightColors[4];
uniform float uLightRadii[4];
uniform int uLightCounts[4];  // How many of each type
uniform int uLightOffsets[4]; // Starting index in texture
`;

// Simplified uniforms for backward compatibility
export const FIREFLY_LIGHT_UNIFORMS = /* glsl */ `
uniform sampler2D uFireflyLights;
uniform int uFireflyLightCount;
uniform vec3 uFireflyLightColor;
uniform float uFireflyLightRadius;
`;

export const WISP_LIGHT_UNIFORMS = /* glsl */ `
uniform sampler2D uWispLights;
uniform int uWispLightCount;
uniform vec3 uWispLightColor;
uniform float uWispLightRadius;
`;

// Firefly lighting calculation - small, warm, inverse-square
export const CALCULATE_FIREFLY_LIGHTING = /* glsl */ `
vec3 calculateFireflyLighting(vec3 worldPos, vec3 normal) {
  vec3 totalLight = vec3(0.0);
  float texelSize = 1.0 / float(uFireflyLightCount);

  for (int i = 0; i < 32; i++) {
    if (i >= uFireflyLightCount) break;

    vec4 lightData = texture2D(uFireflyLights, vec2((float(i) + 0.5) * texelSize, 0.5));
    vec3 lightPos = lightData.xyz;
    float intensity = lightData.w;

    if (intensity > 0.01) {
      // Use 2D horizontal distance (XZ) for ground illumination
      vec2 toLight2D = lightPos.xz - worldPos.xz;
      float dist = length(toLight2D);

      // Soft attenuation - inverse square with smooth cutoff
      float radius = uFireflyLightRadius;
      float attenuation = 1.0 / (1.0 + dist * dist / (radius * radius));
      attenuation *= smoothstep(radius * 2.5, radius * 0.5, dist);

      // Simplified diffuse for overhead light casting down
      float diffuse = 0.6 + 0.4 * max(0.0, normal.y);

      totalLight += uFireflyLightColor * intensity * attenuation * diffuse;
    }
  }

  return totalLight;
}
`;

// Wisp lighting calculation - larger, ethereal, exponential falloff
export const CALCULATE_WISP_LIGHTING = /* glsl */ `
vec3 calculateWispLighting(vec3 worldPos, vec3 normal) {
  vec3 totalLight = vec3(0.0);
  float texelSize = 1.0 / float(uWispLightCount);

  for (int i = 0; i < 40; i++) {
    if (i >= uWispLightCount) break;

    vec4 lightData = texture2D(uWispLights, vec2((float(i) + 0.5) * texelSize, 0.5));
    vec3 lightPos = lightData.xyz;
    float intensity = lightData.w;

    if (intensity > 0.01) {
      // Use 2D horizontal distance (XZ) for cylindrical light falloff
      vec2 toLight2D = lightPos.xz - worldPos.xz;
      float dist = length(toLight2D);

      // Hard cutoff at radius - no light beyond this
      float radius = uWispLightRadius;
      if (dist > radius) continue;

      // Exponential falloff for concentrated glow
      float normalizedDist = dist / radius;
      float attenuation = exp(-normalizedDist * 3.0);
      attenuation *= (1.0 - normalizedDist);

      // Simplified diffuse for overhead light casting down
      float diffuse = 0.6 + 0.4 * max(0.0, normal.y);

      totalLight += uWispLightColor * intensity * attenuation * diffuse;
    }
  }

  return totalLight;
}
`;

// Simple firefly lighting (no normal, for instanced geometry like grass)
export const CALCULATE_FIREFLY_LIGHTING_SIMPLE = /* glsl */ `
vec3 calculateFireflyLightingSimple(vec3 worldPos) {
  vec3 totalLight = vec3(0.0);
  float texelSize = 1.0 / float(uFireflyLightCount);

  for (int i = 0; i < 32; i++) {
    if (i >= uFireflyLightCount) break;

    vec4 lightData = texture2D(uFireflyLights, vec2((float(i) + 0.5) * texelSize, 0.5));
    vec3 lightPos = lightData.xyz;
    float intensity = lightData.w;

    if (intensity > 0.01) {
      vec2 toLight2D = lightPos.xz - worldPos.xz;
      float dist = length(toLight2D);

      float radius = uFireflyLightRadius;
      float attenuation = 1.0 / (1.0 + dist * dist / (radius * radius));
      attenuation *= smoothstep(radius * 2.5, radius * 0.5, dist);

      totalLight += uFireflyLightColor * intensity * attenuation;
    }
  }

  return totalLight;
}
`;

// Simple wisp lighting (no normal, for instanced geometry like grass)
export const CALCULATE_WISP_LIGHTING_SIMPLE = /* glsl */ `
vec3 calculateWispLightingSimple(vec3 worldPos) {
  vec3 totalLight = vec3(0.0);
  float texelSize = 1.0 / float(uWispLightCount);

  for (int i = 0; i < 40; i++) {
    if (i >= uWispLightCount) break;

    vec4 lightData = texture2D(uWispLights, vec2((float(i) + 0.5) * texelSize, 0.5));
    vec3 lightPos = lightData.xyz;
    float intensity = lightData.w;

    if (intensity > 0.01) {
      vec2 toLight2D = lightPos.xz - worldPos.xz;
      float dist = length(toLight2D);

      float radius = uWispLightRadius;
      if (dist > radius) continue;

      float normalizedDist = dist / radius;
      float attenuation = exp(-normalizedDist * 3.0);
      attenuation *= (1.0 - normalizedDist);

      totalLight += uWispLightColor * intensity * attenuation;
    }
  }

  return totalLight;
}
`;

// Combined calculation for convenience
export const CALCULATE_ALL_DYNAMIC_LIGHTING = /* glsl */ `
vec3 calculateDynamicLighting(vec3 worldPos, vec3 normal) {
  vec3 totalLight = vec3(0.0);

  // Add firefly contribution
  totalLight += calculateFireflyLighting(worldPos, normal);

  // Add wisp contribution
  totalLight += calculateWispLighting(worldPos, normal);

  return totalLight;
}
`;

// Complete dynamic lighting module
export const DYNAMIC_LIGHTING_COMPLETE =
  FIREFLY_LIGHT_UNIFORMS +
  WISP_LIGHT_UNIFORMS +
  CALCULATE_FIREFLY_LIGHTING +
  CALCULATE_WISP_LIGHTING +
  CALCULATE_ALL_DYNAMIC_LIGHTING;

// Firefly only (for systems that don't use wisps)
export const FIREFLY_LIGHTING =
  FIREFLY_LIGHT_UNIFORMS +
  CALCULATE_FIREFLY_LIGHTING;

// Wisp only
export const WISP_LIGHTING =
  WISP_LIGHT_UNIFORMS +
  CALCULATE_WISP_LIGHTING;

// Simple lighting for instanced geometry (no normals)
export const DYNAMIC_LIGHTING_SIMPLE =
  FIREFLY_LIGHT_UNIFORMS +
  WISP_LIGHT_UNIFORMS +
  CALCULATE_FIREFLY_LIGHTING_SIMPLE +
  CALCULATE_WISP_LIGHTING_SIMPLE;

export default {
  uniforms: {
    dynamic: DYNAMIC_LIGHT_UNIFORMS,
    firefly: FIREFLY_LIGHT_UNIFORMS,
    wisp: WISP_LIGHT_UNIFORMS
  },
  calculate: {
    firefly: CALCULATE_FIREFLY_LIGHTING,
    wisp: CALCULATE_WISP_LIGHTING,
    all: CALCULATE_ALL_DYNAMIC_LIGHTING
  },
  complete: DYNAMIC_LIGHTING_COMPLETE,
  fireflyOnly: FIREFLY_LIGHTING,
  wispOnly: WISP_LIGHTING
};

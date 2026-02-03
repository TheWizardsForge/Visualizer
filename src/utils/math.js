/**
 * Shared math utilities
 */

/**
 * Performs smooth Hermite interpolation between 0 and 1
 * Same as GLSL smoothstep()
 *
 * @param {number} edge0 - Lower edge
 * @param {number} edge1 - Upper edge
 * @param {number} x - Value to interpolate
 * @returns {number} 0 if x <= edge0, 1 if x >= edge1, smooth interpolation otherwise
 */
export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Linear interpolation between two values
 *
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate night factor for light systems
 * Returns 1.0 at night, fades to 0.0 as sun rises
 *
 * @param {number} sunBrightness - Sun brightness from atmosphere (0-1)
 * @param {number} fadeThreshold - Brightness level at which lights start to fade (default 0.3)
 * @returns {number} Night factor (0-1)
 */
export function calculateNightFactor(sunBrightness, fadeThreshold = 0.3) {
  return 1.0 - smoothstep(0, fadeThreshold, sunBrightness);
}

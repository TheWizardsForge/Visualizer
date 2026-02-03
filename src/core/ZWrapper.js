/**
 * ZWrapper - Unified Z-coordinate wrapping utilities
 *
 * Provides a single source of truth for Z-axis wrapping calculations.
 * All systems should use these functions instead of inline formulas.
 *
 * Coordinate system:
 * - World Z: Absolute position in world
 * - Screen Z: Position relative to viewer (roverZ), wrapped to [-wrapRange/2, wrapRange/2]
 */
export const ZWrapper = {
  /**
   * Wrap a world Z coordinate to screen space
   *
   * @param {number} worldZ - Absolute world Z position
   * @param {number} roverZ - Viewer Z position
   * @param {number} wrapRange - Total wrap range (default 200)
   * @returns {number} Screen Z in range [-wrapRange/2, wrapRange/2]
   */
  wrap(worldZ, roverZ, wrapRange = 200) {
    const halfRange = wrapRange * 0.5;
    const relZ = worldZ - roverZ;
    // Modulo that handles negatives correctly
    return ((relZ % wrapRange) + wrapRange + halfRange) % wrapRange - halfRange;
  },

  /**
   * Convert screen Z back to world Z (for a given roverZ)
   * Useful for spawning entities at screen positions
   *
   * @param {number} screenZ - Screen-relative Z position
   * @param {number} roverZ - Viewer Z position
   * @returns {number} World Z position
   */
  screenToWorld(screenZ, roverZ) {
    return screenZ + roverZ;
  },

  /**
   * Check if an entity wrapped this frame
   * Useful for triggering height recalculation
   *
   * @param {number} currentZ - Current wrapped Z
   * @param {number} previousZ - Previous wrapped Z
   * @param {number} wrapRange - Total wrap range
   * @returns {boolean} True if a wrap occurred
   */
  didWrap(currentZ, previousZ, wrapRange = 200) {
    const halfRange = wrapRange * 0.5;
    const threshold = halfRange * 0.8; // 80% of half range

    // If positions are on opposite sides and far apart, a wrap occurred
    return Math.abs(currentZ - previousZ) > threshold;
  },

  /**
   * Wrap X coordinate for lateral movement
   *
   * @param {number} worldX - Absolute world X position
   * @param {number} roverX - Viewer X position
   * @param {number} wrapRange - Total wrap range
   * @returns {number} Screen X in range [-wrapRange/2, wrapRange/2]
   */
  wrapX(worldX, roverX, wrapRange = 200) {
    const halfRange = wrapRange * 0.5;
    const relX = worldX - roverX;
    return ((relX % wrapRange) + wrapRange + halfRange) % wrapRange - halfRange;
  },

  /**
   * Calculate squared distance in wrapped XZ space
   * More efficient than regular distance when just comparing
   *
   * @param {number} x1 - First point X
   * @param {number} z1 - First point Z
   * @param {number} x2 - Second point X
   * @param {number} z2 - Second point Z
   * @param {number} roverX - Viewer X position
   * @param {number} roverZ - Viewer Z position
   * @param {number} wrapRange - Total wrap range
   * @returns {number} Squared distance
   */
  distanceSquaredWrapped(x1, z1, x2, z2, roverX, roverZ, wrapRange = 200) {
    const sx1 = this.wrapX(x1, roverX, wrapRange);
    const sz1 = this.wrap(z1, roverZ, wrapRange);
    const sx2 = this.wrapX(x2, roverX, wrapRange);
    const sz2 = this.wrap(z2, roverZ, wrapRange);

    const dx = sx1 - sx2;
    const dz = sz1 - sz2;
    return dx * dx + dz * dz;
  },

  /**
   * Check if a position is within view distance
   *
   * @param {number} worldX - Entity X position
   * @param {number} worldZ - Entity Z position
   * @param {number} roverX - Viewer X position
   * @param {number} roverZ - Viewer Z position
   * @param {number} viewDistance - Maximum view distance
   * @param {number} wrapRange - Total wrap range
   * @returns {boolean} True if within view distance
   */
  isInView(worldX, worldZ, roverX, roverZ, viewDistance, wrapRange = 200) {
    const distSq = this.distanceSquaredWrapped(
      worldX,
      worldZ,
      roverX,
      roverZ,
      roverX,
      roverZ,
      wrapRange
    );
    return distSq <= viewDistance * viewDistance;
  },

  /**
   * Generate GLSL code for Z-wrapping in shaders
   * Include this in vertex shaders that need wrapping
   *
   * @returns {string} GLSL function definitions
   */
  getGLSL() {
    return /* glsl */ `
// Wrap Z coordinate to screen space
float wrapZ(float worldZ, float roverZ, float wrapRange) {
  float halfRange = wrapRange * 0.5;
  float relZ = worldZ - roverZ;
  return mod(relZ + halfRange, wrapRange) - halfRange;
}

// Wrap X coordinate to screen space
float wrapX(float worldX, float roverX, float wrapRange) {
  float halfRange = wrapRange * 0.5;
  float relX = worldX - roverX;
  return mod(relX + halfRange, wrapRange) - halfRange;
}

// Check if position wrapped (for height recache)
bool didWrap(float currentZ, float previousZ, float wrapRange) {
  float threshold = wrapRange * 0.4;
  return abs(currentZ - previousZ) > threshold;
}
`;
  }
};

export default ZWrapper;

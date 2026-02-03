/**
 * SimplexNoise - Procedural noise generation
 *
 * This is a DIRECT PORT of the GLSL simplex noise used in terrainNoise.glsl.js
 * Both MUST produce identical results for the same inputs.
 *
 * Based on Ashima Arts GLSL simplex noise.
 */
export class SimplexNoise {
  constructor(seed = 0) {
    // Seed is ignored - GPU noise is seedless and deterministic
  }

  // Direct port of GLSL: mod(((x*34.0)+1.0)*x, 289.0)
  permute(x) {
    return this.mod289(((x * 34.0) + 1.0) * x);
  }

  // GLSL mod behavior for positive modulus
  mod289(x) {
    return x - Math.floor(x / 289.0) * 289.0;
  }

  // Direct port of GLSL snoise(vec2 v)
  noise2D(vx, vy) {
    // Constants from GLSL
    const C_x = 0.211324865405187;  // (3.0-sqrt(3.0))/6.0
    const C_y = 0.366025403784439;  // 0.5*(sqrt(3.0)-1.0)
    const C_z = -0.577350269189626; // -1.0 + 2.0 * C.x
    const C_w = 0.024390243902439;  // 1.0 / 41.0

    // vec2 i = floor(v + dot(v, C.yy))
    const dot_v_Cyy = vx * C_y + vy * C_y;
    let i_x = Math.floor(vx + dot_v_Cyy);
    let i_y = Math.floor(vy + dot_v_Cyy);

    // vec2 x0 = v - i + dot(i, C.xx)
    const dot_i_Cxx = i_x * C_x + i_y * C_x;
    const x0_x = vx - i_x + dot_i_Cxx;
    const x0_y = vy - i_y + dot_i_Cxx;

    // vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0)
    const i1_x = x0_x > x0_y ? 1.0 : 0.0;
    const i1_y = x0_x > x0_y ? 0.0 : 1.0;

    // vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    let x12_x = x0_x + C_x - i1_x;  // x12.x after subtraction
    let x12_y = x0_y + C_x - i1_y;  // x12.y after subtraction
    let x12_z = x0_x + C_z;         // x12.z = x0.x + C.z
    let x12_w = x0_y + C_z;         // x12.w = x0.y + C.z

    // i = mod(i, 289.0)
    i_x = this.mod289(i_x);
    i_y = this.mod289(i_y);

    // vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0))
    const p_inner_0 = this.permute(i_y + 0.0);
    const p_inner_1 = this.permute(i_y + i1_y);
    const p_inner_2 = this.permute(i_y + 1.0);
    const p_0 = this.permute(p_inner_0 + i_x + 0.0);
    const p_1 = this.permute(p_inner_1 + i_x + i1_x);
    const p_2 = this.permute(p_inner_2 + i_x + 1.0);

    // vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0)
    let m_0 = Math.max(0.0, 0.5 - (x0_x * x0_x + x0_y * x0_y));
    let m_1 = Math.max(0.0, 0.5 - (x12_x * x12_x + x12_y * x12_y));
    let m_2 = Math.max(0.0, 0.5 - (x12_z * x12_z + x12_w * x12_w));

    // m = m*m; m = m*m;
    m_0 = m_0 * m_0; m_0 = m_0 * m_0;
    m_1 = m_1 * m_1; m_1 = m_1 * m_1;
    m_2 = m_2 * m_2; m_2 = m_2 * m_2;

    // vec3 x = 2.0 * fract(p * C.www) - 1.0
    const x_0 = 2.0 * (p_0 * C_w - Math.floor(p_0 * C_w)) - 1.0;
    const x_1 = 2.0 * (p_1 * C_w - Math.floor(p_1 * C_w)) - 1.0;
    const x_2 = 2.0 * (p_2 * C_w - Math.floor(p_2 * C_w)) - 1.0;

    // vec3 h = abs(x) - 0.5
    const h_0 = Math.abs(x_0) - 0.5;
    const h_1 = Math.abs(x_1) - 0.5;
    const h_2 = Math.abs(x_2) - 0.5;

    // vec3 ox = floor(x + 0.5)
    const ox_0 = Math.floor(x_0 + 0.5);
    const ox_1 = Math.floor(x_1 + 0.5);
    const ox_2 = Math.floor(x_2 + 0.5);

    // vec3 a0 = x - ox
    const a0_0 = x_0 - ox_0;
    const a0_1 = x_1 - ox_1;
    const a0_2 = x_2 - ox_2;

    // m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h)
    m_0 *= 1.79284291400159 - 0.85373472095314 * (a0_0 * a0_0 + h_0 * h_0);
    m_1 *= 1.79284291400159 - 0.85373472095314 * (a0_1 * a0_1 + h_1 * h_1);
    m_2 *= 1.79284291400159 - 0.85373472095314 * (a0_2 * a0_2 + h_2 * h_2);

    // vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw
    const g_0 = a0_0 * x0_x + h_0 * x0_y;
    const g_1 = a0_1 * x12_x + h_1 * x12_y;
    const g_2 = a0_2 * x12_z + h_2 * x12_w;

    // return 130.0 * dot(m, g)
    return 130.0 * (m_0 * g_0 + m_1 * g_1 + m_2 * g_2);
  }

  // Direct port of GLSL fbm
  fbm(x, y, octaves = 4) {
    let value = 0.0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0.0;

    // GLSL uses loop up to 6, breaks if i >= octaves
    const maxOctaves = Math.min(octaves, 6);
    for (let i = 0; i < maxOctaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value / maxValue;
  }

  // Direct port of GLSL ridgedFbm
  ridgedFbm(x, y, octaves = 4) {
    let value = 0.0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0.0;

    // GLSL uses loop up to 4, breaks if i >= octaves
    const maxOctaves = Math.min(octaves, 4);
    for (let i = 0; i < maxOctaves; i++) {
      const n = 1.0 - Math.abs(this.noise2D(x * frequency, y * frequency));
      value += amplitude * n * n;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value / maxValue;
  }

  // Legacy compatibility
  ridgedNoise2D(x, y) {
    return 1.0 - Math.abs(this.noise2D(x, y));
  }
}

export type RGB = [number, number, number]
export type Lab = { L: number; a: number; b: number }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** sRGB (0–255) → CIELAB, D65. */
export function rgbToLab([r, g, b]: RGB): Lab {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b)
  let X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  let Y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb
  let Z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb
  X /= 0.95047; Z /= 1.08883                       // D65 white point
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(X), fy = f(Y), fz = f(Z)
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

/** ΔE*₇₆. If your Python reference uses CIE94/2000, port it here. */
export function deltaE(x: Lab, y: Lab): number {
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b)
}

/**
 * Chromaticity normalization: divide by (r+g+b) and rescale to a constant
 * intensity. Kills residual brightness variation after the affine correction.
 */
export function chromaNormalize([r, g, b]: RGB, targetSum = 384): RGB {
  const s = r + g + b
  if (s <= 1e-6) return [0, 0, 0]
  return [
    clamp01((r / s) * targetSum / 255) * 255,
    clamp01((g / s) * targetSum / 255) * 255,
    clamp01((b / s) * targetSum / 255) * 255
  ]
}

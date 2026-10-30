import { leastSquares } from './linalg'
import type { RGB } from './color'
import { CARD_PATCHES, CARD_W, CARD_H } from './reference'
import { warpQuad } from './warp'
import type { Point } from '../db/db'

/**
 * Warp the card quad, mean-sample each patch, and fit a per-channel affine
 * correction M (3×4) minimizing ||M·[r g b 1]ᵀ − ref||² over all patches.
 */
export function fitColorMatrix(img: ImageData, cardCorners: Point[]) {
  const warped = warpQuad(img, cardCorners, CARD_W, CARD_H)

  const measured: RGB[] = []
  for (const p of CARD_PATCHES) {
    let r = 0, g = 0, b = 0, n = 0
    const r2 = p.r * p.r
    for (let y = Math.max(0, p.cy - p.r); y <= Math.min(CARD_H - 1, p.cy + p.r); y++) {
      for (let x = Math.max(0, p.cx - p.r); x <= Math.min(CARD_W - 1, p.cx + p.r); x++) {
        if ((x - p.cx) ** 2 + (y - p.cy) ** 2 > r2) continue
        const i = (y * CARD_W + x) * 4
        r += warped.data[i]; g += warped.data[i + 1]; b += warped.data[i + 2]; n++
      }
    }
    if (n === 0) throw new Error(`Patch "${p.id}" fell outside the warped card — retake.`)
    measured.push([r / n, g / n, b / n])
  }

  const M = measured.map(m => [m[0], m[1], m[2], 1]) // design matrix
  const matrix: number[][] = []
  for (let ch = 0; ch < 3; ch++) {
    const y = CARD_PATCHES.map(p => p.refRgb[ch])
    matrix.push(leastSquares(M, y))                   // [a b c d] for this channel
  }

  // Diagnostic: residual per patch after correction.
  const patchDeltas = measured.map((m, i) => {
    const corrected = applyMatrix(matrix, m)
    const ref = CARD_PATCHES[i].refRgb
    return Math.hypot(corrected[0] - ref[0], corrected[1] - ref[1], corrected[2] - ref[2])
  })

  return { matrix, patchDeltas }
}

export function applyMatrix(matrix: number[][], rgb: RGB): RGB {
  const v = [rgb[0], rgb[1], rgb[2], 1]
  return matrix.map(row =>
    Math.min(255, Math.max(0, row.reduce((s, a, i) => s + a * v[i], 0)))
  ) as RGB
}

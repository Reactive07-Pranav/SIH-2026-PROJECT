import { solveLinear } from './linalg'
import type { Point } from '../db/db'

/** Homography mapping points in `from` → points in `to` (4 correspondences, h₃₃ = 1). */
export function computeHomography(from: Point[], to: Point[]): number[] {
  if (from.length !== 4 || to.length !== 4) throw new Error('Need exactly 4 point pairs')
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v)
  }
  const h = solveLinear(A, b)
  return [...h, 1]
}

export function applyHomography(H: number[], p: Point): Point {
  const w = H[6] * p.x + H[7] * p.y + H[8]
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w
  }
}

/** Warp the quad `srcCorners` out of `img` into a dstW×dstH rectangle. */
export function warpQuad(img: ImageData, srcCorners: Point[], dstW: number, dstH: number): ImageData {
  const dstRect: Point[] = [
    { x: 0, y: 0 }, { x: dstW, y: 0 }, { x: dstW, y: dstH }, { x: 0, y: dstH }
  ]
  const H = computeHomography(dstRect, srcCorners) // dst pixel → src pixel
  const out = new ImageData(dstW, dstH)
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const s = applyHomography(H, { x: x + 0.5, y: y + 0.5 })
      const [r, g, b] = sampleBilinear(img, s.x, s.y)
      const i = (y * dstW + x) * 4
      out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255
    }
  }
  return out
}

export function sampleBilinear(img: ImageData, x: number, y: number): [number, number, number] {
  const W = img.width, H = img.height, d = img.data
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)))
  const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1)
  const fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0))
  const idx = (xx: number, yy: number) => (yy * W + xx) * 4
  const mix = (c: number) => {
    const v00 = d[idx(x0, y0) + c], v10 = d[idx(x1, y0) + c]
    const v01 = d[idx(x0, y1) + c], v11 = d[idx(x1, y1) + c]
    return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy
  }
  return [Math.round(mix(0)), Math.round(mix(1)), Math.round(mix(2))]
}

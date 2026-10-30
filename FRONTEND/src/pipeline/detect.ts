import type { Point } from '../db/db'

/**
 * Auto card-detection hook. Intentionally stubbed for hackathon timeline —
 * the four-corner tap flow is the reliable path. If you add detection later
 * (e.g. threshold on black registration marks + connected components),
 * return [TL, TR, BR, BL] in image pixel coordinates.
 */
export function detectCardCorners(_img: ImageData): Point[] | null {
  return null
}

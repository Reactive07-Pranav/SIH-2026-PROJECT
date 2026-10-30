import type { Point } from '../db/db'
import { fitColorMatrix, applyMatrix } from './calibrate'
import { classifyStrip } from './classify'
import { sampleBilinear } from './warp'
import { detectCardCorners } from './detect'
import type { Classification } from '../config'
import type { RGB } from './color'

export interface PipelineOutcome {
  classification: Classification
  deltaE: number
  deltaEs: Record<string, number>
  correctedRgb: [number, number, number]
  rawStripRgb: [number, number, number]
  cardPatchDeltas?: number[]
  matrix?: number[][]
  calibrated: boolean
}

/**
 * corners: [TL, TR, BR, BL] of the color card + strip pad center (5 taps).
 * If null, attempts auto-detection (currently stubbed), then falls back to
 * an uncalibrated center sample.
 */
export function runPipeline(img: ImageData, corners: Point[] | null): PipelineOutcome {
  let cardCorners: Point[] | null = null
  let stripCenter: Point | null = null

  if (corners && corners.length === 5) {
    cardCorners = corners.slice(0, 4)
    stripCenter = corners[4]
  } else {
    const auto = detectCardCorners(img) // stub: returns null in this build
    if (auto) {
      cardCorners = auto
      stripCenter = { x: img.width / 2, y: img.height * 0.8 }
    }
  }

  let rawStripRgb: RGB
  let correctedRgb: RGB
  let matrix: number[][] | undefined
  let cardPatchDeltas: number[] | undefined

  if (cardCorners && stripCenter) {
    const fit = fitColorMatrix(img, cardCorners)
    matrix = fit.matrix
    cardPatchDeltas = fit.patchDeltas
    rawStripRgb = samplePatchMean(img, stripCenter, Math.max(4, Math.round(img.width * 0.01)))
    correctedRgb = applyMatrix(matrix, rawStripRgb)
  } else {
    // Uncalibrated fallback — UI flags this as reference-only.
    rawStripRgb = samplePatchMean(img, { x: img.width / 2, y: img.height / 2 }, 8)
    correctedRgb = rawStripRgb
  }

  const verdict = classifyStrip(correctedRgb)
  return {
    classification: verdict.classification,
    deltaE: verdict.deltaE,
    deltaEs: verdict.deltaEs,
    correctedRgb,
    rawStripRgb,
    cardPatchDeltas,
    matrix,
    calibrated: Boolean(matrix)
  }
}

function samplePatchMean(img: ImageData, c: Point, r: number): RGB {
  let R = 0, G = 0, B = 0, n = 0
  for (let y = Math.max(0, c.y - r); y <= Math.min(img.height - 1, c.y + r); y++) {
    for (let x = Math.max(0, c.x - r); x <= Math.min(img.width - 1, c.x + r); x++) {
      const [rr, gg, bb] = sampleBilinear(img, x, y)
      R += rr; G += gg; B += bb; n++
    }
  }
  if (!n) throw new Error('Strip patch sample empty — retake.')
  return [R / n, G / n, B / n]
}

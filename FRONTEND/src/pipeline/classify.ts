import { rgbToLab, deltaE, chromaNormalize, type RGB } from './color'
import { STRIP_SIGNATURES, DELTA_E_MAX, DELTA_E_GAP } from './reference'
import type { Classification } from '../config'

export function classifyStrip(correctedRgb: RGB) {
  const stripChroma = chromaNormalize(correctedRgb)
  const stripLab = rgbToLab(stripChroma)

  const deltaEs: Record<string, number> = {}
  for (const sig of STRIP_SIGNATURES) {
    const sigLab = rgbToLab(chromaNormalize(sig.rgb)) // same normalization on both sides
    deltaEs[sig.label] = deltaE(stripLab, sigLab)
  }

  const ranked = Object.entries(deltaEs).sort((a, b) => a[1] - b[1])
  const [bestLabel, bestD] = ranked[0]
  const secondD = ranked.length > 1 ? ranked[1][1] : Infinity

  let classification: Classification
  if (bestD > DELTA_E_MAX) classification = 'inconclusive'              // matches nothing
  else if (secondD - bestD < DELTA_E_GAP) classification = 'inconclusive' // ambiguous
  else classification = bestLabel as Classification

  return { classification, deltaE: bestD, deltaEs, correctedChromaRgb: stripChroma }
}

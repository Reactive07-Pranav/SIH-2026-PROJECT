import type { RGB } from './color'
import type { Classification } from '../config'

/** Normalized card space the quad is warped into (px). */
export const CARD_W = 420
export const CARD_H = 300

export interface CardPatch { id: string; cx: number; cy: number; r: number; refRgb: RGB }

/**
 * ⚠️ PLACEHOLDERS — copy the physical card's patch centers/radii (in this same
 * normalized coordinate space) and their factory reference sRGB values from
 * color_calibration_classifier.py.
 */
export const CARD_PATCHES: CardPatch[] = [
  { id: 'black', cx:  70, cy:  75, r: 26, refRgb: [ 30,  30,  30] },
  { id: 'grey',  cx: 210, cy:  75, r: 26, refRgb: [122, 122, 122] },
  { id: 'white', cx: 350, cy:  75, r: 26, refRgb: [240, 240, 240] },
  { id: 'red',   cx:  70, cy: 225, r: 26, refRgb: [192,  40,  40] },
  { id: 'green', cx: 210, cy: 225, r: 26, refRgb: [ 40, 160,  60] },
  { id: 'blue',  cx: 350, cy: 225, r: 26, refRgb: [ 40,  70, 180] }
]

export interface StripSignature {
  label: Exclude<Classification, 'inconclusive'>
  description: string
  rgb: RGB
}

/** ⚠️ PLACEHOLDERS — expected test-pad colors for each outcome. */
export const STRIP_SIGNATURES: StripSignature[] = [
  { label: 'negative', description: 'Pad stays reagent-orange (no reaction)', rgb: [214, 158,  46] },
  { label: 'positive', description: 'Pad turns violet (positive reaction)',    rgb: [106,  44, 112] }
]

export const DELTA_E_MAX = 12   // farther than this from every class → inconclusive
export const DELTA_E_GAP = 4    // best/second-best closer than this → ambiguous → inconclusive

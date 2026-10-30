/// Drug-test strip classifier using LAB nearest-match with Delta E threshold.
///
/// ## How it works
///
/// 1. The corrected RGB color of the test strip is converted to CIE L*a*b*.
/// 2. We compute the Delta E (CIE76) distance from each reference color.
/// 3. The closest reference determines the classification.
/// 4. If the minimum Delta E exceeds a configurable threshold the result is
///    marked "inconclusive" — the color is too far from any known reference
///    to be confident.
///
/// ## Reference colors
///
/// These are lab-measured values for a specific brand of fentanyl test strips.
/// For a real deployment you'd calibrate these per test-kit lot.  For the
/// hackathon these are representative.
library;

import 'color_conversion.dart';
import 'models.dart';

// ---------------------------------------------------------------------------
// Reference colors for classification
// ---------------------------------------------------------------------------

/// A named reference color in LAB space.
class ReferenceColor {
  final String name;
  final LabColor lab;
  final DrugTestClassification classification;

  const ReferenceColor(this.name, this.lab, this.classification);
}

/// Default reference set.  Extend this list for multi-substance panels.
const List<ReferenceColor> defaultReferences = [
  // Negative: the test strip stays yellowish — no reaction
  ReferenceColor(
    'negative',
    LabColor(80, -5, 60),
    DrugTestClassification.negative,
  ),
  // Positive: the strip turns reddish / purple — reaction occurred
  ReferenceColor(
    'positive',
    LabColor(50, 40, 30),
    DrugTestClassification.positive,
  ),
];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/// Default Delta E threshold.  If the closest reference is farther than this
/// the result is "inconclusive".
///
/// Empirically, CIE76 ΔE values:
///   < 2  : nearly identical
///   2–10 : noticeable but close
///  10–15 : obviously different but in the right family
///   > 15 : too different to trust
const double defaultInconclusiveThreshold = 15.0;

/// Classify the test strip color against [references].
///
/// Returns a [ClassificationResult] with the winning classification, the
/// Delta E to the nearest reference, the corrected RGB, and the LAB values.
ClassificationResult classify(
  RgbColor correctedStripColor, {
  List<ReferenceColor> references = defaultReferences,
  double inconclusiveThreshold = defaultInconclusiveThreshold,
}) {
  final lab = rgbToLab(correctedStripColor);

  String bestName = references.first.name;
  DrugTestClassification bestClass = references.first.classification;
  double bestDeltaE = double.infinity;

  for (final ref in references) {
    final de = deltaE(lab, ref.lab);
    if (de < bestDeltaE) {
      bestDeltaE = de;
      bestName = ref.name;
      bestClass = ref.classification;
    }
  }

  // If the best match is still too far away, mark as inconclusive.
  final finalClassification =
      bestDeltaE > inconclusiveThreshold ? DrugTestClassification.inconclusive : bestClass;

  return ClassificationResult(
    classification: finalClassification,
    deltaE: bestDeltaE,
    correctedRgb: correctedStripColor,
    labValues: lab,
    matchedReference: bestName,
  );
}

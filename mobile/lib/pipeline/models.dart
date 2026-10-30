/// Pipeline processing result bundle.
///
/// Pure Dart — no native dependencies.  All color math operates on
/// [double] arrays so the pipeline can run on any device.
import 'dart:typed_data';

class CornerPoints {
  final List<double> topLeft;      // [x, y]
  final List<double> topRight;
  final List<double> bottomRight;
  final List<double> bottomLeft;

  CornerPoints({
    required this.topLeft,
    required this.topRight,
    required this.bottomRight,
    required this.bottomLeft,
  });
}

class ClassificationResult {
  final String classification;     // 'positive' | 'negative' | 'inconclusive'
  final double deltaE;
  final List<int> correctedRgb;    // [r, g, b]
  final List<double> labValues;    // [L, a, b]

  ClassificationResult({
    required this.classification,
    required this.deltaE,
    required this.correctedRgb,
    required this.labValues,
  });
}

class ProcessingResult {
  final CornerPoints corners;
  final List<List<double>> correctionMatrix; // 3x4 affine
  final ClassificationResult classification;
  final String imagePath;
  final String imageHash;

  ProcessingResult({
    required this.corners,
    required this.correctionMatrix,
    required this.classification,
    required this.imagePath,
    required this.imageHash,
  });
}

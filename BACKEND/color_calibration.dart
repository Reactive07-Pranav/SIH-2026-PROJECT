/// Perspective warp, patch sampling, and least-squares affine color correction.
///
/// All operations are pure Dart using the `image` package for pixel access.
/// No OpenCV or native code required.
///
/// ## Theory
///
/// ### Perspective warp
/// Given 4 source corner points in the camera image we compute a projective
/// (homography) transform that maps them to the corners of a rectangular
/// output image.  For each output pixel we find its source coordinate via the
/// inverse homography and sample using bilinear interpolation.
///
/// A full 3×3 homography has 8 degrees of freedom (9 entries minus one for
/// scale).  We solve an 8×8 linear system from the 4 point correspondences.
///
/// ### Affine color correction
/// Given N≥4 observed/expected RGB pairs from the reference patches we fit a
/// 3×4 affine matrix **M** such that:
///
///   [R_exp]       [m00 m01 m02 m03] [R_obs]
///   [G_exp]   ≈   [m10 m11 m12 m13] [G_obs]
///   [B_exp]       [m20 m21 m22 m23] [B_obs]
///                                    [ 1  ]
///
/// This is solved by ordinary least squares:  M = Y · pinv(X)
/// where X is 4×N (each column = [R,G,B,1]) and Y is 3×N.
library;

import 'dart:math' as math;
import 'dart:ui' show Offset;
import 'package:image/image.dart' as img;
import 'models.dart';

// ═══════════════════════════════════════════════════════════════════════════
// 1.  PERSPECTIVE WARP
// ═══════════════════════════════════════════════════════════════════════════

/// Warp the quadrilateral defined by [corners] in [source] into a rectangular
/// image of [outWidth] × [outHeight].
///
/// Uses inverse mapping with bilinear interpolation for quality.
img.Image perspectiveWarp(
  img.Image source,
  CornerPoints corners, {
  int outWidth = 400,
  int outHeight = 300,
}) {
  // Destination corners (the rectangle we want)
  final dst = [
    const Offset(0, 0),
    Offset(outWidth.toDouble() - 1, 0),
    Offset(outWidth.toDouble() - 1, outHeight.toDouble() - 1),
    Offset(0, outHeight.toDouble() - 1),
  ];

  // We need the *inverse* homography: dst → src, so we can iterate over
  // every output pixel and look up where it comes from.
  final h = _computeHomography(dst, corners.toList());

  final out = img.Image(width: outWidth, height: outHeight);

  for (int y = 0; y < outHeight; y++) {
    for (int x = 0; x < outWidth; x++) {
      // Apply inverse homography to get source coordinates
      final denom = h[6] * x + h[7] * y + 1.0;
      final sx = (h[0] * x + h[1] * y + h[2]) / denom;
      final sy = (h[3] * x + h[4] * y + h[5]) / denom;

      // Bilinear interpolation
      final pixel = _bilinearSample(source, sx, sy);
      out.setPixelRgba(x, y, pixel.r, pixel.g, pixel.b, 255);
    }
  }

  return out;
}

/// Compute the 8-parameter homography mapping [from] points to [to] points.
///
/// Solves the 8×8 system derived from:
///   x' = (h0·x + h1·y + h2) / (h6·x + h7·y + 1)
///   y' = (h3·x + h4·y + h5) / (h6·x + h7·y + 1)
///
/// Returns a list of 8 doubles [h0..h7].
List<double> _computeHomography(List<Offset> from, List<Offset> to) {
  // Build the 8×8 matrix A and 8×1 vector b
  // For each point pair (x,y) → (x',y') we get two equations:
  //   x·h0 + y·h1 + h2 - x·x'·h6 - y·x'·h7 = x'
  //   x·h3 + y·h4 + h5 - x·y'·h6 - y·y'·h7 = y'
  final a = List.generate(8, (_) => List.filled(8, 0.0));
  final b = List.filled(8, 0.0);

  for (int i = 0; i < 4; i++) {
    final x = from[i].dx, y = from[i].dy;
    final xp = to[i].dx, yp = to[i].dy;
    final row1 = i * 2;
    final row2 = i * 2 + 1;

    a[row1][0] = x;
    a[row1][1] = y;
    a[row1][2] = 1;
    a[row1][3] = 0;
    a[row1][4] = 0;
    a[row1][5] = 0;
    a[row1][6] = -x * xp;
    a[row1][7] = -y * xp;
    b[row1] = xp;

    a[row2][0] = 0;
    a[row2][1] = 0;
    a[row2][2] = 0;
    a[row2][3] = x;
    a[row2][4] = y;
    a[row2][5] = 1;
    a[row2][6] = -x * yp;
    a[row2][7] = -y * yp;
    b[row2] = yp;
  }

  // Solve via Gaussian elimination with partial pivoting
  return _solveLinearSystem(a, b);
}

/// Gaussian elimination with partial pivoting for an n×n system.
List<double> _solveLinearSystem(List<List<double>> a, List<double> b) {
  final n = b.length;
  // Augmented matrix
  final aug = List.generate(
      n, (i) => List.generate(n + 1, (j) => j < n ? a[i][j] : b[i]));

  for (int col = 0; col < n; col++) {
    // Partial pivoting — find the row with the largest absolute value
    int maxRow = col;
    double maxVal = aug[col][col].abs();
    for (int row = col + 1; row < n; row++) {
      if (aug[row][col].abs() > maxVal) {
        maxVal = aug[row][col].abs();
        maxRow = row;
      }
    }
    // Swap rows
    if (maxRow != col) {
      final tmp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = tmp;
    }

    // Eliminate below
    for (int row = col + 1; row < n; row++) {
      final factor = aug[row][col] / aug[col][col];
      for (int j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  final x = List.filled(n, 0.0);
  for (int i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (int j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  return x;
}

/// Bilinear interpolation at fractional coordinates (sx, sy) in [source].
///
/// Samples the 4 neighboring pixels and blends proportionally.
({int r, int g, int b}) _bilinearSample(img.Image source, double sx, double sy) {
  final x0 = sx.floor().clamp(0, source.width - 1);
  final y0 = sy.floor().clamp(0, source.height - 1);
  final x1 = (x0 + 1).clamp(0, source.width - 1);
  final y1 = (y0 + 1).clamp(0, source.height - 1);

  final fx = sx - sx.floorToDouble(); // fractional x
  final fy = sy - sy.floorToDouble(); // fractional y

  final p00 = source.getPixel(x0, y0);
  final p10 = source.getPixel(x1, y0);
  final p01 = source.getPixel(x0, y1);
  final p11 = source.getPixel(x1, y1);

  int _lerp(num a, num b, num c, num d) {
    final top = a + (b - a) * fx;
    final bot = c + (d - c) * fx;
    return (top + (bot - top) * fy).round().clamp(0, 255);
  }

  return (
    r: _lerp(p00.r, p10.r, p01.r, p11.r),
    g: _lerp(p00.g, p10.g, p01.g, p11.g),
    b: _lerp(p00.b, p10.b, p01.b, p11.b),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2.  PATCH COLOR SAMPLING
// ═══════════════════════════════════════════════════════════════════════════

/// Default 6-patch layout for the reference color card.
///
/// Each patch is defined as a normalized rectangle [left, top, width, height]
/// within the warped card image (0.0–1.0 coordinate system).
///
/// Layout (2 rows × 3 columns):
///   ┌───────┬───────┬───────┐
///   │ White │  Red  │ Blue  │
///   ├───────┼───────┼───────┤
///   │ Black │ Green │ Gray  │
///   └───────┴───────┴───────┘
///
/// The test strip occupies a region below the patches.
List<PatchColor> defaultPatches() => [
      // Row 1
      PatchColor(rectNorm: [0.05, 0.05, 0.25, 0.35], expected: const RgbColor(255, 255, 255)), // White
      PatchColor(rectNorm: [0.37, 0.05, 0.25, 0.35], expected: const RgbColor(255, 0, 0)),     // Red
      PatchColor(rectNorm: [0.70, 0.05, 0.25, 0.35], expected: const RgbColor(0, 0, 255)),     // Blue
      // Row 2
      PatchColor(rectNorm: [0.05, 0.50, 0.25, 0.35], expected: const RgbColor(0, 0, 0)),       // Black
      PatchColor(rectNorm: [0.37, 0.50, 0.25, 0.35], expected: const RgbColor(0, 255, 0)),     // Green
      PatchColor(rectNorm: [0.70, 0.50, 0.25, 0.35], expected: const RgbColor(128, 128, 128)), // Gray
    ];

/// Normalized rectangle for the test strip region on the card.
/// Positioned below the reference patches.
const List<double> testStripRectNorm = [0.30, 0.88, 0.40, 0.10];

/// Sample the average RGB of each patch from the [warped] card image.
///
/// For each patch, iterates over all pixels in its rectangle, accumulates
/// R/G/B totals, and divides by the pixel count.  This simple averaging is
/// robust enough for a hackathon — a production system might use median or
/// trimmed mean to reject outlier pixels.
void samplePatches(img.Image warped, List<PatchColor> patches) {
  final w = warped.width.toDouble();
  final h = warped.height.toDouble();

  for (final patch in patches) {
    final x0 = (patch.rectNorm[0] * w).round();
    final y0 = (patch.rectNorm[1] * h).round();
    final pw = (patch.rectNorm[2] * w).round();
    final ph = (patch.rectNorm[3] * h).round();

    int rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (int py = y0; py < y0 + ph && py < warped.height; py++) {
      for (int px = x0; px < x0 + pw && px < warped.width; px++) {
        final p = warped.getPixel(px, py);
        rSum += p.r.toInt();
        gSum += p.g.toInt();
        bSum += p.b.toInt();
        count++;
      }
    }

    if (count > 0) {
      patch.observed = RgbColor(rSum ~/ count, gSum ~/ count, bSum ~/ count);
    }
  }
}

/// Sample the average RGB of the test strip region.
RgbColor sampleTestStrip(img.Image warped) {
  final w = warped.width.toDouble();
  final h = warped.height.toDouble();
  final x0 = (testStripRectNorm[0] * w).round();
  final y0 = (testStripRectNorm[1] * h).round();
  final pw = (testStripRectNorm[2] * w).round();
  final ph = (testStripRectNorm[3] * h).round();

  int rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (int py = y0; py < y0 + ph && py < warped.height; py++) {
    for (int px = x0; px < x0 + pw && px < warped.width; px++) {
      final p = warped.getPixel(px, py);
      rSum += p.r.toInt();
      gSum += p.g.toInt();
      bSum += p.b.toInt();
      count++;
    }
  }

  if (count == 0) return const RgbColor(128, 128, 128);
  return RgbColor(rSum ~/ count, gSum ~/ count, bSum ~/ count);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3.  LEAST-SQUARES AFFINE COLOR-CORRECTION MATRIX
// ═══════════════════════════════════════════════════════════════════════════

/// Fit a 3×4 affine color-correction matrix from observed→expected patch
/// pairs using ordinary least squares.
///
/// ## Math
///
/// We want M (3×4) such that  M · X ≈ Y  where:
///   X = [R_obs; G_obs; B_obs; 1]  — 4×N matrix (one column per patch)
///   Y = [R_exp; G_exp; B_exp]     — 3×N matrix
///
/// The least-squares solution is  M = Y · Xᵀ · (X · Xᵀ)⁻¹
///
/// For 6 patches this is a 4×4 matrix to invert — we do it via Gauss-Jordan.
ColorCorrectionMatrix fitCorrectionMatrix(List<PatchColor> patches) {
  final n = patches.length;
  if (n < 4) {
    // Need at least 4 patches for a well-determined 3×4 system.
    // Fall back to identity.
    return ColorCorrectionMatrix.identity();
  }

  // Build X (4×N) and Y (3×N) as row-major lists-of-lists.
  final x = List.generate(4, (i) => List.filled(n, 0.0));
  final y = List.generate(3, (i) => List.filled(n, 0.0));

  for (int j = 0; j < n; j++) {
    final obs = patches[j].observed ?? patches[j].expected;
    final exp = patches[j].expected;
    x[0][j] = obs.r.toDouble();
    x[1][j] = obs.g.toDouble();
    x[2][j] = obs.b.toDouble();
    x[3][j] = 1.0; // affine bias term

    y[0][j] = exp.r.toDouble();
    y[1][j] = exp.g.toDouble();
    y[2][j] = exp.b.toDouble();
  }

  // Compute XXT = X · Xᵀ  (4×4)
  final xxt = List.generate(4, (i) => List.filled(4, 0.0));
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4; j++) {
      double s = 0;
      for (int k = 0; k < n; k++) {
        s += x[i][k] * x[j][k];
      }
      xxt[i][j] = s;
    }
  }

  // Compute YXT = Y · Xᵀ  (3×4)
  final yxt = List.generate(3, (i) => List.filled(4, 0.0));
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 4; j++) {
      double s = 0;
      for (int k = 0; k < n; k++) {
        s += y[i][k] * x[j][k];
      }
      yxt[i][j] = s;
    }
  }

  // Invert XXT via Gauss-Jordan (4×4)
  final inv = _invert4x4(xxt);
  if (inv == null) return ColorCorrectionMatrix.identity();

  // M = YXT · inv(XXT)  →  3×4
  final m = List.generate(3, (i) => List.filled(4, 0.0));
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 4; j++) {
      double s = 0;
      for (int k = 0; k < 4; k++) {
        s += yxt[i][k] * inv[k][j];
      }
      m[i][j] = s;
    }
  }

  return ColorCorrectionMatrix(m);
}

/// Invert a 4×4 matrix using Gauss-Jordan elimination.
/// Returns null if singular.
List<List<double>>? _invert4x4(List<List<double>> mat) {
  const n = 4;
  // Augment with identity
  final aug = List.generate(
      n,
      (i) => List.generate(
          2 * n, (j) => j < n ? mat[i][j] : (j - n == i ? 1.0 : 0.0)));

  for (int col = 0; col < n; col++) {
    // Pivot
    int maxRow = col;
    for (int row = col + 1; row < n; row++) {
      if (aug[row][col].abs() > aug[maxRow][col].abs()) maxRow = row;
    }
    final tmp = aug[col];
    aug[col] = aug[maxRow];
    aug[maxRow] = tmp;

    if (aug[col][col].abs() < 1e-12) return null; // singular

    // Scale pivot row
    final pivot = aug[col][col];
    for (int j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // Eliminate column
    for (int row = 0; row < n; row++) {
      if (row == col) continue;
      final factor = aug[row][col];
      for (int j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract the right half
  return List.generate(
      n, (i) => List.generate(n, (j) => aug[i][j + n]));
}

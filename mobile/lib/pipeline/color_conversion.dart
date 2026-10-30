/// CIE color-space conversions: sRGB ↔ XYZ ↔ L*a*b*, plus Delta E (CIE76).
///
/// All math follows the standard IEC 61966-2-1 (sRGB) and CIE 1976 specs.
/// Reference white: D65 (Xn=0.95047, Yn=1.00000, Zn=1.08883).
library;

import 'dart:math' as math;
import 'models.dart';

// ---------------------------------------------------------------------------
// Constants — D65 reference white
// ---------------------------------------------------------------------------

const double _xn = 0.95047;
const double _yn = 1.00000;
const double _zn = 1.08883;

// CIE constants
const double _epsilon = 0.008856; // (6/29)^3
const double _kappa = 903.3; // (29/6)^3 … ×3 actually = 903.3
const double _oneThird = 1.0 / 3.0;
const double _16over116 = 16.0 / 116.0;

// ---------------------------------------------------------------------------
// sRGB → linear RGB
// ---------------------------------------------------------------------------

/// Linearize a single sRGB channel (0–255 → 0.0–1.0 linear).
///
/// sRGB uses a piecewise gamma curve:
///   if C_srgb ≤ 0.04045  → C_linear = C_srgb / 12.92
///   else                  → C_linear = ((C_srgb + 0.055) / 1.055) ^ 2.4
double _srgbToLinear(int value) {
  final s = value / 255.0;
  return s <= 0.04045 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
}

/// Inverse: linear (0.0–1.0) → sRGB (0–255).
int _linearToSrgb(double c) {
  final s = c <= 0.0031308 ? 12.92 * c : 1.055 * math.pow(c, 1.0 / 2.4) - 0.055;
  return (s * 255.0).round().clamp(0, 255);
}

// ---------------------------------------------------------------------------
// sRGB → XYZ (D65)
// ---------------------------------------------------------------------------

/// Convert 0–255 sRGB to CIE XYZ using the standard D65 matrix.
///
///   | X |   | 0.4124564  0.3575761  0.1804375 |   | R_linear |
///   | Y | = | 0.2126729  0.7151522  0.0721750 | × | G_linear |
///   | Z |   | 0.0193339  0.1191920  0.9503041 |   | B_linear |
(double, double, double) rgbToXyz(int r, int g, int b) {
  final rl = _srgbToLinear(r);
  final gl = _srgbToLinear(g);
  final bl = _srgbToLinear(b);
  return (
    0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
    0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
    0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl,
  );
}

// ---------------------------------------------------------------------------
// XYZ → LAB
// ---------------------------------------------------------------------------

/// The CIE f(t) function used in XYZ → LAB.
double _f(double t) {
  return t > _epsilon ? math.pow(t, _oneThird).toDouble() : (_kappa * t + 16.0) / 116.0;
}

/// Convert CIE XYZ to CIE L*a*b* (D65 reference white).
///
///   L* = 116 · f(Y/Yn) − 16
///   a* = 500 · [f(X/Xn) − f(Y/Yn)]
///   b* = 200 · [f(Y/Yn) − f(Z/Zn)]
LabColor xyzToLab(double x, double y, double z) {
  final fx = _f(x / _xn);
  final fy = _f(y / _yn);
  final fz = _f(z / _zn);
  return LabColor(
    116.0 * fy - 16.0,
    500.0 * (fx - fy),
    200.0 * (fy - fz),
  );
}

// ---------------------------------------------------------------------------
// Convenience: RGB → LAB
// ---------------------------------------------------------------------------

/// Shortcut: sRGB (0–255) → CIE L*a*b*.
LabColor rgbToLab(RgbColor c) {
  final (x, y, z) = rgbToXyz(c.r, c.g, c.b);
  return xyzToLab(x, y, z);
}

// ---------------------------------------------------------------------------
// LAB → XYZ → sRGB (reverse path)
// ---------------------------------------------------------------------------

/// Inverse of _f(t).
double _fInv(double ft) {
  return ft > _16over116 ? ft * ft * ft : (116.0 * ft - 16.0) / _kappa;
}

/// CIE L*a*b* → XYZ (D65).
(double, double, double) labToXyz(LabColor lab) {
  final fy = (lab.l + 16.0) / 116.0;
  final fx = lab.a / 500.0 + fy;
  final fz = fy - lab.b / 200.0;
  return (_fInv(fx) * _xn, _fInv(fy) * _yn, _fInv(fz) * _zn);
}

/// XYZ → sRGB (D65).
///
/// Inverse of the sRGB matrix:
///   | R_lin |   |  3.2404542  -1.5371385  -0.4985314 |   | X |
///   | G_lin | = | -0.9692660   1.8760108   0.0415560 | × | Y |
///   | B_lin |   |  0.0556434  -0.2040259   1.0572252 |   | Z |
RgbColor xyzToRgb(double x, double y, double z) {
  final rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  final gl = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  final bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return RgbColor(_linearToSrgb(rl), _linearToSrgb(gl), _linearToSrgb(bl));
}

/// Convenience: LAB → sRGB.
RgbColor labToRgb(LabColor lab) {
  final (x, y, z) = labToXyz(lab);
  return xyzToRgb(x, y, z);
}

// ---------------------------------------------------------------------------
// Delta E (CIE76)
// ---------------------------------------------------------------------------

/// Euclidean distance in L*a*b* space.
///
///   ΔE = √[(L₁−L₂)² + (a₁−a₂)² + (b₁−b₂)²]
///
/// Interpretation:
///   0–1    : imperceptible
///   1–2    : requires close observation
///   2–10   : perceptible at a glance
///   11–49  : colors are more similar than opposite
///   100    : exact opposite
double deltaE(LabColor c1, LabColor c2) {
  final dl = c1.l - c2.l;
  final da = c1.a - c2.a;
  final db = c1.b - c2.b;
  return math.sqrt(dl * dl + da * da + db * db);
}

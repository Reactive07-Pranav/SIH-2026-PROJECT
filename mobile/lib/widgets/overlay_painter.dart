import 'package:flutter/material.dart';

/// Paints the camera framing guide used while capturing evidence.
///
/// The guide intentionally does not attempt marker detection. Operators use
/// the four-corner tap flow after capture, which is deterministic and works on
/// devices where OpenCV native bindings are unavailable.
class OverlayPainter extends CustomPainter {
  const OverlayPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final card = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.43),
      width: size.width * 0.84,
      height: size.height * 0.42,
    );
    final strip = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.70),
      width: size.width * 0.48,
      height: size.height * 0.09,
    );

    // Dim the preview outside the two useful regions.
    final dimPaint = Paint()..color = Colors.black.withAlpha(115);
    final full = Path()..addRect(Offset.zero & size);
    final holes = Path()
      ..addRect(card)
      ..addRect(strip);
    canvas.drawPath(
      Path.combine(PathOperation.difference, full, holes),
      dimPaint,
    );

    _drawDashedRect(canvas, card, const Color(0xFF80CBC4), 3);
    _drawDashedRect(canvas, strip, const Color(0xFFFFD54F), 2);

    _drawLabel(
      canvas,
      'PLACE COLOR CARD HERE',
      Offset(card.left, card.top - 28),
      const Color(0xFF80CBC4),
    );
    _drawLabel(
      canvas,
      'TEST STRIP ZONE',
      Offset(strip.left, strip.bottom + 8),
      const Color(0xFFFFD54F),
    );
  }

  void _drawDashedRect(Canvas canvas, Rect rect, Color color, double width) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = width
      ..style = PaintingStyle.stroke;
    const dash = 12.0;
    const gap = 7.0;

    void drawHorizontal(double y) {
      var x = rect.left;
      while (x < rect.right) {
        canvas.drawLine(
          Offset(x, y),
          Offset((x + dash).clamp(rect.left, rect.right), y),
          paint,
        );
        x += dash + gap;
      }
    }

    void drawVertical(double x) {
      var y = rect.top;
      while (y < rect.bottom) {
        canvas.drawLine(
          Offset(x, y),
          Offset(x, (y + dash).clamp(rect.top, rect.bottom)),
          paint,
        );
        y += dash + gap;
      }
    }

    drawHorizontal(rect.top);
    drawHorizontal(rect.bottom);
    drawVertical(rect.left);
    drawVertical(rect.right);
  }

  void _drawLabel(Canvas canvas, String text, Offset offset, Color color) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.7,
          shadows: const [Shadow(color: Colors.black, blurRadius: 3)],
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant OverlayPainter oldDelegate) => false;
}

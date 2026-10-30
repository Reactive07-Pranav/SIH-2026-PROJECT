import 'dart:io';
import 'package:flutter/material.dart';
import '../pipeline/image_processor.dart';
import '../pipeline/models.dart';
import '../widgets/corner_marker.dart';

class CornerSelectionScreen extends StatefulWidget {
  final String imagePath;

  const CornerSelectionScreen({super.key, required this.imagePath});

  @override
  State<CornerSelectionScreen> createState() => _CornerSelectionScreenState();
}

class _CornerSelectionScreenState extends State<CornerSelectionScreen> {
  final List<Offset> _corners = [];
  bool _isProcessing = false;

  // Global key to get the image render box for coordinate mapping.
  final GlobalKey _imageKey = GlobalKey();

  static const _labels = [
    'Top-Left',
    'Top-Right',
    'Bottom-Right',
    'Bottom-Left',
  ];

  void _onTapImage(TapDownDetails details) {
    if (_corners.length >= 4 || _isProcessing) return;

    final RenderBox? renderBox =
        _imageKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return;

    final localPos = renderBox.globalToLocal(details.globalPosition);
    final size = renderBox.size;

    // Store corners as fractions [0..1] so they're resolution-independent.
    final normalized = Offset(
      (localPos.dx / size.width).clamp(0.0, 1.0),
      (localPos.dy / size.height).clamp(0.0, 1.0),
    );

    setState(() => _corners.add(normalized));
  }

  void _undoLast() {
    if (_corners.isEmpty || _isProcessing) return;
    setState(() => _corners.removeLast());
  }

  void _resetCorners() {
    if (_isProcessing) return;
    setState(() => _corners.clear());
  }

  Future<void> _processImage() async {
    if (_corners.length != 4) return;

    setState(() => _isProcessing = true);

    try {
      // Read actual image dimensions to convert fractional corners to pixels.
      final file = File(widget.imagePath);
      final bytes = await file.readAsBytes();
      final decoded = await decodeImageFromList(bytes);
      final imgW = decoded.width.toDouble();
      final imgH = decoded.height.toDouble();

      final pixelCorners = CornerPoints(
        topLeft: Offset(_corners[0].dx * imgW, _corners[0].dy * imgH),
        topRight: Offset(_corners[1].dx * imgW, _corners[1].dy * imgH),
        bottomRight: Offset(_corners[2].dx * imgW, _corners[2].dy * imgH),
        bottomLeft: Offset(_corners[3].dx * imgW, _corners[3].dy * imgH),
      );

      final processor = ImageProcessor();
      final result = await processor.process(widget.imagePath, pixelCorners);

      if (!mounted) return;

      Navigator.of(context).pushReplacementNamed(
        '/result',
        arguments: {
          'processingResult': result,
          'imagePath': widget.imagePath,
        },
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Processing failed: $e'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final nextLabel =
        _corners.length < 4 ? _labels[_corners.length] : 'Done';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Card Corners'),
        actions: [
          IconButton(
            icon: const Icon(Icons.undo),
            onPressed: _corners.isEmpty ? null : _undoLast,
            tooltip: 'Undo last point',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _corners.isEmpty ? null : _resetCorners,
            tooltip: 'Reset all',
          ),
        ],
      ),
      body: Column(
        children: [
          // Instructions bar.
          Container(
            width: double.infinity,
            color: Theme.of(context).colorScheme.primaryContainer,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Icon(
                  _corners.length < 4 ? Icons.touch_app : Icons.check_circle,
                  color: Colors.white70,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _corners.length < 4
                        ? 'Tap corner ${_corners.length + 1}/4: $nextLabel'
                        : 'All corners selected — tap Process',
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                ),
                // Show small dot indicators.
                ...List.generate(4, (i) {
                  return Container(
                    margin: const EdgeInsets.only(left: 4),
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _corners.length
                          ? Theme.of(context).colorScheme.secondary
                          : Colors.white24,
                    ),
                  );
                }),
              ],
            ),
          ),

          // Image with corner markers.
          Expanded(
            child: GestureDetector(
              onTapDown: _onTapImage,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // The captured image.
                  Image.file(
                    File(widget.imagePath),
                    key: _imageKey,
                    fit: BoxFit.contain,
                  ),

                  // Overlay that positions markers relative to the image widget.
                  LayoutBuilder(
                    builder: (context, constraints) {
                      return Stack(
                        children: [
                          // Draw connecting lines when we have points.
                          if (_corners.length >= 2)
                            CustomPaint(
                              size: constraints.biggest,
                              painter: _CornerLinePainter(
                                corners: _corners,
                                size: constraints.biggest,
                              ),
                            ),

                          // Draw individual corner markers.
                          for (int i = 0; i < _corners.length; i++)
                            Positioned(
                              left: _corners[i].dx * constraints.maxWidth - 16,
                              top: _corners[i].dy * constraints.maxHeight - 16,
                              child: CornerMarker(index: i + 1),
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

          // Bottom action bar.
          Container(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: (_corners.length == 4 && !_isProcessing)
                    ? _processImage
                    : null,
                icon: _isProcessing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.auto_fix_high),
                label: Text(_isProcessing ? 'Processing…' : 'Process Image'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Paints connecting lines between selected corner points.
class _CornerLinePainter extends CustomPainter {
  final List<Offset> corners;
  final Size size;

  _CornerLinePainter({required this.corners, required this.size});

  @override
  void paint(Canvas canvas, Size canvasSize) {
    if (corners.length < 2) return;

    final paint = Paint()
      ..color = const Color(0xFF80CBC4)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final path = Path();
    final first = Offset(corners[0].dx * size.width, corners[0].dy * size.height);
    path.moveTo(first.dx, first.dy);

    for (int i = 1; i < corners.length; i++) {
      final pt = Offset(corners[i].dx * size.width, corners[i].dy * size.height);
      path.lineTo(pt.dx, pt.dy);
    }

    // Close the polygon when all 4 points are placed.
    if (corners.length == 4) {
      path.close();
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_CornerLinePainter oldDelegate) =>
      oldDelegate.corners.length != corners.length;
}

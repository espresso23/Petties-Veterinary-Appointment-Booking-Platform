import 'package:flutter/material.dart';
import 'dart:math' as math;

/// Custom painter for radar sweep overlay effect
class RadarOverlayPainter extends CustomPainter {
  final double angle;
  final Offset center;

  RadarOverlayPainter({required this.angle, required this.center});

  @override
  void paint(Canvas canvas, Size size) {
    const radius = 150.0;

    // Draw radar sweep gradient
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: angle,
        endAngle: angle + math.pi / 3,
        colors: [
          Colors.green.withOpacity(0),
          Colors.green.withOpacity(0.1),
          Colors.green.withOpacity(0.2),
          Colors.green.withOpacity(0.1),
          Colors.green.withOpacity(0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, sweepPaint);

    // Draw radar rings
    final ringPaint = Paint()
      ..color = Colors.green.withOpacity(0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    for (int i = 1; i <= 3; i++) {
      canvas.drawCircle(center, radius * i / 3, ringPaint);
    }
  }

  @override
  bool shouldRepaint(covariant RadarOverlayPainter oldDelegate) {
    return angle != oldDelegate.angle;
  }
}

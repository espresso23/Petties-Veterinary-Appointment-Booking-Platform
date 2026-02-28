import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

class MapUtils {
  static Future<BitmapDescriptor> createCustomMarker({
    IconData? iconData,
    Color? color,
    String? imageUrl,
  }) async {
    final ui.PictureRecorder pictureRecorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(pictureRecorder);
    const double size = 150.0;
    const double shadowSize = 10.0;

    // Draw background circle with shadow
    final Paint shadowPaint = Paint()
      ..color = Colors.black.withOpacity(0.3)
      ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, shadowSize);
    canvas.drawCircle(
        const Offset(size / 2, size / 2), size / 2 - shadowSize, shadowPaint);

    final Paint borderPaint = Paint()..color = Colors.white;
    canvas.drawCircle(
        const Offset(size / 2, size / 2), size / 2 - shadowSize, borderPaint);

    if (imageUrl != null && imageUrl.isNotEmpty) {
      try {
        final http.Response response = await http.get(Uri.parse(imageUrl));
        final ui.Codec codec =
            await ui.instantiateImageCodec(response.bodyBytes);
        final ui.FrameInfo frameInfo = await codec.getNextFrame();
        final ui.Image image = frameInfo.image;

        canvas.save();
        final Path path = Path()
          ..addOval(Rect.fromCircle(
            center: const Offset(size / 2, size / 2),
            radius: size / 2 - shadowSize - 5,
          ));
        canvas.clipPath(path);

        final double srcWidth = image.width.toDouble();
        final double srcHeight = image.height.toDouble();
        final double dstSide = size - (shadowSize + 5) * 2;

        canvas.drawImageRect(
            image,
            Rect.fromLTWH(0, 0, srcWidth, srcHeight),
            Rect.fromLTWH(shadowSize + 5, shadowSize + 5, dstSide, dstSide),
            Paint()..filterQuality = ui.FilterQuality.high);
        canvas.restore();
      } catch (e) {
        debugPrint('Error loading marker image: $e');
        _drawFallbackIcon(canvas, size, shadowSize, color ?? Colors.grey,
            iconData ?? Icons.person);
      }
    } else {
      _drawFallbackIcon(canvas, size, shadowSize, color ?? Colors.grey,
          iconData ?? Icons.person);
    }

    final ui.Image finalImage = await pictureRecorder
        .endRecording()
        .toImage(size.toInt(), size.toInt());
    final ByteData? byteData =
        await finalImage.toByteData(format: ui.ImageByteFormat.png);
    return BitmapDescriptor.fromBytes(byteData!.buffer.asUint8List());
  }

  static void _drawFallbackIcon(Canvas canvas, double size, double shadowSize,
      Color color, IconData iconData) {
    final Paint circlePaint = Paint()..color = color;
    canvas.drawCircle(
        Offset(size / 2, size / 2), size / 2 - shadowSize - 5, circlePaint);

    final TextPainter textPainter =
        TextPainter(textDirection: TextDirection.ltr);
    textPainter.text = TextSpan(
      text: String.fromCharCode(iconData.codePoint),
      style: TextStyle(
        fontSize: size * 0.4,
        fontFamily: iconData.fontFamily,
        package: iconData.fontPackage,
        color: Colors.white,
      ),
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        size / 2 - textPainter.width / 2,
        size / 2 - textPainter.height / 2,
      ),
    );
  }
}

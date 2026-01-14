import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';

class CameraScreen extends StatefulWidget {
  final Function(File) onImageCaptured;

  const CameraScreen({
    super.key,
    required this.onImageCaptured,
  });

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras!.isNotEmpty) {
        _controller = CameraController(
          _cameras![0], // Use the first available camera
          ResolutionPreset.high,
          enableAudio: false,
        );

        await _controller!.initialize();
        if (mounted) {
          setState(() {
            _isInitialized = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể khởi tạo camera')),
        );
        Navigator.of(context).pop();
      }
    }
  }

  Future<void> _takePicture() async {
    if (!_isInitialized || _controller == null) return;

    try {
      final image = await _controller!.takePicture();
      final file = File(image.path);
      // Just pop with the file - let caller handle the callback
      // The callback was already popping, causing double pop
      if (mounted) {
        Navigator.of(context).pop(file);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể chụp ảnh')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized || _controller == null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: const Center(
          child: CircularProgressIndicator(
            color: Colors.white,
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Camera preview
          CameraPreview(_controller!),

          // Cancel button
          Positioned(
            top: 40,
            left: 20,
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.close,
                  color: Colors.white,
                  size: 30,
                ),
              ),
            ),
          ),

          // Capture button
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Center(
              child: GestureDetector(
                onTap: _takePicture,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white,
                      width: 4,
                    ),
                  ),
                  child: Container(
                    margin: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
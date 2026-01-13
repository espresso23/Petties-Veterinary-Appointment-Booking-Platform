import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'camera_screen.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/chat.dart';

/// Widget nhập tin nhắn
class MessageInput extends StatefulWidget {
  final Function(String) onSend;
  final Future<ChatMessage> Function(File)? onImageUpload;
  final Function(String, File)? onSendCombined; // text, imageFile
  final Function(bool)? onTyping;
  final bool isLoading;

  const MessageInput({
    super.key,
    required this.onSend,
    this.onImageUpload,
    this.onSendCombined,
    this.onTyping,
    this.isLoading = false,
  });

  @override
  State<MessageInput> createState() => _MessageInputState();
}

class _MessageInputState extends State<MessageInput> {
  final TextEditingController _controller = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();
  bool _hasText = false;
  Timer? _typingTimer;
  File? _selectedImage;
  bool _isUploadingImage = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }

    // Trigger typing indicator
    if (widget.onTyping != null && hasText) {
      widget.onTyping!(true);

      // Cancel previous timer
      _typingTimer?.cancel();

      // Set timer to stop typing after 1 second of inactivity
      _typingTimer = Timer(const Duration(milliseconds: 1000), () {
        widget.onTyping!(false);
      });
    }
  }

  void _handleSend() {
    final text = _controller.text.trim();
    print('DEBUG: _handleSend called with text: "$text", hasImage: ${_selectedImage != null}');

    if (text.isEmpty && _selectedImage == null || widget.isLoading) {
      print('DEBUG: Early return - no content or loading');
      return;
    }

    // Stop typing indicator
    _typingTimer?.cancel();
    widget.onTyping?.call(false);

    // If both text and image are present, handle combined message
    if (text.isNotEmpty && _selectedImage != null) {
      print('DEBUG: Calling _handleSendCombined');
      _handleSendCombined(text);
    } else if (text.isNotEmpty) {
      print('DEBUG: Sending text only');
      // Text only
      widget.onSend(text);
      _controller.clear();
    } else if (_selectedImage != null) {
      print('DEBUG: Sending image only');
      // Image only
      _uploadImage();
    }
  }

  Future<void> _handleSendCombined(String text) async {
    if (_selectedImage == null) return;

    print('DEBUG: _handleSendCombined called with text: "$text" and image: ${_selectedImage!.path}');

    setState(() {
      _isUploadingImage = true;
    });

    try {
      // Send combined message with text and image file in one request
      print('DEBUG: Sending combined message with file...');
      widget.onSendCombined!(text, _selectedImage!);
      print('DEBUG: Combined message sent successfully');

      // Clear both text and image
      _controller.clear();
      setState(() {
        _selectedImage = null;
      });
    } catch (e) {
      print('DEBUG: Error in _handleSendCombined: $e');
      // Don't clear text on error so user can try again
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể gửi tin nhắn')),
      );
    } finally {
      setState(() {
        _isUploadingImage = false;
      });
    }
  }

  Future<void> _pickImage() async {
    // Xin quyền truy cập ảnh
    final status = await Permission.photos.request();
    if (status.isGranted) {
      try {
        final pickedFile = await _imagePicker.pickImage(
          source: ImageSource.gallery,
          maxWidth: 1920,
          maxHeight: 1080,
          imageQuality: 85,
        );
        if (pickedFile != null) {
          setState(() {
            _selectedImage = File(pickedFile.path);
          });
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể chọn hình ảnh')),
        );
      }
    } else if (status.isDenied || status.isPermanentlyDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ứng dụng cần quyền truy cập ảnh để gửi hình. Vui lòng cấp quyền trong cài đặt.')),
      );
    }
  }

  Future<void> _takePhoto() async {
    // Xin quyền truy cập camera
    final status = await Permission.camera.request();
    if (status.isGranted) {
      // Navigate to custom camera screen
      final result = await Navigator.of(context).push<File>(
        MaterialPageRoute(
          builder: (context) => CameraScreen(
            onImageCaptured: (file) {
              Navigator.of(context).pop(file); // Return the captured image
            },
          ),
        ),
      );

      if (result != null) {
        setState(() {
          _selectedImage = result;
        });
      }
    } else if (status.isDenied || status.isPermanentlyDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ứng dụng cần quyền truy cập camera để chụp hình. Vui lòng cấp quyền trong cài đặt.')),
      );
    }
  }

  Future<void> _uploadImage() async {
    if (_selectedImage == null || widget.onImageUpload == null) return;

    setState(() {
      _isUploadingImage = true;
    });

    try {
      await widget.onImageUpload!(_selectedImage!);
      setState(() {
        _selectedImage = null;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể tải lên hình ảnh')),
      );
    } finally {
      setState(() {
        _isUploadingImage = false;
      });
    }
  }

  void _removeImage() {
    setState(() {
      _selectedImage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Image preview
        if (_selectedImage != null)
          Container(
            padding: const EdgeInsets.all(12),
            color: AppColors.stone50,
            child: Row(
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.stone900, width: 2),
                    boxShadow: [
                      BoxShadow(color: const Color(0xFF1C1917), offset: const Offset(2, 2)),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.file(
                      _selectedImage!,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hình ảnh sẽ được gửi',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone900,
                        ),
                      ),
                      Text(
                        'Nhấn nút gửi để gửi hình ảnh',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.stone500,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: _removeImage,
                  icon: Icon(Icons.close, color: AppColors.stone500),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),

        // Input area
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.white,
            border: Border(
              top: BorderSide(color: AppColors.stone200, width: 1),
            ),
          ),
          child: SafeArea(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Image buttons
                if (widget.onImageUpload != null)
                  Row(
                    children: [
                      // Camera button
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.stone900, width: 2),
                          boxShadow: const [
                            BoxShadow(color: Color(0xFF1C1917), offset: Offset(2, 2)),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: widget.isLoading || _isUploadingImage ? null : _takePhoto,
                            borderRadius: BorderRadius.circular(6),
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Icon(
                                Icons.camera_alt,
                                color: widget.isLoading || _isUploadingImage
                                    ? AppColors.stone400
                                    : AppColors.primary,
                                size: 20,
                              ),
                            ),
                          ),
                        ),
                      ),
                      // Gallery button
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.stone900, width: 2),
                          boxShadow: [
                            BoxShadow(color: const Color(0xFF1C1917), offset: const Offset(2, 2)),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: widget.isLoading || _isUploadingImage ? null : _pickImage,
                            borderRadius: BorderRadius.circular(6),
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Icon(
                                Icons.photo,
                                color: widget.isLoading || _isUploadingImage
                                    ? AppColors.stone400
                                    : AppColors.primary,
                                size: 20,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                // Text input
                Expanded(
                  child: Container(
                    constraints: const BoxConstraints(maxHeight: 120),
                    decoration: BoxDecoration(
                      color: AppColors.stone50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: [
                        BoxShadow(color: const Color(0xFF1C1917), offset: const Offset(2, 2)),
                      ],
                    ),
                    child: TextField(
                      controller: _controller,
                      maxLines: null,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      style: const TextStyle(
                        fontSize: 15,
                        color: AppColors.stone900,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Nhập tin nhắn...',
                        hintStyle: TextStyle(color: AppColors.stone400),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // Send button
                Container(
                  decoration: BoxDecoration(
                    color: (_hasText || _selectedImage != null)
                        ? AppColors.primary
                        : AppColors.stone300,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.stone900, width: 2),
                    boxShadow: (_hasText || _selectedImage != null)
                        ? [
                            BoxShadow(
                                color: AppColors.stone900, offset: const Offset(2, 2)),
                          ]
                        : null,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: (_hasText || _selectedImage != null) && !widget.isLoading && !_isUploadingImage
                          ? _handleSend
                          : null,
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: widget.isLoading || _isUploadingImage
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  color: AppColors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(
                                Icons.send_rounded,
                                color: (_hasText || _selectedImage != null)
                                    ? AppColors.white
                                    : AppColors.stone500,
                                size: 22,
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

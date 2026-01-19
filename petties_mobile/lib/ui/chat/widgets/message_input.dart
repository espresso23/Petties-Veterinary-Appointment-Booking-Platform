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
  List<File> _selectedImages = []; // Changed to list for multi-image support
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
    print('DEBUG: _handleSend called with text: "$text", hasImages: ${_selectedImages.length}');

    if (text.isEmpty && _selectedImages.isEmpty || widget.isLoading) {
      print('DEBUG: Early return - no content or loading');
      return;
    }

    // Stop typing indicator
    _typingTimer?.cancel();
    widget.onTyping?.call(false);

    // If both text and images are present, send text first then all images
    if (text.isNotEmpty && _selectedImages.isNotEmpty) {
      print('DEBUG: Sending text first, then images separately');
      widget.onSend(text);
      _controller.clear();
      _uploadImages();
    } else if (text.isNotEmpty) {
      print('DEBUG: Sending text only');
      // Text only
      widget.onSend(text);
      _controller.clear();
    } else if (_selectedImages.isNotEmpty) {
      print('DEBUG: Sending images only');
      // Images only
      _uploadImages();
    }
  }

  // Upload all selected images one by one
  Future<void> _uploadImages() async {
    if (_selectedImages.isEmpty || widget.onImageUpload == null) return;

    setState(() {
      _isUploadingImage = true;
    });

    int successCount = 0;
    int failCount = 0;
    final imagesToUpload = List<File>.from(_selectedImages);

    try {
      for (final image in imagesToUpload) {
        try {
          print('DEBUG: Uploading image: ${image.path}');
          await widget.onImageUpload!(image);
          successCount++;
          print('DEBUG: Image uploaded successfully');
        } catch (e) {
          print('DEBUG: Failed to upload image: $e');
          failCount++;
        }
      }

      // Clear selected images
      setState(() {
        _selectedImages = [];
      });

      if (failCount > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload: $successCount thành công, $failCount thất bại')),
        );
      }
    } finally {
      setState(() {
        _isUploadingImage = false;
      });
    }
  }

  static const int _maxFileSizeBytes = 10 * 1024 * 1024; // 10MB

  Future<void> _pickImage() async {
    // Xin quyền truy cập ảnh
    final status = await Permission.photos.request();
    if (status.isGranted) {
      try {
        // Changed to pickMultiImage for multi-selection
        final pickedFiles = await _imagePicker.pickMultiImage(
          maxWidth: 1920,
          maxHeight: 1080,
          imageQuality: 85,
        );
        if (pickedFiles.isNotEmpty) {
          List<File> validFiles = [];
          List<String> oversizedFiles = [];
          
          for (final xfile in pickedFiles) {
            final file = File(xfile.path);
            final fileSize = await file.length();
            
            if (fileSize > _maxFileSizeBytes) {
              oversizedFiles.add(xfile.name);
            } else {
              validFiles.add(file);
            }
          }
          
          if (oversizedFiles.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('${oversizedFiles.length} ảnh vượt quá 10MB và không được thêm'),
                backgroundColor: Colors.orange,
              ),
            );
          }
          
          if (validFiles.isNotEmpty) {
            setState(() {
              _selectedImages.addAll(validFiles);
            });
          }
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
      try {
        // Navigate to custom camera screen and wait for result
        final result = await Navigator.of(context).push<File>(
          MaterialPageRoute(
            builder: (context) => CameraScreen(
              onImageCaptured: (_) {}, // Not used anymore, result returned via pop
            ),
          ),
        );

        if (result != null && mounted) {
          final fileSize = await result.length();
          if (fileSize > _maxFileSizeBytes) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Ảnh vượt quá 10MB, vui lòng chụp với chất lượng thấp hơn'),
                backgroundColor: Colors.orange,
              ),
            );
          } else {
            setState(() {
              _selectedImages.add(result);
            });
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không thể mở camera')),
          );
        }
      }
    } else if (status.isDenied || status.isPermanentlyDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ứng dụng cần quyền truy cập camera để chụp hình. Vui lòng cấp quyền trong cài đặt.')),
      );
    }
  }

  void _removeImage(int index) {
    setState(() {
      _selectedImages.removeAt(index);
    });
  }

  void _clearAllImages() {
    setState(() {
      _selectedImages = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Image preview for multiple images
        if (_selectedImages.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            color: AppColors.stone50,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _selectedImages.length == 1
                          ? 'Hình ảnh sẽ được gửi'
                          : '${_selectedImages.length} hình ảnh sẽ được gửi',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.stone900,
                      ),
                    ),
                    if (_selectedImages.length > 1)
                      TextButton(
                        onPressed: _clearAllImages,
                        child: const Text(
                          'Xóa tất cả',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.error,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (int i = 0; i < _selectedImages.length; i++)
                        Container(
                          margin: const EdgeInsets.only(right: 8),
                          child: Stack(
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
                                    _selectedImages[i],
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                              Positioned(
                                top: -4,
                                right: -4,
                                child: GestureDetector(
                                  onTap: () => _removeImage(i),
                                  child: Container(
                                    width: 20,
                                    height: 20,
                                    decoration: BoxDecoration(
                                      color: AppColors.error,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: AppColors.white, width: 1.5),
                                    ),
                                    child: const Icon(
                                      Icons.close,
                                      size: 12,
                                      color: AppColors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
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
                    color: (_hasText || _selectedImages.isNotEmpty)
                        ? AppColors.primary
                        : AppColors.stone300,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.stone900, width: 2),
                    boxShadow: (_hasText || _selectedImages.isNotEmpty)
                        ? [
                            BoxShadow(
                                color: AppColors.stone900, offset: const Offset(2, 2)),
                          ]
                        : null,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: (_hasText || _selectedImages.isNotEmpty) && !widget.isLoading && !_isUploadingImage
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
                                color: (_hasText || _selectedImages.isNotEmpty)
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

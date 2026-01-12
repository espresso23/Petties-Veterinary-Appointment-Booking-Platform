import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../config/constants/app_colors.dart';

/// Avatar picker widget with Neobrutalism style
/// Supports picking from gallery or camera, and displays current avatar
class AvatarPicker extends StatefulWidget {
  /// Current avatar URL (null if no avatar)
  final String? avatarUrl;

  /// Callback when image is selected
  final void Function(File imageFile)? onImageSelected;

  /// Callback when delete is pressed
  final VoidCallback? onDelete;

  /// Whether upload is in progress
  final bool isLoading;

  /// Size of the avatar (default 120)
  final double size;

  /// Whether editing is enabled
  final bool editable;

  const AvatarPicker({
    super.key,
    this.avatarUrl,
    this.onImageSelected,
    this.onDelete,
    this.isLoading = false,
    this.size = 120,
    this.editable = true,
  });

  @override
  State<AvatarPicker> createState() => _AvatarPickerState();
}

class _AvatarPickerState extends State<AvatarPicker> {
  final ImagePicker _picker = ImagePicker();
  File? _selectedImage;

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        final file = File(pickedFile.path);
        setState(() {
          _selectedImage = file;
        });
        widget.onImageSelected?.call(file);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Không thể chọn ảnh: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _showPickerOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildPickerBottomSheet(),
    );
  }

  Widget _buildPickerBottomSheet() {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.stone900, width: 4),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(6, 6)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.primaryBackground,
              border: Border(
                bottom: BorderSide(color: AppColors.stone900, width: 4),
              ),
            ),
            child: const Text(
              'CHỌN ẢNH ĐẠI DIỆN',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
              textAlign: TextAlign.center,
            ),
          ),

          // Camera option
          _buildOptionTile(
            icon: Icons.camera_alt,
            label: 'CHỤP ẢNH MỚI',
            onTap: () {
              Navigator.pop(context);
              _pickImage(ImageSource.camera);
            },
          ),

          // Divider
          Container(
            height: 2,
            color: AppColors.stone200,
          ),

          // Gallery option
          _buildOptionTile(
            icon: Icons.photo_library,
            label: 'CHỌN TỪ THƯ VIỆN',
            onTap: () {
              Navigator.pop(context);
              _pickImage(ImageSource.gallery);
            },
          ),

          // Show delete option if avatar exists
          if (widget.avatarUrl != null || _selectedImage != null) ...[
            Container(
              height: 2,
              color: AppColors.stone200,
            ),
            _buildOptionTile(
              icon: Icons.delete_outline,
              label: 'XÓA ẢNH ĐẠI DIỆN',
              color: AppColors.error,
              onTap: () {
                Navigator.pop(context);
                setState(() {
                  _selectedImage = null;
                });
                widget.onDelete?.call();
              },
            ),
          ],

          // Cancel button
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: AppColors.stone900, width: 4),
              ),
            ),
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text(
                'HUỶ',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone600,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOptionTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: (color ?? AppColors.primary).withOpacity(0.1),
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: Icon(icon, color: color ?? AppColors.primary, size: 24),
            ),
            const SizedBox(width: 16),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: color ?? AppColors.stone900,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.editable && !widget.isLoading ? _showPickerOptions : null,
      child: Stack(
        children: [
          // Avatar container with Soft Neobrutalism circular style
          Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: AppColors.stone100,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
              ],
            ),
            child: ClipOval(
              child: _buildAvatarContent(),
            ),
          ),

          // Edit button (bottom right) - circular style
          if (widget.editable)
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                  ],
                ),
                child: Icon(
                  widget.isLoading ? Icons.hourglass_empty : Icons.camera_alt,
                  color: AppColors.white,
                  size: 18,
                ),
              ),
            ),

          // Loading overlay - circular
          if (widget.isLoading)
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: AppColors.black.withOpacity(0.5),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: const Center(
                child: CircularProgressIndicator(
                  color: AppColors.primary,
                  strokeWidth: 3,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAvatarContent() {
    // Show selected image first
    if (_selectedImage != null) {
      return Image.file(
        _selectedImage!,
        fit: BoxFit.cover,
        width: widget.size,
        height: widget.size,
      );
    }

    // Show network avatar
    if (widget.avatarUrl != null && widget.avatarUrl!.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: widget.avatarUrl!,
        fit: BoxFit.cover,
        width: widget.size,
        height: widget.size,
        placeholder: (context, url) => const Center(
          child: CircularProgressIndicator(
            color: AppColors.primary,
            strokeWidth: 2,
          ),
        ),
        errorWidget: (context, url, error) => _buildPlaceholder(),
      );
    }

    // Show placeholder
    return _buildPlaceholder();
  }

  Widget _buildPlaceholder() {
    return Container(
      width: widget.size,
      height: widget.size,
      color: AppColors.stone100,
      child: Icon(
        Icons.person,
        size: widget.size * 0.5,
        color: AppColors.stone400,
      ),
    );
  }
}

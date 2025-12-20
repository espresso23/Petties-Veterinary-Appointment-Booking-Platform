import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../config/constants/app_colors.dart';
import '../../../providers/user_provider.dart';
import '../../widgets/profile/avatar_picker.dart';
import '../../widgets/profile/email_inline_edit.dart';

/// Edit Profile Screen
/// Allows editing fullName, phone, and avatar
/// Available for PET_OWNER and VET roles
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _fullNameController;
  late TextEditingController _phoneController;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    final profile = context.read<UserProvider>().profile;
    _fullNameController = TextEditingController(text: profile?.fullName ?? '');
    _phoneController = TextEditingController(text: profile?.phone ?? '');

    _fullNameController.addListener(_onFieldChanged);
    _phoneController.addListener(_onFieldChanged);
  }

  @override
  void dispose() {
    _fullNameController.removeListener(_onFieldChanged);
    _phoneController.removeListener(_onFieldChanged);
    _fullNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _onFieldChanged() {
    final profile = context.read<UserProvider>().profile;
    final hasChanges = _fullNameController.text != (profile?.fullName ?? '') ||
        _phoneController.text != (profile?.phone ?? '');

    if (hasChanges != _hasChanges) {
      setState(() {
        _hasChanges = hasChanges;
      });
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    final userProvider = context.read<UserProvider>();
    final success = await userProvider.updateProfile(
      fullName: _fullNameController.text.trim(),
      phone: _phoneController.text.trim(),
    );

    if (success && mounted) {
      _showSuccessMessage('Cập nhật thông tin thành công');
      setState(() {
        _hasChanges = false;
      });
    } else if (mounted && userProvider.error != null) {
      _showErrorMessage(userProvider.error!);
    }
  }

  void _showSuccessMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: AppColors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _showErrorMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  Future<void> _handleBackPress() async {
    if (!_hasChanges) {
      if (mounted) context.pop();
      return;
    }

    final shouldPop = await showDialog<bool>(
      context: context,
      builder: (context) => _buildDiscardDialog(),
    );
    if (shouldPop == true && mounted) {
      context.pop();
    }
  }

  Widget _buildDiscardDialog() {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(24),
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
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.1),
                border: Border.all(color: AppColors.stone900, width: 3),
              ),
              child: const Icon(
                Icons.warning_amber_outlined,
                color: AppColors.warning,
                size: 40,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'HỦY THAY ĐỔI?',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Bạn có thay đổi chưa lưu. Bạn có chắc muốn thoát?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.stone600,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _buildDialogButton(
                    label: 'Ở LẠI',
                    onTap: () => Navigator.pop(context, false),
                    isPrimary: false,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDialogButton(
                    label: 'THOÁT',
                    onTap: () => Navigator.pop(context, true),
                    isPrimary: true,
                    isDestructive: true,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDialogButton({
    required String label,
    required VoidCallback onTap,
    bool isPrimary = true,
    bool isDestructive = false,
  }) {
    final bgColor = isPrimary
        ? (isDestructive ? AppColors.error : AppColors.primary)
        : AppColors.white;
    final textColor = isPrimary ? AppColors.white : AppColors.stone900;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: bgColor,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
          ],
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: textColor,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await showDialog<bool>(
          context: context,
          builder: (context) => _buildDiscardDialog(),
        );
        if (shouldPop == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.stone50,
        appBar: _buildAppBar(),
        body: Consumer<UserProvider>(
          builder: (context, userProvider, child) {
            return SingleChildScrollView(
              child: Column(
                children: [
                  // Avatar section
                  _buildAvatarSection(userProvider),

                  // Form section
                  _buildFormSection(userProvider),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.primary,
      elevation: 0,
      centerTitle: true,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: _handleBackPress,
      ),
      title: const Text(
        'CHỈNH SỬA HỒ SƠ',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.white,
          letterSpacing: 2,
        ),
      ),
    );
  }

  Widget _buildAvatarSection(UserProvider userProvider) {
    final profile = userProvider.profile;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: AppColors.primaryBackground,
        border: Border(
          bottom: BorderSide(color: AppColors.stone900, width: 4),
        ),
      ),
      child: Column(
        children: [
          AvatarPicker(
            avatarUrl: profile?.avatar,
            isLoading: userProvider.isUploadingAvatar,
            size: 120,
            editable: true,
            onImageSelected: (file) => userProvider.uploadAvatar(file),
            onDelete: () => userProvider.deleteAvatar(),
          ),
          const SizedBox(height: 12),
          const Text(
            'Chạm vào để thay đổi ảnh đại diện',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.stone500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormSection(UserProvider userProvider) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),

            // Full name field
            _buildFieldLabel('HỌ VÀ TÊN'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _fullNameController,
              hint: 'Nhập họ và tên của bạn',
              icon: Icons.person_outline,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Vui lòng nhập họ và tên';
                }
                if (value.trim().length < 2) {
                  return 'Họ và tên phải có ít nhất 2 ký tự';
                }
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Phone field
            _buildFieldLabel('SỐ ĐIỆN THOẠI'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _phoneController,
              hint: 'Nhập số điện thoại',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              validator: (value) {
                if (value != null && value.isNotEmpty) {
                  // Vietnamese phone number validation
                  final phoneRegex = RegExp(r'^(0|\+84)[0-9]{9,10}$');
                  if (!phoneRegex.hasMatch(value.replaceAll(' ', ''))) {
                    return 'Số điện thoại không hợp lệ';
                  }
                }
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Email field
            EmailInlineEdit(
              currentEmail: userProvider.profile?.email,
              isFormStyle: true,
            ),
            const SizedBox(height: 20),

            // Username field (read-only)
            _buildFieldLabel('TÊN ĐANG NHẬP'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: TextEditingController(
                  text: userProvider.profile?.username ?? ''),
              hint: '',
              icon: Icons.account_circle_outlined,
              enabled: false,
            ),
            const SizedBox(height: 8),
            const Text(
              'Tên đăng nhập không thể thay đổi',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.stone500,
                fontStyle: FontStyle.italic,
              ),
            ),

            const SizedBox(height: 32),

            // Save button
            _buildSaveButton(userProvider),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: AppColors.stone600,
        letterSpacing: 1,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
    bool enabled = true,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: enabled ? AppColors.white : AppColors.stone100,
        border: Border.all(color: AppColors.stone900, width: 3),
        boxShadow: enabled
            ? const [BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))]
            : null,
      ),
      child: TextFormField(
        controller: controller,
        enabled: enabled,
        keyboardType: keyboardType,
        validator: validator,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: enabled ? AppColors.stone900 : AppColors.stone500,
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(
            color: AppColors.stone400,
            fontWeight: FontWeight.normal,
          ),
          prefixIcon: Icon(
            icon,
            color: enabled ? AppColors.primary : AppColors.stone400,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          errorStyle: const TextStyle(
            color: AppColors.error,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  Widget _buildSaveButton(UserProvider userProvider) {
    final isUpdating = userProvider.isUpdating;

    return InkWell(
      onTap: (_hasChanges && !isUpdating) ? _handleSave : null,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: (_hasChanges && !isUpdating)
              ? AppColors.primary
              : AppColors.stone300,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: (_hasChanges && !isUpdating)
              ? const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
                ]
              : null,
        ),
        child: isUpdating
            ? const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    color: AppColors.white,
                    strokeWidth: 3,
                  ),
                ),
              )
            : Text(
                'LƯU THAY ĐỔI',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: (_hasChanges && !isUpdating)
                      ? AppColors.white
                      : AppColors.stone500,
                  letterSpacing: 1,
                ),
              ),
      ),
    );
  }
}

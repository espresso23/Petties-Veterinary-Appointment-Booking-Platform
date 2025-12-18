import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/services/auth_service.dart';
import '../../routing/app_routes.dart';
import '../../config/constants/app_colors.dart';

/// Forgot Password Screen - Neobrutalism Style
/// Step 1: User nhap email de nhan ma OTP
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _authService = AuthService();

  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _authService.forgotPassword(
        email: _emailController.text.trim(),
      );

      if (mounted) {
        _showSuccessToast(response.message);
        // Navigate to reset password screen with email
        context.push(
          '${AppRoutes.resetPassword}?email=${Uri.encodeComponent(_emailController.text.trim())}&cooldown=${response.resendCooldownSeconds}',
        );
      }
    } catch (e) {
      setState(() => _error = _extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _extractErrorMessage(dynamic e) {
    final errorStr = e.toString();

    if (errorStr.contains('SocketException') || errorStr.contains('Failed host lookup')) {
      return 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.';
    }
    if (errorStr.contains('404')) {
      return 'Email không tồn tại trong hệ thống.';
    }
    if (errorStr.contains('400')) {
      return 'Email không hợp lệ.';
    }
    if (errorStr.contains('429')) {
      return 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
    }
    if (errorStr.contains('message')) {
      return errorStr.split('message:').last.trim();
    }
    return errorStr.replaceAll('Exception: ', '');
  }

  void _showSuccessToast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: AppColors.stone900, width: 3),
        ),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: Column(
          children: [
            // Scrollable content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  children: [
                    // Back button
                    Padding(
                      padding: const EdgeInsets.only(top: 16.0),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: () => context.pop(),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.stone900, width: 2),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.arrow_back, size: 18, color: AppColors.stone700),
                                const SizedBox(width: 8),
                                Text(
                                  'Quay lại',
                                  style: TextStyle(
                                    color: AppColors.stone700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Header
                    Center(
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.primaryBackground,
                              border: Border.all(color: AppColors.stone900, width: 4),
                              boxShadow: const [
                                BoxShadow(color: AppColors.stone900, offset: Offset(6, 6)),
                              ],
                            ),
                            child: const Icon(Icons.lock_reset, size: 48, color: AppColors.primary),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'Quên mật khẩu?',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: AppColors.stone900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Nhập email của bạn để nhận mã xác thực',
                            style: TextStyle(
                              fontSize: 14,
                              color: AppColors.stone600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Error message
                    if (_error != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          border: Border.all(color: AppColors.error, width: 3),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, color: AppColors.error),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Form Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        border: Border.all(color: AppColors.stone900, width: 4),
                        boxShadow: const [
                          BoxShadow(color: AppColors.stone900, offset: Offset(8, 8)),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Email Field
                            const Text(
                              'Địa chỉ Email',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildBrutalTextField(
                              controller: _emailController,
                              hintText: 'Nhập email đã đăng ký',
                              prefixIcon: Icons.email,
                              keyboardType: TextInputType.emailAddress,
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Vui lòng nhập email';
                                }
                                if (!value.contains('@') || !value.contains('.')) {
                                  return 'Email không hợp lệ';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),

                            // Submit button
                            _BrutalButton(
                              onPressed: _isLoading ? null : _handleSubmit,
                              isLoading: _isLoading,
                              label: 'Gửi mã OTP',
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Fixed bottom section
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 24.0),
              decoration: BoxDecoration(
                color: AppColors.stone50,
                border: Border(
                  top: BorderSide(color: AppColors.stone200, width: 1),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Nhớ mật khẩu rồi? ',
                    style: TextStyle(
                      color: AppColors.stone600,
                      fontSize: 15,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go(AppRoutes.login),
                    child: const Text(
                      'Đăng nhập',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrutalTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData prefixIcon,
    bool obscureText = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
      keyboardType: keyboardType,
      style: const TextStyle(
        fontWeight: FontWeight.w500,
        color: AppColors.stone900,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(color: AppColors.stone400),
        prefixIcon: Icon(prefixIcon, color: AppColors.stone500),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppColors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: const BorderSide(color: AppColors.stone900, width: 3),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: const BorderSide(color: AppColors.stone900, width: 3),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: const BorderSide(color: AppColors.primary, width: 3),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: const BorderSide(color: AppColors.error, width: 3),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: const BorderSide(color: AppColors.error, width: 3),
        ),
      ),
    );
  }
}

/// Neobrutalism styled button
class _BrutalButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final String label;
  final bool isLoading;

  const _BrutalButton({
    required this.onPressed,
    required this.label,
    this.isLoading = false,
  });

  @override
  State<_BrutalButton> createState() => _BrutalButtonState();
}

class _BrutalButtonState extends State<_BrutalButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.onPressed == null || widget.isLoading;

    return GestureDetector(
      onTapDown: isDisabled ? null : (_) => setState(() => _isPressed = true),
      onTapUp: isDisabled ? null : (_) => setState(() => _isPressed = false),
      onTapCancel: isDisabled ? null : () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        width: double.infinity,
        transform: Matrix4.translationValues(
          _isPressed ? 4 : 0,
          _isPressed ? 4 : 0,
          0,
        ),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isDisabled ? AppColors.stone400 : AppColors.primary,
          border: Border.all(color: AppColors.stone900, width: 4),
          boxShadow: [
            BoxShadow(
              color: AppColors.stone900,
              offset: Offset(_isPressed ? 0 : 4, _isPressed ? 0 : 4),
            ),
          ],
        ),
        child: Center(
          child: widget.isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : Text(
                  widget.label,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.white,
                    letterSpacing: 1,
                  ),
                ),
        ),
      ),
    );
  }
}

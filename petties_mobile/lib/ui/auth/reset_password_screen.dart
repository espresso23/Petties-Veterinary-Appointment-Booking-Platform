import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../data/services/auth_service.dart';
import '../../routing/app_routes.dart';
import '../../config/constants/app_colors.dart';
import '../../utils/api_error_handler.dart';

/// Reset Password Screen - Neobrutalism Style
/// Step 2: User nhap OTP va mat khau moi de reset
class ResetPasswordScreen extends StatefulWidget {
  final String email;
  final int? initialCooldown;

  const ResetPasswordScreen({
    super.key,
    required this.email,
    this.initialCooldown,
  });

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();

  // OTP controllers (6 digits)
  final List<TextEditingController> _otpControllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  late final List<FocusNode> _otpFocusNodes;

  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isLoading = false;
  bool _isResending = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  bool _isSuccess = false;
  String? _error;

  // Resend countdown
  int _resendCountdown = 0;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _resendCountdown = widget.initialCooldown ?? 60;
    _startCountdown();

    // Initialize focus nodes with backspace detection
    _otpFocusNodes = List.generate(6, (index) {
      return FocusNode(
        onKeyEvent: (node, event) {
          if (event is KeyDownEvent &&
              event.logicalKey == LogicalKeyboardKey.backspace) {
            // Neu o hien tai dang rong, quay lai o truoc do
            if (_otpControllers[index].text.isEmpty && index > 0) {
              _otpFocusNodes[index - 1].requestFocus();
              return KeyEventResult.handled;
            }
          }
          return KeyEventResult.ignored;
        },
      );
    });
  }

  @override
  void dispose() {
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var node in _otpFocusNodes) {
      node.dispose();
    }
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCountdown > 0) {
        setState(() => _resendCountdown--);
      } else {
        timer.cancel();
      }
    });
  }

  String get _otpCode {
    return _otpControllers.map((c) => c.text).join();
  }

  void _handleOtpInput(String value, int index) {
    if (value.length == 1 && index < 5) {
      _otpFocusNodes[index + 1].requestFocus();
    }
  }

  void _clearOtp() {
    for (var controller in _otpControllers) {
      controller.clear();
    }
    _otpFocusNodes[0].requestFocus();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_otpCode.length != 6) {
      setState(() => _error = 'Vui lòng nhập đủ 6 số OTP');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _authService.resetPassword(
        email: widget.email,
        otpCode: _otpCode,
        newPassword: _newPasswordController.text,
        confirmPassword: _confirmPasswordController.text,
      );

      if (mounted) {
        setState(() => _isSuccess = true);
        _showSuccessToast(response['message'] ?? 'Đổi mật khẩu thành công!');

        // Navigate to login after delay
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            context.go(AppRoutes.login);
          }
        });
      }
    } catch (e) {
      setState(() => _error = _extractErrorMessage(e));
      _clearOtp();
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleResendOtp() async {
    if (_resendCountdown > 0) return;

    setState(() {
      _isResending = true;
      _error = null;
    });

    try {
      final response = await _authService.resendPasswordResetOtp(
        email: widget.email,
      );

      if (mounted) {
        _showSuccessToast(response.message);
        setState(() {
          _resendCountdown = response.resendCooldownSeconds;
        });
        _startCountdown();
        _clearOtp();
      }
    } catch (e) {
      setState(() => _error = _extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isResending = false);
      }
    }
  }

  String _extractErrorMessage(dynamic e) {
    return ApiErrorHandler.getErrorMessage(e);
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
    if (_isSuccess) {
      return _buildSuccessView();
    }

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
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              border:
                                  Border.all(color: AppColors.stone900, width: 2),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.arrow_back,
                                    size: 18, color: AppColors.stone700),
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

                    const SizedBox(height: 24),

                    // Header
                    Center(
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.primaryBackground,
                              border:
                                  Border.all(color: AppColors.stone900, width: 4),
                              boxShadow: const [
                                BoxShadow(
                                    color: AppColors.stone900,
                                    offset: Offset(6, 6)),
                              ],
                            ),
                            child: const Icon(Icons.lock_open,
                                size: 48, color: AppColors.primary),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'Đặt lại mật khẩu',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: AppColors.stone900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Mã OTP đã được gửi đến',
                            style: TextStyle(
                              fontSize: 14,
                              color: AppColors.stone600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.email,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

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
                                style: TextStyle(
                                    color: AppColors.error,
                                    fontWeight: FontWeight.w600),
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
                          BoxShadow(
                              color: AppColors.stone900, offset: Offset(8, 8)),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // OTP Input
                            const Text(
                              'Mã OTP (6 số)',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone900,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: List.generate(
                                6,
                                (index) => _buildOtpBox(index),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Center(
                              child: Text(
                                'Mã có hiệu lực trong 5 phút',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.stone500,
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),

                            // New Password Field
                            const Text(
                              'Mật khẩu mới',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildBrutalTextField(
                              controller: _newPasswordController,
                              hintText: 'Nhập mật khẩu mới (ít nhất 8 ký tự)',
                              prefixIcon: Icons.lock,
                              obscureText: _obscureNewPassword,
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscureNewPassword
                                      ? Icons.visibility
                                      : Icons.visibility_off,
                                  color: AppColors.stone500,
                                ),
                                onPressed: () => setState(
                                    () => _obscureNewPassword = !_obscureNewPassword),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Vui lòng nhập mật khẩu mới';
                                }
                                if (value.length < 8) {
                                  return 'Mật khẩu phải có ít nhất 8 ký tự';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // Confirm Password Field
                            const Text(
                              'Xác nhận mật khẩu',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildBrutalTextField(
                              controller: _confirmPasswordController,
                              hintText: 'Nhập lại mật khẩu mới',
                              prefixIcon: Icons.lock_outline,
                              obscureText: _obscureConfirmPassword,
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscureConfirmPassword
                                      ? Icons.visibility
                                      : Icons.visibility_off,
                                  color: AppColors.stone500,
                                ),
                                onPressed: () => setState(() =>
                                    _obscureConfirmPassword =
                                        !_obscureConfirmPassword),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Vui lòng xác nhận mật khẩu';
                                }
                                if (value != _newPasswordController.text) {
                                  return 'Mật khẩu không khớp';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),

                            // Submit button
                            _BrutalButton(
                              onPressed: _isLoading ? null : _handleSubmit,
                              isLoading: _isLoading,
                              label: 'Đặt lại mật khẩu',
                            ),
                            const SizedBox(height: 16),

                            // Resend OTP button
                            _BrutalOutlineButton(
                              onPressed:
                                  (_resendCountdown > 0 || _isResending)
                                      ? null
                                      : _handleResendOtp,
                              isLoading: _isResending,
                              label: _resendCountdown > 0
                                  ? 'Gửi lại mã (${_resendCountdown}s)'
                                  : 'Gửi lại mã OTP',
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
              padding:
                  const EdgeInsets.symmetric(vertical: 16.0, horizontal: 24.0),
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

  Widget _buildSuccessView() {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: AppColors.white,
              border: Border.all(color: AppColors.stone900, width: 4),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(8, 8)),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.1),
                    border: Border.all(color: AppColors.stone900, width: 4),
                    boxShadow: const [
                      BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
                    ],
                  ),
                  child: const Icon(
                    Icons.check_circle,
                    size: 64,
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'THÀNH CÔNG!',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: AppColors.stone900,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Mật khẩu của bạn đã được cập nhật.\nĐang chuyển đến trang đăng nhập...',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.stone600,
                  ),
                ),
                const SizedBox(height: 24),
                _BrutalButton(
                  onPressed: () => context.go(AppRoutes.login),
                  label: 'Đăng nhập ngay',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOtpBox(int index) {
    return SizedBox(
      width: 45,
      height: 56,
      child: TextFormField(
        controller: _otpControllers[index],
        focusNode: _otpFocusNodes[index],
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 1,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w900,
          color: AppColors.stone900,
        ),
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: AppColors.white,
          contentPadding: EdgeInsets.zero,
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
        ),
        onChanged: (value) {
          _handleOtpInput(value, index);
        },
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
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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

/// Neobrutalism styled outline button
class _BrutalOutlineButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final String label;
  final bool isLoading;

  const _BrutalOutlineButton({
    required this.onPressed,
    required this.label,
    this.isLoading = false,
  });

  @override
  State<_BrutalOutlineButton> createState() => _BrutalOutlineButtonState();
}

class _BrutalOutlineButtonState extends State<_BrutalOutlineButton> {
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
          _isPressed ? 2 : 0,
          _isPressed ? 2 : 0,
          0,
        ),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(
            color: isDisabled ? AppColors.stone400 : AppColors.stone900,
            width: 3,
          ),
          boxShadow: [
            BoxShadow(
              color: isDisabled ? AppColors.stone300 : AppColors.stone900,
              offset: Offset(_isPressed ? 0 : 2, _isPressed ? 0 : 2),
            ),
          ],
        ),
        child: Center(
          child: widget.isLoading
              ? SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(AppColors.stone700),
                  ),
                )
              : Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color:
                        isDisabled ? AppColors.stone400 : AppColors.stone700,
                  ),
                ),
        ),
      ),
    );
  }
}

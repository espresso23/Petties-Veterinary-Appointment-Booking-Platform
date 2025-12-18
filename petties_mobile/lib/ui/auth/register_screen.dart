import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../../data/services/auth_service.dart';
import '../../providers/auth_provider.dart';
import '../../routing/app_routes.dart';
import '../../config/constants/app_colors.dart';
import '../../utils/api_error_handler.dart';

/// Register screen with OTP verification (2-step flow) - Neobrutalism Style
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();
  
  // Form controllers
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  
  // OTP controllers (6 digits)
  final List<TextEditingController> _otpControllers = 
      List.generate(6, (_) => TextEditingController());
  late final List<FocusNode> _otpFocusNodes;
  
  // State
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _error;
  
  // Step: 'form' or 'otp'
  String _step = 'form';
  String _registrationEmail = '';
  
  // Resend countdown
  int _resendCountdown = 0;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
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
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var node in _otpFocusNodes) {
      node.dispose();
    }
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startResendCountdown(int seconds) {
    setState(() => _resendCountdown = seconds);
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCountdown > 0) {
        setState(() => _resendCountdown--);
      } else {
        timer.cancel();
      }
    });
  }

  String _getOtpCode() {
    return _otpControllers.map((c) => c.text).join();
  }

  void _clearOtp() {
    for (var controller in _otpControllers) {
      controller.clear();
    }
    if (_otpFocusNodes.isNotEmpty) {
      _otpFocusNodes[0].requestFocus();
    }
  }

  Future<void> _handleSubmitForm() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _authService.sendRegistrationOtp(
        username: _usernameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
        phone: _phoneController.text.isNotEmpty ? _phoneController.text.trim() : null,
        fullName: _fullNameController.text.trim(),
        role: 'PET_OWNER',
      );

      setState(() {
        _step = 'otp';
        _registrationEmail = _emailController.text.trim();
      });
      
      _startResendCountdown(response.resendCooldownSeconds);
      
      if (mounted) {
        _showSuccessToast(response.message);
      }
    } catch (e) {
      setState(() => _error = _extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleVerifyOtp() async {
    final otpCode = _getOtpCode();
    if (otpCode.length != 6) {
      setState(() => _error = 'Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Dùng AuthProvider để verify OTP - sẽ tự động cập nhật auth state
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final success = await authProvider.verifyOtpAndRegister(
        email: _registrationEmail,
        otpCode: otpCode,
      );

      if (mounted) {
        if (success) {
          _showSuccessToast('Đăng ký thành công!');
          context.go(AppRoutes.home);
        } else {
          setState(() => _error = authProvider.error ?? 'Xác thực thất bại');
          _clearOtp();
        }
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
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _authService.resendOtp(email: _registrationEmail);
      _startResendCountdown(response.resendCooldownSeconds);
      
      if (mounted) {
        _showSuccessToast(response.message);
      }
    } catch (e) {
      setState(() => _error = _extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _handleBackToForm() {
    setState(() {
      _step = 'form';
      _error = null;
    });
    _clearOtp();
    _countdownTimer?.cancel();
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
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: Column(
          children: [
            // Scrollable content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: _step == 'form' ? _buildForm() : _buildOtpVerification(),
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
                    'Đã có tài khoản? ',
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

  Widget _buildForm() {
    return Column(
      children: [
        // Back button
        Padding(
          padding: const EdgeInsets.only(top: 16.0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () => context.go(AppRoutes.login),
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

        const SizedBox(height: 24),

        // Title
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
                child: const Icon(Icons.person_add, size: 48, color: AppColors.primary),
              ),
              const SizedBox(height: 24),
              const Text(
                'Tạo tài khoản',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: AppColors.stone900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Đăng ký để sử dụng Petties',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.stone600,
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
                // Username
                _buildLabel('Tên đăng nhập'),
                _buildBrutalTextField(
                  controller: _usernameController,
                  hintText: 'Nhập tên đăng nhập',
                  prefixIcon: Icons.person,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Vui lòng nhập tên đăng nhập';
                    }
                    if (value.length < 3) {
                      return 'Tối thiểu 3 ký tự';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Full Name
                _buildLabel('Họ và tên'),
                _buildBrutalTextField(
                  controller: _fullNameController,
                  hintText: 'Nhập họ và tên',
                  prefixIcon: Icons.badge,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Vui lòng nhập họ tên';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Email
                _buildLabel('Email'),
                _buildBrutalTextField(
                  controller: _emailController,
                  hintText: 'Nhập địa chỉ email',
                  prefixIcon: Icons.email,
                  keyboardType: TextInputType.emailAddress,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Vui lòng nhập email';
                    }
                    if (!value.contains('@')) {
                      return 'Email không hợp lệ';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Phone (optional)
                _buildLabel('Số điện thoại', isOptional: true),
                _buildBrutalTextField(
                  controller: _phoneController,
                  hintText: 'Nhập số điện thoại',
                  prefixIcon: Icons.phone,
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 16),

                // Password
                _buildLabel('Mật khẩu'),
                _buildBrutalTextField(
                  controller: _passwordController,
                  hintText: 'Nhập mật khẩu',
                  prefixIcon: Icons.lock,
                  obscureText: _obscurePassword,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility : Icons.visibility_off,
                      color: AppColors.stone500,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Vui lòng nhập mật khẩu';
                    }
                    if (value.length < 6) {
                      return 'Tối thiểu 6 ký tự';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Confirm Password
                _buildLabel('Xác nhận mật khẩu'),
                _buildBrutalTextField(
                  controller: _confirmPasswordController,
                  hintText: 'Nhập lại mật khẩu',
                  prefixIcon: Icons.lock_outline,
                  obscureText: _obscureConfirmPassword,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscureConfirmPassword ? Icons.visibility : Icons.visibility_off,
                      color: AppColors.stone500,
                    ),
                    onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Vui lòng xác nhận mật khẩu';
                    }
                    if (value != _passwordController.text) {
                      return 'Mật khẩu không khớp';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Submit button
                _BrutalButton(
                  onPressed: _isLoading ? null : _handleSubmitForm,
                  isLoading: _isLoading,
                  label: 'Tiếp tục',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildOtpVerification() {
    return Column(
      children: [
        // Back button
        Padding(
          padding: const EdgeInsets.only(top: 16.0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: _handleBackToForm,
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
                child: const Icon(Icons.email, size: 48, color: AppColors.primary),
              ),
              const SizedBox(height: 24),
              const Text(
                'Xác thực Email',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: AppColors.stone900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Nhập mã OTP đã gửi đến',
                style: TextStyle(fontSize: 14, color: AppColors.stone600),
              ),
              const SizedBox(height: 4),
              Text(
                _registrationEmail,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
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

        // OTP Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.white,
            border: Border.all(color: AppColors.stone900, width: 4),
            boxShadow: const [
              BoxShadow(color: AppColors.stone900, offset: Offset(8, 8)),
            ],
          ),
          child: Column(
            children: [
              // OTP input fields
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(6, (index) {
                  return SizedBox(
                    width: 48,
                    height: 58,
                    child: TextFormField(
                      controller: _otpControllers[index],
                      focusNode: _otpFocusNodes[index],
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      maxLength: 1,
                      obscureText: false,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: AppColors.stone900,
                        fontFamily: 'monospace',
                        height: 1.0,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: AppColors.white,
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.zero,
                          borderSide: const BorderSide(
                              color: AppColors.stone900, width: 3),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.zero,
                          borderSide: const BorderSide(
                              color: AppColors.stone900, width: 3),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.zero,
                          borderSide: const BorderSide(
                              color: AppColors.primary, width: 3),
                        ),
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly
                      ],
                      onChanged: (value) {
                        if (value.isNotEmpty && index < 5) {
                          _otpFocusNodes[index + 1].requestFocus();
                        }
                        // Auto submit when all digits entered
                        if (_getOtpCode().length == 6) {
                          _handleVerifyOtp();
                        }
                      },
                    ),
                  );
                }),
              ),
              const SizedBox(height: 16),

              // Expiry info
              Text(
                'Mã có hiệu lực trong 5 phút',
                style: TextStyle(color: AppColors.stone500, fontSize: 12),
              ),
              const SizedBox(height: 24),

              // Verify button
              _BrutalButton(
                onPressed: _isLoading ? null : _handleVerifyOtp,
                isLoading: _isLoading,
                label: 'Xác thực',
              ),
              const SizedBox(height: 16),

              // Resend OTP
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Không nhận được mã? ',
                    style: TextStyle(color: AppColors.stone600),
                  ),
                  GestureDetector(
                    onTap: _resendCountdown > 0 || _isLoading ? null : _handleResendOtp,
                    child: Text(
                      _resendCountdown > 0
                          ? 'Gửi lại (${_resendCountdown}s)'
                          : 'Gửi lại',
                      style: TextStyle(
                        color: _resendCountdown > 0 ? AppColors.stone400 : AppColors.primary,
                        fontWeight: FontWeight.w700,
                        decoration: _resendCountdown > 0 ? null : TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildLabel(String text, {bool isOptional = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.stone900,
            ),
          ),
          if (isOptional)
            Text(
              ' (tùy chọn)',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.stone500,
              ),
            ),
        ],
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
                  ),
                ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../routing/app_routes.dart';
import '../../config/constants/app_colors.dart';

/// Login screen - Neobrutalism Style
class LoginScreen extends StatefulWidget {
  final String? initialErrorMessage;
  
  const LoginScreen({
    super.key,
    this.initialErrorMessage,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    if (widget.initialErrorMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showErrorToast(widget.initialErrorMessage!);
      });
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _showErrorToast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: const Icon(Icons.error_outline, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        backgroundColor: AppColors.error,
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: AppColors.stone900, width: 3),
        ),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _showSuccessToast(String message) {
    if (!mounted) return;
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
        duration: const Duration(seconds: 3),
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: AppColors.stone900, width: 3),
        ),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      
      final success = await authProvider.login(
        username: _usernameController.text.trim(),
        password: _passwordController.text,
      );

      if (mounted) {
        if (success) {
          _showSuccessToast('Đăng nhập thành công!');
          context.go(AppRoutes.home);
        } else {
          final errorMessage = _extractErrorMessage(authProvider.error);
          _showErrorToast(errorMessage);
        }
      }
    }
  }

  String _extractErrorMessage(String? error) {
    if (error == null) return 'Đăng nhập thất bại. Vui lòng thử lại.';
    
    if (error.contains('SocketException') || error.contains('Failed host lookup')) {
      return '❌ Không thể kết nối đến server. Kiểm tra backend đã chạy chưa?';
    }
    if (error.contains('401') || error.contains('Unauthorized')) {
      return '❌ Sai username hoặc password. Vui lòng kiểm tra lại.';
    }
    if (error.contains('404')) {
      return '❌ API endpoint không tìm thấy. Kiểm tra cấu hình server.';
    }
    if (error.contains('Timeout')) {
      return '❌ Kết nối timeout. Kiểm tra kết nối mạng.';
    }
    if (error.contains('Connection refused')) {
      return '❌ Server từ chối kết nối. Backend có đang chạy không?';
    }
    
    return error.length > 100 ? '❌ ${error.substring(0, 100)}...' : '❌ $error';
  }

  Future<void> _handleGoogleSignIn() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    final success = await authProvider.signInWithGoogle();

    if (mounted) {
      if (success) {
        _showSuccessToast('Đăng nhập với Google thành công!');
        context.go(AppRoutes.home);
      } else if (authProvider.error != null) {
        final errorMessage = _extractErrorMessage(authProvider.error);
        _showErrorToast(errorMessage);
      }
      // If cancelled, do nothing
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Back to Onboarding
              GestureDetector(
                onTap: () => context.go(AppRoutes.onboarding),
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
                        'QUAY LẠI',
                        style: TextStyle(
                          color: AppColors.stone700,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),

              // Logo & Title
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
                      child: const Icon(Icons.pets, size: 48, color: AppColors.primary),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'PETTIES',
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w900,
                        color: AppColors.primary,
                        letterSpacing: 4,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'CHÀO MỪNG TRỞ LẠI',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.stone900,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Đăng nhập để truy cập vào Petties',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.stone600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Login Form Card
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
                      // Username Field
                      const Text(
                        'TÊN ĐĂNG NHẬP',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.stone900,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _buildBrutalTextField(
                  controller: _usernameController,
                        hintText: 'Nhập tên đăng nhập',
                        prefixIcon: Icons.person,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập tên đăng nhập';
                    }
                    return null;
                  },
                ),
                      const SizedBox(height: 20),

                      // Password Field
                      const Text(
                        'MẬT KHẨU',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.stone900,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 8),
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
                      onPressed: () {
                        setState(() => _obscurePassword = !_obscurePassword);
                      },
                    ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Vui lòng nhập mật khẩu';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                      // Login Button
                Consumer<AuthProvider>(
                  builder: (context, authProvider, _) {
                          return _BrutalButton(
                            onPressed: authProvider.isLoading ? null : _handleLogin,
                            isLoading: authProvider.isLoading,
                            label: 'ĐĂNG NHẬP',
                          );
                        },
                      ),
                      const SizedBox(height: 20),

                      // Divider with "OR"
                      Row(
                          children: [
                            Expanded(
                            child: Container(
                              height: 3,
                              color: AppColors.stone300,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                              'HOẶC',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone500,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Container(
                              height: 3,
                              color: AppColors.stone300,
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 20),

                      // Google Sign-In Button
                Consumer<AuthProvider>(
                  builder: (context, authProvider, _) {
                          return _GoogleSignInButton(
                            onPressed: authProvider.isLoading ? null : _handleGoogleSignIn,
                            isLoading: authProvider.isLoading,
                    );
                  },
                ),
              ],
            ),
                ),
              ),
              const SizedBox(height: 24),

              // Register Link
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Chưa có tài khoản? ',
                      style: TextStyle(color: AppColors.stone600),
                    ),
                    GestureDetector(
                      onTap: () => context.go(AppRoutes.register),
                      child: const Text(
                        'ĐĂNG KÝ NGAY',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
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
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      validator: validator,
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
                    letterSpacing: 2,
                  ),
                ),
        ),
      ),
    );
  }
}

/// Google Sign-In button with Neobrutalism style
class _GoogleSignInButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final bool isLoading;

  const _GoogleSignInButton({
    required this.onPressed,
    this.isLoading = false,
  });

  @override
  State<_GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<_GoogleSignInButton> {
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
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isDisabled ? AppColors.stone200 : AppColors.white,
          border: Border.all(color: AppColors.stone900, width: 4),
          boxShadow: [
            BoxShadow(
              color: AppColors.stone900,
              offset: Offset(_isPressed ? 0 : 4, _isPressed ? 0 : 4),
            ),
          ],
        ),
      child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
        children: [
            // Google Logo
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Center(
            child: Text(
                  'G',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Colors.red.shade600,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'ĐĂNG NHẬP VỚI GOOGLE',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: isDisabled ? AppColors.stone500 : AppColors.stone900,
                letterSpacing: 1,
            ),
          ),
        ],
        ),
      ),
    );
  }
}

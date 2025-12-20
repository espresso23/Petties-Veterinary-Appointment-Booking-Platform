import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:petties_mobile/config/constants/app_colors.dart';
import 'package:petties_mobile/providers/user_provider.dart';
import 'package:petties_mobile/utils/validators.dart';

class EmailInlineEdit extends StatefulWidget {
  final String? currentEmail;
  final bool showBottomBorder;
  final bool isFormStyle;

  const EmailInlineEdit({
    super.key,
    this.currentEmail,
    this.showBottomBorder = false,
    this.isFormStyle = false,
  });

  @override
  State<EmailInlineEdit> createState() => _EmailInlineEditState();
}

class _EmailInlineEditState extends State<EmailInlineEdit> {
  bool _isEditing = false;
  bool _isOtpSent = false;
  bool _isLoading = false;
  String? _inlineMessage;
  bool _isErrorMessage = true;

  final _emailController = TextEditingController();
  final _emailFormKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();

  // 6 digits OTP boxes
  final List<TextEditingController> _otpControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  int _cooldownSeconds = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Setup backspace detection
    for (int i = 0; i < 6; i++) {
      _otpFocusNodes[i].onKeyEvent = (node, event) {
        if (event is KeyDownEvent &&
            event.logicalKey == LogicalKeyboardKey.backspace) {
          if (_otpControllers[i].text.isEmpty && i > 0) {
            _otpFocusNodes[i - 1].requestFocus();
            return KeyEventResult.handled;
          }
        }
        return KeyEventResult.ignored;
      };
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var node in _otpFocusNodes) {
      node.dispose();
    }
    _timer?.cancel();
    super.dispose();
  }

  String get _otpCode => _otpControllers.map((c) => c.text).join();

  void _handleOtpInput(String value, int index) {
    if (value.length == 1 && index < 5) {
      _otpFocusNodes[index + 1].requestFocus();
    }
  }

  void _startCooldown([int? seconds]) {
    _timer?.cancel();
    _timer = null;

    setState(() => _cooldownSeconds = seconds ?? 60);

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _cooldownSeconds <= 0) {
        timer.cancel();
        _timer = null;
        if (mounted) setState(() => _cooldownSeconds = 0);
      } else {
        setState(() => _cooldownSeconds--);
      }
    });
  }

  void _toggleEditing() {
    setState(() {
      _isEditing = !_isEditing;
      _inlineMessage = null;
      _timer?.cancel();
      _timer = null;
      _cooldownSeconds = 0;
      if (!_isEditing) {
        _isOtpSent = false;
        _emailController.clear();
        for (var controller in _otpControllers) {
          controller.clear();
        }
      }
    });
  }

  Future<void> _requestOtp() async {
    if (!_emailFormKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _inlineMessage = null;
    });
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      await userProvider.requestEmailChange(_emailController.text.trim());

      setState(() {
        _isOtpSent = true;
        _isLoading = false;
        _isErrorMessage = false;
        _inlineMessage = 'Mã OTP đã được gửi đến email mới';
      });
      _startCooldown();
    } catch (e) {
      final errorMsg = e.toString().replaceAll('Exception: ', '');

      // Extract countdown seconds from server error if possible
      // Pattern: "Vui lòng đợi 56 giây"
      final regExp = RegExp(r'(\d+)');
      final match = regExp.firstMatch(errorMsg);
      int? serverCooldown;
      if (errorMsg.contains('giây') && match != null) {
        serverCooldown = int.tryParse(match.group(0)!);
      }

      setState(() {
        _isLoading = false;
        _isErrorMessage = true;
        _inlineMessage = errorMsg;
      });

      if (serverCooldown != null) {
        _startCooldown(serverCooldown);
      }
    }
  }

  Future<void> _verifyOtp() async {
    if (_otpCode.length != 6) {
      setState(() {
        _isErrorMessage = true;
        _inlineMessage = 'Vui lòng nhập đủ 6 số OTP';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _inlineMessage = null;
    });
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      await userProvider.verifyEmailChange(
        _emailController.text.trim(),
        _otpCode,
      );
      await userProvider.fetchProfile();

      setState(() {
        _isEditing = false;
        _isOtpSent = false;
        _isLoading = false;
        _emailController.clear();
        for (var controller in _otpControllers) {
          controller.clear();
        }
        _timer?.cancel();
        _timer = null;
        _cooldownSeconds = 0;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _isErrorMessage = true;
        _inlineMessage = e.toString().replaceAll('Exception: ', '');
        // Clear OTP on error to retry
        for (var c in _otpControllers) {
          c.clear();
        }
        _otpFocusNodes[0].requestFocus();
      });
    }
  }

  Future<void> _resendOtp() async {
    if (_cooldownSeconds > 0) return;

    setState(() {
      _isLoading = true;
      _inlineMessage = null;
    });
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      await userProvider.resendEmailChangeOtp();

      setState(() {
        _isLoading = false;
        _isErrorMessage = false;
        _inlineMessage = 'Mã OTP mới đã được gửi';
      });
      _startCooldown();
    } catch (e) {
      final errorMsg = e.toString().replaceAll('Exception: ', '');
      final regExp = RegExp(r'(\d+)');
      final match = regExp.firstMatch(errorMsg);
      int? serverCooldown;
      if (errorMsg.contains('giây') && match != null) {
        serverCooldown = int.tryParse(match.group(0)!);
      }

      setState(() {
        _isLoading = false;
        _isErrorMessage = true;
        _inlineMessage = errorMsg;
      });

      if (serverCooldown != null) {
        _startCooldown(serverCooldown);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isFormStyle) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'EMAIL',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 8),
          _isEditing ? _buildEditMode() : _buildDisplayMode(),
        ],
      );
    }

    if (!_isEditing) {
      return _buildDisplayMode();
    }
    return _buildEditMode();
  }

  Widget _buildDisplayMode() {
    if (widget.isFormStyle) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.email_outlined,
                color: AppColors.primary, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                widget.currentEmail ?? 'Chưa cập nhật',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.stone900,
                ),
              ),
            ),
            InkWell(
              onTap: _toggleEditing,
              child: const Icon(Icons.edit_outlined,
                  color: AppColors.stone400, size: 20),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: widget.showBottomBorder
            ? const Border(
                bottom: BorderSide(color: AppColors.stone200, width: 1))
            : null,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              border: Border.all(color: AppColors.stone900, width: 2),
            ),
            child: const Icon(Icons.email_outlined,
                color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'EMAIL',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone500,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.currentEmail ?? 'Chưa cập nhật',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: widget.currentEmail != null
                        ? AppColors.stone900
                        : AppColors.stone400,
                  ),
                ),
              ],
            ),
          ),
          InkWell(
            onTap: _toggleEditing,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.edit_outlined,
                  color: AppColors.primary, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditMode() {
    final decoration = widget.isFormStyle
        ? BoxDecoration(
            color: AppColors.white,
            border: Border.all(color: AppColors.stone900, width: 3),
            boxShadow: const [
              BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
            ],
          )
        : BoxDecoration(
            color: AppColors.white,
            border: widget.showBottomBorder
                ? const Border(
                    bottom: BorderSide(color: AppColors.stone200, width: 1))
                : null,
          );

    final messageColor = _isErrorMessage ? AppColors.error : Colors.green;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: decoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (!widget.isFormStyle)
                const Text(
                  'ĐỔI EMAIL',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                    letterSpacing: 1,
                  ),
                )
              else
                const Spacer(), // Push close button to end if no text
              InkWell(
                onTap: _toggleEditing,
                child: const Icon(Icons.close, color: AppColors.stone400),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Inline Status/Error Message
          if (_inlineMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              width: double.infinity,
              decoration: BoxDecoration(
                color: messageColor.withOpacity(0.1),
                border: Border.all(color: messageColor, width: 2),
              ),
              child: Row(
                children: [
                  Icon(
                    _isErrorMessage
                        ? Icons.error_outline
                        : Icons.check_circle_outline,
                    color: messageColor,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _inlineMessage!,
                      style: TextStyle(
                        color: messageColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          if (!_isOtpSent) _buildEmailInput() else _buildOtpInput(),
        ],
      ),
    );
  }

  Widget _buildEmailInput() {
    return Form(
      key: _emailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildBrutalTextField(
            controller: _emailController,
            hint: 'Email mới',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            validator: Validators.email,
            enabled: !_isLoading,
          ),
          const SizedBox(height: 20),
          _buildBrutalButton(
            text: _isLoading
                ? 'Đang gửi...'
                : (_cooldownSeconds > 0
                    ? 'Gửi lại sau ($_cooldownSeconds s)'
                    : 'GỬI MÃ OTP'),
            onPressed:
                (_isLoading || _cooldownSeconds > 0) ? null : _requestOtp,
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  Widget _buildOtpInput() {
    return Form(
      key: _otpFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Mã OTP đã gửi đến: ${_emailController.text}',
            style: const TextStyle(
                fontSize: 13,
                color: AppColors.stone600,
                fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (index) => _buildOtpBox(index)),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              InkWell(
                onTap: () async {
                  // Call API to delete Redis OTP record, eliminating cooldown
                  final userProvider =
                      Provider.of<UserProvider>(context, listen: false);
                  await userProvider.cancelEmailChange();

                  setState(() {
                    _isOtpSent = false;
                    _inlineMessage = null;
                    _timer?.cancel();
                    _timer = null;
                    _cooldownSeconds = 0;
                  });
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: const BoxDecoration(
                    border: Border(
                        bottom: BorderSide(color: AppColors.primary, width: 2)),
                  ),
                  child: const Text(
                    'NHẬP LẠI EMAIL',
                    style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5),
                  ),
                ),
              ),
              TextButton(
                onPressed:
                    (_cooldownSeconds > 0 || _isLoading) ? null : _resendOtp,
                child: Text(
                  _cooldownSeconds > 0
                      ? 'Gửi lại ($_cooldownSeconds s)'
                      : 'Gửi lại mã',
                  style: TextStyle(
                    color: _cooldownSeconds > 0
                        ? AppColors.stone400
                        : AppColors.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildBrutalButton(
            text: _isLoading ? 'Đang xử lý...' : 'XÁC NHẬN',
            onPressed: _isLoading ? null : _verifyOtp,
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  Widget _buildOtpBox(int index) {
    return SizedBox(
      width: 40,
      height: 50,
      child: TextFormField(
        controller: _otpControllers[index],
        focusNode: _otpFocusNodes[index],
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 1,
        enabled: !_isLoading,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(
          fontSize: 20,
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
            borderSide: const BorderSide(color: AppColors.stone900, width: 2),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: const BorderSide(color: AppColors.stone900, width: 2),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
        ),
        onChanged: (value) => _handleOtpInput(value, index),
      ),
    );
  }

  Widget _buildBrutalTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
    bool enabled = true,
    int? maxLength,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: enabled ? AppColors.white : AppColors.stone100,
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: TextFormField(
        controller: controller,
        enabled: enabled,
        keyboardType: keyboardType,
        validator: validator,
        maxLength: maxLength,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: enabled ? AppColors.stone900 : AppColors.stone500,
        ),
        decoration: InputDecoration(
          hintText: hint,
          counterText: '',
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

  Widget _buildBrutalButton({
    required String text,
    required VoidCallback? onPressed,
    bool isLoading = false,
  }) {
    final bool enabled = onPressed != null;

    return InkWell(
      onTap: onPressed,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: enabled ? AppColors.primary : AppColors.stone300,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: enabled
              ? const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
                ]
              : null,
        ),
        child: isLoading
            ? const Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
                  ),
                ),
              )
            : Text(
                text,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: enabled ? AppColors.white : AppColors.stone500,
                  letterSpacing: 1,
                ),
              ),
      ),
    );
  }
}

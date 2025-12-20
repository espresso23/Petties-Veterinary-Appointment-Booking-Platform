import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:petties_mobile/ui/core/widgets/custom_button.dart';
import 'package:petties_mobile/ui/core/widgets/custom_text_field.dart';
import 'package:petties_mobile/ui/core/widgets/loading_overlay.dart';
import 'package:petties_mobile/utils/validators.dart';
import 'package:petties_mobile/providers/user_provider.dart';

class ChangeEmailScreen extends StatefulWidget {
  const ChangeEmailScreen({super.key});

  @override
  State<ChangeEmailScreen> createState() => _ChangeEmailScreenState();
}

class _ChangeEmailScreenState extends State<ChangeEmailScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>(); // Separate key for OTP step

  final _emailController = TextEditingController();
  final _otpController = TextEditingController();

  bool _isOtpSent = false;
  bool _isLoading = false;
  int _cooldownSeconds = 0;
  Timer? _timer;

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    setState(() {
      _cooldownSeconds = 60;
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cooldownSeconds == 0) {
        timer.cancel();
      } else {
        setState(() {
          _cooldownSeconds--;
        });
      }
    });
  }

  Future<void> _requestOtp() async {
    if (!_emailFormKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      // Using UserProvider to access service
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      await userProvider.requestEmailChange(_emailController.text.trim());

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mã OTP đã được gửi đến email mới')),
        );
        setState(() {
          _isOtpSent = true;
        });
        _startCooldown();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Lỗi: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (!_otpFormKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      await userProvider.verifyEmailChange(
        _emailController.text.trim(),
        _otpController.text.trim(),
      );

      // Refresh user profile
      await userProvider.fetchProfile();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đổi email thành công!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Lỗi: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resendOtp() async {
    if (_cooldownSeconds > 0) return;

    setState(() => _isLoading = true);
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      await userProvider.resendEmailChangeOtp();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mã OTP mới đã được gửi')),
        );
        _startCooldown();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Lỗi: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        appBar: AppBar(title: const Text('Đổi Email'), centerTitle: true),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!_isOtpSent) _buildEmailStep() else _buildOtpStep(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmailStep() {
    return Form(
      key: _emailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Nhập địa chỉ email mới mà bạn muốn sử dụng. Chúng tôi sẽ gửi mã xác thực đến email này.',
            style: TextStyle(color: Colors.grey, fontSize: 14),
          ),
          const SizedBox(height: 24),
          CustomTextField(
            controller: _emailController,
            label: 'Email mới',
            hint: 'example@email.com',
            keyboardType: TextInputType.emailAddress,
            validator: Validators.email,
            prefixIcon: Icons.email_outlined,
          ),
          const SizedBox(height: 32),
          CustomButton(
            text: 'Gửi mã OTP',
            onPressed: _requestOtp,
          ),
        ],
      ),
    );
  }

  Widget _buildOtpStep() {
    return Form(
      key: _otpFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.amber.shade200),
            ),
            child: Row(
              children: [
                const Icon(Icons.mark_email_read, color: Colors.amber),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Mã xác thực đã được gửi đến:\n${_emailController.text}',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          CustomTextField(
            controller: _otpController,
            label: 'Mã xác thực (OTP)',
            hint: 'Nhập 6 số',
            keyboardType: TextInputType.number,
            maxLength: 6,
            validator: (value) {
              if (value == null || value.isEmpty) return 'Vui lòng nhập OTP';
              if (value.length != 6) return 'OTP phải có 6 số';
              return null;
            },
            prefixIcon: Icons.lock_outline,
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _cooldownSeconds > 0 ? null : _resendOtp,
              child: Text(
                _cooldownSeconds > 0
                    ? 'Gửi lại mã (${_cooldownSeconds}s)'
                    : 'Gửi lại mã',
                style: TextStyle(
                  color: _cooldownSeconds > 0
                      ? Colors.grey
                      : Colors.amber.shade700,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          CustomButton(
            text: 'Xác nhận đổi Email',
            onPressed: _verifyOtp,
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => setState(() => _isOtpSent = false),
            child: const Text('Nhập lại email',
                style: TextStyle(color: Colors.grey)),
          ),
        ],
      ),
    );
  }
}

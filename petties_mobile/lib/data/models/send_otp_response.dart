/// Response when sending OTP for registration
class SendOtpResponse {
  final String message;
  final String email;
  final int expiryMinutes;
  final int resendCooldownSeconds;

  SendOtpResponse({
    required this.message,
    required this.email,
    required this.expiryMinutes,
    required this.resendCooldownSeconds,
  });

  factory SendOtpResponse.fromJson(Map<String, dynamic> json) {
    return SendOtpResponse(
      message: json['message'] ?? '',
      email: json['email'] ?? '',
      expiryMinutes: json['expiryMinutes'] ?? 5,
      resendCooldownSeconds: json['resendCooldownSeconds'] ?? 60,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'email': email,
      'expiryMinutes': expiryMinutes,
      'resendCooldownSeconds': resendCooldownSeconds,
    };
  }
}

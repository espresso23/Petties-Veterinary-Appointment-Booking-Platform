import 'base_model.dart';

/// Auth response model from API
class AuthResponse extends BaseModel {
  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final String userId;
  final String username;
  final String email;
  final String? fullName;
  final String role;

  AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.tokenType,
    required this.userId,
    required this.username,
    required this.email,
    this.fullName,
    required this.role,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['accessToken'] ?? '',
      refreshToken: json['refreshToken'] ?? '',
      tokenType: json['tokenType'] ?? 'Bearer',
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      fullName: json['fullName'],
      role: json['role'] ?? '',
    );
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'tokenType': tokenType,
      'userId': userId,
      'username': username,
      'email': email,
      'fullName': fullName,
      'role': role,
    };
  }
}


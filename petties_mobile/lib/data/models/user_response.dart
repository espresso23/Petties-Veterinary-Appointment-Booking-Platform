import 'base_model.dart';

/// User response model from API
class UserResponse extends BaseModel {
  final String userId;
  final String username;
  final String email;
  final String? phone;
  final String? avatar;
  final String role;
  final String createdAt;
  final String updatedAt;

  UserResponse({
    required this.userId,
    required this.username,
    required this.email,
    this.phone,
    this.avatar,
    required this.role,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserResponse.fromJson(Map<String, dynamic> json) {
    return UserResponse(
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
      avatar: json['avatar'],
      role: json['role'] ?? '',
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'username': username,
      'email': email,
      'phone': phone,
      'avatar': avatar,
      'role': role,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}


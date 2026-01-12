import 'base_model.dart';

/// User response model from API
class UserResponse extends BaseModel {
  final String userId;
  final String username;
  final String email;
  final String? fullName;
  final String? phone;
  final String? avatar;
  final String role;
  final String? workingClinicId;
  final String? workingClinicName;
  final String createdAt;
  final String updatedAt;

  UserResponse({
    required this.userId,
    required this.username,
    required this.email,
    this.fullName,
    this.phone,
    this.avatar,
    required this.role,
    this.workingClinicId,
    this.workingClinicName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserResponse.fromJson(Map<String, dynamic> json) {
    return UserResponse(
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      fullName: json['fullName'],
      phone: json['phone'],
      avatar: json['avatar'],
      role: json['role'] ?? '',
      workingClinicId: json['workingClinicId'],
      workingClinicName: json['workingClinicName'],
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
      'fullName': fullName,
      'phone': phone,
      'avatar': avatar,
      'role': role,
      'workingClinicId': workingClinicId,
      'workingClinicName': workingClinicName,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}


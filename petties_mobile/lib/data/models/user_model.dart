import 'base_model.dart';

/// User model for API responses
class UserModel extends BaseModel {
  final String id;
  final String email;
  final String? fullName;
  final String? phoneNumber;
  final String? avatar;
  final String role;
  final bool isVerified;
  final DateTime createdAt;
  final DateTime? updatedAt;

  UserModel({
    required this.id,
    required this.email,
    this.fullName,
    this.phoneNumber,
    this.avatar,
    required this.role,
    required this.isVerified,
    required this.createdAt,
    this.updatedAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'] ?? json['fullName'],
      phoneNumber: json['phone_number'] ?? json['phoneNumber'],
      avatar: json['avatar'],
      role: json['role'] ?? 'user',
      isVerified: json['is_verified'] ?? json['isVerified'] ?? false,
      createdAt: DateTime.parse(json['created_at'] ?? json['createdAt']),
      updatedAt: json['updated_at'] != null || json['updatedAt'] != null
          ? DateTime.parse(json['updated_at'] ?? json['updatedAt'])
          : null,
    );
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': fullName,
      'phone_number': phoneNumber,
      'avatar': avatar,
      'role': role,
      'is_verified': isVerified,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  UserModel copyWith({
    String? id,
    String? email,
    String? fullName,
    String? phoneNumber,
    String? avatar,
    String? role,
    bool? isVerified,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      avatar: avatar ?? this.avatar,
      role: role ?? this.role,
      isVerified: isVerified ?? this.isVerified,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

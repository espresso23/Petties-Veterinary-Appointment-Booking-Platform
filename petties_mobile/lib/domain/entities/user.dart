import 'base_entity.dart';

/// User entity for domain layer
class User extends BaseEntity {
  final String id;
  final String email;
  final String? fullName;
  final String? phoneNumber;
  final String? avatar;
  final String role;
  final bool isVerified;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const User({
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

  User copyWith({
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
    return User(
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

  @override
  List<Object?> get props => [
        id,
        email,
        fullName,
        phoneNumber,
        avatar,
        role,
        isVerified,
        createdAt,
        updatedAt,
      ];
}

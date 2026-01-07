import 'base_model.dart';

/// User profile model for profile management
/// Maps to GET /api/users/profile response
class UserProfile extends BaseModel {
  final String userId;
  final String username;
  final String email;
  final String? fullName;
  final String? phone;
  final String? avatar;
  final String role;
  final DateTime createdAt;
  final DateTime updatedAt;

  UserProfile({
    required this.userId,
    required this.username,
    required this.email,
    this.fullName,
    this.phone,
    this.avatar,
    required this.role,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userId: json['userId'] ?? json['user_id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      fullName: json['fullName'] ?? json['full_name'],
      phone: json['phone'],
      avatar: json['avatar'],
      role: json['role'] ?? '',
      createdAt: _parseDateTime(json['createdAt'] ?? json['created_at']),
      updatedAt: _parseDateTime(json['updatedAt'] ?? json['updated_at']),
    );
  }

  static DateTime _parseDateTime(dynamic value) {
    if (value == null) return DateTime.now();
    try {
      if (value is String) {
        // Handle yyyy-MM-dd HH:mm:ss by replacing space with T for ISO format
        final normalized =
            value.contains(' ') ? value.replaceFirst(' ', 'T') : value;
        return DateTime.parse(normalized);
      }
      return DateTime.now();
    } catch (e) {
      return DateTime.now();
    }
  }

  /// Merge this profile with another, preserving data from this one if the other has nulls
  UserProfile merge(UserProfile other) {
    return UserProfile(
      userId: other.userId.isNotEmpty ? other.userId : userId,
      username: other.username.isNotEmpty ? other.username : username,
      email: other.email.isNotEmpty ? other.email : email,
      fullName: other.fullName ?? fullName,
      phone: other.phone ?? phone,
      avatar: other.avatar ?? avatar,
      role: other.role.isNotEmpty ? other.role : role,
      createdAt: other.createdAt,
      updatedAt: other.updatedAt,
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
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  UserProfile copyWith({
    String? userId,
    String? username,
    String? email,
    String? fullName,
    String? phone,
    String? avatar,
    String? role,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserProfile(
      userId: userId ?? this.userId,
      username: username ?? this.username,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      avatar: avatar ?? this.avatar,
      role: role ?? this.role,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Get display name - fullName if available, otherwise username
  String get displayName => fullName?.isNotEmpty == true ? fullName! : username;

  /// Get role display text in Vietnamese
  String get roleDisplayText {
    switch (role) {
      case 'PET_OWNER':
        return 'Chủ nuôi thú cưng';
      case 'VET':
        return 'Bác sĩ thú y';
      case 'CLINIC_OWNER':
        return 'Chủ phòng khám';
      case 'CLINIC_MANAGER':
        return 'Quản lý phòng khám';
      case 'ADMIN':
        return 'Quản trị viên';
      default:
        return role;
    }
  }

  /// Check if profile is complete (has fullName and phone)
  bool get isProfileComplete =>
      fullName != null &&
      fullName!.isNotEmpty &&
      phone != null &&
      phone!.isNotEmpty;
}

/// Request model for updating profile
/// Maps to PUT /api/users/profile request
class UpdateProfileRequest extends BaseModel {
  final String? fullName;
  final String? phone;

  UpdateProfileRequest({
    this.fullName,
    this.phone,
  });

  @override
  Map<String, dynamic> toJson() {
    return {
      if (fullName != null) 'fullName': fullName,
      if (phone != null) 'phone': phone,
    };
  }
}

/// Request model for changing password
/// Maps to PUT /api/users/profile/password request
class ChangePasswordRequest extends BaseModel {
  final String currentPassword;
  final String newPassword;
  final String confirmPassword;

  ChangePasswordRequest({
    required this.currentPassword,
    required this.newPassword,
    required this.confirmPassword,
  });

  @override
  Map<String, dynamic> toJson() {
    return {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
      'confirmPassword': confirmPassword,
    };
  }

  /// Validate password requirements
  String? validate() {
    if (currentPassword.isEmpty) {
      return 'Vui lòng nhập mật khẩu hiện tại';
    }
    if (newPassword.isEmpty) {
      return 'Vui lòng nhập mật khẩu mới';
    }
    if (newPassword.length < 8) {
      return 'Mật khẩu mới phải có ít nhất 8 ký tự';
    }
    if (confirmPassword.isEmpty) {
      return 'Vui lòng xác nhận mật khẩu mới';
    }
    if (newPassword != confirmPassword) {
      return 'Mật khẩu xác nhận không khớp';
    }
    if (currentPassword == newPassword) {
      return 'Mật khẩu mới phải khác mật khẩu hiện tại';
    }
    return null;
  }
}

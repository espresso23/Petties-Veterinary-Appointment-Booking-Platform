import 'dart:io';
import 'package:dio/dio.dart';
import '../models/user_profile.dart';
import 'api_client.dart';

/// Service for user profile operations
/// Handles profile CRUD and avatar upload
class UserService {
  final ApiClient _apiClient;

  UserService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Get current user profile
  /// GET /api/users/profile
  Future<UserProfile> getProfile() async {
    try {
      final response = await _apiClient.get('/users/profile');
      return UserProfile.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Update user profile (fullName, phone)
  /// PUT /api/users/profile
  Future<UserProfile> updateProfile(UpdateProfileRequest request) async {
    try {
      final response = await _apiClient.put(
        '/users/profile',
        data: request.toJson(),
      );
      return UserProfile.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Upload avatar image
  /// POST /api/users/profile/avatar
  /// Content-Type: multipart/form-data
  Future<UserProfile> uploadAvatar(File imageFile) async {
    try {
      final fileName = imageFile.path.split('/').last;
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          imageFile.path,
          filename: fileName,
        ),
      });

      final response = await _apiClient.post(
        '/users/profile/avatar',
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
        ),
      );
      return UserProfile.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Delete avatar
  /// DELETE /api/users/profile/avatar
  Future<UserProfile> deleteAvatar() async {
    try {
      final response = await _apiClient.delete('/users/profile/avatar');
      return UserProfile.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Change password
  /// PUT /api/users/profile/password
  Future<void> changePassword(ChangePasswordRequest request) async {
    try {
      // Validate request before sending
      final validationError = request.validate();
      if (validationError != null) {
        throw Exception(validationError);
      }

      await _apiClient.put(
        '/users/profile/password',
        data: request.toJson(),
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Request email change
  /// POST /api/users/profile/email/request-change
  Future<Map<String, String>> requestEmailChange(String newEmail) async {
    try {
      final response = await _apiClient.post(
        '/users/profile/email/request-change',
        data: {'newEmail': newEmail},
      );
      return Map<String, String>.from(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Verify email change OTP
  /// POST /api/users/profile/email/verify-change
  Future<UserProfile> verifyEmailChange(String newEmail, String otp) async {
    try {
      final response = await _apiClient.post(
        '/users/profile/email/verify-change',
        data: {
          'newEmail': newEmail,
          'otp': otp,
        },
      );
      return UserProfile.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Resend email change OTP
  /// POST /api/users/profile/email/resend-otp
  Future<Map<String, String>> resendEmailChangeOtp() async {
    try {
      final response = await _apiClient.post(
        '/users/profile/email/resend-otp',
      );
      return Map<String, String>.from(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Cancel email change request
  /// DELETE /api/users/profile/email/cancel-change
  /// Xóa OTP record trong Redis để user có thể nhập email mới không cần đợi cooldown
  Future<void> cancelEmailChange() async {
    try {
      await _apiClient.delete('/users/profile/email/cancel-change');
    } catch (e) {
      // Ignore errors - if no record exists, that's fine
    }
  }
}

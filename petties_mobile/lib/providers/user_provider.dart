import 'dart:io';
import 'package:flutter/foundation.dart';
import '../data/models/user_profile.dart';
import '../data/services/user_service.dart';
import '../utils/api_error_handler.dart';

/// Provider for user profile state management
/// Handles profile CRUD operations, avatar upload, and password change
class UserProvider extends ChangeNotifier {
  final UserService _userService;

  UserProfile? _profile;
  bool _isLoading = false;
  bool _isUpdating = false;
  bool _isUploadingAvatar = false;
  bool _isChangingPassword = false;
  String? _error;
  String? _successMessage;

  UserProvider({UserService? userService})
      : _userService = userService ?? UserService();

  // Getters
  UserProfile? get profile => _profile;
  bool get isLoading => _isLoading;
  bool get isUpdating => _isUpdating;
  bool get isUploadingAvatar => _isUploadingAvatar;
  bool get isChangingPassword => _isChangingPassword;
  String? get error => _error;
  String? get successMessage => _successMessage;
  bool get hasProfile => _profile != null;

  /// Fetch user profile from API
  Future<void> fetchProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _profile = await _userService.getProfile();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = _parseErrorMessage(e);
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Update user profile (fullName, phone)
  Future<bool> updateProfile({
    String? fullName,
    String? phone,
  }) async {
    _isUpdating = true;
    _error = null;
    _successMessage = null;
    notifyListeners();

    try {
      final request = UpdateProfileRequest(
        fullName: fullName,
        phone: phone,
      );
      final newProfile = await _userService.updateProfile(request);
      _profile = _profile?.merge(newProfile) ?? newProfile;
      _successMessage = 'Cập nhật thông tin thành công';
      _isUpdating = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseErrorMessage(e);
      _isUpdating = false;
      notifyListeners();
      return false;
    }
  }

  /// Upload avatar from file
  Future<bool> uploadAvatar(File imageFile) async {
    _isUploadingAvatar = true;
    _error = null;
    _successMessage = null;
    notifyListeners();

    try {
      final newProfile = await _userService.uploadAvatar(imageFile);
      _profile = _profile?.merge(newProfile) ?? newProfile;
      _successMessage = 'Cập nhật ảnh đại diện thành công';
      _isUploadingAvatar = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseErrorMessage(e);
      _isUploadingAvatar = false;
      notifyListeners();
      return false;
    }
  }

  /// Delete current avatar
  Future<bool> deleteAvatar() async {
    _isUploadingAvatar = true;
    _error = null;
    _successMessage = null;
    notifyListeners();

    try {
      final newProfile = await _userService.deleteAvatar();
      _profile = _profile?.merge(newProfile) ?? newProfile;
      _successMessage = 'Xóa ảnh đại diện thành công';
      _isUploadingAvatar = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseErrorMessage(e);
      _isUploadingAvatar = false;
      notifyListeners();
      return false;
    }
  }

  /// Change password
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    _isChangingPassword = true;
    _error = null;
    _successMessage = null;
    notifyListeners();

    try {
      final request = ChangePasswordRequest(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );

      // Validate locally first
      final validationError = request.validate();
      if (validationError != null) {
        _error = validationError;
        _isChangingPassword = false;
        notifyListeners();
        return false;
      }

      await _userService.changePassword(request);
      _successMessage = 'Đổi mật khẩu thành công';
      _isChangingPassword = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseErrorMessage(e);
      _isChangingPassword = false;
      notifyListeners();
      return false;
    }
  }

  /// Clear error message
  /// Request email change
  Future<void> requestEmailChange(String newEmail) async {
    try {
      await _userService.requestEmailChange(newEmail);
      _successMessage = 'OTP sent to new email';
      notifyListeners();
    } catch (e) {
      _error = _parseErrorMessage(e);
      notifyListeners();
      rethrow;
    }
  }

  /// Verify email change OTP
  Future<void> verifyEmailChange(String newEmail, String otp) async {
    try {
      final newProfile = await _userService.verifyEmailChange(newEmail, otp);
      _profile = _profile?.merge(newProfile) ?? newProfile;
      _successMessage = 'Email changed successfully';
      notifyListeners();
    } catch (e) {
      _error = _parseErrorMessage(e);
      notifyListeners();
      rethrow;
    }
  }

  /// Resend email change OTP
  Future<void> resendEmailChangeOtp() async {
    try {
      await _userService.resendEmailChangeOtp();
      _successMessage = 'OTP resent';
      notifyListeners();
    } catch (e) {
      _error = _parseErrorMessage(e);
      notifyListeners();
      rethrow;
    }
  }

  /// Cancel email change request (delete Redis OTP record)
  Future<void> cancelEmailChange() async {
    await _userService.cancelEmailChange();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Clear success message
  void clearSuccessMessage() {
    _successMessage = null;
    notifyListeners();
  }

  /// Clear all messages
  void clearMessages() {
    _error = null;
    _successMessage = null;
    notifyListeners();
  }

  /// Reset state (e.g., on logout)
  void reset() {
    _profile = null;
    _isLoading = false;
    _isUpdating = false;
    _isUploadingAvatar = false;
    _isChangingPassword = false;
    _error = null;
    _successMessage = null;
    notifyListeners();
  }

  /// Parse error message from exception
  String _parseErrorMessage(dynamic error) {
    return ApiErrorHandler.getErrorMessage(error);
  }
}

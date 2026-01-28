import 'dart:convert';
import 'package:dio/dio.dart';
import '../models/auth_response.dart';
import '../models/send_otp_response.dart';
import '../models/user_response.dart';
import 'api_client.dart';
import '../../config/constants/app_constants.dart';
import '../../utils/storage_service.dart';

/// Service for authentication operations
class AuthService {
  final ApiClient _apiClient;
  final StorageService _storage;

  AuthService({
    ApiClient? apiClient,
    StorageService? storage,
  })  : _apiClient = apiClient ?? ApiClient(),
        _storage = storage ?? StorageService();

  /// Login with username and password
  Future<AuthResponse> login({
    required String username,
    required String password,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/login',
        data: {
          'username': username,
          'password': password,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await _saveAuthData(authResponse);
      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Login with Google ID Token
  /// Backend will verify the token with Google and create/login user
  ///
  /// Platform determines the default role for new users:
  /// - 'mobile' → PET_OWNER
  /// - 'web' → CLINIC_OWNER
  Future<AuthResponse> loginWithGoogle({
    required String idToken,
    String platform = 'mobile', // 'mobile' or 'web'
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/google',
        data: {
          'idToken': idToken,
          'platform': platform,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await _saveAuthData(authResponse);
      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Save auth data to storage
  Future<void> _saveAuthData(AuthResponse authResponse) async {
    await _storage.setString(
        AppConstants.accessTokenKey, authResponse.accessToken);
    await _storage.setString(
        AppConstants.refreshTokenKey, authResponse.refreshToken);
    await _storage.setString(AppConstants.userIdKey, authResponse.userId);
    await _storage.setString(
      AppConstants.userDataKey,
      jsonEncode(authResponse.toJson()),
    );
  }

  /// Save user profile to storage
  Future<void> saveUserProfile(UserResponse user) async {
    await _storage.setString(
      AppConstants.userProfileKey,
      jsonEncode(user.toJson()),
    );
  }

  /// Register new user (DEPRECATED - dùng sendRegistrationOtp thay thế)
  Future<AuthResponse> register({
    required String username,
    required String password,
    required String email,
    String? phone,
    String? fullName,
    String? avatar,
    required String role,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/register',
        data: {
          'username': username,
          'password': password,
          'email': email,
          if (phone != null) 'phone': phone,
          if (fullName != null) 'fullName': fullName,
          if (avatar != null) 'avatar': avatar,
          'role': role,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await _saveAuthData(authResponse);
      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Step 1: Gửi OTP đến email để đăng ký
  ///
  /// Normal mode: Trả về SendOtpResponse
  /// DEV mode (skip OTP): Trả về AuthResponse và user đã được đăng ký xong
  ///
  /// Caller cần check response type:
  /// ```dart
  /// final response = await sendRegistrationOtp(...);
  /// if (response is AuthResponse) {
  ///   // Dev mode - user đã đăng ký xong
  /// } else {
  ///   // Normal - chuyển sang step OTP
  /// }
  /// ```
  Future<dynamic> sendRegistrationOtp({
    required String username,
    required String email,
    required String password,
    String? phone,
    required String fullName,
    required String role,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/register/send-otp',
        data: {
          'username': username,
          'email': email,
          'password': password,
          if (phone != null) 'phone': phone,
          'fullName': fullName,
          'role': role,
        },
      );

      // DEV MODE: Nếu response chứa accessToken, đây là AuthResponse
      if (response.data is Map && response.data.containsKey('accessToken')) {
        final authResponse = AuthResponse.fromJson(response.data);
        await _saveAuthData(authResponse);
        return authResponse;
      }

      // Normal mode: SendOtpResponse
      return SendOtpResponse.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Step 2: Verify OTP và hoàn tất đăng ký
  Future<AuthResponse> verifyOtpAndRegister({
    required String email,
    required String otpCode,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/register/verify-otp',
        data: {
          'email': email,
          'otpCode': otpCode,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await _saveAuthData(authResponse);
      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Gửi lại OTP
  Future<SendOtpResponse> resendOtp({required String email}) async {
    try {
      final response = await _apiClient.post(
        '/auth/register/resend-otp',
        data: {'email': email},
      );
      return SendOtpResponse.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Refresh access token
  Future<AuthResponse> refreshToken() async {
    try {
      final refreshToken =
          await _storage.getString(AppConstants.refreshTokenKey);
      if (refreshToken == null) {
        throw Exception('No refresh token available');
      }

      final response = await _apiClient.post(
        '/auth/refresh',
        data: {},
        options: Options(
          headers: {
            'Authorization': 'Bearer $refreshToken',
          },
        ),
      );

      final authResponse = AuthResponse.fromJson(response.data);

      // Update tokens in storage
      await _storage.setString(
          AppConstants.accessTokenKey, authResponse.accessToken);
      await _storage.setString(
          AppConstants.refreshTokenKey, authResponse.refreshToken);

      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Logout
  Future<void> logout() async {
    try {
      final accessToken = await _storage.getString(AppConstants.accessTokenKey);
      if (accessToken != null) {
        await _apiClient.post(
          '/auth/logout',
          data: {},
          options: Options(
            headers: {
              'Authorization': 'Bearer $accessToken',
            },
          ),
        );
      }
    } catch (e) {
      // Continue with logout even if API call fails
    } finally {
      // Clear all auth data
      await _storage.remove(AppConstants.accessTokenKey);
      await _storage.remove(AppConstants.refreshTokenKey);
      await _storage.remove(AppConstants.userIdKey);
      await _storage.remove(AppConstants.userDataKey);
    }
  }

  /// Get current user info
  Future<UserResponse> getCurrentUser() async {
    try {
      final response = await _apiClient.get('/auth/me');
      return UserResponse.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final accessToken = await _storage.getString(AppConstants.accessTokenKey);
    return accessToken != null && accessToken.isNotEmpty;
  }

  // ===== FORGOT PASSWORD FLOW =====

  /// Step 1: Gửi OTP đến email để reset password
  /// POST /auth/forgot-password
  Future<SendOtpResponse> forgotPassword({required String email}) async {
    try {
      final response = await _apiClient.post(
        '/auth/forgot-password',
        data: {'email': email},
      );
      return SendOtpResponse.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Step 2: Reset password với OTP
  /// POST /auth/reset-password
  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otpCode,
    required String newPassword,
    required String confirmPassword,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/reset-password',
        data: {
          'email': email,
          'otpCode': otpCode,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        },
      );
      return response.data;
    } catch (e) {
      rethrow;
    }
  }

  /// Gửi lại OTP cho forgot password
  /// POST /auth/forgot-password/resend-otp?email=xxx
  Future<SendOtpResponse> resendPasswordResetOtp(
      {required String email}) async {
    try {
      final response = await _apiClient.post(
        '/auth/forgot-password/resend-otp',
        queryParameters: {'email': email},
      );
      return SendOtpResponse.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }
}

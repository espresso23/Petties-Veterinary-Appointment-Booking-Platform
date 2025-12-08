import 'package:dio/dio.dart';
import '../models/auth_response.dart';
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

      // Save tokens to storage
      await _storage.setString(AppConstants.accessTokenKey, authResponse.accessToken);
      await _storage.setString(AppConstants.refreshTokenKey, authResponse.refreshToken);
      await _storage.setString(AppConstants.userIdKey, authResponse.userId);
      await _storage.setString(
        AppConstants.userDataKey,
        authResponse.toJson().toString(),
      );

      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Register new user
  Future<AuthResponse> register({
    required String username,
    required String password,
    required String email,
    String? phone,
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
          if (avatar != null) 'avatar': avatar,
          'role': role,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);

      // Save tokens to storage
      await _storage.setString(AppConstants.accessTokenKey, authResponse.accessToken);
      await _storage.setString(AppConstants.refreshTokenKey, authResponse.refreshToken);
      await _storage.setString(AppConstants.userIdKey, authResponse.userId);
      await _storage.setString(
        AppConstants.userDataKey,
        authResponse.toJson().toString(),
      );

      return authResponse;
    } catch (e) {
      rethrow;
    }
  }

  /// Refresh access token
  Future<AuthResponse> refreshToken() async {
    try {
      final refreshToken = await _storage.getString(AppConstants.refreshTokenKey);
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
      await _storage.setString(AppConstants.accessTokenKey, authResponse.accessToken);
      await _storage.setString(AppConstants.refreshTokenKey, authResponse.refreshToken);

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
}


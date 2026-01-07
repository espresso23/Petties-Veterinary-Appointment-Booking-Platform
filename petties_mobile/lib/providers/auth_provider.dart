import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../data/models/auth_response.dart';
import '../data/models/user_response.dart';
import '../data/services/auth_service.dart';
import '../data/services/google_auth_service.dart';
import '../utils/storage_service.dart';
import '../config/constants/app_constants.dart';
import '../utils/api_error_handler.dart';
import '../utils/fcm_service.dart';
import 'package:dio/dio.dart';

/// Provider for authentication state management
class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final StorageService _storage;

  AuthResponse? _authResponse;
  UserResponse? _user;
  bool _isLoading = false;
  String? _error;

  AuthProvider({
    AuthService? authService,
    StorageService? storage,
  })  : _authService = authService ?? AuthService(),
        _storage = storage ?? StorageService() {
    _initializeAuth();
  }

  // Getters
  AuthResponse? get authResponse => _authResponse;
  UserResponse? get user => _user;
  bool get isAuthenticated => _authResponse != null && _user != null;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Initialize auth state from storage
  /// Priority: Show cached data IMMEDIATELY, then refresh in background
  Future<void> _initializeAuth() async {
    try {
      final accessToken = await _storage.getString(AppConstants.accessTokenKey);
      final refreshToken =
          await _storage.getString(AppConstants.refreshTokenKey);
      final userId = await _storage.getString(AppConstants.userIdKey);
      final userDataStr = await _storage.getString(AppConstants.userDataKey);
      final userProfileStr =
          await _storage.getString(AppConstants.userProfileKey);

      if (accessToken != null && refreshToken != null && userId != null) {
        // 1. Load cached data IMMEDIATELY so user can enter app right away
        if (userDataStr != null) {
          try {
            final userData = jsonDecode(userDataStr);
            _authResponse = AuthResponse.fromJson(userData);
          } catch (e) {
            debugPrint('Error parsing cached auth data: $e');
          }
        }

        if (userProfileStr != null) {
          try {
            final profileData = jsonDecode(userProfileStr);
            _user = UserResponse.fromJson(profileData);
          } catch (e) {
            debugPrint('Error parsing cached user profile: $e');
          }
        }

        // If we have cached auth data, notify immediately and let user in
        if (_authResponse != null && _user != null) {
          notifyListeners();

          // 2. Refresh user data in background (non-blocking, fire-and-forget)
          _refreshUserInBackground(accessToken, userId);
        } else {
          // No valid cache, need to fetch from server
          try {
            final freshUser = await _authService.getCurrentUser().timeout(
                  const Duration(seconds: 5), // Reduced timeout
                );
            _user = freshUser;
            await _authService.saveUserProfile(freshUser);

            _authResponse = AuthResponse(
              accessToken: accessToken,
              refreshToken: refreshToken,
              tokenType: 'Bearer',
              userId: userId,
              username: _user!.username,
              email: _user!.email,
              fullName: _user!.fullName,
              role: _user!.role,
            );
            notifyListeners();
          } catch (e) {
            debugPrint('Error fetching user: $e');
            // Clear invalid tokens
            if (e is DioException && e.response?.statusCode == 401) {
              await logout();
            }
            notifyListeners();
          }
        }
      } else {
        // No tokens, not authenticated
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error initializing auth: $e');
      notifyListeners();
    }
  }

  /// Refresh user data in background without blocking UI
  void _refreshUserInBackground(String accessToken, String userId) {
    // Fire and forget - don't await this
    Future(() async {
      try {
        final freshUser = await _authService.getCurrentUser().timeout(
              const Duration(seconds: 10),
            );
        _user = freshUser;
        await _authService.saveUserProfile(freshUser);

        _authResponse = AuthResponse(
          accessToken: accessToken,
          refreshToken:
              await _storage.getString(AppConstants.refreshTokenKey) ?? '',
          tokenType: 'Bearer',
          userId: userId,
          username: _user!.username,
          email: _user!.email,
          fullName: _user!.fullName,
          role: _user!.role,
        );
        notifyListeners();
      } catch (e) {
        debugPrint('Error refreshing user in background: $e');
        // Only logout on 401 Unauthorized
        if (e is DioException && e.response?.statusCode == 401) {
          debugPrint('Token invalid (401), logging out...');
          await logout();
        }
        // Keep using cached data on network error
      }
    });
  }

  /// Login
  Future<bool> login({
    required String username,
    required String password,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _authResponse = await _authService.login(
        username: username,
        password: password,
      );

      // Get user info and save it
      _user = await _authService.getCurrentUser();
      await _authService.saveUserProfile(_user!);

      // Register FCM token for push notifications
      await FcmService().registerAfterLogin();

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Register
  Future<bool> register({
    required String username,
    required String password,
    required String email,
    String? phone,
    String? avatar,
    required String role,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _authResponse = await _authService.register(
        username: username,
        password: password,
        email: email,
        phone: phone,
        avatar: avatar,
        role: role,
      );

      // Get user info and save it
      _user = await _authService.getCurrentUser();
      await _authService.saveUserProfile(_user!);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Verify OTP and complete registration
  Future<bool> verifyOtpAndRegister({
    required String email,
    required String otpCode,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _authResponse = await _authService.verifyOtpAndRegister(
        email: email,
        otpCode: otpCode,
      );

      // Get user info and save it
      _user = await _authService.getCurrentUser();
      await _authService.saveUserProfile(_user!);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Sign in with Google
  Future<bool> signInWithGoogle() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Step 1: Get Google ID token
      final googleResult = await GoogleAuthService.instance.signIn();

      if (googleResult.isCancelled) {
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (!googleResult.isSuccess) {
        _error = googleResult.error ?? 'Google Sign-In failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Step 2: Send ID token to backend for verification
      _authResponse = await _authService.loginWithGoogle(
        idToken: googleResult.idToken!,
      );

      // Step 3: Get user info and save it
      _user = await _authService.getCurrentUser();
      await _authService.saveUserProfile(_user!);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Logout
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Unregister FCM token before logout
      await FcmService().unregisterToken();

      // Sign out from Google if signed in
      await GoogleAuthService.instance.signOut();

      await _authService.logout();
      _authResponse = null;
      _user = null;
      _error = null;

      // Clear cached profile
      await _storage.remove(AppConstants.userProfileKey);
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh token
  Future<bool> refreshToken() async {
    try {
      _authResponse = await _authService.refreshToken();
      notifyListeners();
      return true;
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      await logout(); // Logout if refresh fails
      return false;
    }
  }

  /// Get current user
  Future<void> getCurrentUser() async {
    try {
      _user = await _authService.getCurrentUser();
      await _authService.saveUserProfile(_user!);
      notifyListeners();
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      notifyListeners();
    }
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}

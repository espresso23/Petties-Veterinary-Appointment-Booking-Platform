import 'package:flutter/foundation.dart';
import '../data/models/auth_response.dart';
import '../data/models/user_response.dart';
import '../data/services/auth_service.dart';
import '../data/services/google_auth_service.dart';
import '../utils/storage_service.dart';
import '../config/constants/app_constants.dart';

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
  Future<void> _initializeAuth() async {
    try {
      final accessToken = await _storage.getString(AppConstants.accessTokenKey);
      final refreshToken = await _storage.getString(AppConstants.refreshTokenKey);
      final userId = await _storage.getString(AppConstants.userIdKey);

      if (accessToken != null && refreshToken != null && userId != null) {
        // Try to get current user info with timeout
        try {
          _user = await _authService.getCurrentUser().timeout(
            const Duration(seconds: 5),
          );
          _authResponse = AuthResponse(
            accessToken: accessToken,
            refreshToken: refreshToken,
            tokenType: 'Bearer',
            userId: userId,
            username: _user!.username,
            email: _user!.email,
            role: _user!.role,
          );
          notifyListeners();
        } catch (e) {
          // If getting user fails, clear auth silently
          debugPrint('Error getting current user: $e');
          try {
            await _authService.logout();
          } catch (_) {
            // Ignore logout errors
          }
          notifyListeners();
        }
      } else {
        // No tokens, notify listeners so redirect can happen
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error initializing auth: $e');
      notifyListeners(); // Notify anyway to allow redirect
    }
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

      // Get user info
      _user = await _authService.getCurrentUser();

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
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

      // Get user info
      _user = await _authService.getCurrentUser();

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
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

      // Get user info to complete auth state
      _user = await _authService.getCurrentUser();

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
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

      // Step 3: Get user info
      _user = await _authService.getCurrentUser();

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
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
      // Sign out from Google if signed in
      await GoogleAuthService.instance.signOut();
      
      await _authService.logout();
      _authResponse = null;
      _user = null;
      _error = null;
    } catch (e) {
      _error = e.toString();
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
      _error = e.toString();
      await logout(); // Logout if refresh fails
      return false;
    }
  }

  /// Get current user
  Future<void> getCurrentUser() async {
    try {
      _user = await _authService.getCurrentUser();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}


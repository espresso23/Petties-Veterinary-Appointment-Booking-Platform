import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../config/env/environment.dart';

/// Service for Google Sign-In operations
class GoogleAuthService {
  static GoogleAuthService? _instance;
  late final GoogleSignIn _googleSignIn;

  GoogleAuthService._() {
    _googleSignIn = GoogleSignIn(
      scopes: [
        'email',
        'profile',
      ],
      // Server client ID for backend verification
      serverClientId: Environment.googleServerClientId,
    );
  }

  /// Singleton instance
  static GoogleAuthService get instance {
    _instance ??= GoogleAuthService._();
    return _instance!;
  }

  /// Sign in with Google
  /// Returns the ID token to send to backend for verification
  Future<GoogleSignInResult> signIn() async {
    try {
      // Sign out first to ensure account picker shows
      await _googleSignIn.signOut();
      
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      
      if (account == null) {
        // User cancelled the sign-in
        return GoogleSignInResult.cancelled();
      }

      final GoogleSignInAuthentication auth = await account.authentication;
      
      if (auth.idToken == null) {
        return GoogleSignInResult.error('Failed to get ID token from Google');
      }

      return GoogleSignInResult.success(
        idToken: auth.idToken!,
        email: account.email,
        displayName: account.displayName,
        photoUrl: account.photoUrl,
      );
    } catch (e) {
      debugPrint('Google Sign-In error: $e');
      return GoogleSignInResult.error(e.toString());
    }
  }

  /// Sign out from Google
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      debugPrint('Google Sign-Out error: $e');
    }
  }

  /// Check if user is signed in with Google
  Future<bool> isSignedIn() async {
    return _googleSignIn.isSignedIn();
  }

  /// Get current Google account (if signed in)
  GoogleSignInAccount? get currentUser => _googleSignIn.currentUser;
}

/// Result class for Google Sign-In
class GoogleSignInResult {
  final bool isSuccess;
  final bool isCancelled;
  final String? idToken;
  final String? email;
  final String? displayName;
  final String? photoUrl;
  final String? error;

  GoogleSignInResult._({
    required this.isSuccess,
    required this.isCancelled,
    this.idToken,
    this.email,
    this.displayName,
    this.photoUrl,
    this.error,
  });

  factory GoogleSignInResult.success({
    required String idToken,
    required String email,
    String? displayName,
    String? photoUrl,
  }) {
    return GoogleSignInResult._(
      isSuccess: true,
      isCancelled: false,
      idToken: idToken,
      email: email,
      displayName: displayName,
      photoUrl: photoUrl,
    );
  }

  factory GoogleSignInResult.cancelled() {
    return GoogleSignInResult._(
      isSuccess: false,
      isCancelled: true,
    );
  }

  factory GoogleSignInResult.error(String message) {
    return GoogleSignInResult._(
      isSuccess: false,
      isCancelled: false,
      error: message,
    );
  }
}


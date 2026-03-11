import 'dart:io';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Environment configuration (không phụ thuộc flavor)
class Environment {
  /// WebSocket URL override from --dart-define=WS_URL
  static const String _wsUrlOverride = String.fromEnvironment('WS_URL');

  /// Get the WebSocket URL from --dart-define hoặc .env (WS_URL)
  static String get wsUrl {
    if (_wsUrlOverride.isNotEmpty) {
      return _wsUrlOverride;
    }

    try {
      final envWsUrl = dotenv.env['WS_URL'] ?? '';
      if (envWsUrl.isNotEmpty) return envWsUrl;
    } catch (_) {}

    return '';
  }

  Environment._();

  // ============================================================
  // API URLs
  // ============================================================
  // ⚠️ CHÚ Ý: Nếu chạy trên máy ảo (Emulator) thì dùng 10.0.2.2
  // Nếu chạy trên điện thoại thật (Real Device) thì PHẢI dùng IP LAN của máy tính (ví dụ: 192.168.1.5)
  // Mở CMD gõ 'ipconfig' để xem IP
  static String get _devBaseUrl {
    // 1. Priority: .env file
    // Check if .env is loaded and has the key
    if (dotenv.isInitialized &&
        dotenv.env['API_BASE_URL'] != null &&
        dotenv.env['API_BASE_URL']!.isNotEmpty) {
      return '${dotenv.env['API_BASE_URL']}/api';
    }

    // 2. Fallback if .env missing
    if (Platform.isAndroid) {
      // Default for Android Emulator
      return 'http://10.0.2.2:8080/api';
    }
    // Default for iOS / Web
    return 'http://localhost:8080/api';
  }

  static const String _apiUrlOverride = String.fromEnvironment('API_URL');

  /// Get the base URL (dart-define -> .env -> local fallback)
  static String get baseUrl {
    // 1. Priority: API_URL passed via --dart-define (compile time)
    if (_apiUrlOverride.isNotEmpty) {
      return _apiUrlOverride;
    }

    // 2. Priority: API_BASE_URL from .env file (auto-appends /api)
    // This is the primary way for Local Dev and CodeMagic
    final envBase = _devBaseUrl;
    if (!envBase.contains('localhost') && !envBase.contains('10.0.2.2')) {
      return envBase;
    }

    // 3. Fallback: Check if there's a specific API_URL in .env
    try {
      final envUrl = dotenv.env['API_URL'] ?? '';
      if (envUrl.isNotEmpty) return envUrl;
    } catch (_) {}

    // 4. Final fallback: local dev values (localhost/10.0.2.2)
    return envBase;
  }

  /// AI Service URL
  /// Priority: AI_SERVICE_URL from .env > same as baseUrl (for ngrok/nginx setup) > default localhost
  static String get _devAiServiceUrl {
    // 1. Priority: AI_SERVICE_URL from .env file
    if (dotenv.isInitialized &&
        dotenv.env['AI_SERVICE_URL'] != null &&
        dotenv.env['AI_SERVICE_URL']!.isNotEmpty) {
      return dotenv.env['AI_SERVICE_URL']!;
    }
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:8000';
    }

    // 2. If using ngrok with nginx reverse proxy, AI service uses same base URL
    // Backend: /api/*, AI: /* (root paths)
    final base = _devBaseUrl.replaceAll('/api', '');
    if (!base.contains('localhost') && !base.contains('10.0.2.2')) {
      return base;
    }

    // 3. Fallback to localhost
    return 'http://localhost:8000';
  }

  static String get aiServiceUrl {
    return _devAiServiceUrl;
  }

  // ============================================================
  // Google OAuth Configuration
  // ============================================================
  // ⚠️ IMPORTANT: These values come from google-services.json
  //
  // Server Client ID (Web type - client_type: 3) - used for backend verification
  // Backend uses this to verify the ID token sent from mobile app
  static const String _googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );

  /// Google Server Client ID for backend token verification
  static String get googleServerClientId {
    if (_googleServerClientId.isNotEmpty) {
      return _googleServerClientId;
    }

    try {
      final envClientId = dotenv.env['GOOGLE_CLIENT_ID'] ?? '';
      if (envClientId.isNotEmpty) return envClientId;
    } catch (_) {}

    return '620454234596-vv1v2t95mmsvpgfj6h2oodj0030fguia.apps.googleusercontent.com';
  }

  // ============================================================
  // Google Maps Configuration
  // ============================================================
  /// Google Maps API Key from .env file
  /// Note: For Android, this is also configured in build.gradle.kts -> AndroidManifest.xml
  static String get googleMapsApiKey {
    if (dotenv.isInitialized && dotenv.env['MAP_API_KEY'] != null) {
      return dotenv.env['MAP_API_KEY']!;
    }
    return '';
  }

  // ============================================================
  // Debug helpers
  // ============================================================
  static void printConfig() {
    // ignore: avoid_print
    print('=== Environment Configuration ===');
    // ignore: avoid_print
    print('Base URL: $baseUrl');
    // ignore: avoid_print
    print('AI Service URL: $aiServiceUrl');
    // ignore: avoid_print
    print('================================');
  }

  // ============================================================
  // Map & Location API Keys (loaded from .env or --dart-define)
  // ============================================================

  // Compile-time dart-define values
  static const String _mapApiKeyFromDartDefine = String.fromEnvironment(
    'MAP_API_KEY',
  );
  static const String _goongApiKeyFromDartDefine = String.fromEnvironment(
    'GOONG_API_KEY',
  );

  /// Google Maps API Key
  /// Priority: --dart-define > .env file (via dotenv)
  static String get mapApiKey {
    if (_mapApiKeyFromDartDefine.isNotEmpty) {
      return _mapApiKeyFromDartDefine;
    }
    // Fallback to dotenv (requires dotenv.load() in main.dart)
    try {
      final key = dotenv.env['MAP_API_KEY'] ?? '';
      return key;
    } catch (_) {
      return '';
    }
  }

  /// Goong.io API Key for geocoding/directions
  /// Priority: .env file (via dotenv) > --dart-define
  static String get goongApiKey {
    if (_goongApiKeyFromDartDefine.isNotEmpty) {
      return _goongApiKeyFromDartDefine;
    }
    // Fallback to dotenv (requires dotenv.load() in main.dart)
    try {
      final key = dotenv.env['GOONG_API_KEY'] ?? '';
      return key;
    } catch (_) {
      return '';
    }
  }
}

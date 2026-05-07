import 'dart:io';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Environment configuration (không phụ thuộc flavor)
class Environment {
  /// WebSocket URL override from --dart-define=WS_URL
  static const String _wsUrlOverride = String.fromEnvironment('WS_URL');

  /// Get the WebSocket URL
  /// IMPORTANT: Dart's Uri.parse() returns port 0 for 'wss://' scheme
  /// (it only recognizes http/https). This causes BAD_DECRYPT errors.
  /// Solution: Always derive WS URL from baseUrl and set port explicitly.
  static String get wsUrl {
    // 1. Priority cao nhất: .env WS_URL
    if (dotenv.isInitialized &&
        dotenv.env['WS_URL'] != null &&
        dotenv.env['WS_URL']!.isNotEmpty) {
      return dotenv.env['WS_URL']!;
    }

    // 2. dart-define override (compile time)
    if (_wsUrlOverride.isNotEmpty) {
      return _wsUrlOverride;
    }

    // 3. Derive from baseUrl (most reliable approach)
    // baseUrl is always https:// or http://, which Dart handles correctly
    final base = baseUrl; // e.g. https://ngrok-domain/api
    final serverUrl = base.replaceAll('/api', ''); // https://ngrok-domain

    if (serverUrl.startsWith('https://')) {
      // Extract host from https:// URL
      final host = serverUrl.replaceFirst('https://', '');
      // Use wss:// with explicit port 443 to avoid Dart port 0 bug
      return 'wss://$host:443/api/ws-native';
    } else if (serverUrl.startsWith('http://')) {
      final host = serverUrl.replaceFirst('http://', '');
      // Local dev: ws:// with the port from the URL (usually 8080)
      // If host already has port (e.g., localhost:8080), don't add another
      return 'ws://$host/api/ws-native';
    }

    // 4. Fallback
    return 'ws://localhost:8080/api/ws-native';
  }

  Environment._();

  // ============================================================
  // API URLs
  // ============================================================
  // ⚠️ CHÚ Ý: Nếu chạy trên máy ảo (Emulator) thì dùng 10.0.2.2
  // Nếu chạy trên điện thoại thật (Real Device) thì PHẢI dùng IP LAN của máy tính (ví dụ: 192.168.1.5)
  // Mở CMD gõ 'ipconfig' để xem IP
  static String get _devBaseUrl {
    // 1. Priority cao nhất: API_URL trong .env (đã full path)
    if (dotenv.isInitialized &&
        dotenv.env['API_URL'] != null &&
        dotenv.env['API_URL']!.isNotEmpty) {
      return _ensureApiPath(dotenv.env['API_URL']!);
    }

    // 2. Priority: API_BASE_URL trong .env (auto append /api)
    if (dotenv.isInitialized &&
        dotenv.env['API_BASE_URL'] != null &&
        dotenv.env['API_BASE_URL']!.isNotEmpty) {
      return _ensureApiPath(dotenv.env['API_BASE_URL']!);
    }

    // 3. Fallback if .env missing
    if (Platform.isAndroid) {
      // Default for Android Emulator
      return 'http://10.0.2.2:8080/api';
    }
    // Default for iOS / Web
    return 'http://localhost:8080/api';
  }

  static const String _apiUrlOverride = String.fromEnvironment('API_URL');

  static String _ensureApiPath(String value) {
    final trimmed = value.trim().replaceAll(RegExp(r'/+$'), '');
    if (trimmed.endsWith('/api')) return trimmed;
    return '$trimmed/api';
  }

  /// Get the base URL (dart-define -> .env -> local fallback)
  static String get baseUrl {
    // 1. Priority cao nhất: .env
    if (dotenv.isInitialized) {
      final envApiUrl = (dotenv.env['API_URL'] ?? '').trim();
      if (envApiUrl.isNotEmpty) return _ensureApiPath(envApiUrl);

      final envApiBaseUrl = (dotenv.env['API_BASE_URL'] ?? '').trim();
      if (envApiBaseUrl.isNotEmpty) return _ensureApiPath(envApiBaseUrl);
    }

    // 2. dart-define (chỉ dùng khi .env không có)
    if (_apiUrlOverride.isNotEmpty) {
      return _ensureApiPath(_apiUrlOverride);
    }

    // 3. Final fallback: local dev values (localhost/10.0.2.2)
    return _devBaseUrl;
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

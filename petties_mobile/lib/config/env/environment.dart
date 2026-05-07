import 'dart:io';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Environment configuration (không phụ thuộc flavor)
class Environment {
  /// WebSocket URL override from --dart-define=WS_URL
  static const String _wsUrlOverride = String.fromEnvironment('WS_URL');

  static String _normalizeWebSocketUrl(String value) {
    // Trim and remove trailing slashes, then add exactly one back
    final trimmed = value.trim().replaceAll(RegExp(r'/+$'), '') + '/';

    // Already has correct WebSocket scheme - return as-is
    if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) {
      return trimmed;
    }

    // Convert https:// to wss://
    if (trimmed.startsWith('https://')) {
      return trimmed.replaceFirst('https://', 'wss://');
    }

    // Convert http:// to ws://
    if (trimmed.startsWith('http://')) {
      return trimmed.replaceFirst('http://', 'ws://');
    }

    // Fallback: return as-is
    return trimmed;
  }

  /// Get the WebSocket URL
  /// IMPORTANT: Dart's Uri.parse() returns port 0 for 'wss://' scheme
  /// (it only recognizes http/https). This causes BAD_DECRYPT errors.
  /// Solution: Always derive WS URL from baseUrl and set port explicitly.
  static String get wsUrl {
    // 1. Priority cao nhất: .env WS_URL
    if (dotenv.isInitialized &&
        dotenv.env['WS_URL'] != null &&
        dotenv.env['WS_URL']!.isNotEmpty) {
      return _normalizeWebSocketUrl(dotenv.env['WS_URL']!);
    }

    // 2. dart-define override (compile time)
    if (_wsUrlOverride.isNotEmpty) {
      return _normalizeWebSocketUrl(_wsUrlOverride);
    }

    // 3. Derive from baseUrl (most reliable approach)
    // baseUrl is always https:// or http://, which Dart handles correctly
    final base = baseUrl; // e.g. https://api.petties.world/api
    final serverUrl = base.replaceAll('/api', ''); // https://api.petties.world

    if (serverUrl.startsWith('https://')) {
      // Extract host from https:// URL
      final host = serverUrl.replaceFirst('https://', '');
      // Use /ws-native/ to match the dedicated nginx location block.
      // Keep an explicit port because the STOMP client can otherwise
      // downgrade the parsed URI to port 0 on some Android devices.
      return 'wss://$host:443/ws-native/';
    } else if (serverUrl.startsWith('http://')) {
      final host = serverUrl.replaceFirst('http://', '');
      // Local dev: ws:// with the port from the URL (usually 8080)
      return 'ws://$host/ws-native/';
    }

    // 4. Fallback
    return 'ws://localhost:8080/ws-native/';
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
  /// Priority: AI_SERVICE_URL from .env > unified proxy /ai path > default localhost
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

    // 2. If using ngrok/nginx reverse proxy, AI service is served under /ai path
    // e.g. https://api.petties.world/ai  or  https://abc.ngrok.io/ai
    final base = _devBaseUrl.replaceAll('/api', '');
    if (!base.contains('localhost') && !base.contains('10.0.2.2')) {
      // FIX: append /ai so nginx routes to ai-service instead of frontend
      return '$base/ai';
    }

    // 3. Fallback to localhost
    return 'http://localhost:8000';
  }

  static String get aiServiceUrl {
    return _devAiServiceUrl;
  }

  /// WebSocket base URL for AI chat (nginx location is `/ws/chat/`)
  /// IMPORTANT: Nginx route for AI WS does NOT include `/ai` prefix.
  /// Ví dụ:
  /// - AI service URL (REST): `https://api.petties.world/ai`
  /// - AI WS URL (WS): `wss://api.petties.world/ws/chat/{session_id}`
  /// - Không dùng `https://...:0` vì Dart parse WS scheme có vấn đề.
  static String get aiWsBaseUrl {
    // 1. Highest priority: explicit override from .env
    if (dotenv.isInitialized &&
        dotenv.env['AI_WS_URL'] != null &&
        dotenv.env['AI_WS_URL']!.isNotEmpty) {
      return dotenv.env['AI_WS_URL']!;
    }

    // 2. Derive from aiServiceUrl by stripping `/ai` suffix
    final raw = aiServiceUrl.trim().replaceFirst(RegExp(r'/+$'), '');
    final withoutAiPrefix = raw.replaceFirst(RegExp(r'/ai$'), '');

    if (withoutAiPrefix.startsWith('https://')) {
      final host = withoutAiPrefix.replaceFirst('https://', '');
      // Ensure an explicit port to avoid Dart `wss://` port=0 parsing issues.
      final hostWithPort = host.contains(':') ? host : '$host:443';
      return 'wss://$hostWithPort';
    }

    if (withoutAiPrefix.startsWith('http://')) {
      final host = withoutAiPrefix.replaceFirst('http://', '');
      return host.contains(':') ? 'ws://$host' : 'ws://$host:80';
    }

    // 3. Fallback
    return 'wss://api.petties.world:443';
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
    print('WS URL: $wsUrl');
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

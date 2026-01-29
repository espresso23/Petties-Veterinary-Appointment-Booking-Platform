import 'dart:io';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Environment configuration for different build modes
class Environment {
  /// WebSocket URL override from --dart-define=WS_URL
  static const String _wsUrlOverride = String.fromEnvironment('WS_URL');

  /// Get the WebSocket URL from --dart-define, trả về rỗng nếu không có
  static String get wsUrl => _wsUrlOverride;
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

  static const String _stagingBaseUrl = 'https://api-test.petties.world/api';
  static const String _prodBaseUrl = 'https://api.petties.world/api';
  static const String _stagingAiServiceUrl =
      'https://api-test.petties.world/ai';

  // Flavor from build arguments
  static const String _flavor = String.fromEnvironment(
    'FLAVOR',
    defaultValue: 'dev',
  );
  static const String _apiUrlOverride = String.fromEnvironment('API_URL');

  /// Get the base URL based on flavor
  static String get baseUrl {
    // Priority 1: API_URL passed via --dart-define
    if (_apiUrlOverride.isNotEmpty) {
      return _apiUrlOverride;
    }

    // Priority 2: Flavor specific defaults
    switch (_flavor) {
      case 'prod':
        return _prodBaseUrl;
      case 'staging':
      case 'test':
        return _stagingBaseUrl;
      default:
        return _devBaseUrl;
    }
  }

  /// Check if running in production mode
  static bool get isProduction => _flavor == 'prod';

  /// Check if running in staging/test mode
  static bool get isStaging => _flavor == 'staging' || _flavor == 'test';

  /// Get current flavor
  static String get flavor => _flavor;

  /// AI Service URL
  static String get _devAiServiceUrl {
    if (Platform.isAndroid) {
      return 'http://localhost:8000';
    }
    return 'http://localhost:8000';
  }

  static const String _prodAiServiceUrl = 'https://ai.petties.world';

  static String get aiServiceUrl {
    switch (_flavor) {
      case 'prod':
        return _prodAiServiceUrl;
      case 'staging':
      case 'test':
        return _stagingAiServiceUrl;
      default:
        return _devAiServiceUrl;
    }
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
    // Web Client ID (client_type: 3) from google-services.json
    defaultValue:
        '620454234596-7vpt8pg3sdqo0j2u0r6j4iuaqu1q8t9h.apps.googleusercontent.com',
  );

  /// Google Server Client ID for backend token verification
  static String get googleServerClientId => _googleServerClientId;

  // ============================================================
  // Debug helpers
  // ============================================================
  static void printConfig() {
    // ignore: avoid_print
    print('=== Environment Configuration ===');
    // ignore: avoid_print
    print('Flavor: $_flavor');
    // ignore: avoid_print
    print('Is Production: $isProduction');
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
  static const String _mapApiKeyFromDartDefine =
      String.fromEnvironment('MAP_API_KEY');
  static const String _goongApiKeyFromDartDefine =
      String.fromEnvironment('GOONG_API_KEY');

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

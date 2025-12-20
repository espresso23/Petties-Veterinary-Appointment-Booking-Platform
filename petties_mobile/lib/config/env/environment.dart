/// Environment configuration for different build modes
class Environment {
  Environment._();

  // ============================================================
  // API URLs
  // ============================================================
  // ⚠️ CHÚ Ý: Nếu chạy trên máy ảo (Emulator) thì dùng 10.0.2.2
  // Nếu chạy trên điện thoại thật (Real Device) thì PHẢI dùng IP LAN của máy tính (ví dụ: 192.168.1.5)
  // Mở CMD gõ 'ipconfig' để xem IP
  // static const String _devBaseUrl = 'http://10.0.2.2:8080/api'; // Cho Emulator
  static const String _devBaseUrl = 'http://10.0.2.2:8080/api';
  static const String _stagingBaseUrl = 'https://api-test.petties.world/api';
  static const String _prodBaseUrl = 'https://api.petties.world/api';
  static const String _stagingAiServiceUrl =
      'https://api-test.petties.world/ai';

  static const String _defaultDevUrl = 'http://10.0.2.2:8080/api';

  // Flavor from build arguments
  static const String _flavor =
      String.fromEnvironment('FLAVOR', defaultValue: 'dev');
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
  static const String _devAiServiceUrl = 'http://10.0.2.2:8000';
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
  // ⚠️ IMPORTANT: Replace these with your actual Client IDs from Google Cloud Console
  //
  // Server Client ID (Web type) - used for backend verification
  // This is the same for all platforms
  static const String _googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    // ⚠️ PHẢI dùng WEB Client ID, không phải iOS/Android Client ID
    defaultValue:
        '770052765216-lhn9icposo0odos1petjhdfrpcnso7fe.apps.googleusercontent.com',
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
}

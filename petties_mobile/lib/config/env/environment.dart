/// Environment configuration for different build modes
class Environment {
  Environment._();

  static const String _devBaseUrl = 'http://10.0.2.2:8080/api';
  static const String _prodBaseUrl = 'https://petties-backend.onrender.com/api';

  /// Get the base URL based on build mode
  static String get baseUrl {
    // Use compile-time constant for build mode
    const bool isProduction = bool.fromEnvironment('dart.vm.product');
    return isProduction ? _prodBaseUrl : _devBaseUrl;
  }

  /// Check if running in production mode
  static bool get isProduction {
    return const bool.fromEnvironment('dart.vm.product');
  }

  /// AI Service URL (for direct AI features if needed)
  static const String _devAiServiceUrl = 'http://10.0.2.2:8000';
  static const String _prodAiServiceUrl = 'https://petties-ai-service.onrender.com';

  static String get aiServiceUrl {
    const bool isProduction = bool.fromEnvironment('dart.vm.product');
    return isProduction ? _prodAiServiceUrl : _devAiServiceUrl;
  }
}

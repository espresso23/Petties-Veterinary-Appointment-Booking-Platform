/// Environment configuration for different build modes
class Environment {
  Environment._();

  static const String _devBaseUrl = 'http://10.0.2.2:8080/api';
  static const String _prodBaseUrl = 'https://api.petties.world/api';

  // ✅ Tạm thời: Force production để test với backend trên EC2
  static const bool _forceProduction = true;  // ✅ Set true để dùng production URL
  
  /// Get the base URL based on build mode
  static String get baseUrl {
    if (_forceProduction) {
      return _prodBaseUrl;
    }
    const bool isProduction = bool.fromEnvironment('dart.vm.product');
    return isProduction ? _prodBaseUrl : _devBaseUrl;
  }

  /// Check if running in production mode
  static bool get isProduction {
    if (_forceProduction) {
      return true;
    }
    return const bool.fromEnvironment('dart.vm.product');
  }

  /// AI Service URL (for direct AI features if needed)
  static const String _devAiServiceUrl = 'http://10.0.2.2:8000';
  static const String _prodAiServiceUrl = 'https://ai.petties.world';

  static String get aiServiceUrl {
    if (_forceProduction) {
      return _prodAiServiceUrl;
    }
    const bool isProduction = bool.fromEnvironment('dart.vm.product');
    return isProduction ? _prodAiServiceUrl : _devAiServiceUrl;
  }
}

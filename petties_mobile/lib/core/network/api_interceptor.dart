import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import '../utils/storage_service.dart';
import '../../config/constants/app_constants.dart';

/// Interceptor for API requests and responses
class ApiInterceptor extends Interceptor {
  final Logger _logger = Logger();
  final StorageService _storage = StorageService();

  bool get _isDebug => !const bool.fromEnvironment('dart.vm.product');

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Add authentication token
    final token = await _storage.getString(AppConstants.accessTokenKey);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    // Skip ngrok browser warning (required for ngrok Free Tier)
    options.headers['ngrok-skip-browser-warning'] = 'true';

    _logger.d('REQUEST[${options.method}] => PATH: ${options.path}');
    if (_isDebug) {
      _logger.d('Query: ${options.queryParameters}');
    }

    super.onRequest(options, handler);
  }

  @override
  void onResponse(
    Response response,
    ResponseInterceptorHandler handler,
  ) {
    _logger.d(
      'RESPONSE[${response.statusCode}] => PATH: ${response.requestOptions.path}',
    );
    if (_isDebug) {
      _logger.d('Response type: ${response.data.runtimeType}');
    }

    super.onResponse(response, handler);
  }

  @override
  void onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    _logger.e(
      'ERROR[${err.response?.statusCode}] => PATH: ${err.requestOptions.path}',
    );
    _logger.e('Message: ${err.message}');
    if (_isDebug) {
      _logger.e('Error type: ${err.type}');
    }

    // Handle token refresh on 401
    if (err.response?.statusCode == 401) {
      // Implement token refresh logic here
      // final refreshToken = await _storage.getString(AppConstants.refreshTokenKey);
      // if (refreshToken != null) {
      //   // Attempt to refresh token
      //   // If successful, retry the original request
      // }
    }

    super.onError(err, handler);
  }
}

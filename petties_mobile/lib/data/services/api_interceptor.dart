import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import '../../config/constants/app_constants.dart';
import '../../utils/storage_service.dart';
import '../../config/env/environment.dart';

/// Interceptor for API requests and responses
class ApiInterceptor extends Interceptor {
  final Logger _logger = Logger();
  final StorageService _storage = StorageService();
  final Dio _dio = Dio();

  bool _isRefreshing = false;
  final List<_PendingRequest> _pendingRequests = [];

  ApiInterceptor() {
    final baseUrl = Environment.baseUrl;

    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 60);
    _dio.options.receiveTimeout = const Duration(seconds: 60);
  }

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

    super.onRequest(options, handler);
  }

  @override
  void onResponse(
    Response response,
    ResponseInterceptorHandler handler,
  ) {
    // NOTE: Logging removed for production/security

    super.onResponse(response, handler);
  }

  @override
  void onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Expected 404 for EMR check logic, suppress log
    if (err.response?.statusCode == 404 &&
        err.requestOptions.path.contains('/emr/booking/')) {
      super.onError(err, handler);
      return;
    }

    _logger.e(
      'ERROR[${err.response?.statusCode}] => PATH: ${err.requestOptions.path}',
    );
    _logger.e('Message: ${err.message}');
    _logger.e('Data: ${err.response?.data}');

    // Handle token refresh on 401
    if (err.response?.statusCode == 401) {
      final requestOptions = err.requestOptions;

      // Skip refresh for auth endpoints
      if (requestOptions.path.contains('/auth/login') ||
          requestOptions.path.contains('/auth/register') ||
          requestOptions.path.contains('/auth/refresh')) {
        super.onError(err, handler);
        return;
      }

      // If already refreshing, queue this request
      if (_isRefreshing) {
        _pendingRequests.add(_PendingRequest(requestOptions, handler));
        return;
      }

      _isRefreshing = true;

      try {
        final refreshToken =
            await _storage.getString(AppConstants.refreshTokenKey);
        if (refreshToken == null) {
          _isRefreshing = false;
          _clearAuthAndRejectPending(handler, err);
          return;
        }

        // Try to refresh token
        final response = await _dio.post(
          '/auth/refresh',
          data: {},
          options: Options(
            headers: {
              'Authorization': 'Bearer $refreshToken',
            },
          ),
        );

        final newAccessToken = response.data['accessToken'] as String?;
        final newRefreshToken = response.data['refreshToken'] as String?;

        if (newAccessToken != null && newRefreshToken != null) {
          // Save new tokens
          await _storage.setString(AppConstants.accessTokenKey, newAccessToken);
          await _storage.setString(
              AppConstants.refreshTokenKey, newRefreshToken);

          // Retry original request
          requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
          final retryResponse = await _dio.fetch(requestOptions);
          handler.resolve(retryResponse);

          // Retry pending requests
          _retryPendingRequests(newAccessToken);
        } else {
          _clearAuthAndRejectPending(handler, err);
        }
      } catch (e) {
        _clearAuthAndRejectPending(handler, err);
      } finally {
        _isRefreshing = false;
      }
    } else {
      super.onError(err, handler);
    }
  }

  void _retryPendingRequests(String newAccessToken) async {
    for (var pending in _pendingRequests) {
      try {
        pending.requestOptions.headers['Authorization'] =
            'Bearer $newAccessToken';
        final response = await _dio.fetch(pending.requestOptions);
        pending.handler.resolve(response);
      } catch (e) {
        pending.handler.reject(DioException(
          requestOptions: pending.requestOptions,
          error: e,
        ));
      }
    }
    _pendingRequests.clear();
  }

  void _clearAuthAndRejectPending(
    ErrorInterceptorHandler handler,
    DioException originalError,
  ) async {
    // Clear auth data
    await _storage.remove(AppConstants.accessTokenKey);
    await _storage.remove(AppConstants.refreshTokenKey);
    await _storage.remove(AppConstants.userIdKey);
    await _storage.remove(AppConstants.userDataKey);
    await _storage.remove(AppConstants.userProfileKey);

    // Reject pending requests
    for (var pending in _pendingRequests) {
      pending.handler.reject(originalError);
    }
    _pendingRequests.clear();

    handler.reject(originalError);
  }
}

class _PendingRequest {
  final RequestOptions requestOptions;
  final ErrorInterceptorHandler handler;

  _PendingRequest(this.requestOptions, this.handler);
}

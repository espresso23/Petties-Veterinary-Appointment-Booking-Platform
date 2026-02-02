import 'package:dio/dio.dart';
import '../../config/constants/app_constants.dart';
import '../../core/error/exceptions.dart';
import 'api_interceptor.dart';
import '../../config/env/environment.dart';

/// HTTP client wrapper using Dio - Singleton pattern
class ApiClient {
  static ApiClient? _instance;
  static ApiClient get instance => _instance ??= ApiClient._internal();

  late final Dio _dio;

  // Private constructor
  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: Environment.baseUrl,
        connectTimeout:
            const Duration(milliseconds: 30000), // Increased to 30s
        receiveTimeout:
            const Duration(milliseconds: 30000), // Increased to 30s
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(ApiInterceptor());
  }

  // Factory constructor for backward compatibility
  factory ApiClient({String? baseUrl}) {
    // If custom baseUrl is needed, create new instance (rare case)
    if (baseUrl != null) {
      final client = ApiClient._internal();
      client._dio.options.baseUrl = baseUrl;
      return client;
    }
    return instance;
  }

  /// GET request
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// POST request
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// PUT request
  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// PATCH request
  Future<Response> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.patch(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// DELETE request
  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// Handle Dio errors and convert to app exceptions
  AppException _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return TimeoutException('Request timeout');

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        
        // Safely extract message from response data
        String message = 'Server error';
        if (error.response?.data is Map<String, dynamic>) {
          message = error.response?.data['message'] ?? 'Server error';
        } else if (error.response?.data is String) {
          message = error.response?.data;
        }

        if (statusCode == 401 || statusCode == 403) {
          return AuthException(message, statusCode.toString());
        } else if (statusCode == 404) {
          return NotFoundException(message, statusCode.toString());
        } else if (statusCode != null &&
            statusCode >= 400 &&
            statusCode < 500) {
          return ValidationException(message, statusCode.toString());
        } else {
          return ServerException(message, statusCode.toString());
        }

      case DioExceptionType.connectionError:
        return NetworkException('No internet connection');

      case DioExceptionType.cancel:
        return ServerException('Request cancelled');

      default:
        return ServerException('An unexpected error occurred');
    }
  }

  /// Get Dio instance for advanced usage
  Dio get dio => _dio;
}

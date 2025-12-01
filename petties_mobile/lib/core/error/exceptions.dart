/// Base class for all application exceptions
abstract class AppException implements Exception {
  final String message;
  final String? code;

  AppException(this.message, [this.code]);

  @override
  String toString() => message;
}

/// Exception thrown when there's a network/server error
class ServerException extends AppException {
  ServerException([super.message = 'Server error occurred', super.code]);
}

/// Exception thrown when there's a network connection error
class NetworkException extends AppException {
  NetworkException([super.message = 'Network connection error', super.code]);
}

/// Exception thrown when authentication fails
class AuthException extends AppException {
  AuthException([super.message = 'Authentication failed', super.code]);
}

/// Exception thrown when validation fails
class ValidationException extends AppException {
  ValidationException([super.message = 'Validation error', super.code]);
}

/// Exception thrown when a resource is not found
class NotFoundException extends AppException {
  NotFoundException([super.message = 'Resource not found', super.code]);
}

/// Exception thrown for cache-related errors
class CacheException extends AppException {
  CacheException([super.message = 'Cache error occurred', super.code]);
}

/// Exception thrown when permission is denied
class PermissionException extends AppException {
  PermissionException([super.message = 'Permission denied', super.code]);
}

/// Exception thrown for timeout errors
class TimeoutException extends AppException {
  TimeoutException([super.message = 'Request timeout', super.code]);
}

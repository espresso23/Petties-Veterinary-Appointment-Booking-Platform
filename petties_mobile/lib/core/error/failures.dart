/// Base class for all failures
abstract class Failure {
  final String message;
  final String? code;

  const Failure(this.message, [this.code]);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Failure &&
          runtimeType == other.runtimeType &&
          message == other.message &&
          code == other.code;

  @override
  int get hashCode => message.hashCode ^ code.hashCode;
}

/// Failure for server-related errors
class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Server error occurred', super.code]);
}

/// Failure for network-related errors
class NetworkFailure extends Failure {
  const NetworkFailure(
      [super.message = 'Network connection error', super.code]);
}

/// Failure for authentication errors
class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Authentication failed', super.code]);
}

/// Failure for validation errors
class ValidationFailure extends Failure {
  const ValidationFailure([super.message = 'Validation error', super.code]);
}

/// Failure when resource not found
class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Resource not found', super.code]);
}

/// Failure for cache errors
class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Cache error occurred', super.code]);
}

/// Failure for permission errors
class PermissionFailure extends Failure {
  const PermissionFailure([super.message = 'Permission denied', super.code]);
}

/// Failure for timeout errors
class TimeoutFailure extends Failure {
  const TimeoutFailure([super.message = 'Request timeout', super.code]);
}

/// Failure for unknown errors
class UnknownFailure extends Failure {
  const UnknownFailure([super.message = 'Unknown error occurred', super.code]);
}

import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';

/// Base repository implementation
abstract class RepositoryImpl {
  // Define common repository methods
  
  /// Handle exceptions and convert to failures
  Future<Either<Failure, T>> executeWithErrorHandling<T>(
    Future<T> Function() operation,
  ) async {
    try {
      final result = await operation();
      return Right(result);
    } catch (e) {
      return Left(_mapExceptionToFailure(e));
    }
  }

  Failure _mapExceptionToFailure(dynamic exception) {
    // Map exceptions to appropriate failures
    // This is a placeholder - implement based on your error types
    if (exception.toString().contains('network')) {
      return const NetworkFailure();
    } else if (exception.toString().contains('auth')) {
      return const AuthFailure();
    } else {
      return UnknownFailure(exception.toString());
    }
  }
}

/// Example: Auth repository implementation
class AuthRepositoryImpl extends RepositoryImpl {
  // final AuthRemoteDataSource _remoteDataSource;
  // final AuthLocalDataSource _localDataSource;
  
  // AuthRepositoryImpl(this._remoteDataSource, this._localDataSource);
  
  // @override
  // Future<Either<Failure, User>> login(String email, String password) {
  //   return executeWithErrorHandling(() async {
  //     final userModel = await _remoteDataSource.login(email, password);
  //     await _localDataSource.saveAccessToken(userModel.accessToken);
  //     return userModel.toEntity();
  //   });
  // }
}

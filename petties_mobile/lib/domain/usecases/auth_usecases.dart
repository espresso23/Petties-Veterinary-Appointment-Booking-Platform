import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/user.dart';
import 'base_usecase.dart';

/// Use case for user login
class LoginUseCase extends UseCase<User, LoginParams> {
  // final AuthRepository repository;

  // LoginUseCase(this.repository);

  @override
  Future<Either<Failure, User>> call(LoginParams params) async {
    // return await repository.login(params.email, params.password);
    throw UnimplementedError('Implement login use case');
  }
}

/// Parameters for login use case
class LoginParams {
  final String email;
  final String password;

  const LoginParams({
    required this.email,
    required this.password,
  });
}

/// Use case for user logout
class LogoutUseCase extends NoParamsUseCase<void> {
  // final AuthRepository repository;

  // LogoutUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call() async {
    // return await repository.logout();
    throw UnimplementedError('Implement logout use case');
  }
}

/// Use case for getting current user
class GetCurrentUserUseCase extends NoParamsUseCase<User> {
  // final AuthRepository repository;

  // GetCurrentUserUseCase(this.repository);

  @override
  Future<Either<Failure, User>> call() async {
    // return await repository.getCurrentUser();
    throw UnimplementedError('Implement get current user use case');
  }
}

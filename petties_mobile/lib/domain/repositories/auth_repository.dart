
/// Base repository interface
abstract class Repository {
  // Define common repository interface methods
}

/// Example: Auth repository interface
abstract class AuthRepository extends Repository {
  // Future<Either<Failure, User>> login(String email, String password);
  // Future<Either<Failure, User>> register(UserRegistration registration);
  // Future<Either<Failure, void>> logout();
  // Future<Either<Failure, User>> getCurrentUser();
  // Future<Either<Failure, void>> resetPassword(String email);
}

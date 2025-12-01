import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';

/// Base use case class
abstract class UseCase<Type, Params> {
  Future<Either<Failure, Type>> call(Params params);
}

/// Use case with no parameters
abstract class NoParamsUseCase<Type> {
  Future<Either<Failure, Type>> call();
}

/// Parameters for use cases that don't need any parameters
class NoParams {
  const NoParams();
}

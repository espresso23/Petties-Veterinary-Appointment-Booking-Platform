import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/diagnosis.dart';
import 'package:petties_mobile/data/services/diagnosis_service.dart';

void main() {
  group('DiagnosisService', () {
    late DiagnosisService service;

    setUp(() {
      service = DiagnosisService();
    });

    group('DiagnosisException', () {
      test('toString returns message', () {
        final exception = DiagnosisException(
          message: 'Test error message',
          statusCode: 500,
        );

        expect(exception.toString(), 'Test error message');
      });

      test('toString returns message without statusCode', () {
        final exception = DiagnosisException(
          message: 'Connection failed',
        );

        expect(exception.toString(), 'Connection failed');
      });

      test('includes statusCode in message', () {
        final exception = DiagnosisException(
          message: 'Bad request',
          statusCode: 400,
        );

        expect(exception.message, 'Bad request');
        expect(exception.statusCode, 400);
      });
    });

    group('DiagnosisSpecies enum', () {
      test('dog enum has correct name', () {
        expect(DiagnosisSpecies.dog.name, 'dog');
      });

      test('cat enum has correct name', () {
        expect(DiagnosisSpecies.cat.name, 'cat');
      });

      test('other enum has correct name', () {
        expect(DiagnosisSpecies.other.name, 'other');
      });

      test('has 3 values', () {
        expect(DiagnosisSpecies.values.length, 3);
      });
    });

    group('DiagnosisSex enum', () {
      test('male enum has correct name', () {
        expect(DiagnosisSex.male.name, 'male');
      });

      test('female enum has correct name', () {
        expect(DiagnosisSex.female.name, 'female');
      });

      test('unknown enum has correct name', () {
        expect(DiagnosisSex.unknown.name, 'unknown');
      });

      test('has 3 values', () {
        expect(DiagnosisSex.values.length, 3);
      });
    });
  });
}

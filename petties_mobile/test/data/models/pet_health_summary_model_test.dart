import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/pet_health_summary.dart';

void main() {
  group('PetHealthSummary', () {
    test('fromJson ho tro backend camelCase', () {
      final json = {
        'petInfo': {
          'petId': '72fc1012-c0fe-45b2-83c5-da7310356f41',
          'name': 'Hadine',
          'species': 'DOG',
          'breed': 'Corgi',
          'ageMonths': 38,
          'weightKg': 10.5,
        },
        'latestEmr': {
          'examDate': '2026-03-14',
          'clinicName': 'Bệnh Viện Thú Y PetCare',
          'diagnosis': 'Sức khỏe tốt',
          'treatment': 'Theo dõi định kỳ',
        },
        'healthWarnings': [
          {
            'type': 'RECHECK_REQUIRED',
            'message': 'Cần tái khám',
            'severity': 'MEDIUM',
          },
        ],
        'medicationReminders': [
          {
            'medication': 'Metronidazole 250mg',
            'dosage': '1 viên',
            'frequency': '2 lần/ngày',
          },
        ],
        'suggestedActions': [
          {
            'type': 'BOOK_APPOINTMENT',
            'label': 'Đặt lịch ngay',
            'reason': 'Theo dõi sức khỏe định kỳ',
          },
        ],
        'disclaimer': 'Thông tin chỉ mang tính tham khảo.',
      };

      final summary = PetHealthSummary.fromJson(json);

      expect(summary.petInfo, isNotNull);
      expect(summary.petInfo!.petId, '72fc1012-c0fe-45b2-83c5-da7310356f41');
      expect(summary.latestEmr, isNotNull);
      expect(summary.latestEmr!.clinicName, 'Bệnh Viện Thú Y PetCare');
      expect(summary.healthWarnings.length, 1);
      expect(summary.medicationReminders.length, 1);
      expect(summary.suggestedActions.length, 1);
    });

    test('fromJson parse duoc ngay dd/MM/yyyy', () {
      final json = {
        'latestEmr': {
          'examDate': '14/03/2026',
          'clinicName': 'Bệnh Viện Thú Y PetCare',
        },
      };

      final summary = PetHealthSummary.fromJson(json);

      expect(summary.latestEmr, isNotNull);
      expect(summary.latestEmr!.examDate, isNotNull);
      expect(summary.latestEmr!.examDate!.year, 2026);
      expect(summary.latestEmr!.examDate!.month, 3);
      expect(summary.latestEmr!.examDate!.day, 14);
    });
  });
}

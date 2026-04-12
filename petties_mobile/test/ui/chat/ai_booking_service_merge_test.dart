import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_service_merge.dart';

void main() {
  group('bookingServiceOptionCanonicalScore', () {
    test('uu tien uuid hon ten tu prompt', () {
      final fromPrompt = AiBookingServiceOption(
        id: 'tắm chó',
        name: 'tắm chó',
        clinicId: 'c1',
      );
      final fromDb = AiBookingServiceOption(
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        name: 'Tắm chó',
        clinicId: 'c1',
        basePrice: 100000,
      );
      expect(bookingServiceOptionCanonicalScore(fromDb) >
          bookingServiceOptionCanonicalScore(fromPrompt), isTrue);
    });
  });

  group('dedupeBookingServiceOptionsPreferCanonical', () {
    test('gop trung ten cung clinic, giu ban ghi co id backend', () {
      final merged = dedupeBookingServiceOptionsPreferCanonical(
        [
          const AiBookingServiceOption(
            id: 'tắm chó',
            name: 'tắm chó',
            clinicId: 'clinic-1',
          ),
          const AiBookingServiceOption(
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            name: 'Tắm chó',
            clinicId: 'clinic-1',
            basePrice: 120000,
          ),
        ],
        scopeClinicId: 'clinic-1',
      );
      expect(merged.length, 1);
      expect(merged.first.id, '3fa85f64-5717-4562-b3fc-2c963f66afa6');
      expect(merged.first.name, 'Tắm chó');
    });
  });

  group('canonicalizeSelectedBookingServiceIds', () {
    test('doi id giong ten prompt sang id dich vu thuc', () {
      final options = [
        const AiBookingServiceOption(
          id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          name: 'Tắm chó',
          clinicId: 'clinic-1',
        ),
      ];
      final out = canonicalizeSelectedBookingServiceIds(
        {'tắm chó'},
        options,
      );
      expect(out, {'3fa85f64-5717-4562-b3fc-2c963f66afa6'});
    });
  });
}

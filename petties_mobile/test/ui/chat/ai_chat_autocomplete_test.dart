import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_tracker.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_chat_autocomplete.dart';

void main() {
  group('buildAiChatAutocompleteSuggestions', () {
    test('goi y prompt booking ngan theo tracker hien tai', () {
      const tracker = AiBookingTrackerSnapshot(
        petName: 'Hadine',
        clinicName: 'Pet Care Da Nang',
      );

      final suggestions = buildAiChatAutocompleteSuggestions(
        query: 'đặt lịch',
        quickPrompts: const <String>[
          'Đặt lịch cho thú cưng của tôi',
          'Tìm phòng khám gần tôi',
        ],
        tracker: tracker,
      );

      expect(
        suggestions.any((item) => item.contains('Hadine')),
        isTrue,
      );
      expect(
        suggestions.any((item) => item.contains('Pet Care Da Nang')),
        isTrue,
      );
      expect(suggestions.length, lessThanOrEqualTo(5));
    });

    test('uu tien loc quick prompts khi query khop truc tiep', () {
      final suggestions = buildAiChatAutocompleteSuggestions(
        query: 'gan toi',
        quickPrompts: const <String>[
          'Tìm phòng khám gần tôi',
          'Đặt lịch tiêm phòng sáng mai',
        ],
        tracker: AiBookingTrackerSnapshot.empty,
      );

      expect(suggestions.first, 'Tìm phòng khám gần tôi');
    });

    test('goi y da dang category thay vi lap lai mot mau', () {
      const tracker = AiBookingTrackerSnapshot(
        petName: 'Mimi',
        clinicName: 'Pet Care Da Nang',
        serviceNames: <String>['khám tổng quát'],
        status: 'COLLECTING',
      );

      final suggestions = buildAiChatAutocompleteSuggestions(
        query: 'pet',
        quickPrompts: const <String>[
          'Pet Care Da Nang mở cửa mấy giờ?',
          'Tìm phòng khám gần tôi',
        ],
        tracker: tracker,
      );

      expect(suggestions.length, greaterThanOrEqualTo(3));
      expect(
        suggestions.toSet().length,
        suggestions.length,
      );
      expect(
        suggestions
            .any((item) => item.contains('Pet Care Da Nang mở cửa mấy giờ')),
        isTrue,
      );
      expect(
        suggestions.any((item) => item.contains('Mimi')),
        isTrue,
      );
    });

    test('uu tien goi y tiep tuc khi booking dang tam dung', () {
      const tracker = AiBookingTrackerSnapshot(
        petName: 'Milo',
        status: 'SUSPENDED',
      );

      final suggestions = buildAiChatAutocompleteSuggestions(
        query: 'tiep',
        quickPrompts: const <String>[],
        tracker: tracker,
      );

      expect(
        suggestions.any(
            (item) => item.contains('Tiếp tục giúp tôi phần đặt lịch đang dở')),
        isTrue,
      );
    });

    test('giu goi y hien thi tieng viet co dau', () {
      final suggestions = buildAiChatAutocompleteSuggestions(
        query: 'tiem',
        quickPrompts: const <String>[],
        tracker: const AiBookingTrackerSnapshot(petName: 'Milo'),
      );

      expect(
        suggestions.any(
          (item) => item.contains('tiêm') || item.contains('Tiêm'),
        ),
        isTrue,
      );
    });

    test('khong goi y khi composer dang rong', () {
      final suggestions = buildAiChatAutocompleteSuggestions(
        query: '',
        quickPrompts: const <String>[
          'Đặt lịch cho thú cưng của tôi',
          'Tìm phòng khám gần tôi',
        ],
        tracker: const AiBookingTrackerSnapshot(
          petName: 'Hadine',
          clinicName: 'Pet Care Da Nang',
        ),
      );

      expect(suggestions, isEmpty);
    });
  });
}

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
        query: 'dat lich',
        quickPrompts: const <String>[
          'Dat lich cho thu cung cua toi',
          'Tim phong kham gan toi',
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
    });

    test('uu tien loc quick prompts khi query khop truc tiep', () {
      final suggestions = buildAiChatAutocompleteSuggestions(
        query: 'gan toi',
        quickPrompts: const <String>[
          'Tim phong kham gan toi',
          'Dat lich tiem phong sang mai',
        ],
        tracker: AiBookingTrackerSnapshot.empty,
      );

      expect(suggestions.first, 'Tim phong kham gan toi');
    });

    test('khong goi y khi composer dang rong', () {
      final suggestions = buildAiChatAutocompleteSuggestions(
        query: '',
        quickPrompts: const <String>[
          'Dat lich cho thu cung cua toi',
          'Tim phong kham gan toi',
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

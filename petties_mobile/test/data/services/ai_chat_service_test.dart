import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/services/ai_chat_service.dart';

void main() {
  group('AiChatService', () {
    test('encodeOutgoingPayload keeps ui_action and display_message separate',
        () {
      final service = AiChatService();

      final encoded = service.encodeOutgoingPayload(
        message: '',
        displayMessage: 'Chọn phòng khám',
        uiAction: {
          'type': 'select_clinic',
          'clinic_id': 'clinic-1',
        },
        location: {
          'lat': 10.1,
          'lng': 106.2,
        },
      );

      final payload = jsonDecode(encoded) as Map<String, dynamic>;

      expect(payload['message'], '');
      expect(payload['display_message'], 'Chọn phòng khám');
      expect(payload['ui_action'], isA<Map<String, dynamic>>());
      expect(payload['ui_action']['clinic_id'], 'clinic-1');
      expect(payload['location']['lat'], 10.1);
      expect(payload['location']['lng'], 106.2);
    });
  });
}

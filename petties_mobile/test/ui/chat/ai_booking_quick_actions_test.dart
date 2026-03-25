import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_quick_actions.dart';

void main() {
  group('buildBookingSummaryQuickActions', () {
    test('tạo ui_action có cấu trúc thay vì text preset dài', () {
      const summary = AiBookingSummaryPayload(
        petId: 'pet-1',
        petName: 'Hadine',
        clinicId: 'clinic-1',
        clinicName: 'Pet Care Đà Nẵng',
        bookingDate: '2026-03-21',
        startTime: '09:00',
        bookingType: 'AT_CLINIC',
        serviceIds: <String>['svc-1'],
        serviceNames: <String>['Khám bệnh'],
      );

      final actions = buildBookingSummaryQuickActions(summary);
      final changeTime =
          actions.firstWhere((action) => action.key == 'change_time');

      expect(
          actions.map((action) => action.key),
          containsAll(<String>[
            'change_pet',
            'change_clinic',
            'change_service',
            'change_date',
            'change_time',
          ]));
      expect(changeTime.userMessage, 'Đổi giờ khám');
      expect(changeTime.uiAction['type'], 'change_time');
      expect(changeTime.uiAction['clinic_id'], 'clinic-1');
      expect(changeTime.uiAction['booking_date'], '2026-03-21');
      expect(changeTime.uiAction['service_ids'], <String>['svc-1']);
    });

    test('chỉ tạo action phù hợp với dữ liệu hiện có', () {
      const summary = AiBookingSummaryPayload(
        bookingDate: '2026-03-21',
      );

      final actions = buildBookingSummaryQuickActions(summary);

      expect(actions.map((action) => action.key), <String>[
        'change_date',
        'change_time',
      ]);
    });
  });
}

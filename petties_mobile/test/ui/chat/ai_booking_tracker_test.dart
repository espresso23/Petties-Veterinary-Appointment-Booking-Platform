import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_tracker.dart';

void main() {
  group('AiBookingTrackerSnapshot', () {
    test('mergeAction stores grouped multi-select services', () {
      final tracker = AiBookingTrackerSnapshot.empty.mergeAction(
        action: UiAction(
          type: 'select_services',
          label: 'Tiếp tục',
          payload: const {
            'clinic_id': 'clinic-1',
          },
        ),
        selectedServiceIds: const ['svc-1', 'svc-2'],
        selectedServiceNames: const ['Khám tổng quát', 'Tiêm phòng'],
      );

      expect(tracker.clinicId, 'clinic-1');
      expect(tracker.serviceIds, ['svc-1', 'svc-2']);
      expect(tracker.serviceNames, ['Khám tổng quát', 'Tiêm phòng']);
    });

    test('mergeUiSchema absorbs booking summary and slot context', () {
      final tracker = AiBookingTrackerSnapshot.empty.mergeUiSchema(
        UiSchemaV1(
          version: '1.0',
          layout: 'list',
          components: [
            UiComponentV1(
              type: 'slot_button',
              id: 'slot_0900',
              data: const {
                'clinic_id': 'clinic-1',
                'booking_date': '2026-03-27',
                'service_ids': ['svc-1'],
                'service_names': ['Khám tổng quát'],
              },
              actions: const [],
            ),
            UiComponentV1(
              type: 'booking_summary',
              id: 'summary_1',
              data: const {
                'clinic_id': 'clinic-1',
                'clinic_name': 'PetCare',
                'pet_id': 'pet-1',
                'pet_name': 'Hadine',
                'booking_date': '2026-03-27',
                'start_time': '09:00',
                'booking_type': 'AT_CLINIC',
                'service_ids': ['svc-1'],
                'service_names': ['Khám tổng quát'],
              },
              actions: const [],
            ),
          ],
        ),
      );

      expect(tracker.clinicId, 'clinic-1');
      expect(tracker.clinicName, 'PetCare');
      expect(tracker.petId, 'pet-1');
      expect(tracker.petName, 'Hadine');
      expect(tracker.bookingDate, '2026-03-27');
      expect(tracker.startTime, '09:00');
      expect(tracker.bookingType, 'AT_CLINIC');
      expect(tracker.serviceIds, ['svc-1']);
      expect(tracker.serviceNames, ['Khám tổng quát']);
    });

    test('toJson/fromJson preserves reconnect state payload', () {
      const tracker = AiBookingTrackerSnapshot(
        petId: 'pet-1',
        petName: 'Hadine',
        clinicId: 'clinic-1',
        clinicName: 'PetCare',
        bookingDate: '2026-03-27',
        startTime: '09:00',
        serviceIds: ['svc-1', 'svc-2'],
        serviceNames: ['Khám tổng quát', 'Tiêm phòng'],
        bookingType: 'HOME_VISIT',
      );

      final restored = AiBookingTrackerSnapshot.fromJson(tracker.toJson());

      expect(restored.petId, tracker.petId);
      expect(restored.petName, tracker.petName);
      expect(restored.clinicId, tracker.clinicId);
      expect(restored.clinicName, tracker.clinicName);
      expect(restored.bookingDate, tracker.bookingDate);
      expect(restored.startTime, tracker.startTime);
      expect(restored.serviceIds, tracker.serviceIds);
      expect(restored.serviceNames, tracker.serviceNames);
      expect(restored.bookingType, tracker.bookingType);
    });
  });
}

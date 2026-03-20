import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_confirmation.dart';

void main() {
  group('extractBookingConfirmationDraft', () {
    test('trích xuất draft từ react trace và nội dung assistant', () {
      final draft = extractBookingConfirmationDraft(
        content:
            'Mình đã tìm được lịch phù hợp. Bạn có muốn tôi đặt lịch cho Bella tại Phòng khám Petties Q1 vào 2026-03-15 lúc 09:00 không?',
        reactTrace: [
          {
            'tool_name': 'search_clinics_nearby',
            'tool_result': {
              'clinics': [
                {'id': 'clinic-1', 'name': 'Phòng khám Petties Q1'}
              ]
            }
          },
          {
            'tool_name': 'check_available_slots',
            'tool_params': {
              'clinic_id': 'clinic-1',
              'date': '2026-03-15',
              'service_ids': ['svc-1']
            },
            'tool_result': {
              'services': ['Tiêm phòng 7 bệnh']
            }
          }
        ],
      );

      expect(draft, isNotNull);
      expect(draft!.clinicId, 'clinic-1');
      expect(draft.clinicName, 'Phòng khám Petties Q1');
      expect(draft.bookingDate, '2026-03-15');
      expect(draft.startTime, '09:00');
      expect(draft.services, ['Tiêm phòng 7 bệnh']);
    });

    test('không tạo draft khi assistant chưa yêu cầu xác nhận', () {
      final draft = extractBookingConfirmationDraft(
        content: 'Phòng khám này còn nhiều slot trống vào cuối tuần.',
        reactTrace: const [],
      );

      expect(draft, isNull);
    });
  });
}

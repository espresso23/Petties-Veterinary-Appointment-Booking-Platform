import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';

void main() {
  group('AiChat models', () {
    test('parse history socket event', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'history',
        'messages': [
          {
            'message_id': 'm-1',
            'role': 'assistant',
            'content': 'Xin chào',
            'timestamp': '2026-03-09T10:00:00',
          }
        ],
      });

      expect(event.type, AiChatSocketEventType.history);
      expect(event.messages, hasLength(1));
      expect(event.messages.first.content, 'Xin chào');
    });

    test('parse complete socket event with trace', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'complete',
        'full_response': 'Đây là câu trả lời hoàn chỉnh',
        'react_trace': [
          {'step_type': 'thought', 'content': 'Kiểm tra dữ liệu'}
        ],
      });

      expect(event.type, AiChatSocketEventType.complete);
      expect(event.fullResponse, 'Đây là câu trả lời hoàn chỉnh');
      expect(event.reactTrace, isNotNull);
      expect(event.reactTrace, hasLength(1));
    });

    test('parse thinking socket event with realtime react step', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'thinking',
        'step_index': 1,
        'content': 'Tôi đang phân tích yêu cầu',
        'tool_name': 'search_clinics_nearby',
        'tool_params': {'radius_km': 5},
        'react_step': {
          'step_type': 'thought',
          'content': 'Tôi đang phân tích yêu cầu',
          'tool_name': 'search_clinics_nearby',
          'tool_params': {'radius_km': 5},
        },
      });

      expect(event.type, AiChatSocketEventType.thinking);
      expect(event.stepIndex, 1);
      expect(event.reactStep, isNotNull);
      expect(event.reactStep!['step_type'], 'thought');
      expect(event.toolParams?['radius_km'], 5);
    });

    test('parse thinking_stream socket event for live reasoning updates', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'thinking_stream',
        'content': 'Trợ lý đang tổng hợp phản hồi',
        'step_index': 2,
      });

      expect(event.type, AiChatSocketEventType.thinkingStream);
      expect(event.content, 'Trợ lý đang tổng hợp phản hồi');
      expect(event.stepIndex, 2);
    });

    test(
        'parse ui_schema socket event with select_services and native confirm actions',
        () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'ui_schema',
        'ui_schema': {
          'version': '1.0',
          'layout': 'list',
          'components': [
            {
              'type': 'service_chip',
              'id': 'svc_1',
              'data': {
                'id': 'svc-1',
                'name': 'Khám tổng quát cho chó',
                'group_id': 'service_group_clinic_1',
              },
              'actions': [
                {
                  'type': 'select_item',
                  'label': 'Chọn',
                  'payload': {
                    'item_id': 'svc-1',
                    'item_type': 'service',
                    'group_id': 'service_group_clinic_1',
                  }
                }
              ]
            },
            {
              'type': 'button',
              'id': 'service_group_clinic_1_continue',
              'data': {
                'label': 'Tiếp tục',
                'group_id': 'service_group_clinic_1',
              },
              'actions': [
                {
                  'type': 'select_services',
                  'label': 'Tiếp tục',
                  'payload': {
                    'group_id': 'service_group_clinic_1',
                    'clinic_id': 'clinic-1',
                  }
                }
              ]
            },
            {
              'type': 'booking_summary',
              'id': 'booking_summary',
              'data': {
                'clinic_id': 'clinic-1',
                'pet_id': 'pet-1',
                'booking_date': '2026-03-27',
                'start_time': '09:00',
                'service_ids': ['svc-1'],
                'service_names': ['Khám tổng quát cho chó'],
              },
              'actions': [
                {
                  'type': 'open_native_confirm',
                  'label': 'Mở màn xác nhận',
                  'payload': {
                    'clinic_id': 'clinic-1',
                    'pet_id': 'pet-1',
                    'booking_date': '2026-03-27',
                    'start_time': '09:00',
                    'service_ids': ['svc-1'],
                  }
                }
              ]
            }
          ]
        }
      });

      expect(event.type, AiChatSocketEventType.uiSchema);
      expect(event.uiSchema, isNotNull);
      expect(event.uiSchema!.components, hasLength(3));
      expect(
          event.uiSchema!.components[1].actions!.first.type, 'select_services');
      expect(
        event.uiSchema!.components[2].actions!.first.type,
        'open_native_confirm',
      );
    });

    test('legacy service_chips event is parsed correctly', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'service_chips',
        'services': [
          {'id': 'svc-1', 'name': 'Khám tổng quát'}
        ],
      });

      expect(event.type, AiChatSocketEventType.serviceChips);
      expect(event.uiSchema, isNull);
    });

    test('service option prefers canonical display_name from backend', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'service_chips',
        'services': [
          {
            'id': 'svc-dog-bath',
            'name': 'Tắm',
            'display_name': 'Tắm chó',
            'canonical_name': 'Tắm chó',
          }
        ],
      });

      expect(event.type, AiChatSocketEventType.serviceChips);
      expect(event.serviceOptions, hasLength(1));
      expect(event.serviceOptions.first.id, 'svc-dog-bath');
      expect(event.serviceOptions.first.name, 'Tắm chó');
    });

    test('parse booking_state_update event with draft snapshot', () {
      final event = AiChatSocketEvent.fromJson({
        'type': 'booking_state_update',
        'booking_state': {
          'draft': {
            'clinic_id': 'clinic-1',
            'pet_id': 'pet-1',
            'booking_date': '2026-04-04',
            'service_ids': ['svc-1'],
          },
          'status': 'PRESENTING',
          'stage': 'CONFIRMING',
        },
      });

      expect(event.type, AiChatSocketEventType.bookingStateUpdate);
      expect(event.bookingState, isNotNull);
      expect(event.bookingState!['draft']['clinic_id'], 'clinic-1');
      expect(event.bookingState!['stage'], 'CONFIRMING');
    });

    test('parse booking summary payload with draft-first metadata', () {
      final summary = AiBookingSummaryPayload.fromJson({
        'clinic_id': 'clinic-1',
        'pet_id': 'pet-1',
        'booking_date': '2026-04-04',
        'service_ids': ['svc-1'],
        'missing_fields': ['start_time', 'service_ids'],
        'ready_to_create': false,
        'next_best_action': 'fill_booking_form',
      });

      expect(summary.clinicId, 'clinic-1');
      expect(summary.petId, 'pet-1');
      expect(summary.missingFields, ['start_time', 'service_ids']);
      expect(summary.readyToCreate, isFalse);
      expect(summary.nextBestAction, 'fill_booking_form');
    });
  });
}

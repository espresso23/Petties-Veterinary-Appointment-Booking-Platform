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
  });
}

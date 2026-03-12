import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/data/services/ai_chat_service.dart';

void main() {
  group('AiChatException', () {
    test('map 401 sang unauthorized', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/chat/sessions'),
        response: Response(
          requestOptions: RequestOptions(path: '/chat/sessions'),
          statusCode: 401,
          data: {'detail': 'Authentication required'},
        ),
        type: DioExceptionType.badResponse,
      );

      final mapped = AiChatException.fromDio(error);
      expect(mapped.type, AiChatErrorType.unauthorized);
    });

    test('map 404 sang sessionNotFound', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/chat/sessions/abc'),
        response: Response(
          requestOptions: RequestOptions(path: '/chat/sessions/abc'),
          statusCode: 404,
          data: {'detail': 'Không tìm thấy session'},
        ),
        type: DioExceptionType.badResponse,
      );

      final mapped = AiChatException.fromDio(error);
      expect(mapped.type, AiChatErrorType.sessionNotFound);
    });

    test('map websocket auth reason sang unauthorized', () {
      final mapped = AiChatException.fromWebSocket(
        closeCode: 1008,
        closeReason: 'CHAT_INVALID_AUTH',
      );

      expect(mapped.type, AiChatErrorType.unauthorized);
    });

    test('map websocket session forbidden sang forbidden', () {
      final mapped = AiChatException.fromWebSocket(
        closeCode: 1008,
        closeReason: 'CHAT_SESSION_FORBIDDEN',
      );

      expect(mapped.type, AiChatErrorType.forbidden);
    });
  });

  group('AiChatSession', () {
    test('parse create session payload without messages', () {
      final session = AiChatSession(
        sessionId: 'session-1',
        title: 'Trợ lý AI',
        contextType: 'BUSINESS_CHAT',
        createdAt: DateTime.tryParse('2026-03-10T10:00:00Z'),
        messages: const [],
      );

      expect(session.sessionId, 'session-1');
      expect(session.messages, isEmpty);
      expect(session.contextType, 'BUSINESS_CHAT');
    });

    test('format session list and delete 404 thành sessionNotFound', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/chat/sessions/session-x'),
        response: Response(
          requestOptions: RequestOptions(path: '/chat/sessions/session-x'),
          statusCode: 404,
          data: {'detail': 'Không tìm thấy session'},
        ),
        type: DioExceptionType.badResponse,
      );

      final mapped = AiChatException.fromDio(error);
      expect(mapped.type, AiChatErrorType.sessionNotFound);
    });
  });
}

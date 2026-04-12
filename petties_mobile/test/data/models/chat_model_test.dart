import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/chat.dart';

/// Unit tests cho Chat models: ActionButton, ChatMessage (actionButtons, fromJson, toJson)
void main() {
  group('ActionButton', () {
    test('fromJson với camelCase', () {
      final json = {
        'id': 'btn-1',
        'label': 'Đặt lịch khám',
        'type': 'BOOKING',
      };
      final btn = ActionButton.fromJson(json);
      expect(btn.id, 'btn-1');
      expect(btn.label, 'Đặt lịch khám');
      expect(btn.type, 'BOOKING');
    });

    test('fromJson với snake_case', () {
      final json = {
        'id': 'btn-2',
        'label': 'Xem menu',
        'type': 'MENU',
      };
      final btn = ActionButton.fromJson(json);
      expect(btn.id, 'btn-2');
      expect(btn.label, 'Xem menu');
      expect(btn.type, 'MENU');
    });

    test('fromJson thiếu field dùng default', () {
      final btn = ActionButton.fromJson({'id': 'x'});
      expect(btn.id, 'x');
      expect(btn.label, '');
      expect(btn.type, 'CUSTOM');
    });

    test('toJson round-trip', () {
      final btn = ActionButton(id: 'btn-1', label: 'Test', type: 'BOOKING');
      final json = btn.toJson();
      expect(json['id'], 'btn-1');
      expect(json['label'], 'Test');
      expect(json['type'], 'BOOKING');
      final restored = ActionButton.fromJson(json);
      expect(restored.id, btn.id);
      expect(restored.label, btn.label);
      expect(restored.type, btn.type);
    });
  });

  group('ChatMessage - actionButtons', () {
    test('fromJson với actionButtons camelCase', () {
      final json = {
        'id': 'msg-1',
        'conversationId': 'conv-1',
        'senderId': 'clinic-1',
        'senderType': 'CLINIC',
        'content': 'Xin chào!',
        'createdAt': '2024-01-15T10:00:00Z',
        'actionButtons': [
          {'id': 'b1', 'label': 'Đặt lịch', 'type': 'BOOKING'},
          {'id': 'b2', 'label': 'Xem menu', 'type': 'MENU'},
        ],
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.actionButtons, isNotNull);
      expect(msg.actionButtons!.length, 2);
      expect(msg.actionButtons![0].id, 'b1');
      expect(msg.actionButtons![0].label, 'Đặt lịch');
      expect(msg.actionButtons![0].type, 'BOOKING');
      expect(msg.actionButtons![1].label, 'Xem menu');
    });

    test('fromJson với action_buttons snake_case', () {
      final json = {
        'id': 'msg-2',
        'chat_box_id': 'conv-2',
        'sender_id': 'clinic-1',
        'sender_type': 'CLINIC',
        'content': 'Xin chào!',
        'created_at': '2024-01-15T10:00:00Z',
        'action_buttons': [
          {'id': 'b1', 'label': 'Ưu đãi', 'type': 'OFFER'},
        ],
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.actionButtons, isNotNull);
      expect(msg.actionButtons!.length, 1);
      expect(msg.actionButtons![0].type, 'OFFER');
    });

    test('fromJson không có actionButtons trả về null', () {
      final json = {
        'id': 'msg-3',
        'conversationId': 'conv-1',
        'senderId': 'clinic-1',
        'senderType': 'CLINIC',
        'content': 'Xin chào!',
        'createdAt': '2024-01-15T10:00:00Z',
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.actionButtons, isNull);
    });

    test('fromJson actionButtons rỗng trả về null', () {
      final json = {
        'id': 'msg-4',
        'conversationId': 'conv-1',
        'senderId': 'clinic-1',
        'senderType': 'CLINIC',
        'content': 'Xin chào!',
        'createdAt': '2024-01-15T10:00:00Z',
        'actionButtons': [],
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.actionButtons, isNull);
    });

    test('fromJson actionButtons có phần tử không hợp lệ bỏ qua', () {
      final json = {
        'id': 'msg-5',
        'conversationId': 'conv-1',
        'senderId': 'clinic-1',
        'senderType': 'CLINIC',
        'content': 'Xin chào!',
        'createdAt': '2024-01-15T10:00:00Z',
        'actionButtons': [
          {'id': 'b1', 'label': 'OK', 'type': 'CUSTOM'},
          null,
          'invalid',
          {'id': 'b2', 'label': 'Xem', 'type': 'MENU'},
        ],
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.actionButtons, isNotNull);
      expect(msg.actionButtons!.length, 2);
      expect(msg.actionButtons![0].id, 'b1');
      expect(msg.actionButtons![1].id, 'b2');
    });

    test('toJson có actionButtons', () {
      final msg = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 's1',
        senderType: SenderType.clinic,
        content: 'Hi',
        createdAt: DateTime(2024, 1, 15),
        actionButtons: [
          ActionButton(id: 'b1', label: 'Đặt lịch', type: 'BOOKING'),
        ],
      );
      final json = msg.toJson();
      expect(json['actionButtons'], isNotNull);
      expect(json['actionButtons'], isA<List>());
      expect((json['actionButtons'] as List).length, 1);
      expect((json['actionButtons'] as List).first['label'], 'Đặt lịch');
    });

    test('toJson không có actionButtons không thêm key', () {
      final msg = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 's1',
        senderType: SenderType.clinic,
        content: 'Hi',
        createdAt: DateTime(2024, 1, 15),
      );
      final json = msg.toJson();
      expect(json.containsKey('actionButtons'), false);
    });
  });

  group('ChatMessage - isMine', () {
    test('senderType PET_OWNER thì isMine = true', () {
      final msg = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'po1',
        senderType: SenderType.petOwner,
        content: 'Hi',
        createdAt: DateTime.now(),
      );
      expect(msg.isMine, true);
    });

    test('senderType CLINIC thì isMine = false', () {
      final msg = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'clinic1',
        senderType: SenderType.clinic,
        content: 'Hi',
        createdAt: DateTime.now(),
      );
      expect(msg.isMine, false);
    });
  });

  group('ChatMessage - copyWith', () {
    test('copyWith actionButtons', () {
      final msg = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 's1',
        senderType: SenderType.clinic,
        content: 'Hi',
        createdAt: DateTime(2024, 1, 15),
        actionButtons: [
          ActionButton(id: 'b1', label: 'A', type: 'CUSTOM'),
        ],
      );
      final updated = msg.copyWith(
        actionButtons: [
          ActionButton(id: 'b2', label: 'B', type: 'BOOKING'),
        ],
      );
      expect(updated.actionButtons!.length, 1);
      expect(updated.actionButtons![0].label, 'B');
    });
  });

  group('ChatMessage - _parseUtcDate edge cases', () {
    test('createdAt null dùng DateTime.now()', () {
      final json = {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 's1',
        'senderType': 'CLINIC',
        'content': 'Hi',
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.createdAt, isNotNull);
      expect(msg.createdAt.difference(DateTime.now()).inSeconds, lessThan(2));
    });

    test('readAt null khi không có', () {
      final json = {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 's1',
        'senderType': 'CLINIC',
        'content': 'Hi',
        'createdAt': '2024-01-15T10:00:00Z',
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.readAt, isNull);
    });

    test('createdAt parse ISO với Z', () {
      final json = {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 's1',
        'senderType': 'CLINIC',
        'content': 'Hi',
        'createdAt': '2024-01-15T10:00:00Z',
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.createdAt.year, 2024);
      expect(msg.createdAt.month, 1);
      expect(msg.createdAt.day, 15);
    });
  });
}

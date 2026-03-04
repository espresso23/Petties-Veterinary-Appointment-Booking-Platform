import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/chat.dart';
import 'package:petties_mobile/ui/chat/widgets/message_bubble.dart';

/// Widget tests cho MessageBubble - action buttons
void main() {
  Widget buildTestWidget({
    required ChatMessage message,
    void Function(ChatMessage message, ActionButton button)? onActionButtonTap,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: MessageBubble(
          message: message,
          showAvatar: true,
          onActionButtonTap: onActionButtonTap,
        ),
      ),
    );
  }

  group('MessageBubble - Action Buttons', () {
    testWidgets('hiển thị action buttons khi tin từ clinic và có actionButtons',
        (WidgetTester tester) async {
      final message = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'clinic-1',
        senderType: SenderType.clinic,
        content: 'Xin chào! Chúng tôi có thể hỗ trợ gì?',
        createdAt: DateTime.now(),
        actionButtons: [
          ActionButton(id: 'b1', label: 'Đặt lịch khám', type: 'BOOKING'),
          ActionButton(id: 'b2', label: 'Xem menu', type: 'MENU'),
        ],
      );

      await tester.pumpWidget(buildTestWidget(message: message));
      await tester.pumpAndSettle();

      expect(find.text('Đặt lịch khám'), findsOneWidget);
      expect(find.text('Xem menu'), findsOneWidget);
    });

    testWidgets('KHÔNG hiển thị action buttons khi tin từ Pet Owner',
        (WidgetTester tester) async {
      final message = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'po-1',
        senderType: SenderType.petOwner,
        content: 'Tôi muốn đặt lịch',
        createdAt: DateTime.now(),
        actionButtons: [
          ActionButton(id: 'b1', label: 'Đặt lịch', type: 'BOOKING'),
        ],
      );

      await tester.pumpWidget(buildTestWidget(message: message));
      await tester.pumpAndSettle();

      expect(find.text('Đặt lịch'), findsNothing);
    });

    testWidgets('KHÔNG hiển thị action buttons khi actionButtons null',
        (WidgetTester tester) async {
      final message = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'clinic-1',
        senderType: SenderType.clinic,
        content: 'Xin chào!',
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(buildTestWidget(message: message));
      await tester.pumpAndSettle();

      // Không có nút action button nào (label "Đặt lịch khám" không xuất hiện)
      expect(find.text('Đặt lịch khám'), findsNothing);
      expect(find.text('Xem menu'), findsNothing);
    });

    testWidgets('tap action button gọi onActionButtonTap',
        (WidgetTester tester) async {
      ChatMessage? capturedMessage;
      ActionButton? capturedButton;

      final message = ChatMessage(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'clinic-1',
        senderType: SenderType.clinic,
        content: 'Xin chào!',
        createdAt: DateTime.now(),
        actionButtons: [
          ActionButton(id: 'b1', label: 'Đặt lịch khám', type: 'BOOKING'),
        ],
      );

      await tester.pumpWidget(buildTestWidget(
        message: message,
        onActionButtonTap: (msg, btn) {
          capturedMessage = msg;
          capturedButton = btn;
        },
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Đặt lịch khám'));
      await tester.pumpAndSettle();

      expect(capturedMessage, isNotNull);
      expect(capturedMessage!.id, 'm1');
      expect(capturedButton, isNotNull);
      expect(capturedButton!.id, 'b1');
      expect(capturedButton!.type, 'BOOKING');
    });
  });
}

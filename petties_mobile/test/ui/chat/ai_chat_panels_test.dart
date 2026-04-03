import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_tracker.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_chat_panels.dart';

void main() {
  group('AiChatComposer', () {
    testWidgets('khong bi overflow khi nhap prompt dai', (tester) async {
      final controller = TextEditingController(
        text:
            'Tôi muốn đặt lịch khám tổng quát cho bé Mimi tại phòng khám Pet Care Đà Nẵng vào sáng mai. '
            'Nếu không còn chỗ thì gợi ý giúp tôi khung giờ gần nhất trong ngày và cho tôi biết cần chuẩn bị gì trước khi đưa bé đi khám.',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: AiChatComposer(
                horizontalPadding: 12,
                tracker: const AiBookingTrackerSnapshot(
                  petName: 'Mimi',
                  clinicName: 'Pet Care Đà Nẵng',
                ),
                suggestions: const <String>[
                  'Đặt lịch khám tổng quát cho bé Mimi vào sáng mai',
                  'Giữ Pet Care Đà Nẵng nhưng đổi sang chiều mai',
                ],
                errorText: null,
                controller: controller,
                onSuggestionTap: (_) {},
                onSend: () {},
                isSending: false,
                isReconnecting: false,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsOneWidget);
      expect(tester.takeException(), isNull);

      controller.dispose();
    });
  });
}

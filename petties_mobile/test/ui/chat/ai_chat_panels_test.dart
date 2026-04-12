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
      expect(find.byIcon(Icons.tune), findsOneWidget);
      expect(find.byIcon(Icons.arrow_upward_rounded), findsOneWidget);
      expect(tester.takeException(), isNull);

      controller.dispose();
    });

    testWidgets('co the bam nut tuy chon trong composer', (tester) async {
      final controller = TextEditingController();
      var settingsTapped = false;

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
                ],
                errorText: null,
                controller: controller,
                onSuggestionTap: (_) {},
                onSend: () {},
                isSending: false,
                isReconnecting: false,
                onSettingsTap: () => settingsTapped = true,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.tune));
      await tester.pumpAndSettle();
      expect(settingsTapped, isTrue);

      controller.dispose();
    });

    testWidgets('khong gui khi chua co noi dung', (tester) async {
      final controller = TextEditingController();
      var sent = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: AiChatComposer(
                horizontalPadding: 12,
                tracker: const AiBookingTrackerSnapshot(),
                suggestions: const <String>[],
                errorText: null,
                controller: controller,
                onSuggestionTap: (_) {},
                onSend: () => sent = true,
                isSending: false,
                isReconnecting: false,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
      await tester.pumpAndSettle();
      expect(sent, isFalse);

      controller.dispose();
    });

    testWidgets('gui duoc khi da co noi dung', (tester) async {
      final controller = TextEditingController(text: 'Xin chào trợ lý AI');
      var sent = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: AiChatComposer(
                horizontalPadding: 12,
                tracker: const AiBookingTrackerSnapshot(),
                suggestions: const <String>[],
                errorText: null,
                controller: controller,
                onSuggestionTap: (_) {},
                onSend: () => sent = true,
                isSending: false,
                isReconnecting: false,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
      await tester.pumpAndSettle();
      expect(sent, isTrue);

      controller.dispose();
    });

    testWidgets('khong overflow tren man hinh nho 320dp', (tester) async {
      final controller = TextEditingController(
        text:
            'Đây là nội dung dài để kiểm tra composer responsive trên màn hình nhỏ.',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(size: Size(320, 640)),
            child: Scaffold(
              body: Align(
                alignment: Alignment.bottomCenter,
                child: AiChatComposer(
                  horizontalPadding: 10,
                  tracker: const AiBookingTrackerSnapshot(),
                  suggestions: const <String>[
                    'Gợi ý 1',
                    'Gợi ý 2',
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
        ),
      );

      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byIcon(Icons.tune), findsOneWidget);
      expect(tester.takeException(), isNull);
      controller.dispose();
    });
  });
}

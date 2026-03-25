import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_cards.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_quick_actions.dart';

void main() {
  group('AiStructuredBookingSummaryCard', () {
    testWidgets('bat nut xac nhan khi summary confirmable', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiStructuredBookingSummaryCard(
              summary: const AiBookingSummaryPayload(
                petName: 'Bella',
                clinicName: 'Petties Q1',
                bookingDate: '2026-03-21',
                startTime: '09:00',
                serviceNames: ['Tiem phong'],
                isConfirmable: true,
              ),
              isConfirmed: false,
              isBusy: false,
              quickActions: const <AiBookingQuickAction>[],
              formatBookingDate: _echoBookingDate,
              onQuickAction: (_) {},
              onConfirm: () {
                tapped = true;
              },
            ),
          ),
        ),
      );

      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();

      expect(tapped, isTrue);
    });

    testWidgets('tat nut xac nhan va hien missing fields khi summary chua du',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiStructuredBookingSummaryCard(
              summary: const AiBookingSummaryPayload(
                clinicName: 'Petties Q1',
                bookingDate: '2026-03-21',
                isConfirmable: false,
                missingFields: ['gio kham', 'dich vu'],
              ),
              isConfirmed: false,
              isBusy: false,
              quickActions: const <AiBookingQuickAction>[],
              formatBookingDate: _echoBookingDate,
              onQuickAction: (_) {},
              onConfirm: () {},
            ),
          ),
        ),
      );

      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));

      expect(button.onPressed, isNull);
      expect(find.textContaining('gio kham'), findsOneWidget);
      expect(find.textContaining('dich vu'), findsOneWidget);
    });
  });
}

String _echoBookingDate(String? value) => value ?? '';

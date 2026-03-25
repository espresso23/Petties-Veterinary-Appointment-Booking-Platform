import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_cards.dart';

void main() {
  group('AiBookingCreatedCard', () {
    testWidgets('hiển thị nút xem lịch hẹn khi có callback', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiBookingCreatedCard(
              bookingCreated: const AiBookingCreatedPayload(
                bookingId: 'booking-1',
                bookingCode: 'BK001',
                petName: 'Hadine',
                clinicName: 'Pet Care',
                date: '2026-03-21',
                time: '09:00',
              ),
              formatBookingDate: (value) => value ?? '',
              onViewBooking: () {
                tapped = true;
              },
            ),
          ),
        ),
      );

      expect(find.text('Xem lịch hẹn của tôi'), findsOneWidget);

      await tester.tap(find.text('Xem lịch hẹn của tôi'));
      await tester.pump();

      expect(tapped, isTrue);
    });

    testWidgets('ẩn nút xem lịch hẹn khi không có callback', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiBookingCreatedCard(
              bookingCreated: const AiBookingCreatedPayload(
                bookingCode: 'BK001',
              ),
              formatBookingDate: _echoBookingDate,
            ),
          ),
        ),
      );

      expect(find.text('Xem lịch hẹn của tôi'), findsNothing);
    });
  });
}

String _echoBookingDate(String? value) => value ?? '';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_cards.dart';

void main() {
  group('AiStructuredBookingSummaryCard', () {
    Future<void> pumpCard(
      WidgetTester tester,
      AiBookingSummaryPayload summary,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiStructuredBookingSummaryCard(
              summary: summary,
              isConfirmed: false,
              isBusy: false,
              quickActions: const [],
              formatBookingDate: (value) => value ?? '',
              onQuickAction: (_) {},
              onConfirm: () {},
            ),
          ),
        ),
      );
    }

    testWidgets(
      'hiển thị CTA mở form khi draft còn thiếu trường',
      (tester) async {
        final summary = AiBookingSummaryPayload(
          clinicId: 'clinic-1',
          clinicName: 'Petties Clinic',
          petId: 'pet-1',
          bookingDate: '2026-04-04',
          serviceNames: const ['Khám tổng quát'],
          missingFields: const ['start_time', 'service_ids'],
          nextBestAction: 'fill_booking_form',
          readyToCreate: false,
        );

        await pumpCard(tester, summary);

        expect(find.text('Còn thiếu thông tin'), findsOneWidget);
        expect(find.text('Giờ khám'), findsOneWidget);
        expect(find.text('Dịch vụ'), findsWidgets);
        expect(find.text('MỞ FORM ĐẶT LỊCH'), findsOneWidget);
      },
    );

    testWidgets(
      'hiển thị CTA mở màn xác nhận khi dữ liệu đã đủ',
      (tester) async {
        final summary = AiBookingSummaryPayload(
          clinicId: 'clinic-1',
          clinicName: 'Petties Clinic',
          petId: 'pet-1',
          bookingDate: '2026-04-04',
          startTime: '09:00',
          serviceIds: const ['svc-1'],
          serviceNames: const ['Khám tổng quát'],
          nextBestAction: 'confirm_booking',
          readyToCreate: true,
        );

        await pumpCard(tester, summary);

        expect(find.text('Còn thiếu thông tin'), findsNothing);
        expect(find.text('MỞ MÀN XÁC NHẬN'), findsOneWidget);
      },
    );
  });
}

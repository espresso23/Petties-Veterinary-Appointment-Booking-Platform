import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_cards.dart';

void main() {
  group('AiStructuredBookingSummaryCard', () {
    Future<void> pumpCard(
      WidgetTester tester,
      AiBookingSummaryPayload summary, {
      List<AiClinic> clinicOptions = const <AiClinic>[],
      List<AiBookingServiceOption> serviceOptions =
          const <AiBookingServiceOption>[],
      List<String> bookingDateOptions = const <String>[],
      List<String> startTimeOptions = const <String>[],
      ValueChanged<AiBookingSummaryPayload>? onRequestSlotRefresh,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: AiStructuredBookingSummaryCard(
                summary: summary,
                isConfirmed: false,
                isBusy: false,
                clinicOptions: clinicOptions,
                serviceOptions: serviceOptions,
                bookingDateOptions: bookingDateOptions,
                startTimeOptions: startTimeOptions,
                formatBookingDate: (value) => value ?? '',
                onRequestSlotRefresh: onRequestSlotRefresh,
                onConfirm: (_) {},
              ),
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

        expect(find.text('Phòng khám'), findsOneWidget);
        expect(find.text('Petties Clinic'), findsOneWidget);
        expect(find.text('Ngày khám'), findsOneWidget);
        expect(find.text('XÁC NHẬN ĐẶT LỊCH'), findsOneWidget);
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

        expect(find.text('XÁC NHẬN ĐẶT LỊCH'), findsOneWidget);
      },
    );

    testWidgets(
      'cho phép tải lại khung giờ rảnh từ form',
      (tester) async {
        var refreshCalled = false;
        AiBookingSummaryPayload? latestRefreshPayload;

        final summary = AiBookingSummaryPayload(
          clinicId: 'clinic-1',
          clinicName: 'Petties Clinic',
          petId: 'pet-1',
          bookingDate: '2026-04-04',
          serviceIds: const ['svc-1'],
          serviceNames: const ['Khám tổng quát'],
          readyToCreate: false,
        );

        await pumpCard(
          tester,
          summary,
          clinicOptions: const [
            AiClinic(id: 'clinic-1', name: 'Petties Clinic', address: 'Q1'),
          ],
          serviceOptions: const [
            AiBookingServiceOption(
              id: 'svc-1',
              name: 'Khám tổng quát',
              clinicId: 'clinic-1',
            ),
          ],
          bookingDateOptions: const ['2026-04-04'],
          startTimeOptions: const ['09:00'],
          onRequestSlotRefresh: (payload) {
            refreshCalled = true;
            latestRefreshPayload = payload;
          },
        );

        expect(find.text('Xem thêm lựa chọn'), findsOneWidget);
        await tester.tap(find.text('Xem thêm lựa chọn'));
        await tester.pumpAndSettle();

        expect(refreshCalled, isTrue);
        expect(latestRefreshPayload?.bookingDate, '2026-04-04');
        expect(latestRefreshPayload?.clinicId, 'clinic-1');
      },
    );
  });
}

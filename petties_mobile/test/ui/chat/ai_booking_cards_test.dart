import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/utils/ai_booking_cards.dart';

void main() {
  group('AiStructuredBookingSummaryCard', () {
    testWidgets('cho phep sua field va xac nhan 1 buoc', (tester) async {
      AiBookingSummaryPayload? confirmedPayload;

      final summary = AiBookingSummaryPayload(
        petId: 'pet-1',
        petName: 'Mimi',
        clinicId: 'clinic-1',
        clinicName: 'Pet Care',
        bookingDate: '2026-04-12',
        startTime: '09:00',
        serviceIds: const ['svc-1'],
        serviceNames: const ['Khám tổng quát'],
        bookingType: bookingTypeInClinic,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: AiStructuredBookingSummaryCard(
                  summary: summary,
                  isConfirmed: false,
                  isBusy: false,
                  clinicOptions: const [
                    AiClinic(id: 'clinic-1', name: 'Pet Care', address: 'Da Nang'),
                  ],
                  serviceOptions: const [
                    AiBookingServiceOption(id: 'svc-1', name: 'Khám tổng quát'),
                  ],
                  bookingDateOptions: const ['2026-04-12'],
                  startTimeOptions: const ['09:00'],
                  formatBookingDate: (value) => value ?? '',
                  onConfirm: (payload) => confirmedPayload = payload,
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('XÁC NHẬN ĐẶT LỊCH'));
      await tester.tap(find.text('XÁC NHẬN ĐẶT LỊCH'));
      await tester.pumpAndSettle();

      expect(confirmedPayload, isNotNull);
      expect(confirmedPayload!.petId, 'pet-1');
      expect(confirmedPayload!.clinicId, 'clinic-1');
      expect(confirmedPayload!.serviceIds, contains('svc-1'));
      expect(confirmedPayload!.startTime, '09:00');
    });

    testWidgets(
      'form dich vu gop ban prompt va database, xac nhan gui dung service id',
      (tester) async {
        AiBookingSummaryPayload? confirmedPayload;

        final summary = AiBookingSummaryPayload(
          petId: 'pet-1',
          petName: 'Mimi',
          clinicId: 'clinic-1',
          clinicName: 'Pet Care',
          bookingDate: '2026-04-12',
          startTime: '09:00',
          serviceIds: const ['tắm chó'],
          serviceNames: const ['tắm chó'],
          bookingType: bookingTypeInClinic,
        );

        const uuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: AiStructuredBookingSummaryCard(
                    summary: summary,
                    isConfirmed: false,
                    isBusy: false,
                    clinicOptions: const [
                      AiClinic(
                        id: 'clinic-1',
                        name: 'Pet Care',
                        address: 'Da Nang',
                      ),
                    ],
                    serviceOptions: const [
                      AiBookingServiceOption(
                        id: 'tắm chó',
                        name: 'tắm chó',
                        clinicId: 'clinic-1',
                      ),
                      AiBookingServiceOption(
                        id: uuid,
                        name: 'Tắm chó',
                        clinicId: 'clinic-1',
                        basePrice: 100000,
                      ),
                    ],
                    bookingDateOptions: const ['2026-04-12'],
                    startTimeOptions: const ['09:00'],
                    formatBookingDate: (value) => value ?? '',
                    onConfirm: (payload) => confirmedPayload = payload,
                  ),
                ),
              ),
            ),
          ),
        );

        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('XÁC NHẬN ĐẶT LỊCH'));
        await tester.tap(find.text('XÁC NHẬN ĐẶT LỊCH'));
        await tester.pumpAndSettle();

        expect(confirmedPayload, isNotNull);
        expect(confirmedPayload!.serviceIds, const [uuid]);
        expect(confirmedPayload!.serviceNames, const ['Tắm chó']);
      },
    );
  });
}

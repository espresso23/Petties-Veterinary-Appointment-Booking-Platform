import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:petties_mobile/data/models/booking.dart';
import 'package:petties_mobile/ui/booking/booking_detail_screen.dart';

void main() {
  BookingResponse buildBooking({
    required String status,
    String? notes,
    String? paymentMethod,
    String? paymentStatus,
    bool? canShowQrPaymentButton,
  }) {
    return BookingResponse(
      bookingId: 'test-booking-id',
      bookingCode: 'BK-001',
      clinicId: 'clinic-1',
      clinicName: 'Phòng khám A',
      petName: 'Milu',
      bookingDate: '2026-03-12',
      bookingTime: '09:00:00',
      status: status,
      type: 'REGULAR',
      notes: notes,
      totalPrice: 120000,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      canShowQrPaymentButton: canShowQrPaymentButton,
    );
  }

  testWidgets(
    'Hiển thị nút THANH TOÁN QR khi backend bật cờ hiển thị',
    (tester) async {
      final booking = buildBooking(
        status: 'IN_PROGRESS',
        paymentMethod: 'QR',
        paymentStatus: 'PENDING',
        canShowQrPaymentButton: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentDetailScreen(booking: booking),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('THANH TOÁN QR'), findsOneWidget);
    },
  );

  testWidgets(
    'Không hiển thị nút THANH TOÁN QR khi IN_PROGRESS nhưng payment đã PAID',
    (tester) async {
      final booking = buildBooking(
        status: 'IN_PROGRESS',
        paymentMethod: 'QR',
        paymentStatus: 'PAID',
        canShowQrPaymentButton: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentDetailScreen(booking: booking),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('THANH TOÁN QR'), findsNothing);
    },
  );
}

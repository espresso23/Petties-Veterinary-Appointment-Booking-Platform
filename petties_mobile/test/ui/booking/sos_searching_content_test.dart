import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/services/sos_matching_service.dart';
import 'package:petties_mobile/ui/booking/components/sos_searching_content.dart';

void main() {
  Widget buildTestWidget(SosMatchingStatus status) {
    return MaterialApp(
      home: Scaffold(
        body: SosSearchingContent(
          statusText: 'Đang chờ xác nhận...',
          pulseAnimation: const AlwaysStoppedAnimation(1),
          status: status,
        ),
      ),
    );
  }

  testWidgets('Hiển thị đúng tiến độ 5/5, không bị 6/5',
      (WidgetTester tester) async {
    final status = SosMatchingStatus(
      bookingId: 'booking-1',
      status: 'PENDING_CLINIC_CONFIRM',
      currentClinicIndex: 5,
      totalClinics: 5,
    );

    await tester.pumpWidget(buildTestWidget(status));

    expect(find.text('Đang liên hệ 5/5 phòng khám'), findsOneWidget);

    final progress = tester
        .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator));
    expect(progress.value, 1.0);
  });

  testWidgets('Tiến độ được clamp khi current lớn hơn total',
      (WidgetTester tester) async {
    final status = SosMatchingStatus(
      bookingId: 'booking-2',
      status: 'PENDING_CLINIC_CONFIRM',
      currentClinicIndex: 7,
      totalClinics: 5,
    );

    await tester.pumpWidget(buildTestWidget(status));

    expect(find.text('Đang liên hệ 5/5 phòng khám'), findsOneWidget);

    final progress = tester
        .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator));
    expect(progress.value, 1.0);
  });
}

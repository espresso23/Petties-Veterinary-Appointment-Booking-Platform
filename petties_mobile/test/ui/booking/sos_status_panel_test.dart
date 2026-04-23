import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/services/sos_matching_service.dart';
import 'package:petties_mobile/ui/booking/components/sos_status_panel.dart';

void main() {
  testWidgets('Trạng thái NO_CLINIC hiển thị thông báo và nút QUAY LẠI',
      (WidgetTester tester) async {
    final status = SosMatchingStatus(
      bookingId: 'booking-1',
      status: 'CANCELLED',
      event: 'NO_CLINIC',
      message: 'Không tìm thấy phòng khám phù hợp.',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SosStatusPanel(
            isConfirmed: false,
            isSearching: false,
            status: status,
            statusText: status.message!,
            pulseAnimation: const AlwaysStoppedAnimation(1),
            onCancel: () {},
            onTrack: () {},
            onCall: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Không tìm thấy phòng khám phù hợp.'), findsOneWidget);
    expect(find.text('QUAY LẠI'), findsOneWidget);
    expect(find.text('HỦY YÊU CẦU'), findsNothing);
  });
}

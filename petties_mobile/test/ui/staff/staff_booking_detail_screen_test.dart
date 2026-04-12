import 'package:flutter_test/flutter_test.dart';

/// Unit tests cho logic hiển thị các action trong màn
/// `StaffBookingDetailScreen` (thanh action bên dưới).
///
/// Thay vì test widget đầy đủ, file này mô phỏng lại
/// logic chọn nút theo:
/// - booking.status
/// - booking.type
/// - isMyBooking (booking được gán cho staff hiện tại?)
/// - hasExistingEmr (đã có bệnh án hay chưa?)

List<String> _getActionLabels({
  required String status,
  required String type,
  required bool isMyBooking,
  required bool hasExistingEmr,
  required bool hasVaccinationService,
}) {
  final actions = <String>[];

  // Logic CONFIRMED (đang chờ bắt đầu)
  if (status == 'CONFIRMED' && isMyBooking) {
    if (type == 'SOS') {
      actions.addAll([
        'BẮT ĐẦU DI CHUYỂN',
        'CHỈ ĐƯỜNG (MAPS)',
      ]);
    } else if (type == 'HOME_VISIT') {
      actions.addAll([
        'BẮT ĐẦU KHÁM',
        'CHỈ ĐƯỜNG (MAPS)',
      ]);
    } else {
      actions.add('BẮT ĐẦU KHÁM');
    }
  }
  // Logic IN_PROGRESS (đang khám/chăm sóc)
  else if (status == 'IN_PROGRESS') {
    // Nút bệnh án luôn xuất hiện
    actions.add(hasExistingEmr ? 'XEM BỆNH ÁN' : 'TẠO BỆNH ÁN');

    final canManageAddOn = type == 'HOME_VISIT' || type == 'SOS';

    // Nếu là booking của đồng nghiệp, chỉ hỗ trợ EMR và add-on nếu phù hợp
    if (!isMyBooking) {
      if (type != 'SOS' && hasVaccinationService) {
        actions.add('TIÊM VACCINE');
      }

      if (canManageAddOn) {
        actions.add(
            type == 'SOS' ? 'THÊM DỊCH VỤ' : 'THÊM DỊCH VỤ PHÁT SINH');
      }

      return actions;
    }

    // Với SOS: KHÔNG hiển thị shortcut TIÊM VACCINE
    if (type != 'SOS') {
      actions.add('TIÊM VACCINE');
    }

    // Thêm dịch vụ:
    // - HOME_VISIT: "THÊM DỊCH VỤ PHÁT SINH"
    // - SOS: "THÊM DỊCH VỤ"
    if (type == 'HOME_VISIT' || type == 'SOS') {
      actions.add(
          type == 'SOS' ? 'THÊM DỊCH VỤ' : 'THÊM DỊCH VỤ PHÁT SINH');
    }

    // Kết thúc flow theo loại booking
    if (type == 'HOME_VISIT' || type == 'SOS') {
      actions.add('Xem lại hóa đơn & thanh toán');
    } else {
      actions.add('HOÀN TẤT KHÁM');
    }
  }

  return actions;
}

void main() {
  group('StaffBookingDetailScreen - CONFIRMED actions', () {
    test('SOS + CONFIRMED + isMyBooking => hiển thị nút bắt đầu di chuyển + chỉ đường', () {
      final labels = _getActionLabels(
        status: 'CONFIRMED',
        type: 'SOS',
        isMyBooking: true,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(labels, ['BẮT ĐẦU DI CHUYỂN', 'CHỈ ĐƯỜNG (MAPS)']);
    });

    test('HOME_VISIT + CONFIRMED + isMyBooking => hiển thị bắt đầu khám + chỉ đường', () {
      final labels = _getActionLabels(
        status: 'CONFIRMED',
        type: 'HOME_VISIT',
        isMyBooking: true,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(labels, ['BẮT ĐẦU KHÁM', 'CHỈ ĐƯỜNG (MAPS)']);
    });

    test('NORMAL + CONFIRMED + isMyBooking => chỉ hiển thị BẮT ĐẦU KHÁM', () {
      final labels = _getActionLabels(
        status: 'CONFIRMED',
        type: 'NORMAL',
        isMyBooking: true,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(labels, ['BẮT ĐẦU KHÁM']);
    });

    test('CONFIRMED nhưng không phải booking của tôi => không có action nào', () {
      final labels = _getActionLabels(
        status: 'CONFIRMED',
        type: 'SOS',
        isMyBooking: false,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(labels, isEmpty);
    });
  });

  group('StaffBookingDetailScreen - IN_PROGRESS actions cho HOME_VISIT', () {
    test('HOME_VISIT + IN_PROGRESS + chưa có EMR => đầy đủ EMR + Vaccine + Add service + Checkout', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'HOME_VISIT',
        isMyBooking: true,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(
        labels,
        [
          'TẠO BỆNH ÁN',
          'TIÊM VACCINE',
          'THÊM DỊCH VỤ PHÁT SINH',
          'Xem lại hóa đơn & thanh toán',
        ],
      );
    });

    test('HOME_VISIT + IN_PROGRESS + đã có EMR => label EMR đổi sang XEM BỆNH ÁN', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'HOME_VISIT',
        isMyBooking: true,
        hasExistingEmr: true,
        hasVaccinationService: false,
      );

      expect(labels.first, 'XEM BỆNH ÁN');
    });
  });

  group('StaffBookingDetailScreen - IN_PROGRESS actions cho SOS', () {
    test('SOS + IN_PROGRESS => không hiển thị TIÊM VACCINE, vẫn có EMR + Thêm dịch vụ + Checkout', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'SOS',
        isMyBooking: true,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      // Phải có EMR + Checkout
      expect(labels.contains('TẠO BỆNH ÁN'), isTrue);
      expect(labels.contains('Xem lại hóa đơn & thanh toán'), isTrue);
      // Có nút thêm dịch vụ (không gọi là phát sinh)
      expect(labels.contains('THÊM DỊCH VỤ'), isTrue);
      // Không có TIÊM VACCINE
      expect(labels.contains('TIÊM VACCINE'), isFalse);
      // Không dùng label "THÊM DỊCH VỤ PHÁT SINH" cho SOS
      expect(labels.contains('THÊM DỊCH VỤ PHÁT SINH'), isFalse);
    });

    test('SOS + IN_PROGRESS + booking của đồng nghiệp => chỉ hỗ trợ EMR và thêm dịch vụ', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'SOS',
        isMyBooking: false,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(labels, ['TẠO BỆNH ÁN', 'THÊM DỊCH VỤ']);
    });
  });

  group('StaffBookingDetailScreen - IN_PROGRESS actions cho booking thường', () {
    test('NORMAL + IN_PROGRESS => EMR + HOÀN TẤT KHÁM, không add service/checkout HOME_VISIT/SOS', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'NORMAL',
        isMyBooking: true,
        hasExistingEmr: false,
        hasVaccinationService: false,
      );

      expect(labels.contains('TẠO BỆNH ÁN'), isTrue);
      expect(labels.contains('HOÀN TẤT KHÁM'), isTrue);
      expect(labels.contains('THÊM DỊCH VỤ PHÁT SINH'), isFalse);
      expect(labels.contains('Xem lại hóa đơn & thanh toán'), isFalse);
    });

    test('NORMAL + IN_PROGRESS + booking của đồng nghiệp => chỉ hiển thị EMR', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'NORMAL',
        isMyBooking: false,
        hasExistingEmr: true,
        hasVaccinationService: false,
      );

      expect(labels, ['XEM BỆNH ÁN']);
    });

    test('HOME_VISIT + IN_PROGRESS + booking của đồng nghiệp + có dịch vụ vắc-xin => EMR + Vaccine + Add service', () {
      final labels = _getActionLabels(
        status: 'IN_PROGRESS',
        type: 'HOME_VISIT',
        isMyBooking: false,
        hasExistingEmr: false,
        hasVaccinationService: true,
      );

      expect(
        labels,
        [
          'TẠO BỆNH ÁN',
          'TIÊM VACCINE',
          'THÊM DỊCH VỤ PHÁT SINH',
        ],
      );
    });
  });
}


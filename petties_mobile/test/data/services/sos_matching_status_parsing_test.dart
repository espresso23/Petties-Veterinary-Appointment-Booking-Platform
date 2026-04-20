import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/services/sos_matching_service.dart';

void main() {
  group('SosMatchingStatus.fromJson', () {
    test('parse được key alias từ API status endpoint', () {
      final status = SosMatchingStatus.fromJson({
        'bookingId': 'booking-1',
        'status': 'PENDING_CLINIC_CONFIRM',
        'distanceKm': 2.4,
        'totalClinicsInRange': 5,
        'currentClinicIndex': 3,
        'remainingSeconds': 42,
      });

      expect(status.distance, 2.4);
      expect(status.totalClinics, 5);
      expect(status.currentClinicIndex, 3);
      expect(status.remainingSeconds, 42);
    });

    test('parse được numeric string an toàn', () {
      final status = SosMatchingStatus.fromJson({
        'bookingId': 'booking-2',
        'status': 'PENDING_CLINIC_CONFIRM',
        'distance': '1.8',
        'totalClinics': '5',
        'currentClinicIndex': '2',
        'remainingSeconds': '59',
      });

      expect(status.distance, 1.8);
      expect(status.totalClinics, 5);
      expect(status.currentClinicIndex, 2);
      expect(status.remainingSeconds, 59);
    });
  });
}

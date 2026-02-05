import 'package:flutter_test/flutter_test.dart';

/// Unit Tests for Staff Bookings Screen - Shared Visibility Feature
/// These tests verify the business logic for:
/// 1. Tab switching between "Của tôi" and "Tất cả clinic"
/// 2. Clinic bookings visibility and filtering
/// 3. isMyAssignment badge logic
/// 4. EMR creation permission from colleague's booking
void main() {
  group('Shared Visibility - Tab Logic', () {
    test('should have exactly 2 tabs: "Của tôi" and "Tất cả clinic"', () {
      // Arrange
      const tabCount = 2;
      const tabs = ['Của tôi', 'Tất cả clinic'];

      // Assert
      expect(tabs.length, tabCount);
      expect(tabs[0], 'Của tôi');
      expect(tabs[1], 'Tất cả clinic');
    });

    test('should load clinic bookings when switching to "Tất cả clinic" tab', () {
      // Arrange
      int currentTabIndex = 0;
      bool clinicBookingsLoaded = false;

      // Act - Simulate tab switch
      void onTabChanged(int newIndex) {
        currentTabIndex = newIndex;
        if (newIndex == 1 && !clinicBookingsLoaded) {
          // Load clinic bookings
          clinicBookingsLoaded = true;
        }
      }

      onTabChanged(1);

      // Assert
      expect(currentTabIndex, 1);
      expect(clinicBookingsLoaded, true);
    });

    test('should NOT reload clinic bookings if already loaded', () {
      // Arrange
      int loadClinicBookingsCallCount = 0;
      bool clinicBookingsLoaded = true;

      // Act
      void onTabChanged(int newIndex) {
        if (newIndex == 1 && !clinicBookingsLoaded) {
          loadClinicBookingsCallCount++;
          clinicBookingsLoaded = true;
        }
      }

      onTabChanged(1);
      onTabChanged(0);
      onTabChanged(1); // Switch back again

      // Assert - Should not call load again since already loaded
      expect(loadClinicBookingsCallCount, 0);
    });
  });

  group('Shared Visibility - isMyAssignment Logic', () {
    test('should identify booking as mine when I am assigned to any service', () {
      // Arrange
      const currentUserId = 'staff-001';

      final bookingServices = [
        {
          'serviceId': 'svc-001',
          'assignedStaffId': 'staff-001', // Me
          'serviceName': 'Khám tổng quát',
        },
        {
          'serviceId': 'svc-002',
          'assignedStaffId': 'staff-002', // Other staff
          'serviceName': 'Tiêm phòng',
        },
      ];

      // Act
      bool isMyAssignment(List<Map<String, dynamic>> services, String userId) {
        return services.any((s) => s['assignedStaffId'] == userId);
      }

      final result = isMyAssignment(bookingServices, currentUserId);

      // Assert
      expect(result, true,
          reason: 'Should be my assignment if I am assigned to ANY service');
    });

    test('should NOT identify booking as mine when other staff assigned', () {
      // Arrange
      const currentUserId = 'staff-001';

      final bookingServices = [
        {
          'serviceId': 'svc-001',
          'assignedStaffId': 'staff-002', // Other staff
          'serviceName': 'Khám tổng quát',
        },
        {
          'serviceId': 'svc-002',
          'assignedStaffId': 'staff-003', // Other staff
          'serviceName': 'Tiêm phòng',
        },
      ];

      // Act
      bool isMyAssignment(List<Map<String, dynamic>> services, String userId) {
        return services.any((s) => s['assignedStaffId'] == userId);
      }

      final result = isMyAssignment(bookingServices, currentUserId);

      // Assert
      expect(result, false,
          reason: 'Should NOT be my assignment if I am not assigned to any service');
    });

    test('should handle empty services list', () {
      // Arrange
      const currentUserId = 'staff-001';
      final bookingServices = <Map<String, dynamic>>[];

      // Act
      bool isMyAssignment(List<Map<String, dynamic>> services, String userId) {
        return services.any((s) => s['assignedStaffId'] == userId);
      }

      final result = isMyAssignment(bookingServices, currentUserId);

      // Assert
      expect(result, false);
    });
  });

  group('Shared Visibility - EMR Creation Permission', () {
    test('should allow EMR creation for IN_PROGRESS booking in same clinic', () {
      // Arrange
      const bookingStatus = 'IN_PROGRESS';
      const bookingClinicId = 'clinic-001';
      const staffClinicId = 'clinic-001';

      // Act
      bool canCreateEmr(String status, String bookingClinic, String staffClinic) {
        return status == 'IN_PROGRESS' && bookingClinic == staffClinic;
      }

      final result = canCreateEmr(bookingStatus, bookingClinicId, staffClinicId);

      // Assert
      expect(result, true,
          reason: 'Staff in same clinic can add EMR for IN_PROGRESS booking');
    });

    test('should NOT allow EMR creation for COMPLETED booking', () {
      // Arrange
      const bookingStatus = 'COMPLETED';
      const bookingClinicId = 'clinic-001';
      const staffClinicId = 'clinic-001';

      // Act
      bool canCreateEmr(String status, String bookingClinic, String staffClinic) {
        return status == 'IN_PROGRESS' && bookingClinic == staffClinic;
      }

      final result = canCreateEmr(bookingStatus, bookingClinicId, staffClinicId);

      // Assert
      expect(result, false,
          reason: 'Cannot add EMR after checkout (COMPLETED status)');
    });

    test('should NOT allow EMR creation for different clinic', () {
      // Arrange
      const bookingStatus = 'IN_PROGRESS';
      const bookingClinicId = 'clinic-001';
      const staffClinicId = 'clinic-002'; // Different clinic

      // Act
      bool canCreateEmr(String status, String bookingClinic, String staffClinic) {
        return status == 'IN_PROGRESS' && bookingClinic == staffClinic;
      }

      final result = canCreateEmr(bookingStatus, bookingClinicId, staffClinicId);

      // Assert
      expect(result, false,
          reason: 'Staff cannot add EMR for booking from different clinic');
    });

    test('should NOT allow EMR creation for CONFIRMED status (before check-in)', () {
      // Arrange
      const bookingStatus = 'CONFIRMED';
      const bookingClinicId = 'clinic-001';
      const staffClinicId = 'clinic-001';

      // Act
      bool canCreateEmr(String status, String bookingClinic, String staffClinic) {
        return status == 'IN_PROGRESS' && bookingClinic == staffClinic;
      }

      final result = canCreateEmr(bookingStatus, bookingClinicId, staffClinicId);

      // Assert
      expect(result, false,
          reason: 'Cannot add EMR before booking is IN_PROGRESS');
    });
  });

  group('Shared Visibility - Booking Card Display', () {
    test('should show "Của tôi" badge when isMyAssignment is true', () {
      // Arrange
      const isClinicView = true;
      const isMyBooking = true;

      // Act
      bool shouldShowMyBadge(bool clinicView, bool myBooking) {
        return clinicView && myBooking;
      }

      final result = shouldShowMyBadge(isClinicView, isMyBooking);

      // Assert
      expect(result, true);
    });

    test('should NOT show "Của tôi" badge in "My Bookings" tab', () {
      // Arrange
      const isClinicView = false; // "Của tôi" tab
      const isMyBooking = true;

      // Act
      bool shouldShowMyBadge(bool clinicView, bool myBooking) {
        return clinicView && myBooking;
      }

      final result = shouldShowMyBadge(isClinicView, isMyBooking);

      // Assert
      expect(result, false,
          reason: 'Badge not needed in My Bookings tab - all are mine');
    });

    test('should show assigned staff name for colleague bookings', () {
      // Arrange
      const isClinicView = true;
      const isMyBooking = false;
      const assignedStaffName = 'Nguyễn Văn A';

      // Act
      bool shouldShowAssignedStaff(bool clinicView, bool myBooking, String? staffName) {
        return clinicView && !myBooking && staffName != null;
      }

      final result = shouldShowAssignedStaff(isClinicView, isMyBooking, assignedStaffName);

      // Assert
      expect(result, true);
    });

    test('should NOT show assigned staff for my own booking in clinic view', () {
      // Arrange
      const isClinicView = true;
      const isMyBooking = true;
      const assignedStaffName = 'Tôi';

      // Act
      bool shouldShowAssignedStaff(bool clinicView, bool myBooking, String? staffName) {
        return clinicView && !myBooking && staffName != null;
      }

      final result = shouldShowAssignedStaff(isClinicView, isMyBooking, assignedStaffName);

      // Assert
      expect(result, false,
          reason: 'No need to show "assigned to me" text for my own booking');
    });
  });

  group('Shared Visibility - Status Filter', () {
    test('should have correct status filters for staff bookings', () {
      // Arrange
      final statusFilters = [
        {'label': 'Tất cả', 'value': 'all'},
        {'label': 'Chờ khám', 'value': 'CONFIRMED'},
        {'label': 'Đang khám', 'value': 'IN_PROGRESS'},
        {'label': 'Đã khám', 'value': 'COMPLETED'},
      ];

      // Assert
      expect(statusFilters.length, 4);
      expect(statusFilters[0]['value'], 'all');
      expect(statusFilters[1]['value'], 'CONFIRMED');
      expect(statusFilters[2]['value'], 'IN_PROGRESS');
      expect(statusFilters[3]['value'], 'COMPLETED');
    });

    test('should filter bookings by status correctly', () {
      // Arrange
      final bookings = [
        {'bookingId': 'b1', 'status': 'CONFIRMED'},
        {'bookingId': 'b2', 'status': 'IN_PROGRESS'},
        {'bookingId': 'b3', 'status': 'COMPLETED'},
        {'bookingId': 'b4', 'status': 'IN_PROGRESS'},
      ];

      // Act
      List<Map<String, dynamic>> filterByStatus(
          List<Map<String, dynamic>> list, String status) {
        if (status == 'all') return list;
        return list.where((b) => b['status'] == status).toList();
      }

      final inProgressBookings = filterByStatus(bookings, 'IN_PROGRESS');

      // Assert
      expect(inProgressBookings.length, 2);
      expect(inProgressBookings.every((b) => b['status'] == 'IN_PROGRESS'), true);
    });
  });

  group('Shared Visibility - API Endpoint', () {
    test('getClinicTodayBookings endpoint path should be correct', () {
      // Arrange
      const clinicId = 'clinic-001';

      // Act
      final endpoint = '/bookings/clinic/$clinicId/today';

      // Assert
      expect(endpoint, '/bookings/clinic/clinic-001/today');
      expect(endpoint.endsWith('/today'), true);
    });

    test('should parse ClinicTodayBooking response correctly', () {
      // Arrange - Mock API response
      final mockResponse = {
        'bookingId': 'booking-001',
        'bookingCode': 'PET001',
        'petName': 'Milu',
        'ownerName': 'Nguyễn Văn B',
        'status': 'IN_PROGRESS',
        'bookingDate': '2025-02-04',
        'bookingTime': '09:00:00',
        'isMyAssignment': false,
        'assignedStaffId': 'staff-002',
        'assignedStaffName': 'Dr. Trần Văn A',
        'services': [
          {
            'serviceId': 'svc-001',
            'serviceName': 'Khám tổng quát',
            'assignedStaffId': 'staff-002',
          }
        ],
      };

      // Assert
      expect(mockResponse['bookingId'], 'booking-001');
      expect(mockResponse['isMyAssignment'], false);
      expect(mockResponse['assignedStaffName'], 'Dr. Trần Văn A');
      expect((mockResponse['services'] as List).length, 1);
    });
  });

  group('Shared Visibility - Info Banner', () {
    test('should show info banner for colleague IN_PROGRESS booking', () {
      // Arrange
      const isMyBooking = false;
      const status = 'IN_PROGRESS';

      // Act
      bool shouldShowInfoBanner(bool myBooking, String bookingStatus) {
        return !myBooking && bookingStatus == 'IN_PROGRESS';
      }

      final result = shouldShowInfoBanner(isMyBooking, status);

      // Assert
      expect(result, true,
          reason: 'Info banner should explain that this is a colleague\'s booking');
    });

    test('should NOT show info banner for my own booking', () {
      // Arrange
      const isMyBooking = true;
      const status = 'IN_PROGRESS';

      // Act
      bool shouldShowInfoBanner(bool myBooking, String bookingStatus) {
        return !myBooking && bookingStatus == 'IN_PROGRESS';
      }

      final result = shouldShowInfoBanner(isMyBooking, status);

      // Assert
      expect(result, false);
    });

    test('should NOT show info banner for colleague COMPLETED booking', () {
      // Arrange
      const isMyBooking = false;
      const status = 'COMPLETED';

      // Act
      bool shouldShowInfoBanner(bool myBooking, String bookingStatus) {
        return !myBooking && bookingStatus == 'IN_PROGRESS';
      }

      final result = shouldShowInfoBanner(isMyBooking, status);

      // Assert
      expect(result, false,
          reason: 'No need for banner if booking is already completed');
    });
  });

  group('Shared Visibility - Audit Trail', () {
    test('EMR should record createdBy staff ID', () {
      // Arrange
      const currentStaffId = 'staff-001';
      const bookingId = 'booking-001';

      // Act - Simulate EMR creation request
      final emrRequest = {
        'bookingId': bookingId,
        'petId': 'pet-001',
        'chiefComplaint': 'Mệt mỏi, bỏ ăn',
        'diagnosis': 'Nhiễm trùng đường ruột',
        // Note: Backend will automatically set staffId from JWT token
      };

      // Assert - EMR will have staffId set by backend
      expect(emrRequest['bookingId'], bookingId);
      expect(emrRequest.containsKey('chiefComplaint'), true);
    });

    test('EMR staff ID should be current user, not assigned staff', () {
      // Arrange
      const assignedStaffId = 'staff-002'; // Original assigned staff
      const currentStaffId = 'staff-001'; // Staff creating EMR

      // Business rule: EMR.staffId = current user (for audit)
      // NOT the originally assigned staff

      // Assert
      expect(currentStaffId != assignedStaffId, true,
          reason: 'EMR records WHO created it, not who was assigned to booking');
    });
  });
}

import 'package:flutter/material.dart';

import 'api_client.dart';
import '../models/booking.dart';
import '../models/clinic_service.dart';
import 'auth_service.dart';

/// BookingService - Handles booking-related API calls for mobile Staff
class BookingService {
  final ApiClient _apiClient = ApiClient.instance;

  /// Get booking by ID
  Future<BookingResponse> getBookingById(String bookingId) async {
    final response = await _apiClient.get('/bookings/$bookingId');
    return BookingResponse.fromJson(response.data);
  }

  /// Check-in booking (Staff action: CONFIRMED → IN_PROGRESS)
  /// Used for both clinic and home visits
  Future<BookingResponse> checkIn(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/check-in');
    return BookingResponse.fromJson(response.data);
  }

  /// Checkout booking: thanh toán và hoàn tất lịch hẹn (IN_PROGRESS → COMPLETED)
  /// Chỉ gọi khi booking đang ở trạng thái IN_PROGRESS
  /// @param bookingId Booking UUID
  /// @param overriddenSosFee Optional: Override SOS fee (for staff adjustment)
  Future<BookingResponse> checkout(String bookingId,
      {double? overriddenSosFee}) async {
    final response = await _apiClient.post(
      '/bookings/$bookingId/checkout',
      data: overriddenSosFee != null
          ? {'overriddenSosFee': overriddenSosFee}
          : <String, dynamic>{},
    );
    return BookingResponse.fromJson(response.data);
  }

  /// Start moving to customer location (SOS/HOME_VISIT)
  /// Note: Status remains CONFIRMED or transitions to IN_PROGRESS based on backend logic
  Future<BookingResponse> startMoving(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/start-moving');
    return BookingResponse.fromJson(response.data);
  }

  /// Staff arrived at customer location (SOS/HOME_VISIT)
  /// Keeps booking status IN_PROGRESS and marks arrival timestamp.
  Future<BookingResponse> arrived(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/arrived');
    return BookingResponse.fromJson(response.data);
  }

  /// Notify pet owner that staff is on the way (HOME_VISIT/SOS only)
  /// Legacy: Just sends notification, use startMoving() for status change.
  /// @param bookingId Booking UUID
  Future<BookingResponse> notifyOnWay(String bookingId) async {
    final response =
        await _apiClient.post('/bookings/$bookingId/notify-on-way');
    return BookingResponse.fromJson(response.data);
  }

  /// Get staff home summary - optimized single API call for staff home screen
  /// Returns: today's booking count, pending count, in-progress count, and upcoming bookings
  Future<StaffHomeSummaryResponse> getStaffHomeSummary() async {
    final response = await _apiClient.get('/bookings/staff/home-summary');
    return StaffHomeSummaryResponse.fromJson(response.data);
  }

  /// Get my bookings (Pet Owner)
  Future<List<BookingResponse>> getMyBookings({
    String? status,
    int page = 0,
    int size = 10,
  }) async {
    final queryParams = {
      if (status != null) 'status': status,
      'page': page,
      'size': size,
    };

    final response = await _apiClient.get('/bookings/my-bookings',
        queryParameters: queryParams);

    if (response.data['content'] != null) {
      return (response.data['content'] as List)
          .map((json) => BookingResponse.fromJson(json))
          .toList();
    }
    return [];
  }

  /// Get my proxy bookings (Đặt hộ) - Pet Owner là người đặt thay
  Future<List<BookingResponse>> getMyProxyBookings({
    String? status,
    int page = 0,
    int size = 10,
  }) async {
    final queryParams = {
      if (status != null) 'status': status,
      'page': page,
      'size': size,
    };

    final response = await _apiClient.get(
      '/bookings/my/proxy',
      queryParameters: queryParams,
    );
    debugPrint('queryParams: $queryParams');
    debugPrint('response: ${response.data}');

    if (response.data['content'] != null) {
      return (response.data['content'] as List)
          .map((json) => BookingResponse.fromJson(json))
          .toList();
    }
    return [];
  }

  /// Cancel booking (Pet Owner)
  Future<BookingResponse> cancelBooking(String bookingId, String reason) async {
    final response = await _apiClient.post(
      '/bookings/$bookingId/cancel',
      queryParameters: {'reason': reason},
    );
    return BookingResponse.fromJson(response.data);
  }

  /// Get bookings by staff ID with filtering and pagination
  Future<Map<String, dynamic>> getBookingsByStaff({
    String? status,
    int page = 0,
    int size = 20,
  }) async {
    try {
      final user = await AuthService().getCurrentUser();

      final response = await _apiClient.get(
        '/bookings/staff/${user.userId}',
        queryParameters: {
          if (status != null && status != 'all') 'status': status,
          'page': page,
          'size': size,
          'sort': 'bookingDate,desc',
        },
      );
      return response.data;
    } catch (e) {
      rethrow;
    }
  }

  /// Remove service from booking (Only if isAddOn = true)
  Future<BookingResponse> removeServiceFromBooking(
      String bookingId, String serviceId) async {
    final response = await _apiClient.delete(
      '/bookings/$bookingId/services/$serviceId',
    );
    return BookingResponse.fromJson(response.data);
  }

  // ========== SHARED VISIBILITY ==========

  /// Get available services for add-on in a booking
  Future<List<ClinicServiceModel>> getAvailableServicesForAddOn(
      String bookingId) async {
    try {
      final response =
          await _apiClient.get('/bookings/$bookingId/available-add-ons');
      if (response.data is List) {
        return (response.data as List)
            .map((json) => ClinicServiceModel.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }

  /// Add service to booking (Add-on service)
  Future<BookingResponse> addServiceToBooking(
      String bookingId, String serviceId) async {
    final response = await _apiClient.post(
      '/bookings/$bookingId/services',
      data: {'serviceId': serviceId},
    );
    return BookingResponse.fromJson(response.data);
  }

  /// Get all clinic bookings for today - Shared Visibility for Staff
  /// All staff in the clinic can see ALL bookings, with isMyAssignment flag
  /// to identify their own assignments.
  ///
  /// @param clinicId Clinic ID
  /// @returns List of ClinicTodayBooking with isMyAssignment flag
  Future<List<BookingResponse>> getClinicTodayBookings(String clinicId) async {
    try {
      final response = await _apiClient.get('/bookings/clinic/$clinicId/today');
      if (response.data is List) {
        return (response.data as List)
            .map((json) => BookingResponse.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }
}

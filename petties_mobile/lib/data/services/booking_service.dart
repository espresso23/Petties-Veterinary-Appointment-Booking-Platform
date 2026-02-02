import 'api_client.dart';
import '../models/booking.dart';
import 'auth_service.dart';
import 'dart:convert';

/// BookingService - Handles booking-related API calls for mobile Staff
class BookingService {
  final ApiClient _apiClient = ApiClient.instance;

  /// Get booking by ID
  Future<BookingResponse> getBookingById(String bookingId) async {
    final response = await _apiClient.get('/bookings/$bookingId');
    return BookingResponse.fromJson(response.data);
  }

  /// Check-in booking (Staff action: ASSIGNED/ARRIVED → IN_PROGRESS)
  Future<BookingResponse> checkIn(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/check-in');
    return BookingResponse.fromJson(response.data);
  }

  /// Complete booking (Staff action: IN_PROGRESS → COMPLETED)
  Future<BookingResponse> complete(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/complete');
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
    
    final response = await _apiClient.get('/bookings/my', queryParameters: queryParams);
    
    if (response.data['content'] != null) {
      return (response.data['content'] as List)
          .map((json) => BookingResponse.fromJson(json))
          .toList();
    }
    return [];
  }
  /// Cancel booking (Pet Owner)
  Future<BookingResponse> cancelBooking(String bookingId, String reason) async {
    final response = await _apiClient.patch(
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
      if (user == null) throw Exception('User not logged in');

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
}

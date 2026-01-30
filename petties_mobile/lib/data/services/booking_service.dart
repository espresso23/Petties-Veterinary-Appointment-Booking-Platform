import 'api_client.dart';
import '../models/booking.dart';
import 'auth_service.dart';
import 'dart:convert';

/// BookingService - Handles booking-related API calls for mobile Vet
class BookingService {
  final ApiClient _apiClient = ApiClient.instance;

  /// Get booking by ID
  Future<BookingResponse> getBookingById(String bookingId) async {
    final response = await _apiClient.get('/bookings/$bookingId');
    return BookingResponse.fromJson(response.data);
  }

  /// Check-in booking (Vet action: ASSIGNED/ARRIVED → IN_PROGRESS)
  Future<BookingResponse> checkIn(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/check-in');
    return BookingResponse.fromJson(response.data);
  }

  /// Complete booking (Vet action: IN_PROGRESS → COMPLETED)
  Future<BookingResponse> complete(String bookingId) async {
    final response = await _apiClient.post('/bookings/$bookingId/complete');
    return BookingResponse.fromJson(response.data);
  }

  /// Get vet home summary - optimized single API call for vet home screen
  /// Returns: today's booking count, pending count, in-progress count, and upcoming bookings
  Future<VetHomeSummaryResponse> getVetHomeSummary() async {
    final response = await _apiClient.get('/bookings/vet/home-summary');
    return VetHomeSummaryResponse.fromJson(response.data);
  }

  /// Get bookings by vet ID with filtering and pagination
  Future<Map<String, dynamic>> getBookingsByVet({
    String? status,
    int page = 0,
    int size = 20,
  }) async {
    try {
      final user = await AuthService().getCurrentUser();
      if (user == null) throw Exception('User not logged in');

      final response = await _apiClient.get(
        '/bookings/vet/${user.userId}',
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

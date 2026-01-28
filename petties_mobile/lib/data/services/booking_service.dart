import 'api_client.dart';
import '../models/booking.dart';

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
}

import 'api_client.dart';
import '../models/booking.dart';

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
}

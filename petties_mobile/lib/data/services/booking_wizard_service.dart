import '../models/clinic_service.dart';
import '../models/pet.dart';
import 'api_client.dart';

/// Service for booking wizard API calls
class BookingWizardService {
  final ApiClient _apiClient;

  BookingWizardService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient.instance;

  /// Get user's pets
  Future<List<Pet>> getMyPets() async {
    try {
      final response = await _apiClient.get('/pets/me');

      if (response.data is List) {
        return (response.data as List)
            .map((json) => Pet.fromJson(json))
            .toList();
      }

      if (response.data is Map && response.data['content'] != null) {
        return (response.data['content'] as List)
            .map((json) => Pet.fromJson(json))
            .toList();
      }

      return [];
    } catch (e) {
      rethrow;
    }
  }

  /// Get clinic services
  Future<List<ClinicServiceModel>> getClinicServices(String clinicId) async {
    try {
      final response = await _apiClient.get('/services/by-clinic/$clinicId');

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

  /// Get available time slots
  Future<List<AvailableSlot>> getAvailableSlots({
    required String clinicId,
    required DateTime date,
    required List<String> serviceIds,
  }) async {
    try {
      final dateStr =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

      final response = await _apiClient.get(
        '/bookings/public/available-slots',
        queryParameters: {
          'clinicId': clinicId,
          'date': dateStr,
          'serviceIds': serviceIds,
        },
      );

      if (response.data is Map && response.data['availableSlots'] != null) {
        return (response.data['availableSlots'] as List)
            .map((e) => AvailableSlot.fromString(e.toString()))
            .toList();
      }

      return [];
    } catch (e) {
      rethrow;
    }
  }

  /// Create booking
  Future<String> createBooking({
    required String clinicId,
    required DateTime bookingDate,
    required String bookingTime,
    required String bookingType,
    required List<Map<String, dynamic>> items,
    String? notes,
    String? homeAddress,
    double? homeLat,
    double? homeLong,
    double? distanceKm,
  }) async {
    try {
      final dateStr =
          '${bookingDate.year}-${bookingDate.month.toString().padLeft(2, '0')}-${bookingDate.day.toString().padLeft(2, '0')}';

      final body = {
        'clinicId': clinicId,
        'bookingDate': dateStr,
        'bookingTime': bookingTime,
        'type': bookingType,
        'items': items, // List of {petId, serviceIds}
        if (notes != null) 'notes': notes,
        if (homeAddress != null) 'homeAddress': homeAddress,
        if (homeLat != null) 'homeLat': homeLat,
        if (homeLong != null) 'homeLong': homeLong,
        if (distanceKm != null) 'distanceKm': distanceKm,
      };

      final response = await _apiClient.post('/bookings', data: body);

      return response.data['bookingId'] ?? '';
    } catch (e) {
      rethrow;
    }
  }
}

import 'package:flutter/material.dart';

import '../models/clinic_service.dart';
import '../models/beneficiary_info.dart';
import '../models/estimated_completion_response.dart';
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
        'items': items,
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

  /// Create booking for others (Đặt hộ)
  Future<String> createBookingForOthers({
    required String clinicId,
    required BeneficiaryInfo beneficiary,
    required DateTime bookingDate,
    required String bookingTime,
    required String bookingType,
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    try {
      final dateStr =
          '${bookingDate.year}-${bookingDate.month.toString().padLeft(2, '0')}-${bookingDate.day.toString().padLeft(2, '0')}';

      final body = {
        'recipient': {
          'fullName': beneficiary.fullName,
          'phone': beneficiary.phone,
          'address': beneficiary.address,
        },
        'items': items,
        'clinicId': clinicId,
        'bookingDate': dateStr,
        'bookingTime': bookingTime,
        'type': bookingType,
        if (notes != null) 'notes': notes,
      };

      debugPrint('body booking proxy: $body');

      final response =
          await _apiClient.post('/bookings/proxy', data: body);
      return response.data['bookingId'] ?? '';
    } catch (e) {
      rethrow;
    }
  }
  /// Get estimated completion time.
  /// POST /bookings/public/estimated-completion?clinicId={clinicId}
  /// Body: startDateTime (yyyy-MM-ddTHH:mm:ss), type, pets: [{ petId, petWeight, serviceIds }]
  Future<EstimatedCompletionResponse> getEstimatedCompletion({
    required String clinicId,
    required String startDateTime,
    required String type,
    required List<Map<String, dynamic>> pets,
  }) async {
    final body = <String, dynamic>{
      'startDateTime': startDateTime,
      'type': type,
      'pets': pets,
    };
    debugPrint('body: $body');
    debugPrint('clinicId: $clinicId');
    final response = await _apiClient.post(
      '/bookings/public/estimated-completion',
      data: body,
      queryParameters: {'clinicId': clinicId},
    );
    if (response.data is! Map<String, dynamic>) {
      throw Exception('Invalid estimated-completion response');
    }
    return EstimatedCompletionResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }
}

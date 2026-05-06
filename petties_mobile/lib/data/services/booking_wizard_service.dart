import 'dart:convert';

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

  /// Get clinic services filtered by pet species and home visit capability
  Future<List<ClinicServiceModel>> getClinicServicesFiltered({
    required String clinicId,
    required String petSpecies,
    required bool isHomeVisit,
  }) async {
    try {
      final response = await _apiClient.get(
        '/services/by-clinic/$clinicId/compatible',
        queryParameters: {
          'petSpecies': petSpecies,
          'isHomeVisit': isHomeVisit,
        },
      );

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

  /// Get clinic services (all services, no filter)
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
  Future<AvailableSlotsResponse> getAvailableSlots({
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

      if (response.data is Map) {
        final slotResponse = AvailableSlotsResponse.fromJson(
            Map<String, dynamic>.from(response.data));

        return AvailableSlotsResponse(
          availableSlots: slotResponse.availableSlots
              .map(_normalizeTimeString)
              .where((time) => time.isNotEmpty)
              .toList(),
          hasShifts: slotResponse.hasShifts,
          message: slotResponse.message,
        );
      }

      return AvailableSlotsResponse();
    } catch (e) {
      rethrow;
    }
  }

  String _normalizeTimeString(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return '';

    final parts = value.split(':');
    if (parts.length < 2) return value;

    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) {
      return value;
    }

    return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
  }

  /// Create booking
  Future<Map<String, dynamic>> createBooking({
    required String clinicId,
    required DateTime bookingDate,
    required String bookingTime,
    required String bookingType,
    required List<Map<String, dynamic>> items,
    String? paymentMethod,
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
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
        if (notes != null) 'notes': notes,
        if (homeAddress != null) 'homeAddress': homeAddress,
        if (homeLat != null) 'homeLat': homeLat,
        if (homeLong != null) 'homeLong': homeLong,
        if (distanceKm != null) 'distanceKm': distanceKm,
      };

      debugPrint('body booking: ${jsonEncode(body)}');

      final response = await _apiClient.post('/bookings', data: body);

      return Map<String, dynamic>.from(response.data as Map);
    } catch (e) {
      rethrow;
    }
  }

  /// Create booking for others (Đặt hộ)
  Future<Map<String, dynamic>> createBookingForOthers({
    required String clinicId,
    required BeneficiaryInfo beneficiary,
    required DateTime bookingDate,
    required String bookingTime,
    required String bookingType,
    required List<Map<String, dynamic>> items,
    String? paymentMethod,
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
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
        if (notes != null) 'notes': notes,
      };

      debugPrint('body booking proxy: $body');

      final response = await _apiClient.post('/bookings/proxy', data: body);
      return Map<String, dynamic>.from(response.data as Map);
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

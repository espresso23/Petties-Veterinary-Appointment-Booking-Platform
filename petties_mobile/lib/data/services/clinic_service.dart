import '../models/clinic.dart';
import '../models/staff_member.dart';
import 'api_client.dart';

class ClinicService {
  final ApiClient _apiClient;

  ClinicService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Search clinics nearby with optional filters
  /// Supports multiple filters including location, province, district, price range
  Future<List<Clinic>> searchClinics({
    double? latitude,
    double? longitude,
    double? radiusKm,
    String? searchQuery,
    bool? isOpenNow,
    bool? sortByRating,
    bool? sortByDistance,
    String? province,
    String? district,
    double? minPrice,
    double? maxPrice,
    int page = 0,
    int size = 20,
  }) async {
    try {
      final response = await _apiClient.get(
        '/clinics/search',
        queryParameters: {
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (radiusKm != null) 'radiusKm': radiusKm,
          if (searchQuery != null && searchQuery.isNotEmpty)
            'query': searchQuery,
          if (isOpenNow == true) 'isOpenNow': true,
          if (sortByRating == true) 'sortByRating': true,
          if (sortByDistance == true) 'sortByDistance': true,
          if (province != null && province.isNotEmpty) 'province': province,
          if (district != null && district.isNotEmpty) 'district': district,
          if (minPrice != null) 'minPrice': minPrice,
          if (maxPrice != null) 'maxPrice': maxPrice,
          'page': page,
          'size': size,
        },
      );

      // Debug: log response
      print('=== CLINIC SEARCH RESPONSE ===');
      print('Response type: ${response.data.runtimeType}');
      if (response.data is Map) {
        print('Total elements: ${response.data['totalElements']}');
        print('Content length: ${(response.data['content'] as List?)?.length}');
      }

      // Handle paginated response
      if (response.data is Map && response.data['content'] != null) {
        final List<dynamic> content = response.data['content'];
        final clinics = <Clinic>[];
        for (final json in content) {
          if (json != null) {
            try {
              clinics.add(Clinic.fromJson(json));
            } catch (e) {
              print('Error parsing clinic: $e');
              print('JSON: $json');
            }
          }
        }
        print('Parsed ${clinics.length} clinics successfully');
        return clinics;
      }

      // Handle list response
      if (response.data is List) {
        return (response.data as List)
            .where((json) => json != null)
            .map((json) => Clinic.fromJson(json))
            .toList();
      }

      return [];
    } catch (e) {
      rethrow;
    }
  }

  /// Get clinic by ID
  Future<Clinic> getClinicById(String id) async {
    try {
      final response = await _apiClient.get('/clinics/$id');
      return Clinic.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Get all approved clinics
  Future<List<Clinic>> getApprovedClinics({
    int page = 0,
    int size = 20,
  }) async {
    try {
      final response = await _apiClient.get(
        '/clinics',
        queryParameters: {
          'status': 'APPROVED',
          'page': page,
          'size': size,
        },
      );

      if (response.data is Map && response.data['content'] != null) {
        final List<dynamic> content = response.data['content'];
        return content.map((json) => Clinic.fromJson(json)).toList();
      }

      if (response.data is List) {
        return (response.data as List)
            .map((json) => Clinic.fromJson(json))
            .toList();
      }

      return [];
    } catch (e) {
      rethrow;
    }
  }

  /// Get public staff list for a clinic (for Pet Owners)
  Future<List<StaffMember>> getClinicStaff(String clinicId) async {
    try {
      final response = await _apiClient.get('/clinics/$clinicId/public-staff');

      if (response.data is List) {
        return (response.data as List)
            .where((json) => json != null)
            .map((json) => StaffMember.fromJson(json))
            .toList();
      }

      return [];
    } catch (e) {
      rethrow;
    }
  }
}

import 'package:dio/dio.dart';
import '../models/emr.dart';
import 'api_client.dart';

/// EMR Service - Handle EMR API calls
class EmrService {
  final ApiClient _apiClient;

  EmrService([ApiClient? apiClient]) : _apiClient = apiClient ?? ApiClient.instance;

  /// Get EMR records for a specific pet
  Future<List<EmrRecord>> getEmrsByPetId(String petId) async {
    try {
      final response = await _apiClient.get('/emr/pet/$petId');
      final List<dynamic> data = response.data;
      return data.map((json) => EmrRecord.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// Get EMR by ID
  Future<EmrRecord> getEmrById(String emrId) async {
    try {
      final response = await _apiClient.get('/emr/$emrId');
      return EmrRecord.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Get EMR by Booking ID (returns null if not found)
  Future<EmrRecord?> getEmrByBookingId(String bookingId) async {
    try {
      final response = await _apiClient.get('/emr/booking/$bookingId');
      return EmrRecord.fromJson(response.data);
    } catch (e) {
      // Return null if EMR not found for this booking
      return null;
    }
  }

  /// Create a new EMR record (Vet only)
  Future<EmrRecord> createEmr(CreateEmrRequest request) async {
    try {
      final response = await _apiClient.post(
        '/emr',
        data: request.toJson(),
      );
      return EmrRecord.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Update EMR record (Vet only)
  Future<EmrRecord> updateEmr(String emrId, CreateEmrRequest request) async {
    try {
      final response = await _apiClient.put(
        '/emr/$emrId',
        data: request.toJson(),
      );
      return EmrRecord.fromJson(response.data);
    } on DioException catch (e) {
      // Extract user-friendly message from API response
      final message = e.response?.data?['message'] ?? 'Lỗi khi cập nhật bệnh án';
      throw Exception(message);
    } catch (e) {
      rethrow;
    }
  }
  /// Upload EMR image
  Future<String> uploadImage(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });

      final response = await _apiClient.post(
        '/emr/upload-image',
        data: formData,
      );
      
      return response.data['url'];
    } catch (e) {
      rethrow;
    }
  }
}

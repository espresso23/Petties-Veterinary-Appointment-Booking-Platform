import '../models/clinic_service.dart';
import 'api_client.dart';

class ServiceService {
  final ApiClient _apiClient;

  ServiceService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Get all services for the current user's clinic
  /// Optionally filter by category
  Future<List<ClinicServiceModel>> getServices({String? category}) async {
    try {
      final response = await _apiClient.get(
        '/services',
        queryParameters: {
          if (category != null) 'category': category,
          'size': 100, // Fetch enough services
        },
      );

      if (response.data is Map && response.data['content'] != null) {
        final List<dynamic> content = response.data['content'];
        return content.map((json) => ClinicServiceModel.fromJson(json)).toList();
      }

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
}

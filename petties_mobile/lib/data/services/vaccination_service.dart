import '../models/vaccination.dart';
import 'api_client.dart';

class VaccinationService {
  final ApiClient _apiClient = ApiClient();

  /// Get vaccinations for a pet
  Future<List<VaccinationRecord>> getVaccinationsByPet(String petId) async {
    final response = await _apiClient.get('/vaccinations/pet/$petId');
    
    // ApiClient returns dynamic, we need to cast to List
    final List<dynamic> data = response as List<dynamic>;
    
    return data.map((json) => VaccinationRecord.fromJson(json)).toList();
  }

  /// Create a new vaccination record
  Future<VaccinationRecord> createVaccination(CreateVaccinationRequest request) async {
    final response = await _apiClient.post(
      '/vaccinations',
      data: request.toJson(),
    );
    
    return VaccinationRecord.fromJson(response);
  }
}

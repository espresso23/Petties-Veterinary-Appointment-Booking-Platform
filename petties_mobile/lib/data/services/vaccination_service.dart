import '../models/vaccination.dart';
import 'api_client.dart';

class VaccinationService {
  final ApiClient _apiClient = ApiClient();

  /// Get vaccinations for a pet
  Future<List<VaccinationRecord>> getVaccinationsByPet(String petId) async {
    final response = await _apiClient.get('/vaccinations/pet/$petId');
    final List<dynamic> data = response.data as List<dynamic>;
    return data.map((json) => VaccinationRecord.fromJson(json)).toList();
  }

  /// Get predicted/upcoming vaccinations for a pet
  Future<List<VaccinationRecord>> getUpcomingVaccinations(String petId) async {
    final response = await _apiClient.get('/vaccinations/pet/$petId/upcoming');
    final List<dynamic> data = response.data as List<dynamic>;
    return data.map((json) => VaccinationRecord.fromJson(json)).toList();
  }

  /// Create a new vaccination record
  Future<VaccinationRecord> createVaccination(CreateVaccinationRequest request) async {
    final response = await _apiClient.post(
      '/vaccinations',
      data: request.toJson(),
    );
    
    return VaccinationRecord.fromJson(response.data);
  }

  /// Delete a vaccination record
  Future<void> deleteVaccination(String id) async {
    await _apiClient.delete('/vaccinations/$id');
  }
}

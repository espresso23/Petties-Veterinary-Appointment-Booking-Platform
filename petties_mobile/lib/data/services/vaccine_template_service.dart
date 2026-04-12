import '../models/vaccine_template.dart';
import 'api_client.dart';

class VaccineTemplateService {
  final ApiClient _apiClient = ApiClient();

  /// Get all vaccine templates
  Future<List<VaccineTemplate>> getTemplates() async {
    final response = await _apiClient.get('/vaccine-templates');
    final List<dynamic> data = response.data as List<dynamic>;
    return data.map((json) => VaccineTemplate.fromJson(json)).toList();
  }
}

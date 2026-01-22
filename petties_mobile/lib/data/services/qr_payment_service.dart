import 'api_client.dart';

class QrPaymentService {
  final ApiClient _apiClient;

  QrPaymentService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();



  Future<Map<String, dynamic>> checkQrStatus(String bookingId) async {
    final response = await _apiClient.get('/payments/$bookingId/qr-status');
    return Map<String, dynamic>.from(response.data);
  }
}

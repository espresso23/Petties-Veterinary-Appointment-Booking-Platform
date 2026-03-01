import 'api_client.dart';

class QrPaymentService {
  final ApiClient _apiClient;

  QrPaymentService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();



  /// Check QR payment status
  /// Backend endpoint: GET /payments/{bookingId}/status
  Future<Map<String, dynamic>> checkQrStatus(String bookingId) async {
    final response = await _apiClient.get('/payments/$bookingId/status');
    return Map<String, dynamic>.from(response.data);
  }
}

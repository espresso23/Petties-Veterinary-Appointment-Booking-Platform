import '../models/vet_shift.dart';
import 'api_client.dart';

class VetShiftService {
  final ApiClient _apiClient;

  VetShiftService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get shifts for the currently logged-in vet
  Future<List<VetShiftResponse>> getMyShifts({
    required String startDate,
    required String endDate,
  }) async {
    final response = await _apiClient.get(
      '/shifts/me',
      queryParameters: {
        'startDate': startDate,
        'endDate': endDate,
      },
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = response.data;
      return data.map((json) => VetShiftResponse.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load shifts');
    }
  }

  /// Get shift detail with slots
  Future<VetShiftResponse> getShiftDetail(String shiftId) async {
    final response = await _apiClient.get('/shifts/$shiftId');

    if (response.statusCode == 200) {
      return VetShiftResponse.fromJson(response.data);
    } else {
      throw Exception('Failed to load shift detail');
    }
  }

  /// Block a slot
  Future<SlotResponse> blockSlot(String slotId) async {
    final response = await _apiClient.patch('/slots/$slotId/block');

    if (response.statusCode == 200) {
      return SlotResponse.fromJson(response.data);
    } else {
      throw Exception('Failed to block slot');
    }
  }

  /// Unblock a slot
  Future<SlotResponse> unblockSlot(String slotId) async {
    final response = await _apiClient.patch('/slots/$slotId/unblock');

    if (response.statusCode == 200) {
      return SlotResponse.fromJson(response.data);
    } else {
      throw Exception('Failed to unblock slot');
    }
  }
}

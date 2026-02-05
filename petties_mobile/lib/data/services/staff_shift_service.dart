import '../models/staff_shift.dart';
import 'api_client.dart';

class StaffShiftService {
  final ApiClient _apiClient;

  StaffShiftService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get shifts for the currently logged-in staff
  Future<List<StaffShiftResponse>> getMyShifts({
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
      return data.map((json) => StaffShiftResponse.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load shifts');
    }
  }

  /// Get shift detail with slots
  Future<StaffShiftResponse> getShiftDetail(String shiftId) async {
    final response = await _apiClient.get('/shifts/$shiftId');

    if (response.statusCode == 200) {
      return StaffShiftResponse.fromJson(response.data);
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

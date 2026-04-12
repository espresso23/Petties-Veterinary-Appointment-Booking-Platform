import 'api_client.dart';
import 'tracking_websocket_service.dart';

/// TrackingRestService - gọi REST API để lấy vị trí hiện tại của bác sĩ
/// Dùng cho Pet Owner khi mở màn hình Theo dõi bác sĩ lần đầu
class TrackingRestService {
  final ApiClient _apiClient = ApiClient.instance;

  /// Lấy vị trí staff hiện tại cho một booking
  /// GET /tracking/booking/{bookingId}
  ///
  /// Trả về null nếu backend trả 204 No Content hoặc không có dữ liệu.
  Future<TrackingLocation?> getStaffLocation(String bookingId) async {
    final response = await _apiClient.get('/tracking/booking/$bookingId');

    // Khi không có dữ liệu tracking, backend trả 204 hoặc body rỗng
    if (response.statusCode == 204 || response.data == null) {
      return null;
    }

    if (response.data is Map<String, dynamic>) {
      return TrackingLocation.fromJson(response.data as Map<String, dynamic>);
    }

    // Trường hợp hiếm: response không đúng format mong đợi
    return null;
  }
}


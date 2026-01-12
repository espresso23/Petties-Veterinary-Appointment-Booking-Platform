import '../models/notification.dart';
import 'api_client.dart';

class NotificationService {
  final ApiClient _apiClient;

  NotificationService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get notifications with pagination
  Future<List<NotificationModel>> getNotifications({
    int page = 0,
    int size = 20,
  }) async {
    try {
      final response = await _apiClient.get(
        '/notifications/me',
        queryParameters: {
          'page': page,
          'size': size,
        },
      );

      final List<dynamic> content = response.data['content'];
      return content.map((json) => NotificationModel.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// Get unread count
  Future<int> getUnreadCount() async {
    try {
      final response = await _apiClient.get('/notifications/me/unread-count');
      return response.data['count'] as int;
    } catch (e) {
      rethrow;
    }
  }

  /// Mark notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      await _apiClient.put('/notifications/$notificationId/read');
    } catch (e) {
      rethrow;
    }
  }

  /// Mark all notifications as read
  Future<void> markAllAsRead() async {
    try {
      await _apiClient.put('/notifications/me/mark-all-read');
    } catch (e) {
      rethrow;
    }
  }
}

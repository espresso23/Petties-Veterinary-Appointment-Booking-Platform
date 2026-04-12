import 'package:flutter/foundation.dart';
import '../data/models/notification.dart';
import '../data/services/notification_service.dart';
import '../utils/api_error_handler.dart';

class NotificationProvider extends ChangeNotifier {
  final NotificationService _notificationService;

  List<NotificationModel> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String? _error;
  int _currentPage = 0;
  bool _hasMore = true;

  NotificationProvider({NotificationService? notificationService})
      : _notificationService = notificationService ?? NotificationService();

  // Getters
  List<NotificationModel> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasMore => _hasMore;

  /// Fetch first page of notifications
  Future<void> fetchNotifications({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      _currentPage = 0;
      _notifications = await _notificationService.getNotifications(
        page: _currentPage,
        size: 20,
      );
      _hasMore = _notifications.length >= 20;

      // Also fetch unread count
      _unreadCount = await _notificationService.getUnreadCount();

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = ApiErrorHandler.getErrorMessage(e);
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Load next page for infinite scroll
  Future<void> loadMore() async {
    if (!_hasMore || _isLoading) return;

    try {
      final nextPage = _currentPage + 1;
      final newNotifications = await _notificationService.getNotifications(
        page: nextPage,
        size: 20,
      );

      if (newNotifications.isEmpty) {
        _hasMore = false;
      } else {
        _notifications.addAll(newNotifications);
        _currentPage = nextPage;
        _hasMore = newNotifications.length >= 20;
      }
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading more notifications: $e');
    }
  }

  /// Mark a notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      await _notificationService.markAsRead(notificationId);

      // Update local state
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1 && !_notifications[index].isRead) {
        // Find existing notification and create a new one with isRead = true
        // Since NotificationModel fields are final, we would normally use copyWith
        // But for simplicity since I haven't added copyWith, I'll just refresh list
        // or re-create it if I had the data.
        // Let's just update the count and refresh the list for accuracy.
        _unreadCount = (_unreadCount - 1).clamp(0, 999);

        // Refresh to get updated state from server
        await fetchNotifications(silent: true);
      }
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  /// Mark all as read
  Future<void> markAllAsRead() async {
    try {
      await _notificationService.markAllAsRead();
      _unreadCount = 0;
      await fetchNotifications(silent: true);
    } catch (e) {
      debugPrint('Error marking all as read: $e');
    }
  }

  /// Reset state (on logout)
  void reset() {
    _notifications = [];
    _unreadCount = 0;
    _isLoading = false;
    _error = null;
    _currentPage = 0;
    _hasMore = true;
    notifyListeners();
  }
}

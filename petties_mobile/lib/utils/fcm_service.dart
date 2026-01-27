import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../config/env/environment.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'storage_service.dart';
import '../config/constants/app_constants.dart';
import '../routing/router_config.dart';
import '../routing/app_routes.dart';
import 'package:go_router/go_router.dart';

/// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('Background message: ${message.notification?.title}');

  // Initialize local notifications for background
  final FlutterLocalNotificationsPlugin localNotifications =
      FlutterLocalNotificationsPlugin();

  // Initialize settings
  const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
  const iosSettings = DarwinInitializationSettings();
  const initSettings = InitializationSettings(
    android: androidSettings,
    iOS: iosSettings,
  );

  await localNotifications.initialize(initSettings);

  // Create notification channel for Android
  if (Platform.isAndroid) {
    const channel = AndroidNotificationChannel(
      'petties_notifications',
      'Petties Notifications',
      description: 'Thông báo từ Petties',
      importance: Importance.high,
    );

    await localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  // Show local notification
  // Show local notification
  // FIXED: Commented out to prevent double notifications on Android.
  // When 'notification' key is present in FCM payload, Android System automatically shows notification.
  // Manual display here causes duplicates.
  /*
  if (message.notification != null) {
    const androidDetails = AndroidNotificationDetails(
      'petties_notifications',
      'Petties Notifications',
      channelDescription: 'Thông báo từ Petties',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await localNotifications.show(
      message.hashCode,
      message.notification!.title,
      message.notification!.body,
      details,
      payload: message.data.isNotEmpty ? jsonEncode(message.data) : null,
    );
  }
  */
}

/// FCM Service for handling push notifications
class FcmService {
  static final FcmService _instance = FcmService._internal();
  factory FcmService() => _instance;
  FcmService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final StorageService _storage = StorageService();

  final _messageStreamController = StreamController<RemoteMessage>.broadcast();
  Stream<RemoteMessage> get messageStream => _messageStreamController.stream;

  String? _fcmToken;

  /// Pending notification data khi context chưa ready (app từ terminated state)
  Map<String, dynamic>? _pendingNotificationData;

  StreamSubscription<RemoteMessage>? _messageOpenedAppSubscription;

  /// Initialize FCM service
  Future<void> initialize() async {
    // Request permission
    await _requestPermission();

    // Initialize local notifications
    await _initLocalNotifications();

    // Set up background handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle notification tap when app is in background
    _messageOpenedAppSubscription =
        FirebaseMessaging.onMessageOpenedApp.listen((message) {
      debugPrint('🔥 FCM onMessageOpenedApp event received!');
      _handleMessageOpenedApp(message);
    });
    debugPrint('✅ FCM onMessageOpenedApp listener registered');

    // Get initial message (when app opened from terminated state via notification)
    // KHÔNG xử lý ngay, chỉ lưu data - để app có thời gian khởi tạo router
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint(
          'Initial message saved for later processing: ${initialMessage.data}');
      _pendingNotificationData = initialMessage.data;
    }

    // Get FCM token
    await _getToken();

    // Listen for token refresh
    _messaging.onTokenRefresh.listen(_onTokenRefresh);
  }

  void dispose() {
    _messageOpenedAppSubscription?.cancel();
    _messageStreamController.close();
  }

  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    debugPrint('FCM permission: ${settings.authorizationStatus}');
  }

  Future<void> _initLocalNotifications() async {
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Create Android notification channel
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'petties_notifications',
        'Petties Notifications',
        description: 'Thông báo từ Petties',
        importance: Importance.high,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  Future<void> _getToken() async {
    try {
      _fcmToken = await _messaging.getToken();
      debugPrint('FCM Token: $_fcmToken');

      if (_fcmToken != null) {
        await _registerTokenWithBackend(_fcmToken!);
      }
    } catch (e) {
      debugPrint('Error getting FCM token: $e');
    }
  }

  void _onTokenRefresh(String token) async {
    debugPrint('FCM Token refreshed: $token');
    _fcmToken = token;
    await _registerTokenWithBackend(token);
  }

  Future<void> _registerTokenWithBackend(String fcmToken) async {
    try {
      final accessToken = await _storage.getString(AppConstants.accessTokenKey);
      if (accessToken == null) {
        debugPrint('No access token, skipping FCM registration');
        return;
      }

      final response = await http.post(
        Uri.parse('${Environment.baseUrl}/fcm/token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
        body: jsonEncode({'fcmToken': fcmToken}),
      );

      if (response.statusCode == 200) {
        debugPrint('FCM token registered with backend');
      } else {
        debugPrint('Failed to register FCM token: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error registering FCM token: $e');
    }
  }

  Future<void> unregisterToken() async {
    try {
      final accessToken = await _storage.getString(AppConstants.accessTokenKey);
      if (accessToken == null) return;

      await http.delete(
        Uri.parse('${Environment.baseUrl}/fcm/token'),
        headers: {
          'Authorization': 'Bearer $accessToken',
        },
      );
      debugPrint('FCM token unregistered from backend');
    } catch (e) {
      debugPrint('Error unregistering FCM token: $e');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('Foreground message incoming: ${message.notification?.title}');

    final notification = message.notification;
    if (notification != null) {
      _showLocalNotification(notification, message.data);
      _messageStreamController.add(message);
    }
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    debugPrint('Message opened app: ${message.data}');
    _handleNotificationNavigation(message.data);
  }

  void _onNotificationTap(NotificationResponse response) {
    debugPrint('Notification tapped: ${response.payload}');
    debugPrint('Notification action: ${response.notificationResponseType}');

    if (response.payload != null) {
      try {
        final data = jsonDecode(response.payload!) as Map<String, dynamic>;

        // Lưu pending notification data trước
        // Navigation sẽ được xử lý khi app resume và context ready
        _pendingNotificationData = data;
        debugPrint('Saved pending notification from tap: $data');

        // Thử navigate ngay nếu context available
        final context = AppRouterConfig.rootNavigatorKey.currentContext;
        if (context != null) {
          debugPrint('Context available, navigating immediately');
          _navigateToScreen(context, data);
          _pendingNotificationData = null;
        } else {
          debugPrint('Context null, will navigate when app resumes');
        }
      } catch (e) {
        debugPrint('Error parsing notification payload: $e');
      }
    }
  }

  void _handleNotificationNavigation(Map<String, dynamic> data) {
    debugPrint('Handling notification navigation: $data');
    try {
      final context = AppRouterConfig.rootNavigatorKey.currentContext;

      if (context == null) {
        debugPrint('Navigator context is null, saving pending notification');
        _pendingNotificationData = data; // Lưu lại để xử lý sau
        return;
      }

      _navigateToScreen(context, data);
    } catch (e) {
      debugPrint('Error during notification navigation: $e');
      _pendingNotificationData = data; // Lưu lại nếu có lỗi
    }
  }

  /// Tách logic navigation ra method riêng để có thể gọi lại
  void _navigateToScreen(BuildContext context, Map<String, dynamic> data) {
    final type = data['type'] as String?;

    if (type == null) {
      debugPrint('Notification type is null, navigating to notification list');
      context.push(AppRoutes.notifications);
      return;
    }

    switch (type) {
      case 'STAFF_SHIFT_ASSIGNED':
      case 'STAFF_SHIFT_UPDATED':
      case 'STAFF_SHIFT_DELETED':
        context.push(AppRoutes.staffSchedule);
        break;
      case 'BOOKING_CREATED':
      case 'BOOKING_CONFIRMED':
      case 'BOOKING_CANCELLED':
        final bookingId = data['notificationId'] ?? data['id'];
        if (bookingId != null) {
          context.push(
              AppRoutes.bookingDetails.replaceAll(':id', bookingId.toString()));
        } else {
          context.push(AppRoutes.notifications);
        }
        break;
      case 'CLINIC_VERIFIED':
      case 'APPROVED':
      case 'REJECTED':
        context.push(AppRoutes.petOwnerHome);
        break;
      case 'chat_message':
        final conversationId = data['conversationId'];
        if (conversationId != null) {
          context.push('${AppRoutes.chatDetail}?conversationId=$conversationId');
        } else {
          context.push(AppRoutes.petOwnerHome);
        }
        break;
      default:
        context.push(AppRoutes.notifications);
    }
  }

  /// Gọi method này sau khi app ready để xử lý pending notification
  void processPendingNotification() {
    if (_pendingNotificationData != null) {
      final context = AppRouterConfig.rootNavigatorKey.currentContext;
      if (context != null) {
        debugPrint(
            'Processing pending notification: $_pendingNotificationData');
        _navigateToScreen(context, _pendingNotificationData!);
        _pendingNotificationData = null;
      } else {
        debugPrint('Context still null, cannot process pending notification');
      }
    }
  }

  /// Check if có pending notification
  bool get hasPendingNotification => _pendingNotificationData != null;

  Future<void> _showLocalNotification(
      RemoteNotification notification, Map<String, dynamic>? data) async {
    const androidDetails = AndroidNotificationDetails(
      'petties_notifications',
      'Petties Notifications',
      channelDescription: 'Thông báo từ Petties',
      importance: Importance.max, // Tăng lên max
      priority: Priority.high,
      showWhen: true,
      fullScreenIntent: true, // Cho phép hiện banner đè lên ứng dụng khác
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      details,
      payload: data != null ? jsonEncode(data) : null,
    );
  }

  /// Show local notification for chat messages
  Future<void> showLocalNotification({
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'petties_notifications',
      'Petties Notifications',
      channelDescription: 'Thông báo từ Petties',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
      fullScreenIntent: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000, // Unique ID
      title,
      body,
      details,
      payload: data != null ? jsonEncode(data) : null,
    );
  }

  /// Re-register token (call after login)
  Future<void> registerAfterLogin() async {
    if (_fcmToken != null) {
      await _registerTokenWithBackend(_fcmToken!);
    } else {
      await _getToken();
    }
  }
}

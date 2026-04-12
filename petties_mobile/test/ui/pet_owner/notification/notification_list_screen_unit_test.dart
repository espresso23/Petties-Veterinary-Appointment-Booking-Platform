import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:petties_mobile/data/models/notification.dart';
import 'package:petties_mobile/providers/auth_provider.dart';
import 'package:petties_mobile/providers/notification_provider.dart';
import 'package:petties_mobile/data/models/user_response.dart';
import 'package:petties_mobile/data/models/auth_response.dart';
import 'package:petties_mobile/ui/screens/notification/notification_list_screen.dart';

class _FakeAuthProvider extends ChangeNotifier implements AuthProvider {
  UserResponse? _fakeUser;

  _FakeAuthProvider(String role) {
    _fakeUser = UserResponse(
      userId: 'u1',
      username: 'test',
      email: 'test@example.com',
      fullName: 'Test User',
      role: role,
      createdAt: '',
      updatedAt: '',
    );
  }

  @override
  UserResponse? get user => _fakeUser;

  // Stub all other methods/properties used by interface
  @override
  AuthResponse? get authResponse => null;

  @override
  bool get isAuthenticated => true;

  @override
  bool get isLoading => false;

  @override
  String? get error => null;

  @override
  Future<bool> login({required String username, required String password}) async =>
      true;

  @override
  Future<bool> register(
          {required String username,
          required String password,
          required String email,
          String? phone,
          String? avatar,
          required String role}) async =>
      true;

  @override
  Future<bool> verifyOtpAndRegister(
          {required String email, required String otpCode}) async =>
      true;

  @override
  Future<bool> signInWithGoogle() async => true;

  @override
  Future<void> logout() async {}

  @override
  Future<bool> refreshToken() async => true;

  @override
  Future<void> getCurrentUser() async {}

  @override
  void clearError() {}
}

class _FakeNotificationProvider extends ChangeNotifier
    implements NotificationProvider {
  List<NotificationModel> _items;

  _FakeNotificationProvider(this._items);

  @override
  List<NotificationModel> get notifications => _items;

  @override
  bool get isLoading => false;

  @override
  String? get error => null;

  @override
  bool get hasMore => false;

  @override
  Future<void> fetchNotifications({bool silent = false}) async {}

  @override
  Future<void> loadMore() async {}

  @override
  Future<void> markAllAsRead() async {}

  @override
  Future<void> markAsRead(String notificationId) async {}

  @override
  int get unreadCount => 0;

  @override
  void reset() {}
}

void main() {
  testWidgets(
      'tap booking notification as staff điều hướng tới màn hình staff bookings',
      (WidgetTester tester) async {
    final bookingNotification = NotificationModel(
      id: 'n1',
      type: NotificationType.BOOKING_CONFIRMED,
      message: 'Bạn được gán booking',
      isRead: false,
      createdAt: DateTime.now(),
    );

    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationListScreen(),
        ),
        GoRoute(
          path: '/staff/bookings',
          builder: (context, state) => const Scaffold(
            body: Text('STAFF_BOOKINGS_SCREEN'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>(
            create: (_) => _FakeAuthProvider('STAFF'),
          ),
          ChangeNotifierProvider<NotificationProvider>(
            create: (_) => _FakeNotificationProvider([bookingNotification]),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    await tester.pumpAndSettle();

    // Tap vào item đầu tiên
    await tester.tap(find.byType(InkWell).first);
    await tester.pumpAndSettle();

    expect(find.text('STAFF_BOOKINGS_SCREEN'), findsOneWidget);
  });
}

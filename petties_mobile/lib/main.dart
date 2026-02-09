import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'firebase_options.dart';
import 'providers/auth_provider.dart';
import 'providers/user_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/booking_wizard_provider.dart';
import 'providers/clinic_provider.dart';
import 'routing/router_config.dart' as app_router;
import 'config/theme/app_theme.dart';
import 'utils/storage_service.dart';
import 'core/services/sentry_service.dart';
import 'utils/fcm_service.dart';

import 'package:intl/date_symbol_data_local.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Global error handling
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('CRASH ERROR: ${details.exception}');
    debugPrint('CRASH STACK: ${details.stack}');
  };

  // Load environment variables from .env file
  try {
    await dotenv.load(fileName: '.env');
    debugPrint('✅ Loaded .env file');
  } catch (e) {
    debugPrint('⚠️ Could not load .env file: $e');
  }

  // Initialize date formatting for Vietnamese (fast, synchronous)
  await initializeDateFormatting('vi', null);
  await initializeDateFormatting('vi_VN', null);

  // Initialize local storage first (needed for auth)
  await StorageService().init();

  // Initialize Firebase WITHOUT background handler first
  // Background handler will be set up after first frame to avoid 20s freeze
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('Firebase initialization error: $e');
  }

  // Create providers (lightweight, just constructors)
  final authProvider = AuthProvider();
  final userProvider = UserProvider();
  final notificationProvider = NotificationProvider();
  final clinicProvider = ClinicProvider();
  final bookingWizardProvider = BookingWizardProvider();

  // Initialize Sentry and run app immediately
  // FCM and background handler will be initialized AFTER first frame renders
  await SentryService.init(() {
    runApp(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: authProvider),
          ChangeNotifierProvider.value(value: userProvider),
          ChangeNotifierProvider.value(value: notificationProvider),
          ChangeNotifierProvider.value(value: clinicProvider),
          ChangeNotifierProvider.value(value: bookingWizardProvider),
        ],
        child: PettiesApp(authProvider: authProvider),
      ),
    );

    // Defer FCM initialization AND background handler setup to after first frame
    // This prevents blocking the main thread during startup
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Set up Firebase background message handler AFTER UI renders
      // This avoids creating background Flutter Engine during startup (saves 20s)
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      
      try {
        await FcmService().initialize();
      } catch (e) {
        debugPrint('FCM initialization error: $e');
      }
    });
  });
}

class PettiesApp extends StatefulWidget {
  final AuthProvider authProvider;

  const PettiesApp({
    super.key,
    required this.authProvider,
  });

  @override
  State<PettiesApp> createState() => _PettiesAppState();
}

class _PettiesAppState extends State<PettiesApp> with WidgetsBindingObserver {
  // Create router once and cache it
  // The router uses refreshListenable to rebuild when auth state changes
  // This prevents recreating the router on every widget rebuild
  late final GoRouter _router =
      app_router.AppRouterConfig.createRouter(widget.authProvider);

  StreamSubscription<RemoteMessage>? _fcmSubscription;

  @override
  void initState() {
    super.initState();

    // Đăng ký observer để xử lý app lifecycle
    WidgetsBinding.instance.addObserver(this);

    // Listen for FCM messages in foreground to refresh notifications
    _fcmSubscription = FcmService().messageStream.listen((message) {
      if (mounted) {
        context.read<NotificationProvider>().fetchNotifications(silent: true);
      }
    });

    // Initial fetch of unread count if authenticated + process pending notification
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.authProvider.isAuthenticated) {
        context.read<NotificationProvider>().fetchNotifications(silent: true);
      }

      // Process pending notification sau khi app ready (từ terminated state)
      // Delay một chút để đảm bảo router và context đã sẵn sàng
      Future.delayed(const Duration(milliseconds: 500), () {
        if (FcmService().hasPendingNotification) {
          debugPrint('Processing pending notification after app ready');
          FcmService().processPendingNotification();
        }
      });
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    debugPrint('App lifecycle state changed: $state');

    // Khi app resumed từ background, xử lý pending notification
    if (state == AppLifecycleState.resumed) {
      Future.delayed(const Duration(milliseconds: 300), () {
        if (FcmService().hasPendingNotification) {
          debugPrint('Processing pending notification after app resumed');
          FcmService().processPendingNotification();
        }
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _fcmSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // No need to access AuthProvider here - router handles auth via refreshListenable
    return MaterialApp.router(
      title: 'Petties',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      locale: const Locale('vi', 'VN'),
      routerConfig: _router,
    );
  }
}

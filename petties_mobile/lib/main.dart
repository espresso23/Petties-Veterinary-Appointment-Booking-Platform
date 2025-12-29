import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'firebase_options.dart';
import 'providers/auth_provider.dart';
import 'providers/user_provider.dart';
import 'routing/router_config.dart' as app_router;
import 'config/theme/app_theme.dart';
import 'core/utils/storage_service.dart';
import 'core/services/sentry_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase with platform-specific options
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('Firebase initialization error: $e');
  }

  // Initialize local storage
  await StorageService().init();

  // Create AuthProvider instance (singleton)
  final authProvider = AuthProvider();

  // Create UserProvider instance
  final userProvider = UserProvider();

  // Initialize Sentry and run app
  await SentryService.init(() {
    runApp(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: authProvider),
          ChangeNotifierProvider.value(value: userProvider),
        ],
        child: PettiesApp(authProvider: authProvider),
      ),
    );
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

class _PettiesAppState extends State<PettiesApp> {
  // Create router once and cache it
  // The router uses refreshListenable to rebuild when auth state changes
  // This prevents recreating the router on every widget rebuild
  late final GoRouter _router =
      app_router.AppRouterConfig.createRouter(widget.authProvider);

  @override
  Widget build(BuildContext context) {
    // No need to access AuthProvider here - router handles auth via refreshListenable
    return MaterialApp.router(
      title: 'Petties',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: _router,
    );
  }
}

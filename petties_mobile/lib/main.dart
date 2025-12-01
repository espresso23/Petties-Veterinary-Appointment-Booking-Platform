import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'config/routes/router_config.dart' as app_router;
import 'config/theme/app_theme.dart';
import 'core/utils/storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  await Firebase.initializeApp();
  
  // Initialize local storage
  await StorageService().init();
  
  runApp(const PettiesApp());
}

class PettiesApp extends StatelessWidget {
  const PettiesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Petties',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: app_router.RouterConfig.router,
    );
  }
}

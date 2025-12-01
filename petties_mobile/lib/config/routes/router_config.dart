import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'app_routes.dart';

/// GoRouter configuration for the application
class RouterConfig {
  static final GoRouter router = GoRouter(
    initialLocation: AppRoutes.root,
    routes: [
      GoRoute(
        path: AppRoutes.root,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Splash Screen')),
        ),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Login Screen')),
        ),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Register Screen')),
        ),
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Home Screen')),
        ),
      ),
      // Add more routes as screens are implemented
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.matchedLocation}'),
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../ui/auth/login_screen.dart';
import '../ui/pet_owner/pet_owner_home_screen.dart';
import '../ui/vet/vet_home_screen.dart';
import '../ui/clinic_owner/clinic_owner_home_screen.dart';
import 'app_routes.dart';

/// GoRouter configuration for the application
/// Handles role-based routing and authentication
class AppRouterConfig {
  /// Get the appropriate home route based on user role
  /// PET_OWNER: Mobile only
  /// CLINIC_OWNER: Web + Mobile
  /// VET: Web + Mobile
  /// ADMIN: Web only (blocked on mobile)
  /// CLINIC_MANAGER: Web only (blocked on mobile)
  static String _getHomeRouteForRole(String? role) {
    switch (role) {
      case 'PET_OWNER':
        return AppRoutes.petOwnerHome;
      case 'VET':
        return AppRoutes.vetHome;
      case 'CLINIC_OWNER':
        return AppRoutes.clinicOwnerHome;
      case 'CLINIC_MANAGER':
        // CLINIC_MANAGER should not use mobile app (web only)
        return AppRoutes.login;
      case 'ADMIN':
        // ADMIN should not use mobile app (web only)
        return AppRoutes.login;
      default:
        // Default to PET_OWNER home
        return AppRoutes.petOwnerHome;
    }
  }

  static GoRouter createRouter(AuthProvider authProvider) {
    return GoRouter(
      initialLocation: AppRoutes.root,
      redirect: (context, state) {
        final isAuthenticated = authProvider.isAuthenticated;
        final userRole = authProvider.user?.role;
        final currentLocation = state.matchedLocation;
        final isLoginRoute = currentLocation == AppRoutes.login ||
            currentLocation == AppRoutes.register;

        // Block ADMIN and CLINIC_MANAGER users (mobile not supported - web only)
        if (isAuthenticated && (userRole == 'ADMIN' || userRole == 'CLINIC_MANAGER')) {
          final errorMsg = userRole == 'ADMIN' 
              ? 'admin_web_only' 
              : 'clinic_manager_web_only';
          return '${AppRoutes.login}?error=$errorMsg';
        }

        // Redirect to role-specific home if authenticated and on login/register or root
        if (isAuthenticated && (isLoginRoute || currentLocation == AppRoutes.root)) {
          return _getHomeRouteForRole(userRole);
        }

        // Redirect to login if not authenticated and not already on login/register
        if (!isAuthenticated && !isLoginRoute && currentLocation != AppRoutes.root) {
          return AppRoutes.login;
        }

        return null; // No redirect needed
      },
      routes: [
        GoRoute(
          path: AppRoutes.root,
          builder: (context, state) => const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          ),
        ),
        // Login route with error handling
        GoRoute(
          path: AppRoutes.login,
          builder: (context, state) {
            // Handle error query parameter for blocked roles
            final error = state.uri.queryParameters['error'];
            String? errorMessage;
            if (error == 'admin_web_only') {
              errorMessage = 'Tài khoản ADMIN chỉ có thể đăng nhập trên web. Vui lòng sử dụng trình duyệt để truy cập.';
            } else if (error == 'clinic_manager_web_only') {
              errorMessage = 'Tài khoản CLINIC_MANAGER chỉ có thể đăng nhập trên web. Vui lòng sử dụng trình duyệt để truy cập.';
            }
            
            return LoginScreen(
              initialErrorMessage: errorMessage,
            );
          },
        ),
        GoRoute(
          path: AppRoutes.register,
          builder: (context, state) => const Scaffold(
            body: Center(child: Text('Register Screen - Coming Soon')),
          ),
        ),
        
        // Role-specific Home Routes
        // PET_OWNER: Mobile only
        GoRoute(
          path: AppRoutes.petOwnerHome,
          builder: (context, state) => const PetOwnerHomeScreen(),
        ),
        // VET: Web + Mobile
        GoRoute(
          path: AppRoutes.vetHome,
          builder: (context, state) => const VetHomeScreen(),
        ),
        // CLINIC_OWNER: Web + Mobile
        GoRoute(
          path: AppRoutes.clinicOwnerHome,
          builder: (context, state) => const ClinicOwnerHomeScreen(),
        ),
        
        // Note: CLINIC_MANAGER and ADMIN routes are intentionally not included
        // as they are blocked by redirect logic above (web only)
        
        // Legacy home route - redirect to role-specific
        GoRoute(
          path: AppRoutes.home,
          redirect: (context, state) {
            final userRole = authProvider.user?.role;
            return _getHomeRouteForRole(userRole);
          },
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        body: Center(
          child: Text('Page not found: ${state.matchedLocation}'),
        ),
      ),
      refreshListenable: authProvider, // Rebuild router when auth state changes
    );
  }
}

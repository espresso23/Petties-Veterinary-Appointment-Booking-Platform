import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../ui/auth/login_screen.dart';
import '../ui/onboarding/onboarding_screen.dart';
import '../ui/pet_owner/pet_owner_home_screen.dart';
import '../ui/vet/vet_home_screen.dart';
import 'app_routes.dart';

/// GoRouter configuration for the application
/// Handles role-based routing and authentication
/// 
/// Mobile App Roles:
/// - PET_OWNER: ✅ Mobile only
/// - VET: ✅ Mobile + Web
/// - CLINIC_OWNER: ❌ Web only (blocked on mobile)
/// - CLINIC_MANAGER: ❌ Web only (blocked on mobile)
/// - ADMIN: ❌ Web only (blocked on mobile)
class AppRouterConfig {
  /// Get the appropriate home route based on user role
  /// Only PET_OWNER and VET are allowed on mobile
  static String _getHomeRouteForRole(String? role) {
    switch (role) {
      case 'PET_OWNER':
        return AppRoutes.petOwnerHome;
      case 'VET':
        return AppRoutes.vetHome;
      case 'CLINIC_OWNER':
        // CLINIC_OWNER should not use mobile app (web only)
        return AppRoutes.login;
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
      initialLocation: AppRoutes.onboarding,
      redirect: (context, state) {
        final isAuthenticated = authProvider.isAuthenticated;
        final userRole = authProvider.user?.role;
        final currentLocation = state.matchedLocation;
        final isLoginRoute = currentLocation == AppRoutes.login ||
            currentLocation == AppRoutes.register;
        final isOnboardingRoute = currentLocation == AppRoutes.onboarding;

        // If user is on login/register page and not authenticated, stay there (no redirect)
        // This prevents reload when login fails
        if (isLoginRoute && !isAuthenticated) {
          return null;
        }

        // Block ADMIN, CLINIC_MANAGER, and CLINIC_OWNER users (mobile not supported - web only)
        if (isAuthenticated && 
            (userRole == 'ADMIN' || userRole == 'CLINIC_MANAGER' || userRole == 'CLINIC_OWNER')) {
          String errorMsg;
          switch (userRole) {
            case 'ADMIN':
              errorMsg = 'admin_web_only';
              break;
            case 'CLINIC_MANAGER':
              errorMsg = 'clinic_manager_web_only';
              break;
            case 'CLINIC_OWNER':
              errorMsg = 'clinic_owner_web_only';
              break;
            default:
              errorMsg = 'web_only';
          }
          return '${AppRoutes.login}?error=$errorMsg';
        }

        // Redirect to role-specific home if authenticated and on login/register/onboarding or root
        if (isAuthenticated && (isLoginRoute || isOnboardingRoute || currentLocation == AppRoutes.root)) {
          return _getHomeRouteForRole(userRole);
        }

        // Redirect to login if not authenticated and not already on login/register/onboarding
        if (!isAuthenticated && !isLoginRoute && !isOnboardingRoute && currentLocation != AppRoutes.root) {
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
        // Onboarding route
        GoRoute(
          path: AppRoutes.onboarding,
          builder: (context, state) => const OnboardingScreen(),
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
            } else if (error == 'clinic_owner_web_only') {
              errorMessage = 'Tài khoản CLINIC_OWNER chỉ có thể đăng nhập trên web. Vui lòng sử dụng trình duyệt để truy cập.';
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
        
        // Note: CLINIC_OWNER, CLINIC_MANAGER and ADMIN routes are intentionally not included
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


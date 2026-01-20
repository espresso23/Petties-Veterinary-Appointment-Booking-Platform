import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../ui/auth/login_screen.dart';
import '../ui/auth/register_screen.dart';
import '../ui/auth/forgot_password_screen.dart';
import '../ui/auth/reset_password_screen.dart';
import '../ui/onboarding/onboarding_screen.dart';
import '../ui/pet_owner/pet_owner_home_screen.dart';
import '../ui/vet/vet_home_screen.dart';
import '../ui/vet/vet_schedule_screen.dart';
import '../ui/vet/vet_booking_detail_screen.dart';
import '../ui/vet/patient/patient_screens.dart';
import '../ui/vet/emr/create_emr_screen.dart';
import '../ui/vet/emr/emr_detail_screen.dart';
import '../ui/vet/emr/edit_emr_screen.dart';
import '../ui/screens/profile/profile_screen.dart';
import '../ui/screens/profile/edit_profile_screen.dart';
import '../ui/screens/profile/change_password_screen.dart';
import '../ui/pet/pet_list_screen.dart';
import '../ui/pet/add_edit_pet_screen.dart';
import '../ui/pet/pet_detail_screen.dart';
import '../ui/screens/notification/notification_list_screen.dart';
import '../ui/chat/chat_list_screen.dart';
import '../ui/chat/chat_detail_screen.dart';
import '../ui/clinics/clinic_search_view.dart';
import '../ui/clinics/clinic_detail_view.dart';
import '../ui/clinics/clinic_map_view.dart';

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
  static final GlobalKey<NavigatorState> rootNavigatorKey =
      GlobalKey<NavigatorState>();

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
      navigatorKey: rootNavigatorKey,
      initialLocation: AppRoutes.root,
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
            (userRole == 'ADMIN' ||
                userRole == 'CLINIC_MANAGER' ||
                userRole == 'CLINIC_OWNER')) {
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
        if (isAuthenticated &&
            (isLoginRoute ||
                isOnboardingRoute ||
                currentLocation == AppRoutes.root)) {
          return _getHomeRouteForRole(userRole);
        }

        final isAuthRoute = isLoginRoute ||
            currentLocation == AppRoutes.forgotPassword ||
            currentLocation == AppRoutes.resetPassword;

        // Redirect to login if not authenticated and not on an allowed public route
        // THIS INCLUDES ROOT ROUTE - user should not stay on loading screen forever
        if (!isAuthenticated && !isAuthRoute && !isOnboardingRoute) {
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
              errorMessage =
                  'Tài khoản ADMIN chỉ có thể đăng nhập trên web. Vui lòng sử dụng trình duyệt để truy cập.';
            } else if (error == 'clinic_manager_web_only') {
              errorMessage =
                  'Tài khoản CLINIC_MANAGER chỉ có thể đăng nhập trên web. Vui lòng sử dụng trình duyệt để truy cập.';
            } else if (error == 'clinic_owner_web_only') {
              errorMessage =
                  'Tài khoản CLINIC_OWNER chỉ có thể đăng nhập trên web. Vui lòng sử dụng trình duyệt để truy cập.';
            }

            return LoginScreen(
              initialErrorMessage: errorMessage,
            );
          },
        ),
        GoRoute(
          path: AppRoutes.register,
          builder: (context, state) => const RegisterScreen(),
        ),
        // Forgot Password route
        GoRoute(
          path: AppRoutes.forgotPassword,
          builder: (context, state) => const ForgotPasswordScreen(),
        ),
        // Reset Password route
        GoRoute(
          path: AppRoutes.resetPassword,
          builder: (context, state) {
            final email = state.uri.queryParameters['email'] ?? '';
            final cooldownStr = state.uri.queryParameters['cooldown'];
            final cooldown =
                cooldownStr != null ? int.tryParse(cooldownStr) : null;
            return ResetPasswordScreen(
              email: email,
              initialCooldown: cooldown,
            );
          },
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
        GoRoute(
          path: AppRoutes.vetSchedule,
          builder: (context, state) => const VetScheduleScreen(),
        ),

        // VET Booking Detail Route (from HEAD)
        GoRoute(
          path: AppRoutes.vetBookingDetail,
          builder: (context, state) {
            final bookingId = state.pathParameters['bookingId']!;
            return VetBookingDetailScreen(bookingId: bookingId);
          },
        ),

        // VET Patient Routes (from intergrationFeature)
        GoRoute(
          path: AppRoutes.vetPatients,
          builder: (context, state) => const PatientListScreen(),
        ),

        // VET EMR Routes (from intergrationFeature)
        GoRoute(
          path: AppRoutes.vetCreateEmr,
          builder: (context, state) {
            final petId = state.pathParameters['petId']!;
            final petName = state.uri.queryParameters['petName'];
            final petSpecies = state.uri.queryParameters['petSpecies'];
            return CreateEmrScreen(
              petId: petId,
              petName: petName,
              petSpecies: petSpecies,
            );
          },
        ),
        GoRoute(
          path: AppRoutes.vetEmrDetail,
          builder: (context, state) {
            final emrId = state.pathParameters['emrId']!;
            return EmrDetailScreen(emrId: emrId);
          },
        ),
        GoRoute(
          path: AppRoutes.vetEmrEdit,
          builder: (context, state) {
            final emrId = state.pathParameters['emrId']!;
            return EditEmrScreen(emrId: emrId);
          },
        ),

        // Clinic routes (from intergrationFeature)
        GoRoute(
          path: AppRoutes.clinicSearch,
          builder: (context, state) => const ClinicSearchView(),
        ),
        // Map route must come BEFORE detail route (more specific first)
        GoRoute(
          path: AppRoutes.clinicMap,
          builder: (context, state) => const ClinicMapView(),
        ),
        GoRoute(
          path: AppRoutes.clinicDetail,
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return ClinicDetailView(clinicId: id);
          },
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

        // Profile Routes (available for PET_OWNER and VET)
        GoRoute(
          path: AppRoutes.profile,
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: AppRoutes.editProfile,
          builder: (context, state) => const EditProfileScreen(),
        ),
        GoRoute(
          path: AppRoutes.changePassword,
          builder: (context, state) => const ChangePasswordScreen(),
        ),

        // Pet Management Routes
        GoRoute(
          path: AppRoutes.myPets,
          builder: (context, state) => const PetListScreen(),
        ),
        GoRoute(
          path: AppRoutes.addPet,
          builder: (context, state) => const AddEditPetScreen(),
        ),
        GoRoute(
          path: AppRoutes.petDetails,
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return PetDetailScreen(id: id);
          },
        ),
        GoRoute(
          path: AppRoutes.editPet,
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return AddEditPetScreen(id: id);
          },
        ),
        GoRoute(
          path: AppRoutes.notifications,
          builder: (context, state) => const NotificationListScreen(),
        ),

        // Chat Routes
        GoRoute(
          path: AppRoutes.chatList,
          builder: (context, state) => const ChatListScreen(),
        ),
        GoRoute(
          path: AppRoutes.chatDetail,
          builder: (context, state) {
            final conversationId = state.uri.queryParameters['conversationId'];
            final clinicId = state.uri.queryParameters['clinicId'];
            return ChatDetailScreen(
              conversationId: conversationId,
              clinicId: clinicId,
            );
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

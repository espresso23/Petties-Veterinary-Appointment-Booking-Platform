/// Application route names
class AppRoutes {
  AppRoutes._();

  // Root
  static const String root = '/';

  // Authentication
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';

  // Main Navigation
  static const String home = '/home';
  static const String explore = '/explore';
  static const String bookings = '/bookings';
  static const String profile = '/profile';

  // Booking Flow
  static const String clinicDetails = '/clinic/:id';
  static const String selectService = '/booking/select-service';
  static const String selectDateTime = '/booking/select-datetime';
  static const String bookingConfirmation = '/booking/confirmation';
  static const String bookingDetails = '/booking/:id';

  // Profile & Settings
  static const String editProfile = '/profile/edit';
  static const String settings = '/settings';
  static const String notifications = '/notifications';
  static const String paymentMethods = '/payment-methods';
  static const String bookingHistory = '/booking-history';

  // Pet Management
  static const String myPets = '/pets';
  static const String addPet = '/pets/add';
  static const String editPet = '/pets/:id/edit';
  static const String petDetails = '/pets/:id';

  // Other
  static const String aboutUs = '/about';
  static const String termsOfService = '/terms';
  static const String privacyPolicy = '/privacy';
  static const String help = '/help';
}

/// Application route names
class AppRoutes {
  AppRoutes._();

  // Root
  static const String root = '/';
  static const String onboarding = '/onboarding';

  // Authentication
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';

  // Main Navigation (Legacy - keep for backward compatibility)
  static const String home = '/home';
  static const String explore = '/explore';
  static const String bookings = '/bookings';
  static const String profile = '/profile';

  // Role-specific Home Routes (Mobile only: PET_OWNER, STAFF)
  static const String petOwnerHome = '/pet-owner/home';
  static const String staffHome = '/staff/home';
  static const String staffSchedule = '/staff/schedule';
  static const String staffBookings = '/staff/bookings';
  static const String staffBookingDetail = '/staff/booking/:bookingId';
  static const String staffAddService = '/staff/booking/:bookingId/add-service';

  // STAFF Patient Routes
  static const String staffPatients = '/staff/patients';
  static const String staffPatientDetail = '/staff/patients/:petId';
  static const String staffVaccinationForm =
      '/staff/patients/:petId/vaccination/add';

  // STAFF EMR Routes
  static const String staffCreateEmr = '/staff/emr/create/:petId';
  static const String staffEmrDetail = '/staff/emr/:emrId';
  static const String staffEmrEdit = '/staff/emr/edit/:emrId';
  static const String clinicSearch = '/clinics/search';
  static const String clinicDetail = '/clinics/:id';
  static const String clinicMap = '/clinics/map';
  static const String clinicAllServices = '/clinics/:id/services';

  // Booking Flow (Pet Owner)
  static const String bookingSelectPet = '/booking/:clinicId/pet';
  static const String bookingSelectServices = '/booking/:clinicId/services';
  static const String bookingSelectDateTime = '/booking/datetime';
  static const String bookingConfirm = '/booking/confirm';
  static const String bookingSuccess = '/booking/success';
  static const String bookingDetails = '/booking/:id';

  // Profile & Settings
  static const String editProfile = '/profile/edit';
  static const String changePassword = '/profile/change-password';
  static const String settings = '/settings';
  static const String notifications = '/notifications';
  static const String paymentMethods = '/payment-methods';
  static const String bookingHistory = '/booking-history';

  // Pet Management
  static const String myPets = '/pets';
  static const String addPet = '/pets/add';
  static const String editPet = '/pets/:id/edit';
  static const String petDetails = '/pets/:id';
  static const String petHealthRecord = '/pets/:id/health-record';

  // Chat
  static const String chatList = '/chat';
  static const String chatDetail = '/chat/detail';

  // Other
  static const String aboutUs = '/about';
  static const String termsOfService = '/terms';
  static const String privacyPolicy = '/privacy';
  static const String help = '/help';
}

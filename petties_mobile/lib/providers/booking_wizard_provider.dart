import 'dart:math';
import 'package:flutter/foundation.dart';
import '../data/models/clinic.dart';
import '../data/models/clinic_service.dart';
import '../data/models/pet.dart';
import '../data/services/booking_wizard_service.dart';

/// Booking type enum
enum BookingType { atClinic, homeVisit }

/// Provider for booking wizard state management
class BookingWizardProvider extends ChangeNotifier {
  final BookingWizardService _bookingService;

  // Clinic info
  Clinic? _clinic;
  String? _userAddress;
  double? _userLatitude;
  double? _userLongitude;

  // Step 1: Pet & Booking Type
  List<Pet> _myPets = [];
  Pet? _selectedPet;
  BookingType _bookingType = BookingType.atClinic;

  // Step 2: Services
  List<ClinicServiceModel> _availableServices = [];
  List<ClinicServiceModel> _selectedServices = [];
  String _notes = '';

  // Step 3: Date & Time
  DateTime? _selectedDate;
  String? _selectedTime; // Start time of the booking
  List<String> _selectedTimeSlots = []; // All selected time slots (for multi-slot bookings)
  List<AvailableSlot> _availableSlots = [];
  String? _bookingError;

  // Loading states
  bool _isLoadingPets = false;
  bool _isLoadingServices = false;
  bool _isLoadingSlots = false;
  bool _isCreatingBooking = false;
  String? _error;

  BookingWizardProvider({BookingWizardService? bookingService})
      : _bookingService = bookingService ?? BookingWizardService();

  // Getters
  Clinic? get clinic => _clinic;
  String? get userAddress => _userAddress;
  double? get userLatitude => _userLatitude;
  double? get userLongitude => _userLongitude;

  List<Pet> get myPets => _myPets;
  Pet? get selectedPet => _selectedPet;
  BookingType get bookingType => _bookingType;

  List<ClinicServiceModel> get availableServices => _availableServices;
  List<ClinicServiceModel> get selectedServices => _selectedServices;
  String get notes => _notes;

  DateTime? get selectedDate => _selectedDate;
  String? get selectedTime => _selectedTime;
  List<String> get selectedTimeSlots => _selectedTimeSlots;
  List<AvailableSlot> get availableSlots => _availableSlots;
  String? get bookingError => _bookingError;

  bool get isLoadingPets => _isLoadingPets;
  bool get isLoadingServices => _isLoadingServices;
  bool get isLoadingSlots => _isLoadingSlots;
  bool get isCreatingBooking => _isCreatingBooking;
  String? get error => _error;

  /// Calculate total price (with weight-based surcharge)
  double get totalPrice {
    double total = 0;
    final petWeight = _selectedPet?.weight ?? 0;
    for (final service in _selectedServices) {
      total += service.getPriceForWeight(petWeight);
    }
    // Add distance fee for home visit
    total += distanceFee;
    return total;
  }

  /// Calculate distance fee for home visit booking
  double get distanceFee {
    if (_bookingType != BookingType.homeVisit) return 0;

    // Get distance from clinic (in km) - use clinic.distance or calculate
    final distance = _getDistanceToClinic();
    if (distance <= 0) return 0;

    // Get max pricePerKm from selected home visit services
    double maxPricePerKm = 0;
    for (final service in _selectedServices) {
      if (service.isHomeVisit && service.pricePerKm != null) {
        if (service.pricePerKm! > maxPricePerKm) {
          maxPricePerKm = service.pricePerKm!;
        }
      }
    }

    return distance * maxPricePerKm;
  }

  /// Get distance to clinic in km
  double _getDistanceToClinic() {
    // Try clinic.distance first (from API)
    if (_clinic?.distance != null && _clinic!.distance! > 0) {
      return _clinic!.distance!;
    }

    // Calculate distance if we have both user and clinic coordinates
    if (_userLatitude != null &&
        _userLongitude != null &&
        _clinic?.latitude != null &&
        _clinic?.longitude != null) {
      return _calculateDistance(
        _userLatitude!,
        _userLongitude!,
        _clinic!.latitude!,
        _clinic!.longitude!,
      );
    }

    return 0;
  }

  /// Calculate distance between two points using Haversine formula (returns km)
  double _calculateDistance(
      double lat1, double lon1, double lat2, double lon2) {
    const double earthRadius = 6371; // km
    final double dLat = _toRadians(lat2 - lat1);
    final double dLon = _toRadians(lon2 - lon1);
    final double a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  double _toRadians(double degree) => degree * pi / 180;

  /// Get calculated distance for display
  double get distanceToClinic => _getDistanceToClinic();

  /// Check if booking has home visit services
  bool get hasHomeVisitServices {
    return _selectedServices.any((s) => s.isHomeVisit);
  }

  /// Calculate total duration
  int get totalDuration {
    int total = 0;
    for (final service in _selectedServices) {
      total += service.durationMinutes;
    }
    return total;
  }

  /// Check if can proceed to next step
  bool get canProceedToServices => _selectedPet != null;
  bool get canProceedToDateTime => _selectedServices.isNotEmpty;
  bool get canConfirmBooking =>
      _selectedPet != null &&
      _selectedServices.isNotEmpty &&
      _selectedDate != null &&
      _selectedTime != null;

  /// Initialize booking with clinic info
  void initBooking({
    required Clinic clinic,
    String? userAddress,
    double? userLatitude,
    double? userLongitude,
  }) {
    _clinic = clinic;
    _userAddress = userAddress;
    _userLatitude = userLatitude;
    _userLongitude = userLongitude;
    _reset();
    notifyListeners();
  }

  /// Initialize booking with pre-selected services and pet (for quick booking from All Services screen)
  void initBookingWithPreselectedServices({
    required Clinic clinic,
    required Pet pet,
    required List<ClinicServiceModel> preselectedServices,
    BookingType? bookingType,
    String? userAddress,
    double? userLatitude,
    double? userLongitude,
  }) {
    _clinic = clinic;
    _userAddress = userAddress;
    _userLatitude = userLatitude;
    _userLongitude = userLongitude;
    _selectedPet = pet;
    _selectedServices = List.from(preselectedServices);
    _bookingType = bookingType ?? BookingType.atClinic;
    _notes = '';
    _selectedDate = null;
    _selectedTime = null;
    _availableSlots = [];
    _error = null;
    _bookingError = null;
    notifyListeners();
    // Load all available services for clinic (to show in services screen)
    loadServices();
  }

  /// Update user location (for home visit booking)
  void updateUserLocation({
    required String address,
    required double latitude,
    required double longitude,
  }) {
    _userAddress = address;
    _userLatitude = latitude;
    _userLongitude = longitude;
    notifyListeners();
  }


  /// Load user's pets
  Future<void> loadMyPets() async {
    if (_isLoadingPets) return;

    _isLoadingPets = true;
    _error = null;
    notifyListeners();

    try {
      _myPets = await _bookingService.getMyPets();
    } catch (e) {
      _error = 'Không thể tải danh sách thú cưng';
      debugPrint('Error loading pets: $e');
    } finally {
      _isLoadingPets = false;
      notifyListeners();
    }
  }

  /// Select pet
  void selectPet(Pet pet) {
    _selectedPet = pet;
    notifyListeners();
  }

  /// Set booking type
  void setBookingType(BookingType type) {
    _bookingType = type;
    // Reset services when type changes
    _selectedServices = [];
    notifyListeners();
    // Reload services filtered by type
    loadServices();
  }

  /// Load available services for clinic
  Future<void> loadServices() async {
    if (_clinic == null || _isLoadingServices) return;

    _isLoadingServices = true;
    _error = null;
    notifyListeners();

    try {
      final services =
          await _bookingService.getClinicServices(_clinic!.clinicId);
      // Filter by booking type
      if (_bookingType == BookingType.homeVisit) {
        _availableServices =
            services.where((s) => s.isHomeVisit && s.isActive).toList();
      } else {
        _availableServices = services.where((s) => s.isActive).toList();
      }
    } catch (e) {
      _error = 'Không thể tải danh sách dịch vụ';
      debugPrint('Error loading services: $e');
    } finally {
      _isLoadingServices = false;
      notifyListeners();
    }
  }

  /// Toggle service selection
  void toggleService(ClinicServiceModel service) {
    if (_selectedServices.any((s) => s.serviceId == service.serviceId)) {
      _selectedServices.removeWhere((s) => s.serviceId == service.serviceId);
    } else {
      _selectedServices.add(service);
    }
    _bookingError = null;
    notifyListeners();
  }

  /// Check if service is selected
  bool isServiceSelected(String serviceId) {
    return _selectedServices.any((s) => s.serviceId == serviceId);
  }

  /// Set notes
  void setNotes(String notes) {
    _notes = notes;
    notifyListeners();
  }

  /// Select date
  void selectDate(DateTime date) {
    _selectedDate = date;
    _selectedTime = null;
    _selectedTimeSlots = [];
    _availableSlots = [];
    _bookingError = null;
    notifyListeners();
    // Load available slots for selected date
    loadAvailableSlots();
  }

  /// Load available slots for selected date
  Future<void> loadAvailableSlots() async {
    debugPrint(
        'DEBUG loadAvailableSlots: clinic=${_clinic?.clinicId}, date=$_selectedDate, services=${_selectedServices.length}');
    if (_clinic == null || _selectedDate == null || _selectedServices.isEmpty) {
      debugPrint('DEBUG loadAvailableSlots: Early return - missing data');
      return;
    }
    if (_isLoadingSlots) return;

    _isLoadingSlots = true;
    _error = null;
    notifyListeners();

    try {
      final serviceIds = _selectedServices.map((s) => s.serviceId).toList();

      // Get available slots from API
      final apiSlots = await _bookingService.getAvailableSlots(
        clinicId: _clinic!.clinicId,
        date: _selectedDate!,
        serviceIds: serviceIds,
      );

      // Generate all slots for the day and merge with API response
      _availableSlots = _generateDaySlots(apiSlots);
      debugPrint(
          'DEBUG: API returned ${apiSlots.length} slots, generated ${_availableSlots.length} total slots');
      debugPrint(
          'DEBUG: Available slots count: ${_availableSlots.where((s) => s.available).length}');
    } catch (e) {
      _error = 'Không thể tải khung giờ khả dụng';
      debugPrint('Error loading slots: $e');
      // Still generate slots with default schedule on error
      _availableSlots = _generateDaySlots([]);
      debugPrint(
          'DEBUG: Generated ${_availableSlots.length} slots on error, available: ${_availableSlots.where((s) => s.available).length}');
    } finally {
      _isLoadingSlots = false;
      notifyListeners();
    }
  }

  /// Generate all time slots for a day based on clinic operating hours
  /// Marks break time and merges with available slots from API
  List<AvailableSlot> _generateDaySlots(List<AvailableSlot> apiAvailableSlots) {
    // Default clinic operating hours (can be from clinic data later)
    const String openTime = '08:00';
    const String closeTime = '18:00';
    const String breakStart = '12:00';
    const String breakEnd = '13:30';
    const int slotDurationMinutes = 30;

    final List<AvailableSlot> allSlots = [];
    final availableTimeSet = apiAvailableSlots.map((s) => s.startTime).toSet();

    // If API returns empty, assume all non-break slots are available
    // If API returns slots, only those are available (others are booked)
    final bool apiHasData = apiAvailableSlots.isNotEmpty;

    // Parse times
    final openHour = int.parse(openTime.split(':')[0]);
    final openMinute = int.parse(openTime.split(':')[1]);
    final closeHour = int.parse(closeTime.split(':')[0]);
    final closeMinute = int.parse(closeTime.split(':')[1]);
    final breakStartHour = int.parse(breakStart.split(':')[0]);
    final breakStartMinute = int.parse(breakStart.split(':')[1]);
    final breakEndHour = int.parse(breakEnd.split(':')[0]);
    final breakEndMinute = int.parse(breakEnd.split(':')[1]);

    // Generate slots from open to close
    int currentHour = openHour;
    int currentMinute = openMinute;

    while (currentHour < closeHour ||
        (currentHour == closeHour && currentMinute < closeMinute)) {
      final timeStr =
          '${currentHour.toString().padLeft(2, '0')}:${currentMinute.toString().padLeft(2, '0')}';

      // Check if this is break time
      final isInBreakTime = _isTimeInRange(
        currentHour,
        currentMinute,
        breakStartHour,
        breakStartMinute,
        breakEndHour,
        breakEndMinute,
      );

      if (isInBreakTime) {
        allSlots.add(AvailableSlot.breakTime(timeStr, reason: 'Giờ nghỉ trưa'));
      } else if (!apiHasData) {
        // API returned empty - assume all slots are available
        allSlots.add(AvailableSlot(startTime: timeStr, available: true));
      } else if (availableTimeSet.contains(timeStr)) {
        // Available slot from API
        allSlots.add(AvailableSlot(startTime: timeStr, available: true));
      } else {
        // Not available (booked - slot not in API available list)
        allSlots.add(AvailableSlot.booked(timeStr));
      }

      // Move to next slot
      currentMinute += slotDurationMinutes;
      if (currentMinute >= 60) {
        currentMinute -= 60;
        currentHour++;
      }
    }

    return allSlots;
  }

  /// Check if a time is within a range
  bool _isTimeInRange(
    int hour,
    int minute,
    int startHour,
    int startMinute,
    int endHour,
    int endMinute,
  ) {
    final timeInMinutes = hour * 60 + minute;
    final startInMinutes = startHour * 60 + startMinute;
    final endInMinutes = endHour * 60 + endMinute;
    return timeInMinutes >= startInMinutes && timeInMinutes < endInMinutes;
  }

  /// Select time slot and auto-select consecutive slots based on total duration
  void selectTime(String time) {
    // Calculate number of slots needed (each slot is 30 minutes)
    final int slotsNeeded = (totalDuration / 30).ceil();
    
    // Find the index of the selected slot
    final int startIndex = _availableSlots.indexWhere((slot) => slot.startTime == time);
    if (startIndex == -1) {
      debugPrint('Selected slot not found in available slots');
      return;
    }
    
    // Check if we have enough consecutive available slots
    final List<String> requiredSlots = [];
    for (int i = 0; i < slotsNeeded; i++) {
      final int slotIndex = startIndex + i;
      
      // Check if slot exists
      if (slotIndex >= _availableSlots.length) {
        _bookingError = 'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.';
        notifyListeners();
        // Auto-clear error after 2 seconds
        Future.delayed(const Duration(seconds: 2), () {
          if (_bookingError == 'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.') {
            _bookingError = null;
            notifyListeners();
          }
        });
        return;
      }
      
      final slot = _availableSlots[slotIndex];
      
      // Check if slot is available
      if (!slot.available) {
        if (slot.isBreakTime) {
          _bookingError = 'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.';
        } else {
          _bookingError = 'Một số khung giờ cần thiết đã được đặt. Vui lòng chọn khung giờ khác.';
        }
        notifyListeners();
        // Auto-clear error after 2 seconds
        Future.delayed(const Duration(seconds: 2), () {
          if (_bookingError == 'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.' || 
              _bookingError == 'Một số khung giờ cần thiết đã được đặt. Vui lòng chọn khung giờ khác.') {
            _bookingError = null;
            notifyListeners();
          }
        });
        return;
      }
      
      requiredSlots.add(slot.startTime);
    }
    
    // All slots are available, proceed with selection
    _selectedTime = time;
    _selectedTimeSlots = requiredSlots;
    _bookingError = null;
    
    debugPrint('Auto-selected $slotsNeeded slots: $requiredSlots');
    notifyListeners();
  }

  /// Clear booking error
  void clearBookingError() {
    _bookingError = null;
    notifyListeners();
  }

  /// Create booking
  Future<bool> createBooking() async {
    if (!canConfirmBooking || _clinic == null) return false;
    if (_isCreatingBooking) return false;

    _isCreatingBooking = true;
    _bookingError = null;
    notifyListeners();

    try {
      await _bookingService.createBooking(
        petId: _selectedPet!.id,
        clinicId: _clinic!.clinicId,
        bookingDate: _selectedDate!,
        bookingTime: _selectedTime!,
        bookingType:
            _bookingType == BookingType.homeVisit ? 'HOME_VISIT' : 'IN_CLINIC',
        serviceIds: _selectedServices.map((s) => s.serviceId).toList(),
        notes: _notes.isNotEmpty ? _notes : null,
        homeAddress:
            _bookingType == BookingType.homeVisit ? _userAddress : null,
        homeLat: _bookingType == BookingType.homeVisit ? _userLatitude : null,
        homeLong: _bookingType == BookingType.homeVisit ? _userLongitude : null,
        distanceKm:
            _bookingType == BookingType.homeVisit ? distanceToClinic : null,
      );
      return true;
    } catch (e) {
      // Hiển thị message lỗi từ backend nếu có
      _bookingError = e.toString();
      debugPrint('Error creating booking: $e');
      return false;
    } finally {
      _isCreatingBooking = false;
      notifyListeners();
    }
  }

  /// Reset all state
  void _reset() {
    _selectedPet = null;
    _bookingType = BookingType.atClinic;
    _availableServices = [];
    _selectedServices = [];
    _notes = '';
    _selectedDate = null;
    _selectedTime = null;
    _selectedTimeSlots = [];
    _availableSlots = [];
    _error = null;
    _bookingError = null;
  }

  /// Reset booking (public method)
  void resetBooking() {
    _clinic = null;
    _userAddress = null;
    _userLatitude = null;
    _userLongitude = null;
    _myPets = [];
    _reset();
    notifyListeners();
  }

  /// Clear all data
  void clear() {
    resetBooking();
  }
}

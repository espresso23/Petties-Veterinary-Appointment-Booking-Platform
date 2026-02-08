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
  final List<Pet> _selectedPets = []; // Multi-pet selection
  BookingType _bookingType = BookingType.atClinic;

  // Step 2: Services
  List<ClinicServiceModel> _availableServices = [];
  // Key: petId, Value: List of services for that pet
  final Map<String, List<ClinicServiceModel>> _petServices = {};
  String _notes = '';

  // Track which pet is currently being selected for services
  String? _currentPetIdForServiceSelection;

  // Step 3: Date & Time
  DateTime? _selectedDate;
  String? _selectedTime; // Start time of the booking
  List<String> _selectedTimeSlots =
      []; // All selected time slots (for multi-slot bookings)
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
  List<Pet> get selectedPets => _selectedPets;
  BookingType get bookingType => _bookingType;

  List<ClinicServiceModel> get availableServices => _availableServices;
  Map<String, List<ClinicServiceModel>> get petServices => _petServices;
  String get notes => _notes;

  String? get currentPetIdForServiceSelection =>
      _currentPetIdForServiceSelection;

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

  /// Calculate total price (sum of all pets' services + distance fee)
  double get totalPrice {
    double total = 0;

    for (final pet in _selectedPets) {
      final services = _petServices[pet.id] ?? [];
      for (final service in services) {
        total += service.getPriceForWeight(pet.weight);
      }
    }

    // Add distance fee for home visit
    total += distanceFee;
    return total;
  }

  /// Calculate distance fee for home visit booking
  double get distanceFee {
    if (_bookingType != BookingType.homeVisit) return 0;

    // Get distance from clinic (in km)
    final distance = _getDistanceToClinic();
    if (distance <= 0) return 0;

    const double defaultPricePerKm = 5000; // VND/km estimate
    return distance * defaultPricePerKm;
  }

  /// Get distance to clinic in km
  double _getDistanceToClinic() {
    if (_clinic?.distance != null && _clinic!.distance! > 0) {
      return _clinic!.distance!;
    }

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

  /// Check if booking has home visit services (in ANY pet)
  bool get hasHomeVisitServices {
    for (final services in _petServices.values) {
      if (services.any((s) => s.isHomeVisit)) return true;
    }
    return false;
  }

  /// Calculate total duration (sum of all services from all pets)
  int get totalDuration {
    int total = 0;
    for (final services in _petServices.values) {
      for (final service in services) {
        total += service.durationMinutes;
      }
    }
    return total;
  }

  /// Check if can proceed to next step
  bool get canProceedToServices => _selectedPets.isNotEmpty;

  // Proceed to datetime if AT LEAST one service is selected (across all pets)
  // Or should we enforce at least one service PER PET?
  // User req: "Mỗi thú cưng trong đơn có thể chọn một hoặc nhiều dịch vụ." -> Implies > 0.
  // Let's enforce: Every selected pet must have at least one service.
  bool get canProceedToDateTime {
    if (_selectedPets.isEmpty) return false;
    for (final pet in _selectedPets) {
      final services = _petServices[pet.id];
      if (services == null || services.isEmpty) return false;
    }
    return true;
  }

  bool get canConfirmBooking =>
      canProceedToDateTime && _selectedDate != null && _selectedTime != null;

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
    _selectedPets.clear();
    _selectedPets.add(pet);
    _petServices.clear();
    _petServices[pet.id] = List.from(preselectedServices);
    _bookingType = bookingType ?? BookingType.atClinic;
    _notes = '';
    _selectedDate = null;
    _selectedTime = null;
    _availableSlots = [];
    _error = null;
    _bookingError = null;

    // Set current pet for service selection
    _currentPetIdForServiceSelection = pet.id;

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

  /// Toggle pet selection (Multi-select)
  void togglePetSelection(Pet pet) {
    // Check if exists
    final index = _selectedPets.indexWhere((p) => p.id == pet.id);
    if (index >= 0) {
      // Remove
      _selectedPets.removeAt(index);
      _petServices.remove(pet.id);

      // If we removed the currently viewed pet, switch view to another
      if (_currentPetIdForServiceSelection == pet.id) {
        _currentPetIdForServiceSelection =
            _selectedPets.isNotEmpty ? _selectedPets.first.id : null;
      }
    } else {
      // Add
      _selectedPets.add(pet);
      _petServices[pet.id] = []; // Init empty service list

      // If first pet, set as current view
      if (_selectedPets.length == 1) {
        _currentPetIdForServiceSelection = pet.id;
      }
    }
    notifyListeners();
  }

  /// Set current pet for service selection UI
  void setCurrentPetForServiceSelection(String petId) {
    if (_selectedPets.any((p) => p.id == petId)) {
      _currentPetIdForServiceSelection = petId;
      notifyListeners();
    }
  }

  /// Set booking type
  void setBookingType(BookingType type) {
    _bookingType = type;
    // Reset ALL services when type changes
    _petServices.clear();
    // Re-init empty lists for selected pets
    for (final pet in _selectedPets) {
      _petServices[pet.id] = [];
    }

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

  /// Toggle service selection for a SPECIFIC PET
  void toggleService(String petId, ClinicServiceModel service) {
    if (!_petServices.containsKey(petId)) {
      _petServices[petId] = [];
    }

    final services = _petServices[petId]!;

    if (services.any((s) => s.serviceId == service.serviceId)) {
      services.removeWhere((s) => s.serviceId == service.serviceId);
    } else {
      // Check duplicate rule? Assuming standard toggle
      services.add(service);
    }
    _bookingError = null;
    notifyListeners();
  }

  /// Check if service is selected for a SPECIFIC PET
  bool isServiceSelected(String petId, String serviceId) {
    final services = _petServices[petId];
    if (services == null) return false;
    return services.any((s) => s.serviceId == serviceId);
  }

  /// Helper to get selected services list for current pet (safe)
  List<ClinicServiceModel> getSelectedServicesForPet(String petId) {
    return _petServices[petId] ?? [];
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
    // Collect ALL service IDs from ALL pets
    final List<String> allServiceIds = [];
    for (final services in _petServices.values) {
      allServiceIds.addAll(services.map((s) => s.serviceId));
    }

    debugPrint(
        'DEBUG loadAvailableSlots: clinic=${_clinic?.clinicId}, date=$_selectedDate, total_services=${allServiceIds.length}');

    if (_clinic == null || _selectedDate == null || allServiceIds.isEmpty) {
      debugPrint('DEBUG loadAvailableSlots: Early return - missing data');
      return;
    }
    if (_isLoadingSlots) return;

    _isLoadingSlots = true;
    _error = null;
    notifyListeners();

    try {
      // Get available slots from API (sending all service IDs)
      final apiSlots = await _bookingService.getAvailableSlots(
        clinicId: _clinic!.clinicId,
        date: _selectedDate!,
        serviceIds: allServiceIds,
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
    final int startIndex =
        _availableSlots.indexWhere((slot) => slot.startTime == time);
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
        _bookingError =
            'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.';
        notifyListeners();
        // Auto-clear error after 2 seconds
        Future.delayed(const Duration(seconds: 2), () {
          if (_bookingError ==
              'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.') {
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
          _bookingError =
              'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.';
        } else {
          _bookingError =
              'Một số khung giờ cần thiết đã được đặt. Vui lòng chọn khung giờ khác.';
        }
        notifyListeners();
        // Auto-clear error after 2 seconds
        Future.delayed(const Duration(seconds: 2), () {
          if (_bookingError ==
                  'Không đủ khung giờ liên tiếp. Vui lòng chọn khung giờ sớm hơn.' ||
              _bookingError ==
                  'Một số khung giờ cần thiết đã được đặt. Vui lòng chọn khung giờ khác.') {
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
      // Build items list
      final List<Map<String, dynamic>> itemsPayload = [];
      for (final pet in _selectedPets) {
        final services = _petServices[pet.id];
        if (services != null && services.isNotEmpty) {
          itemsPayload.add({
            'petId': pet.id,
            'serviceIds': services.map((s) => s.serviceId).toList(),
          });
        }
      }

      await _bookingService.createBooking(
        clinicId: _clinic!.clinicId,
        bookingDate: _selectedDate!,
        bookingTime: _selectedTime!,
        bookingType:
            _bookingType == BookingType.homeVisit ? 'HOME_VISIT' : 'IN_CLINIC',
        items: itemsPayload,
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
    _selectedPets.clear();
    _petServices.clear();
    _currentPetIdForServiceSelection = null;
    _bookingType = BookingType.atClinic;
    _availableServices = [];
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

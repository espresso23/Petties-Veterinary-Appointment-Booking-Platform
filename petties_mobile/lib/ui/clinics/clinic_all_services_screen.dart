import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../config/env/environment.dart';
import '../../data/models/clinic.dart';
import '../../data/models/clinic_service.dart';
import '../../data/models/pet.dart';
import '../../providers/booking_wizard_provider.dart';
import '../../providers/clinic_provider.dart';
import '../../data/services/booking_wizard_service.dart';
import '../../utils/format_utils.dart';
import '../widgets/profile/location_picker.dart';

/// Screen to display all services of a clinic with location header
class ClinicAllServicesScreen extends StatefulWidget {
  final String clinicId;

  const ClinicAllServicesScreen({
    super.key,
    required this.clinicId,
  });

  @override
  State<ClinicAllServicesScreen> createState() => _ClinicAllServicesScreenState();
}

class _ClinicAllServicesScreenState extends State<ClinicAllServicesScreen> 
    with SingleTickerProviderStateMixin {
  final BookingWizardService _bookingService = BookingWizardService();
  
  List<ClinicServiceModel> _services = [];
  bool _isLoading = true;
  String? _error;
  Clinic? _clinic;
  
  // Multi-selection state
  final Set<String> _selectedServiceIds = {};
  List<Pet> _myPets = [];
  bool _isLoadingPets = false;
  
  // Tab state
  late TabController _tabController;
  int _currentTabIndex = 0; // 0 = AT_CLINIC, 1 = HOME_VISIT

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _loadData();
  }
  
  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }
  
  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    
    final newIndex = _tabController.index;
    if (newIndex != _currentTabIndex) {
      setState(() {
        _currentTabIndex = newIndex;
        // Clear selection when switching tabs
        _selectedServiceIds.clear();
      });
    }
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Load clinic details
      final clinicProvider = context.read<ClinicProvider>();
      _clinic = clinicProvider.getCachedClinic(widget.clinicId);
      
      // Load services
      final services = await _bookingService.getClinicServices(widget.clinicId);
      setState(() {
        _services = services.where((s) => s.isActive).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách dịch vụ';
        _isLoading = false;
      });
      debugPrint('Error loading services: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: Column(
          children: [
            // Location Header
            _buildLocationHeader(),
            
            // App Bar
            _buildAppBar(),
            
            // Tab Bar
            _buildTabBar(),
            
            // Content
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    )
                  : _error != null
                      ? _buildError()
                      : _buildServicesList(),
            ),
            
            // Bottom bar for quick booking (only show when services selected)
            if (_selectedServiceIds.isNotEmpty) _buildQuickBookingBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationHeader() {
    return Consumer<ClinicProvider>(
      builder: (context, provider, _) {
        return GestureDetector(
          onTap: () => _showLocationPicker(context, provider),
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primaryBackground,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    border: Border.all(color: AppColors.stone900, width: 2),
                  ),
                  child: provider.isLoadingLocation
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        )
                      : Icon(
                          provider.locationError != null
                              ? Icons.location_off
                              : Icons.location_on,
                          color: provider.locationError != null
                              ? AppColors.error
                              : AppColors.primary,
                          size: 20,
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        provider.locationError != null
                            ? 'LỖI VỊ TRÍ'
                            : 'VỊ TRÍ CỦA BẠN',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: provider.locationError != null
                              ? AppColors.error
                              : AppColors.stone500,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              provider.locationAddress,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: provider.locationError != null
                                    ? AppColors.stone600
                                    : AppColors.stone900,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.edit_location_alt,
                            size: 18,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showLocationPicker(BuildContext context, ClinicProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => LocationPickerSheet(
        apiKey: Environment.goongApiKey,
        currentLatitude: provider.currentPosition?.latitude,
        currentLongitude: provider.currentPosition?.longitude,
        currentAddress: provider.locationAddress,
        onPlaceSelected: (placeDetails) {
          provider.setManualLocation(
            latitude: placeDetails.latitude,
            longitude: placeDetails.longitude,
            address: placeDetails.formattedAddress,
          );
        },
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: AppColors.white,
      child: TabBar(
        controller: _tabController,
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.stone500,
        indicatorColor: AppColors.primary,
        indicatorWeight: 3,
        labelStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        tabs: const [
          Tab(
            icon: Icon(Icons.store, size: 20),
            text: 'Phòng khám',
          ),
          Tab(
            icon: Icon(Icons.home, size: 20),
            text: 'Tại nhà',
          ),
        ],
      ),
    );
  }

  List<ClinicServiceModel> get _filteredServices {
    // Tab 0: Phòng khám - Show ALL services (both clinic-only and home-visit supported)
    // Tab 1: Tại nhà - Show ONLY services that support home visit
    if (_currentTabIndex == 1) {
      return _services.where((s) => s.isHomeVisit == true).toList();
    }
    return _services;
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(bottom: BorderSide(color: AppColors.stone200)),
      ),
      child: Row(
        children: [
          // Back button
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.stone300),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.arrow_back, size: 20, color: AppColors.stone900),
            ),
          ),
          const SizedBox(width: 12),
          // Clinic name
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'TẤT CẢ DỊCH VỤ',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                    letterSpacing: 0.5,
                  ),
                ),
                if (_clinic != null)
                  Text(
                    _clinic!.name,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.stone500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          // Service count badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${_services.length}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.coral),
          const SizedBox(height: 16),
          Text(
            _error!,
            style: const TextStyle(fontSize: 14, color: AppColors.stone600),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _loadData,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: const Text(
                'Thử lại',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesList() {
    final filteredServices = _filteredServices;
    
    if (filteredServices.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.medical_services_outlined, size: 48, color: AppColors.stone400),
            const SizedBox(height: 16),
            Text(
              _currentTabIndex == 0 
                  ? 'Chưa có dịch vụ tại phòng khám'
                  : 'Chưa có dịch vụ tại nhà',
              style: const TextStyle(fontSize: 14, color: AppColors.stone500),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: filteredServices.length,
      itemBuilder: (context, index) => _buildServiceCard(filteredServices[index]),
    );
  }

  Widget _buildServiceCard(ClinicServiceModel service) {
    final isSelected = _selectedServiceIds.contains(service.serviceId);
    
    return GestureDetector(
      onTap: () {
        setState(() {
          if (isSelected) {
            _selectedServiceIds.remove(service.serviceId);
          } else {
            _selectedServiceIds.add(service.serviceId);
          }
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryBackground : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone200,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? const [BoxShadow(color: AppColors.stone900, offset: Offset(3, 3))]
              : const [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with name and selection indicator
            Row(
              children: [
                // Service icon
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary.withValues(alpha: 0.15)
                        : AppColors.primaryBackground,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.stone300),
                  ),
                  child: Icon(
                    _getServiceIcon(service.serviceCategory),
                    color: AppColors.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        service.name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      // Category tag
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.stone100,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _getCategoryName(service.serviceCategory),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: AppColors.stone500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Selection indicator (checkbox)
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : AppColors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.stone300,
                      width: 2,
                    ),
                  ),
                  child: isSelected
                      ? const Icon(Icons.check, color: AppColors.white, size: 16)
                      : null,
                ),
              ],
            ),
            
            // Home visit badge
            if (service.isHomeVisit) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.teal100,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.teal600.withValues(alpha: 0.5)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.home, size: 12, color: AppColors.teal600),
                    SizedBox(width: 4),
                    Text(
                      'Tại nhà',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.teal600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            
            // Description
            if (service.description != null && service.description!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                service.description!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.stone600,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.stone200),
            const SizedBox(height: 12),
            
            // Price and duration row
            Row(
              children: [
                // Duration
                Row(
                  children: [
                    const Icon(Icons.schedule, size: 16, color: AppColors.stone500),
                    const SizedBox(width: 4),
                    Text(
                      '${service.durationMinutes} phút',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.stone600,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                // Price
                Text(
                  FormatUtils.formatCurrency(service.basePrice),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _getServiceIcon(String? category) {
    switch (category) {
      case 'GROOMING_SPA':
        return Icons.cut;
      case 'VACCINATION':
        return Icons.vaccines;
      case 'CHECK_UP':
        return Icons.health_and_safety;
      case 'SURGERY':
        return Icons.medical_services;
      case 'DENTAL':
        return Icons.mood;
      case 'DERMATOLOGY':
        return Icons.healing;
      default:
        return Icons.pets;
    }
  }

  String _getCategoryName(String? category) {
    switch (category) {
      case 'GROOMING_SPA':
        return 'Làm đẹp & Spa';
      case 'VACCINATION':
        return 'Tiêm phòng';
      case 'CHECK_UP':
        return 'Khám tổng quát';
      case 'SURGERY':
        return 'Phẫu thuật';
      case 'DENTAL':
        return 'Nha khoa';
      case 'DERMATOLOGY':
        return 'Da liễu';
      default:
        return 'Dịch vụ';
    }
  }

  /// Build quick booking bar at bottom when services are selected
  Widget _buildQuickBookingBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone200, width: 2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Selected count and total price
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${_selectedServiceIds.length} dịch vụ đã chọn',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    FormatUtils.formatCurrency(_totalBasePrice),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            // Book now button
            GestureDetector(
              onTap: _showPetSelectionPopup,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                  ],
                ),
                child: const Row(
                  children: [
                    Text(
                      'Đặt lịch ngay',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.white,
                      ),
                    ),
                    SizedBox(width: 8),
                    Icon(Icons.arrow_forward, color: AppColors.white, size: 18),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Get selected services list
  List<ClinicServiceModel> get _selectedServices {
    return _services.where((s) => _selectedServiceIds.contains(s.serviceId)).toList();
  }

  /// Calculate total price of selected services (base price only, weight surcharge calculated after pet selection)
  double get _totalBasePrice {
    double total = 0;
    for (final serviceId in _selectedServiceIds) {
      final service = _services.firstWhere(
        (s) => s.serviceId == serviceId,
        orElse: () => _services.first,
      );
      total += service.basePrice;
    }
    return total;
  }

  /// Show pet selection popup
  void _showPetSelectionPopup() async {
    // Load pets if not loaded
    if (_myPets.isEmpty && !_isLoadingPets) {
      setState(() => _isLoadingPets = true);
      try {
        _myPets = await _bookingService.getMyPets();
      } catch (e) {
        debugPrint('Error loading pets: $e');
      } finally {
        setState(() => _isLoadingPets = false);
      }
    }

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.7,
        ),
        decoration: const BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.stone300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Text(
                    'Chọn thú cưng',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.close, color: AppColors.stone500),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // Pet list
            Flexible(
              child: _isLoadingPets
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
                    )
                  : _myPets.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.pets, size: 48, color: AppColors.stone400),
                              const SizedBox(height: 12),
                              const Text(
                                'Bạn chưa có thú cưng nào',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppColors.stone500,
                                ),
                              ),
                              const SizedBox(height: 16),
                              GestureDetector(
                                onTap: () {
                                  Navigator.pop(context);
                                  context.push('/pets/add');
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Thêm thú cưng',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          padding: const EdgeInsets.all(16),
                          itemCount: _myPets.length,
                          itemBuilder: (context, index) {
                            final pet = _myPets[index];
                            return _buildPetCard(pet);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  /// Build pet card for selection popup
  Widget _buildPetCard(Pet pet) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(context);
        _startBookingWithPet(pet);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone300),
        ),
        child: Row(
          children: [
            // Pet image
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.stone200,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.stone300),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: pet.imageUrl != null
                    ? Image.network(pet.imageUrl!, fit: BoxFit.cover)
                    : const Icon(Icons.pets, color: AppColors.stone400, size: 28),
              ),
            ),
            const SizedBox(width: 12),
            // Pet info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pet.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${pet.species} • ${pet.breed}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.stone500,
                    ),
                  ),
                  Text(
                    '${pet.weight} kg',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
            ),
            // Arrow
            const Icon(Icons.arrow_forward_ios, size: 16, color: AppColors.stone400),
          ],
        ),
      ),
    );
  }

  /// Start booking with selected pet and services
  void _startBookingWithPet(Pet pet) {
    if (_clinic == null) return;

    final clinicProvider = context.read<ClinicProvider>();
    final bookingProvider = context.read<BookingWizardProvider>();

    // Determine booking type from active tab
    final bookingType = _currentTabIndex == 1 
        ? BookingType.homeVisit 
        : BookingType.atClinic;

    // Initialize booking with pre-selected services
    bookingProvider.initBookingWithPreselectedServices(
      clinic: _clinic!,
      pet: pet,
      preselectedServices: _selectedServices,
      bookingType: bookingType,
      userAddress: clinicProvider.locationAddress,
      userLatitude: clinicProvider.currentPosition?.latitude,
      userLongitude: clinicProvider.currentPosition?.longitude,
    );

    // Navigate to services screen (step 2 of booking wizard)
    context.push('/booking/services');
  }
}

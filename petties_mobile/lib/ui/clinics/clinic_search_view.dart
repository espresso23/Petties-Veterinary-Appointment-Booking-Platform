import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import 'package:petties_mobile/config/env/environment.dart';
import '../../data/services/location_service.dart';
import '../../providers/clinic_provider.dart';
import '../../routing/app_routes.dart';
import '../widgets/profile/location_picker.dart';
import 'widgets/clinic_list_item.dart';

/// Clinic Search View - Neobrutalism Style with Provider
class ClinicSearchView extends StatefulWidget {
  final bool embedMode;

  const ClinicSearchView({
    super.key,
    this.embedMode = false,
  });

  @override
  State<ClinicSearchView> createState() => _ClinicSearchViewState();
}

class _ClinicSearchViewState extends State<ClinicSearchView>
    with AutomaticKeepAliveClientMixin {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  Timer? _debounceTimer;

  // Advanced filter state for bottom sheet
  final TextEditingController _provinceController = TextEditingController();
  String? _selectedDistrict;
  RangeValues _priceRange = const RangeValues(0, 5000000);
  Set<String> _selectedServiceCategories = {};

  // Service categories data
  static const List<Map<String, dynamic>> _serviceCategories = [
    {'key': 'GROOMING_SPA', 'name': 'Làm đẹp & Spa', 'icon': Icons.cut},
    {'key': 'VACCINATION', 'name': 'Tiêm phòng', 'icon': Icons.vaccines},
    {
      'key': 'CHECK_UP',
      'name': 'Khám tổng quát',
      'icon': Icons.health_and_safety
    },
    {'key': 'SURGERY', 'name': 'Phẫu thuật', 'icon': Icons.medical_services},
    {'key': 'DENTAL', 'name': 'Nha khoa', 'icon': Icons.mood},
    {'key': 'DERMATOLOGY', 'name': 'Da liễu', 'icon': Icons.healing},
  ];

  // Location service and data
  final LocationService _locationService = LocationService();
  List<Province> _provinces = [];
  List<District> _districts = [];
  Province? _selectedProvince;
  bool _isLoadingProvinces = false;
  bool _isLoadingDistricts = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    // Get location on init - only if not already available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<ClinicProvider>();
      // Only fetch location if not already available
      if (!provider.hasLocation) {
        provider.getCurrentLocation();
      } else if (provider.clinics.isEmpty) {
        // If we have location but no clinics, fetch them
        provider.fetchClinics();
      }
    });

    // Listen for scroll to load more
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      context.read<ClinicProvider>().loadMoreClinics();
    }
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 1000), () {
      context.read<ClinicProvider>().setSearchQuery(query);
    });
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    _provinceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final content = SafeArea(
      child: Column(
        children: [
          // Location Header
          _buildLocationHeader(),

          // Search Bar
          _buildSearchBar(),

          // Filter Chips
          _buildFilterChips(),

          // Content
          Expanded(
            child: _buildContent(),
          ),
        ],
      ),
    );

    if (widget.embedMode) {
      return Container(
        color: AppColors.stone50,
        child: content,
      );
    }

    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: content,
      bottomNavigationBar: _buildBrutalNavBar(),
    );
  }

  Widget _buildBrutalNavBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      child: Builder(
        builder: (context) => BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.stone400,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
          currentIndex: 1, // KHÁM PHÁ tab
          elevation: 0,
          onTap: (index) {
            switch (index) {
              case 0:
                context.go(AppRoutes.petOwnerHome);
                break;
              case 1:
                // Already on KHÁM PHÁ (clinic search)
                break;
              case 2:
                // TODO: Navigate to bookings
                break;
              case 3:
                context.push(AppRoutes.profile);
                break;
            }
          },
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home), label: 'TRANG CHỦ'),
            BottomNavigationBarItem(
                icon: Icon(Icons.explore), label: 'KHÁM PHÁ'),
            BottomNavigationBarItem(
                icon: Icon(Icons.calendar_today), label: 'LỊCH HẸN'),
            BottomNavigationBarItem(
                icon: Icon(Icons.person), label: 'TÀI KHOẢN'),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationHeader() {
    return Consumer<ClinicProvider>(
      builder: (context, provider, _) {
        return GestureDetector(
          onTap: () async {
            // Open location picker with Goong API
            final apiKey = Environment.goongApiKey;
            if (apiKey.isEmpty) {
              // Fallback to retry GPS if no API key
              provider.getCurrentLocation();
              return;
            }

            final result = await showLocationPicker(
              context,
              currentAddress: provider.locationAddress,
              apiKey: apiKey,
              currentLatitude: provider.currentPosition?.latitude,
              currentLongitude: provider.currentPosition?.longitude,
            );

            if (result != null && context.mounted) {
              provider.setManualLocation(
                latitude: result.latitude,
                longitude: result.longitude,
                address: result.formattedAddress,
              );
            }
          },
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
                          Icon(
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

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Search Field
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                ],
              ),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Tìm phòng khám, dịch vụ...',
                  hintStyle: TextStyle(
                    fontSize: 14,
                    color: AppColors.stone400,
                  ),
                  prefixIcon: const Icon(
                    Icons.search,
                    color: AppColors.stone500,
                  ),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          onPressed: () {
                            _searchController.clear();
                            _onSearchChanged('');
                          },
                          icon: const Icon(
                            Icons.close,
                            color: AppColors.stone500,
                            size: 20,
                          ),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
                onChanged: (value) {
                  setState(() {}); // Update UI for clear button
                  _onSearchChanged(value);
                },
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Filter Button
          Consumer<ClinicProvider>(
            builder: (context, provider, _) {
              final hasFilters = provider.hasAdvancedFilters;
              return GestureDetector(
                onTap: () => _showAdvancedFiltersSheet(),
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: hasFilters ? AppColors.primary : AppColors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.stone900, width: 2),
                    boxShadow: const [
                      BoxShadow(
                          color: AppColors.stone900, offset: Offset(3, 3)),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Icon(
                          Icons.tune,
                          color:
                              hasFilters ? AppColors.white : AppColors.stone700,
                          size: 22,
                        ),
                      ),
                      if (hasFilters)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: AppColors.white, width: 1),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return Consumer<ClinicProvider>(
      builder: (context, provider, _) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              _buildBrutalChip(
                label: 'GẦN ĐÂY',
                isSelected: provider.filterNearby,
                onTap: () => provider.toggleNearby(),
              ),
              const SizedBox(width: 8),
              _buildBrutalChip(
                label: 'ĐANG MỞ',
                icon: Icons.access_time,
                isSelected: provider.filterOpenNow,
                onTap: () => provider.toggleOpenNow(),
              ),
              const SizedBox(width: 8),
              _buildBrutalChip(
                label: 'ĐÁNH GIÁ CAO',
                icon: Icons.star,
                isSelected: provider.filterTopRated,
                onTap: () => provider.toggleTopRated(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBrutalChip({
    required String label,
    IconData? icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: isSelected
              ? const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(2, 2))
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 14,
                color: isSelected ? AppColors.white : AppColors.stone700,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: isSelected ? AppColors.white : AppColors.stone700,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Consumer<ClinicProvider>(
      builder: (context, provider, _) {
        // Show message when location is being fetched or not available yet
        if (provider.isLoadingLocation || !provider.hasLocation) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBackground,
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(
                            color: AppColors.stone900, offset: Offset(3, 3)),
                      ],
                    ),
                    child: provider.isLoadingLocation
                        ? const SizedBox(
                            width: 40,
                            height: 40,
                            child: CircularProgressIndicator(
                              color: AppColors.primary,
                              strokeWidth: 3,
                            ),
                          )
                        : const Icon(
                            Icons.location_on,
                            size: 40,
                            color: AppColors.primary,
                          ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    provider.isLoadingLocation
                        ? 'ĐANG LẤY VỊ TRÍ...'
                        : 'CHỌN VỊ TRÍ CỦA BẠN',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                      letterSpacing: 1,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vui lòng chọn vị trí của bạn để thấy danh sách phòng khám',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.stone600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (!provider.isLoadingLocation) ...[
                    const SizedBox(height: 20),
                    GestureDetector(
                      onTap: () => provider.getCurrentLocation(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(10),
                          border:
                              Border.all(color: AppColors.stone900, width: 2),
                          boxShadow: const [
                            BoxShadow(
                                color: AppColors.stone900,
                                offset: Offset(3, 3)),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.my_location,
                                color: AppColors.white, size: 18),
                            SizedBox(width: 8),
                            Text(
                              'SỬ DỤNG VỊ TRÍ HIỆN TẠI',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        }

        if (provider.isLoading && provider.clinics.isEmpty) {
          return const Center(
            child: CircularProgressIndicator(
              color: AppColors.primary,
            ),
          );
        }

        if (provider.error != null && provider.clinics.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    border: Border.all(color: AppColors.stone900, width: 2),
                  ),
                  child: const Icon(
                    Icons.error_outline,
                    size: 40,
                    color: AppColors.error,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  provider.error!,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.stone700,
                  ),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () => provider.refreshClinics(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                    ),
                    child: const Text(
                      'THỬ LẠI',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.white,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        if (provider.clinics.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.stone100,
                    border: Border.all(color: AppColors.stone900, width: 2),
                  ),
                  child: const Icon(
                    Icons.search_off,
                    size: 40,
                    color: AppColors.stone400,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'KHÔNG TÌM THẤY PHÒNG KHÁM',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone700,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => provider.refreshClinics(),
          color: AppColors.primary,
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              // Section Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'PHÒNG KHÁM GẦN BẠN (${provider.clinics.length})',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.stone900,
                          letterSpacing: 1,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          context.push(AppRoutes.clinicMap);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.white,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                                color: AppColors.stone900, width: 1.5),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.map_outlined,
                                size: 14,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 4),
                              const Text(
                                'BẢN ĐỒ',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Clinic List
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final clinic = provider.clinics[index];
                      return ClinicListItem(
                        clinic: clinic,
                        showBookButton: index == 0,
                        onTap: () {
                          context.push('/clinics/${clinic.clinicId}');
                        },
                        onBookAppointment: () {
                          // TODO: Navigate to booking flow
                        },
                      );
                    },
                    childCount: provider.clinics.length,
                  ),
                ),
              ),

              // Loading more indicator
              if (provider.isLoadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),

              // End message
              if (!provider.hasMore && provider.clinics.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.stone100,
                            border:
                                Border.all(color: AppColors.stone900, width: 2),
                          ),
                          child: const Icon(
                            Icons.pets,
                            size: 32,
                            color: AppColors.stone400,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'ĐÃ HIỂN THỊ TẤT CẢ',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.stone500,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  /// Show advanced filters bottom sheet
  void _showAdvancedFiltersSheet() {
    final provider = context.read<ClinicProvider>();

    // Initialize with current filter values
    _provinceController.text = provider.filterProvince ?? '';
    _selectedDistrict = provider.filterDistrict;
    _priceRange = RangeValues(
      provider.filterMinPrice ?? 0,
      provider.filterMaxPrice ?? 5000000,
    );
    _selectedServiceCategories = Set.from(provider.filterServiceCategories);

    _districts = [];
    _selectedProvince = null;
    _isLoadingProvinces = false;
    _isLoadingDistricts = false;

    // Load provinces on open
    _loadProvinces();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          return Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.85,
            ),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
              ],
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'BỘ LỌC NÂNG CAO',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.stone900,
                          letterSpacing: 1,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            border: Border.all(
                                color: AppColors.stone300, width: 1.5),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.close,
                            size: 18,
                            color: AppColors.stone600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Province/City Field with Autocomplete
                  const Text(
                    'Tỉnh/Thành phố',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  RawAutocomplete<Province>(
                    textEditingController: _provinceController,
                    focusNode: FocusNode(),
                    optionsBuilder: (TextEditingValue textEditingValue) {
                      if (textEditingValue.text.isEmpty ||
                          _selectedProvince != null) {
                        return const Iterable<Province>.empty();
                      }
                      final query = textEditingValue.text.toLowerCase();
                      return _provinces.where((p) {
                        return p.name.toLowerCase().contains(query) ||
                            p.shortName.toLowerCase().contains(query);
                      }).take(6);
                    },
                    displayStringForOption: (Province option) =>
                        option.shortName,
                    onSelected: (Province selection) async {
                      setSheetState(() {
                        _selectedProvince = selection;
                        _provinceController.text = selection.shortName;
                        _selectedDistrict = null;
                        _districts = [];
                        _isLoadingDistricts = true;
                      });
                      // Load districts for selected province
                      try {
                        final districts =
                            await _locationService.getDistricts(selection.code);
                        setSheetState(() {
                          _districts = districts;
                          _isLoadingDistricts = false;
                        });
                      } catch (e) {
                        setSheetState(() {
                          _isLoadingDistricts = false;
                        });
                      }
                    },
                    fieldViewBuilder:
                        (context, controller, focusNode, onFieldSubmitted) {
                      return Container(
                        decoration: BoxDecoration(
                          color: AppColors.stone50,
                          borderRadius: BorderRadius.circular(10),
                          border:
                              Border.all(color: AppColors.stone300, width: 1.5),
                        ),
                        child: TextField(
                          controller: controller,
                          focusNode: focusNode,
                          decoration: InputDecoration(
                            hintText: 'Nhập tên tỉnh/thành phố',
                            hintStyle: TextStyle(
                              fontSize: 14,
                              color: AppColors.stone400,
                            ),
                            suffixIcon: _isLoadingProvinces
                                ? const Padding(
                                    padding: EdgeInsets.all(12),
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  )
                                : (_selectedProvince != null
                                    ? IconButton(
                                        icon: const Icon(Icons.close, size: 18),
                                        color: AppColors.stone400,
                                        onPressed: () {
                                          setSheetState(() {
                                            _provinceController.clear();
                                            _selectedProvince = null;
                                            _selectedDistrict = null;
                                            _districts = [];
                                          });
                                        },
                                      )
                                    : const Icon(
                                        Icons.search,
                                        color: AppColors.stone400,
                                        size: 20,
                                      )),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                          ),
                          onChanged: (value) {
                            if (_selectedProvince != null) {
                              setSheetState(() {
                                _selectedProvince = null;
                                _selectedDistrict = null;
                                _districts = [];
                              });
                            }
                          },
                        ),
                      );
                    },
                    optionsViewBuilder: (context, onSelected, options) {
                      return Align(
                        alignment: Alignment.topLeft,
                        child: Material(
                          elevation: 8,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            width: MediaQuery.of(context).size.width - 72,
                            constraints: const BoxConstraints(maxHeight: 200),
                            decoration: BoxDecoration(
                              color: AppColors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.stone300),
                            ),
                            child: ListView.builder(
                              shrinkWrap: true,
                              padding: EdgeInsets.zero,
                              itemCount: options.length,
                              itemBuilder: (context, index) {
                                final province = options.elementAt(index);
                                return InkWell(
                                  onTap: () => onSelected(province),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14, vertical: 12),
                                    decoration: BoxDecoration(
                                      border: Border(
                                        bottom: BorderSide(
                                          color: index < options.length - 1
                                              ? AppColors.stone200
                                              : Colors.transparent,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      province.name,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        color: AppColors.stone700,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 20),

                  // District Dropdown
                  const Text(
                    'Quận/Huyện',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: _selectedProvince == null
                          ? AppColors.stone100
                          : AppColors.stone50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.stone300, width: 1.5),
                    ),
                    child: _isLoadingDistricts
                        ? const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                ),
                                SizedBox(width: 12),
                                Text(
                                  'Đang tải...',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: AppColors.stone400,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _selectedDistrict,
                              hint: Text(
                                _selectedProvince == null
                                    ? 'Chọn tỉnh trước'
                                    : 'Chọn quận/huyện',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppColors.stone400,
                                ),
                              ),
                              isExpanded: true,
                              icon: Icon(
                                Icons.keyboard_arrow_down,
                                color: _selectedProvince == null
                                    ? AppColors.stone300
                                    : AppColors.stone500,
                              ),
                              items: _districts.isEmpty
                                  ? null
                                  : _districts.map((district) {
                                      return DropdownMenuItem<String>(
                                        value: district.shortName,
                                        child: Text(
                                          district.shortName,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            color: AppColors.stone700,
                                          ),
                                        ),
                                      );
                                    }).toList(),
                              onChanged: _districts.isEmpty
                                  ? null
                                  : (String? newValue) {
                                      setSheetState(() {
                                        _selectedDistrict = newValue;
                                      });
                                    },
                            ),
                          ),
                  ),
                  const SizedBox(height: 20),

                  // Price Range Slider
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Khoảng giá',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone700,
                        ),
                      ),
                      Text(
                        '${_formatPrice(_priceRange.start)} - ${_formatPrice(_priceRange.end)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text(
                        '0K',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone500,
                        ),
                      ),
                      Expanded(
                        child: SliderTheme(
                          data: SliderTheme.of(context).copyWith(
                            activeTrackColor: AppColors.primary,
                            inactiveTrackColor: AppColors.stone200,
                            thumbColor: AppColors.primary,
                            overlayColor:
                                AppColors.primary.withValues(alpha: 0.2),
                            trackHeight: 6,
                            rangeThumbShape: const RoundRangeSliderThumbShape(
                              enabledThumbRadius: 10,
                            ),
                          ),
                          child: RangeSlider(
                            values: _priceRange,
                            min: 0,
                            max: 5000000,
                            divisions: 50,
                            onChanged: (RangeValues values) {
                              setSheetState(() {
                                _priceRange = values;
                              });
                            },
                          ),
                        ),
                      ),
                      Text(
                        '5M',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Service Categories
                  const Text(
                    'Danh mục dịch vụ',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _serviceCategories.map((category) {
                      final isSelected =
                          _selectedServiceCategories.contains(category['key']);
                      return GestureDetector(
                        onTap: () {
                          setSheetState(() {
                            if (isSelected) {
                              _selectedServiceCategories
                                  .remove(category['key']);
                            } else {
                              _selectedServiceCategories
                                  .add(category['key'] as String);
                            }
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.stone300,
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                category['icon'] as IconData,
                                size: 16,
                                color: isSelected
                                    ? AppColors.white
                                    : AppColors.stone600,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                category['name'] as String,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected
                                      ? AppColors.white
                                      : AppColors.stone700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 28),

                  // Action Buttons
                  Row(
                    children: [
                      // Reset Button
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setSheetState(() {
                              _provinceController.clear();
                              _selectedDistrict = null;
                              _selectedProvince = null;
                              _districts = [];
                              _priceRange = const RangeValues(0, 5000000);
                              _selectedServiceCategories = {};
                            });
                            provider.clearAdvancedFilters();
                            Navigator.pop(context);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: AppColors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color: AppColors.stone900, width: 2),
                            ),
                            child: const Center(
                              child: Text(
                                'ĐẶT LẠI',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.stone900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Apply Button
                      Expanded(
                        flex: 2,
                        child: GestureDetector(
                          onTap: () {
                            provider.setAdvancedFilters(
                              province: _provinceController.text.isNotEmpty
                                  ? _provinceController.text
                                  : null,
                              district: _selectedDistrict,
                              minPrice: _priceRange.start > 0
                                  ? _priceRange.start
                                  : null,
                              maxPrice: _priceRange.end < 5000000
                                  ? _priceRange.end
                                  : null,
                              serviceCategories:
                                  _selectedServiceCategories.isNotEmpty
                                      ? _selectedServiceCategories
                                      : null,
                            );
                            Navigator.pop(context);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color: AppColors.stone900, width: 2),
                              boxShadow: const [
                                BoxShadow(
                                    color: AppColors.stone900,
                                    offset: Offset(3, 3)),
                              ],
                            ),
                            child: const Center(
                              child: Text(
                                'ÁP DỤNG BỘ LỌC',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.white,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// Load provinces from API
  Future<void> _loadProvinces() async {
    if (_provinces.isNotEmpty) return; // Already loaded

    _isLoadingProvinces = true;
    try {
      _provinces = await _locationService.getProvinces();
      _isLoadingProvinces = false;
    } catch (e) {
      _isLoadingProvinces = false;
      debugPrint('Error loading provinces: $e');
    }
  }

  /// Format price for display
  String _formatPrice(double price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1)}M';
    } else if (price >= 1000) {
      return '${(price / 1000).toStringAsFixed(0)}K';
    }
    return price.toStringAsFixed(0);
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../config/env/environment.dart';
import '../../data/models/clinic.dart';
import '../../data/models/pet.dart';
import '../../data/models/beneficiary_info.dart';
import '../../providers/booking_wizard_provider.dart';
import '../../providers/clinic_provider.dart';
import '../../data/services/clinic_service.dart';
import '../widgets/profile/location_picker.dart';

/// Step 1: Select Pet and Booking Type
class BookingSelectPetScreen extends StatefulWidget {
  final String clinicId;

  const BookingSelectPetScreen({
    super.key,
    required this.clinicId,
  });

  @override
  State<BookingSelectPetScreen> createState() => _BookingSelectPetScreenState();
}

class _BookingSelectPetScreenState extends State<BookingSelectPetScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initBooking();
    });
  }

  Future<void> _initBooking() async {
    final clinicProvider = context.read<ClinicProvider>();
    final bookingProvider = context.read<BookingWizardProvider>();

    // Always load pets immediately - independent of clinic
    bookingProvider.loadMyPets();

    // Find clinic from provider or fetch if missing
    Clinic? clinic;
    try {
      // Try to find in provider cache first
      clinic = clinicProvider.clinics.firstWhere(
        (c) => c.clinicId == widget.clinicId,
      );
    } catch (_) {
      // Not found in cache (e.g. after hot restart or direct navigation)
      try {
        // Fetch from API
        // Note: Creating service instance locally for now as it's not exposed
        // Ideally ClinicProvider should expose this or getById
        final clinicService = ClinicService();
        clinic = await clinicService.getClinicById(widget.clinicId);
      } catch (e) {
        debugPrint('Error fetching clinic details: $e');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi tải thông tin phòng khám: $e')),
          );
        }
      }
    }

    if (clinic != null && mounted) {
      bookingProvider.initBooking(
        clinic: clinic,
        userAddress: clinicProvider.locationAddress,
        userLatitude: clinicProvider.currentPosition?.latitude,
        userLongitude: clinicProvider.currentPosition?.longitude,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _buildAppBar(),
      body: Consumer<BookingWizardProvider>(
        builder: (context, provider, _) {
          return Column(
            children: [
              // Progress indicator
              _buildProgressIndicator(1),

              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Đặt hộ button
                      _buildDatHoButton(provider),
                      const SizedBox(height: 16),

                      // Thông tin người được đặt hộ (nhập thủ công)
                      if (provider.isBookingForOthers &&
                          provider.beneficiary != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.white,
                            borderRadius: BorderRadius.circular(12),
                            border:
                                Border.all(color: AppColors.stone300, width: 2),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Thông tin người đặt hộ',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.stone900,
                                ),
                              ),
                              const SizedBox(height: 16),

                              // Họ tên
                              const Text(
                                'Họ tên',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.stone700,
                                ),
                              ),
                              const SizedBox(height: 6),
                              TextFormField(
                                initialValue: provider.beneficiary!.fullName,
                                decoration: InputDecoration(
                                  hintText: 'Nguyễn Văn A',
                                  filled: true,
                                  fillColor: AppColors.white,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                        color: AppColors.stone300),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 12),
                                ),
                                onChanged: (v) => provider.updateBeneficiary(
                                  fullName: v.trim(),
                                ),
                              ),
                              const SizedBox(height: 16),

                              // Số điện thoại
                              const Text(
                                'Số điện thoại',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.stone700,
                                ),
                              ),
                              const SizedBox(height: 6),
                              TextFormField(
                                initialValue: provider.beneficiary!.phone,
                                keyboardType: TextInputType.phone,
                                decoration: InputDecoration(
                                  hintText: '0912 345 678',
                                  filled: true,
                                  fillColor: AppColors.white,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                        color: AppColors.stone300),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 12),
                                ),
                                onChanged: (v) => provider.updateBeneficiary(
                                  phone: v.trim(),
                                ),
                              ),
                              const SizedBox(height: 16),

                              // Vị trí của người đặt hộ
                              _buildLocationCard(
                                provider,
                                isForBeneficiary: true,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Location info (chỉ hiển thị riêng khi KHÔNG đặt hộ)
                      if (!provider.isBookingForOthers &&
                          provider.userAddress != null) ...[
                        _buildLocationCard(provider),
                        const SizedBox(height: 20),
                      ],

                      // Hình thức khám (chung cho cả hai mode)
                      _buildBookingTypeSection(provider),
                      const SizedBox(height: 24),

                      // Pet selection
                      _buildPetSelectionSection(provider),
                    ],
                  ),
                ),
              ),

              // Bottom button
              _buildBottomButton(provider),
            ],
          );
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.white,
      elevation: 0,
      leading: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.stone300),
            borderRadius: BorderRadius.circular(8),
          ),
          child:
              const Icon(Icons.arrow_back, color: AppColors.stone900, size: 20),
        ),
      ),
      title: Consumer<BookingWizardProvider>(
        builder: (context, provider, _) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'ĐẶT LỊCH HẸN',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.stone900,
                  letterSpacing: 0.5,
                ),
              ),
              if (provider.clinic != null)
                Text(
                  provider.clinic!.name,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.stone500,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildProgressIndicator(int currentStep) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: AppColors.white,
      child: Row(
        children: [
          _buildStepDot(1, currentStep, 'Thú cưng'),
          _buildStepLine(currentStep >= 2),
          _buildStepDot(2, currentStep, 'Dịch vụ'),
          _buildStepLine(currentStep >= 3),
          _buildStepDot(3, currentStep, 'Ngày giờ'),
        ],
      ),
    );
  }

  Widget _buildStepDot(int step, int currentStep, String label) {
    final isActive = step <= currentStep;
    final isCurrent = step == currentStep;

    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.stone200,
            shape: BoxShape.circle,
            border: isCurrent
                ? Border.all(color: AppColors.stone900, width: 2)
                : null,
          ),
          child: Center(
            child: Text(
              '$step',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isActive ? AppColors.white : AppColors.stone500,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: isActive ? AppColors.stone900 : AppColors.stone400,
          ),
        ),
      ],
    );
  }

  Widget _buildStepLine(bool isActive) {
    return Expanded(
      child: Container(
        height: 3,
        margin: const EdgeInsets.only(bottom: 16),
        color: isActive ? AppColors.primary : AppColors.stone200,
      ),
    );
  }

  Widget _buildDatHoButton(BookingWizardProvider provider) {
    final isOn = provider.isBookingForOthers;

    void toggle(bool value) {
      if (!value) {
        // Tắt chế độ đặt hộ
        provider.clearBeneficiary();
      } else {
        // Bật chế độ Đặt hộ với beneficiary trống, dùng địa chỉ hiện tại (nếu có)
        provider.setBeneficiary(
          BeneficiaryInfo(
            fullName: '',
            phone: '',
            address: provider.userAddress ?? '',
            latitude: provider.userLatitude,
            longitude: provider.userLongitude,
            bookingTypeApi: provider.bookingType == BookingType.homeVisit
                ? 'HOME_VISIT'
                : 'IN_CLINIC',
          ),
        );
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone300, width: 2),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: isOn ? AppColors.primary : AppColors.stone100,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Icon(
              Icons.person_add_alt_1,
              size: 18,
              color: isOn ? AppColors.white : AppColors.stone700,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Đặt hộ',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isOn ? AppColors.teal100 : AppColors.stone100,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        isOn ? 'Đang bật' : 'Đang tắt',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isOn ? AppColors.teal700 : AppColors.stone600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                const Text(
                  'Đặt lịch khám cho thú cưng hộ người khác.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.stone500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: isOn,
            activeColor: AppColors.white,
            activeTrackColor: AppColors.primary,
            inactiveThumbColor: AppColors.white,
            inactiveTrackColor: AppColors.stone300,
            onChanged: toggle,
          ),
        ],
      ),
    );
  }

  Widget _buildLocationCard(BookingWizardProvider provider,
      {bool isForBeneficiary = false}) {
    return GestureDetector(
      onTap: () => _showLocationPicker(provider),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.primaryBackground,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_on, color: AppColors.primary, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isForBeneficiary ? 'Vị trí của người đặt hộ' : 'Vị trí của bạn',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone500,
                    ),
                  ),
                  Text(
                    provider.userAddress ?? 'Chưa xác định',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone900,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.edit_location_alt,
                color: AppColors.primary, size: 18),
          ],
        ),
      ),
    );
  }

  void _showLocationPicker(BookingWizardProvider provider) {
    final clinicProvider = context.read<ClinicProvider>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => LocationPickerSheet(
        apiKey: Environment.goongApiKey,
        currentLatitude: provider.userLatitude,
        currentLongitude: provider.userLongitude,
        currentAddress: provider.userAddress,
        onPlaceSelected: (placeDetails) {
          // Update both the booking provider and clinic provider
          provider.updateUserLocation(
            address: placeDetails.formattedAddress,
            latitude: placeDetails.latitude,
            longitude: placeDetails.longitude,
          );
          clinicProvider.setManualLocation(
            latitude: placeDetails.latitude,
            longitude: placeDetails.longitude,
            address: placeDetails.formattedAddress,
          );
        },
      ),
    );
  }

  Widget _buildBookingTypeSection(BookingWizardProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Hình thức khám',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.stone900,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildBookingTypeCard(
                provider,
                BookingType.atClinic,
                Icons.local_hospital,
                'Tại phòng khám',
                'Đến khám trực tiếp',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildBookingTypeCard(
                provider,
                BookingType.homeVisit,
                Icons.home,
                'Tại nhà',
                'Bác sĩ đến nhà',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBookingTypeCard(
    BookingWizardProvider provider,
    BookingType type,
    IconData icon,
    String title,
    String subtitle,
  ) {
    final isSelected = provider.bookingType == type;

    return GestureDetector(
      onTap: () => provider.setBookingType(type),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone300,
            width: 2,
          ),
          boxShadow: isSelected
              ? [
                  const BoxShadow(
                      color: AppColors.stone900, offset: Offset(3, 3))
                ]
              : null,
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 32,
              color: isSelected ? AppColors.white : AppColors.stone600,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isSelected ? AppColors.white : AppColors.stone900,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: isSelected
                    ? AppColors.white.withValues(alpha: 0.8)
                    : AppColors.stone500,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPetSelectionSection(BookingWizardProvider provider) {
    final isForOthers = provider.isBookingForOthers;
    final pets = provider.petsToShow;
    final isLoading = !isForOthers && provider.isLoadingPets;
    final hasError = !isForOthers && provider.error != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              isForOthers ? 'Thú cưng của người được đặt hộ' : 'Chọn thú cưng',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
              ),
            ),
            if (isForOthers) ...[
              const Spacer(),
              GestureDetector(
                onTap: () => _showAddPetForBeneficiary(provider),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.stone900, width: 1),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, color: AppColors.white, size: 18),
                      SizedBox(width: 6),
                      Text(
                        'Thêm thú cưng',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        if (isLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (hasError)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.errorLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Column(
                children: [
                  const Icon(Icons.error_outline,
                      size: 48, color: AppColors.error),
                  const SizedBox(height: 8),
                  Text(
                    provider.error!,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.errorDark,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => provider.loadMyPets(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.white,
                      foregroundColor: AppColors.error,
                    ),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            ),
          )
        else if (pets.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.stone100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                const Icon(Icons.pets, size: 48, color: AppColors.stone400),
                const SizedBox(height: 8),
                Text(
                  isForOthers
                      ? 'Chưa có thú cưng nào. Thêm thú cưng để tiếp tục.'
                      : 'Bạn chưa có thú cưng nào',
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.stone500,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (isForOthers) ...[
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: () => _showAddPetForBeneficiary(provider),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.stone900, width: 2),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add, color: AppColors.white, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Thêm thú cưng',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          )
        else ...[
          ...pets.map((pet) => _buildPetCard(provider, pet)),
          if (isForOthers)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: GestureDetector(
                onTap: () => _showAddPetForBeneficiary(provider),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.stone300, width: 2),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_circle_outline,
                          color: AppColors.primary, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Thêm thú cưng khác',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }

  void _showAddPetForBeneficiary(BookingWizardProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AddPetForBeneficiarySheet(
        onSave: (pet) {
          provider.addBeneficiaryPet(pet);
          Navigator.of(context).pop();
        },
      ),
    );
  }

  Widget _buildPetCard(BookingWizardProvider provider, pet) {
    final isSelected = provider.selectedPets.any((p) => p.id == pet.id);

    return GestureDetector(
      onTap: () => provider.togglePetSelection(pet),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryBackground : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone300,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            // Selection Checkbox
            Container(
              width: 24,
              height: 24,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : AppColors.white,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.stone300,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: AppColors.white, size: 16)
                  : null,
            ),

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
                    : const Icon(Icons.pets,
                        color: AppColors.stone400, size: 28),
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
                    '${pet.species} • ${pet.breed} • ${pet.weight} kg',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
            ),
            // Xóa thú cưng (chỉ khi chế độ đặt hộ)
            if (provider.isBookingForOthers)
              GestureDetector(
                onTap: () => provider.removeBeneficiaryPet(pet.id),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close, size: 20, color: AppColors.stone500),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomButton(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone200)),
      ),
      child: SafeArea(
        top: false,
        child: GestureDetector(
          onTap: provider.canProceedToServices
              ? () {
                  // Ensure current pet is set for service selection
                  if (provider.selectedPets.isNotEmpty) {
                    provider.setCurrentPetForServiceSelection(
                        provider.selectedPets.first.id);
                  }
                  provider.loadServices();
                  context.push('/booking/${widget.clinicId}/services');
                }
              : null,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: provider.canProceedToServices
                  ? AppColors.primary
                  : AppColors.stone300,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: provider.canProceedToServices
                  ? const [
                      BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
                    ]
                  : null,
            ),
            child: const Center(
              child: Text(
                'TIẾP TỤC CHỌN DỊCH VỤ',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.white,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet form thêm thú cưng cho người được đặt hộ
class _AddPetForBeneficiarySheet extends StatefulWidget {
  final void Function(Pet) onSave;

  const _AddPetForBeneficiarySheet({required this.onSave});

  @override
  State<_AddPetForBeneficiarySheet> createState() =>
      _AddPetForBeneficiarySheetState();
}

class _AddPetForBeneficiarySheetState
    extends State<_AddPetForBeneficiarySheet> {
  final _nameController = TextEditingController();
  final _speciesController = TextEditingController();
  final _breedController = TextEditingController();
  final _weightController = TextEditingController();
  String _gender = 'Đực';
  DateTime _dob = DateTime.now().subtract(const Duration(days: 365));

  @override
  void dispose() {
    _nameController.dispose();
    _speciesController.dispose();
    _breedController.dispose();
    _weightController.dispose();
    super.dispose();
  }

  void _save() {
    final name = _nameController.text.trim();
    final species = _speciesController.text.trim();
    final breed = _breedController.text.trim();
    final weight =
        double.tryParse(_weightController.text.replaceAll(',', '.')) ?? 0.0;
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập tên thú cưng')),
      );
      return;
    }
    if (species.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập loài')),
      );
      return;
    }
    final pet = Pet(
      // Id chỉ dùng tạm trong phiên đặt lịch, không gửi lên backend
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: name,
      species: species,
      breed: breed.isEmpty ? 'Chưa rõ' : breed,
      dateOfBirth: _dob,
      weight: weight > 0 ? weight : 1.0,
      gender: _gender,
    );
    widget.onSave(pet);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Thêm thú cưng',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
            const SizedBox(height: 16),
            _buildField('Tên thú cưng', _nameController, hint: 'VD: Cún'),
            const SizedBox(height: 12),
            _buildField('Loài', _speciesController, hint: 'VD: Chó, Mèo'),
            const SizedBox(height: 12),
            _buildField('Giống', _breedController,
                hint: 'VD: Golden (tùy chọn)'),
            const SizedBox(height: 12),
            _buildField('Cân nặng (kg)', _weightController,
                hint: 'VD: 5', keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            const Text(
              'Giới tính',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.stone700,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: _buildGenderChip('Đực'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildGenderChip('Cái'),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: AppColors.stone400),
                    ),
                    child: const Text('Hủy'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Thêm'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller,
      {String? hint, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.stone700,
          ),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: AppColors.stone50,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
      ],
    );
  }

  Widget _buildGenderChip(String value) {
    final isSelected = _gender == value;
    return GestureDetector(
      onTap: () => setState(() => _gender = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.stone100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone300,
          ),
        ),
        child: Center(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isSelected ? AppColors.white : AppColors.stone700,
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../config/env/environment.dart';
import '../../data/models/clinic.dart';
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
                      // Location info
                      if (provider.userAddress != null) _buildLocationCard(provider),
                      const SizedBox(height: 20),

                      // Booking type selection
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
          child: const Icon(Icons.arrow_back, color: AppColors.stone900, size: 20),
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

  Widget _buildLocationCard(BookingWizardProvider provider) {
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
                  const Text(
                    'Vị trí của bạn',
                    style: TextStyle(
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
            const Icon(Icons.edit_location_alt, color: AppColors.primary, size: 18),
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
              ? [const BoxShadow(color: AppColors.stone900, offset: Offset(3, 3))]
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
                color: isSelected ? AppColors.white.withValues(alpha: 0.8) : AppColors.stone500,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPetSelectionSection(BookingWizardProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Chọn thú cưng',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.stone900,
          ),
        ),
        const SizedBox(height: 12),

        if (provider.isLoadingPets)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (provider.error != null)
           Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.errorLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Column(
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
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
        else if (provider.myPets.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.stone100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.pets, size: 48, color: AppColors.stone400),
                  SizedBox(height: 8),
                  Text(
                    'Bạn chưa có thú cưng nào',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ...provider.myPets.map((pet) => _buildPetCard(provider, pet)),
      ],
    );
  }

  Widget _buildPetCard(BookingWizardProvider provider, pet) {
    final isSelected = provider.selectedPet?.id == pet.id;

    return GestureDetector(
      onTap: () => provider.selectPet(pet),
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

            // Selection indicator
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : AppColors.white,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.stone300,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: AppColors.white, size: 14)
                  : null,
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
        child: GestureDetector(
          onTap: provider.canProceedToServices
              ? () {
                  provider.loadServices();
                  context.push('/booking/services');
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
                  ? const [BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))]
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

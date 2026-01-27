import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/clinic_service.dart';
import '../../providers/booking_wizard_provider.dart';
import '../../utils/format_utils.dart';

/// Step 2: Select Services
class BookingSelectServicesScreen extends StatefulWidget {
  const BookingSelectServicesScreen({super.key});

  @override
  State<BookingSelectServicesScreen> createState() =>
      _BookingSelectServicesScreenState();
}

class _BookingSelectServicesScreenState
    extends State<BookingSelectServicesScreen> {
  final TextEditingController _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<BookingWizardProvider>();
      _notesController.text = provider.notes;
    });
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
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
              _buildProgressIndicator(2),

              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Selected pet info
                      _buildSelectedPetInfo(provider),
                      const SizedBox(height: 20),

                      // Services list
                      _buildServicesSection(provider),
                      const SizedBox(height: 24),

                      // Notes input
                      _buildNotesSection(provider),
                      const SizedBox(height: 24),

                      // Summary
                      if (provider.selectedServices.isNotEmpty)
                        _buildSummaryCard(provider),
                    ],
                  ),
                ),
              ),

              // Error Message
              if (provider.bookingError != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          provider.bookingError!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.errorDark,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
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
      title: const Text(
        'CHỌN DỊCH VỤ',
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: AppColors.stone900,
          letterSpacing: 0.5,
        ),
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

  Widget _buildSelectedPetInfo(BookingWizardProvider provider) {
    final pet = provider.selectedPet;
    if (pet == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.stone200,
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: pet.imageUrl != null
                  ? Image.network(pet.imageUrl!, fit: BoxFit.cover)
                  : const Icon(Icons.pets, color: AppColors.stone400),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pet.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: provider.bookingType == BookingType.atClinic
                  ? AppColors.blue100
                  : AppColors.teal100,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              provider.bookingType == BookingType.atClinic
                  ? 'Tại phòng khám'
                  : 'Tại nhà',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: provider.bookingType == BookingType.atClinic
                    ? AppColors.blue600
                    : AppColors.teal600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesSection(BookingWizardProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Dịch vụ có sẵn',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
              ),
            ),
            if (provider.selectedServices.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${provider.selectedServices.length} đã chọn',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.white,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (provider.isLoadingServices)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (provider.availableServices.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.stone100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.medical_services_outlined,
                      size: 48, color: AppColors.stone400),
                  SizedBox(height: 8),
                  Text(
                    'Không có dịch vụ nào',
                    style: TextStyle(fontSize: 14, color: AppColors.stone500),
                  ),
                ],
              ),
            ),
          )
        else
          ...provider.availableServices
              .map((s) => _buildServiceCard(provider, s)),
      ],
    );
  }

  Widget _buildServiceCard(
      BookingWizardProvider provider, ClinicServiceModel service) {
    final isSelected = provider.isServiceSelected(service.serviceId);
    final petWeight = provider.selectedPet?.weight ?? 0;

    return GestureDetector(
      onTap: () => provider.toggleService(service),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryBackground : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone300,
            width: 2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Service icon
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _getCategoryColor(service.serviceCategory ?? 'OTHER')
                        .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    _getCategoryIcon(service.serviceCategory ?? 'OTHER'),
                    color:
                        _getCategoryColor(service.serviceCategory ?? 'OTHER'),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),

                // Service info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        service.name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      if (service.description != null &&
                          service.description!.isNotEmpty)
                        Text(
                          service.description!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.stone500,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
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
                      color:
                          isSelected ? AppColors.primary : AppColors.stone300,
                      width: 2,
                    ),
                  ),
                  child: isSelected
                      ? const Icon(Icons.check,
                          color: AppColors.white, size: 14)
                      : null,
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Price and duration
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.coral.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    FormatUtils.formatCurrency(
                        service.getPriceForWeight(petWeight)),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.coral,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.stone200,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.schedule,
                          size: 12, color: AppColors.stone600),
                      const SizedBox(width: 4),
                      Text(
                        '${service.durationMinutes} phút',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.blue100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.event_seat,
                          size: 12, color: AppColors.blue600),
                      const SizedBox(width: 4),
                      Text(
                        '${service.slotsRequired} slot',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.blue600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (service.isHomeVisit) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.teal100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.home, size: 12, color: AppColors.teal600),
                        SizedBox(width: 4),
                        Text(
                          'Tại nhà',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.teal600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            // Show surcharge info if applicable
            if (service.hasSurchargeForWeight(petWeight)) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.info_outline, size: 12, color: AppColors.warning),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Phụ phí cân nặng ${service.getSurchargeForWeight(petWeight)!.minWeight.toStringAsFixed(0)}-${service.getSurchargeForWeight(petWeight)!.maxWeight.toStringAsFixed(0)}kg: +${FormatUtils.formatCurrency(service.getSurchargeForWeight(petWeight)!.price)}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _getCategoryColor(String category) {
    switch (category) {
      case 'GROOMING_SPA':
        return AppColors.pink500;
      case 'VACCINATION':
        return AppColors.blue600;
      case 'CHECK_UP':
        return AppColors.teal600;
      case 'SURGERY':
        return AppColors.coral;
      case 'DENTAL':
        return AppColors.yellow600;
      case 'DERMATOLOGY':
        return AppColors.purple500;
      default:
        return AppColors.stone600;
    }
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'GROOMING_SPA':
        return Icons.spa;
      case 'VACCINATION':
        return Icons.vaccines;
      case 'CHECK_UP':
        return Icons.health_and_safety;
      case 'SURGERY':
        return Icons.local_hospital;
      case 'DENTAL':
        return Icons.sentiment_satisfied_alt;
      case 'DERMATOLOGY':
        return Icons.healing;
      default:
        return Icons.medical_services;
    }
  }

  Widget _buildNotesSection(BookingWizardProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Ghi chú cho phòng khám',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.stone900,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone300),
          ),
          child: TextField(
            controller: _notesController,
            onChanged: provider.setNotes,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Mô tả triệu chứng hoặc ghi chú đặc biệt...',
              hintStyle: TextStyle(color: AppColors.stone400, fontSize: 13),
              border: InputBorder.none,
              contentPadding: EdgeInsets.all(12),
            ),
            style: const TextStyle(fontSize: 14, color: AppColors.stone900),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tóm tắt',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.stone900,
            ),
          ),
          const Divider(height: 16),
          ...provider.selectedServices.map((s) {
            final petWeight = provider.selectedPet?.weight ?? 0;
            final surcharge = s.getSurchargeForWeight(petWeight);
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          s.name,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.stone700,
                          ),
                        ),
                      ),
                      Text(
                        FormatUtils.formatCurrency(
                            s.getPriceForWeight(petWeight)),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone900,
                        ),
                      ),
                    ],
                  ),
                  if (surcharge != null) ...[
                    const SizedBox(height: 2),
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: AppColors.stone500,
                        ),
                        children: [
                          const TextSpan(text: '  └ Giá gốc '),
                          TextSpan(
                            text: FormatUtils.formatCurrency(s.basePrice),
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.stone600,
                            ),
                          ),
                          const TextSpan(text: ' + phụ phí '),
                          TextSpan(
                            text:
                                '+${FormatUtils.formatCurrency(surcharge.price)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.warning,
                            ),
                          ),
                          TextSpan(
                              text:
                                  ' (${surcharge.minWeight.toStringAsFixed(0)}-${surcharge.maxWeight.toStringAsFixed(0)}kg)'),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          }),
          // Show distance fee for home visit
          if (provider.bookingType == BookingType.homeVisit &&
              provider.distanceFee > 0) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.directions_car,
                          size: 14, color: AppColors.teal600),
                      const SizedBox(width: 4),
                      Text(
                        'Phí di chuyển (${provider.distanceToClinic.toStringAsFixed(1)}km)',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.teal700,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '+${FormatUtils.formatCurrency(provider.distanceFee)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.teal700,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tổng cộng',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                ),
              ),
              Text(
                FormatUtils.formatCurrency(provider.totalPrice),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Thời gian dự kiến',
                style: TextStyle(fontSize: 12, color: AppColors.stone500),
              ),
              Text(
                '${provider.totalDuration} phút',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.stone700,
                ),
              ),
            ],
          ),
        ],
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
          onTap: provider.canProceedToDateTime
              ? () => context.push('/booking/datetime')
              : null,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: provider.canProceedToDateTime
                  ? AppColors.primary
                  : AppColors.stone300,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: provider.canProceedToDateTime
                  ? const [
                      BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
                    ]
                  : null,
            ),
            child: const Center(
              child: Text(
                'CHỌN NGÀY GIỜ',
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

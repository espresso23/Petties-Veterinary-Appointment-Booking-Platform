import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../providers/booking_wizard_provider.dart';
import '../../utils/format_utils.dart';

/// Step 4: Booking Confirmation
class BookingConfirmScreen extends StatelessWidget {
  const BookingConfirmScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _buildAppBar(context),
      body: Consumer<BookingWizardProvider>(
        builder: (context, provider, _) {
          return Column(
            children: [
              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Success icon header
                      _buildHeader(),
                      const SizedBox(height: 24),

                      // Clinic info
                      _buildClinicCard(provider),
                      const SizedBox(height: 16),

                      // Booking details
                      _buildBookingDetailsCard(provider),
                      const SizedBox(height: 16),

                      // Pets and Services
                      _buildPetsAndServicesCard(provider),
                      const SizedBox(height: 16),

                      // Notes
                      if (provider.notes.isNotEmpty) ...[
                        _buildNotesCard(provider),
                        const SizedBox(height: 16),
                      ],

                      // Total
                      _buildTotalCard(provider),
                    ],
                  ),
                ),
              ),

              // Bottom button
              _buildBottomButton(context, provider),
            ],
          );
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
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
        'XÁC NHẬN ĐẶT LỊCH',
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: AppColors.stone900,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.teal100,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.teal600.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: AppColors.teal600,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.pets, color: AppColors.white, size: 28),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Kiểm tra thông tin',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Vui lòng kiểm tra kỹ thông tin trước khi xác nhận đặt lịch',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.stone600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicCard(BookingWizardProvider provider) {
    final clinic = provider.clinic;
    if (clinic == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.stone200,
              borderRadius: BorderRadius.circular(10),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: clinic.images != null && clinic.images!.isNotEmpty
                  ? Image.network(clinic.images!.first, fit: BoxFit.cover)
                  : const Icon(Icons.local_hospital, color: AppColors.stone400),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PHÒNG KHÁM',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AppColors.stone500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  clinic.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  clinic.address.isNotEmpty
                      ? clinic.address
                      : 'Chưa có địa chỉ',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.stone500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBookingDetailsCard(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'THÔNG TIN LỊCH HẸN',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          _buildDetailRow(
            Icons.calendar_today,
            'Ngày khám',
            provider.selectedDate != null
                ? FormatUtils.formatDate(provider.selectedDate!)
                : '-',
          ),
          const SizedBox(height: 10),
          _buildDetailRow(
            Icons.schedule,
            'Giờ khám',
            provider.selectedTime ?? '-',
          ),
          const SizedBox(height: 10),
          _buildDetailRow(
            provider.bookingType == BookingType.atClinic
                ? Icons.local_hospital
                : Icons.home,
            'Hình thức',
            provider.bookingType == BookingType.atClinic
                ? 'Tại phòng khám'
                : 'Tại nhà',
          ),
          if (provider.bookingType == BookingType.homeVisit &&
              provider.userAddress != null) ...[
            const SizedBox(height: 10),
            _buildDetailRow(
              Icons.location_on,
              'Địa chỉ khám',
              provider.userAddress!,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.stone500),
        const SizedBox(width: 10),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.stone600,
                ),
              ),
              Flexible(
                child: Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.stone900,
                  ),
                  textAlign: TextAlign.end,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPetsAndServicesCard(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.pets, size: 16, color: AppColors.stone500),
              SizedBox(width: 8),
              Text(
                'THÚ CƯNG & DỊCH VỤ',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.stone500,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...provider.selectedPets.map((pet) {
            final services = provider.getSelectedServicesForPet(pet.id);
            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.stone50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.stone200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Pet Header
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.stone200,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: pet.imageUrl != null
                              ? Image.network(pet.imageUrl!, fit: BoxFit.cover)
                              : const Icon(Icons.pets,
                                  color: AppColors.stone400, size: 20),
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
                              '${pet.weight} kg • ${pet.breed}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.stone500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  // Services
                  if (services.isEmpty)
                    const Text(
                      'Chưa chọn dịch vụ',
                      style: TextStyle(
                        fontStyle: FontStyle.italic,
                        color: AppColors.stone400,
                        fontSize: 13,
                      ),
                    )
                  else
                    ...services.map((service) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      service.name,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: AppColors.stone700,
                                      ),
                                    ),
                                    // Surcharge info
                                    if (service
                                        .hasSurchargeForWeight(pet.weight))
                                      Text(
                                        '(Phụ phí cân nặng: +${FormatUtils.formatCurrency(service.getSurchargeForWeight(pet.weight)!.price)})',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontStyle: FontStyle.italic,
                                          color: AppColors.stone500,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Text(
                                FormatUtils.formatCurrency(
                                    service.getPriceForWeight(pet.weight)),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.stone900,
                                ),
                              ),
                            ],
                          ),
                        )),
                ],
              ),
            );
          }),

          // Distance fee if applicable
          if (provider.bookingType == BookingType.homeVisit &&
              provider.distanceFee > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.directions_car,
                    size: 16, color: AppColors.teal600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Phí di chuyển (${provider.distanceToClinic.toStringAsFixed(1)}km)',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.teal700,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Text(
                  FormatUtils.formatCurrency(provider.distanceFee),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.teal700,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNotesCard(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'GHI CHÚ',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            provider.notes,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.stone700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalCard(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TỔNG CỘNG',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.stone500,
                  letterSpacing: 0.5,
                ),
              ),
              SizedBox(height: 2),
              Text(
                'Thanh toán tại phòng khám',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.stone500,
                ),
              ),
            ],
          ),
          Text(
            FormatUtils.formatCurrency(provider.totalPrice),
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButton(
      BuildContext context, BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone200)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (provider.bookingError != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.coral.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border:
                      Border.all(color: AppColors.coral.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppColors.coral, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        provider.bookingError!,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.coral,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            GestureDetector(
              onTap: provider.isCreatingBooking
                  ? null
                  : () async {
                      final success = await provider.createBooking();
                      if (success && context.mounted) {
                        // Navigate to success screen
                        context.go('/booking/success');
                      }
                    },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: provider.isCreatingBooking
                      ? AppColors.stone300
                      : AppColors.teal600,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: provider.isCreatingBooking
                      ? null
                      : const [
                          BoxShadow(
                              color: AppColors.stone900, offset: Offset(4, 4))
                        ],
                ),
                child: Center(
                  child: provider.isCreatingBooking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.white,
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle,
                                color: AppColors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'XÁC NHẬN ĐẶT LỊCH',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

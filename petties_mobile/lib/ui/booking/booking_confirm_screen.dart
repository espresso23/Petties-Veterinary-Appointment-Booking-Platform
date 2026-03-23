import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../providers/booking_wizard_provider.dart';
import '../../utils/format_utils.dart';
import '../../data/services/voucher_service.dart';
import '../booking/components/voucher_picker_bottom_sheet.dart';

/// Step 4: Booking Confirmation
class BookingConfirmScreen extends StatefulWidget {
  const BookingConfirmScreen({super.key});

  @override
  State<BookingConfirmScreen> createState() => _BookingConfirmScreenState();
}

class _BookingConfirmScreenState extends State<BookingConfirmScreen> {
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

                      // Payment method selection (show earlier to avoid being missed)
                      _buildPaymentMethodCard(provider),
                      const SizedBox(height: 16),

                      // Pets and Services
                      _buildPetsAndServicesCard(provider),
                      const SizedBox(height: 16),

                      // Voucher picker
                      _buildVoucherRow(context, provider),
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
            'Giờ đưa pet tới',
            provider.selectedTime ?? '-',
          ),
          const SizedBox(height: 10),
          _buildDetailRow(
            Icons.pets,
            'Giờ nhận pet dự kiến',
            provider.expectedPickupTime != null
                ? FormatUtils.formatDateTime(provider.expectedPickupTime!)
                : '-',
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
    final paymentLabel =
        provider.paymentMethod == 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR';
    final hasDiscount = provider.voucherDiscount > 0;
    final finalPrice = provider.totalPrice - provider.voucherDiscount;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'TỔNG CỘNG',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone500,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Phương thức: $paymentLabel',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (hasDiscount)
                    Text(
                      FormatUtils.formatCurrency(provider.totalPrice),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppColors.stone400,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  Text(
                    FormatUtils.formatCurrency(
                        hasDiscount ? finalPrice : provider.totalPrice),
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (hasDiscount) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.local_offer, size: 14, color: Colors.green.shade600),
                const SizedBox(width: 4),
                Text(
                  'Giảm ${FormatUtils.formatCurrency(provider.voucherDiscount)}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.green.shade600,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildVoucherRow(
      BuildContext context, BookingWizardProvider provider) {
    final hasVoucher = provider.selectedVoucherId != null;
    final clinicId = provider.clinic?.clinicId;
    if (clinicId == null) return const SizedBox.shrink();

    // Collect service categories from selected services
    final List<String> serviceCategories = [];
    for (final pet in provider.selectedPets) {
      final services = provider.getSelectedServicesForPet(pet.id);
      for (final svc in services) {
        if (svc.serviceCategory != null &&
            !serviceCategories.contains(svc.serviceCategory)) {
          serviceCategories.add(svc.serviceCategory!);
        }
      }
    }

    return GestureDetector(
      onTap: () async {
        final dynamic picked = await VoucherPickerBottomSheet.show(
          context: context,
          clinicId: clinicId,
          orderAmount: provider.totalPrice,
          selectedVoucherId: provider.selectedVoucherId,
          paymentMethod: provider.paymentMethod,
          serviceCategories: serviceCategories,
        );

        if (picked != null) {
          if (picked == false) {
            provider.setVoucher(null);
          } else if (picked is VoucherModel) {
            if (picked.voucherId != provider.selectedVoucherId) {
              provider.setVoucher(picked.voucherId,
                  discount: picked.discountAmount ?? 0);
            }
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: hasVoucher ? AppColors.primaryBackground : AppColors.stone50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: hasVoucher ? AppColors.primary : AppColors.stone300,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.local_offer,
              size: 18,
              color: hasVoucher ? AppColors.primary : AppColors.stone500,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                hasVoucher ? 'Voucher đã áp dụng' : 'Chọn voucher giảm giá',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: hasVoucher ? AppColors.primary : AppColors.stone700,
                ),
              ),
            ),
            if (hasVoucher && provider.voucherDiscount > 0)
              Text(
                '-${FormatUtils.formatCurrency(provider.voucherDiscount)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.green.shade600,
                ),
              ),
            const SizedBox(width: 4),
            Icon(
              Icons.chevron_right,
              size: 18,
              color: hasVoucher ? AppColors.primary : AppColors.stone400,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentMethodCard(BookingWizardProvider provider) {
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
            'PHƯƠNG THỨC THANH TOÁN',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          _buildPaymentOption(
            provider: provider,
            value: 'QR',
            title: 'Chuyển khoản QR',
            subtitle: 'Quét mã QR để thanh toán nhanh',
            icon: Icons.qr_code_2,
          ),
          const SizedBox(height: 10),
          _buildPaymentOption(
            provider: provider,
            value: 'CASH',
            title: 'Tiền mặt',
            subtitle: 'Thanh toán trực tiếp tại phòng khám',
            icon: Icons.payments,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentOption({
    required BookingWizardProvider provider,
    required String value,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final isSelected = provider.paymentMethod == value;
    return InkWell(
      onTap: () => provider.setPaymentMethod(value),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.08)
              : AppColors.stone50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone200,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                color: isSelected ? AppColors.primary : AppColors.stone500),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color:
                          isSelected ? AppColors.primary : AppColors.stone900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              isSelected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: isSelected ? AppColors.primary : AppColors.stone400,
              size: 20,
            ),
          ],
        ),
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
            AbsorbPointer(
              absorbing: provider.isCreatingBooking,
              child: GestureDetector(
                onTap: () async {
                  final result = await provider.createBooking();
                  if (!context.mounted || !result.success) {
                    return;
                  }
                  context.go('/booking/success');
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
            ),
          ],
        ),
      ),
    );
  }
}

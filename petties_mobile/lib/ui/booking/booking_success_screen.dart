import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../providers/booking_wizard_provider.dart';

/// Booking Success Screen
class BookingSuccessScreen extends StatelessWidget {
  const BookingSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: Consumer<BookingWizardProvider>(
        builder: (context, provider, _) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),

                  // Success animation/icon
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: AppColors.teal100,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.teal600, width: 4),
                      boxShadow: const [
                        BoxShadow(
                          color: AppColors.stone900,
                          offset: Offset(6, 6),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.check,
                      size: 64,
                      color: AppColors.teal600,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Success text
                  const Text(
                    'ĐẶT LỊCH THÀNH CÔNG!',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                      letterSpacing: 0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),

                  Text(
                    'Lịch hẹn của bạn tại ${provider.clinic?.name ?? "phòng khám"} đã được ghi nhận.',
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppColors.stone600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Phòng khám sẽ xác nhận và thông báo cho bạn sớm nhất.',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.stone500,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 32),

                  // Booking info summary
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.stone200),
                    ),
                    child: Column(
                      children: [
                        _buildInfoRow(
                          Icons.pets,
                          'Thú cưng',
                          provider.selectedPets.isNotEmpty
                              ? provider.selectedPets
                                  .map((p) => p.name)
                                  .join(', ')
                              : '-',
                        ),
                        const Divider(height: 16),
                        _buildInfoRow(
                          Icons.calendar_today,
                          'Ngày khám',
                          provider.selectedDate != null
                              ? _formatDate(provider.selectedDate!)
                              : '-',
                        ),
                        const Divider(height: 16),
                        _buildInfoRow(
                          Icons.schedule,
                          'Giờ khám',
                          provider.selectedTime ?? '-',
                        ),
                        const Divider(height: 16),
                        _buildInfoRow(
                          Icons.medical_services,
                          'Số dịch vụ',
                          '${provider.selectedPets.fold(0, (sum, pet) => sum + provider.getSelectedServicesForPet(pet.id).length)} dịch vụ',
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Action buttons
                  GestureDetector(
                    onTap: () {
                      provider.resetBooking();
                      // TODO: Navigate to my appointments when screen is ready
                      context.go('/pet-owner/home');
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.stone900, width: 2),
                        boxShadow: const [
                          BoxShadow(
                            color: AppColors.stone900,
                            offset: Offset(4, 4),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'XEM LỊCH HẸN CỦA TÔI',
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
                  const SizedBox(height: 12),

                  GestureDetector(
                    onTap: () {
                      provider.resetBooking();
                      context.go('/home');
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.stone300, width: 2),
                      ),
                      child: const Center(
                        child: Text(
                          'VỀ TRANG CHỦ',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.stone700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.stone500),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.stone500,
            ),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.stone900,
          ),
        ),
      ],
    );
  }

  String _formatDate(DateTime date) {
    const weekdays = [
      'Thứ 2',
      'Thứ 3',
      'Thứ 4',
      'Thứ 5',
      'Thứ 6',
      'Thứ 7',
      'CN'
    ];
    final weekday = weekdays[date.weekday - 1];
    return '$weekday, ${date.day}/${date.month}/${date.year}';
  }
}

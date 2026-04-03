import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/ai_chat.dart';
import 'ai_booking_confirmation.dart';
import 'ai_booking_quick_actions.dart';
import 'ai_chat_widgets.dart';

class AiServiceOptionCard extends StatelessWidget {
  final List<AiBookingServiceOption> services;
  final Set<String> selectedIds;
  final bool isBusy;
  final ValueChanged<AiBookingServiceOption> onToggleService;
  final VoidCallback onContinue;

  const AiServiceOptionCard({
    super.key,
    required this.services,
    required this.selectedIds,
    required this.isBusy,
    required this.onToggleService,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) return const SizedBox.shrink();

    final selectedCount = selectedIds.length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            selectedCount > 0
                ? 'Đã chọn $selectedCount dịch vụ. Bạn có thể chọn nhiều dịch vụ trước khi tiếp tục.'
                : 'Bạn có thể chọn một hoặc nhiều dịch vụ rồi bấm tiếp tục.',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.stone700,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: services.map((service) {
              final serviceId = service.id.trim();
              final isSelected =
                  serviceId.isNotEmpty && selectedIds.contains(serviceId);

              return FilterChip(
                selected: isSelected,
                onSelected: isBusy ? null : (_) => onToggleService(service),
                backgroundColor: AppColors.white,
                selectedColor: AppColors.primary.withValues(alpha: 0.14),
                checkmarkColor: AppColors.primary,
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.stone900,
                  width: 1.5,
                ),
                label: Text(
                  service.basePrice != null
                      ? '${service.name} (${service.basePrice!.toStringAsFixed(0)}đ)'
                      : service.name,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? AppColors.primary : AppColors.stone900,
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: isBusy || selectedCount == 0 ? null : onContinue,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                disabledBackgroundColor: AppColors.stone200,
                disabledForegroundColor: AppColors.stone500,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: const BorderSide(
                    color: AppColors.stone900,
                    width: 2,
                  ),
                ),
              ),
              child: Text(
                selectedCount > 0
                    ? 'TIẾP TỤC VỚI $selectedCount DỊCH VỤ'
                    : 'CHỌN DỊCH VỤ ĐỂ TIẾP TỤC',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AiSlotGridCard extends StatelessWidget {
  final AiSlotGridPayload slotGrid;
  final bool isBusy;
  final String Function(String? value) formatBookingDate;
  final ValueChanged<AiBookingSlotOption> onSelectSlot;

  const AiSlotGridCard({
    super.key,
    required this.slotGrid,
    required this.isBusy,
    required this.formatBookingDate,
    required this.onSelectSlot,
  });

  @override
  Widget build(BuildContext context) {
    final slots = <AiBookingSlotOption>[
      ...slotGrid.recommendedSlots,
      ...slotGrid.alternativeSlots,
    ];
    if (slots.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((slotGrid.bookingDate ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Ngày khám',
              value: formatBookingDate(slotGrid.bookingDate),
            ),
          if (slotGrid.serviceNames.isNotEmpty)
            _BookingInfoRow(
              label: 'Dịch vụ',
              value: slotGrid.serviceNames.join(', '),
            ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: slots.map((slot) {
              final endTime = slot.endTime?.trim();
              final label = endTime != null && endTime.isNotEmpty
                  ? '${slot.startTime} - $endTime'
                  : slot.startTime;

              return ActionChip(
                onPressed: isBusy ? null : () => onSelectSlot(slot),
                backgroundColor: AppColors.white,
                side: const BorderSide(color: AppColors.stone900, width: 1.5),
                label: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class AiStructuredBookingSummaryCard extends StatelessWidget {
  final AiBookingSummaryPayload summary;
  final bool isConfirmed;
  final bool isBusy;
  final List<AiBookingQuickAction> quickActions;
  final String Function(String? value) formatBookingDate;
  final ValueChanged<AiBookingQuickAction> onQuickAction;
  final VoidCallback onConfirm;

  const AiStructuredBookingSummaryCard({
    super.key,
    required this.summary,
    required this.isConfirmed,
    required this.isBusy,
    required this.quickActions,
    required this.formatBookingDate,
    required this.onQuickAction,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((summary.bookingDate ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Ngày khám',
              value: formatBookingDate(summary.bookingDate),
            ),
          if ((summary.startTime ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Giờ bắt đầu',
              value: summary.startTime ?? '',
            ),
          if ((summary.clinicName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Phòng khám',
              value: summary.clinicName ?? '',
            ),
          if ((summary.petName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Thú cưng',
              value: summary.petName ?? '',
            ),
          if (summary.serviceNames.isNotEmpty)
            _BookingInfoRow(
              label: 'Dịch vụ',
              value: summary.serviceNames.join(', '),
            ),
          if (!isConfirmed && quickActions.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'Sửa nhanh',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.stone700,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: quickActions.map((action) {
                return ActionChip(
                  onPressed: isBusy ? null : () => onQuickAction(action),
                  backgroundColor: AppColors.white,
                  side: const BorderSide(
                    color: AppColors.stone900,
                    width: 1.5,
                  ),
                  label: Text(
                    action.label,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone900,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: isConfirmed || isBusy ? null : onConfirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                elevation: 0,
                shadowColor: AppColors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: const BorderSide(
                    color: AppColors.stone900,
                    width: 2,
                  ),
                ),
              ),
              child: Text(
                isConfirmed ? 'ĐANG MỞ MÀN XÁC NHẬN' : 'MỞ MÀN XÁC NHẬN',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AiBookingCreatedCard extends StatelessWidget {
  final AiBookingCreatedPayload bookingCreated;
  final String Function(String? value) formatBookingDate;
  final VoidCallback? onViewBooking;

  const AiBookingCreatedCard({
    super.key,
    required this.bookingCreated,
    required this.formatBookingDate,
    this.onViewBooking,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.successDark, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.successDark, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((bookingCreated.bookingCode ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Mã booking',
              value: bookingCreated.bookingCode ?? '',
            ),
          if ((bookingCreated.petName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Thú cưng',
              value: bookingCreated.petName ?? '',
            ),
          if ((bookingCreated.clinicName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Phòng khám',
              value: bookingCreated.clinicName ?? '',
            ),
          if ((bookingCreated.date ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Ngày khám',
              value: formatBookingDate(bookingCreated.date),
            ),
          if ((bookingCreated.time ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Giờ bắt đầu',
              value: bookingCreated.time ?? '',
            ),
          if (bookingCreated.services.isNotEmpty)
            _BookingInfoRow(
              label: 'Dịch vụ',
              value: bookingCreated.services.join(', '),
            ),
          const SizedBox(height: 6),
          Text(
            bookingCreated.managerWillConfirm
                ? 'Yêu cầu đã được tạo. Clinic manager sẽ xác nhận sau.'
                : 'Booking đã được tạo thành công.',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.successDark,
            ),
          ),
          if (onViewBooking != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton(
                onPressed: onViewBooking,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.white,
                  foregroundColor: AppColors.successDark,
                  elevation: 0,
                  shadowColor: AppColors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(
                      color: AppColors.successDark,
                      width: 2,
                    ),
                  ),
                ),
                child: const Text(
                  'Xem lịch hẹn của tôi',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class AiBookingConfirmationCard extends StatelessWidget {
  final AiBookingConfirmationDraft draft;
  final bool isConfirmed;
  final bool isBusy;
  final String Function(String? value) formatBookingDate;
  final VoidCallback onConfirm;
  final VoidCallback onRequestChanges;

  const AiBookingConfirmationCard({
    super.key,
    required this.draft,
    required this.isConfirmed,
    required this.isBusy,
    required this.formatBookingDate,
    required this.onConfirm,
    required this.onRequestChanges,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.stone900, width: 1.5),
            ),
            child: const Row(
              children: [
                Icon(Icons.event_note, size: 16, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'XÁC NHẬN THÔNG TIN ĐẶT LỊCH',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              AiBookingMetaPill(
                icon: Icons.schedule,
                label: draft.startTime ?? 'Chưa rõ giờ',
                backgroundColor: AppColors.blue100,
                foregroundColor: AppColors.blue600,
              ),
              AiBookingMetaPill(
                icon: Icons.calendar_month,
                label: formatBookingDate(draft.bookingDate),
                backgroundColor: AppColors.successLight,
                foregroundColor: AppColors.successDark,
              ),
              if (draft.services.isNotEmpty)
                AiBookingMetaPill(
                  icon: Icons.medical_services_outlined,
                  label: '${draft.services.length} dịch vụ',
                  backgroundColor: AppColors.primarySurface,
                  foregroundColor: AppColors.primaryDark,
                ),
            ],
          ),
          const SizedBox(height: 12),
          _BookingInfoRow(
            label: 'Ngày khám',
            value: formatBookingDate(draft.bookingDate),
          ),
          _BookingInfoRow(
            label: 'Giờ bắt đầu',
            value: draft.startTime ?? 'Chưa rõ',
          ),
          if (draft.clinicName != null)
            _BookingInfoRow(
              label: 'Phòng khám',
              value: draft.clinicName ?? '',
            ),
          if (draft.petName != null)
            _BookingInfoRow(
              label: 'Thú cưng',
              value: draft.petName ?? '',
            ),
          _BookingInfoRow(
            label: 'Dịch vụ',
            value: draft.services.join(', '),
          ),
          const SizedBox(height: 10),
          const Text(
            'Nhấn để mở màn xác nhận đặt lịch chuẩn. Nếu chưa đúng, bạn có thể yêu cầu chỉnh lại thông tin.',
            style: TextStyle(
              fontSize: 11,
              height: 1.4,
              color: AppColors.stone700,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: isConfirmed || isBusy ? null : onConfirm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.white,
                    elevation: 0,
                    shadowColor: AppColors.transparent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(
                        color: AppColors.stone900,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    isConfirmed ? 'ĐANG MỞ MÀN XÁC NHẬN' : 'MỞ MÀN XÁC NHẬN',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: OutlinedButton(
                  onPressed: isBusy ? null : onRequestChanges,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.stone900,
                    side: const BorderSide(
                      color: AppColors.stone900,
                      width: 2,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    backgroundColor: AppColors.white,
                  ),
                  child: const Text(
                    'CHỈNH LẠI',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BookingInfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _BookingInfoRow({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.white.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.stone200),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              _iconForBookingLabel(label),
              size: 15,
              color: AppColors.primary,
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 80,
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone600,
                ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

IconData _iconForBookingLabel(String label) {
  switch (label) {
    case 'Ngày khám':
      return Icons.calendar_month;
    case 'Giờ bắt đầu':
      return Icons.schedule;
    case 'Phòng khám':
      return Icons.local_hospital_outlined;
    case 'Thú cưng':
      return Icons.pets_outlined;
    case 'Dịch vụ':
      return Icons.medical_services_outlined;
    default:
      return Icons.info_outline;
  }
}

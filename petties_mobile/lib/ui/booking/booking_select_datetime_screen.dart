import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/clinic_service.dart';
import '../../providers/booking_wizard_provider.dart';
import '../../utils/format_utils.dart';

/// Step 3: Select Date and Time
class BookingSelectDateTimeScreen extends StatefulWidget {
  const BookingSelectDateTimeScreen({super.key});

  @override
  State<BookingSelectDateTimeScreen> createState() =>
      _BookingSelectDateTimeScreenState();
}

class _BookingSelectDateTimeScreenState
    extends State<BookingSelectDateTimeScreen> {
  DateTime _focusedDay = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<BookingWizardProvider>();
      // Default select today if not already selected
      if (provider.selectedDate == null) {
        provider.selectDate(DateTime.now());
      }
    });
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
              _buildProgressIndicator(3),

              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Calendar
                      _buildCalendarSection(provider),
                      const SizedBox(height: 24),

                      // Time slots
                      _buildTimeSlotsSection(provider),
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
      title: const Text(
        'CHỌN NGÀY GIỜ',
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

  Widget _buildCalendarSection(BookingWizardProvider provider) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: TableCalendar(
        firstDay: DateTime.now(),
        lastDay: DateTime.now().add(const Duration(days: 60)),
        focusedDay: _focusedDay,
        selectedDayPredicate: (day) =>
            provider.selectedDate != null &&
            isSameDay(day, provider.selectedDate),
        onDaySelected: (selectedDay, focusedDay) {
          setState(() => _focusedDay = focusedDay);
          provider.selectDate(selectedDay);
        },
        calendarFormat: CalendarFormat.month,
        headerStyle: const HeaderStyle(
          formatButtonVisible: false,
          titleCentered: true,
          titleTextStyle: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.stone900,
          ),
          leftChevronIcon: Icon(Icons.chevron_left, color: AppColors.stone700),
          rightChevronIcon:
              Icon(Icons.chevron_right, color: AppColors.stone700),
        ),
        daysOfWeekStyle: const DaysOfWeekStyle(
          weekdayStyle: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.stone500,
          ),
          weekendStyle: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.coral,
          ),
        ),
        calendarStyle: CalendarStyle(
          todayDecoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.3),
            shape: BoxShape.circle,
          ),
          todayTextStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.stone900,
          ),
          selectedDecoration: const BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
          selectedTextStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.white,
          ),
          weekendTextStyle: const TextStyle(color: AppColors.coral),
          outsideDaysVisible: false,
        ),
        locale: 'vi_VN',
      ),
    );
  }

  Widget _buildTimeSlotsSection(BookingWizardProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Khung giờ khả dụng',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
              ),
            ),
            const Spacer(),
            if (provider.selectedDate != null)
              Text(
                FormatUtils.formatDate(provider.selectedDate!),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        // Legend
        _buildSlotsLegend(),
        const SizedBox(height: 12),
        if (provider.selectedDate == null)
          _buildNoDateSelected()
        else if (provider.isLoadingSlots)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (provider.availableSlots.isEmpty ||
            !_hasAvailableSlots(provider.availableSlots))
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (provider.availableSlots.isNotEmpty) _buildSlotsGrid(provider),
              if (provider.availableSlots.isNotEmpty)
                const SizedBox(height: 16),
              _buildNoSlotsAvailable(),
              if (provider.selectedTime != null) ...[
                const SizedBox(height: 16),
                _buildEstimatedPickupBlock(provider),
              ],
            ],
          )
        else
          _buildSlotsGrid(provider),
      ],
    );
  }

  Widget _buildEstimatedPickupBlock(BookingWizardProvider provider) {
    if (provider.isLoadingExpectedPickup) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.primaryBackground,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'Đang tính giờ nhận pet dự kiến...',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.stone600,
              ),
            ),
          ],
        ),
      );
    }
    if (provider.expectedPickupTime != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.teal100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.teal600.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.pets, size: 20, color: AppColors.teal700),
            const SizedBox(width: 10),
            Text(
              'Giờ nhận pet dự kiến: ${FormatUtils.formatTime(provider.expectedPickupTime!)}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.stone900,
              ),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildSlotsLegend() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.stone100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildLegendItem(AppColors.white, AppColors.stone300, 'Trống'),
          _buildLegendItem(AppColors.stone200, AppColors.stone300, 'Đã đặt'),
          _buildLegendItem(AppColors.coral.withValues(alpha: 0.15),
              AppColors.coral.withValues(alpha: 0.5), 'Nghỉ'),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color bgColor, Color borderColor, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: borderColor, width: 1.5),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.stone600,
          ),
        ),
      ],
    );
  }

  Widget _buildNoDateSelected() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.stone100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.calendar_today, size: 48, color: AppColors.stone400),
            SizedBox(height: 8),
            Text(
              'Chọn ngày để xem khung giờ',
              style: TextStyle(fontSize: 14, color: AppColors.stone500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoSlotsAvailable() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.coral.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.coral.withValues(alpha: 0.3)),
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.event_busy, size: 48, color: AppColors.coral),
            SizedBox(height: 8),
            Text(
              'Không có khung giờ trống',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.coral,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Tất cả khung giờ đã được đặt hoặc là giờ nghỉ.\nVui lòng chọn ngày khác.',
              style: TextStyle(fontSize: 12, color: AppColors.stone500),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Check if there's at least one available slot
  bool _hasAvailableSlots(List<AvailableSlot> slots) {
    return slots.any((s) => s.available);
  }

  Widget _buildSlotsGrid(BookingWizardProvider provider) {
    // Group slots by session (Morning, Afternoon, Evening)
    final morningSlots = provider.availableSlots
        .where((s) => _getHour(s.startTime) < 12)
        .toList();
    final afternoonSlots = provider.availableSlots
        .where((s) => _getHour(s.startTime) >= 12 && _getHour(s.startTime) < 17)
        .toList();
    final eveningSlots = provider.availableSlots
        .where((s) => _getHour(s.startTime) >= 17)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (morningSlots.isNotEmpty) ...[
          _buildSessionHeader('Buổi sáng', Icons.wb_sunny_outlined),
          _buildSlotChips(provider, morningSlots),
          const SizedBox(height: 16),
        ],
        if (afternoonSlots.isNotEmpty) ...[
          _buildSessionHeader('Buổi chiều', Icons.wb_cloudy_outlined),
          _buildSlotChips(provider, afternoonSlots),
          const SizedBox(height: 16),
        ],
        if (eveningSlots.isNotEmpty) ...[
          _buildSessionHeader('Buổi tối', Icons.nightlight_outlined),
          _buildSlotChips(provider, eveningSlots),
        ],
      ],
    );
  }

  int _getHour(String time) {
    // time format: "08:00" or "14:30"
    return int.tryParse(time.split(':')[0]) ?? 0;
  }

  Widget _buildSessionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.stone500),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.stone600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSlotChips(
      BookingWizardProvider provider, List<AvailableSlot> slots) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: slots.map((slot) {
        final isSelected = provider.selectedTimeSlots.contains(slot.startTime);

        // Check if slot is in the past
        bool isPastTime = false;
        if (provider.selectedDate != null &&
            isSameDay(provider.selectedDate!, DateTime.now())) {
          try {
            final parts = slot.startTime.split(':');
            final slotHour = int.parse(parts[0]);
            final slotMinute = int.parse(parts[1]);
            final now = DateTime.now();

            if (now.hour > slotHour ||
                (now.hour == slotHour && now.minute > slotMinute)) {
              isPastTime = true;
            }
          } catch (_) {}
        }

        final isAvailable = slot.available && !isPastTime;
        final isBreakTime = slot.isBreakTime;

        // Determine colors based on state
        Color bgColor;
        Color borderColor;
        Color textColor;

        if (isSelected) {
          // Single selected slot (drop-off time)
          bgColor = AppColors.primary;
          borderColor = AppColors.primary;
          textColor = AppColors.white;
        } else if (isBreakTime) {
          bgColor = AppColors.coral.withValues(alpha: 0.15);
          borderColor = AppColors.coral.withValues(alpha: 0.5);
          textColor = AppColors.coral;
        } else if (!isAvailable) {
          bgColor = AppColors.stone200;
          borderColor = AppColors.stone300;
          textColor = AppColors.stone400;
        } else {
          bgColor = AppColors.white;
          borderColor = AppColors.stone300;
          textColor = AppColors.stone700;
        }

        return Tooltip(
          message: isPastTime
              ? 'Đã qua giờ'
              : slot.reason ?? (isAvailable ? 'Khả dụng' : ''),
          child: GestureDetector(
            onTap:
                isAvailable ? () => provider.selectTime(slot.startTime) : null,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: borderColor, width: 2),
                boxShadow: isSelected
                    ? const [
                        BoxShadow(
                            color: AppColors.stone900, offset: Offset(2, 2))
                      ]
                    : null,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    slot.startTime,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: textColor,
                    ),
                  ),
                  if (isBreakTime) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Nghỉ',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: textColor.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      }).toList(),
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Error message
            if (provider.bookingError != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border:
                      Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppColors.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        provider.bookingError!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Selected datetime summary
            if (provider.selectedDate != null && provider.selectedTime != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.primaryBackground,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.event_available,
                            color: AppColors.primary, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${FormatUtils.formatDate(provider.selectedDate!)}',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.stone900,
                            ),
                          ),
                        ),
                        // Time
                        Text(
                          provider.selectedTime!,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Duration info
                    Row(
                      children: [
                        const Icon(Icons.schedule,
                            color: AppColors.stone500, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Thời gian dự kiến: ${provider.totalDuration} phút',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.stone500,
                          ),
                        ),
                      ],
                    ),
                    // Giờ nhận pet dự kiến (trong cùng ô)
                    if (provider.isLoadingExpectedPickup) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Đang tính giờ nhận pet dự kiến...',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.stone500,
                            ),
                          ),
                        ],
                      ),
                    ] else if (provider.expectedPickupTime != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.pets,
                              color: AppColors.stone500, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            'Giờ nhận pet dự kiến: ${FormatUtils.formatTime(provider.expectedPickupTime!)}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.stone700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

            // Chat với phòng khám (action triển khai sau)
            GestureDetector(
              onTap: () {
                // TODO: Chat với phòng khám - triển khai sau
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone400, width: 2),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.chat_bubble_outline,
                        size: 20, color: AppColors.stone700),
                    SizedBox(width: 8),
                    Text(
                      'Chat với phòng khám',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone700,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            GestureDetector(
              onTap: provider.canConfirmBooking
                  ? () {
                      // Clear any previous errors before navigating
                      provider.clearBookingError();
                      context.push('/booking/confirm');
                    }
                  : null,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: provider.canConfirmBooking
                      ? AppColors.primary
                      : AppColors.stone300,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: provider.canConfirmBooking
                      ? const [
                          BoxShadow(
                              color: AppColors.stone900, offset: Offset(4, 4))
                        ]
                      : null,
                ),
                child: const Center(
                  child: Text(
                    'XÁC NHẬN ĐẶT LỊCH',
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
          ],
        ),
      ),
    );
  }
}

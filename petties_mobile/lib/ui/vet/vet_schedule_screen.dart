import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/vet_shift.dart';
import '../../data/services/vet_shift_service.dart';
import '../../providers/auth_provider.dart';
import 'package:go_router/go_router.dart';
import '../../routing/app_routes.dart';
import '../../providers/notification_provider.dart';

// Design Tokens shortcuts
typedef Spacing = AppSpacing;
typedef Radius = AppRadius;
typedef Shadows = AppShadows;

class VetScheduleScreen extends StatefulWidget {
  const VetScheduleScreen({super.key});

  @override
  State<VetScheduleScreen> createState() => _VetScheduleScreenState();
}

class _VetScheduleScreenState extends State<VetScheduleScreen> {
  final VetShiftService _shiftService = VetShiftService();
  DateTime _focusedDate = DateTime.now();
  DateTime _selectedDate = DateTime.now();
  late List<DateTime> _weekDates;
  String _viewMode = 'Day'; // 'Day' or 'Week'

  List<VetShiftResponse> _shifts = [];
  bool _isLoading = false;
  VetShiftResponse? _selectedShift;
  bool _isLoadingDetail = false;
  String? _expandedDateWeekView;

  @override
  void initState() {
    super.initState();
    _updateWeekDates();
    // Defer data fetching to after first frame to prevent jank
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchShifts();
    });
  }

  void _updateWeekDates() {
    final firstDayOfWeek =
        _focusedDate.subtract(Duration(days: _focusedDate.weekday - 1));
    _weekDates =
        List.generate(7, (index) => firstDayOfWeek.add(Duration(days: index)));
  }

  Future<void> _fetchShifts() async {
    setState(() => _isLoading = true);
    try {
      final startDate = DateFormat('yyyy-MM-dd').format(_weekDates.first);
      final endDate = DateFormat('yyyy-MM-dd').format(_weekDates.last);

      final data = await _shiftService.getMyShifts(
        startDate: startDate,
        endDate: endDate,
      );

      setState(() {
        _shifts = data;
        _isLoading = false;
      });

      _updateSelectedShift();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi tải lịch trực: $e')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  void _updateSelectedShift() {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final dayShift = _shifts.where((s) {
      final shiftDate = s.displayDate ?? s.workDate;
      return shiftDate == dateStr && !s.isContinuation;
    }).toList();

    if (dayShift.isNotEmpty) {
      _fetchShiftDetail(dayShift.first.shiftId);
    } else {
      setState(() => _selectedShift = null);
    }
  }

  Future<void> _fetchShiftDetail(String shiftId) async {
    setState(() => _isLoadingDetail = true);
    try {
      final detail = await _shiftService.getShiftDetail(shiftId);
      setState(() {
        _selectedShift = detail;
        _isLoadingDetail = false;
      });
    } catch (e) {
      setState(() => _isLoadingDetail = false);
    }
  }

  void _toggleExpandWeek(DateTime date) {
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    setState(() {
      if (_expandedDateWeekView == dateStr) {
        _expandedDateWeekView = null;
      } else {
        _expandedDateWeekView = dateStr;
        _selectedDate = date;
        _updateSelectedShift();
      }
    });
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Chào buổi sáng,';
    if (hour < 18) return 'Chào buổi chiều,';
    return 'Chào buổi tối,';
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final user = authProvider.user;
    final userName = user?.fullName?.isNotEmpty == true
        ? user!.fullName!
        : (user?.username ?? 'Bác sĩ');
    final avatarUrl = user?.avatar;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(userName, avatarUrl),
            _buildViewModeToggle(),
            _buildWeekPicker(),
            Expanded(
              child: _isLoading
                  ? const Center(
                      child:
                          CircularProgressIndicator(color: AppColors.primary))
                  : _viewMode == 'Day'
                      ? _buildTimelineView()
                      : _buildWeekView(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(String userName, String? avatarUrl) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          // Avatar - Soft Neobrutalism style
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
              ],
            ),
            child: ClipOval(
              child: avatarUrl != null && avatarUrl.isNotEmpty
                  ? Image.network(
                      avatarUrl,
                      fit: BoxFit.cover,
                      width: 48,
                      height: 48,
                      errorBuilder: (context, error, stackTrace) => const Icon(
                          Icons.person,
                          color: AppColors.primary,
                          size: 28),
                    )
                  : const Icon(Icons.person,
                      color: AppColors.primary, size: 28),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _getGreeting(),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.stone500,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  userName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                  ),
                ),
              ],
            ),
          ),
          // Notification button - Soft Neobrutalism style
          Consumer<NotificationProvider>(
            builder: (context, notificationProvider, _) => Badge(
              label: Text(notificationProvider.unreadCount.toString()),
              isLabelVisible: notificationProvider.unreadCount > 0,
              backgroundColor: AppColors.error,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                  ],
                ),
                child: IconButton(
                  padding: EdgeInsets.zero,
                  icon: const Icon(Icons.notifications_outlined,
                      color: AppColors.stone900),
                  onPressed: () => context.push(AppRoutes.notifications),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildViewModeToggle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.stone100,
          borderRadius: BorderRadius.circular(25),
        ),
        padding: const EdgeInsets.all(4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildToggleButton('Day', _viewMode == 'Day'),
            _buildToggleButton('Week', _viewMode == 'Week'),
          ],
        ),
      ),
    );
  }

  Widget _buildToggleButton(String label, bool isActive) {
    return GestureDetector(
      onTap: () => setState(() => _viewMode = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isActive ? AppColors.stone900 : AppColors.stone500,
          ),
        ),
      ),
    );
  }

  Widget _buildWeekPicker() {
    return Column(
      children: [
        // Week navigation header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: () {
                  setState(() {
                    _focusedDate =
                        _focusedDate.subtract(const Duration(days: 7));
                    _updateWeekDates();
                    _fetchShifts();
                  });
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.stone100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.chevron_left,
                      size: 20, color: AppColors.stone700),
                ),
              ),
              Text(
                DateFormat('MMMM yyyy', 'vi').format(_focusedDate),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.stone700,
                ),
              ),
              GestureDetector(
                onTap: () {
                  setState(() {
                    _focusedDate = _focusedDate.add(const Duration(days: 7));
                    _updateWeekDates();
                    _fetchShifts();
                  });
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.stone100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.chevron_right,
                      size: 20, color: AppColors.stone700),
                ),
              ),
            ],
          ),
        ),
        // Days row
        Container(
          height: 85,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _weekDates.length,
            itemBuilder: (context, index) => _buildDayItem(_weekDates[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildDayItem(DateTime date) {
    final isSelected = DateUtils.isSameDay(date, _selectedDate);
    final isToday = DateUtils.isSameDay(date, DateTime.now());
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    final hasShift = _shifts.any(
        (s) => (s.displayDate ?? s.workDate) == dateStr && !s.isContinuation);

    final dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final dayName = dayNames[date.weekday - 1];

    return GestureDetector(
      onTap: () {
        setState(() => _selectedDate = date);
        _updateSelectedShift();
      },
      child: Container(
        width: 52,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : (isToday ? AppColors.primary : AppColors.stone200),
            width: isToday ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              dayName,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? Colors.white.withOpacity(0.8)
                    : AppColors.stone400,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              date.day.toString(),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isSelected ? Colors.white : AppColors.stone900,
              ),
            ),
            if (hasShift)
              Container(
                margin: const EdgeInsets.only(top: 4),
                width: 5,
                height: 5,
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeekView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: _weekDates.map((date) {
          final dateStr = DateFormat('yyyy-MM-dd').format(date);
          final dayShift = _shifts
              .where((s) =>
                  (s.displayDate ?? s.workDate) == dateStr && !s.isContinuation)
              .toList();

          final isToday = DateUtils.isSameDay(date, DateTime.now());
          final dayNames = [
            'Thứ 2',
            'Thứ 3',
            'Thứ 4',
            'Thứ 5',
            'Thứ 6',
            'Thứ 7',
            'CN'
          ];
          final dayName = dayNames[date.weekday - 1];

          final isExpanded = _expandedDateWeekView == dateStr;

          return InkWell(
            onTap: () => _toggleExpandWeek(date),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isToday ? AppColors.primarySurface : AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isToday ? AppColors.primary : AppColors.stone200,
                  width: isToday ? 2 : 1,
                ),
                boxShadow: isExpanded ? Shadows.md : Shadows.none,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      // Date Column
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color:
                              isToday ? AppColors.primary : AppColors.stone100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              date.day.toString(),
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color:
                                    isToday ? Colors.white : AppColors.stone900,
                              ),
                            ),
                            Text(
                              dayName,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: isToday
                                    ? Colors.white.withOpacity(0.8)
                                    : AppColors.stone500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Shift Info
                      Expanded(
                        child: dayShift.isEmpty
                            ? Text(
                                'Không có ca',
                                style: TextStyle(
                                  color: AppColors.stone400,
                                  fontWeight: FontWeight.w500,
                                ),
                              )
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: dayShift.map((shift) {
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.access_time,
                                          size: 16,
                                          color: AppColors.primary,
                                        ),
                                        const SizedBox(width: 6),
                                        Flexible(
                                          child: Text(
                                            '${shift.startTime.substring(0, 5)} - ${shift.endTime.substring(0, 5)}',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (shift.isOvernight)
                                          Container(
                                            margin:
                                                const EdgeInsets.only(left: 8),
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.indigo.shade50,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              'Ca đêm',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.indigo.shade700,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                      ),
                      // Stats or Arrow
                      if (dayShift.isNotEmpty)
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.stone100,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '${dayShift.first.availableSlots}/${dayShift.first.totalSlots}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.stone700,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Icon(
                              isExpanded
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              size: 18,
                              color: AppColors.stone400,
                            ),
                          ],
                        ),
                    ],
                  ),
                  if (isExpanded && dayShift.isNotEmpty) ...[
                    const Divider(height: 24),
                    if (_isLoadingDetail)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(8.0),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        ),
                      )
                    else if (_selectedShift != null)
                      _buildExpandedSlotsView(),
                  ],
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildExpandedSlotsView() {
    final slots = _selectedShift?.slots ?? [];
    if (slots.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Text('Không có dữ liệu slot'),
      );
    }

    return Column(
      children: [
        ...slots.map((slot) {
          final isBooked = slot.status == SlotStatus.BOOKED;
          final isAvailable = slot.status == SlotStatus.AVAILABLE;
          final isBlocked = slot.status == SlotStatus.BLOCKED;

          Color statusColor = Colors.green;
          if (isBlocked) statusColor = Colors.red;
          if (isBooked) statusColor = AppColors.primary;

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone100),
            ),
            child: Row(
              children: [
                Text(
                  slot.startTime.substring(0, 5),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.stone900,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 4,
                  height: 20,
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isBooked
                            ? (slot.petName ?? 'Đã được đặt')
                            : (isBlocked ? 'Đã khóa' : 'Trống'),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isBooked ? FontWeight.w600 : FontWeight.normal,
                          color: isBooked
                              ? AppColors.stone900
                              : (isBlocked ? Colors.red : AppColors.stone500),
                        ),
                      ),
                      if (isBooked && slot.petOwnerName != null)
                        Text(
                          slot.petOwnerName!,
                          style: TextStyle(
                              fontSize: 11, color: AppColors.stone500),
                        ),
                    ],
                  ),
                ),
                // Chỉ hiển thị icon trạng thái, không có button block/unblock
                Icon(
                  isBooked
                      ? Icons.info_outline
                      : (isBlocked ? Icons.lock : Icons.check_circle_outline),
                  size: 18,
                  color: isBooked
                      ? AppColors.stone400
                      : (isBlocked ? Colors.red : Colors.green),
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildTimelineView() {
    if (_selectedShift == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.event_available, size: 64, color: AppColors.stone200),
            const SizedBox(height: 16),
            Text(
              'Không có ca làm việc hôm nay',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.stone400,
                fontSize: 15,
              ),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: _buildTimelineSlots(),
    );
  }

  Widget _buildTimelineSlots() {
    final slots = _selectedShift?.slots ?? [];
    if (slots.isEmpty) {
      return const Center(child: Text('Không có slot khám'));
    }

    // Build timeline items with lunch break inserted at correct position
    List<Widget> timelineItems = [];
    bool lunchBreakAdded = false;

    final breakStart = _selectedShift?.breakStart;
    final breakEnd = _selectedShift?.breakEnd;

    for (int i = 0; i < slots.length; i++) {
      final slot = slots[i];
      final slotStartTime = slot.startTime.substring(0, 5); // "HH:mm"

      // Check if lunch break should be inserted before this slot
      if (!lunchBreakAdded && breakStart != null && breakEnd != null) {
        final breakStartTime = breakStart.substring(0, 5);
        if (slotStartTime.compareTo(breakStartTime) >= 0) {
          // Insert lunch break here
          timelineItems.add(_buildLunchBreakCard());
          lunchBreakAdded = true;
        }
      }

      timelineItems.add(_buildTimelineSlotCard(slot));
    }

    // If lunch break was not added (break is after all slots), add at end
    if (!lunchBreakAdded && breakStart != null && breakEnd != null) {
      timelineItems.add(_buildLunchBreakCard());
    }

    return Column(
      children: [
        ...timelineItems,
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildTimelineSlotCard(SlotResponse slot) {
    final bool isAvailable = slot.status == SlotStatus.AVAILABLE;
    final bool isBlocked = slot.status == SlotStatus.BLOCKED;
    final bool isBooked = slot.status == SlotStatus.BOOKED;

    Color statusColor = Colors.green;
    String statusText = 'Trống';
    if (isBlocked) {
      statusColor = Colors.red;
      statusText = 'Đã khóa';
    } else if (isBooked) {
      statusColor = AppColors.primary;
      statusText = 'Đã đặt';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time Column
          SizedBox(
            width: 50,
            child: Text(
              slot.startTime.substring(0, 5),
              style: TextStyle(
                fontSize: 12,
                color: AppColors.stone400,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          // Timeline Line
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.2),
                  shape: BoxShape.circle,
                  border: Border.all(color: statusColor, width: 2),
                ),
              ),
              Container(
                width: 2,
                height: 80,
                color: AppColors.stone200,
              ),
            ],
          ),
          const SizedBox(width: 12),
          // Card
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.stone100),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Pet Avatar placeholder
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: isBooked
                              ? AppColors.primarySurface
                              : AppColors.stone100,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Icon(
                          isBooked ? Icons.pets : Icons.access_time,
                          color:
                              isBooked ? AppColors.primary : AppColors.stone400,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isBooked
                                  ? (slot.petName ?? 'Thú cưng')
                                  : 'Slot ${slot.startTime.substring(0, 5)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: AppColors.stone900,
                              ),
                            ),
                            if (isBooked && slot.petOwnerName != null)
                              Text(
                                slot.petOwnerName!,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.stone500,
                                ),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          statusText,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  // Loại bỏ nút block/unblock - chỉ giữ lại Check In cho booked slots
                  if (isBooked) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Center(
                        child: Text(
                          'Check In',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLunchBreakCard() {
    if (_selectedShift?.breakStart == null ||
        _selectedShift?.breakEnd == null) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 50,
            child: Text(
              _selectedShift!.breakStart!.substring(0, 5),
              style: TextStyle(
                fontSize: 12,
                color: AppColors.stone400,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppColors.stone300,
                  shape: BoxShape.circle,
                ),
              ),
              Container(
                width: 2,
                height: 50,
                color: AppColors.stone200,
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.stone100,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.stone200,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Icon(Icons.free_breakfast,
                        color: AppColors.stone600, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Nghỉ trưa',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: AppColors.stone700,
                        ),
                      ),
                      Text(
                        '${_selectedShift!.breakStart!.substring(0, 5)} - ${_selectedShift!.breakEnd!.substring(0, 5)}',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.stone500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

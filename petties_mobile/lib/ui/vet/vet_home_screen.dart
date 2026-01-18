import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';
import '../../providers/notification_provider.dart';
import '../../data/services/vet_shift_service.dart';
import '../../data/models/vet_shift.dart';

/// VET Home Screen - Redesigned based on Image 0
/// Maintains existing functionality logic but with new UI structure.
class VetHomeScreen extends StatefulWidget {
  const VetHomeScreen({super.key});

  @override
  State<VetHomeScreen> createState() => _VetHomeScreenState();
}

class _VetHomeScreenState extends State<VetHomeScreen> {
  final VetShiftService _vetShiftService = VetShiftService();
  bool _isLoading = true;
  VetShiftResponse? _todayShift;
  List<SlotResponse> _upcomingSlots = [];

  @override
  void initState() {
    super.initState();
    // Defer data fetching to after first frame to prevent jank
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchData();
    });
  }

  Future<void> _fetchData() async {
    try {
      final now = DateTime.now();
      final todayStr = DateFormat('yyyy-MM-dd').format(now);

      // Fetch shifts for today to get appointment counts
      final shifts = await _vetShiftService.getMyShifts(
          startDate: todayStr, endDate: todayStr);

      if (shifts.isNotEmpty) {
        // We need detailed slots for today
        final shiftDetail =
            await _vetShiftService.getShiftDetail(shifts.first.shiftId);
        setState(() {
          _todayShift = shiftDetail;
          // Filter slots that are BOOKED and in the future (or just all booked for today)
          // For simplicity, showing all booked slots for today
          _upcomingSlots = shiftDetail.slots
                  ?.where((slot) => slot.status == SlotStatus.BOOKED)
                  .toList() ??
              [];
        });
      } else {
        setState(() {
          _todayShift = null;
          _upcomingSlots = [];
        });
      }
    } catch (e) {
      debugPrint('Error fetching vet home data: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;
    final now = DateTime.now();
    final dateStr = DateFormat('MMM d, EEEE').format(now);

    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchData,
          color: AppColors.primary,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Header Section
                _buildHeader(context, dateStr,
                    user?.fullName ?? user?.username ?? 'Doctor'),

                const SizedBox(height: 20),

                // 2. Search Bar
                _buildSearchBar(),

                const SizedBox(height: 24),

                // 3. Stats Dashboard (Grid)
                _buildDashboardGrid(),

                const SizedBox(height: 24),

                // 4. Upcoming Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Lịch hẹn sắp tới',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.stone900,
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push(AppRoutes.vetSchedule),
                      child: const Text('Xem tất cả',
                          style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _buildUpcomingList(),

                const SizedBox(height: 24),

                // 5. Quick Actions
                const Text(
                  'Thao tác nhanh',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                  ),
                ),
                const SizedBox(height: 12),
                _buildQuickActions(context),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNav(context),
    );
  }

  Widget _buildHeader(BuildContext context, String dateStr, String fullName) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                dateStr,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.stone500,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Xin chào, BS. $fullName',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.stone900,
                  letterSpacing: -0.5,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        Row(
          children: [
            // Notification Bell
            Consumer<NotificationProvider>(
              builder: (context, notificationProvider, _) => Stack(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(
                          color: AppColors.stone900,
                          offset: Offset(2, 2),
                        ),
                      ],
                    ),
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: const Icon(
                          Icons
                              .notifications_outlined, // Changed to outlined for style
                          color: AppColors.stone900),
                      onPressed: () => context.push(AppRoutes.notifications),
                    ),
                  ),
                  if (notificationProvider.unreadCount > 0)
                    Positioned(
                      top: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.white, width: 2),
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16, // Larger badge
                          minHeight: 16,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            // Avatar
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withOpacity(0.2), // Amber tint
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(2, 2),
                  ),
                ],
              ),
              child: const Icon(Icons.person, color: AppColors.primaryDark),
            ),
          ],
        )
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(
            color: AppColors.stone900,
            offset: Offset(4, 4),
          ),
        ],
      ),
      child: const Row(
        children: [
          Icon(Icons.search, color: AppColors.stone400),
          SizedBox(width: 12),
          Text(
            'Tìm kiếm lịch hẹn, bệnh nhân...',
            style: TextStyle(
                color: AppColors.stone400,
                fontSize: 14,
                fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildDashboardGrid() {
    final appointmentCount = _todayShift?.bookedSlots ?? 0;

    // We don't have APIs for these yet, so showing 0 or placeholders
    // Or we could remove them. Keeping structure but with 0.
    const pendingRequests = 0;
    const hospitalized = 0;

    return SizedBox(
      height: 180,
      child: Row(
        children: [
          // Large Primary Card (Amber now to match brand)
          Expanded(
            flex: 1,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.stone900, width: 3),
                boxShadow: const [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(4, 4),
                  )
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.white.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.calendar_today,
                            color: AppColors.white, size: 20),
                      ),
                      Icon(Icons.pets,
                          color: AppColors.white.withOpacity(0.3), size: 40),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _isLoading
                          ? const SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(
                                  color: AppColors.white, strokeWidth: 3))
                          : Text(
                              '$appointmentCount',
                              style: const TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.w900,
                                color: AppColors.white,
                              ),
                            ),
                      const Text(
                        'Lịch hẹn\nhôm nay',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.white,
                          height: 1.2,
                        ),
                      ),
                    ],
                  )
                ],
              ),
            ),
          ),
          const SizedBox(width: 16),
          // Right Column (2 Small Cards)
          Expanded(
            flex: 1,
            child: Column(
              children: [
                // Top Small Card
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(
                            color: AppColors.stone900, offset: Offset(3, 3)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  '$pendingRequests',
                                  style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.stone900),
                                ),
                              ),
                              const FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  'Chờ xử lý',
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.stone500),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.more_horiz,
                            color: AppColors.stone400, size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // Bottom Small Card
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(
                            color: AppColors.stone900, offset: Offset(3, 3)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  '$hospitalized',
                                  style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.stone900),
                                ),
                              ),
                              const FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  'Nội trú',
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.stone500),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                              color: AppColors.stone100,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color: AppColors.stone900, width: 1.5)),
                          child: const Icon(Icons.add,
                              color: AppColors.stone900, size: 16),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUpcomingList() {
    if (_isLoading) {
      return const Center(
          child: Padding(
        padding: EdgeInsets.all(20.0),
        child: CircularProgressIndicator(color: AppColors.primary),
      ));
    }

    if (_upcomingSlots.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.stone200, width: 2),
        ),
        child: const Column(
          children: [
            Icon(Icons.event_busy, size: 48, color: AppColors.stone300),
            SizedBox(height: 12),
            Text(
              "No upcoming appointments",
              style: TextStyle(
                  color: AppColors.stone500, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );
    }

    // Limit to 2 items
    final displaySlots = _upcomingSlots.take(2).toList();

    return Column(
      children: displaySlots.map((slot) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _buildAppointmentItem(
            petName: slot.petName ?? 'Unknown Pet',
            petInfo: 'Visit', // Missing breed info in basic slot response
            time: slot.startTime.substring(0, 5),
            ownerName: slot.petOwnerName ?? 'Unknown Owner',
            tag: 'BOOKED',
            tagColor: AppColors.warningLight,
            tagTextColor: AppColors.primaryDark,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAppointmentItem({
    required String petName,
    required String petInfo,
    required String time,
    required String ownerName,
    required String tag,
    required Color tagColor,
    required Color tagTextColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(
            color: AppColors.stone900,
            offset: Offset(4, 4),
          )
        ],
      ),
      child: Row(
        children: [
          // Date Box (Using today's date logic since we filter for today mainly)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.stone100,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.stone900, width: 1.5),
            ),
            child: const Column(
              children: [
                Icon(Icons.pets, color: AppColors.stone500, size: 20),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(petName,
                          style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppColors.stone900),
                          overflow: TextOverflow.ellipsis),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: tagColor,
                        borderRadius: BorderRadius.circular(8),
                        border:
                            Border.all(color: tagTextColor.withOpacity(0.3)),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: tagTextColor),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(petInfo,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.stone500,
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.access_time_filled,
                        size: 14, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(time,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.stone900)),
                    const SizedBox(width: 12),
                    const Icon(Icons.person,
                        size: 14, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(ownerName,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.stone900)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: () {
              // Navigate to Booking or Create Modal
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(20),
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
                      color: AppColors.successLight, // Green/Mint
                      borderRadius: BorderRadius.circular(12),
                      border:
                          Border.all(color: AppColors.successDark, width: 1.5),
                    ),
                    child: const Icon(Icons.add, color: AppColors.successDark),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Đặt lịch\nmới',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                              color: AppColors.stone900),
                        ),
                        Text(
                          'Lên lịch khám',
                          style: TextStyle(
                              fontSize: 11,
                              color: AppColors.stone500,
                              fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: InkWell(
            onTap: () {
              // Navigate to Patient List
              context.push(AppRoutes.vetPatients);
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(20),
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
                      color: AppColors.primary.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.primary, width: 1.5),
                    ),
                    child: const Icon(Icons.pets, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bệnh\nnhân',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                              color: AppColors.stone900),
                        ),
                        Text(
                          'Danh sách thú cưng',
                          style: TextStyle(
                              fontSize: 11,
                              color: AppColors.stone500,
                              fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone900, width: 2)),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(context, Icons.grid_view_rounded, 'Trang chủ', true, null),
          _buildNavItem(context, Icons.calendar_today_rounded, 'Lịch hẹn',
              false, () => context.push(AppRoutes.vetSchedule)),
          _buildNavItem(context, Icons.pets_rounded, 'Bệnh nhân', false, 
              () => context.push(AppRoutes.vetPatients)),
          _buildNavItem(
              context, Icons.folder_open_rounded, 'Hồ sơ', false, null),
          _buildNavItem(context, Icons.person_rounded, 'Cá nhân', false,
              () => context.push(AppRoutes.profile)),
        ],
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, IconData icon, String label,
      bool isActive, VoidCallback? onTap) {
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isActive ? AppColors.primary : AppColors.stone400,
            size: 26,
            shadows: isActive
                ? [
                    const Shadow(
                        color: AppColors.stone900, offset: Offset(1, 1))
                  ]
                : [],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: isActive ? AppColors.primary : AppColors.stone400,
            ),
          ),
        ],
      ),
    );
  }
}

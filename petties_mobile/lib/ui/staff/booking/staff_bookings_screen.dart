import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/booking.dart';
import '../../../data/services/booking_service.dart';
import '../../../data/services/auth_service.dart';
import '../../../routing/app_routes.dart';

class StaffBookingsScreen extends StatefulWidget {
  const StaffBookingsScreen({super.key});

  @override
  State<StaffBookingsScreen> createState() => _StaffBookingsScreenState();
}

class _StaffBookingsScreenState extends State<StaffBookingsScreen>
    with SingleTickerProviderStateMixin {
  final BookingService _bookingService = BookingService();
  late TabController _tabController;

  // My bookings
  List<BookingResponse> _bookings = [];
  bool _isLoading = true;
  String _selectedStatus = 'all';
  int _currentPage = 0;
  int _totalPages = 1;
  int _totalElements = 0;
  final int _pageSize = 20;

  // Clinic bookings (Shared Visibility)
  List<BookingResponse> _clinicBookings = [];
  bool _isLoadingClinic = false;
  String? _currentUserId;
  String? _clinicId;

  final List<Map<String, String>> _statusFilters = [
    {'label': 'Tất cả', 'value': 'all'},
    {'label': 'Chờ khám', 'value': 'CONFIRMED'},
    {'label': 'Đang khám', 'value': 'IN_PROGRESS'},
    {'label': 'Đã khám', 'value': 'COMPLETED'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _initUserInfo();
    _loadBookings();
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) {
      if (_tabController.index == 1 && _clinicBookings.isEmpty) {
        _loadClinicBookings();
      }
    }
  }

  Future<void> _initUserInfo() async {
    final user = await AuthService().getCurrentUser();
    if (user != null) {
      setState(() {
        _currentUserId = user.userId;
        _clinicId = user.workingClinicId;
      });
    }
  }

  Future<void> _loadBookings() async {
    setState(() => _isLoading = true);
    try {
      final response = await _bookingService.getBookingsByStaff(
        status: _selectedStatus,
        page: _currentPage,
        size: _pageSize,
      );

      final List<dynamic> content = response['content'] ?? [];
      final bookings = content.map((json) => BookingResponse.fromJson(json)).toList();

      setState(() {
        _bookings = bookings;
        _totalPages = response['totalPages'] ?? 1;
        _totalElements = response['totalElements'] ?? 0;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading bookings: $e');
      setState(() {
        _bookings = [];
        _isLoading = false;
      });
    }
  }

  Future<void> _loadClinicBookings() async {
    if (_clinicId == null) return;

    setState(() => _isLoadingClinic = true);
    try {
      final bookings = await _bookingService.getClinicTodayBookings(_clinicId!);
      setState(() {
        _clinicBookings = bookings;
        _isLoadingClinic = false;
      });
    } catch (e) {
      debugPrint('Error loading clinic bookings: $e');
      setState(() {
        _clinicBookings = [];
        _isLoadingClinic = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        title: const Text(
          'LỊCH HẸN',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.white,
          indicatorWeight: 3,
          labelColor: AppColors.white,
          unselectedLabelColor: AppColors.white.withOpacity(0.7),
          labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
          tabs: const [
            Tab(text: 'CỦA TÔI'),
            Tab(text: 'TẤT CẢ CLINIC'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMyBookingsTab(),
          _buildClinicBookingsTab(),
        ],
      ),
    );
  }

  /// Tab 1: My Bookings (existing logic)
  Widget _buildMyBookingsTab() {
    return Column(
      children: [
        // Filter section
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          color: AppColors.white,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: _statusFilters.map((filter) {
                final isActive = _selectedStatus == filter['value'];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(filter['label']!),
                    selected: isActive,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _selectedStatus = filter['value']!;
                          _currentPage = 0;
                        });
                        _loadBookings();
                      }
                    },
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: isActive ? AppColors.white : AppColors.stone600,
                      fontWeight: FontWeight.bold,
                    ),
                    backgroundColor: AppColors.stone100,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(
                        color: isActive ? AppColors.stone900 : AppColors.stone200,
                        width: 1,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),

        // Bookings list
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _bookings.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadBookings,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _bookings.length,
                        itemBuilder: (context, index) {
                          return _buildBookingCard(_bookings[index], isClinicView: false);
                        },
                      ),
                    ),
        ),

        // Pagination
        if (!_isLoading && _bookings.isNotEmpty) _buildPagination(),
      ],
    );
  }

  /// Tab 2: Clinic Bookings (Shared Visibility)
  Widget _buildClinicBookingsTab() {
    return Column(
      children: [
        // Info banner
        Container(
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.blue.shade200, width: 2),
          ),
          child: Row(
            children: [
              Icon(Icons.info_outline, color: Colors.blue.shade600, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Tất cả lịch hẹn hôm nay của phòng khám. Bạn có thể thêm bệnh án cho bệnh nhân đang khám.',
                  style: TextStyle(color: Colors.blue.shade700, fontSize: 12),
                ),
              ),
            ],
          ),
        ),

        // Bookings list
        Expanded(
          child: _isLoadingClinic
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _clinicBookings.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadClinicBookings,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _clinicBookings.length,
                        itemBuilder: (context, index) {
                          return _buildBookingCard(_clinicBookings[index], isClinicView: true);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.calendar_today_outlined, size: 64, color: AppColors.stone300),
          const SizedBox(height: 16),
          Text(
            'Không tìm thấy lịch hẹn nào',
            style: TextStyle(color: AppColors.stone500, fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildBookingCard(BookingResponse booking, {required bool isClinicView}) {
    // Format time display
    String timeDisplay = booking.bookingTime != null ? booking.bookingTime!.substring(0, 5) : '--:--';

    // Format date display
    String dateDisplay = '--/--';
    if (booking.bookingDate != null) {
      try {
        final date = DateTime.parse(booking.bookingDate!);
        dateDisplay = DateFormat('dd/MM').format(date);
      } catch (_) {}
    }

    // Check if this is my booking (for Clinic view)
    final isMyBooking = isClinicView
        ? booking.services.any((s) => s.assignedStaffId == _currentUserId)
        : true;

    return GestureDetector(
      onTap: () => context.push(AppRoutes.staffBookingDetail.replaceAll(':bookingId', booking.bookingId ?? '')),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isClinicView && isMyBooking ? Colors.amber.shade50 : AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isClinicView && isMyBooking ? Colors.amber.shade400 : AppColors.stone900,
            width: 2,
          ),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                // Date box
                Container(
                  width: 50,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.stone100,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.stone900, width: 1.5),
                  ),
                  child: Column(
                    children: [
                      Text(
                        dateDisplay.split('/')[0],
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                      ),
                      Text(
                        'Th ${dateDisplay.split('/')[1]}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                // Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              booking.petName ?? 'N/A',
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          _buildStatusBadge(booking.status ?? ''),
                          if (isClinicView && isMyBooking) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.amber.shade600,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Của tôi',
                                style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Chủ: ${booking.ownerName ?? 'N/A'}',
                        style: TextStyle(color: AppColors.stone500, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.access_time, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            timeDisplay,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const SizedBox(width: 12),
                          const Icon(Icons.medical_services_outlined, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              booking.services.isNotEmpty ? booking.services[0].serviceName ?? 'Dịch vụ' : 'Dịch vụ',
                              style: const TextStyle(fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            // Show assigned staff for clinic view (if not my booking)
            if (isClinicView && !isMyBooking && booking.assignedStaffName != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.stone100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline, size: 14, color: AppColors.stone500),
                    const SizedBox(width: 6),
                    Text(
                      'Phụ trách: ${booking.assignedStaffName}',
                      style: const TextStyle(fontSize: 12, color: AppColors.stone600),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    Color bgColor;
    String text = status;

    switch (status) {
      case 'IN_PROGRESS':
        color = Colors.blue;
        bgColor = Colors.blue.withOpacity(0.1);
        text = 'Đang khám';
        break;
      case 'CONFIRMED':
        color = Colors.orange;
        bgColor = Colors.orange.withOpacity(0.1);
        text = 'Chờ khám';
        break;
      case 'COMPLETED':
        color = Colors.green;
        bgColor = Colors.green.withOpacity(0.1);
        text = 'Đã khám';
        break;
      case 'CANCELLED':
        color = Colors.red;
        bgColor = Colors.red.withOpacity(0.1);
        text = 'Đã hủy';
        break;
      default:
        color = AppColors.stone500;
        bgColor = AppColors.stone100;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _buildPagination() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone200)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Tổng cộng $_totalElements lịch hẹn',
            style: TextStyle(color: AppColors.stone500, fontSize: 13),
          ),
          Row(
            children: [
              IconButton(
                onPressed: _currentPage > 0
                    ? () {
                        setState(() => _currentPage--);
                        _loadBookings();
                      }
                    : null,
                icon: const Icon(Icons.chevron_left),
                iconSize: 20,
              ),
              Text('${_currentPage + 1}/$_totalPages'),
              IconButton(
                onPressed: _currentPage < _totalPages - 1
                    ? () {
                        setState(() => _currentPage++);
                        _loadBookings();
                      }
                    : null,
                icon: const Icon(Icons.chevron_right),
                iconSize: 20,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

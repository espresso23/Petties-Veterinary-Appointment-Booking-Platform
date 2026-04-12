import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:async';
import '../../config/constants/app_colors.dart';
import '../../data/models/booking.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/qr_payment_service.dart';
import '../../data/services/review_service.dart';
import '../../data/services/sos_matching_service.dart';
import '../../routing/app_routes.dart';
import '../../utils/format_utils.dart';
import 'write_review_screen.dart';
import 'report_booking_dialog.dart';

/// Tab hiển thị lịch sử đặt lịch của Pet Owner
class MyBookingsTab extends StatefulWidget {
  const MyBookingsTab({super.key});

  @override
  State<MyBookingsTab> createState() => _MyBookingsTabState();
}

class _MyBookingsTabState extends State<MyBookingsTab>
    with SingleTickerProviderStateMixin {
  final BookingService _bookingService = BookingService();
  final QrPaymentService _qrPaymentService = QrPaymentService();
  List<BookingResponse> _bookings = []; // Lịch hẹn của tôi
  List<BookingResponse> _proxyBookings = []; // Lịch hẹn đặt hộ
  bool _isLoading = true;
  TabController? _tabController;

  @override
  void initState() {
    super.initState();
    // Updated to 5 tabs
    _tabController = TabController(length: 5, vsync: this);
    _fetchBookings();
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  Future<void> _fetchBookings() async {
    setState(() => _isLoading = true);
    try {
      // Fetch cả lịch hẹn của tôi và lịch hẹn đặt hộ
      final results = await Future.wait<List<BookingResponse>>([
        _bookingService.getMyBookings(size: 20),
        _bookingService.getMyProxyBookings(size: 20),
      ]);
      if (mounted) {
        setState(() {
          _bookings = results[0];
          _proxyBookings = results[1];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Tab Bar
        Container(
          color: AppColors.white,
          child: TabBar(
            controller: _tabController,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.stone500,
            indicatorColor: AppColors.primary,
            labelStyle:
                const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            labelPadding: const EdgeInsets.symmetric(horizontal: 12),
            isScrollable: true,
            tabAlignment:
                TabAlignment.start, // Align tabs to start, no leading space
            tabs: const [
              Tab(text: 'Chờ duyệt'),
              Tab(text: 'Đã duyệt'),
              Tab(text: 'Đang diễn ra'), // New Tab
              Tab(text: 'Hoàn thành'),
              Tab(text: 'Đã hủy'),
            ],
          ),
        ),

        // Content
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tabController,
                  children: [
                    // Tab 1: Chờ xác nhận
                    _buildStatusSection(
                      myBookings:
                          _filterByStatuses(_bookings, const ['PENDING']),
                      proxyBookings:
                          _filterByStatuses(_proxyBookings, const ['PENDING']),
                    ),

                    // Tab 2: Đã duyệt (CONFIRMED)
                    _buildStatusSection(
                      myBookings:
                          _filterByStatuses(_bookings, const ['CONFIRMED']),
                      proxyBookings: _filterByStatuses(
                          _proxyBookings, const ['CONFIRMED']),
                    ),

                    // Tab 3: Đang diễn ra (IN_PROGRESS)
                    _buildStatusSection(
                      myBookings:
                        _filterByStatuses(_bookings, const ['IN_PROGRESS']),
                      proxyBookings: _filterByStatuses(
                        _proxyBookings, const ['IN_PROGRESS']),
                    ),

                    // Tab 4: Hoàn thành
                    _buildStatusSection(
                      myBookings:
                        _filterByStatuses(_bookings, const ['COMPLETED']),
                      proxyBookings: _filterByStatuses(
                        _proxyBookings, const ['COMPLETED']),
                    ),

                    // Tab 5: Đã hủy (CANCELLED, REJECTED, NO_SHOW)
                    _buildStatusSection(
                      myBookings: _filterByStatuses(_bookings,
                          const ['CANCELLED', 'REJECTED', 'NO_SHOW']),
                      proxyBookings: _filterByStatuses(_proxyBookings,
                          const ['CANCELLED', 'REJECTED', 'NO_SHOW']),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  /// Lọc danh sách booking theo nhiều trạng thái
  List<BookingResponse> _filterByStatuses(
      List<BookingResponse> source, List<String> statuses) {
    return source.where((b) => statuses.contains(b.status)).toList();
  }

  /// Mỗi tab trạng thái gồm 2 tab con: Lịch hẹn của tôi / Lịch hẹn đặt hộ
  Widget _buildStatusSection({
    required List<BookingResponse> myBookings,
    required List<BookingResponse> proxyBookings,
  }) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: AppColors.white,
            child: const TabBar(
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.stone500,
              indicatorColor: AppColors.primary,
              labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              tabs: [
                Tab(text: 'Lịch hẹn của tôi'),
                Tab(text: 'Lịch hẹn đặt hộ'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildBookingList(myBookings),
                _buildBookingList(proxyBookings),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBookingList(List<BookingResponse> bookings) {
    if (bookings.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_today_outlined,
                size: 64, color: AppColors.stone300),
            const SizedBox(height: 16),
            const Text(
              'Chưa có lịch hẹn nào',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.stone500,
              ),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () {
                // Sẽ được handle bởi parent hoặc context.go
                // Ở đây chúng ta có thể gọi callback nếu cần,
                // nhưng đơn giản nhất là bảo user qua tab Khám phá
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
              ),
              child: const Text('Đặt lịch ngay'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchBookings,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: bookings.length,
        separatorBuilder: (context, index) => const SizedBox(height: 16),
        itemBuilder: (context, index) {
          final booking = bookings[index];
          return _buildBookingItem(booking);
        },
      ),
    );
  }

  Widget _buildBookingItem(BookingResponse booking) {
    // Determine status color for left border strip
    Color statusColor;
    switch (booking.status) {
      case 'PENDING':
        statusColor = Colors.orange;
        break;
      case 'CONFIRMED':
        statusColor = Colors.blue;
        break;
      case 'IN_PROGRESS':
        statusColor = Colors.purple;
        break;
      case 'COMPLETED':
        statusColor = Colors.green;
        break;
      case 'CANCELLED':
      case 'REJECTED':
      case 'NO_SHOW':
        statusColor = AppColors.coral;
        break;
      default:
        statusColor = AppColors.stone400;
    }

    return GestureDetector(
      onTap: () async {
        // Navigate to booking detail and wait for result (in case cancellation happened there)
        final bookingId = booking.bookingId;
        if (bookingId == null || bookingId.isEmpty) {
          return;
        }

        final bookingDetailPath =
            AppRoutes.bookingDetails.replaceFirst(':id', bookingId);
        final result = await context.push(bookingDetailPath);
        if (result == 'CANCEL' && context.mounted) {
          _showCancelDialog(context, booking);
        } else if (result != null && context.mounted) {
          // Refresh list if any changes
          _fetchBookings();
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.stone200),
          boxShadow: [
            BoxShadow(
              color: AppColors.stone900.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Column(
            children: [
              // Header: Status Badge & Price
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.08),
                  border: Border(
                    bottom: BorderSide(
                      color: statusColor.withValues(alpha: 0.15),
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        _buildStatusBadge(booking.status),
                        if (booking.paymentStatus != null) ...[
                          const SizedBox(width: 8),
                          _buildPaymentBadge(booking.paymentStatus!),
                        ],
                        if (booking.type == 'SOS') ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.red.shade100,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                  color: Colors.red.shade400, width: 1),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.emergency,
                                    size: 12, color: Colors.red.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  'SOS',
                                  style: TextStyle(
                                    color: Colors.red.shade700,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          FormatUtils.formatCurrency(booking.totalPrice ?? 0),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Body: Info
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Main layout: Left (Icon) - Right (Content)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Clinic Image / Icon
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: booking.type == 'SOS'
                                ? Colors.red.shade50
                                : AppColors.stone100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            booking.type == 'SOS'
                                ? Icons.emergency_rounded
                                : Icons.local_hospital_rounded,
                            color: booking.type == 'SOS'
                                ? Colors.red.shade700
                                : AppColors.stone500,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Details
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Clinic Name
                              Text(
                                booking.clinicName ?? 'Phòng khám',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.stone900,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),

                              // Date & Time
                              Row(
                                children: [
                                  const Icon(Icons.calendar_month_rounded,
                                      size: 14, color: AppColors.stone500),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${_formatDateString(booking.bookingDate)} • ${_formatTime(booking.bookingTime)}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.stone600,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),
                    const Divider(height: 1, color: AppColors.stone200),
                    const SizedBox(height: 12),

                    // Additional Info Grid (Pet, Services, Vet)
                    Row(
                      children: [
                        // Pet
                        Expanded(
                            child: _buildCompactInfo(
                          Icons.pets_rounded,
                          booking.pets.length > 1
                              ? '${booking.petName ?? booking.pets.first.petName} (+${booking.pets.length - 1})'
                              : (booking.petName ??
                                  (booking.pets.isNotEmpty
                                      ? booking.pets.first.petName ?? 'Thú cưng'
                                      : 'Thú cưng')),
                          AppColors.primary,
                        )),

                        // Services count
                        Expanded(
                            child: _buildCompactInfo(
                          Icons.medical_services_rounded,
                          '${booking.services.length} dịch vụ',
                          AppColors.teal600,
                        )),
                      ],
                    ),

                    // Assigned Staff (if any)
                    if (booking.assignedStaffName != null) ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.stone200,
                            ),
                            child: CircleAvatar(
                              radius: 10,
                              backgroundColor: AppColors.white,
                              backgroundImage:
                                  booking.assignedStaffAvatarUrl != null
                                      ? NetworkImage(
                                          booking.assignedStaffAvatarUrl!)
                                      : null,
                              child: booking.assignedStaffAvatarUrl == null
                                  ? const Icon(Icons.person,
                                      size: 14, color: AppColors.stone400)
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'BS. ${booking.assignedStaffName}',
                            style: const TextStyle(
                              fontSize: 13,
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

              // Footer: Action Buttons
              if (booking.status == 'PENDING' ||
                  (booking.type == 'SOS' &&
                      ['CONFIRMED', 'IN_PROGRESS'].contains(booking.status)) ||
                  ['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED']
                      .contains(booking.status))
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    color: AppColors.stone50,
                    border: Border(top: BorderSide(color: AppColors.stone200)),
                  ),
                  child: Row(
                    children: [
                      // Review Button or Rating Display (Left)
                      if (booking.status == 'COMPLETED')
                        if (booking.isReviewed != true)
                          // === CHƯA ĐÁNH GIÁ ===
                          GestureDetector(
                            onTap: () {
                              Navigator.of(context)
                                  .push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      WriteReviewScreen(booking: booking),
                                ),
                              )
                                  .then((value) {
                                if (value == true) {
                                  _fetchBookings();
                                }
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity(0.05),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: Colors.amber.shade300, width: 1),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.star_border_rounded,
                                      size: 16, color: Colors.amber),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Đánh giá',
                                    style: TextStyle(
                                      color: Colors.amber.shade700,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (booking.rating != null)
                          // === ĐÃ ĐÁNH GIÁ ===
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              GestureDetector(
                                onTap: () => _openClinicReviewSection(booking),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                        color: Colors.amber, width: 1),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.star_rounded,
                                          size: 16, color: Colors.amber),
                                      const SizedBox(width: 6),
                                      const Text(
                                        'Xem đánh giá',
                                        style: TextStyle(
                                          color: Colors.amber,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              // Edit pen icon
                              InkWell(
                                onTap: () {
                                  Navigator.of(context)
                                      .push(
                                    MaterialPageRoute(
                                      builder: (_) => WriteReviewScreen(
                                          booking: booking, isEditMode: true),
                                    ),
                                  )
                                      .then((value) {
                                    if (value == true) {
                                      _fetchBookings();
                                    }
                                  });
                                },
                                borderRadius: BorderRadius.circular(20),
                                child: const Padding(
                                  padding: EdgeInsets.all(4.0),
                                  child: Icon(Icons.edit_rounded,
                                      size: 15, color: AppColors.stone400),
                                ),
                              ),
                              // "..." menu to delete
                              SizedBox(
                                width: 24,
                                height: 24,
                                child: PopupMenuButton<String>(
                                  padding: EdgeInsets.zero,
                                  icon: const Icon(Icons.more_vert_rounded,
                                      size: 16, color: AppColors.stone400),
                                  iconSize: 16,
                                  onSelected: (value) async {
                                    if (value == 'delete') {
                                      _showDeleteReviewDialog(context, booking);
                                    }
                                  },
                                  itemBuilder: (context) => [
                                    const PopupMenuItem<String>(
                                      value: 'delete',
                                      child: Row(
                                        children: [
                                          Icon(Icons.delete_outline_rounded,
                                              size: 18, color: Colors.red),
                                          SizedBox(width: 8),
                                          Text('Xóa đánh giá',
                                              style: TextStyle(
                                                color: Colors.red,
                                                fontSize: 14,
                                              )),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                      // Spacer to push everything else to the right
                      const Spacer(),

                      // Actions (Right)
                      if (booking.type == 'SOS' &&
                          ['CONFIRMED', 'IN_PROGRESS'].contains(booking.status))
                        Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: _buildActionButton(
                            label: 'THEO DÕI',
                            color: Colors.blue.shade700,
                            isFilled: true,
                            onTap: () => context.push(
                                '/sos/tracking/${booking.bookingId}',
                                extra: booking),
                          ),
                        ),

                      if (booking.status == 'PENDING')
                        Row(
                          mainAxisSize: MainAxisSize
                              .min, // Ensure Row takes minimum necessary width
                          children: [
                            // Contact Button - Always show
                            Padding(
                              padding: const EdgeInsets.only(right: 8.0),
                              child: _buildActionButton(
                                label: 'LIÊN HỆ',
                                color: AppColors.stone500,
                                isOutlined: true,
                                onTap: () {
                                  if (booking.clinicId != null) {
                                    context.push(Uri(
                                        path: '/chat/detail',
                                        queryParameters: {
                                          'clinicId': booking.clinicId
                                        }).toString());
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                          content: Text(
                                              'Không tìm thấy thông tin phòng khám')),
                                    );
                                  }
                                },
                              ),
                            ),
                            _buildActionButton(
                              label: booking.type == 'SOS'
                                  ? 'HỦY SOS'
                                  : 'HỦY LỊCH',
                              color: AppColors.coral,
                              isOutlined: true,
                              onTap: () => booking.type == 'SOS'
                                  ? _showSosCancelDialog(context, booking)
                                  : _showCancelDialog(context, booking),
                            ),
                          ],
                        ),

                      // SOS Cancel for CONFIRMED status
                      if (booking.type == 'SOS' &&
                          ['CONFIRMED'].contains(booking.status))
                        _buildActionButton(
                          label: 'HỦY SOS',
                          color: Colors.red.shade700,
                          isOutlined: true,
                          onTap: () => _showSosCancelDialog(context, booking),
                        ),
                      if (booking.status == 'COMPLETED')
                        Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: _buildActionButton(
                            label: 'BÁO CÁO',
                            color: AppColors.error,
                            isOutlined: true,
                            onTap: () =>
                                showReportBookingDialog(context, booking),
                          ),
                        ),
                      if (['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED', 'IN_PROGRESS']
                          .contains(booking.status))
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (_isQrPaymentVisible(booking)) ...[
                              _buildActionButton(
                                label: 'THANH TOÁN QR',
                                color: Colors.indigo.shade700,
                                isFilled: true,
                                onTap: () => _showQrPaymentDialog(booking),
                              ),
                              const SizedBox(height: 8),
                            ],
                            _buildActionButton(
                              label: 'ĐẶT LẠI',
                              color: AppColors.primary,
                              isFilled: true,
                              onTap: () => _handleRebook(context, booking),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCompactInfo(IconData icon, String text, Color iconColor) {
    return Row(
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.stone700,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentBadge(String paymentStatus) {
    final normalized = paymentStatus.toUpperCase();
    final isPaid = normalized == 'PAID';
    final background = isPaid ? Colors.green.shade100 : Colors.orange.shade100;
    final border = isPaid ? Colors.green.shade400 : Colors.orange.shade400;
    final textColor = isPaid ? Colors.green.shade800 : Colors.orange.shade800;
    final label = isPaid ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border, width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.4,
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required String label,
    required Color color,
    bool isOutlined = false,
    bool isFilled = false,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          color: isFilled ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: isOutlined ? Border.all(color: color, width: 1.5) : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isFilled ? AppColors.white : color,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Future<void> _showCancelDialog(
      BuildContext context, BookingResponse booking) async {
    final reasonController = TextEditingController();
    final formKey = GlobalKey<FormState>(); // To validate

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hủy lịch hẹn?',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Bạn có chắc chắn muốn hủy lịch hẹn này không?'),
              const SizedBox(height: 16),
              TextFormField(
                controller: reasonController,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Vui lòng nhập lý do hủy';
                  }
                  return null;
                },
                decoration: const InputDecoration(
                  labelText: 'Lý do hủy (BẮT BUỘC)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('QUAY LẠI',
                style: TextStyle(color: AppColors.stone500)),
          ),
          ElevatedButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.pop(context, true);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child:
                const Text('HỦY LỊCH', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      // Show loading
      _showLoadingDialog(context);

      try {
        // Double check mounted before async work if needed, but here we just showed dialog
        await _bookingService.cancelBooking(
            booking.bookingId!, reasonController.text);
        if (context.mounted) Navigator.pop(context); // Hide loading

        await _fetchBookings(); // Refresh list - await to ensure list updates before UI feedback

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Đã hủy lịch hẹn thành công'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) Navigator.pop(context); // Hide loading
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  'Lỗi: ${e.toString().replaceAll("Exception:", "").trim()}'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
    reasonController.dispose();
  }

  /// Cancel dialog specifically for SOS bookings — uses cancelMatching() to clean Redis session
  Future<void> _showSosCancelDialog(
      BuildContext context, BookingResponse booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.emergency, color: Colors.red.shade700, size: 24),
            const SizedBox(width: 8),
            const Expanded(
              child: Text('Hủy yêu cầu SOS?',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        content: const Text(
          'Bạn có chắc chắn muốn hủy yêu cầu cấp cứu này?\n\n'
          'Lưu ý: Hủy SOS sẽ dừng toàn bộ quá trình ghép nối và theo dõi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('QUAY LẠI',
                style: TextStyle(color: AppColors.stone500)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('HỦY SOS', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      _showLoadingDialog(context);
      try {
        // Use the correct cancel API based on booking status:
        // - SEARCHING/PENDING_CLINIC_CONFIRM → cancelMatching (cleans Redis session)
        // - CONFIRMED/PENDING → cancelBooking (general booking cancel)
        final isPreConfirm = booking.status == 'SEARCHING' ||
            booking.status == 'PENDING_CLINIC_CONFIRM';

        bool success;
        if (isPreConfirm) {
          final sosService = SosMatchingService.instance;
          success = await sosService.cancelMatching(booking.bookingId!);
        } else {
          // Use regular cancelBooking for CONFIRMED
          await _bookingService.cancelBooking(
              booking.bookingId!, 'Hủy SOS bởi người dùng');
          success = true;
        }

        if (context.mounted) Navigator.pop(context); // Hide loading

        if (success) {
          await _fetchBookings();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã hủy yêu cầu SOS thành công'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        } else {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Không thể hủy yêu cầu SOS. Vui lòng thử lại.'),
                backgroundColor: AppColors.error,
              ),
            );
          }
        }
      } catch (e) {
        if (context.mounted) Navigator.pop(context); // Hide loading
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  'Lỗi: ${e.toString().replaceAll("Exception:", "").trim()}'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  Future<void> _showDeleteReviewDialog(
      BuildContext context, BookingResponse booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa đánh giá?',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text(
          'Bạn có chắc chắn muốn xóa đánh giá này không?\n\nHành động này không thể hoàn tác.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child:
                const Text('HỦY', style: TextStyle(color: AppColors.stone500)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('XÓA', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      _showLoadingDialog(context);
      try {
        if (booking.reviewId != null) {
          final reviewService = ReviewService();
          await reviewService.deleteReview(reviewId: booking.reviewId!);
        }
        if (context.mounted) Navigator.pop(context); // Hide loading
        await _fetchBookings();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Đã xóa đánh giá thành công'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) Navigator.pop(context); // Hide loading
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  'Lỗi: ${e.toString().replaceAll("Exception:", "").trim()}'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  Future<void> _openClinicReviewSection(BookingResponse booking) async {
    String? clinicId = booking.clinicId?.trim();

    if ((clinicId == null || clinicId.isEmpty) && booking.bookingId != null) {
      try {
        final detail = await _bookingService.getBookingById(booking.bookingId!);
        clinicId = detail.clinicId?.trim();
      } catch (_) {
        // Fallback silently and show user-facing message below if still missing
      }
    }

    if (!mounted) return;

    if (clinicId == null || clinicId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không tìm thấy thông tin phòng khám để xem đánh giá'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final location = Uri(
      path: '/clinics/$clinicId',
      queryParameters: const {'scrollToReviews': 'true'},
    ).toString();

    context.push(location);
  }

  String? _resolvePaymentMethod(BookingResponse booking) {
    final explicitMethod = booking.paymentMethod?.trim().toUpperCase();
    if (explicitMethod == 'QR' || explicitMethod == 'CASH') {
      return explicitMethod;
    }

    final notes = booking.notes?.toLowerCase() ?? '';
    if (notes.contains('phương thức thanh toán mong muốn: chuyển khoản qr') ||
        notes.contains('phuong thuc thanh toan mong muon: chuyen khoan qr') ||
        notes.contains('chuyển khoản qr') ||
        notes.contains('chuyen khoan qr') ||
        notes.contains('qr')) {
      return 'QR';
    }

    if (notes.contains('phương thức thanh toán mong muốn: tiền mặt') ||
        notes.contains('phuong thuc thanh toan mong muon: tien mat') ||
        notes.contains('tiền mặt') ||
        notes.contains('tien mat')) {
      return 'CASH';
    }

    return null;
  }

  bool _isQrPaymentVisible(BookingResponse booking) {
    if (booking.canShowQrPaymentButton == true) {
      return true;
    }

    final bookingStatus = booking.status?.trim().toUpperCase();
    final paymentMethod = _resolvePaymentMethod(booking);
    final paymentStatus = booking.paymentStatus?.trim().toUpperCase();
    final hasQrPayload = (booking.qrImageUrl?.trim().isNotEmpty ?? false) ||
        (booking.paymentDescription?.trim().isNotEmpty ?? false);

    return bookingStatus != 'CANCELLED' &&
        paymentMethod == 'QR' &&
        paymentStatus != 'PAID' &&
        hasQrPayload;
  }

  Future<void> _showQrPaymentDialog(BookingResponse booking) async {
    Timer? pollTimer;
    bool paid = false;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            void startPolling() {
              pollTimer?.cancel();
              pollTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
                try {
                  final result =
                      await _qrPaymentService.checkQrStatus(booking.bookingId!);
                  final status =
                      (result['status'] ?? '').toString().trim().toUpperCase();
                  if (status == 'PAID') {
                    pollTimer?.cancel();
                    paid = true;
                    if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                  }
                } catch (_) {
                  pollTimer?.cancel();
                }
              });
            }

            // Start polling when dialog opens
            if (pollTimer == null && !paid) startPolling();

            final qrUrl = booking.qrImageUrl;
            final description = booking.paymentDescription ?? 'Thanh toán đặt lịch khám';
            final amount = booking.totalPrice ?? 0;

            return WillPopScope(
              onWillPop: () async {
                pollTimer?.cancel();
                return true;
              },
              child: Dialog(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFF1c1917), width: 2),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'THANH TOÁN QR',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        description,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13, color: Colors.grey),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${amount.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]}.')} đ',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFd97706),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (qrUrl != null && qrUrl.isNotEmpty)
                        Container(
                          decoration: BoxDecoration(
                            border: Border.all(
                                color: const Color(0xFF1c1917), width: 2),
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: const [
                              BoxShadow(
                                offset: Offset(3, 3),
                                color: Color(0xFF1c1917),
                              )
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: Image.network(
                              qrUrl,
                              width: 220,
                              height: 220,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox(
                                width: 220,
                                height: 220,
                                child: Center(
                                    child: Text('Không tải được mã QR')),
                              ),
                            ),
                          ),
                        )
                      else
                        const SizedBox(
                          width: 220,
                          height: 220,
                          child: Center(child: Text('Không có mã QR')),
                        ),
                      const SizedBox(height: 16),
                      const Text(
                        'Hệ thống tự động kiểm tra mỗi 10 giây',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(
                                    color: Color(0xFF1c1917), width: 2),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8)),
                              ),
                              onPressed: () {
                                pollTimer?.cancel();
                                Navigator.of(dialogContext).pop();
                              },
                              child: const Text(
                                'ĐÓNG',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1c1917)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFd97706),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  side: const BorderSide(
                                      color: Color(0xFF1c1917), width: 2),
                                ),
                              ),
                              onPressed: () async {
                                try {
                                  final result =
                                      await _qrPaymentService.checkQrStatus(
                                          booking.bookingId!);
                                  final status = (result['status'] ?? '')
                                      .toString()
                                      .trim()
                                      .toUpperCase();
                                  if (status == 'PAID') {
                                    pollTimer?.cancel();
                                    paid = true;
                                    if (dialogContext.mounted) {
                                      Navigator.of(dialogContext).pop();
                                    }
                                  } else {
                                    if (ctx.mounted) {
                                      ScaffoldMessenger.of(ctx).showSnackBar(
                                        const SnackBar(
                                            content: Text(
                                                'Chưa nhận được thanh toán, vui lòng thử lại.')),
                                      );
                                    }
                                  }
                                } catch (_) {
                                  pollTimer?.cancel();
                                  if (dialogContext.mounted) {
                                    Navigator.of(dialogContext).pop();
                                  }
                                }
                              },
                              child: const Text(
                                'KIỂM TRA NGAY',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    pollTimer?.cancel();
    if (paid && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thanh toán thành công! Cảm ơn bạn.'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchBookings();
    }
  }

  void _showLoadingDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
  }

  void _handleRebook(BuildContext context, BookingResponse booking) {
    // Navigate to booking wizard (Step 1: Select Pet)
    if (booking.clinicId != null) {
      context.push('/booking/${booking.clinicId}/pet');
    }
  }

  Widget _buildStatusBadge(String? status) {
    Color color;
    String label;

    switch (status) {
      case 'PENDING':
        color = Colors.orange;
        label = 'Chờ xác nhận';
        break;
      case 'CONFIRMED':
        color = Colors.blue;
        label = 'Đã xác nhận';
        break;
      case 'IN_PROGRESS':
        color = Colors.purple;
        label = 'Đang diễn ra';
        break;
      case 'COMPLETED':
        color = Colors.green;
        label = 'Hoàn thành';
        break;
      case 'CANCELLED':
        color = Colors.red;
        label = 'Đã hủy';
        break;
      default:
        color = Colors.grey;
        label = status ?? 'Unknown';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20), // Pill shape
        // border: Border.all(color: color.withValues(alpha: 0.5)), // Removed border for cleaner look
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateString(String? dateStr) {
    if (dateStr == null) return '-';
    try {
      final date = DateTime.parse(dateStr);
      // Format as "Fri, 29/01" instead of full year
      // Or use defined format
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    } catch (e) {
      return dateStr;
    }
  }

  String _formatTime(String? timeStr) {
    if (timeStr == null) return '';
    // timeStr usually "10:00:00". Take first 5 chars "10:00"
    if (timeStr.length >= 5) {
      return timeStr.substring(0, 5);
    }
    return timeStr;
  }
}

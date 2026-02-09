
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/booking.dart';
import '../../data/services/booking_service.dart';
import '../../utils/format_utils.dart';
import 'package:url_launcher/url_launcher.dart';
import 'write_review_screen.dart';

/// Tab hiển thị lịch sử đặt lịch của Pet Owner
class MyBookingsTab extends StatefulWidget {
  const MyBookingsTab({super.key});

  @override
  State<MyBookingsTab> createState() => _MyBookingsTabState();
}

class _MyBookingsTabState extends State<MyBookingsTab> with SingleTickerProviderStateMixin {
  final BookingService _bookingService = BookingService();
  List<BookingResponse> _bookings = [];
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
      // Fetch all bookings for now, can be optimized to fetch by status tabs
      final bookings = await _bookingService.getMyBookings(size: 20);
      if (mounted) {
        setState(() {
          _bookings = bookings;
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
            labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            labelPadding: const EdgeInsets.symmetric(horizontal: 12),
            isScrollable: true,
            tabAlignment: TabAlignment.start, // Align tabs to start, no leading space
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
                    _buildBookingList(_bookings
                        .where((b) => b.status == 'PENDING')
                        .toList()),
                    
                    // Tab 2: Đã duyệt (CONFIRMED, ASSIGNED)
                    _buildBookingList(_bookings
                        .where((b) => ['CONFIRMED', 'ASSIGNED'].contains(b.status))
                        .toList()),

                    // Tab 3: Đang diễn ra (ARRIVED, IN_PROGRESS, CHECKED_IN)
                    _buildBookingList(_bookings
                        .where((b) => ['ARRIVED', 'IN_PROGRESS', 'CHECKED_IN'].contains(b.status))
                        .toList()),
                        
                    // Tab 4: Hoàn thành
                    _buildBookingList(_bookings
                        .where((b) => b.status == 'COMPLETED')
                        .toList()),
                        
                    // Tab 5: Đã hủy (CANCELLED, REJECTED, NO_SHOW)
                    _buildBookingList(_bookings
                        .where((b) => ['CANCELLED', 'REJECTED', 'NO_SHOW'].contains(b.status))
                        .toList()),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildBookingList(List<BookingResponse> bookings) {
    if (bookings.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_today_outlined, size: 64, color: AppColors.stone300),
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
      case 'ASSIGNED':
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
        final result = await context.push('/bookings/detail', extra: booking);
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
                    _buildStatusBadge(booking.status),
                    Row(
                      children: [
                        Text(
                          FormatUtils.formatCurrency(booking.totalPrice ?? 0),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: statusColor, // Match price color with status
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
                            color: AppColors.stone100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.local_hospital_rounded,
                              color: AppColors.stone500, size: 24),
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
                        Expanded(child: _buildCompactInfo(
                          Icons.pets_rounded,
                          booking.petName ?? 'Thú cưng',
                          AppColors.primary,
                        )),
                        
                        // Services count
                        Expanded(child: _buildCompactInfo(
                          Icons.medical_services_rounded,
                          '${booking.services?.length ?? 0} dịch vụ',
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
                              backgroundImage: booking.assignedStaffAvatarUrl != null
                                  ? NetworkImage(booking.assignedStaffAvatarUrl!)
                                  : null,
                              child: booking.assignedStaffAvatarUrl == null
                                  ? const Icon(Icons.person, size: 14, color: AppColors.stone400)
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
                  ['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED'].contains(booking.status))
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    color: AppColors.stone50,
                    border: Border(top: BorderSide(color: AppColors.stone200)),
                  ),
                  child: Row(
                    children: [
                      // Review Button or Rating Display (Left)
                      if (booking.status == 'COMPLETED')
                        if (booking.isReviewed != true)
                          GestureDetector(
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => WriteReviewScreen(booking: booking),
                                ),
                              ).then((value) {
                                if (value == true) {
                                  _fetchBookings();
                                }
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.amber, width: 1.5),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.star_rounded, size: 16, color: Colors.amber),
                                  SizedBox(width: 4),
                                  Text(
                                    'ĐÁNH GIÁ',
                                    style: TextStyle(
                                      color: Colors.amber, 
                                      fontWeight: FontWeight.w800, 
                                      fontSize: 12,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (booking.rating != null)
                           Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.stone100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Text(
                                  'Đã đánh giá:',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.stone500,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Icon(Icons.star_rounded, size: 18, color: Colors.amber),
                                  const SizedBox(width: 2),
                                  Text(
                                    '${booking.rating}',
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.stone900,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  InkWell(
                                    onTap: () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) => WriteReviewScreen(booking: booking, isEditMode: true),
                                        ),
                                      ).then((value) {
                                        if (value == true) {
                                          _fetchBookings();
                                        }
                                      });
                                    },
                                    child: const Padding(
                                      padding: EdgeInsets.all(4.0),
                                      child: Icon(Icons.edit, size: 16, color: AppColors.stone500),
                                    ),
                                  ),
                                ],
                            ),
                          ),

                      // Spacer to push everything else to the right
                      const Spacer(),

                      // Actions (Right)
                      if (booking.status == 'PENDING')
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                             Padding(
                               padding: const EdgeInsets.only(right: 8.0),
                               child: _buildActionButton(
                                 label: 'LIÊN HỆ',
                                 color: AppColors.stone500,
                                 isOutlined: true,
                                 onTap: () {
                                   if (booking.clinicId != null) {
                                     context.push(Uri(path: '/chat/detail', queryParameters: {'clinicId': booking.clinicId}).toString());
                                   } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                       const SnackBar(content: Text('Không tìm thấy thông tin phòng khám')),
                                     );
                                   }
                                 },
                               ),
                             ),
                             
                             _buildActionButton(
                               label: 'HỦY LỊCH',
                               color: AppColors.coral,
                               isOutlined: true,
                               onTap: () => _showCancelDialog(context, booking),
                             ),
                          ],
                        ),
                      
                      if (['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED'].contains(booking.status))
                        _buildActionButton(
                          label: 'ĐẶT LẠI',
                          color: AppColors.primary,
                          isFilled: true,
                          onTap: () => _handleRebook(context, booking),
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

  Widget _buildInlineAction(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(left: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color, width: 2),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.2),
              offset: const Offset(2, 2),
            ),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w800,
            fontSize: 12,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  Future<void> _makePhoneCall(String phoneNumber) async {
    final Uri launchUri = Uri(
      scheme: 'tel',
      path: phoneNumber,
    );
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  Future<void> _showCancelDialog(BuildContext context, BookingResponse booking) async {
    final reasonController = TextEditingController();
    final formKey = GlobalKey<FormState>(); // To validate
    
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hủy lịch hẹn?', style: TextStyle(fontWeight: FontWeight.bold)),
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
            child: const Text('QUAY LẠI', style: TextStyle(color: AppColors.stone500)),
          ),
          ElevatedButton(
            onPressed: () {
               if (formKey.currentState!.validate()) {
                 Navigator.pop(context, true);
               }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('HỦY LỊCH', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      // Show loading
      _showLoadingDialog(context);
      
      try {
        // Double check mounted before async work if needed, but here we just showed dialog
        await _bookingService.cancelBooking(booking.bookingId!, reasonController.text);
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
              content: Text('Lỗi: ${e.toString().replaceAll("Exception:", "").trim()}'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
    reasonController.dispose();
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

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.stone400),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.stone700,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
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
      case 'ASSIGNED':
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

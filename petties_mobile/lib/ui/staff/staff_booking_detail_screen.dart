import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/emr_service.dart';
import '../../data/models/booking.dart';
import '../../data/models/emr.dart';
import '../../providers/auth_provider.dart';
import '../../routing/app_routes.dart';

/// StaffBookingDetailScreen - Displays booking details for Staff with check-in/checkout actions
class StaffBookingDetailScreen extends StatefulWidget {
  final String bookingId;

  const StaffBookingDetailScreen({super.key, required this.bookingId});

  @override
  State<StaffBookingDetailScreen> createState() =>
      _StaffBookingDetailScreenState();
}

class _StaffBookingDetailScreenState extends State<StaffBookingDetailScreen> {
  final BookingService _bookingService = BookingService();
  final EmrService _emrService = EmrService();
  BookingResponse? _booking;
  EmrRecord? _existingEmr;
  bool _isLoading = true;
  bool _isActionLoading = false;
  String? _error;

  // Currency formatter for Vietnamese dong
  final _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _fetchBookingDetail();
  }

  Future<void> _fetchBookingDetail() async {
    setState(() => _isLoading = true);
    try {
      final booking = await _bookingService.getBookingById(widget.bookingId);

      EmrRecord? emr;
      try {
        // Check if EMR exists for this booking
        emr = await _emrService.getEmrByBookingId(widget.bookingId);
      } catch (_) {
        // EMR might not exist yet, ignore error
        emr = null;
      }

      setState(() {
        _booking = booking;
        _existingEmr = emr;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = 'Không thể tải chi tiết lịch hẹn: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleCheckIn() async {
    setState(() => _isActionLoading = true);
    try {
      await _bookingService.checkIn(widget.bookingId);
      await _fetchBookingDetail();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Check-in thành công!'),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Lỗi check-in: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Future<void> _handleComplete() async {
    setState(() => _isActionLoading = true);
    try {
      await _bookingService.complete(widget.bookingId);
      await _fetchBookingDetail();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Hoàn thành thành công!'),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Lỗi hoàn thành: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Future<void> _handleRemoveService(String serviceId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xác nhận xóa'),
        content: const Text(
            'Bạn có chắc chắn muốn xóa dịch vụ phát sinh này không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      await _bookingService.removeServiceFromBooking(
          widget.bookingId, serviceId);
      await _fetchBookingDetail();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã xóa dịch vụ thành công'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi khi xóa dịch vụ: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.stone900),
          onPressed: () => context.pop(),
        ),
        title: const Text('Chi tiết lịch hẹn',
            style: TextStyle(
                color: AppColors.stone900, fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child:
                      Text(_error!, style: const TextStyle(color: Colors.red)))
              : RefreshIndicator(
                  onRefresh: _fetchBookingDetail,
                  color: AppColors.primary,
                  child: _buildContent(),
                ),
      bottomNavigationBar: _booking != null ? _buildActionBar() : null,
    );
  }

  Widget _buildContent() {
    if (_booking == null) return const SizedBox.shrink();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUserId = authProvider.user?.userId;

    // Filter services assigned to current staff
    final myServices = _booking!.services
        .where((s) => s.assignedStaffId == currentUserId)
        .toList();

    // Filter services assigned to other staff (Shared Visibility)
    final otherServices = _booking!.services
        .where((s) => s.assignedStaffId != currentUserId && s.isAddOn != true)
        .toList();

    // Check if this is my booking or colleague's booking
    final isMyBooking = myServices.isNotEmpty;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Shared Visibility: Info banner for colleague's booking
          if (!isMyBooking && _booking!.status == 'IN_PROGRESS')
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.shade200, width: 2),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      color: Colors.blue.shade600, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Đây là lịch hẹn của đồng nghiệp đang được khám. Bạn có thể thêm bệnh án nếu cần hỗ trợ.',
                      style:
                          TextStyle(color: Colors.blue.shade700, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),

          // Status Badge
          _buildStatusBadge(),
          const SizedBox(height: 16),

          // Booking Info Card
          _buildInfoCard(
            title: 'Thông tin lịch hẹn',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow(Icons.confirmation_number, 'Mã đặt lịch',
                    _booking!.bookingCode ?? 'N/A'),
                _buildInfoRow(Icons.calendar_today, 'Ngày hẹn',
                    _booking!.bookingDate ?? 'N/A'),
                _buildInfoRow(
                    Icons.access_time, 'Giờ hẹn', _getBookingTimeRange()),
                if (_booking!.type == 'HOME_VISIT')
                  _buildInfoRow(Icons.home, 'Loại', 'Khám tại nhà',
                      valueColor: Colors.blue),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Pet Info Card
          _buildInfoCard(
            title: 'Thú cưng',
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.primarySurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                  child: _booking!.petPhotoUrl != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(_booking!.petPhotoUrl!,
                              fit: BoxFit.cover),
                        )
                      : const Icon(Icons.pets,
                          color: AppColors.primary, size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_booking!.petName ?? 'N/A',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(
                          '${_booking!.petSpecies ?? ''} • ${_booking!.petBreed ?? ''} • ${_booking!.petWeight ?? '?'}kg',
                          style: TextStyle(
                              color: AppColors.stone500, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Owner Info Card
          _buildInfoCard(
            title: 'Chủ nuôi',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow(
                    Icons.person, 'Tên', _booking!.ownerName ?? 'N/A'),
                _buildInfoRow(
                    Icons.phone, 'SĐT', _booking!.ownerPhone ?? 'N/A'),
                if (_booking!.homeAddress != null)
                  _buildInfoRow(
                      Icons.location_on, 'Địa chỉ', _booking!.homeAddress!),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // My Services Card
          if (myServices.isNotEmpty)
            _buildInfoCard(
              title: 'Dịch vụ bạn phụ trách (${myServices.length})',
              child: Column(
                children: myServices.map((service) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(10),
                      border:
                          Border.all(color: AppColors.primary.withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(service.serviceName ?? 'N/A',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              if (service.scheduledStartTime != null &&
                                  service.scheduledEndTime != null)
                                Row(
                                  children: [
                                    Icon(Icons.access_time,
                                        size: 14, color: AppColors.stone500),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${service.scheduledStartTime?.substring(0, 5)} - ${service.scheduledEndTime?.substring(0, 5)}',
                                      style: TextStyle(
                                          color: AppColors.stone500,
                                          fontSize: 12),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                        Text(
                          _currencyFormat.format(service.price ?? 0),
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          if (myServices.isNotEmpty) const SizedBox(height: 12),

          // Other Staff's Services Card (Shared Visibility)
          if (otherServices.isNotEmpty)
            _buildInfoCard(
              title: 'Dịch vụ của đồng nghiệp (${otherServices.length})',
              child: Column(
                children: otherServices.map((service) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.stone50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.stone200),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(service.serviceName ?? 'N/A',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              if (service.assignedStaffName != null)
                                Text(
                                  'Phụ trách: ${service.assignedStaffName}',
                                  style: TextStyle(
                                      color: AppColors.stone500, fontSize: 12),
                                ),
                            ],
                          ),
                        ),
                        Text(
                          _currencyFormat.format(service.price ?? 0),
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.stone500),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          if (otherServices.isNotEmpty) const SizedBox(height: 12),

          // Arising Services Card (Add-ons)
          if (_booking!.services.any((s) => s.isAddOn == true))
            _buildInfoCard(
              title: 'Dịch vụ phát sinh',
              child: Column(
                children: _booking!.services
                    .where((s) => s.isAddOn == true)
                    .map((service) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.stone50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.stone200),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(service.serviceName ?? 'N/A',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              Text(
                                _currencyFormat.format(service.price ?? 0),
                                style: const TextStyle(
                                    color: AppColors.primary, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline,
                              color: Colors.red),
                          onPressed: () =>
                              _handleRemoveService(service.bookingServiceId!),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          if (_booking!.services.any((s) => s.isAddOn == true))
            const SizedBox(height: 12),
          const SizedBox(height: 12),

          // Notes
          if (_booking!.notes != null && _booking!.notes!.isNotEmpty)
            _buildInfoCard(
              title: 'Ghi chú',
              child:
                  Text(_booking!.notes!, style: const TextStyle(fontSize: 14)),
            ),
        ],
      ),
    );
  }

  String _getBookingTimeRange() {
    if (_booking == null || _booking!.services.isEmpty) {
      return _booking?.bookingTime?.substring(0, 5) ?? 'N/A';
    }

    String? minStart;
    String? maxEnd;

    for (final service in _booking!.services) {
      final start = service.scheduledStartTime;
      final end = service.scheduledEndTime;

      if (start != null) {
        if (minStart == null || start.compareTo(minStart) < 0) {
          minStart = start;
        }
      }

      if (end != null) {
        if (maxEnd == null || end.compareTo(maxEnd) > 0) {
          maxEnd = end;
        }
      }
    }

    if (minStart != null && maxEnd != null) {
      return '${minStart.substring(0, 5)} - ${maxEnd.substring(0, 5)}';
    }

    return _booking?.bookingTime?.substring(0, 5) ?? 'N/A';
  }

  Widget _buildStatusBadge() {
    final status = _booking!.status;
    Color bgColor;
    Color textColor;
    String label;

    switch (status) {
      case 'PENDING':
        bgColor = AppColors.stone100; // #F5F5F4
        textColor = AppColors.stone700; // #44403C
        label = 'Chờ xác nhận';
        break;
      case 'CONFIRMED':
        bgColor = AppColors.amber50; // #FFFBEB
        textColor = AppColors.primaryDark; // #B45309
        label = 'Đã xác nhận';
        break;
      case 'ASSIGNED':
        bgColor = AppColors.primarySurface; // #FEF3C7
        textColor = AppColors.primary; // #D97706
        label = 'Đã gán BS';
        break;
      case 'ARRIVED':
        bgColor = AppColors.primarySurface; // #FEF3C7
        textColor = AppColors.primary; // #D97706
        label = 'Đã đến';
        break;
      case 'IN_PROGRESS':
        bgColor = AppColors.primarySurface; // #FEF3C7
        textColor = AppColors.primary; // #D97706
        label = 'Đang khám';
        break;
      case 'COMPLETED':
        bgColor = AppColors.successLight; // #DCFCE7
        textColor = AppColors.successDark; // #16A34A
        label = 'Hoàn thành';
        break;
      case 'CANCELLED':
        bgColor = AppColors.stone100; // #F5F5F4
        textColor = AppColors.stone600; // #57534E
        label = 'Đã hủy';
        break;
      default:
        bgColor = AppColors.stone100;
        textColor = AppColors.stone700;
        label = status ?? 'N/A';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label,
          style: TextStyle(
              color: textColor, fontWeight: FontWeight.w700, fontSize: 13)),
    );
  }

  Widget _buildInfoCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone500,
                  letterSpacing: 0.5)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 10),
          Text('$label: ',
              style: TextStyle(color: AppColors.stone500, fontSize: 13)),
          Expanded(
              child: Text(value,
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: valueColor ?? AppColors.stone900,
                      fontSize: 13))),
        ],
      ),
    );
  }

  Widget _buildActionBar() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUserId = authProvider.user?.userId;

    final status = _booking!.status;
    final myServices = _booking!.services
        .where((s) => s.assignedStaffId == currentUserId)
        .toList();
    final isMyBooking = myServices.isNotEmpty;

    Widget? actionButton;

    // ASSIGNED or ARRIVED -> Check-in (start examination) - only for assigned staff
    if ((status == 'ASSIGNED' || status == 'ARRIVED') && isMyBooking) {
      actionButton = _buildActionButton(
        label: 'Bắt đầu khám',
        icon: Icons.play_arrow,
        color: AppColors.primary,
        onPressed: _handleCheckIn,
      );
    }
    // IN_PROGRESS -> Show EMR and Vaccination buttons for ALL staff (Shared Visibility)
    else if (status == 'IN_PROGRESS') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.stone200)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Shared Visibility: Always show EMR button for IN_PROGRESS bookings
              _buildActionButton(
                label: 'TẠO BỆNH ÁN',
                icon: Icons.assignment_outlined,
                color: Colors.blue,
                onPressed: () {
                  // Navigate to create EMR - any staff can create for IN_PROGRESS booking
                  final petId = _booking!.petId;
                  if (petId != null) {
                    final petName = _booking!.petName ?? '';
                    final petSpecies = _booking!.petSpecies ?? '';
                    context.push(
                      Uri(
                        path: AppRoutes.staffCreateEmr
                            .replaceAll(':petId', petId),
                        queryParameters: {
                          'petName': petName,
                          'petSpecies': petSpecies,
                          'bookingId': _booking!.bookingId,
                          'bookingCode': _booking!.bookingCode,
                        },
                      ).toString(),
                    );
                  }
                },
              ),
              const SizedBox(height: 12),
              _buildActionButton(
                label: 'TIÊM VACCINE',
                icon: Icons.vaccines_outlined,
                color: Colors.purple,
                onPressed: () {
                  final petId = _booking!.petId;
                  if (petId != null) {
                    final petName = _booking!.petName ?? 'Thú cưng';
                    context.push(
                      Uri(
                        path: AppRoutes.staffVaccinationForm
                            .replaceAll(':petId', petId),
                        queryParameters: {
                          'petName': petName,
                          'bookingId': _booking!.bookingId,
                          'bookingCode': _booking!.bookingCode,
                        },
                      ).toString(),
                    );
                  }
                },
              ),
              if (_booking!.type == 'HOME_VISIT') ...[
                const SizedBox(height: 12),
                _buildActionButton(
                  label: 'THÊM DỊCH VỤ',
                  icon: Icons.add_circle_outline,
                  color: Colors.teal,
                  onPressed: () async {
                    final result = await context.push(
                      Uri(
                        path: AppRoutes.staffAddService
                            .replaceAll(':bookingId', _booking!.bookingId!),
                        queryParameters: {
                          'clinicId': _booking!.clinicId,
                        },
                      ).toString(),
                    );

                    if (result == true) {
                      _fetchBookingDetail();
                    }
                  },
                ),
              ],
              // Note: Checkout removed - staff doesn't have checkout permission for IN_CLINIC
            ],
          ),
        ),
      );
    }

    if (actionButton == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone200)),
      ),
      child: SafeArea(
        top: false,
        child: _isActionLoading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary))
            : actionButton,
      ),
    );
  }

  Widget _buildActionButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, color: Colors.white),
        label: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
        ),
      ),
    );
  }
}

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
  State<StaffBookingDetailScreen> createState() => _StaffBookingDetailScreenState();
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

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          _buildInfoCard(
            title: 'Dịch vụ bạn phụ trách (${myServices.length})',
            child: Column(
              children: myServices.isEmpty
                  ? [
                      const Text('Không có dịch vụ nào được gán cho bạn',
                          style: TextStyle(color: AppColors.stone400))
                    ]
                  : myServices.map((service) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: AppColors.primary.withOpacity(0.3)),
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
                                            size: 14,
                                            color: AppColors.stone500),
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
    final status = _booking!.status;
    Widget? actionButton;

    // ASSIGNED or ARRIVED -> Check-in (start examination)
    if (status == 'ASSIGNED' || status == 'ARRIVED') {
      actionButton = _buildActionButton(
        label: 'Bắt đầu khám',
        icon: Icons.play_arrow,
        color: AppColors.primary,
        onPressed: _handleCheckIn,
      );
    }
    // IN_PROGRESS -> Show EMR and Vaccination buttons
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
              _buildActionButton(
                label: _existingEmr != null ? 'XEM BỆNH ÁN' : 'TẠO BỆNH ÁN',
                icon: _existingEmr != null ? Icons.description_outlined : Icons.assignment_outlined,
                color: _existingEmr != null ? Colors.green : Colors.blue,
                onPressed: () {
                  if (_existingEmr != null) {
                    // Navigate to view EMR
                    context.push('/staff/emr/${_existingEmr!.id}');
                  } else {
                    // Navigate to create EMR
                    final petId = _booking!.petId;
                    if (petId != null) {
                      final petName = _booking!.petName ?? '';
                      final petSpecies = _booking!.petSpecies ?? '';
                      context.push(
                        Uri(
                          path: AppRoutes.staffCreateEmr.replaceAll(':petId', petId),
                          queryParameters: {
                            'petName': petName,
                            'petSpecies': petSpecies,
                            'bookingId': _booking!.bookingId,
                            'bookingCode': _booking!.bookingCode,
                          },
                        ).toString(),
                      );
                    }
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
                    
                    // Try to find a vaccination service to pre-fill the name
                    String? initialVaccineName;
                    try {
                      final vaccService = _booking!.services.firstWhere(
                        (s) => s.serviceName?.toLowerCase().contains('vắc-xin') == true || 
                               s.serviceName?.toLowerCase().contains('vaccine') == true
                      );
                      initialVaccineName = vaccService.serviceName;
                    } catch (_) {
                      initialVaccineName = null;
                    }

                    context.push(
                      Uri(
                        path: AppRoutes.staffVaccinationForm.replaceAll(':petId', petId),
                        queryParameters: {
                          'petName': petName,
                          'bookingId': _booking!.bookingId,
                          'bookingCode': _booking!.bookingCode,
                          if (initialVaccineName != null) 'initialVaccineName': initialVaccineName,
                        },
                      ).toString(),
                    );
                  }
                },
              ),
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

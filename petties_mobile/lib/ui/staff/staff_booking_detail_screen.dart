import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/constants/app_colors.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/emr_service.dart';
import '../../data/services/tracking_websocket_service.dart';
import '../../data/models/booking.dart';
import '../../data/models/emr.dart';
import '../../providers/auth_provider.dart';
import '../../routing/app_routes.dart';
import '../../utils/storage_service.dart';
import '../../config/constants/app_constants.dart';

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
  bool _isEMRLoading = false;
  List<EmrRecord> _emrs = [];

  // Tracking state
  StreamSubscription<Position>? _positionSubscription;
  bool _isTracking = false;
  final _trackingService = trackingWebsocket;
  DateTime? _movingStartedAt;
  Timer? _movingTimer;
  Duration _movingElapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _fetchBookingDetail();
  }

  @override
  void dispose() {
    _stopTracking();
    super.dispose();
  }

  void _startMovingTimerIfNeeded() {
    if (_movingTimer != null) return;
    final startedAt = _movingStartedAt;
    if (startedAt == null) return;

    _movingTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _movingElapsed = DateTime.now().difference(startedAt);
      });
    });
  }

  void _stopMovingTimer({bool reset = false}) {
    _movingTimer?.cancel();
    _movingTimer = null;
    if (reset) {
      _movingStartedAt = null;
      _movingElapsed = Duration.zero;
    }
  }

  String _formatDuration(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    if (h > 0) return '${two(h)}:${two(m)}:${two(s)}';
    return '${two(m)}:${two(s)}';
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
      await _fetchEmrs(booking); // Call to fetch EMRs after booking is loaded

      setState(() {
        _booking = booking;
        _existingEmr = emr;
        _error = null;
      });
      // If tracking already started before, keep timer running
      if (_isTracking && _movingStartedAt != null) {
        _startMovingTimerIfNeeded();
      }
      // Auto resume tracking for active SOS/HOME_VISIT bookings
      await _autoStartTrackingIfNeeded();
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Không thể tải chi tiết lịch hẹn: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openMap(double? lat, double? lng, String address) async {
    Uri url;
    if (lat != null && lng != null) {
      // Use coordinates if available
      final String googleMapsUrl =
          "https://www.google.com/maps/search/?api=1&query=$lat,$lng";
      final String appleMapsUrl = "https://maps.apple.com/?q=$lat,$lng";

      if (await canLaunchUrl(Uri.parse(googleMapsUrl))) {
        url = Uri.parse(googleMapsUrl);
      } else if (await canLaunchUrl(Uri.parse(appleMapsUrl))) {
        url = Uri.parse(appleMapsUrl);
      } else {
        url = Uri.parse(
            "https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}");
      }
    } else {
      // Fallback to address search
      url = Uri.parse(
          "https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}");
    }

    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể mở ứng dụng bản đồ.')),
        );
      }
    }
  }

  Future<void> _fetchEmrs(BookingResponse? booking) async {
    if (booking == null || booking.petId == null) return;
    setState(() => _isEMRLoading = true);
    try {
      final response = await EmrService().getEmrsByPetId(booking.petId!);
      if (mounted) {
        setState(() {
          _emrs = response;
          _isEMRLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isEMRLoading = false);
      }
    }
  }

  // --- Tracking Methods ---

  Future<void> _autoStartTrackingIfNeeded() async {
    if (_booking == null) return;
    // Auto start tracking when booking is already IN_PROGRESS (SOS only)
    if (_booking!.status == 'IN_PROGRESS' &&
        _booking!.type == 'SOS' &&
        _booking!.arrivedAt == null &&
        !_isTracking) {
      await _startTracking(callStartMoving: false);
    }
  }

  Future<bool> _checkLocationPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Dịch vụ định vị đã bị tắt.')),
        );
      }
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quyển truy cập vị trí bị từ chối.')),
          );
        }
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Quyền truy cập vị trí bị từ chối vĩnh viễn, chúng tôi không thể yêu cầu quyền.',
            ),
          ),
        );
      }
      return false;
    }

    return true;
  }

  Future<void> _startTracking({required bool callStartMoving}) async {
    final hasPermission = await _checkLocationPermission();
    if (!hasPermission) return;

    setState(() => _isActionLoading = true);
    try {
      // Transition status to IN_PROGRESS if it's currently CONFIRMED
      if (callStartMoving && _booking?.status == 'CONFIRMED') {
        await _bookingService.startMoving(_booking!.bookingId!);
        await _fetchBookingDetail(); // Reload to update status in UI
      }

      setState(() {
        _isTracking = true;
        _movingStartedAt ??= DateTime.now();
      });
      _startMovingTimerIfNeeded();

      // Set access token for WebSocket before sending any location updates
      final storage = StorageService();
      final token = await storage.getString(AppConstants.accessTokenKey);
      if (token != null) {
        _trackingService.setAccessToken(token);
      }

      // Send initial location immediately so pet owner sees icon right away
      try {
        final currentPosition = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );
        if (_booking?.bookingId != null) {
          _trackingService.updateLocation(
            _booking!.bookingId!,
            currentPosition.latitude,
            currentPosition.longitude,
            status: 'MOVING',
          );
        }
      } catch (e) {
        // Non-blocking: initial location send failure should not stop tracking
      }

      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3, // Giảm xuống 3m để cập nhật liên tục hơn khi ở gần
        ),
      ).listen((Position position) {
        if (_booking?.bookingId != null) {
          _trackingService.updateLocation(
            _booking!.bookingId!,
            position.latitude,
            position.longitude,
            status: 'MOVING',
          );
        }
      });

      if (mounted && callStartMoving) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bắt đầu di chuyển và chia sẻ vị trí.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  void _stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _stopMovingTimer(reset: false);
    if (mounted) {
      setState(() => _isTracking = false);
    }
  }

  Future<void> _handleArrived() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận đã đến nơi'),
        content: const Text('Bạn đã đến địa chỉ của khách hàng?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            child:
                const Text('Đã đến nơi', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isActionLoading = true);
    try {
      await _bookingService.arrived(widget.bookingId);
      _stopTracking();
      _stopMovingTimer(reset: true);
      await _fetchBookingDetail();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã cập nhật trạng thái: Đến nơi!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
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
    // Backend đã ngừng hỗ trợ /complete, chuẩn hoá dùng /checkout cho mọi loại booking.
    await _handleCheckout();
  }

  Future<void> _handleCheckout() async {
    double overriddenFee = _booking?.sosFee ?? 0;
    String selectedPaymentMethod =
        _booking?.paymentMethod?.toUpperCase() == 'CASH' ? 'CASH' : 'QR';
    final feeController =
        TextEditingController(text: overriddenFee.toStringAsFixed(0));

    // Show confirmation dialog with full booking summary
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final b = _booking!;
            final bool isSos = b.type == 'SOS';
            final bool isHomeVisit = b.type == 'HOME_VISIT';
            double servicesTotal =
                b.services.fold(0, (sum, item) => sum + (item.price ?? 0));
            double distanceFee = b.distanceFee ?? 0;
            double currentTotal =
                servicesTotal + distanceFee + (isSos ? overriddenFee : 0);

            return AlertDialog(
              title: Row(
                children: [
                  const Icon(Icons.payment, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Text('Hoàn tất khám'),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Customer info
                    _buildCheckoutSection(
                        Icons.person_outline, 'Thông tin khách hàng', [
                      if (b.ownerName != null) 'Tên: ${b.ownerName}',
                      if (b.ownerPhone != null) 'SĐT: ${b.ownerPhone}',
                      if (b.homeAddress != null) 'Địa chỉ: ${b.homeAddress}',
                    ]),
                    const SizedBox(height: 12),
                    // Pet info
                    _buildCheckoutSection(Icons.pets, 'Thú cưng', [
                      if (b.petName != null) 'Tên: ${b.petName}',
                      if (b.petSpecies != null) 'Loài: ${b.petSpecies}',
                    ]),
                    const SizedBox(height: 12),
                    // Services
                    _buildCheckoutSection(
                        Icons.assignment_outlined, 'Dịch vụ', [
                      ...b.services.map((s) =>
                          '${s.serviceName ?? "Dịch vụ"}: ${_currencyFormat.format(s.price ?? 0)}'),
                    ]),
                    const Divider(height: 24),
                    // Fee breakdown & Override
                    if (isSos) ...[
                      const Text('ĐIỀU CHỈNH PHÍ SOS',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: AppColors.stone500)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: feeController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          prefixIcon:
                              const Icon(Icons.edit_note, color: AppColors.coral),
                          suffixText: 'VNĐ',
                          labelText: 'Phí SOS thực tế',
                          isDense: true,
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        onChanged: (val) {
                          setDialogState(() {
                            overriddenFee = double.tryParse(val) ?? 0;
                          });
                        },
                      ),
                      if (b.distanceFee != null && b.distanceFee! > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child:
                              _buildPriceSimple('Phí di chuyển', distanceFee),
                        ),
                      const Divider(height: 16),
                    ] else if (isHomeVisit &&
                        b.distanceFee != null &&
                        b.distanceFee! > 0) ...[
                      _buildPriceSimple('Phí di chuyển', distanceFee),
                      const Divider(height: 16),
                    ],
                    // Total
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('TỔNG CỘNG',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(
                          _currencyFormat.format(currentTotal),
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'PHƯƠNG THỨC THANH TOÁN',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: AppColors.stone500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.stone300),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          RadioListTile<String>(
                            value: 'QR',
                            groupValue: selectedPaymentMethod,
                            activeColor: AppColors.primary,
                            title: const Text('QR - Pet Owner tự thanh toán'),
                            onChanged: (value) {
                              if (value == null) return;
                              setDialogState(() {
                                selectedPaymentMethod = value;
                              });
                            },
                          ),
                          const Divider(height: 1),
                          RadioListTile<String>(
                            value: 'CASH',
                            groupValue: selectedPaymentMethod,
                            activeColor: AppColors.primary,
                            title: const Text('Tiền mặt - chờ xác nhận thanh toán'),
                            onChanged: (value) {
                              if (value == null) return;
                              setDialogState(() {
                                selectedPaymentMethod = value;
                              });
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Hủy'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary),
                  child: const Text('Xác nhận hoàn tất khám',
                      style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
    if (confirm != true) return;

    _stopTracking();
    setState(() => _isActionLoading = true);
    try {
      final paymentMethod = selectedPaymentMethod;
      await (_booking?.type == 'SOS'
          ? _bookingService.checkout(
              widget.bookingId,
              overriddenSosFee: overriddenFee,
              paymentMethod: paymentMethod,
            )
          : _bookingService.checkout(
              widget.bookingId,
              paymentMethod: paymentMethod,
            ));

      await _fetchBookingDetail();

      if (mounted) {
        final message = paymentMethod == 'QR'
            ? 'Đã hoàn tất khám. Khách hàng sẽ thanh toán QR trong màn chi tiết lịch hẹn.'
            : 'Đã hoàn tất khám. Booking đã chuyển sang chờ thanh toán tiền mặt.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: paymentMethod == 'QR' ? Colors.blue : Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Widget _buildCheckoutSection(
      IconData icon, String title, List<String> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: AppColors.stone600),
            const SizedBox(width: 8),
            Text(title,
                style:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          ],
        ),
        const SizedBox(height: 4),
        ...items.map((item) => Padding(
              padding: const EdgeInsets.only(left: 8, bottom: 2),
              child: Text(item, style: const TextStyle(fontSize: 13)),
            )),
      ],
    );
  }

  Widget _buildPriceSimple(String label, double amount) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(color: AppColors.stone500, fontSize: 13)),
          Text(_currencyFormat.format(amount),
              style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
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

    // Check if this is my booking or colleague's booking (same logic as _buildActionBar)
    final isMyBooking = _booking!.assignedStaffId == currentUserId ||
        _booking!.services.any((s) => s.assignedStaffId == currentUserId);

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
                _buildInfoRow(
                  _getBookingTypeIcon(),
                  'Hình thức',
                  _getBookingTypeLabel(),
                  valueColor: _getBookingTypeColor(),
                ),
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
                    Icons.location_on,
                    'Địa chỉ',
                    _booking!.homeAddress!,
                    onTap: () => _openMap(
                      _booking!.homeLat,
                      _booking!.homeLong,
                      _booking!.homeAddress ?? '',
                    ),
                    trailing: Icon(Icons.map_outlined,
                        size: 18, color: AppColors.stone600),
                  ),
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

          if (_booking!.notes != null && _booking!.notes!.isNotEmpty)
            _buildInfoCard(
              title: 'Ghi chú',
              child:
                  Text(_booking!.notes!, style: const TextStyle(fontSize: 14)),
            ),
          const SizedBox(height: 12),

          // Payment Summary Card
          _buildInfoCard(
            title: 'Tóm tắt thanh toán',
            child: Column(
              children: [
                _buildPriceRow(
                  'Tổng phí dịch vụ',
                  (_booking!.totalPrice ?? 0) -
                      (_booking!.sosFee ?? 0) -
                      (_booking!.distanceFee ?? 0),
                ),
                if (_booking!.distanceFee != null && _booking!.distanceFee! > 0)
                  _buildPriceRow('Phí di chuyển', _booking!.distanceFee!),
                if (_booking!.sosFee != null && _booking!.sosFee! > 0)
                  _buildPriceRow('Phí cấp cứu (SOS)', _booking!.sosFee!,
                      isHighlight: true),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(),
                ),
                _buildPriceRow('Tổng cộng', _booking!.totalPrice ?? 0,
                    isTotal: true),
              ],
            ),
          ),
          const SizedBox(height: 100), // Space for action bar
        ],
      ),
    );
  }

  Widget _buildPriceRow(String label, double amount,
      {bool isHighlight = false, bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: isTotal ? FontWeight.w800 : FontWeight.w500,
              color: isHighlight ? AppColors.coral : AppColors.stone600,
            ),
          ),
          Text(
            _currencyFormat.format(amount),
            style: TextStyle(
              fontSize: isTotal ? 18 : 14,
              fontWeight: isTotal ? FontWeight.w800 : FontWeight.w700,
              color: isTotal ? AppColors.primary : AppColors.stone900,
            ),
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

  String _getBookingTypeLabel() {
    final type = _booking?.type;
    if (type == 'HOME_VISIT') {
      return 'Khám tại nhà';
    }
    if (type == 'SOS') {
      return 'Cấp cứu SOS';
    }
    // Mặc định: khám tại phòng khám
    return 'Khám tại phòng khám';
  }

  IconData _getBookingTypeIcon() {
    final type = _booking?.type;
    if (type == 'HOME_VISIT') {
      return Icons.home;
    }
    if (type == 'SOS') {
      return Icons.emergency;
    }
    return Icons.local_hospital;
  }

  Color _getBookingTypeColor() {
    final type = _booking?.type;
    if (type == 'HOME_VISIT') {
      return AppColors.primary;
    }
    if (type == 'SOS') {
      return AppColors.coral;
    }
    return AppColors.successDark;
  }

  Widget _buildStatusBadge() {
    final status = _booking!.status;
    Color bgColor;
    Color textColor;
    String label;

    switch (status) {
      case 'PENDING':
        bgColor = AppColors.stone100;
        textColor = AppColors.stone700;
        label = 'Chờ xác nhận';
        break;
      case 'CONFIRMED':
        bgColor = AppColors.amber50;
        textColor = AppColors.primaryDark;
        label = 'Đã xác nhận';
        break;
      case 'IN_PROGRESS':
        bgColor = AppColors.primarySurface;
        textColor = AppColors.primary;
        label = 'Đang khám';
        break;
      case 'COMPLETED':
        bgColor = AppColors.successLight;
        textColor = AppColors.successDark;
        label = 'Hoàn thành';
        break;
      case 'CANCELLED':
        bgColor = AppColors.stone100;
        textColor = AppColors.stone600;
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
      {Color? valueColor, VoidCallback? onTap, Widget? trailing}) {
    final content = Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 10),
          Text('$label: ',
              style: TextStyle(color: AppColors.stone500, fontSize: 13)),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: valueColor ?? AppColors.stone900,
                fontSize: 13,
              ),
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: 8),
            trailing,
          ],
        ],
      ),
    );

    if (onTap == null) return content;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: content,
    );
  }

  Widget _buildActionBar() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUserId = authProvider.user?.userId;

    final status = _booking!.status;
    final isMyBooking = _booking!.assignedStaffId == currentUserId ||
        _booking!.services.any((s) => s.assignedStaffId == currentUserId);

    Widget? actionButton;

    // 1. Logic for CONFIRMED bookings (Waiting to start)
    if (status == 'CONFIRMED' && isMyBooking) {
      actionButton = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_booking!.type == 'SOS') ...[
            _buildActionButton(
              label: 'BẮT ĐẦU DI CHUYỂN',
              icon: Icons.location_on,
              color: AppColors.coral,
              onPressed: () {
                _startTracking(callStartMoving: true);
              },
            ),
            const SizedBox(height: 12),
            _buildActionButton(
              label: 'CHỈ ĐƯỜNG (MAPS)',
              icon: Icons.directions,
              color: Colors.green,
              onPressed: () => _openMap(
                _booking!.homeLat,
                _booking!.homeLong,
                _booking!.homeAddress ?? '',
              ),
            ),
          ] else if (_booking!.type == 'HOME_VISIT') ...[
            _buildActionButton(
              label: 'BẮT ĐẦU THỰC HIỆN DỊCH VỤ',
              icon: Icons.play_arrow,
              color: AppColors.primary,
              onPressed: _handleCheckIn,
            ),
            const SizedBox(height: 12),
            _buildActionButton(
              label: 'CHỈ ĐƯỜNG (MAPS)',
              icon: Icons.directions,
              color: Colors.green,
              onPressed: () => _openMap(
                _booking!.homeLat,
                _booking!.homeLong,
                _booking!.homeAddress ?? '',
              ),
            ),
          ] else
            _buildActionButton(
              label: 'BẮT ĐẦU THỰC HIỆN DỊCH VỤ',
              icon: Icons.play_arrow,
              color: AppColors.primary,
              onPressed: _handleCheckIn,
            ),
        ],
      );
    }
    // 2. Logic for IN_PROGRESS bookings (Active care)
    else if (status == 'IN_PROGRESS') {
      final actions = <Widget>[
        if ((_booking!.type == 'SOS' || _booking!.type == 'HOME_VISIT') &&
            _booking!.homeAddress != null) ...[
          _buildInfoCard(
            title: 'Điểm đến',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow(
                  Icons.location_on,
                  'Địa chỉ',
                  _booking!.homeAddress!,
                  onTap: () => _openMap(
                    _booking!.homeLat,
                    _booking!.homeLong,
                    _booking!.homeAddress ?? '',
                  ),
                  trailing: Icon(Icons.map_outlined,
                      size: 18, color: AppColors.stone600),
                ),
                if (_booking!.type == 'SOS' && _booking!.arrivedAt == null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppColors.primary, width: 1),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.directions_walk,
                              size: 16,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _isTracking && _movingStartedAt != null
                                  ? 'Đang di chuyển • ${_formatDuration(_movingElapsed)}'
                                  : 'Đang di chuyển',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                                color: AppColors.stone900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () => _openMap(
                          _booking!.homeLat,
                          _booking!.homeLong,
                          _booking!.homeAddress ?? '',
                        ),
                        icon: const Icon(Icons.directions, size: 18),
                        label: const Text('Mở bản đồ'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_booking!.type == 'SOS' && _booking!.arrivedAt == null) ...[
            _buildActionButton(
              label: 'ĐÃ ĐẾN NƠI',
              icon: Icons.flag,
              color: Colors.orange,
              onPressed: _handleArrived,
            ),
            const SizedBox(height: 12),
          ],
        ],
        _buildActionButton(
          label: _existingEmr != null ? 'XEM BỆNH ÁN' : 'TẠO BỆNH ÁN',
          icon: _existingEmr != null
              ? Icons.description_outlined
              : Icons.assignment_outlined,
          color: _existingEmr != null ? Colors.green : Colors.blue,
          onPressed: () async {
            if (_existingEmr != null) {
              await context.push('/staff/emr/${_existingEmr!.id}');
            } else {
              final petId = _booking!.petId;
              if (petId != null) {
                final petName = _booking!.petName ?? '';
                final petSpecies = _booking!.petSpecies ?? '';
                await context.push(
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
            if (mounted) await _fetchBookingDetail();
          },
        ),
      ];

      // Với SOS, không hiển thị shortcut TIÊM VACCINE
      if (_booking!.type != 'SOS') {
        actions.addAll([
          const SizedBox(height: 12),
          _buildActionButton(
            label: 'TIÊM VACCINE',
            icon: Icons.vaccines_outlined,
            color: Colors.purple,
            onPressed: () {
              final petId = _booking!.petId;
              if (petId != null) {
                final petName = _booking!.petName ?? 'Thú cưng';
                String? initialVaccineName;
                try {
                  final vaccService = _booking!.services.firstWhere(
                    (s) => s.serviceName?.toLowerCase().contains('vắc-xin') == true ||
                        s.serviceName?.toLowerCase().contains('vaccine') == true,
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
        ]);
      }
      // Thêm dịch vụ:
      // - HOME_VISIT: hiển thị là "THÊM DỊCH VỤ PHÁT SINH"
      // - SOS: hiển thị là "THÊM DỊCH VỤ"
      if (_booking!.type == 'HOME_VISIT' || _booking!.type == 'SOS') {
        actions.addAll([
          const SizedBox(height: 12),
          _buildActionButton(
            label: _booking!.type == 'SOS'
                ? 'THÊM DỊCH VỤ'
                : 'THÊM DỊCH VỤ PHÁT SINH',
            icon: Icons.add_circle_outline,
            color: AppColors.primary,
            onPressed: () async {
              final bid = _booking!.bookingId;
              final cid = _booking!.clinicId ?? '';
              if (bid != null) {
                final path =
                    AppRoutes.staffAddService.replaceAll(':bookingId', bid);
                final result =
                    await context.push<bool>('$path?clinicId=$cid');
                if (result == true && mounted) await _fetchBookingDetail();
              }
            },
          ),
        ]);
      }
      // Nút kết thúc flow theo từng loại booking
      if (_booking!.type == 'HOME_VISIT' || _booking!.type == 'SOS') {
        // HOME_VISIT & SOS: Hoàn tất khám và thanh toán gộp chung trong bước checkout
        actions.addAll([
          const SizedBox(height: 12),
          _buildActionButton(
            label: 'Xem lại hóa đơn & thanh toán',
            icon: Icons.receipt_long,
            color: AppColors.primary,
            onPressed: _handleCheckout,
          ),
        ]);
      } else {
        // Các loại khác: dùng chung flow checkout để hoàn tất + chọn phương thức thanh toán.
        actions.addAll([
          const SizedBox(height: 12),
          _buildActionButton(
            label: 'HOÀN TẤT KHÁM',
            icon: Icons.check_circle_outline,
            color: Colors.green,
            onPressed: _handleCheckout,
          ),
        ]);
      }
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
            children: actions,
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
            : ExpansionTile(
                title: Row(
                  children: [
                    Icon(Icons.touch_app, color: AppColors.primary),
                    const SizedBox(width: 8),
                    const Text('Thao tác',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                initiallyExpanded: false,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: actionButton,
                  ),
                ],
              ),
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

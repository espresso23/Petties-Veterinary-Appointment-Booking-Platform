import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../data/services/sos_matching_service.dart';
import '../../data/services/booking_service.dart';
import '../../utils/storage_service.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import 'sos_tracking_screen.dart';

/// SOS Matching Screen with search animation
/// Shows radar animation while searching for nearby clinics
class SosMatchingScreen extends StatefulWidget {
  final String petId;
  final String petName;
  final String? symptoms;

  const SosMatchingScreen({
    super.key,
    required this.petId,
    required this.petName,
    this.symptoms,
  });

  @override
  State<SosMatchingScreen> createState() => _SosMatchingScreenState();
}

class _SosMatchingScreenState extends State<SosMatchingScreen>
    with TickerProviderStateMixin {
  late AnimationController _radarController;
  late AnimationController _pulseController;
  late Animation<double> _radarAnimation;
  late Animation<double> _pulseAnimation;

  final _sosService = sosMatchingService;
  final _bookingService = BookingService();
  SosMatchingStatus? _status;
  bool _isSearching = true;
  String _statusText = 'Đang tìm phòng khám gần bạn...';
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _startMatching();
  }

  void _initAnimations() {
    // Radar sweep animation
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    _radarAnimation = Tween<double>(begin: 0, end: 2 * math.pi).animate(
      CurvedAnimation(parent: _radarController, curve: Curves.linear),
    );
    _radarController.repeat();

    // Pulse animation for clinic markers
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.5).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _pulseController.repeat(reverse: true);
  }

  Future<void> _startMatching() async {
    try {
      // Check location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() {
            _isSearching = false;
            _errorMessage = 'Vui lòng cấp quyền truy cập vị trí.';
            _statusText = _errorMessage!;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _isSearching = false;
          _errorMessage =
              'Quyền vị trí bị từ chối vĩnh viễn. Vui lòng vào Cài đặt để cấp quyền.';
          _statusText = _errorMessage!;
        });
        return;
      }

      // Get current location
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      // Get access token
      final storage = StorageService();
      final token = await storage.getString(AppConstants.accessTokenKey);
      if (token == null) {
        setState(() {
          _isSearching = false;
          _errorMessage = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
          _statusText = _errorMessage!;
        });
        return;
      }

      _sosService.setAccessToken(token);

      // Start matching
      final request = SosMatchRequest(
        petId: widget.petId,
        latitude: position.latitude,
        longitude: position.longitude,
        symptoms: widget.symptoms,
      );

      final response = await _sosService.startMatching(request);

      if (response == null) {
        setState(() {
          _isSearching = false;
          _errorMessage =
              _sosService.error ?? 'Có lỗi xảy ra. Vui lòng thử lại.';
          _statusText = _errorMessage!;
        });
        return;
      }

      // Listen to status changes
      _sosService.addListener(_onStatusChanged);
      _onStatusChanged();
    } catch (e) {
      setState(() {
        _isSearching = false;
        _errorMessage = 'Lỗi: ${e.toString()}';
        _statusText = _errorMessage!;
      });
    }
  }

  void _onStatusChanged() {
    final status = _sosService.currentStatus;
    if (status == null) return;

    setState(() {
      _status = status;

      if (status.isSearching) {
        _statusText = 'Đang tìm phòng khám gần bạn...';
        _isSearching = true;
      } else if (status.isPendingConfirm) {
        _statusText =
            'Đang chờ ${status.clinicName ?? 'phòng khám'} xác nhận...';
        _isSearching = true;
        if (status.currentClinicIndex != null && status.totalClinics != null) {
          _statusText +=
              '\n(${status.currentClinicIndex! + 1}/${status.totalClinics} phòng khám)';
        }
      } else if (status.isConfirmed) {
        _isSearching = false;
        _statusText = 'Đã tìm thấy phòng khám!';
        _radarController.stop();
        // Navigate to tracking screen
        _navigateToTracking();
      } else if (status.isCancelled) {
        _isSearching = false;
        _statusText =
            status.message ?? 'Không tìm thấy phòng khám trong khu vực.';
        _radarController.stop();
      }
    });
  }

  Future<void> _navigateToTracking() async {
    if (_status == null || _status!.bookingId.isEmpty) return;

    // Get full booking details for SosTrackingScreen
    try {
      final booking = await _bookingService.getBookingById(_status!.bookingId);
      if (mounted) {
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => SosTrackingScreen(booking: booking),
              ),
            );
          }
        });
      }
    } catch (e) {
      // If can't get booking details, just pop back
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Đã xác nhận! Xem chi tiết trong Lịch hẹn.')),
        );
        Navigator.pop(context, true);
      }
    }
  }

  Future<void> _handleCancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hủy yêu cầu SOS?'),
        content: const Text('Bạn có chắc muốn hủy yêu cầu cấp cứu?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Không'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Hủy yêu cầu'),
          ),
        ],
      ),
    );

    if (confirmed == true && _sosService.currentBookingId != null) {
      await _sosService.cancelMatching(_sosService.currentBookingId!);
      if (mounted) {
        Navigator.pop(context);
      }
    }
  }

  @override
  void dispose() {
    _radarController.dispose();
    _pulseController.dispose();
    _sosService.removeListener(_onStatusChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1a1a2e),
      appBar: AppBar(
        title: const Text('Cấp Cứu SOS'),
        backgroundColor: Colors.red.shade800,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Pet info header
            _buildPetHeader(),

            // Radar animation area
            Expanded(
              child: Center(
                child: _errorMessage != null
                    ? _buildErrorView()
                    : _buildRadarAnimation(),
              ),
            ),

            // Status text
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    _statusText,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (_status?.clinicName != null && _status!.isPendingConfirm)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _buildClinicInfo(),
                    ),
                ],
              ),
            ),

            // Cancel/Retry button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: _isSearching
                  ? ElevatedButton(
                      onPressed: _handleCancel,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey.shade800,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('HỦY YÊU CẦU'),
                    )
                  : _errorMessage != null
                      ? ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _errorMessage = null;
                              _isSearching = true;
                              _statusText = 'Đang tìm phòng khám gần bạn...';
                            });
                            _radarController.repeat();
                            _startMatching();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.coral,
                            foregroundColor: Colors.white,
                            minimumSize: const Size(double.infinity, 50),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text('THỬ LẠI'),
                        )
                      : const SizedBox.shrink(),
            ),

            // Hotline
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.phone, color: Colors.green, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Hotline: 1900-xxxx',
                    style: TextStyle(
                      color: Colors.grey.shade400,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPetHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.shade900.withAlpha(128),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade700),
      ),
      child: Row(
        children: [
          const Icon(Icons.pets, color: Colors.white, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Thú cưng: ${widget.petName}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (widget.symptoms != null)
                  Text(
                    'Triệu chứng: ${widget.symptoms}',
                    style: TextStyle(
                      color: Colors.grey.shade300,
                      fontSize: 14,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          Icons.error_outline,
          size: 80,
          color: Colors.red.shade400,
        ),
        const SizedBox(height: 16),
        Text(
          'Không thể kết nối',
          style: TextStyle(
            color: Colors.red.shade400,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildRadarAnimation() {
    return SizedBox(
      width: 280,
      height: 280,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Radar circles
          ...List.generate(4, (index) {
            return Container(
              width: 70.0 * (index + 1),
              height: 70.0 * (index + 1),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.green.withAlpha(64 - index * 12),
                  width: 1,
                ),
              ),
            );
          }),

          // Radar sweep
          AnimatedBuilder(
            animation: _radarAnimation,
            builder: (context, child) {
              return Transform.rotate(
                angle: _radarAnimation.value,
                child: CustomPaint(
                  size: const Size(280, 280),
                  painter: RadarSweepPainter(),
                ),
              );
            },
          ),

          // Center dot
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: Colors.green,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.green.withAlpha(128),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
          ),

          // Clinic marker (when pending confirm)
          if (_status?.isPendingConfirm == true)
            Positioned(
              top: 40,
              child: AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _pulseAnimation.value,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.orange,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.orange.withAlpha(128),
                            blurRadius: 10,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.local_hospital,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildClinicInfo() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.withAlpha(32),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.orange.withAlpha(64)),
      ),
      child: Column(
        children: [
          Text(
            _status!.clinicName ?? 'Phòng khám',
            style: const TextStyle(
              color: Colors.orange,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (_status!.distance != null)
            Text(
              'Cách ${_status!.distance!.toStringAsFixed(1)} km',
              style: TextStyle(
                color: Colors.grey.shade400,
                fontSize: 14,
              ),
            ),
        ],
      ),
    );
  }
}

/// Custom painter for radar sweep effect
class RadarSweepPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    final sweepPaint = Paint()
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi / 4,
        colors: [
          Colors.green.withAlpha(0),
          Colors.green.withAlpha(64),
          Colors.green.withAlpha(128),
          Colors.green.withAlpha(64),
          Colors.green.withAlpha(0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 8,
      math.pi / 4,
      true,
      sweepPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

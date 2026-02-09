import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/services/sos_matching_service.dart';
import '../../data/services/tracking_websocket_service.dart';
import '../../data/services/clinic_service.dart';
import '../../data/models/clinic.dart';
import '../../utils/storage_service.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';

/// SOS Radar Map Screen - Grab-like emergency matching experience
/// Shows full-screen map with nearby clinics and real-time staff tracking
class SosRadarMapScreen extends StatefulWidget {
  final String petId;
  final String petName;
  final String? petAvatar;
  final String? symptoms;
  final String? bookingId; // Optional: for resuming existing booking
  final bool isResumingBooking; // Flag to indicate this is a resumed booking

  const SosRadarMapScreen({
    super.key,
    required this.petId,
    required this.petName,
    this.petAvatar,
    this.symptoms,
    this.bookingId,
    this.isResumingBooking = false,
  });

  @override
  State<SosRadarMapScreen> createState() => _SosRadarMapScreenState();
}

class _SosRadarMapScreenState extends State<SosRadarMapScreen>
    with TickerProviderStateMixin {
  // Map controller
  final Completer<GoogleMapController> _mapController = Completer();

  // Animation controllers
  late AnimationController _radarController;
  late AnimationController _pulseController;
  late Animation<double> _radarAnimation;
  late Animation<double> _pulseAnimation;

  // Services
  final _sosService = sosMatchingService;
  final _clinicService = ClinicService();

  // State
  Position? _userPosition;
  SosMatchingStatus? _status;
  TrackingLocation? _staffLocation;
  TrackingHandler? _trackingHandler;
  List<Clinic> _nearbyClinics = [];
  String? _currentClinicId;
  bool _isResumedBooking = false; // Track if this is a resumed active booking

  Set<Marker> _markers = {};
  Set<Circle> _circles = {};
  Set<Polyline> _polylines = {};

  bool _isSearching = false;
  bool _isConfirmed = false;
  String _statusText = 'Đang tìm vị trí của bạn...';
  String? _errorMessage;
  int _countdownSeconds = 60;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _isResumedBooking = widget.isResumingBooking;
    _initAnimations();
    _initLocation();
  }

  void _initAnimations() {
    // Radar sweep animation
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    _radarAnimation = Tween<double>(begin: 0, end: 2 * math.pi).animate(
      CurvedAnimation(parent: _radarController, curve: Curves.linear),
    );

    // Pulse animation for markers
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _pulseAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _pulseController.repeat(reverse: true);
  }

  Future<void> _initLocation() async {
    try {
      // Check location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() {
            _errorMessage = 'Vui lòng cấp quyền truy cập vị trí.';
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _errorMessage =
              'Quyền vị trí bị từ chối. Vui lòng vào Cài đặt để cấp quyền.';
        });
        return;
      }

      // Get current location
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      setState(() {
        _userPosition = position;
      });

      // Move camera to user location
      final controller = await _mapController.future;
      controller.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(position.latitude, position.longitude),
          15,
        ),
      );

      // Fetch nearby clinics to display on map
      await _fetchNearbyClinics();

      // Start matching automatically
      _startMatching();
    } catch (e) {
      setState(() {
        _errorMessage = 'Không thể lấy vị trí. Vui lòng thử lại.';
      });
    }
  }

  /// Fetch nearby clinics to display on map
  Future<void> _fetchNearbyClinics() async {
    if (_userPosition == null) return;

    try {
      final clinics = await _clinicService.searchClinics(
        latitude: _userPosition!.latitude,
        longitude: _userPosition!.longitude,
        radiusKm: 10, // SOS_SEARCH_RADIUS_KM from backend
        sortByDistance: true,
        size: 10,
      );
      setState(() {
        _nearbyClinics = clinics;
        _updateMapElements(); // Re-render markers with clinics
      });
    } catch (e) {
      // Ignore error, clinic markers are optional
      debugPrint('Failed to fetch nearby clinics: $e');
    }
  }

  Future<void> _startMatching() async {
    if (_userPosition == null) return;

    setState(() {
      _isSearching = true;
      _statusText = 'Đang tìm phòng khám gần bạn...';
      _countdownSeconds = 60;
    });

    // Start radar animation
    _radarController.repeat();

    // Start countdown
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds > 0) {
        setState(() {
          _countdownSeconds--;
        });
      }
    });

    // Update map markers
    _updateMapElements();

    try {
      // Get access token
      final storage = StorageService();
      final token = await storage.getString(AppConstants.accessTokenKey);
      if (token == null) {
        setState(() {
          _isSearching = false;
          _errorMessage = 'Phiên đăng nhập hết hạn.';
        });
        return;
      }

      _sosService.setAccessToken(token);

      // If resuming a booking, skip creating new match - just subscribe to updates
      if (_isResumedBooking && widget.bookingId != null) {
        _sosService.subscribeToMatching(widget.bookingId!, (status) {
          _handleStatusUpdate(status);
        });
        // Fetch current status
        final currentStatus =
            await _sosService.getMatchingStatus(widget.bookingId!);
        if (currentStatus != null) {
          _handleStatusUpdate(currentStatus);
        }
        return;
      }

      // Start SOS matching (new booking)
      final request = SosMatchRequest(
        petId: widget.petId,
        latitude: _userPosition!.latitude,
        longitude: _userPosition!.longitude,
        symptoms: widget.symptoms,
      );

      final response = await _sosService.startMatching(request);

      if (response == null) {
        setState(() {
          _isSearching = false;
          _errorMessage = _sosService.error ?? 'Có lỗi xảy ra.';
        });
        _radarController.stop();
        _countdownTimer?.cancel();
        return;
      }

      // Check if this is a resumed active booking (not fresh SOS)
      if (_sosService.error?.contains('đang hoạt động') == true) {
        _isResumedBooking = true;
      }

      // Listen to status changes
      _sosService.addListener(_onStatusChanged);
      _onStatusChanged();
    } catch (e) {
      setState(() {
        _isSearching = false;
        _errorMessage = 'Lỗi: ${e.toString()}';
      });
      _radarController.stop();
      _countdownTimer?.cancel();
    }
  }

  void _onStatusChanged() {
    final status = _sosService.currentStatus;
    if (status == null) return;
    _handleStatusUpdate(status);
  }

  /// Handle status update from either listener or direct fetch
  void _handleStatusUpdate(SosMatchingStatus status) {
    setState(() {
      _status = status;
      _currentClinicId = status.clinicId; // Track which clinic is being contacted

      if (status.isSearching) {
        _statusText = 'Đang tìm phòng khám gần bạn...';
        _isSearching = true;
      } else if (status.isPendingConfirm) {
        _statusText = 'Đang chờ xác nhận...';
        _isSearching = true;
        _updateMapElements(); // Re-render to highlight current clinic
        _updateMapWithClinic();
      } else if (status.isConfirmed) {
        _isSearching = false;
        _isConfirmed = true;
        _statusText = 'Đã tìm thấy!';
        _radarController.stop();
        _countdownTimer?.cancel();
        _updateMapWithClinic();
        // Only start tracking if this is a fresh booking (not resumed from active)
        if (!_isResumedBooking) {
          _startTrackingStaff();
        }
      } else if (status.isCancelled) {
        _isSearching = false;
        _statusText = status.message ?? 'Không tìm thấy phòng khám.';
        _radarController.stop();
        _countdownTimer?.cancel();
      }
    });
  }

  void _updateMapElements() {
    if (_userPosition == null) return;

    final userLatLng =
        LatLng(_userPosition!.latitude, _userPosition!.longitude);

    // User location marker
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('user_location'),
        position: userLatLng,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        infoWindow: const InfoWindow(title: 'Vị trí của bạn'),
      ),
    };

    // Add all nearby clinics as markers
    for (final clinic in _nearbyClinics) {
      if (clinic.latitude != null && clinic.longitude != null) {
        final isCurrentClinic = _currentClinicId == clinic.clinicId;
        markers.add(Marker(
          markerId: MarkerId('clinic_${clinic.clinicId}'),
          position: LatLng(clinic.latitude!, clinic.longitude!),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            isCurrentClinic ? BitmapDescriptor.hueRed : BitmapDescriptor.hueOrange,
          ),
          infoWindow: InfoWindow(
            title: clinic.name,
            snippet: clinic.distance != null
                ? 'Cách ${clinic.distance!.toStringAsFixed(1)} km'
                : null,
          ),
        ));
      }
    }

    setState(() {
      _markers = markers;
    });

    // Search radius circle
    _circles = {
      Circle(
        circleId: const CircleId('search_radius'),
        center: userLatLng,
        radius: 5000, // 5km radius
        fillColor: Colors.blue.withValues(alpha: 0.1),
        strokeColor: Colors.blue.withValues(alpha: 0.3),
        strokeWidth: 2,
      ),
    };
  }

  void _updateMapWithClinic() {
    if (_userPosition == null || _status == null) return;

    final userLatLng =
        LatLng(_userPosition!.latitude, _userPosition!.longitude);

    // User location marker
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('user_location'),
        position: userLatLng,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        infoWindow: const InfoWindow(title: 'Vị trí của bạn'),
      ),
    };

    // Add all nearby clinics as markers (keep showing all clinics)
    for (final clinic in _nearbyClinics) {
      if (clinic.latitude != null && clinic.longitude != null) {
        final isCurrentClinic = _currentClinicId == clinic.clinicId;
        markers.add(Marker(
          markerId: MarkerId('clinic_${clinic.clinicId}'),
          position: LatLng(clinic.latitude!, clinic.longitude!),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            isCurrentClinic ? BitmapDescriptor.hueRed : BitmapDescriptor.hueOrange,
          ),
          infoWindow: InfoWindow(
            title: clinic.name,
            snippet: clinic.distance != null
                ? 'Cách ${clinic.distance!.toStringAsFixed(1)} km'
                : null,
          ),
        ));
      }
    }

    // If current clinic is not in nearby list, add it separately (from status)
    if (_status!.clinicLat != null && _status!.clinicLng != null) {
      final clinicLatLng = LatLng(_status!.clinicLat!, _status!.clinicLng!);

      // Check if current clinic already exists in markers
      final existsInNearby = _nearbyClinics.any((c) => c.clinicId == _status!.clinicId);

      if (!existsInNearby) {
        markers.add(
          Marker(
            markerId: const MarkerId('current_clinic_location'),
            position: clinicLatLng,
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
            infoWindow: InfoWindow(
              title: _status!.clinicName ?? 'Phòng khám',
              snippet: _status!.distance != null
                  ? 'Cách ${_status!.distance!.toStringAsFixed(1)} km'
                  : null,
            ),
          ),
        );
      }

      // Draw route line to current clinic
      _polylines = {
        Polyline(
          polylineId: const PolylineId('route'),
          points: [userLatLng, clinicLatLng],
          color: AppColors.coral,
          width: 4,
          patterns: [PatternItem.dash(20), PatternItem.gap(10)],
        ),
      };

      // Zoom to fit both markers
      _fitMapToBounds(userLatLng, clinicLatLng);
    }

    setState(() {
      _markers = markers;
    });
  }

  Future<void> _fitMapToBounds(LatLng point1, LatLng point2) async {
    final controller = await _mapController.future;
    final bounds = LatLngBounds(
      southwest: LatLng(
        math.min(point1.latitude, point2.latitude) - 0.01,
        math.min(point1.longitude, point2.longitude) - 0.01,
      ),
      northeast: LatLng(
        math.max(point1.latitude, point2.latitude) + 0.01,
        math.max(point1.longitude, point2.longitude) + 0.01,
      ),
    );
    controller.animateCamera(CameraUpdate.newLatLngBounds(bounds, 80));
  }

  void _startTrackingStaff() async {
    if (_status?.bookingId == null) return;

    // Set access token for tracking WebSocket before subscribing
    final storage = StorageService();
    final token = await storage.getString(AppConstants.accessTokenKey);
    if (token != null) {
      trackingWebsocket.setAccessToken(token);
    }

    _trackingHandler = (location) {
      if (mounted) {
        setState(() {
          _staffLocation = location;
          _updateStaffMarker(location);
        });
      }
    };

    trackingWebsocket.subscribeToTracking(
      _status!.bookingId,
      _trackingHandler!,
    );
  }

  void _updateStaffMarker(TrackingLocation location) {
    if (_userPosition == null) return;

    final userLatLng =
        LatLng(_userPosition!.latitude, _userPosition!.longitude);
    final staffLatLng = LatLng(location.latitude, location.longitude);

    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('user_location'),
        position: userLatLng,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        infoWindow: const InfoWindow(title: 'Vị trí của bạn'),
      ),
      Marker(
        markerId: const MarkerId('staff_location'),
        position: staffLatLng,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: InfoWindow(
          title: location.vetName ?? 'Bác sĩ',
          snippet: 'Đang trên đường đến',
        ),
      ),
    };

    // Draw route line from staff to user
    _polylines = {
      Polyline(
        polylineId: const PolylineId('staff_route'),
        points: [staffLatLng, userLatLng],
        color: AppColors.successDark,
        width: 5,
      ),
    };

    setState(() {
      _markers = markers;
    });

    _fitMapToBounds(userLatLng, staffLatLng);
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

  Future<void> _makePhoneCall(String phoneNumber) async {
    final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  @override
  void dispose() {
    _radarController.dispose();
    _pulseController.dispose();
    _countdownTimer?.cancel();
    _sosService.removeListener(_onStatusChanged);
    if (_trackingHandler != null && _status?.bookingId != null) {
      trackingWebsocket.unsubscribeFromTracking(
        _status!.bookingId,
        _trackingHandler!,
      );
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Full-screen map
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _userPosition != null
                  ? LatLng(_userPosition!.latitude, _userPosition!.longitude)
                  : const LatLng(10.762622, 106.660172),
              zoom: 15,
            ),
            onMapCreated: (controller) => _mapController.complete(controller),
            markers: _markers,
            circles: _circles,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),

          // Radar overlay animation (when searching)
          if (_isSearching && _userPosition != null) _buildRadarOverlay(),

          // Top safe area gradient
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              height: MediaQuery.of(context).padding.top + 60,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.5),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Back button
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16,
            child: CircleAvatar(
              backgroundColor: Colors.white,
              child: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.black),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ),

          // Pet info card (top)
          Positioned(
            top: MediaQuery.of(context).padding.top + 60,
            left: 16,
            right: 16,
            child: _buildPetInfoCard(),
          ),

          // Bottom sheet
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildBottomSheet(),
          ),

          // Emergency hotline FAB
          Positioned(
            right: 16,
            bottom: _isConfirmed ? 280 : 220,
            child: FloatingActionButton.small(
              heroTag: 'hotline',
              backgroundColor: Colors.green,
              onPressed: () => _makePhoneCall('1900xxxx'),
              child: const Icon(Icons.phone, color: Colors.white),
            ),
          ),

          // Error overlay
          if (_errorMessage != null) _buildErrorOverlay(),
        ],
      ),
    );
  }

  Widget _buildRadarOverlay() {
    return Positioned.fill(
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _radarAnimation,
          builder: (context, child) {
            return CustomPaint(
              painter: RadarOverlayPainter(
                angle: _radarAnimation.value,
                center: Offset(
                  MediaQuery.of(context).size.width / 2,
                  MediaQuery.of(context).size.height / 2 - 50,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildPetInfoCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        children: [
          // Pet avatar
          CircleAvatar(
            radius: 24,
            backgroundImage: widget.petAvatar != null
                ? NetworkImage(widget.petAvatar!)
                : null,
            child: widget.petAvatar == null
                ? const Icon(Icons.pets, size: 24)
                : null,
          ),
          const SizedBox(width: 12),
          // Pet info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.petName,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                if (widget.symptoms != null)
                  Text(
                    widget.symptoms!,
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          // Countdown timer
          if (_isSearching)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.timer, size: 16, color: Colors.red.shade700),
                  const SizedBox(width: 4),
                  Text(
                    '${_countdownSeconds}s',
                    style: TextStyle(
                      color: Colors.red.shade700,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBottomSheet() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),

              // Status section
              if (_isConfirmed && _status != null)
                _buildConfirmedContent()
              else if (_isSearching)
                _buildSearchingContent()
              else
                _buildIdleContent(),

              const SizedBox(height: 16),

              // Cancel button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _handleCancel,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('HỦY YÊU CẦU'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchingContent() {
    return Column(
      children: [
        // Status text with animation
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                return Opacity(
                  opacity: _pulseAnimation.value,
                  child: const Icon(
                    Icons.radar,
                    color: AppColors.coral,
                    size: 24,
                  ),
                );
              },
            ),
            const SizedBox(width: 8),
            Text(
              _statusText,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Progress indicator
        if (_status?.currentClinicIndex != null &&
            _status?.totalClinics != null)
          Column(
            children: [
              LinearProgressIndicator(
                value:
                    (_status!.currentClinicIndex! + 1) / _status!.totalClinics!,
                backgroundColor: Colors.grey.shade200,
                color: AppColors.coral,
              ),
              const SizedBox(height: 8),
              Text(
                'Đang liên hệ ${_status!.currentClinicIndex! + 1}/${_status!.totalClinics} phòng khám',
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 13,
                ),
              ),
            ],
          ),

        // Current clinic info
        if (_status?.isPendingConfirm == true && _status?.clinicName != null)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.orange.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.local_hospital, color: Colors.orange.shade700),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _status!.clinicName!,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade900,
                        ),
                      ),
                      if (_status!.distance != null)
                        Text(
                          'Cách ${_status!.distance!.toStringAsFixed(1)} km • Đang chờ xác nhận',
                          style: TextStyle(
                            color: Colors.orange.shade700,
                            fontSize: 13,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildConfirmedContent() {
    return Column(
      children: [
        // Success banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.green.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.green.shade200),
          ),
          child: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green.shade700, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đã tìm thấy phòng khám!',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.green.shade900,
                        fontSize: 16,
                      ),
                    ),
                    if (_staffLocation != null)
                      Text(
                        'Bác sĩ đang trên đường đến',
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Staff/Clinic info card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppColors.coral.withValues(alpha: 0.2),
                child: const Icon(Icons.local_hospital,
                    color: AppColors.coral, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _status?.clinicName ?? 'Phòng khám',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    if (_status?.distance != null)
                      Text(
                        'Cách ${_status!.distance!.toStringAsFixed(1)} km',
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 13,
                        ),
                      ),
                    if (_staffLocation != null)
                      Text(
                        'ETA: ${_staffLocation!.etaMinutes ?? '~'} phút',
                        style: const TextStyle(
                          color: AppColors.coral,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
              ),
              // Call button
              if (_status?.clinicPhone != null)
                IconButton(
                  onPressed: () => _makePhoneCall(_status!.clinicPhone!),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.all(12),
                  ),
                  icon: const Icon(Icons.phone, size: 24),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildIdleContent() {
    return Center(
      child: Text(
        _statusText,
        style: TextStyle(
          color: Colors.grey.shade600,
          fontSize: 16,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildErrorOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.5),
        child: Center(
          child: Container(
            margin: const EdgeInsets.all(32),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 64, color: Colors.red.shade400),
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  style: const TextStyle(fontSize: 16),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Quay lại'),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _errorMessage = null;
                          });
                          _initLocation();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.coral,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Thử lại'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Custom painter for radar sweep overlay effect
class RadarOverlayPainter extends CustomPainter {
  final double angle;
  final Offset center;

  RadarOverlayPainter({required this.angle, required this.center});

  @override
  void paint(Canvas canvas, Size size) {
    const radius = 150.0;

    // Draw radar sweep gradient
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: angle,
        endAngle: angle + math.pi / 3,
        colors: [
          Colors.green.withValues(alpha: 0),
          Colors.green.withValues(alpha: 0.1),
          Colors.green.withValues(alpha: 0.2),
          Colors.green.withValues(alpha: 0.1),
          Colors.green.withValues(alpha: 0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, sweepPaint);

    // Draw radar rings
    final ringPaint = Paint()
      ..color = Colors.green.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    for (int i = 1; i <= 3; i++) {
      canvas.drawCircle(center, radius * i / 3, ringPaint);
    }
  }

  @override
  bool shouldRepaint(covariant RadarOverlayPainter oldDelegate) {
    return angle != oldDelegate.angle;
  }
}

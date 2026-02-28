import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:logger/logger.dart';
import 'components/radar_overlay_painter.dart';
import 'components/sos_pet_info_card.dart';
import 'components/sos_status_panel.dart';
import '../../data/services/sos_matching_service.dart';
import '../../data/services/tracking_websocket_service.dart';
import '../../data/services/clinic_service.dart';
import '../../data/models/clinic.dart';
import '../../data/models/booking.dart';
import '../../utils/storage_service.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import '../../utils/map_utils.dart';

/// SOS Radar Map Screen - Grab-like emergency matching experience
/// Shows full-screen map with nearby clinics and real-time staff tracking
class SosRadarMapScreen extends StatefulWidget {
  final String petId;
  final String petName;
  final String? petAvatar;
  final String? symptoms;
  final String? address;
  final String? bookingId; // Optional: for resuming existing booking
  final bool isResumingBooking; // Flag to indicate this is a resumed booking
  final double? selectedLatitude; // From location picker
  final double? selectedLongitude; // From location picker

  final SosMatchingService? sosService;
  final ClinicService? clinicService;
  final TrackingWebsocketService? websocketService;
  final Position? initialPosition;

  const SosRadarMapScreen({
    super.key,
    required this.petId,
    required this.petName,
    this.petAvatar,
    this.symptoms,
    this.address,
    this.bookingId,
    this.isResumingBooking = false,
    this.selectedLatitude,
    this.selectedLongitude,
    this.sosService,
    this.clinicService,
    this.websocketService,
    this.initialPosition,
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
  late final SosMatchingService _sosService;
  late final ClinicService _clinicService;
  late final TrackingWebsocketService _websocketService;
  final _logger = Logger();

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
  BitmapDescriptor? _homeIcon;
  BitmapDescriptor? _clinicIcon;
  BitmapDescriptor? _vetIcon;

  @override
  void initState() {
    super.initState();
    _sosService = widget.sosService ?? sosMatchingService;
    _clinicService = widget.clinicService ?? ClinicService();
    _websocketService = widget.websocketService ?? trackingWebsocket;
    _isResumedBooking = widget.isResumingBooking;
    _initAnimations();
    _initCustomIcons();
    _initLocation();
    _sosService.addListener(_onStatusChanged);
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
      if (widget.initialPosition != null) {
        setState(() {
          _userPosition = widget.initialPosition;
          _statusText = 'Đang tìm phòng khám gần bạn...';
        });
        await _fetchNearbyClinics();
        _startMatching();
        return;
      }

      // If lat/lng were selected from Location Picker, use those
      if (widget.selectedLatitude != null && widget.selectedLongitude != null) {
        final pickedPosition = Position(
          latitude: widget.selectedLatitude!,
          longitude: widget.selectedLongitude!,
          timestamp: DateTime.now(),
          accuracy: 0,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        );
        setState(() {
          _userPosition = pickedPosition;
          _statusText = 'Đang tìm phòng khám gần bạn...';
        });

        // Move camera to selected location
        final controller = await _mapController.future;
        controller.animateCamera(
          CameraUpdate.newLatLngZoom(
            LatLng(widget.selectedLatitude!, widget.selectedLongitude!),
            15,
          ),
        );

        await _fetchNearbyClinics();
        _startMatching();
        return;
      }

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
        address: widget.address,
      );

      final response = await _sosService.startMatching(request);

      if (response == null) {
        // Check if error is due to existing active booking
        final errorMsg = _sosService.error ?? 'Có lỗi xảy ra.';
        final hasActiveBooking = errorMsg.contains('đang hoạt động') ||
            errorMsg.contains('yêu cầu SOS');

        if (hasActiveBooking && mounted) {
          // Show dialog to let user choose to continue or cancel old booking
          final shouldCancel = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              title: Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      color: Colors.orange.shade700, size: 28),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Có yêu cầu SOS đang xử lý',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                ],
              ),
              content: Text(
                '$errorMsg\n\nBạn muốn hủy yêu cầu cũ để tạo mới?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('QUAY LẠI'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  child: const Text('HỦY VÀ TẠO MỚI'),
                ),
              ],
            ),
          );

          if (shouldCancel == true && mounted) {
            // Try to get and cancel the active booking
            final activeBooking = await _sosService.getActiveSosBooking();
            if (activeBooking != null) {
              final cancelled =
                  await _sosService.cancelMatching(activeBooking.bookingId);
              if (cancelled) {
                // Retry matching after cancelling
                await _startMatching();
                return;
              } else {
                setState(() {
                  _errorMessage = 'Không thể hủy yêu cầu cũ. Vui lòng thử lại.';
                });
              }
            }
          } else if (mounted) {
            // User chose to go back
            Navigator.pop(context);
            return;
          }
        }

        setState(() {
          _isSearching = false;
          _errorMessage = errorMsg;
        });
        _radarController.stop();
        _countdownTimer?.cancel();
        return;
      }

      // Check if this is a resumed active booking (not fresh SOS)
      if (_sosService.error?.contains('đang hoạt động') == true) {
        _isResumedBooking = true;
      }

      // Listener added in initState
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
    if (!mounted) return;
    setState(() {
      _status = status;
      _currentClinicId =
          status.clinicId; // Track which clinic is being contacted

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
        _pulseController.stop();
        _countdownTimer?.cancel();
        _updateMapWithClinic();
        // Only start tracking if this is a fresh booking (not resumed from active)
        if (!_isResumedBooking) {
          _startTrackingStaff();
        }
        // Auto-navigate to tracking screen after a brief delay
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted && _isConfirmed) {
            _navigateToTracking();
          }
        });
      } else if (status.isCancelled) {
        _isSearching = false;
        _statusText = status.message ?? 'Không tìm thấy phòng khám.';
        _radarController.stop();
        _pulseController.stop();
        _countdownTimer?.cancel();
        // Khi SOS đã bị hủy hoặc không tìm thấy, KHÔNG tự điều hướng sang màn hình theo dõi
        _isConfirmed = false;
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
        icon: _homeIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
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
          icon: isCurrentClinic
              ? (_clinicIcon ??
                  BitmapDescriptor.defaultMarkerWithHue(
                      BitmapDescriptor.hueRed))
              : BitmapDescriptor.defaultMarkerWithHue(
                  BitmapDescriptor.hueOrange),
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
        fillColor: Colors.blue.withOpacity(0.1),
        strokeColor: Colors.blue.withOpacity(0.3),
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
        icon: _homeIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
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
          icon: isCurrentClinic
              ? (_clinicIcon ??
                  BitmapDescriptor.defaultMarkerWithHue(
                      BitmapDescriptor.hueRed))
              : BitmapDescriptor.defaultMarkerWithHue(
                  BitmapDescriptor.hueOrange),
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
      final existsInNearby =
          _nearbyClinics.any((c) => c.clinicId == _status!.clinicId);

      if (!existsInNearby) {
        markers.add(
          Marker(
            markerId: const MarkerId('current_clinic_location'),
            position: clinicLatLng,
            icon: _clinicIcon ??
                BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
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
      _websocketService.setAccessToken(token);
    }

    _trackingHandler = (location) {
      if (mounted) {
        setState(() {
          _staffLocation = location;
          _updateStaffMarker(location);
        });
      }
    };

    _websocketService.subscribeToTracking(
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
        icon: _homeIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        infoWindow: const InfoWindow(title: 'Vị trí của bạn'),
      ),
      Marker(
        markerId: const MarkerId('staff_location'),
        position: staffLatLng,
        icon: _vetIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: InfoWindow(
          title: _status?.staffName ?? 'Bác sĩ',
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

  /// Navigate to SOS Tracking Screen
  void _navigateToTracking() {
    if (!mounted) return;
    final bookingId = _status?.bookingId ?? _sosService.currentBookingId;
    if (bookingId != null) {
      // Pass the status as booking object if it contains basic info
      BookingResponse? booking;
      if (_status != null) {
        booking = BookingResponse(
          bookingId: _status!.bookingId,
          clinicId: _status!.clinicId,
          clinicName: _status!.clinicName,
          status: _status!.status,
          assignedStaffName: _status!.staffName,
          assignedStaffAvatarUrl: _status!.staffAvatarUrl,
          petId: widget.petId,
          petName: widget.petName,
          symptoms: widget.symptoms,
          homeAddress: widget.address,
          clinicAddress: _status!.clinicAddress,
          clinicPhone: _status!.clinicPhone,
          homeLat: _userPosition?.latitude,
          homeLong: _userPosition?.longitude,
          clinicLat: _status!.clinicLat,
          clinicLong: _status!.clinicLng,
        );
      }
      context.push('/sos/tracking/$bookingId', extra: booking);
    }
  }

  Future<void> _handleCancel() async {
    // If booking is already confirmed, navigate to tracking instead of cancelling
    if (_isConfirmed) {
      _navigateToTracking();
      return;
    }

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

    if (confirmed == true) {
      final bookingId = _sosService.currentBookingId ?? _status?.bookingId;
      if (bookingId == null || bookingId.isEmpty) {
        _logger.w('Cannot cancel SOS: bookingId is null or empty');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không tìm thấy mã yêu cầu để hủy')),
          );
          Navigator.pop(context); // Close radar if no ID
        }
        return;
      }

      final cancelled = await _sosService.cancelMatching(bookingId);
      if (!cancelled && mounted) {
        // If cancel failed (e.g., already confirmed), navigate to tracking
        final currentStatus = _sosService.currentStatus?.status;
        if (currentStatus == 'CONFIRMED' || currentStatus == 'IN_PROGRESS') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text(
                    'Booking đã được xác nhận. Đang chuyển sang theo dõi...')),
          );
          _navigateToTracking();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không thể hủy yêu cầu lúc này')),
          );
        }
        return;
      }
      if (mounted) {
        Navigator.pop(context);
      }
    }
  }

  Future<void> _initCustomIcons() async {
    _homeIcon = await MapUtils.createCustomMarker(
      iconData: Icons.person_pin_circle,
      color: AppColors.coral,
      imageUrl: (widget.petAvatar != null && widget.petAvatar!.isNotEmpty)
          ? widget.petAvatar
          : null,
    );
    _clinicIcon = await MapUtils.createCustomMarker(
      iconData: Icons.local_hospital,
      color: Colors.red,
    );
    _vetIcon = await MapUtils.createCustomMarker(
      iconData: Icons.medical_services,
      color: Colors.orange,
      imageUrl: _status?.staffAvatarUrl,
    );
    if (mounted) setState(() {});
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
      _websocketService.unsubscribeFromTracking(
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
            myLocationButtonEnabled: true,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            padding: const EdgeInsets.only(bottom: 150, top: 100),
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
                    Colors.black.withOpacity(0.5),
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
            child: SosPetInfoCard(
              petName: widget.petName,
              petAvatar: widget.petAvatar,
              symptoms: widget.symptoms,
              countdownSeconds: _countdownSeconds,
              isSearching: _isSearching,
            ),
          ),

          // Bottom sheet
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: SosStatusPanel(
              isConfirmed: _isConfirmed,
              isSearching: _isSearching,
              status: _status,
              statusText: _statusText,
              pulseAnimation: _pulseAnimation,
              staffLocation: _staffLocation,
              onCancel: _handleCancel,
              onTrack: _navigateToTracking,
              onCall: _makePhoneCall,
            ),
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

  Widget _buildErrorOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.5),
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

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import '../../config/env/environment.dart';
import '../../data/models/booking.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/tracking_websocket_service.dart';
import '../../data/services/tracking_rest_service.dart';
import '../../routing/app_routes.dart';
import '../../utils/storage_service.dart';
import '../../utils/map_utils.dart';

class SosTrackingScreen extends StatefulWidget {
  final BookingResponse? booking;
  final String? bookingId;
  final BookingService? bookingService;
  final TrackingWebsocketService? websocketService;

  const SosTrackingScreen({
    super.key,
    this.booking,
    this.bookingId,
    this.bookingService,
    this.websocketService,
  }) : assert(booking != null || bookingId != null,
            'Either booking or bookingId must be provided');

  @override
  State<SosTrackingScreen> createState() => _SosTrackingScreenState();
}

class _SosTrackingScreenState extends State<SosTrackingScreen>
    with WidgetsBindingObserver {
  static const bool _kDebugTracking = true; // Bật true khi cần debug chi tiết

  static const double _kSheetMinSize = 0.18;
  // Sheet dạng Grab-style:
  // - Thu gọn: ~18% chiều cao (chỉ thấy hàng bác sĩ + handle).
  // - Mở rộng: ~50% chiều cao, vẫn chừa ~50% cho bản đồ phía trên.
  static const double _kSheetMaxSize = 0.50;

  final Completer<GoogleMapController> _controller = Completer();
  late final BookingService _bookingService;
  late final TrackingWebsocketService _websocketService;
  late final TrackingRestService _trackingRestService;
  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};
  List<LatLng> _routePoints = []; // Cached route polyline points for snapping
  TrackingHandler? _trackingHandler;
  BookingResponse? _booking;
  bool _isLoading = true;
  String? _error;
  DateTime? _lastRouteUpdate;
  BitmapDescriptor? _homeIcon;
  BitmapDescriptor? _vetIcon;
  BitmapDescriptor? _clinicIcon;
  bool _staffArrived = false;
  bool _isHandlingArrival = false;
  int? _etaMinutes;
  double? _distanceKm;
  LatLng? _currentVetPosition;
  Timer? _vetAnimationTimer;
  double _sheetExtent = _kSheetMinSize;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bookingService = widget.bookingService ?? BookingService();
    _websocketService = widget.websocketService ?? trackingWebsocket;
    _trackingRestService = TrackingRestService();
    _initCustomIcons();
    _initBooking();
  }

  Future<void> _initCustomIcons() async {
    _homeIcon = await MapUtils.createCustomMarker(
        iconData: Icons.person_pin_circle, color: AppColors.coral);
    _vetIcon = await MapUtils.createCustomMarker(
        iconData: Icons.motorcycle, color: AppColors.successDark);
    _clinicIcon = await MapUtils.createCustomMarker(
        iconData: Icons.local_hospital, color: Colors.red);
    if (mounted) setState(() {});
  }

  Future<void> _initBooking() async {
    // Set access token for tracking WebSocket
    final storage = StorageService();
    final token = await storage.getString(AppConstants.accessTokenKey);
    if (token != null) {
      _websocketService.setAccessToken(token);
    }

    final targetBookingId = widget.booking?.bookingId ?? widget.bookingId;

    if (targetBookingId == null) {
      if (mounted) {
        setState(() {
          _error = 'Không thể tải thông tin booking';
          _isLoading = false;
        });
      }
      return;
    }

    try {
      final booking = await _bookingService.getBookingById(targetBookingId);
      if (mounted) {
        _booking = booking;
        _staffArrived = _booking?.arrivedAt != null;
        await _updateAvatarIcons();
        setState(() {
          _isLoading = false;
        });
        _initializeMarkers();
        await _loadInitialStaffLocation();
        if (_staffArrived) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _handleStaffArrivedAndExit();
          });
          return;
        }
        _startTracking();
      }
    } catch (e) {
      if (widget.booking != null && mounted) {
        _booking = widget.booking;
        _staffArrived = _booking?.arrivedAt != null;
        await _updateAvatarIcons();
        setState(() {
          _isLoading = false;
        });
        _initializeMarkers();
        await _loadInitialStaffLocation();
        if (_staffArrived) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _handleStaffArrivedAndExit();
          });
          return;
        }
        _startTracking();
      } else if (mounted) {
        setState(() {
          _error = 'Không thể tải thông tin booking';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _updateAvatarIcons() async {
    if (_booking == null) return;

    // Home marker: ưu tiên avatar thú cưng, fallback avatar chủ nuôi
    final petPhoto = _booking!.petPhotoUrl;
    final ownerAvatar = _booking!.ownerAvatarUrl;

    if (petPhoto != null && petPhoto.isNotEmpty) {
      _homeIcon = await MapUtils.createCustomMarker(imageUrl: petPhoto);
    } else if (ownerAvatar != null && ownerAvatar.isNotEmpty) {
      _homeIcon = await MapUtils.createCustomMarker(imageUrl: ownerAvatar);
    }

    // Vet marker: dùng avatar staff nếu có
    if (_booking!.assignedStaffAvatarUrl != null &&
        _booking!.assignedStaffAvatarUrl!.isNotEmpty) {
      _vetIcon = await MapUtils.createCustomMarker(
          imageUrl: _booking!.assignedStaffAvatarUrl);
    }
  }

  void _startTracking() {
    if (_booking?.bookingId == null) return;

    _trackingHandler = (location) {
      if (_kDebugTracking) {
        debugPrint('[SOS Tracking][WS] Nhận dữ liệu mới: arrived=${location.arrived}, lat=${location.latitude}, lng=${location.longitude}');
      }
      if (!mounted) return;

      if (location.arrived) {
        _stopTrackingSubscription();
        setState(() {
          _staffArrived = true;
        });
        _handleStaffArrivedAndExit();
        return;
      }

      if (_kDebugTracking) {
        debugPrint(
          '[SOS Tracking][WS] booking=${location.bookingId} '
          'lat=${location.latitude}, lng=${location.longitude}, '
          'eta=${location.etaMinutes}, distanceKm=${location.distanceKm}, '
          'updated=${location.lastUpdated.toIso8601String()}',
        );
      }

      // Cập nhật ETA & khoảng cách
      double? distance;
      if (_booking?.homeLat != null && _booking?.homeLong != null) {
        if (_kDebugTracking) {
          debugPrint('[SOS Tracking] Đang tính toán khoảng cách: Staff(${location.latitude}, ${location.longitude}) -> Home(${_booking!.homeLat}, ${_booking!.homeLong})');
        }
        distance = _computeDistanceKm(
          LatLng(location.latitude, location.longitude),
          LatLng(_booking!.homeLat!, _booking!.homeLong!),
          backendDistance: location.distanceKm,
        );
      } else {
        distance = location.distanceKm;
      }

      setState(() {
        _etaMinutes = location.etaMinutes;
        if (distance != null) {
          _distanceKm = distance;
        }
      });

      // Cập nhật marker bác sĩ + route line
      _updateMarkers(location);
      _moveCamera(location);
      _updateRouteLine(location);
    };

    _websocketService.subscribeToTracking(
      _booking!.bookingId!,
      _trackingHandler!,
    );
  }

  void _stopTrackingSubscription() {
    if (_booking?.bookingId != null && _trackingHandler != null) {
      trackingWebsocket.unsubscribeFromTracking(
        _booking!.bookingId!,
        _trackingHandler!,
      );
      _trackingHandler = null;
    }
    _vetAnimationTimer?.cancel();
  }

  Future<void> _handleStaffArrivedAndExit() async {
    if (_isHandlingArrival || _booking == null || !mounted) return;

    _isHandlingArrival = true;
    _stopTrackingSubscription();

    BookingResponse bookingForDetail = _booking!;
    final bookingId = bookingForDetail.bookingId;

    if (bookingId != null) {
      try {
        bookingForDetail = await _bookingService.getBookingById(bookingId);
        _booking = bookingForDetail;
      } catch (_) {
        // Fall back to the current booking snapshot if refresh fails.
      }
    }

    if (!mounted) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text(
            'Nhân viên đã đến nơi. Đang chuyển về chi tiết lịch hẹn...',
          ),
          duration: Duration(milliseconds: 1200),
        ),
      );

    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    context.go(AppRoutes.bookingDetailView, extra: bookingForDetail);
  }

  void _initializeMarkers() {
    if (_booking == null) return;

    final markers = <Marker>{};
    final points = <LatLng>[];

    LatLng? homePos;
    LatLng? clinicPos;

    // Home marker
    if (_booking!.homeLat != null && _booking!.homeLong != null) {
      homePos = LatLng(_booking!.homeLat!, _booking!.homeLong!);
      markers.add(Marker(
        markerId: const MarkerId('home_location'),
        position: homePos,
        infoWindow: const InfoWindow(title: 'Vị trí của bạn'),
        icon: _homeIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
      ));
      points.add(homePos);
    }

    // Clinic marker
    if (_booking!.clinicLat != null && _booking!.clinicLong != null) {
      clinicPos = LatLng(_booking!.clinicLat!, _booking!.clinicLong!);
      markers.add(Marker(
        markerId: const MarkerId('clinic_location'),
        position: clinicPos,
        infoWindow: InfoWindow(title: _booking!.clinicName ?? 'Phòng khám'),
        icon: _clinicIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
      ));
      points.add(clinicPos);
    }

    setState(() => _markers = markers);
    if (points.isNotEmpty) {
      _fitMapToPoints(points);
    }
  }

  /// Load vị trí hiện tại của bác sĩ qua REST để hiển thị marker ngay khi mở màn hình
  Future<void> _loadInitialStaffLocation() async {
    if (_booking?.bookingId == null) return;
    try {
      final location =
          await _trackingRestService.getStaffLocation(_booking!.bookingId!);
      if (location == null || !mounted) return;

      if (_kDebugTracking) {
        debugPrint(
          '[SOS Tracking][REST] booking=${location.bookingId} '
          'lat=${location.latitude}, lng=${location.longitude}, '
          'eta=${location.etaMinutes}, distanceKm=${location.distanceKm}, '
          'updated=${location.lastUpdated.toIso8601String()}',
        );
      }

      // Cập nhật ETA & khoảng cách ban đầu
      final distance = _computeDistanceKm(
        LatLng(location.latitude, location.longitude),
        LatLng(_booking!.homeLat!, _booking!.homeLong!),
        backendDistance: location.distanceKm,
      );
      setState(() {
        _etaMinutes = location.etaMinutes;
        _distanceKm = distance ?? _distanceKm;
      });

      // Vẽ marker + route line + camera ngay vị trí hiện tại của bác sĩ
      _updateMarkers(location);
      _moveCamera(location);
      _updateRouteLine(location);
    } catch (e) {
      // Không chặn luồng nếu lỗi, WebSocket vẫn sẽ cập nhật sau
      debugPrint('Error loading initial staff location: $e');
    }
  }

  Future<void> _fitMapToPoints(List<LatLng> points) async {
    final GoogleMapController controller = await _controller.future;
    if (points.length == 1) {
      controller.animateCamera(CameraUpdate.newLatLngZoom(points.first, 15));
      return;
    }

    LatLngBounds bounds;
    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLng = points.first.longitude;
    double maxLng = points.first.longitude;

    for (var point in points) {
      if (point.latitude < minLat) minLat = point.latitude;
      if (point.latitude > maxLat) maxLat = point.latitude;
      if (point.longitude < minLng) minLng = point.longitude;
      if (point.longitude > maxLng) maxLng = point.longitude;
    }

    bounds = LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );

    controller.animateCamera(CameraUpdate.newLatLngBounds(bounds, 50));
  }

  /// Snap a GPS position to the nearest point on the cached route polyline
  LatLng _snapToRoute(LatLng rawPosition) {
    if (_routePoints.length < 2) return rawPosition;

    double minDist = double.infinity;
    LatLng closest = rawPosition;
    int closestIndex = 0;

    for (int i = 0; i < _routePoints.length; i++) {
      final p = _routePoints[i];
      final dist = _distanceSq(rawPosition, p);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
        closestIndex = i;
      }
    }

    // Ước lượng khoảng cách giữa raw position và tuyến đường (m)
    final approxDistanceMeters = math.sqrt(minDist) * 111000;
    const maxSnapDistanceMeters = 80.0;

    // Nếu điểm GPS cách tuyến đường quá xa → giữ nguyên vị trí thật, không snap
    if (approxDistanceMeters > maxSnapDistanceMeters) {
      if (_kDebugTracking) {
        debugPrint(
            '[SOS Tracking][SNAP] Bỏ snap vì cách route ~${approxDistanceMeters.toStringAsFixed(1)}m');
      }
      return rawPosition;
    }

    // Khi đã rất gần nhà (< 50m) thì ưu tiên giữ vị trí thật để tránh dính chặt vào marker nhà
    if (_booking?.homeLat != null && _booking?.homeLong != null) {
      final homePos = LatLng(_booking!.homeLat!, _booking!.homeLong!);
      final homeDistanceKm = _computeDistanceKm(rawPosition, homePos);
      if (homeDistanceKm != null && homeDistanceKm * 1000 < 50) {
        if (_kDebugTracking) {
          debugPrint(
              '[SOS Tracking][SNAP] Bỏ snap vì quá gần nhà (~${(homeDistanceKm * 1000).toStringAsFixed(1)}m)');
        }
        return rawPosition;
      }
    }

    // Trim the polyline: only show from vet's position to destination
    if (closestIndex > 0 && closestIndex < _routePoints.length) {
      final trimmedPoints = [
        closest,
        ..._routePoints.sublist(closestIndex + 1)
      ];
      _polylines = {
        Polyline(
          polylineId: const PolylineId('route_to_home'),
          points: trimmedPoints,
          color: AppColors.coral,
          width: 5,
          jointType: JointType.round,
          startCap: Cap.roundCap,
          endCap: Cap.roundCap,
        ),
      };
    }

    return closest;
  }

  /// Squared distance between two LatLng points (for comparison only, no sqrt needed)
  double _distanceSq(LatLng a, LatLng b) {
    final dLat = a.latitude - b.latitude;
    final dLng = a.longitude - b.longitude;
    return dLat * dLat + dLng * dLng;
  }

  void _updateMarkers(TrackingLocation location) {
    if (_booking == null) return;

    final rawPosition = LatLng(location.latitude, location.longitude);
    // Snap vet marker onto the route polyline (like Grab)
    final targetPosition = _snapToRoute(rawPosition);

    void applyPosition(LatLng position) {
      final updatedMarkers = <Marker>{};

      // Giữ lại marker nhà và phòng khám
      for (var m in _markers) {
        if (m.markerId.value != 'vet_location' &&
            m.markerId.value != 'vet_raw_location') {
          updatedMarkers.add(m);
        }
      }

      // Thêm/ cập nhật marker bác sĩ với avatar, nổi trên polyline
      updatedMarkers.add(
        Marker(
          markerId: const MarkerId('vet_location'),
          position: position,
          infoWindow: const InfoWindow(title: 'Bác sĩ đang di chuyển'),
          icon: _vetIcon ??
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
          zIndexInt: 3,
          anchor: const Offset(0.5, 0.5),
        ),
      );

      // Marker debug thể hiện vị trí GPS raw (chỉ khi bật debug)
      if (_kDebugTracking) {
        updatedMarkers.add(
          Marker(
            markerId: const MarkerId('vet_raw_location'),
            position: rawPosition,
            icon: BitmapDescriptor.defaultMarkerWithHue(
                BitmapDescriptor.hueAzure),
            zIndexInt: 2,
          ),
        );
      }

      _markers = updatedMarkers;
    }

    // Nếu chưa có vị trí trước đó → đặt thẳng marker
    if (_currentVetPosition == null) {
      _currentVetPosition = targetPosition;
      setState(() {
        applyPosition(targetPosition);
      });
      return;
    }

    // Nội suy mượt từ vị trí cũ → mới
    final startPosition = _currentVetPosition!;
    _vetAnimationTimer?.cancel();

    const int steps = 20;
    const int totalMs = 1000;
    const int stepMs = totalMs ~/ steps;
    int currentStep = 0;

    _vetAnimationTimer =
        Timer.periodic(const Duration(milliseconds: stepMs), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      currentStep++;
      final t = currentStep / steps;
      final lat = startPosition.latitude +
          (targetPosition.latitude - startPosition.latitude) * t;
      final lng = startPosition.longitude +
          (targetPosition.longitude - startPosition.longitude) * t;
      final interpolated = LatLng(lat, lng);

      setState(() {
        applyPosition(interpolated);
      });

      if (currentStep >= steps) {
        timer.cancel();
        _currentVetPosition = targetPosition;
      }
    });
  }

  /// Tính khoảng cách (km) giữa bác sĩ và nhà pet owner.
  /// Dùng Haversine client-side nếu 2 thiết bị rất gần (< 50m) để tránh backend bị stuck,
  /// còn lại ưu tiên dùng distance từ backend.
  double? _computeDistanceKm(
    LatLng from,
    LatLng to, {
    double? backendDistance,
  }) {
    const double earthRadiusKm = 6371.0;
    final double dLat = _degToRad(to.latitude - from.latitude);
    final double dLon = _degToRad(to.longitude - from.longitude);
    final double lat1 = _degToRad(from.latitude);
    final double lat2 = _degToRad(to.latitude);

    final double a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.sin(dLon / 2) *
            math.sin(dLon / 2) *
            math.cos(lat1) *
            math.cos(lat2);
    final double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    final double haversineDistance = earthRadiusKm * c;

    // Nếu khoảng cách đường chim bay cực nhỏ (< 50m), hệ thống API Map dễ bị snap nhầm đường
    // nên ta ưu tiên dùng Haversine nội suy để tránh bị kẹt số.
    if (haversineDistance < 0.05) {
      return haversineDistance;
    }

    return backendDistance ?? haversineDistance;
  }

  double _degToRad(double deg) => deg * (math.pi / 180.0);

  void _updateRouteLine(TrackingLocation location) {
    if (_booking?.homeLat == null || _booking?.homeLong == null) return;

    // Throttling: Only update route every 5 seconds để mượt hơn nhưng vẫn tiết kiệm quota
    if (_lastRouteUpdate != null &&
        DateTime.now().difference(_lastRouteUpdate!).inSeconds < 5) {
      return;
    }

    _fetchRoute(
      LatLng(location.latitude, location.longitude),
      LatLng(_booking!.homeLat!, _booking!.homeLong!),
    );
  }

  Future<void> _fetchRoute(LatLng origin, LatLng destination) async {
    try {
      final apiKey = Environment.goongApiKey;
      if (apiKey.isEmpty) {
        throw Exception('Goong API key is missing. Using fallback polyline.');
      }

      // Chọn phương tiện dựa trên khoảng cách chim bay hiện tại
      final double distance = _computeDistanceKm(origin, destination) ?? 5.0;
      String vehicleType = 'car';
      if (distance <= 0.2) {
        vehicleType = 'foot'; // Đi bộ nếu < 200m (trong nội khu toà nhà)
      } else if (distance <= 3.0) {
        vehicleType = 'bike'; // Xe máy nếu < 3km
      }

      final url =
          'https://rsapi.goong.io/Direction?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&vehicle=$vehicleType&api_key=$apiKey';

      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['routes'] != null && (data['routes'] as List).isNotEmpty) {
          final points = data['routes'][0]['overview_polyline']['points'];
          final decodedPoints = _decodePolyline(points);

          if (mounted) {
            // Cache route points for snapping marker lên đúng tuyến đường
            _routePoints = decodedPoints;
            setState(() {
              _polylines = {
                Polyline(
                  polylineId: const PolylineId('route_to_home'),
                  points: decodedPoints,
                  color: AppColors.coral,
                  width: 5,
                  jointType: JointType.round,
                  startCap: Cap.roundCap,
                  endCap: Cap.roundCap,
                ),
              };
              _lastRouteUpdate = DateTime.now();
            });
          }
          return;
        }
      } else {
        debugPrint(
            'Goong Direction API failed with status ${response.statusCode}');
      }

      // Nếu không có route hợp lệ hoặc HTTP != 200 → fallback line
      if (mounted) {
        _routePoints = [origin, destination];
        setState(() {
          _polylines = {
            Polyline(
              polylineId: const PolylineId('route_to_home_fallback'),
              points: [origin, destination],
              color: AppColors.coral.withValues(alpha: 0.5),
              width: 3,
              patterns: [PatternItem.dash(10), PatternItem.gap(10)],
            ),
          };
          _lastRouteUpdate = DateTime.now();
        });
      }
    } catch (e) {
      debugPrint('Error fetching route: $e');
      // Fallback: draw straight dashed line if API fails
      if (mounted) {
        _routePoints = [origin, destination];
        setState(() {
          _polylines = {
            Polyline(
              polylineId: const PolylineId('route_to_home_fallback'),
              points: [origin, destination],
              color: AppColors.coral.withValues(alpha: 0.5),
              width: 3,
              patterns: [PatternItem.dash(10), PatternItem.gap(10)],
            ),
          };
          _lastRouteUpdate = DateTime.now();
        });
      }
    }
  }

  List<LatLng> _decodePolyline(String encoded) {
    List<LatLng> polyline = [];
    int index = 0, len = encoded.length;
    int lat = 0, lng = 0;

    while (index < len) {
      int b, shift = 0, result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      polyline.add(LatLng(lat / 1E5, lng / 1E5));
    }
    return polyline;
  }

  Future<void> _moveCamera(TrackingLocation location) async {
    final GoogleMapController controller = await _controller.future;
    final vetPos = LatLng(location.latitude, location.longitude);

    final double? distance = location.distanceKm ?? _distanceKm;

    // Nếu biết cả vị trí nhà và bác sĩ
    if (_booking?.homeLat != null && _booking?.homeLong != null) {
      final homePos = LatLng(_booking!.homeLat!, _booking!.homeLong!);

      // Khi bác sĩ đã rất gần nhà, ưu tiên follow vị trí bác sĩ để thấy rõ quãng đường ngắn
      if (distance != null && distance <= 0.2) {
        controller.animateCamera(
          CameraUpdate.newLatLngZoom(vetPos, 17),
        );
        return;
      }

      double minLat = math.min(homePos.latitude, vetPos.latitude);
      double maxLat = math.max(homePos.latitude, vetPos.latitude);
      double minLng = math.min(homePos.longitude, vetPos.longitude);
      double maxLng = math.max(homePos.longitude, vetPos.longitude);

      // Nếu 2 điểm quá gần nhau, mở rộng nhẹ bounds để tránh lỗi
      if ((maxLat - minLat).abs() < 0.0005) {
        minLat -= 0.0005;
        maxLat += 0.0005;
      }
      if ((maxLng - minLng).abs() < 0.0005) {
        minLng -= 0.0005;
        maxLng += 0.0005;
      }

      final bounds = LatLngBounds(
        southwest: LatLng(minLat, minLng),
        northeast: LatLng(maxLat, maxLng),
      );

      controller.animateCamera(
        CameraUpdate.newLatLngBounds(bounds, 80),
      );
      return;
    }

    // Fallback: chỉ biết vị trí bác sĩ → dùng zoom động theo khoảng cách
    double zoom;
    if (distance == null) {
      zoom = 15;
    } else if (distance <= 0.3) {
      zoom = 18;
    } else if (distance <= 1) {
      zoom = 16.5;
    } else if (distance <= 3) {
      zoom = 15;
    } else {
      zoom = 13.5;
    }

    controller.animateCamera(
      CameraUpdate.newLatLngZoom(vetPos, zoom),
    );
  }

  Future<void> _makePhoneCall(String phoneNumber) async {
    final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  @override
  void dispose() {
    _stopTrackingSubscription();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.resumed) {
      // Khi app quay lại foreground, đảm bảo:
      // - Có snapshot vị trí mới nhất
      // - Đã subscribe WebSocket nếu trước đó bị mất kết nối
      if (_booking?.bookingId != null) {
        _loadInitialStaffLocation();

        // Nếu vì lý do nào đó handler đã bị huỷ (ví dụ do lỗi trước đó),
        // khởi tạo lại tracking an toàn.
        if (_trackingHandler == null) {
          if (!_staffArrived) {
            _startTracking();
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('THEO DÕI BÁC SĨ (SOS)'),
          backgroundColor: AppColors.coral,
          foregroundColor: Colors.white,
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null || _booking == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('THEO DÕI BÁC SĨ (SOS)'),
          backgroundColor: AppColors.coral,
          foregroundColor: Colors.white,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text(_error ?? 'Không tìm thấy thông tin booking'),
            ],
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(AppRoutes.home);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go(AppRoutes.home);
              }
            },
          ),
          title: const Text('THEO DÕI BÁC SĨ (SOS)'),
          backgroundColor: AppColors.coral,
          foregroundColor: Colors.white,
        ),
        body: Stack(
          children: [
            GoogleMap(
              initialCameraPosition: const CameraPosition(
                target: LatLng(10.762622, 106.660172), // Default HCM City
                zoom: 15,
              ),
              onMapCreated: (GoogleMapController controller) {
                _controller.complete(controller);
              },
              markers: _markers,
              polylines: _polylines,
              myLocationEnabled: true,
              myLocationButtonEnabled: true,
              padding: const EdgeInsets.only(
                bottom: 220,
                top: 100,
              ),
            ),
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: _buildBookingHeader(),
            ),
            _buildDraggableVetSheet(),
          ],
        ),
      ),
    );
  }

  Widget _buildBookingHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: AppColors.coral.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.coral.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.pets, size: 16, color: AppColors.coral),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              '${_booking?.petName ?? 'Thú cưng'} • ${_booking?.bookingCode ?? 'SOS'}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: AppColors.stone900,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVetInfoCard() {
    // Coi như đã có tracking data ngay khi nhận được ít nhất 1 vị trí bác sĩ
    // (kể cả khi ETA/khoảng cách từ backend chưa tính xong),
    // giúp Pet Owner thấy rõ là đang có di chuyển trên bản đồ.
    final bool hasTrackingData = _currentVetPosition != null;

    // Khoảng cách hiển thị ưu tiên km, nếu < 1km thì chuyển sang mét cho trực quan
    final double? rawDistance = _distanceKm;

    String distanceText = '-- km';
    if (rawDistance != null) {
      if (rawDistance < 1.0) {
        distanceText = '${(rawDistance * 1000).toInt()} m';
      } else {
        distanceText = '${rawDistance.toStringAsFixed(1)} km';
      }
    }

    // Text trạng thái chính, ưu tiên cảm giác “gần như Grab”
    String statusText;
    if (_staffArrived) {
      statusText = 'Bác sĩ đã đến nơi. Tracking đã dừng.';
    } else if (!hasTrackingData) {
      if (_booking?.status == 'IN_PROGRESS') {
        statusText = 'Bác sĩ đã bắt đầu di chuyển, đang chờ cập nhật vị trí...';
      } else {
        // Tránh trùng với dòng text phía trên, nhấn mạnh trạng thái điều phối
        statusText =
            'Hệ thống đang điều phối và chờ bác sĩ bắt đầu di chuyển...';
      }
    } else if (rawDistance != null && rawDistance <= 0.1) {
      statusText = 'Bác sĩ đã ở rất gần vị trí của bạn';
    } else if (rawDistance != null && rawDistance <= 0.5) {
      statusText = 'Bác sĩ sắp đến nơi! Vui lòng chú ý điện thoại.';
    } else {
      statusText = 'Bác sĩ đang trên đường đến địa chỉ...';
    }

    return Container(
      key: const ValueKey('vet-info-expanded'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasTrackingData)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _etaMinutes != null
                          ? '${_etaMinutes!.clamp(1, 120)} phút'
                          : '-- phút',
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.successDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'DỰ KIẾN ĐẾN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.stone500,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      distanceText,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Khoảng cách',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.stone500,
                      ),
                    ),
                  ],
                ),
              ],
            )
          else
            const SizedBox.shrink(),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            decoration: BoxDecoration(
              color: AppColors.stone100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AppColors.successDark,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    statusText,
                    style: const TextStyle(
                      color: AppColors.stone800,
                      fontStyle: FontStyle.italic,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Divider(height: 1),
          ),
          _buildVetInfoRow(),
        ],
      ),
    );
  }

  Widget _buildVetInfoRow({bool compact = false}) {
    // Chỉ cho phép gọi khi có số điện thoại của staff
    final hasPhone =
        _booking?.assignedStaffPhone != null &&
        _booking!.assignedStaffPhone!.isNotEmpty;

    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(compact ? 999 : 8),
          child: _booking?.assignedStaffAvatarUrl != null &&
                  _booking!.assignedStaffAvatarUrl!.isNotEmpty
              ? Image.network(
                  _booking!.assignedStaffAvatarUrl!,
                  width: compact ? 40 : 50,
                  height: compact ? 40 : 50,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      _buildFallbackAvatar(size: compact ? 40 : 50),
                )
              : _buildFallbackAvatar(size: compact ? 40 : 50),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _booking?.assignedStaffName != null &&
                      _booking!.assignedStaffName!.isNotEmpty
                  ? Text(
                      _booking!.assignedStaffName!,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.stone900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  : const Text(
                      'Bác sĩ đang được điều phối',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.stone900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
              const SizedBox(height: 2),
              Text(
                staffSpecialtyDisplay(_booking?.assignedStaffSpecialty),
                style: const TextStyle(
                  color: AppColors.stone500,
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        if (hasPhone)
          ElevatedButton.icon(
            onPressed: () =>
                _makePhoneCall(_booking!.assignedStaffPhone!),
            icon: const Icon(Icons.phone, size: 18),
            label: const Text('GỌI'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.successDark,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
      ],
    );
  }

  Widget _buildFallbackAvatar({double size = 50}) {
    return Container(
      width: size,
      height: size,
      color: AppColors.stone200,
      child: const Icon(Icons.person, color: Colors.grey, size: 30),
    );
  }

  /// Bottom sheet có thể vuốt lên/xuống để xem/thu gọn thông tin ETA + bác sĩ.
  Widget _buildDraggableVetSheet() {
    return NotificationListener<DraggableScrollableNotification>(
      onNotification: (notification) {
        setState(() {
          _sheetExtent = notification.extent;
        });
        return false;
      },
      child: DraggableScrollableSheet(
        initialChildSize: _kSheetMinSize,
        minChildSize: _kSheetMinSize,
        maxChildSize: _kSheetMaxSize,
        snap: true,
        snapSizes: const <double>[_kSheetMinSize, _kSheetMaxSize],
        builder: (context, scrollController) {
          final bool isCollapsed = _sheetExtent <= _kSheetMinSize + 0.02;

          return SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: SingleChildScrollView(
                controller: scrollController,
                physics: const ClampingScrollPhysics(),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(height: 8),
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.stone300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 12),
                    AnimatedCrossFade(
                      duration: const Duration(milliseconds: 200),
                      crossFadeState: isCollapsed
                          ? CrossFadeState.showFirst
                          : CrossFadeState.showSecond,
                      firstChild: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.12),
                              blurRadius: 12,
                              offset: const Offset(0, -2),
                            ),
                          ],
                          border: Border.all(
                            color: AppColors.coral.withValues(alpha: 0.2),
                          ),
                        ),
                        child: _buildVetInfoRow(compact: true),
                      ),
                      secondChild: _buildVetInfoCard(),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

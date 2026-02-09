import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import '../../data/models/booking.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/tracking_websocket_service.dart';
import '../../utils/storage_service.dart';

class SosTrackingScreen extends StatefulWidget {
  final BookingResponse? booking;
  final String? bookingId;

  const SosTrackingScreen({super.key, this.booking, this.bookingId})
      : assert(booking != null || bookingId != null,
            'Either booking or bookingId must be provided');

  @override
  State<SosTrackingScreen> createState() => _SosTrackingScreenState();
}

class _SosTrackingScreenState extends State<SosTrackingScreen> {
  final Completer<GoogleMapController> _controller = Completer();
  final BookingService _bookingService = BookingService();
  TrackingLocation? _currentLocation;
  Set<Marker> _markers = {};
  TrackingHandler? _trackingHandler;
  BookingResponse? _booking;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initBooking();
  }

  Future<void> _initBooking() async {
    // Set access token for tracking WebSocket
    final storage = StorageService();
    final token = await storage.getString(AppConstants.accessTokenKey);
    if (token != null) {
      trackingWebsocket.setAccessToken(token);
    }

    if (widget.booking != null) {
      _booking = widget.booking;
      setState(() => _isLoading = false);
      _startTracking();
    } else if (widget.bookingId != null) {
      try {
        final booking = await _bookingService.getBookingById(widget.bookingId!);
        if (mounted) {
          setState(() {
            _booking = booking;
            _isLoading = false;
          });
          _startTracking();
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _error = 'Không thể tải thông tin booking';
            _isLoading = false;
          });
        }
      }
    }
  }

  void _startTracking() {
    if (_booking?.bookingId == null) return;

    _trackingHandler = (location) {
      if (mounted) {
        setState(() {
          _currentLocation = location;
          _updateMarkers(location);
        });
        _moveCamera(location);
      }
    };

    trackingWebsocket.subscribeToTracking(
      _booking!.bookingId!,
      _trackingHandler!,
    );
  }

  void _updateMarkers(TrackingLocation location) {
    _markers = {
      Marker(
        markerId: const MarkerId('vet_location'),
        position: LatLng(location.latitude, location.longitude),
        infoWindow: const InfoWindow(title: 'Bác sĩ đang di chuyển'),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
      ),
    };
  }

  Future<void> _moveCamera(TrackingLocation location) async {
    final GoogleMapController controller = await _controller.future;
    controller.animateCamera(
      CameraUpdate.newLatLng(
        LatLng(location.latitude, location.longitude),
      ),
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
    if (_booking?.bookingId != null && _trackingHandler != null) {
      trackingWebsocket.unsubscribeFromTracking(
        _booking!.bookingId!,
        _trackingHandler!,
      );
    }
    super.dispose();
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

    return Scaffold(
      appBar: AppBar(
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
            myLocationEnabled: true,
          ),
          if (_currentLocation != null)
            Positioned(
              bottom: 20,
              left: 16,
              right: 16,
              child: _buildVetInfoCard(),
            ),
        ],
      ),
    );
  }

  Widget _buildVetInfoCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundImage: _booking?.assignedStaffAvatarUrl != null
                    ? NetworkImage(_booking!.assignedStaffAvatarUrl!)
                    : null,
                child: _booking?.assignedStaffAvatarUrl == null
                    ? const Icon(Icons.person)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _booking?.assignedStaffName ?? 'Bác sĩ Petties',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const Text(
                      'Đang trên đường đến...',
                      style: TextStyle(color: Colors.grey, fontSize: 13),
                    ),
                  ],
                ),
              ),
              if (_currentLocation?.vetPhone != null)
                IconButton(
                  onPressed: () => _makePhoneCall(_currentLocation!.vetPhone!),
                  icon: const Icon(Icons.phone),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.successDark,
                    foregroundColor: Colors.white,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

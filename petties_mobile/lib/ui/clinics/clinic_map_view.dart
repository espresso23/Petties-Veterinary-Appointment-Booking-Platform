import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/clinic.dart';
import '../../providers/clinic_provider.dart';

/// Map View Screen - Display clinics on Google Map
class ClinicMapView extends StatefulWidget {
  const ClinicMapView({super.key});

  @override
  State<ClinicMapView> createState() => _ClinicMapViewState();
}

class _ClinicMapViewState extends State<ClinicMapView> {
  GoogleMapController? _mapController;
  Clinic? _selectedClinic;
  Set<Marker> _markers = {};

  // Custom marker icons
  BitmapDescriptor? _clinicOpenIcon;
  BitmapDescriptor? _clinicClosedIcon;
  BitmapDescriptor? _userLocationIcon;

  // Track clinics hash to detect changes
  int _lastClinicsHash = 0;

  // Default camera position (Ho Chi Minh City)
  // Chỉ trong trường hợp không có currentPosition, nếu có thì sẽ sử dụng currentPosition
  static const double _defaultLat = 10.7769;
  static const double _defaultLng = 106.7009;
  static const double _defaultZoom = 13.0;

  @override
  void initState() {
    super.initState();
    // Create custom marker icons
    _createCustomMarkerIcons();
    // Listen to provider changes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _updateMarkersIfNeeded();
    });
  }

  /// Create custom marker icons for clinics
  Future<void> _createCustomMarkerIcons() async {
    _clinicOpenIcon = await _createMarkerIcon(
      Icons.local_hospital,
      AppColors.success,
      AppColors.white,
    );
    _clinicClosedIcon = await _createMarkerIcon(
      Icons.local_hospital,
      AppColors.error,
      AppColors.white,
    );
    _userLocationIcon = await _createMarkerIcon(
      Icons.person_pin_circle,
      AppColors.primary,
      AppColors.white,
    );
    if (mounted) {
      _buildMarkersSync();
    }
  }

  /// Create a custom marker icon from an IconData
  Future<BitmapDescriptor> _createMarkerIcon(
    IconData iconData,
    Color backgroundColor,
    Color iconColor,
  ) async {
    const double size = 80;
    const double iconSize = 40;

    final pictureRecorder = ui.PictureRecorder();
    final canvas = Canvas(pictureRecorder);

    // Draw background circle
    final bgPaint = Paint()..color = backgroundColor;
    canvas.drawCircle(
      const Offset(size / 2, size / 2),
      size / 2.5,
      bgPaint,
    );

    // Draw border
    final borderPaint = Paint()
      ..color = AppColors.stone900
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawCircle(
      const Offset(size / 2, size / 2),
      size / 2.5,
      borderPaint,
    );

    // Draw icon
    final textPainter = TextPainter(textDirection: TextDirection.ltr);
    textPainter.text = TextSpan(
      text: String.fromCharCode(iconData.codePoint),
      style: TextStyle(
        fontSize: iconSize,
        fontFamily: iconData.fontFamily,
        package: iconData.fontPackage,
        color: iconColor,
      ),
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        (size - textPainter.width) / 2,
        (size - textPainter.height) / 2,
      ),
    );

    final picture = pictureRecorder.endRecording();
    final image = await picture.toImage(size.toInt(), size.toInt());
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);

    return BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Check for clinics changes after dependencies update
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _updateMarkersIfNeeded();
    });
  }

  /// Only rebuild markers when clinics data actually changes
  void _updateMarkersIfNeeded() {
    final provider = context.read<ClinicProvider>();
    final clinics = provider.clinics;
    final newHash = Object.hashAll([
      ...clinics.map((c) => c.clinicId),
      provider.currentPosition?.latitude,
      provider.currentPosition?.longitude,
    ]);

    if (newHash != _lastClinicsHash) {
      _lastClinicsHash = newHash;
      _buildMarkersSync();
    }
  }

  /// Build markers synchronously without calling setState
  void _buildMarkersSync() {
    final provider = context.read<ClinicProvider>();
    final clinics = provider.clinics
        .where((c) => c.latitude != null && c.longitude != null)
        .toList();

    Set<Marker> markers = {};

    // Add clinic markers
    for (final clinic in clinics) {
      markers.add(
        Marker(
          markerId: MarkerId(clinic.clinicId),
          position: LatLng(clinic.latitude!, clinic.longitude!),
          icon: clinic.isOpen
              ? (_clinicOpenIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen))
              : (_clinicClosedIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed)),
          onTap: () => _onMarkerTapped(clinic),
        ),
      );
    }

    // Add user location marker if available
    if (provider.currentPosition != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('user_location'),
          position: LatLng(
            provider.currentPosition!.latitude,
            provider.currentPosition!.longitude,
          ),
          icon: _userLocationIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        ),
      );
    }

    if (mounted) {
      setState(() {
        _markers = markers;
      });
    }
  }

  void _onMarkerTapped(Clinic clinic) {
    setState(() {
      _selectedClinic = clinic;
    });
  }

  LatLng _getInitialPosition() {
    final provider = context.read<ClinicProvider>();

    // Use user's current position if available
    if (provider.currentPosition != null) {
      return LatLng(
        provider.currentPosition!.latitude,
        provider.currentPosition!.longitude,
      );
    }

    // Otherwise, use first clinic's position or default
    final clinics = provider.clinics;
    if (clinics.isNotEmpty) {
      final firstWithLocation = clinics.firstWhere(
        (c) => c.latitude != null && c.longitude != null,
        orElse: () => clinics.first,
      );
      if (firstWithLocation.latitude != null &&
          firstWithLocation.longitude != null) {
        return LatLng(
          firstWithLocation.latitude!,
          firstWithLocation.longitude!,
        );
      }
    }

    return const LatLng(_defaultLat, _defaultLng);
  }

  void _onMapCreated(GoogleMapController controller) {
    _mapController = controller;
    _updateMarkersIfNeeded();
  }

  void _recenterToUser() {
    final provider = context.read<ClinicProvider>();
    if (provider.currentPosition != null && _mapController != null) {
      _mapController!.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(
            provider.currentPosition!.latitude,
            provider.currentPosition!.longitude,
          ),
          _defaultZoom,
        ),
      );
    }
  }

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: Stack(
          children: [
            // Google Map
            _buildGoogleMap(),

            // Top Bar
            _buildTopBar(),

            // Bottom Clinic Card
            if (_selectedClinic != null) _buildClinicCard(),

            // Recenter Button
            _buildRecenterButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildGoogleMap() {
    final initialPosition = _getInitialPosition();

    return Consumer<ClinicProvider>(
      builder: (context, provider, _) {
        // Check for clinics changes and update markers if needed
        // Using addPostFrameCallback to avoid calling during build
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_mapController != null && mounted) {
            _updateMarkersIfNeeded();
          }
        });

        return GoogleMap(
          onMapCreated: _onMapCreated,
          initialCameraPosition: CameraPosition(
            target: initialPosition,
            zoom: _defaultZoom,
          ),
          markers: _markers,
          myLocationEnabled: false, // We use custom user marker
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          minMaxZoomPreference: const MinMaxZoomPreference(5.0, 18.0),
          onTap: (_) {
            setState(() {
              _selectedClinic = null;
            });
          },
        );
      },
    );
  }

  Widget _buildTopBar() {
    return Positioned(
      top: 16,
      left: 16,
      right: 16,
      child: Row(
        children: [
          // Back Button
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                ],
              ),
              child: const Icon(
                Icons.arrow_back,
                color: AppColors.stone900,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Title
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                ],
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.map,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Consumer<ClinicProvider>(
                    builder: (context, provider, _) {
                      final clinicsWithLocation = provider.clinics
                          .where(
                              (c) => c.latitude != null && c.longitude != null)
                          .length;
                      return Text(
                        'BẢN ĐỒ ($clinicsWithLocation)',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone900,
                          letterSpacing: 0.5,
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicCard() {
    final clinic = _selectedClinic!;

    return Positioned(
      bottom: 24,
      left: 16,
      right: 16,
      child: GestureDetector(
        onTap: () {
          context.push('/clinics/${clinic.clinicId}');
        },
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: const [
              BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
            ],
          ),
          child: Row(
            children: [
              // Clinic Image
              Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.stone900, width: 2),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: clinic.primaryImageUrl != null
                      ? Image.network(
                          clinic.primaryImageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              _buildPlaceholderImage(),
                        )
                      : _buildPlaceholderImage(),
                ),
              ),
              const SizedBox(width: 12),

              // Clinic Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      clinic.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on,
                          size: 14,
                          color: AppColors.stone500,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            clinic.shortAddress,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.stone600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        // Rating
                        if (clinic.ratingAvg != null) ...[
                          const Icon(
                            Icons.star,
                            size: 14,
                            color: AppColors.warning,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            clinic.ratingAvg!.toStringAsFixed(1),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.stone700,
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        // Open Status
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: clinic.isOpen
                                ? AppColors.success.withValues(alpha: 0.15)
                                : AppColors.error.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            clinic.isOpen ? 'ĐANG MỞ' : 'ĐÓNG CỬA',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: clinic.isOpen
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                          ),
                        ),
                        // Distance
                        if (clinic.distance != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '${clinic.distance!.toStringAsFixed(1)} km',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.stone500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Arrow Icon
              const Icon(
                Icons.chevron_right,
                color: AppColors.primary,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      color: AppColors.stone100,
      child: const Center(
        child: Icon(
          Icons.local_hospital,
          color: AppColors.stone400,
          size: 24,
        ),
      ),
    );
  }

  Widget _buildRecenterButton() {
    return Positioned(
      bottom: _selectedClinic != null ? 160 : 24,
      right: 16,
      child: GestureDetector(
        onTap: _recenterToUser,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: const [
              BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
            ],
          ),
          child: const Icon(
            Icons.my_location,
            color: AppColors.primary,
            size: 20,
          ),
        ),
      ),
    );
  }
}

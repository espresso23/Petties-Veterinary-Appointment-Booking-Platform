import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/clinic.dart';
import '../../providers/clinic_provider.dart';

/// Clinic Detail View - Neobrutalism Style
class ClinicDetailView extends StatefulWidget {
  final String clinicId;

  const ClinicDetailView({
    super.key,
    required this.clinicId,
  });

  @override
  State<ClinicDetailView> createState() => _ClinicDetailViewState();
}

class _ClinicDetailViewState extends State<ClinicDetailView> {
  GoogleMapController? _mapController;
  final ScrollController _scrollController = ScrollController();
  final PageController _imagePageController = PageController();
  int _currentImageIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // TODO: Fetch clinic detail by ID from provider
    });
  }

  @override
  void dispose() {
    _mapController?.dispose();
    _scrollController.dispose();
    _imagePageController.dispose();
    super.dispose();
  }

  Clinic? _getClinic(ClinicProvider provider) {
    try {
      return provider.clinics.firstWhere((c) => c.clinicId == widget.clinicId);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ClinicProvider>(
      builder: (context, provider, _) {
        final clinic = _getClinic(provider);

        if (clinic == null) {
          return _buildLoadingOrError();
        }

        return Scaffold(
          backgroundColor: AppColors.stone50,
          body: SafeArea(
            child: Column(
              children: [
                // Scrollable content
                Expanded(
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    child: Column(
                      children: [
                        // Header with Image
                        _buildHeader(clinic),

                        // Clinic Info Section
                        _buildClinicInfo(clinic),

                        // Action Buttons (Call & Message)
                        _buildActionButtons(clinic),

                        // Location Section
                        _buildLocationSection(clinic),

                        // Services Section
                        _buildServicesSection(clinic),

                        // Operating Hours Section
                        _buildOperatingHoursSection(clinic),

                        // Meet the Team Section
                        _buildTeamSection(clinic),

                        // Latest Review Section
                        _buildReviewSection(clinic),

                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Book Appointment Button
          bottomNavigationBar: _buildBookButton(clinic),
        );
      },
    );
  }

  Widget _buildLoadingOrError() {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0,
        leading: _buildBackButton(),
      ),
      body: const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );
  }

  Widget _buildBackButton() {
    return GestureDetector(
      onTap: () => Navigator.of(context).pop(),
      child: Container(
        margin: const EdgeInsets.all(8),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
          ],
        ),
        child:
            const Icon(Icons.arrow_back, color: AppColors.stone900, size: 20),
      ),
    );
  }

  Widget _buildHeader(Clinic clinic) {
    // Get all images or use primary image as fallback
    final List<String> allImages = [];
    if (clinic.images != null && clinic.images!.isNotEmpty) {
      allImages.addAll(clinic.images!);
    } else if (clinic.primaryImageUrl != null) {
      allImages.add(clinic.primaryImageUrl!);
    }

    return Stack(
      children: [
        // Image Carousel
        Container(
          height: 220,
          width: double.infinity,
          decoration: const BoxDecoration(
            color: AppColors.stone200,
            border: Border(
              bottom: BorderSide(color: AppColors.stone900, width: 2),
            ),
          ),
          child: allImages.isEmpty
              ? _buildPlaceholderImage()
              : PageView.builder(
                  controller: _imagePageController,
                  itemCount: allImages.length,
                  onPageChanged: (index) {
                    setState(() {
                      _currentImageIndex = index;
                    });
                  },
                  itemBuilder: (context, index) {
                    return Image.network(
                      allImages[index],
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildPlaceholderImage(),
                    );
                  },
                ),
        ),

        // Image indicators (dots)
        if (allImages.length > 1)
          Positioned(
            bottom: 12,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                allImages.length,
                (index) => Container(
                  width: _currentImageIndex == index ? 24 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    color: _currentImageIndex == index
                        ? AppColors.primary
                        : AppColors.white.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: AppColors.stone900, width: 1),
                  ),
                ),
              ),
            ),
          ),

        // Image counter badge
        if (allImages.length > 1)
          Positioned(
            bottom: 12,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.stone900.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${_currentImageIndex + 1}/${allImages.length}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.white,
                ),
              ),
            ),
          ),

        // Top Bar with Back & Share buttons
        Positioned(
          top: 16,
          left: 16,
          right: 16,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Back Button
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.stone900, width: 2),
                    boxShadow: const [
                      BoxShadow(
                          color: AppColors.stone900, offset: Offset(2, 2)),
                    ],
                  ),
                  child: const Icon(Icons.arrow_back,
                      color: AppColors.stone900, size: 20),
                ),
              ),
              // Share Button
              GestureDetector(
                onTap: () {
                  // TODO: Share clinic
                },
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.stone900, width: 2),
                    boxShadow: const [
                      BoxShadow(
                          color: AppColors.stone900, offset: Offset(2, 2)),
                    ],
                  ),
                  child: const Icon(Icons.share_outlined,
                      color: AppColors.stone900, size: 20),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      color: AppColors.stone100,
      child: const Center(
        child: Icon(Icons.local_hospital, color: AppColors.stone400, size: 64),
      ),
    );
  }

  Widget _buildClinicInfo(Clinic clinic) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Clinic Name
          Text(
            clinic.name,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
            ),
          ),
          const SizedBox(height: 12),

          // Rating & Open Status
          Row(
            children: [
              // Rating
              if (clinic.ratingAvg != null) ...[
                const Icon(Icons.star, color: AppColors.warning, size: 18),
                const SizedBox(width: 4),
                Text(
                  clinic.ratingAvg!.toStringAsFixed(1),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
                if (clinic.ratingCount != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    '(${clinic.ratingCount} đánh giá)',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
                const SizedBox(width: 16),
              ],

              // Open Status
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: clinic.isOpen
                      ? AppColors.success.withValues(alpha: 0.15)
                      : AppColors.error.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: clinic.isOpen ? AppColors.success : AppColors.error,
                    width: 1.5,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      clinic.isOpen ? Icons.check_circle : Icons.cancel,
                      size: 14,
                      color:
                          clinic.isOpen ? AppColors.success : AppColors.error,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      clinic.isOpen ? 'Đang mở' : 'Đã đóng',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color:
                            clinic.isOpen ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ],
                ),
              ),

              // Closing time
              if (clinic.isOpen && clinic.closingTimeString != null) ...[
                const Text(
                  ' • ',
                  style: TextStyle(color: AppColors.stone400),
                ),
                Text(
                  'Đóng lúc ${clinic.closingTimeString}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.stone600,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(Clinic clinic) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Call Button
          Expanded(
            child: GestureDetector(
              onTap: () {
                // TODO: Call clinic
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(Icons.phone,
                          color: AppColors.success, size: 16),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Gọi điện',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Message Button
          Expanded(
            child: GestureDetector(
              onTap: () {
                // TODO: Message clinic
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.info.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(Icons.chat_bubble_outline,
                          color: AppColors.info, size: 16),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Nhắn tin',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationSection(Clinic clinic) {
    final hasLocation = clinic.latitude != null && clinic.longitude != null;

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Vị trí',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    // TODO: Open in maps app
                  },
                  child: Row(
                    children: [
                      Text(
                        'Chỉ đường',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.directions,
                          color: AppColors.primary, size: 16),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Address
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.location_on,
                      color: AppColors.info, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        clinic.address,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        clinic.shortAddress,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.stone500,
                        ),
                      ),
                      if (clinic.distance != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          '${clinic.distance!.toStringAsFixed(1)} km',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Mini Map
          if (hasLocation)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              height: 140,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: GoogleMap(
                  onMapCreated: (controller) => _mapController = controller,
                  initialCameraPosition: CameraPosition(
                    target: LatLng(clinic.latitude!, clinic.longitude!),
                    zoom: 15,
                  ),
                  markers: {
                    Marker(
                      markerId: const MarkerId('clinic'),
                      position: LatLng(clinic.latitude!, clinic.longitude!),
                    ),
                  },
                  zoomControlsEnabled: false,
                  scrollGesturesEnabled: false,
                  zoomGesturesEnabled: false,
                  rotateGesturesEnabled: false,
                  tiltGesturesEnabled: false,
                  myLocationButtonEnabled: false,
                  mapToolbarEnabled: false,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildServicesSection(Clinic clinic) {
    // Mock services data
    final services = [
      {'icon': Icons.vaccines, 'name': 'Tiêm phòng'},
      {'icon': Icons.medical_services, 'name': 'Phẫu thuật'},
      {'icon': Icons.cut, 'name': 'Grooming'},
      {'icon': Icons.pets, 'name': 'Nha khoa'},
    ];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Dịch vụ',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    context.push('/clinics/${clinic.clinicId}/services');
                  },
                  child: Text(
                    'Xem tất cả',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Services Grid
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: services.map((service) {
                return Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBackground,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.stone300, width: 1.5),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: AppColors.stone900, width: 1.5),
                          ),
                          child: Icon(
                            service['icon'] as IconData,
                            color: AppColors.primary,
                            size: 22,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          service['name'] as String,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.stone700,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOperatingHoursSection(Clinic clinic) {
    final days = [
      {'day': 'Thứ 2 - Thứ 6', 'hours': '08:00 - 18:00'},
      {'day': 'Thứ 7', 'hours': '09:00 - 14:00'},
      {'day': 'Chủ nhật', 'hours': 'ĐÓNG CỬA', 'isClosed': true},
    ];

    // Use actual operating hours if available
    if (clinic.operatingHours != null && clinic.operatingHours!.isNotEmpty) {
      // TODO: Parse real operating hours
    }

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Giờ hoạt động',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
            const SizedBox(height: 16),
            ...days.map((item) {
              final isClosed = item['isClosed'] == true;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item['day'] as String,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.stone700,
                      ),
                    ),
                    Text(
                      item['hours'] as String,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: isClosed ? AppColors.error : AppColors.stone900,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildTeamSection(Clinic clinic) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Team avatars
            SizedBox(
              width: 100,
              height: 48,
              child: Stack(
                children: [
                  _buildTeamAvatar(0, null),
                  Positioned(left: 28, child: _buildTeamAvatar(1, null)),
                  Positioned(left: 56, child: _buildMoreBadge('+4')),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Đội ngũ chuyên gia',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '7 Bác sĩ thú y',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.stone100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.chevron_right,
                color: AppColors.stone600,
                size: 20,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTeamAvatar(int index, String? imageUrl) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.stone200,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.white, width: 3),
      ),
      child: ClipOval(
        child: imageUrl != null
            ? Image.network(imageUrl, fit: BoxFit.cover)
            : Icon(Icons.person, color: AppColors.stone400, size: 24),
      ),
    );
  }

  Widget _buildMoreBadge(String text) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.white, width: 3),
      ),
      child: Center(
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildReviewSection(Clinic clinic) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Đánh giá gần đây',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    // TODO: View all reviews
                  },
                  child: Text(
                    'Xem tất cả',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Rating stars
            Row(
              children: List.generate(5, (index) {
                return Icon(
                  Icons.star,
                  color: index < 5 ? AppColors.warning : AppColors.stone300,
                  size: 18,
                );
              }),
            ),
            const SizedBox(height: 12),

            // Review content
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.stone50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.stone200, width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '"Phòng khám tuyệt vời! Bác sĩ rất tận tâm và chuyên nghiệp. Thú cưng của tôi được chăm sóc rất tốt. Rất khuyến khích mọi người đến đây!"',
                    style: TextStyle(
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      color: AppColors.stone700,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Text(
                            'N',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Nguyễn Văn A',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.stone900,
                            ),
                          ),
                          Text(
                            '2 ngày trước',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.stone500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBookButton(Clinic clinic) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      child: SafeArea(
        top: false,
        child: GestureDetector(
          onTap: () {
            context.push('/booking/${widget.clinicId}/pet');
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(
                    Icons.calendar_month,
                    color: AppColors.white,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'ĐẶT LỊCH HẸN',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.white,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

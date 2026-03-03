import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong_to_place/latlong_to_place.dart';

import '../../config/constants/app_colors.dart';
import '../../config/env/environment.dart';
import '../../data/models/pet.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/pet_service.dart';
import '../../data/services/sos_matching_service.dart';
import '../../routing/app_routes.dart';
import '../widgets/profile/location_picker.dart';
import 'sos_radar_map_screen.dart';
import '../common/pet_owner_bottom_nav.dart';

/// SOS Request Pre-screen
/// Allows user to select pet and enter symptoms before starting matching
class SosRequestScreen extends StatefulWidget {
  const SosRequestScreen({super.key});

  @override
  State<SosRequestScreen> createState() => _SosRequestScreenState();
}

class _SosRequestScreenState extends State<SosRequestScreen> {
  final PetService _petService = PetService();
  final SosMatchingService _sosService = SosMatchingService.instance;
  final TextEditingController _symptomsController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final GeocodingService _geocodingService = GeocodingService();

  List<Pet> _pets = [];
  Pet? _selectedPet;
  bool _isLoading = true;
  String? _error;
  double? _selectedLat;
  double? _selectedLng;

  @override
  void initState() {
    super.initState();
    _checkActiveAndFetchPets();
    _initLocationAndAddress();
  }

  Future<bool> _ensureLocationPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Dịch vụ định vị đang tắt. Vui lòng bật GPS để tiếp tục.'),
          ),
        );
      }
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Vui lòng cấp quyền truy cập vị trí cho ứng dụng.'),
            ),
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
                'Quyền vị trí đã bị từ chối vĩnh viễn. Vui lòng mở Cài đặt và cấp lại quyền vị trí.'),
          ),
        );
      }
      return false;
    }

    return true;
  }

  Future<void> _initLocationAndAddress() async {
    try {
      final hasPermission = await _ensureLocationPermission();
      if (!hasPermission) return;

      // Add a timeout to prevent infinite hang when GPS is weak/off unexpectedly
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Không thể lấy vị trí hiện tại (Quá thời gian chờ).');
        },
      );

      final place = await _geocodingService.getPlaceInfo(
          position.latitude, position.longitude);
      if (mounted) {
        setState(() {
          _addressController.text = place.formattedAddress;
          _selectedLat = position.latitude;
          _selectedLng = position.longitude;
        });
      }
    } catch (e) {
      debugPrint('Error getting current address: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Lỗi kết nối GPS: ${e.toString().replaceAll("Exception: ", "")}. Vui lòng nhập địa chỉ cấp cứu thủ công bằng phím kính lúp.'),
            duration: const Duration(seconds: 5),
            backgroundColor: Colors.orange.shade800,
          ),
        );
      }
    }
  }

  void _showCancelConfirmation() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded,
                color: Colors.red.shade700, size: 28),
            const SizedBox(width: 8),
            const Expanded(
              child: Text('Hủy yêu cầu SOS?',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        content: const Text('Bạn có chắc muốn hủy yêu cầu cấp cứu này?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('TIẾP TỤC'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('HỦY', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _openLocationPicker() async {
    final result = await showLocationPicker(
      context,
      currentAddress: _addressController.text,
      apiKey: Environment.goongApiKey,
      currentLatitude: _selectedLat,
      currentLongitude: _selectedLng,
    );
    if (result != null && mounted) {
      setState(() {
        _addressController.text = result.formattedAddress;
        _selectedLat = result.latitude;
        _selectedLng = result.longitude;
      });
    }
  }

  Future<void> _resetToGpsLocation() async {
    try {
      final hasPermission = await _ensureLocationPermission();
      if (!hasPermission) return;

      final position = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception(
              'Không thể lấy vị trí GPS (quá thời gian chờ). Vui lòng thử lại hoặc nhập địa chỉ thủ công.');
        },
      );
      final place = await _geocodingService.getPlaceInfo(
          position.latitude, position.longitude);
      if (mounted) {
        setState(() {
          _addressController.text = place.formattedAddress;
          _selectedLat = position.latitude;
          _selectedLng = position.longitude;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã cập nhật về vị trí GPS hiện tại'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Không thể lấy vị trí GPS: ${e.toString().replaceAll("Exception: ", "")}',
            ),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  Future<void> _checkActiveAndFetchPets() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // First check if there's an active SOS booking
      final activeBooking = await _sosService.getActiveSosBooking();
      if (activeBooking != null && mounted) {
        // Route based on booking status
        final status = activeBooking.status.toUpperCase();

        if (status == 'CANCELLED' ||
            status == 'NO_CLINIC' ||
            status == 'COMPLETED') {
          // Allow creating new SOS - don't redirect
          // Continue to load pets
        } else {
          // SOS active statuses: CONFIRMED or IN_PROGRESS
          // If it's passed the matching phase (SEARCHING/PENDING_CLINIC_CONFIRM), it must be tracking/cancellable as a booking
          final isTracking =
              status != 'SEARCHING' && status != 'PENDING_CLINIC_CONFIRM';

          final statusLabel =
              isTracking ? 'đang được theo dõi' : 'đang chờ ghép nối';

          final shouldContinue = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              title: Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      color: Colors.red.shade700, size: 28),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Yêu cầu SOS đang xử lý',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              content: Text(
                'Bạn có yêu cầu SOS cho "${activeBooking.petName ?? 'thú cưng'}" $statusLabel.\n\n'
                'Bạn muốn tiếp tục theo dõi hay hủy để tạo yêu cầu mới?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('HỦY VÀ TẠO MỚI',
                      style: TextStyle(color: Colors.red)),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade700),
                  child: const Text('TIẾP TỤC THEO DÕI'),
                ),
              ],
            ),
          );

          if (shouldContinue == true && mounted) {
            if (isTracking) {
              // Go to tracking screen for CONFIRMED/IN_PROGRESS
              context.go(
                AppRoutes.sosTracking
                    .replaceFirst(':bookingId', activeBooking.bookingId),
              );
            } else {
              // Go to radar map screen for SEARCHING/PENDING_CLINIC_CONFIRM
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (context) => SosRadarMapScreen(
                    bookingId: activeBooking.bookingId,
                    petId: activeBooking.petId ?? '',
                    petName: activeBooking.petName ?? 'Pet',
                    petAvatar: null,
                    symptoms: null,
                    isResumingBooking: true,
                  ),
                ),
              );
            }
            return;
          } else if (shouldContinue == false && mounted) {
            // Hủy booking cũ - use correct API based on status
            bool cancelled;
            if (isTracking) {
              // CONFIRMED/IN_PROGRESS → use regular cancelBooking
              try {
                final bookingService = BookingService();
                await bookingService.cancelBooking(
                    activeBooking.bookingId, 'Hủy SOS bởi người dùng');
                cancelled = true;
              } catch (e) {
                cancelled = false;
              }
            } else {
              // SEARCHING/PENDING_CLINIC_CONFIRM → use cancelMatching
              cancelled =
                  await _sosService.cancelMatching(activeBooking.bookingId);
            }
            if (!cancelled && mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Không thể hủy yêu cầu. Vui lòng thử lại.'),
                  backgroundColor: Colors.red,
                ),
              );
            }
            // Tiếp tục load pets để user chọn mới
          }
          // shouldContinue == null (dialog dismissed) - also load pets
        }
      }

      // No active booking, fetch pets
      final pets = await _petService.getMyPets();
      setState(() {
        _pets = pets;
        if (pets.isNotEmpty) {
          _selectedPet = pets.first;
        }
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách thú cưng. Vui lòng thử lại.';
        _isLoading = false;
      });
    }
  }

  Future<void> _fetchPets() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final pets = await _petService.getMyPets();
      setState(() {
        _pets = pets;
        if (pets.isNotEmpty) {
          _selectedPet = pets.first;
        }
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách thú cưng. Vui lòng thử lại.';
        _isLoading = false;
      });
    }
  }

  final List<String> _quickSymptoms = [
    'Khó thở',
    'Chảy máu nhiều',
    'Co giật',
    'Ngất xỉu / Hôn mê',
    'Nôn mửa / Tiêu chảy cấp',
    'Ăn phải chất độc',
    'Tai nạn / Va chạm',
  ];
  final Set<String> _selectedQuickSymptoms = {};

  void _handleStartSos() {
    if (_selectedPet == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn thú cưng')),
      );
      return;
    }

    // Combine quick symptoms and manual input
    String finalSymptoms = '';
    if (_selectedQuickSymptoms.isNotEmpty) {
      finalSymptoms = _selectedQuickSymptoms.join(', ');
    }

    final manualText = _symptomsController.text.trim();
    if (manualText.isNotEmpty) {
      if (finalSymptoms.isNotEmpty) {
        finalSymptoms += ' - ';
      }
      finalSymptoms += manualText;
    }

    // Navigate to matching screen
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SosRadarMapScreen(
          petId: _selectedPet!.id,
          petName: _selectedPet!.name,
          petAvatar: _selectedPet!.imageUrl,
          symptoms: finalSymptoms.isEmpty ? null : finalSymptoms,
          address: _addressController.text.trim().isEmpty
              ? null
              : _addressController.text.trim(),
          selectedLatitude: _selectedLat,
          selectedLongitude: _selectedLng,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        title: const Text(
          'YÊU CẦU CẤP CỨU',
          style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1),
        ),
        backgroundColor: Colors.red.shade700,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: _showCancelConfirmation,
            child: const Text('HỦY',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15)),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.red))
          : _error != null
              ? _buildErrorView()
              : _buildContent(),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildBottomButton(),
          PetOwnerBottomNav(
            currentIndex: 2,
            onTap: (index) => handlePetOwnerNavTap(context, index),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _fetchPets,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }

  /// Step indicator widget matching Stitch design
  Widget _buildStepIndicator({
    required int currentStep,
    required int totalSteps,
    required String statusText,
  }) {
    return Column(
      children: [
        Row(
          children: [
            Text(
              'BƯỚC $currentStep / $totalSteps',
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            Text(
              statusText,
              style: TextStyle(
                color: Colors.grey.shade800,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        // Progress bar
        Row(
          children: List.generate(totalSteps, (index) {
            final isCompleted = index < currentStep;
            final isCurrent = index == currentStep - 1;
            return Expanded(
              child: Container(
                margin: EdgeInsets.only(right: index < totalSteps - 1 ? 4 : 0),
                height: 3,
                decoration: BoxDecoration(
                  color: isCompleted || isCurrent
                      ? Colors.red.shade700
                      : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step Indicator
          _buildStepIndicator(
              currentStep: 1, totalSteps: 3, statusText: 'NHẬP THÔNG TIN'),
          const SizedBox(height: 20),

          // Warning Banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              border: Border.all(color: Colors.red.shade200, width: 2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    color: Colors.red.shade700, size: 32),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'SOS là dịch vụ cấp cứu khẩn cấp. Vui lòng chỉ sử dụng trong trường hợp nguy kịch.',
                    style: TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── 1. ADDRESS INPUT (moved to top) ──
          const Text(
            'ĐỊA CHỈ CẦN CỨU TRỢ',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _addressController,
                  readOnly: true,
                  onTap: _openLocationPicker,
                  decoration: InputDecoration(
                    hintText: 'Đang lấy địa chỉ hiện tại...',
                    prefixIcon:
                        const Icon(Icons.location_on, color: Colors.red),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.stone900, width: 2),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.stone900, width: 2),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.red, width: 2),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Location Picker Button
              _buildIconAction(
                icon: Icons.search,
                tooltip: 'Tìm địa chỉ',
                onTap: _openLocationPicker,
              ),
              const SizedBox(width: 4),
              // Reset GPS Button
              _buildIconAction(
                icon: Icons.my_location,
                tooltip: 'Vị trí hiện tại',
                onTap: _resetToGpsLocation,
              ),
            ],
          ),

          // ── 2. PET SELECTION ──
          const Text(
            'CHỌN THÚ CƯNG CẦN CẤP CỨU',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          const SizedBox(height: 12),
          _pets.isEmpty ? _buildNoPetsView() : _buildPetList(),
          const SizedBox(height: 32),

          // ── 3. QUICK SYMPTOMS ──
          const Text(
            'TRIỆU CHỨNG PHỔ BIẾN (CHỌN NHANH)',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _quickSymptoms.map((symptom) {
              final isSelected = _selectedQuickSymptoms.contains(symptom);
              return FilterChip(
                label: Text(symptom),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedQuickSymptoms.add(symptom);
                    } else {
                      _selectedQuickSymptoms.remove(symptom);
                    }
                  });
                },
                selectedColor: Colors.red.shade100,
                checkmarkColor: Colors.red,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.red.shade900 : AppColors.stone900,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  fontSize: 13,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: isSelected ? Colors.red : AppColors.stone900,
                    width: 2,
                  ),
                ),
                backgroundColor: Colors.white,
                elevation: isSelected ? 2 : 0,
                pressElevation: 4,
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          // ── 4. MANUAL SYMPTOMS ──
          const Text(
            'CHI TIẾT TÌNH TRẠNG KHÁC',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _symptomsController,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Nhập thêm chi tiết nếu cần...',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide:
                    const BorderSide(color: AppColors.stone900, width: 2),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide:
                    const BorderSide(color: AppColors.stone900, width: 2),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.red, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconAction({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: const [
              BoxShadow(color: AppColors.stone900, offset: Offset(2, 2))
            ],
          ),
          child: Icon(icon, color: Colors.red.shade700, size: 22),
        ),
      ),
    );
  }

  Widget _buildPetList() {
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _pets.length,
        separatorBuilder: (context, index) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final pet = _pets[index];
          final isSelected = _selectedPet?.id == pet.id;
          return GestureDetector(
            onTap: () => setState(() => _selectedPet = pet),
            child: Container(
              width: 100,
              decoration: BoxDecoration(
                color: isSelected ? Colors.red.shade100 : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected ? Colors.red : AppColors.stone900,
                  width: 2,
                ),
                boxShadow: isSelected
                    ? const [BoxShadow(color: Colors.red, offset: Offset(3, 3))]
                    : const [
                        BoxShadow(
                            color: AppColors.stone900, offset: Offset(2, 2))
                      ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(50),
                    child: pet.imageUrl != null
                        ? Image.network(pet.imageUrl!,
                            width: 50, height: 50, fit: BoxFit.cover)
                        : Icon(Icons.pets,
                            size: 40, color: Colors.grey.shade400),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    pet.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildNoPetsView() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: Column(
        children: [
          const Text('Bạn chưa có thú cưng nào.'),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: () => context.push(AppRoutes.addPet),
            child: const Text('Thêm thú cưng'),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButton() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.stone900, width: 2)),
      ),
      child: SafeArea(
        child: ElevatedButton(
          onPressed: _handleStartSos,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red.shade700,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 56),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.stone900, width: 2),
            ),
            elevation: 4,
            shadowColor: AppColors.stone900,
          ),
          child: const Text(
            'BẮT ĐẦU TÌM CẤP CỨU',
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 1),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _symptomsController.dispose();
    _addressController.dispose();
    super.dispose();
  }
}

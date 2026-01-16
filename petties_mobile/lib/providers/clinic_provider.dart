import 'dart:developer';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong_to_place/latlong_to_place.dart';
import '../data/models/clinic.dart';
import '../data/services/clinic_service.dart';

/// Provider for clinic search state management with pagination
class ClinicProvider extends ChangeNotifier {
  final ClinicService _clinicService;
  final GeocodingService _geocodingService;

  // State
  List<Clinic> _clinics = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  String? _error;
  int _currentPage = 0;
  static const int _pageSize = 5;

  // Location state
  Position? _currentPosition;
  String _locationAddress = 'Đang lấy vị trí...';
  bool _isLoadingLocation = false;
  String? _locationError;

  // Filters
  bool _filterNearby = true;
  bool _filterOpenNow = false;
  bool _filterTopRated = false;
  String _searchQuery = '';

  // Advanced Filters
  String? _filterProvince;
  String? _filterDistrict;
  double? _filterMinPrice;
  double? _filterMaxPrice;

  ClinicProvider(
      {ClinicService? clinicService, GeocodingService? geocodingService})
      : _clinicService = clinicService ?? ClinicService(),
        _geocodingService = geocodingService ?? GeocodingService();

  // Getters
  List<Clinic> get clinics => _clinics;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String? get error => _error;
  bool get filterNearby => _filterNearby;
  bool get filterOpenNow => _filterOpenNow;
  bool get filterTopRated => _filterTopRated;
  String get searchQuery => _searchQuery;

  // Advanced Filter getters
  String? get filterProvince => _filterProvince;
  String? get filterDistrict => _filterDistrict;
  double? get filterMinPrice => _filterMinPrice;
  double? get filterMaxPrice => _filterMaxPrice;
  bool get hasAdvancedFilters =>
      _filterProvince != null ||
      _filterDistrict != null ||
      _filterMinPrice != null ||
      _filterMaxPrice != null;

  // Location getters
  Position? get currentPosition => _currentPosition;
  String get locationAddress => _locationAddress;
  bool get isLoadingLocation => _isLoadingLocation;
  String? get locationError => _locationError;
  bool get hasLocation => _currentPosition != null;

  /// Get current location of user
  Future<void> getCurrentLocation() async {
    if (_isLoadingLocation) return;

    _isLoadingLocation = true;
    _locationError = null;
    notifyListeners();

    try {
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _locationError = 'Dịch vụ vị trí đã tắt';
        _locationAddress = 'Vui lòng bật GPS';
        _isLoadingLocation = false;
        notifyListeners();
        return;
      }

      // Check location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _locationError = 'Quyền truy cập vị trí bị từ chối';
          _locationAddress = 'Cần cấp quyền vị trí';
          _isLoadingLocation = false;
          notifyListeners();
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _locationError = 'Quyền vị trí bị từ chối vĩnh viễn';
        _locationAddress = 'Cấp quyền trong Cài đặt';
        _isLoadingLocation = false;
        notifyListeners();
        return;
      }

      // Get current position
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      _currentPosition = position;

      // Get address from coordinates using latlong_to_place
      _locationAddress = await _formatLocationFromPosition(position);
    } catch (e) {
      debugPrint('Error getting location: $e');
      _locationError = 'Không thể lấy vị trí';
      _locationAddress = 'Thử lại sau';
    } finally {
      _isLoadingLocation = false;
      notifyListeners();
    }
  }

  /// Format location display from position using latlong_to_place
  Future<String> _formatLocationFromPosition(Position position) async {
    try {
      final place = await _geocodingService.getPlaceInfo(
        position.latitude,
        position.longitude,
      );

      // Try to format a shorter address using available properties
      final parts = <String>[];
      if (place.locality.isNotEmpty) parts.add(place.locality);
      if (place.city.isNotEmpty) parts.add(place.city);
      if (place.state.isNotEmpty && parts.length < 2) parts.add(place.state);

      if (parts.isNotEmpty) {
        return parts.join(', ');
      }

      // Use full formatted address if available
      if (place.formattedAddress.isNotEmpty) {
        return place.formattedAddress;
      }
    } catch (e) {
      debugPrint('Error getting place from coordinates: $e');
    }

    // Fallback: show coords nicely formatted
    return 'Lat: ${position.latitude.toStringAsFixed(4)}, Long: ${position.longitude.toStringAsFixed(4)}';
  }

  /// Set location manually (from Places API picker)
  void setManualLocation({
    required double latitude,
    required double longitude,
    required String address,
  }) {
    _currentPosition = Position(
      latitude: latitude,
      longitude: longitude,
      timestamp: DateTime.now(),
      accuracy: 0,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
    _locationAddress = address;
    _locationError = null;
    notifyListeners();

    // Refresh clinics with new location
    refreshClinics();
  }

  /// Toggle Nearby filter
  void toggleNearby() {
    _filterNearby = !_filterNearby;
    notifyListeners();
    refreshClinics();
  }

  /// Toggle Open Now filter
  void toggleOpenNow() {
    _filterOpenNow = !_filterOpenNow;
    notifyListeners();
    refreshClinics();
  }

  /// Toggle Top Rated filter
  void toggleTopRated() {
    _filterTopRated = !_filterTopRated;
    notifyListeners();
    refreshClinics();
  }

  /// Update search query
  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
    refreshClinics();
  }

  /// Set advanced filters (province, district, price range)
  void setAdvancedFilters({
    String? province,
    String? district,
    double? minPrice,
    double? maxPrice,
  }) {
    _filterProvince = province;
    _filterDistrict = district;
    _filterMinPrice = minPrice;
    _filterMaxPrice = maxPrice;
    notifyListeners();
    refreshClinics();
  }

  /// Clear all advanced filters
  void clearAdvancedFilters() {
    _filterProvince = null;
    _filterDistrict = null;
    _filterMinPrice = null;
    _filterMaxPrice = null;
    notifyListeners();
    refreshClinics();
  }

  /// Refresh clinics (reset pagination)
  Future<void> refreshClinics() async {
    _currentPage = 0;
    _hasMore = true;
    _clinics = [];
    await fetchClinics();
  }

  /// Fetch clinics with current filters via API
  Future<void> fetchClinics() async {
    if (_isLoading) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _clinicService.searchClinics(
        latitude: _currentPosition?.latitude,
        longitude: _currentPosition?.longitude,
        radiusKm: _filterNearby ? 10.0 : null, // 10km default radius for nearby
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        isOpenNow: _filterOpenNow ? true : null,
        sortByRating: _filterTopRated ? true : null,
        sortByDistance: _filterNearby ? true : null,
        province: _filterProvince,
        district: _filterDistrict,
        minPrice: _filterMinPrice,
        maxPrice: _filterMaxPrice,
        page: _currentPage,
        size: _pageSize,
      );

      _clinics = result;
      _hasMore = false; // No pagination for mock data
      _currentPage = 1;
    } catch (e) {
      _error = 'Không thể tải danh sách phòng khám';
      debugPrint('Error fetching clinics: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Load more clinics (pagination) via API
  Future<void> loadMoreClinics() async {
    if (_isLoadingMore || !_hasMore) return;

    _isLoadingMore = true;
    notifyListeners();

    try {
      final result = await _clinicService.searchClinics(
        latitude: _currentPosition?.latitude,
        longitude: _currentPosition?.longitude,
        radiusKm: _filterNearby ? 10.0 : null,
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        isOpenNow: _filterOpenNow ? true : null,
        sortByRating: _filterTopRated ? true : null,
        sortByDistance: _filterNearby ? true : null,
        province: _filterProvince,
        district: _filterDistrict,
        minPrice: _filterMinPrice,
        maxPrice: _filterMaxPrice,
        page: _currentPage,
        size: _pageSize,
      );

      if (result.isEmpty) {
        _hasMore = false;
      } else {
        _clinics.addAll(result);
        _hasMore = result.length >= _pageSize;
        _currentPage++;
      }
    } catch (e) {
      debugPrint('Error loading more clinics: $e');
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }
}

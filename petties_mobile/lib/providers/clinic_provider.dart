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
  static const int _pageSize = 20;

  // Location state
  Position? _currentPosition;
  String _locationAddress = 'Đang lấy vị trí...';
  bool _isLoadingLocation = false;
  String? _locationError;

  // Filters
  bool _filterNearby = false; // "Gần đây" = filter 10km radius
  bool _filterOpenNow = false;
  bool _filterTopRated = false;
  String _searchQuery = '';

  // Advanced Filters
  String? _filterProvince;
  String? _filterDistrict;
  double? _filterMinPrice;
  double? _filterMaxPrice;
  Set<String> _filterServiceCategories = {};

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
  Set<String> get filterServiceCategories => _filterServiceCategories;
  bool get hasAdvancedFilters =>
      _filterProvince != null ||
      _filterDistrict != null ||
      _filterMinPrice != null ||
      _filterMaxPrice != null ||
      _filterServiceCategories.isNotEmpty;

  // Location getters
  Position? get currentPosition => _currentPosition;
  String get locationAddress => _locationAddress;
  bool get isLoadingLocation => _isLoadingLocation;
  String? get locationError => _locationError;
  bool get hasLocation => _currentPosition != null;

  /// Get cached clinic by ID (returns null if not found)
  Clinic? getCachedClinic(String clinicId) {
    try {
      return _clinics.firstWhere((c) => c.clinicId == clinicId);
    } catch (_) {
      return null;
    }
  }

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
          timeLimit: Duration(seconds: 5), // Reduced from 10s to 5s for better UX
        ),
      );

      _currentPosition = position;

      // Get address from coordinates using latlong_to_place
      _locationAddress = await _formatLocationFromPosition(position);
      
      // ✅ FIX: Auto-fetch clinics after getting location successfully
      // This ensures clinics appear immediately without needing to click any filter
      _isLoadingLocation = false;
      notifyListeners();
      
      // Fetch clinics with the new location
      await fetchClinics();
      return; // Early return since we already handled cleanup
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

      // Log all available fields for debugging
      log('Place info - formattedAddress: ${place.formattedAddress}');
      log('Place info - street: ${place.street}, locality: ${place.locality}');
      log('Place info - city: ${place.city}, state: ${place.state}');

      // Priority: Use formattedAddress if detailed enough
      if (place.formattedAddress.isNotEmpty && 
          place.formattedAddress.split(',').length >= 2) {
        // Shorten very long addresses - take first 2-3 parts
        final parts = place.formattedAddress.split(',');
        if (parts.length > 3) {
          return parts.take(3).join(',').trim();
        }
        return place.formattedAddress;
      }

      // Build address from components - more specific first
      final parts = <String>[];
      
      // Add street if available
      if (place.street.isNotEmpty) parts.add(place.street);
      
      // Add locality (quận/huyện/phường)
      if (place.locality.isNotEmpty) parts.add(place.locality);
      
      // Add city only if we don't have enough detail
      if (parts.isEmpty && place.city.isNotEmpty) {
        parts.add(place.city);
      }

      if (parts.isNotEmpty) {
        return parts.join(', ');
      }
      
      // Last resort: city or state
      if (place.city.isNotEmpty) return place.city;
      if (place.state.isNotEmpty) return place.state;
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
  /// If enabling nearby filter and no location, try to get location first
  Future<void> toggleNearby() async {
    _filterNearby = !_filterNearby;
    notifyListeners();
    
    // If enabling nearby filter and no location, try to get location first
    if (_filterNearby && _currentPosition == null) {
      await getCurrentLocation();
    }
    
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

  /// Set advanced filters (province, district, price range, service categories)
  void setAdvancedFilters({
    String? province,
    String? district,
    double? minPrice,
    double? maxPrice,
    Set<String>? serviceCategories,
  }) {
    _filterProvince = province;
    _filterDistrict = district;
    _filterMinPrice = minPrice;
    _filterMaxPrice = maxPrice;
    _filterServiceCategories = serviceCategories ?? {};
    notifyListeners();
    refreshClinics();
  }

  /// Clear all advanced filters
  void clearAdvancedFilters() {
    _filterProvince = null;
    _filterDistrict = null;
    _filterMinPrice = null;
    _filterMaxPrice = null;
    _filterServiceCategories = {};
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
      // Logic:
      // - Default (no filter): show ALL clinics sorted by distance (near → far)
      // - "GẦN ĐÂY" filter: show only clinics within 10km radius
      // - "ĐÁNH GIÁ CAO": sort by rating instead of distance
      final hasPosition = _currentPosition != null;
      
      // Only apply 10km radius filter when "Gần đây" is selected
      final radiusFilter = (_filterNearby && hasPosition) ? 10.0 : null;
      
      // Sort by distance by default (when have position), unless sorting by rating
      final shouldSortByDistance = hasPosition && !_filterTopRated;
      
      final result = await _clinicService.searchClinics(
        latitude: _currentPosition?.latitude,
        longitude: _currentPosition?.longitude,
        radiusKm: radiusFilter,
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        isOpenNow: _filterOpenNow ? true : null,
        sortByRating: _filterTopRated ? true : null,
        sortByDistance: shouldSortByDistance ? true : null,
        province: _filterProvince,
        district: _filterDistrict,
        minPrice: _filterMinPrice,
        maxPrice: _filterMaxPrice,
        page: _currentPage,
        size: _pageSize,
      );

      debugPrint('=== FETCH CLINICS RESULT ===');
      debugPrint('Received ${result.length} clinics');
      for (var c in result) {
        debugPrint('  - ${c.name} (${c.province})');
      }

      _clinics = result;
      // Enable pagination - check if we got full page (meaning there might be more)
      _hasMore = result.length >= _pageSize;
      _currentPage = 1;
      debugPrint('hasMore: $_hasMore, currentPage: $_currentPage');
    } catch (e, stackTrace) {
      _error = 'Không thể tải danh sách phòng khám';
      debugPrint('Error fetching clinics: $e');
      debugPrint('Stack trace: $stackTrace');
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
      // Same logic as fetchClinics
      final hasPosition = _currentPosition != null;
      final radiusFilter = (_filterNearby && hasPosition) ? 10.0 : null;
      final shouldSortByDistance = hasPosition && !_filterTopRated;
      
      final result = await _clinicService.searchClinics(
        latitude: _currentPosition?.latitude,
        longitude: _currentPosition?.longitude,
        radiusKm: radiusFilter,
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        isOpenNow: _filterOpenNow ? true : null,
        sortByRating: _filterTopRated ? true : null,
        sortByDistance: shouldSortByDistance ? true : null,
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

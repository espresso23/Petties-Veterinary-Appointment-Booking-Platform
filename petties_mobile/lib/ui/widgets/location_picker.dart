import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../config/constants/app_colors.dart';

/// Place prediction from Goong Autocomplete API
class PlacePrediction {
  final String placeId;
  final String description;
  final String mainText;
  final String secondaryText;

  PlacePrediction({
    required this.placeId,
    required this.description,
    required this.mainText,
    required this.secondaryText,
  });

  factory PlacePrediction.fromGoongJson(Map<String, dynamic> json) {
    final structured = json['structured_formatting'] ?? {};
    return PlacePrediction(
      placeId: json['place_id'] ?? '',
      description: json['description'] ?? '',
      mainText: structured['main_text'] ?? json['description'] ?? '',
      secondaryText: structured['secondary_text'] ?? '',
    );
  }
}

/// Place details with coordinates
class PlaceDetails {
  final String placeId;
  final String name;
  final String formattedAddress;
  final double latitude;
  final double longitude;

  PlaceDetails({
    required this.placeId,
    required this.name,
    required this.formattedAddress,
    required this.latitude,
    required this.longitude,
  });

  factory PlaceDetails.fromGoongJson(Map<String, dynamic> json) {
    final geometry = json['geometry'] ?? {};
    final location = geometry['location'] ?? {};
    return PlaceDetails(
      placeId: json['place_id'] ?? '',
      name: json['name'] ?? json['formatted_address'] ?? '',
      formattedAddress: json['formatted_address'] ?? '',
      latitude: (location['lat'] as num?)?.toDouble() ?? 0,
      longitude: (location['lng'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Service for Goong Places API
class GoongPlacesService {
  final String apiKey;
  static const String _baseUrl = 'https://rsapi.goong.io';

  GoongPlacesService({required this.apiKey});

  /// Search for place predictions (autocomplete)
  Future<List<PlacePrediction>> searchPlaces(
    String query, {
    double? latitude,
    double? longitude,
    int limit = 10,
    int radius = 50,
  }) async {
    if (query.isEmpty) return [];

    String url = '$_baseUrl/place/autocomplete'
        '?input=${Uri.encodeComponent(query)}'
        '&api_key=$apiKey'
        '&limit=$limit'
        '&radius=$radius';

    // Add location context if available
    if (latitude != null && longitude != null) {
      url += '&location=$latitude,$longitude';
    }

    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['status'] == 'OK' && data['predictions'] != null) {
          final predictions = data['predictions'] as List;
          return predictions
              .map((p) => PlacePrediction.fromGoongJson(p))
              .toList();
        }
      }
    } catch (e) {
      debugPrint('Goong Places API error: $e');
    }
    return [];
  }

  /// Get place details by place ID
  Future<PlaceDetails?> getPlaceDetails(String placeId) async {
    final url = '$_baseUrl/place/detail'
        '?place_id=$placeId'
        '&api_key=$apiKey';

    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['status'] == 'OK' && data['result'] != null) {
          return PlaceDetails.fromGoongJson(data['result']);
        }
      }
    } catch (e) {
      debugPrint('Goong Place Details API error: $e');
    }
    return null;
  }
}

/// Location picker bottom sheet widget using Goong API
class LocationPickerSheet extends StatefulWidget {
  final String? currentAddress;
  final String apiKey;
  final Function(PlaceDetails) onPlaceSelected;
  final double? currentLatitude;
  final double? currentLongitude;

  const LocationPickerSheet({
    super.key,
    this.currentAddress,
    required this.apiKey,
    required this.onPlaceSelected,
    this.currentLatitude,
    this.currentLongitude,
  });

  @override
  State<LocationPickerSheet> createState() => _LocationPickerSheetState();
}

class _LocationPickerSheetState extends State<LocationPickerSheet> {
  final TextEditingController _controller = TextEditingController();
  late final GoongPlacesService _placesService;
  Timer? _debounceTimer;
  List<PlacePrediction> _predictions = [];
  bool _isLoading = false;
  bool _isLoadingDetails = false;

  @override
  void initState() {
    super.initState();
    _placesService = GoongPlacesService(apiKey: widget.apiKey);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 400), () async {
      if (!mounted) return;

      setState(() => _isLoading = true);

      final results = await _placesService.searchPlaces(
        query,
        latitude: widget.currentLatitude,
        longitude: widget.currentLongitude,
      );

      if (mounted) {
        setState(() {
          _predictions = results;
          _isLoading = false;
        });
      }
    });
  }

  Future<void> _onPlaceSelected(PlacePrediction prediction) async {
    setState(() => _isLoadingDetails = true);

    final details = await _placesService.getPlaceDetails(prediction.placeId);

    if (details != null && mounted) {
      widget.onPlaceSelected(details);
      Navigator.of(context).pop();
    } else {
      setState(() => _isLoadingDetails = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể lấy thông tin địa điểm')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
          left: BorderSide(color: AppColors.stone900, width: 2),
          right: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.stone300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.location_on, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'CHỌN VỊ TRÍ',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                    letterSpacing: 0.5,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.stone300),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 18,
                      color: AppColors.stone600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.stone50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: TextField(
                controller: _controller,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Tìm địa chỉ, quận, phường...',
                  hintStyle: const TextStyle(
                    color: AppColors.stone400,
                    fontSize: 14,
                  ),
                  prefixIcon: const Icon(
                    Icons.search,
                    color: AppColors.stone500,
                  ),
                  suffixIcon: _isLoading
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          ),
                        )
                      : _controller.text.isNotEmpty
                          ? IconButton(
                              onPressed: () {
                                _controller.clear();
                                setState(() => _predictions = []);
                              },
                              icon: const Icon(
                                Icons.close,
                                color: AppColors.stone500,
                                size: 20,
                              ),
                            )
                          : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
                onChanged: _onSearchChanged,
              ),
            ),
          ),

          const SizedBox(height: 8),

          // Loading overlay
          if (_isLoadingDetails)
            Container(
              padding: const EdgeInsets.all(24),
              child: const Column(
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 12),
                  Text('Đang lấy thông tin...'),
                ],
              ),
            )
          else
            // Results
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.4,
              ),
              child: ListView.builder(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _predictions.length,
                itemBuilder: (context, index) {
                  final prediction = _predictions[index];
                  return GestureDetector(
                    onTap: () => _onPlaceSelected(prediction),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: AppColors.stone200,
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.primaryBackground,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Icon(
                              Icons.place,
                              size: 18,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  prediction.mainText,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.stone900,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (prediction.secondaryText.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    prediction.secondaryText,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.stone500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right,
                            color: AppColors.stone400,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// Helper function to show location picker with Goong API
Future<PlaceDetails?> showLocationPicker(
  BuildContext context, {
  String? currentAddress,
  required String apiKey,
  double? currentLatitude,
  double? currentLongitude,
}) async {
  PlaceDetails? result;
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => LocationPickerSheet(
      currentAddress: currentAddress,
      apiKey: apiKey,
      currentLatitude: currentLatitude,
      currentLongitude: currentLongitude,
      onPlaceSelected: (details) {
        result = details;
      },
    ),
  );
  return result;
}

import 'dart:convert';
import 'package:http/http.dart' as http;

/// Model for Province
class Province {
  final int code;
  final String name;
  final String codename;
  final List<District> districts;

  Province({
    required this.code,
    required this.name,
    required this.codename,
    this.districts = const [],
  });

  factory Province.fromJson(Map<String, dynamic> json) {
    return Province(
      code: json['code'] ?? 0,
      name: json['name'] ?? '',
      codename: json['codename'] ?? '',
      districts: json['districts'] != null
          ? (json['districts'] as List)
              .map((d) => District.fromJson(d))
              .toList()
          : [],
    );
  }

  /// Get short name without "Tỉnh" or "Thành phố" prefix
  String get shortName {
    return name.replaceFirst('Tỉnh ', '').replaceFirst('Thành phố ', '');
  }
}

/// Model for District
class District {
  final int code;
  final String name;
  final String codename;

  District({
    required this.code,
    required this.name,
    required this.codename,
  });

  factory District.fromJson(Map<String, dynamic> json) {
    return District(
      code: json['code'] ?? 0,
      name: json['name'] ?? '',
      codename: json['codename'] ?? '',
    );
  }

  /// Get short name without "Quận", "Huyện", "Thị xã", "Thành phố" prefix
  String get shortName {
    return name
        .replaceFirst('Quận ', '')
        .replaceFirst('Huyện ', '')
        .replaceFirst('Thị xã ', '')
        .replaceFirst('Thành phố ', '');
  }
}

/// Service for fetching Vietnam provinces and districts
class LocationService {
  static const String _baseUrl = 'https://provinces.open-api.vn/api';

  // Cache provinces to avoid repeated API calls
  static List<Province>? _cachedProvinces;

  /// Fetch all provinces
  Future<List<Province>> getProvinces() async {
    // Return cached data if available
    if (_cachedProvinces != null) {
      return _cachedProvinces!;
    }

    try {
      final response = await http.get(Uri.parse('$_baseUrl/p/'));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(utf8.decode(response.bodyBytes));
        _cachedProvinces = data.map((json) => Province.fromJson(json)).toList();
        return _cachedProvinces!;
      } else {
        throw Exception('Failed to load provinces: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Search provinces by name (local filter from cached data)
  Future<List<Province>> searchProvinces(String query) async {
    final provinces = await getProvinces();

    if (query.isEmpty) {
      return provinces;
    }

    final lowerQuery = query.toLowerCase();
    return provinces.where((p) {
      return p.name.toLowerCase().contains(lowerQuery) ||
          p.shortName.toLowerCase().contains(lowerQuery);
    }).toList();
  }

  /// Fetch districts for a specific province
  Future<List<District>> getDistricts(int provinceCode) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/p/$provinceCode?depth=2'),
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            json.decode(utf8.decode(response.bodyBytes));
        final province = Province.fromJson(data);
        return province.districts;
      } else {
        throw Exception('Failed to load districts: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }
}

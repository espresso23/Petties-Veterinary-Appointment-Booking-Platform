/// Clinic model matching backend ClinicResponse
class Clinic {
  final String clinicId;
  final ClinicOwnerInfo? owner;
  final String name;
  final String? description;
  final String address;
  final String? ward;
  final String? district;
  final String? province;
  final String? specificLocation;
  final String? phone;
  final String? email;
  final double? latitude;
  final double? longitude;
  final String? logo;
  final Map<String, OperatingHours>? operatingHours;
  final String status;
  final String? rejectionReason;
  final double? ratingAvg;
  final int? ratingCount;
  final DateTime? approvedAt;
  final List<String>? images;
  final List<ClinicImageInfo>? imageDetails;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final double? distance;

  Clinic({
    required this.clinicId,
    this.owner,
    required this.name,
    this.description,
    required this.address,
    this.ward,
    this.district,
    this.province,
    this.specificLocation,
    this.phone,
    this.email,
    this.latitude,
    this.longitude,
    this.logo,
    this.operatingHours,
    required this.status,
    this.rejectionReason,
    this.ratingAvg,
    this.ratingCount,
    this.approvedAt,
    this.images,
    this.imageDetails,
    this.createdAt,
    this.updatedAt,
    this.distance,
  });

  factory Clinic.fromJson(Map<String, dynamic> json) {
    return Clinic(
      clinicId: json['clinicId'] ?? '',
      owner: json['owner'] != null
          ? ClinicOwnerInfo.fromJson(json['owner'])
          : null,
      name: json['name'] ?? '',
      description: json['description'],
      address: json['address'] ?? '',
      ward: json['ward'],
      district: json['district'],
      province: json['province'],
      specificLocation: json['specificLocation'],
      phone: json['phone'],
      email: json['email'],
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      logo: json['logo'],
      operatingHours: json['operatingHours'] != null
          ? (json['operatingHours'] as Map<String, dynamic>).map((key, value) =>
              MapEntry(
                  key,
                  value != null
                      ? OperatingHours.fromJson(value)
                      : OperatingHours(isClosed: true)))
          : null,
      status: json['status'] ?? 'PENDING',
      rejectionReason: json['rejectionReason'],
      ratingAvg: (json['ratingAvg'] as num?)?.toDouble(),
      ratingCount: json['ratingCount'],
      approvedAt: json['approvedAt'] != null
          ? DateTime.parse(json['approvedAt'])
          : null,
      images: json['images'] != null ? List<String>.from(json['images']) : null,
      imageDetails: json['imageDetails'] != null
          ? (json['imageDetails'] as List)
              .where((e) => e != null)
              .map((e) => ClinicImageInfo.fromJson(e))
              .toList()
          : null,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
      distance: (json['distance'] as num?)?.toDouble(),
    );
  }

  /// Get short address (district, province)
  String get shortAddress {
    final parts = <String>[];
    if (district != null && district!.isNotEmpty) parts.add(district!);
    if (province != null && province!.isNotEmpty) parts.add(province!);
    return parts.isNotEmpty ? parts.join(', ') : address;
  }

  /// Get primary image URL
  String? get primaryImageUrl {
    if (imageDetails != null && imageDetails!.isNotEmpty) {
      final primary =
          imageDetails!.where((img) => img.isPrimary == true).firstOrNull;
      if (primary != null) return primary.imageUrl;
      return imageDetails!.first.imageUrl;
    }
    if (images != null && images!.isNotEmpty) {
      return images!.first;
    }
    return logo;
  }

  /// Check if clinic is currently open based on Vietnam timezone (GMT+7)
  bool get isOpen {
    // Get current time in Vietnam timezone (UTC+7)
    final nowUtc = DateTime.now().toUtc();
    final vietnamOffset = const Duration(hours: 7);
    final nowVietnam = nowUtc.add(vietnamOffset);

    final hours = _getOperatingHoursForDay(nowVietnam.weekday);

    if (hours == null || hours.isClosed) return false;
    if (hours.openTime == null || hours.closeTime == null) return false;

    // Parse open and close times
    final openParts = hours.openTime!.split(':');
    final closeParts = hours.closeTime!.split(':');

    if (openParts.length < 2 || closeParts.length < 2) return false;

    final openHour = int.tryParse(openParts[0]) ?? 0;
    final openMinute = int.tryParse(openParts[1]) ?? 0;
    final closeHour = int.tryParse(closeParts[0]) ?? 0;
    final closeMinute = int.tryParse(closeParts[1]) ?? 0;

    final currentMinutes = nowVietnam.hour * 60 + nowVietnam.minute;
    final openMinutes = openHour * 60 + openMinute;
    final closeMinutes = closeHour * 60 + closeMinute;

    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  /// Get closing time string (using Vietnam timezone GMT+7)
  String? get closingTimeString {
    // Get current time in Vietnam timezone (UTC+7)
    final nowUtc = DateTime.now().toUtc();
    final vietnamOffset = const Duration(hours: 7);
    final nowVietnam = nowUtc.add(vietnamOffset);

    final hours = _getOperatingHoursForDay(nowVietnam.weekday);
    if (hours == null || hours.isClosed) return null;
    return hours.closeTime;
  }

  /// Get day name for lookup - tries both uppercase and lowercase keys
  OperatingHours? _getOperatingHoursForDay(int weekday) {
    final dayNameUpper = _getDayName(weekday);
    final dayNameLower = dayNameUpper.toLowerCase();
    
    // Try uppercase first, then lowercase (backend uses lowercase)
    return operatingHours?[dayNameUpper] ?? operatingHours?[dayNameLower];
  }

  String _getDayName(int weekday) {
    switch (weekday) {
      case 1:
        return 'MONDAY';
      case 2:
        return 'TUESDAY';
      case 3:
        return 'WEDNESDAY';
      case 4:
        return 'THURSDAY';
      case 5:
        return 'FRIDAY';
      case 6:
        return 'SATURDAY';
      case 7:
        return 'SUNDAY';
      default:
        return 'MONDAY';
    }
  }
}

class ClinicOwnerInfo {
  final String userId;
  final String? fullName;
  final String? email;

  ClinicOwnerInfo({
    required this.userId,
    this.fullName,
    this.email,
  });

  factory ClinicOwnerInfo.fromJson(Map<String, dynamic> json) {
    return ClinicOwnerInfo(
      userId: json['userId'] ?? '',
      fullName: json['fullName'],
      email: json['email'],
    );
  }
}

class ClinicImageInfo {
  final String imageId;
  final String clinicId;
  final String imageUrl;
  final String? caption;
  final int? displayOrder;
  final bool? isPrimary;

  ClinicImageInfo({
    required this.imageId,
    required this.clinicId,
    required this.imageUrl,
    this.caption,
    this.displayOrder,
    this.isPrimary,
  });

  factory ClinicImageInfo.fromJson(Map<String, dynamic> json) {
    return ClinicImageInfo(
      imageId: json['imageId'] ?? '',
      clinicId: json['clinicId'] ?? '',
      imageUrl: json['imageUrl'] ?? '',
      caption: json['caption'],
      displayOrder: json['displayOrder'],
      isPrimary: json['isPrimary'],
    );
  }
}

class OperatingHours {
  final String? openTime;
  final String? closeTime;
  final bool isClosed;

  OperatingHours({
    this.openTime,
    this.closeTime,
    this.isClosed = false,
  });

  factory OperatingHours.fromJson(Map<String, dynamic> json) {
    return OperatingHours(
      openTime: json['openTime'],
      closeTime: json['closeTime'],
      isClosed: json['isClosed'] ?? false,
    );
  }
}

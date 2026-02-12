/// Clinic Service model for mobile app
/// Matches backend ClinicServiceResponse

class ClinicServiceModel {
  final String serviceId;
  final String clinicId;
  final String? masterServiceId;
  final bool isCustom;
  final String name;
  final String? description;
  final double basePrice;
  final int durationMinutes;
  final int slotsRequired;
  final bool isActive;
  final bool isHomeVisit;
  final double? pricePerKm;
  final String? serviceCategory;
  final String? petType;
  final List<WeightPrice> weightPrices;
  // NEW: Vaccine-specific fields
  final String? vaccineTemplateId;
  final List<VaccineDosePrice> dosePrices;

  ClinicServiceModel({
    required this.serviceId,
    required this.clinicId,
    this.masterServiceId,
    this.isCustom = false,
    required this.name,
    this.description,
    required this.basePrice,
    required this.durationMinutes,
    this.slotsRequired = 1,
    this.isActive = true,
    this.isHomeVisit = false,
    this.pricePerKm,
    this.serviceCategory,
    this.petType,
    this.weightPrices = const [],
    // NEW: Vaccine-specific fields
    this.vaccineTemplateId,
    this.dosePrices = const [],
  });

  factory ClinicServiceModel.fromJson(Map<String, dynamic> json) {
    return ClinicServiceModel(
      serviceId: json['serviceId'] ?? '',
      clinicId: json['clinicId'] ?? '',
      masterServiceId: json['masterServiceId'],
      isCustom: json['isCustom'] ?? false,
      name: json['name'] ?? '',
      description: json['description'],
      basePrice: (json['basePrice'] as num?)?.toDouble() ?? 0,
      durationMinutes: json['durationTime'] ?? 30,
      slotsRequired: json['slotsRequired'] ?? 1,
      isActive: json['isActive'] ?? true,
      isHomeVisit: json['isHomeVisit'] ?? false,
      pricePerKm: (json['pricePerKm'] as num?)?.toDouble(),
      serviceCategory: json['serviceCategory'],
      petType: json['petType'],
      weightPrices: (json['weightPrices'] as List<dynamic>?)
              ?.map((e) => WeightPrice.fromJson(e))
              .toList() ??
          [],
      // NEW: Vaccine-specific fields
      vaccineTemplateId: json['vaccineTemplateId'],
      dosePrices: (json['dosePrices'] as List<dynamic>?)
              ?.map((e) => VaccineDosePrice.fromJson(e))
              .toList() ??
          [],
    );
  }

  /// Format price for display
  String get formattedPrice {
    if (basePrice >= 1000000) {
      return '${(basePrice / 1000000).toStringAsFixed(1)}M đ';
    } else if (basePrice >= 1000) {
      return '${(basePrice / 1000).toStringAsFixed(0)}K đ';
    }
    return '${basePrice.toStringAsFixed(0)} đ';
  }

  /// Format duration for display
  String get formattedDuration {
    if (durationMinutes >= 60) {
      final hours = durationMinutes ~/ 60;
      final mins = durationMinutes % 60;
      if (mins == 0) {
        return '$hours giờ';
      }
      return '$hours giờ $mins phút';
    }
    return '$durationMinutes phút';
  }

  /// Get price for specific pet weight
  /// Logic: basePrice + weight surcharge (if weight falls in a range)
  double getPriceForWeight(double weight) {
    for (final wp in weightPrices) {
      if (weight >= wp.minWeight && weight <= wp.maxWeight) {
        // Add surcharge to base price (matches backend PricingService logic)
        return basePrice + wp.price;
      }
    }
    return basePrice;
  }

  /// Get surcharge info for weight (returns null if no surcharge)
  WeightPrice? getSurchargeForWeight(double weight) {
    for (final wp in weightPrices) {
      if (weight >= wp.minWeight && weight <= wp.maxWeight && wp.price > 0) {
        return wp;
      }
    }
    return null;
  }

  /// Check if has weight surcharge for given weight
  bool hasSurchargeForWeight(double weight) {
    return getSurchargeForWeight(weight) != null;
  }

  /// Check if this is a vaccination service
  bool get isVaccination => serviceCategory == 'VACCINATION';

  /// Get dose price for specific dose number
  VaccineDosePrice? getDosePrice(int doseNumber) {
    try {
      return dosePrices.firstWhere((dp) => dp.doseNumber == doseNumber);
    } catch (_) {
      return null;
    }
  }

  /// Get min dose price
  double get minDosePrice {
    if (dosePrices.isEmpty) return basePrice;
    return dosePrices.map((e) => e.price).reduce((a, b) => a < b ? a : b);
  }

  /// Get max dose price
  double get maxDosePrice {
    if (dosePrices.isEmpty) return basePrice;
    return dosePrices.map((e) => e.price).reduce((a, b) => a > b ? a : b);
  }

  /// Get formatted price range for display
  String get formattedPriceRange {
    if (!isVaccination || dosePrices.isEmpty) {
      return formattedPrice;
    }
    
    final min = minDosePrice;
    final max = maxDosePrice;
    
    if (min == max) {
      return _formatPrice(min);
    }
    
    return '${_formatPrice(min)} - ${_formatPrice(max)}';
  }

  String _formatPrice(double price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1)}M đ';
    } else if (price >= 1000) {
      return '${(price / 1000).toStringAsFixed(0)}K đ';
    }
    return '${price.toStringAsFixed(0)} đ';
  }
}

class WeightPrice {
  final double minWeight;
  final double maxWeight;
  final double price;

  WeightPrice({
    required this.minWeight,
    required this.maxWeight,
    required this.price,
  });

  factory WeightPrice.fromJson(Map<String, dynamic> json) {
    return WeightPrice(
      minWeight: (json['minWeight'] as num?)?.toDouble() ?? 0,
      maxWeight: (json['maxWeight'] as num?)?.toDouble() ?? 0,
      price: (json['price'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Vaccine Dose Price model - matches backend VaccineDosePriceDTO
class VaccineDosePrice {
  final String id;
  final int doseNumber; // 1, 2, 3, 4 (annual)
  final String doseLabel; // "Mũi 1", "Nhắc lại hằng năm"
  final double price;
  final bool isActive;

  VaccineDosePrice({
    required this.id,
    required this.doseNumber,
    required this.doseLabel,
    required this.price,
    this.isActive = true,
  });

  factory VaccineDosePrice.fromJson(Map<String, dynamic> json) {
    return VaccineDosePrice(
      id: json['id'] ?? '',
      doseNumber: json['doseNumber'] ?? 1,
      doseLabel: json['doseLabel'] ?? 'Mũi ${json['doseNumber'] ?? 1}',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      isActive: json['isActive'] ?? true,
    );
  }

  /// Format price for display
  String get formattedPrice {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1)}M đ';
    } else if (price >= 1000) {
      return '${(price / 1000).toStringAsFixed(0)}K đ';
    }
    return '${price.toStringAsFixed(0)} đ';
  }
}

/// Available time slot for booking
class AvailableSlot {
  final String startTime;
  final bool available;
  final bool isBreakTime;
  final String?
      reason; // Reason why slot is unavailable (e.g., "Giờ nghỉ trưa")

  AvailableSlot({
    required this.startTime,
    this.available = true,
    this.isBreakTime = false,
    this.reason,
  });

  factory AvailableSlot.fromJson(Map<String, dynamic> json) {
    return AvailableSlot(
      startTime: json['startTime'] ?? json['time'] ?? '',
      available: json['available'] ?? json['isAvailable'] ?? true,
      isBreakTime: json['isBreakTime'] ?? false,
      reason: json['reason'],
    );
  }

  factory AvailableSlot.fromString(String time) {
    return AvailableSlot(startTime: time, available: true);
  }

  /// Create break time slot
  factory AvailableSlot.breakTime(String time, {String? reason}) {
    return AvailableSlot(
      startTime: time,
      available: false,
      isBreakTime: true,
      reason: reason ?? 'Giờ nghỉ',
    );
  }

  /// Create unavailable slot (booked)
  factory AvailableSlot.booked(String time) {
    return AvailableSlot(
      startTime: time,
      available: false,
      isBreakTime: false,
      reason: 'Đã có lịch hẹn',
    );
  }
}

/// Response for available slots API
class AvailableSlotsResponse {
  final List<String> availableSlots;
  final String? message;

  AvailableSlotsResponse({
    this.availableSlots = const [],
    this.message,
  });

  factory AvailableSlotsResponse.fromJson(Map<String, dynamic> json) {
    return AvailableSlotsResponse(
      availableSlots: (json['availableSlots'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      message: json['message'],
    );
  }
}

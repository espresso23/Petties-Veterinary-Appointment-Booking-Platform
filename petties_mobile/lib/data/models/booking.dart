/// Booking models for mobile app
/// Matches the backend BookingResponse structure

class BookingResponse {
  final String? bookingId;
  final String? bookingCode;
  final String? clinicId;
  final String? clinicName;
  final String? clinicPhone;
  final String? petId;
  final String? petName;
  final String? petPhotoUrl;
  final String? petSpecies;
  final String? petBreed;
  final double? petWeight;
  final String? ownerId;
  final String? ownerName;
  final String? ownerPhone;
  final String? bookingDate;
  final String? bookingTime;
  final String? status;
  final String? type;
  final String? homeAddress;
  final double? totalPrice;
  final String? notes;
  final List<BookingServiceItem> services;
  // Vet info
  final String? assignedVetName;
  final String? assignedVetAvatarUrl;

  BookingResponse({
    this.bookingId,
    this.bookingCode,
    this.clinicId,
    this.clinicName,
    this.clinicPhone,
    this.petId,
    this.petName,
    this.petPhotoUrl,
    this.petSpecies,
    this.petBreed,
    this.petWeight,
    this.ownerId,
    this.ownerName,
    this.ownerPhone,
    this.bookingDate,
    this.bookingTime,
    this.status,
    this.type,
    this.homeAddress,
    this.totalPrice,
    this.notes,
    this.services = const [],
    this.assignedVetName,
    this.assignedVetAvatarUrl,
  });

  factory BookingResponse.fromJson(Map<String, dynamic> json) {
    return BookingResponse(
      bookingId: json['bookingId'],
      bookingCode: json['bookingCode'],
      clinicId: json['clinicId'],
      clinicName: json['clinicName'],
      clinicPhone: json['clinicPhone'],
      petId: json['petId'],
      petName: json['petName'],
      petPhotoUrl: json['petPhotoUrl'],
      petSpecies: json['petSpecies'],
      petBreed: json['petBreed'],
      petWeight: (json['petWeight'] as num?)?.toDouble(),
      ownerId: json['ownerId'],
      ownerName: json['ownerName'],
      ownerPhone: json['ownerPhone'],
      bookingDate: json['bookingDate'],
      bookingTime: json['bookingTime'],
      status: json['status'],
      type: json['type'],
      homeAddress: json['homeAddress'],
      totalPrice: (json['totalPrice'] as num?)?.toDouble(),
      notes: json['notes'],
      services: (json['services'] as List<dynamic>?)
              ?.map((e) => BookingServiceItem.fromJson(e))
              .toList() ??
          [],
      assignedVetName: json['assignedVetName'],
      assignedVetAvatarUrl: json['assignedVetAvatarUrl'],
    );
  }
}

class BookingServiceItem {
  final String? bookingServiceId;
  final String? serviceId;
  final String? serviceName;
  final double? price;
  final String? assignedVetId;
  final String? assignedVetName;
  final String? assignedVetAvatarUrl;
  final String? scheduledStartTime;
  final String? scheduledEndTime;
  final int? durationMinutes;

  BookingServiceItem({
    this.bookingServiceId,
    this.serviceId,
    this.serviceName,
    this.price,
    this.assignedVetId,
    this.assignedVetName,
    this.assignedVetAvatarUrl,
    this.scheduledStartTime,
    this.scheduledEndTime,
    this.durationMinutes,
  });

  factory BookingServiceItem.fromJson(Map<String, dynamic> json) {
    return BookingServiceItem(
      bookingServiceId: json['bookingServiceId'],
      serviceId: json['serviceId'],
      serviceName: json['serviceName'],
      price: (json['price'] as num?)?.toDouble(),
      assignedVetId: json['assignedVetId'],
      assignedVetName: json['assignedVetName'],
      assignedVetAvatarUrl: json['assignedVetAvatarUrl'],
      scheduledStartTime: json['scheduledStartTime'],
      scheduledEndTime: json['scheduledEndTime'],
      durationMinutes: json['durationMinutes'],
    );
  }
}

/// ============================================================
/// VET HOME SUMMARY MODELS
/// Matches backend VetHomeSummaryResponse
/// ============================================================

class VetHomeSummaryResponse {
  final int todayBookingsCount;
  final int pendingCount;
  final int inProgressCount;
  final List<UpcomingBookingDTO> upcomingBookings;

  VetHomeSummaryResponse({
    required this.todayBookingsCount,
    required this.pendingCount,
    required this.inProgressCount,
    required this.upcomingBookings,
  });

  factory VetHomeSummaryResponse.fromJson(Map<String, dynamic> json) {
    return VetHomeSummaryResponse(
      todayBookingsCount: json['todayBookingsCount'] ?? 0,
      pendingCount: json['pendingCount'] ?? 0,
      inProgressCount: json['inProgressCount'] ?? 0,
      upcomingBookings: (json['upcomingBookings'] as List<dynamic>?)
              ?.map((e) => UpcomingBookingDTO.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class UpcomingBookingDTO {
  final String? bookingId;
  final String? bookingCode;
  final String? petName;
  final String? petSpecies;
  final String? petPhotoUrl;
  final String? ownerName;
  final String? ownerPhone;
  final String? bookingDate;
  final String? bookingTime;
  final String? endTime;
  final String? type;
  final String? status;
  final double? totalPrice;
  final String? primaryServiceName;
  final int servicesCount;
  final String? homeAddress;

  UpcomingBookingDTO({
    this.bookingId,
    this.bookingCode,
    this.petName,
    this.petSpecies,
    this.petPhotoUrl,
    this.ownerName,
    this.ownerPhone,
    this.bookingDate,
    this.bookingTime,
    this.endTime,
    this.type,
    this.status,
    this.totalPrice,
    this.primaryServiceName,
    this.servicesCount = 0,
    this.homeAddress,
  });

  factory UpcomingBookingDTO.fromJson(Map<String, dynamic> json) {
    return UpcomingBookingDTO(
      bookingId: json['bookingId'],
      bookingCode: json['bookingCode'],
      petName: json['petName'],
      petSpecies: json['petSpecies'],
      petPhotoUrl: json['petPhotoUrl'],
      ownerName: json['ownerName'],
      ownerPhone: json['ownerPhone'],
      bookingDate: json['bookingDate'],
      bookingTime: json['bookingTime'],
      endTime: json['endTime'],
      type: json['type'],
      status: json['status'],
      totalPrice: (json['totalPrice'] as num?)?.toDouble(),
      primaryServiceName: json['primaryServiceName'],
      servicesCount: json['servicesCount'] ?? 0,
      homeAddress: json['homeAddress'],
    );
  }
}

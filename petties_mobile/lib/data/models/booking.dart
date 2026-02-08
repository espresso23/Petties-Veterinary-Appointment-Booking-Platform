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
  final String? emrId;
  final List<BookingServiceItem> services;
  final List<BookingPet> pets;
  // Staff info
  final String? assignedStaffName;
  final String? assignedStaffAvatarUrl;

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
    this.emrId,
    this.services = const [],
    this.pets = const [],
    this.assignedStaffName,
    this.assignedStaffAvatarUrl,
  });

  factory BookingResponse.fromJson(Map<String, dynamic> json) {
    // Parse pets list
    final petsList = (json['pets'] as List<dynamic>?)
            ?.map((e) => BookingPet.fromJson(e))
            .toList() ??
        [];

    // Flatten services from all pets if services is not directly provided or empty
    // But since the new API provides services inside pets, we should flatten them to maintain compatibility
    // with existing UI that uses `services` field.
    List<BookingServiceItem> allServices = [];
    if (json['services'] != null) {
      allServices = (json['services'] as List<dynamic>)
          .map((e) => BookingServiceItem.fromJson(e))
          .toList();
    } else {
      for (final pet in petsList) {
        allServices.addAll(pet.services);
      }
    }

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
      emrId: json['emrId'],
      services: allServices,
      pets: petsList,
      assignedStaffName: json['assignedStaffName'],
      assignedStaffAvatarUrl: json['assignedStaffAvatarUrl'],
    );
  }
}

class BookingPet {
  final String? petId;
  final String? petName;
  final List<BookingServiceItem> services;

  BookingPet({
    this.petId,
    this.petName,
    this.services = const [],
  });

  factory BookingPet.fromJson(Map<String, dynamic> json) {
    return BookingPet(
      petId: json['petId'],
      petName: json['petName'],
      services: (json['services'] as List<dynamic>?)
              ?.map((e) => BookingServiceItem.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class BookingServiceItem {
  final String? bookingServiceId;
  final String? serviceId;
  final String? serviceName;
  final String? serviceCategory;
  final double? price;
  final double? basePrice;
  final double? weightPrice;
  final int? slotsRequired;
  final String? assignedStaffId;
  final String? assignedStaffName;
  final String? assignedStaffAvatarUrl;
  final String? assignedStaffSpecialty;
  final String? petId;
  final String? petName;
  final String? scheduledStartTime;
  final String? scheduledEndTime;
  final int? durationMinutes;
  final bool? isAddOn;

  BookingServiceItem({
    this.bookingServiceId,
    this.serviceId,
    this.serviceName,
    this.serviceCategory,
    this.price,
    this.basePrice,
    this.weightPrice,
    this.slotsRequired,
    this.assignedStaffId,
    this.assignedStaffName,
    this.assignedStaffAvatarUrl,
    this.assignedStaffSpecialty,
    this.petId,
    this.petName,
    this.scheduledStartTime,
    this.scheduledEndTime,
    this.durationMinutes,
    this.isAddOn,
  });

  factory BookingServiceItem.fromJson(Map<String, dynamic> json) {
    return BookingServiceItem(
      bookingServiceId: json['bookingServiceId'],
      serviceId: json['serviceId'],
      serviceName: json['serviceName'],
      serviceCategory: json['serviceCategory'],
      price: (json['price'] as num?)?.toDouble(),
      basePrice: (json['basePrice'] as num?)?.toDouble(),
      weightPrice: (json['weightPrice'] as num?)?.toDouble(),
      slotsRequired: json['slotsRequired'],
      assignedStaffId: json['assignedStaffId'],
      assignedStaffName: json['assignedStaffName'],
      assignedStaffAvatarUrl: json['assignedStaffAvatarUrl'],
      assignedStaffSpecialty: json['assignedStaffSpecialty'],
      petId: json['petId'],
      petName: json['petName'],
      scheduledStartTime: json['scheduledStartTime'],
      scheduledEndTime: json['scheduledEndTime'],
      durationMinutes: json['durationMinutes'],
      isAddOn: json['isAddOn'],
    );
  }
}

/// ============================================================
/// STAFF HOME SUMMARY MODELS
/// Matches backend StaffHomeSummaryResponse
/// ============================================================

class StaffHomeSummaryResponse {
  final int todayBookingsCount;
  final int pendingCount;
  final int inProgressCount;
  final List<UpcomingBookingDTO> upcomingBookings;

  StaffHomeSummaryResponse({
    required this.todayBookingsCount,
    required this.pendingCount,
    required this.inProgressCount,
    required this.upcomingBookings,
  });

  factory StaffHomeSummaryResponse.fromJson(Map<String, dynamic> json) {
    return StaffHomeSummaryResponse(
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

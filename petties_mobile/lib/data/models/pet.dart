/// Pet species enum matching backend PetSpecies
enum PetSpecies {
  DOG('DOG', 'Chó'),
  CAT('CAT', 'Mèo'),
  BIRD('BIRD', 'Chim'),
  RABBIT('RABBIT', 'Thỏ'),
  HAMSTER('HAMSTER', 'Hamster'),
  FISH('FISH', 'Cá'),
  OTHER('OTHER', 'Khác');

  final String value;
  final String displayName;

  const PetSpecies(this.value, this.displayName);

  /// Get PetSpecies from string value
  static PetSpecies fromString(String? value) {
    if (value == null || value.isEmpty) return PetSpecies.OTHER;
    return PetSpecies.values.firstWhere(
      (e) => e.value.toUpperCase() == value.toUpperCase(),
      orElse: () => PetSpecies.OTHER,
    );
  }

  /// Get icon for species
  String get icon {
    switch (this) {
      case PetSpecies.DOG:
        return '🐕';
      case PetSpecies.CAT:
        return '🐈';
      case PetSpecies.BIRD:
        return '🐦';
      case PetSpecies.RABBIT:
        return '🐇';
      case PetSpecies.HAMSTER:
        return '🐹';
      case PetSpecies.FISH:
        return '🐟';
      case PetSpecies.OTHER:
        return '🐾';
    }
  }
}

class Pet {
  final String id;
  final String name;
  final PetSpecies species;
  final String breed;
  final DateTime dateOfBirth;
  final double weight;
  final String gender;
  final String? color;
  final String? allergies;
  final String? imageUrl;
  final String? ownerName;
  final String? ownerPhone;
  final bool isAssignedToMe;
  final DateTime? nextAppointment;
  final String? bookingStatus;
  final String? bookingId;
  final String? bookingCode;
  final DateTime? lastVisitDate;

  Pet({
    required this.id,
    required this.name,
    required this.species,
    required this.breed,
    required this.dateOfBirth,
    required this.weight,
    required this.gender,
    this.color,
    this.allergies,
    this.imageUrl,
    this.ownerName,
    this.ownerPhone,
    this.isAssignedToMe = false,
    this.nextAppointment,
    this.bookingStatus,
    this.bookingId,
    this.bookingCode,
    this.lastVisitDate,
  });

  factory Pet.fromJson(Map<String, dynamic> json) {
    return Pet(
      id: json['id'] ?? json['petId'] ?? '',
      name: json['name'] ?? json['petName'] ?? '',
      species: PetSpecies.fromString(json['species'] as String?),
      breed: json['breed'] ?? '',
      dateOfBirth: json['dateOfBirth'] != null
        ? DateTime.parse(json['dateOfBirth'])
        : (json['dob'] != null ? DateTime.parse(json['dob']) : DateTime.now()),
      weight: (json['weight'] as num?)?.toDouble() ?? 0.0,
      gender: json['gender'] ?? '',
      color: json['color'],
      allergies: json['allergies'],
      imageUrl: json['imageUrl'],
      ownerName: json['ownerName'],
      ownerPhone: json['ownerPhone'],
      isAssignedToMe: json['isAssignedToMe'] ?? false,
      nextAppointment: json['nextAppointment'] != null ? DateTime.parse(json['nextAppointment']) : null,
      bookingStatus: json['bookingStatus'],
      bookingId: json['bookingId'],
      bookingCode: json['bookingCode'],
      lastVisitDate: json['lastVisitDate'] != null ? DateTime.parse(json['lastVisitDate']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'species': species.value,
      'breed': breed,
      'dateOfBirth': dateOfBirth.toIso8601String().split('T')[0],
      'weight': weight,
      'gender': gender,
      'color': color,
      'allergies': allergies,
      'imageUrl': imageUrl,
      'ownerName': ownerName,
      'ownerPhone': ownerPhone,
      'isAssignedToMe': isAssignedToMe,
      'nextAppointment': nextAppointment?.toIso8601String(),
      'bookingStatus': bookingStatus,
      'bookingId': bookingId,
      'bookingCode': bookingCode,
      'lastVisitDate': lastVisitDate?.toIso8601String(),
    };
  }
}


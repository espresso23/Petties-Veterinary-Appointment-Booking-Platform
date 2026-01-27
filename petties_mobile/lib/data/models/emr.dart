/// EMR Record model - matches backend EmrResponse
class EmrRecord {
  final String id;
  final String petId;
  final String? bookingId;
  final String staffId;
  final String? clinicId;
  final String? clinicName;
  final String? staffName;
  final String? petName;
  final String? petSpecies;
  final String? petBreed;
  final String? ownerName;
  final String? subjective;
  final String? objective;
  final String? assessment;
  final String? plan;
  final String? notes;
  final double? weightKg;
  final double? temperatureC;
  final int? heartRate;
  final int? bcs;
  final List<Prescription> prescriptions;
  final List<EmrImage> images;
  final DateTime examinationDate;
  final DateTime? reExaminationDate;
  final DateTime createdAt;
  final bool isLocked;

  EmrRecord({
    required this.id,
    required this.petId,
    this.bookingId,
    required this.staffId,
    this.clinicId,
    this.clinicName,
    this.staffName,
    this.petName,
    this.petSpecies,
    this.petBreed,
    this.ownerName,
    this.subjective,
    this.objective,
    this.assessment,
    this.plan,
    this.notes,
    this.weightKg,
    this.temperatureC,
    this.heartRate,
    this.bcs,
    this.prescriptions = const [],
    this.images = const [],
    required this.examinationDate,
    this.reExaminationDate,
    required this.createdAt,
    this.isLocked = false,
  });

  factory EmrRecord.fromJson(Map<String, dynamic> json) {
    return EmrRecord(
      id: json['id'] ?? '',
      petId: json['petId'] ?? '',
      bookingId: json['bookingId'],
      staffId: json['staffId'] ?? '',
      clinicId: json['clinicId'],
      clinicName: json['clinicName'],
      staffName: json['staffName'],
      petName: json['petName'],
      petSpecies: json['petSpecies'],
      petBreed: json['petBreed'],
      ownerName: json['ownerName'],
      subjective: json['subjective'],
      objective: json['objective'],
      assessment: json['assessment'],
      plan: json['plan'],
      notes: json['notes'],
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      temperatureC: (json['temperatureC'] as num?)?.toDouble(),
      heartRate: json['heartRate'],
      bcs: json['bcs'],
      prescriptions: (json['prescriptions'] as List<dynamic>?)
              ?.map((e) => Prescription.fromJson(e))
              .toList() ??
          [],
      images: (json['images'] as List<dynamic>?)
              ?.map((e) => EmrImage.fromJson(e))
              .toList() ??
          [],
      examinationDate: json['examinationDate'] != null
          ? DateTime.parse(json['examinationDate'])
          : DateTime.now(),
      reExaminationDate: json['reExaminationDate'] != null
          ? DateTime.parse(json['reExaminationDate'])
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      isLocked: json['isLocked'] ?? false,
    );
  }
}

/// Prescription model
class Prescription {
  final String medicineName;
  final String? dosage;
  final String frequency;
  final int? durationDays;
  final String? instructions;

  Prescription({
    required this.medicineName,
    this.dosage,
    required this.frequency,
    this.durationDays,
    this.instructions,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      medicineName: json['medicineName'] ?? '',
      dosage: json['dosage'],
      frequency: json['frequency'] ?? '',
      durationDays: json['durationDays'],
      instructions: json['instructions'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'medicineName': medicineName,
      'dosage': dosage,
      'frequency': frequency,
      'durationDays': durationDays,
      'instructions': instructions,
    };
  }
}

/// EMR Image model
class EmrImage {
  final String url;
  final String? description;

  EmrImage({
    required this.url,
    this.description,
  });

  factory EmrImage.fromJson(Map<String, dynamic> json) {
    return EmrImage(
      url: json['url'] ?? '',
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'description': description,
    };
  }
}

/// Create EMR Request
class CreateEmrRequest {
  final String petId;
  final String? bookingId;
  final String? subjective;
  final String? objective;
  final String assessment;
  final String plan;
  final String? notes;
  final double? weightKg;
  final double? temperatureC;
  final int? heartRate;
  final int? bcs;
  final List<Prescription>? prescriptions;
  final List<EmrImage>? images;
  final DateTime? reExaminationDate;

  CreateEmrRequest({
    required this.petId,
    this.bookingId,
    this.subjective,
    this.objective,
    required this.assessment,
    required this.plan,
    this.notes,
    this.weightKg,
    this.temperatureC,
    this.heartRate,
    this.bcs,
    this.prescriptions,
    this.images,
    this.reExaminationDate,
  });

  Map<String, dynamic> toJson() {
    return {
      'petId': petId,
      if (bookingId != null) 'bookingId': bookingId,
      if (subjective != null) 'subjective': subjective,
      if (objective != null) 'objective': objective,
      'assessment': assessment,
      'plan': plan,
      if (notes != null) 'notes': notes,
      if (weightKg != null) 'weightKg': weightKg,
      if (temperatureC != null) 'temperatureC': temperatureC,
      if (heartRate != null) 'heartRate': heartRate,
      if (bcs != null) 'bcs': bcs,
      if (prescriptions != null)
        'prescriptions': prescriptions!.map((e) => e.toJson()).toList(),
      if (images != null) 'images': images!.map((e) => e.toJson()).toList(),
      if (reExaminationDate != null)
        'reExaminationDate': reExaminationDate!.toIso8601String(),
    };
  }
}

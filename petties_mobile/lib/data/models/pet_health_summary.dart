class PetHealthSummary {
  final PetInfo? petInfo;
  final LatestEmr? latestEmr;
  final List<HealthWarning> healthWarnings;
  final List<MedicationReminder> medicationReminders;
  final List<SuggestedAction> suggestedActions;
  final String? disclaimer;
  final String? error;

  PetHealthSummary({
    this.petInfo,
    this.latestEmr,
    this.healthWarnings = const [],
    this.medicationReminders = const [],
    this.suggestedActions = const [],
    this.disclaimer,
    this.error,
  });

  factory PetHealthSummary.fromJson(Map<String, dynamic> json) {
    return PetHealthSummary(
      petInfo: json['pet_info'] != null ? PetInfo.fromJson(json['pet_info']) : null,
      latestEmr: json['latest_emr'] != null ? LatestEmr.fromJson(json['latest_emr']) : null,
      healthWarnings: (json['health_warnings'] as List<dynamic>?)
              ?.map((e) => HealthWarning.fromJson(e))
              .toList() ??
          [],
      medicationReminders: (json['medication_reminders'] as List<dynamic>?)
              ?.map((e) => MedicationReminder.fromJson(e))
              .toList() ??
          [],
      suggestedActions: (json['suggested_actions'] as List<dynamic>?)
              ?.map((e) => SuggestedAction.fromJson(e))
              .toList() ??
          [],
      disclaimer: json['disclaimer'],
      error: json['error'],
    );
  }
}

class PetInfo {
  final String petId;
  final String name;
  final String? species;
  final String? breed;
  final int? ageMonths;
  final double? weightKg;

  PetInfo({
    required this.petId,
    required this.name,
    this.species,
    this.breed,
    this.ageMonths,
    this.weightKg,
  });

  factory PetInfo.fromJson(Map<String, dynamic> json) {
    return PetInfo(
      petId: json['pet_id'] ?? '',
      name: json['name'] ?? '',
      species: json['species'],
      breed: json['breed'],
      ageMonths: json['age_months'],
      weightKg: json['weight_kg']?.toDouble(),
    );
  }

  String get ageDisplay {
    if (ageMonths == null) return '';
    if (ageMonths! < 12) return '$ageMonths tháng';
    final years = ageMonths! ~/ 12;
    final months = ageMonths! % 12;
    if (months == 0) return '$years tuổi';
    return '$years tuổi $months tháng';
  }
}

class LatestEmr {
  final DateTime? examDate;
  final String? clinicName;
  final String? diagnosis;
  final String? treatment;
  final String? subjective;
  final String? objective;

  LatestEmr({
    this.examDate,
    this.clinicName,
    this.diagnosis,
    this.treatment,
    this.subjective,
    this.objective,
  });

  factory LatestEmr.fromJson(Map<String, dynamic> json) {
    return LatestEmr(
      examDate: json['exam_date'] != null ? DateTime.tryParse(json['exam_date']) : null,
      clinicName: json['clinic_name'],
      diagnosis: json['diagnosis'],
      treatment: json['treatment'],
      subjective: json['subjective'],
      objective: json['objective'],
    );
  }

  String get examDateDisplay {
    if (examDate == null) return '';
    return '${examDate!.day}/${examDate!.month}/${examDate!.year}';
  }
}

class HealthWarning {
  final String type;
  final String message;
  final String severity;

  HealthWarning({
    required this.type,
    required this.message,
    required this.severity,
  });

  factory HealthWarning.fromJson(Map<String, dynamic> json) {
    return HealthWarning(
      type: json['type'] ?? '',
      message: json['message'] ?? '',
      severity: json['severity'] ?? 'LOW',
    );
  }

  bool get isHighSeverity => severity == 'HIGH';
}

class MedicationReminder {
  final String medication;
  final String? dosage;
  final String? frequency;

  MedicationReminder({
    required this.medication,
    this.dosage,
    this.frequency,
  });

  factory MedicationReminder.fromJson(Map<String, dynamic> json) {
    return MedicationReminder(
      medication: json['medication'] ?? '',
      dosage: json['dosage'],
      frequency: json['frequency'],
    );
  }
}

class SuggestedAction {
  final String type;
  final String label;
  final String reason;

  SuggestedAction({
    required this.type,
    required this.label,
    required this.reason,
  });

  factory SuggestedAction.fromJson(Map<String, dynamic> json) {
    return SuggestedAction(
      type: json['type'] ?? '',
      label: json['label'] ?? '',
      reason: json['reason'] ?? '',
    );
  }
}

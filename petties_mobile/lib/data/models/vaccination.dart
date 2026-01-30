class VaccinationRecord {
  final String id;
  final String petId;
  final String? bookingId;
  final String vetId;
  final String? clinicId;
  final String clinicName;
  final String vetName;
  final String vaccineName;
  final DateTime? vaccinationDate;
  final DateTime? nextDueDate;
  final String? notes;
  final DateTime? createdAt;
  final String status;
  final int? doseNumber;
  final String? doseSequence;
  final int? totalDoses;
  final String? seriesId;
  final String? vaccineTemplateId;
  final String? workflowStatus;

  VaccinationRecord({
    required this.id,
    required this.petId,
    this.bookingId,
    required this.vetId,
    this.clinicId,
    required this.clinicName,
    required this.vetName,
    required this.vaccineName,
    this.vaccinationDate,
    this.nextDueDate,
    this.notes,
    this.createdAt,
    required this.status,
    this.doseNumber,
    this.doseSequence,
    this.totalDoses,
    this.seriesId,
    this.vaccineTemplateId,
    this.workflowStatus,
  });

  factory VaccinationRecord.fromJson(Map<String, dynamic> json) {
    return VaccinationRecord(
      id: json['id'] ?? '',
      petId: json['petId'] ?? '',
      bookingId: json['bookingId'],
      vetId: json['vetId'] ?? '',
      clinicId: json['clinicId'],
      clinicName: json['clinicName'] ?? 'N/A',
      vetName: json['vetName'] ?? 'N/A',
      vaccineName: json['vaccineName'] ?? '',
      vaccinationDate: json['vaccinationDate'] != null ? DateTime.parse(json['vaccinationDate']) : null,
      nextDueDate: json['nextDueDate'] != null ? DateTime.parse(json['nextDueDate']) : null,
      notes: json['notes'],
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      status: json['status'] ?? 'N/A',
      doseNumber: json['doseNumber'],
      doseSequence: json['doseSequence'],
      totalDoses: json['totalDoses'],
      seriesId: json['seriesId'],
      vaccineTemplateId: json['vaccineTemplateId'],
      workflowStatus: json['workflowStatus'],
    );
  }
}

class CreateVaccinationRequest {
  final String petId;
  final String? bookingId;
  final String vaccineName;
  final DateTime vaccinationDate;
  final DateTime? nextDueDate;
  final String? notes;
  final String? vaccineTemplateId;
  final String? doseSequence;
  final String? workflowStatus;

  CreateVaccinationRequest({
    required this.petId,
    this.bookingId,
    required this.vaccineName,
    required this.vaccinationDate,
    this.nextDueDate,
    this.notes,
    this.vaccineTemplateId,
    this.doseSequence,
    this.workflowStatus,
  });

  Map<String, dynamic> toJson() {
    return {
      'petId': petId,
      'bookingId': bookingId,
      'vaccineName': vaccineName,
      'vaccinationDate': vaccinationDate.toIso8601String().split('T')[0],
      'nextDueDate': nextDueDate?.toIso8601String().split('T')[0],
      'notes': notes,
      'vaccineTemplateId': vaccineTemplateId,
      'doseSequence': doseSequence,
      'workflowStatus': workflowStatus,
    };
  }
}

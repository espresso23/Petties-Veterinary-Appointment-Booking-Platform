class VaccinationRecord {
  final String id;
  final String petId;
  final String? bookingId;
  final String staffId;
  final String? clinicId;
  final String clinicName;
  final String staffName;
  final String vaccineName;
  final String? batchNumber;
  final DateTime vaccinationDate;
  final DateTime? nextDueDate;
  final String? notes;
  final DateTime createdAt;
  final String status;

  VaccinationRecord({
    required this.id,
    required this.petId,
    this.bookingId,
    required this.staffId,
    this.clinicId,
    required this.clinicName,
    required this.staffName,
    required this.vaccineName,
    this.batchNumber,
    required this.vaccinationDate,
    this.nextDueDate,
    this.notes,
    required this.createdAt,
    required this.status,
  });

  factory VaccinationRecord.fromJson(Map<String, dynamic> json) {
    return VaccinationRecord(
      id: json['id'] ?? '',
      petId: json['petId'] ?? '',
      bookingId: json['bookingId'],
      staffId: json['staffId'] ?? '',
      clinicId: json['clinicId'],
      clinicName: json['clinicName'] ?? 'N/A',
      staffName: json['staffName'] ?? 'N/A',
      vaccineName: json['vaccineName'] ?? '',
      batchNumber: json['batchNumber'],
      vaccinationDate: DateTime.parse(json['vaccinationDate']),
      nextDueDate: json['nextDueDate'] != null ? DateTime.parse(json['nextDueDate']) : null,
      notes: json['notes'],
      createdAt: DateTime.parse(json['createdAt']),
      status: json['status'] ?? 'N/A',
    );
  }
}

class CreateVaccinationRequest {
  final String petId;
  final String vaccineName;
  final String? batchNumber;
  final DateTime vaccinationDate;
  final DateTime? nextDueDate;
  final String? notes;

  CreateVaccinationRequest({
    required this.petId,
    required this.vaccineName,
    this.batchNumber,
    required this.vaccinationDate,
    this.nextDueDate,
    this.notes,
  });

  Map<String, dynamic> toJson() {
    return {
      'petId': petId,
      'vaccineName': vaccineName,
      'batchNumber': batchNumber,
      'vaccinationDate': vaccinationDate.toIso8601String().split('T')[0],
      'nextDueDate': nextDueDate?.toIso8601String().split('T')[0],
      'notes': notes,
    };
  }
}

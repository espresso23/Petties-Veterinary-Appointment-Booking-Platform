import 'package:petties_mobile/data/models/base_model.dart';

enum SlotStatus {
  AVAILABLE,
  BOOKED,
  BLOCKED,
}

class SlotResponse {
  final String slotId;
  final String startTime; // Using String to represent LocalTime "HH:mm:ss"
  final String endTime;
  final SlotStatus status;
  final String? bookingId;
  final String? petName;
  final String? petOwnerName;
  final String? serviceName;

  SlotResponse({
    required this.slotId,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.bookingId,
    this.petName,
    this.petOwnerName,
    this.serviceName,
  });

  factory SlotResponse.fromJson(Map<String, dynamic> json) {
    return SlotResponse(
      slotId: json['slotId'],
      startTime: json['startTime'],
      endTime: json['endTime'],
      status: _parseStatus(json['status']),
      bookingId: json['bookingId'],
      petName: json['petName'],
      petOwnerName: json['petOwnerName'],
      serviceName: json['serviceName'],
    );
  }

  static SlotStatus _parseStatus(String status) {
    switch (status) {
      case 'AVAILABLE':
        return SlotStatus.AVAILABLE;
      case 'BOOKED':
        return SlotStatus.BOOKED;
      case 'BLOCKED':
        return SlotStatus.BLOCKED;
      default:
        return SlotStatus.AVAILABLE;
    }
  }
}

class VetShiftResponse extends BaseModel {
  final String shiftId;
  final String vetId;
  final String? vetName;
  final String? vetAvatar;
  final String clinicId;
  final String workDate; // "YYYY-MM-DD"
  final String startTime;
  final String endTime;
  final String? breakStart;
  final String? breakEnd;
  final bool isOvernight;
  final bool isContinuation;
  final String? displayDate;
  final String? notes;
  final String? createdAt;
  final int totalSlots;
  final int availableSlots;
  final int bookedSlots;
  final int blockedSlots;
  final List<SlotResponse>? slots;

  VetShiftResponse({
    required this.shiftId,
    required this.vetId,
    this.vetName,
    this.vetAvatar,
    required this.clinicId,
    required this.workDate,
    required this.startTime,
    required this.endTime,
    this.breakStart,
    this.breakEnd,
    this.isOvernight = false,
    this.isContinuation = false,
    this.displayDate,
    this.notes,
    this.createdAt,
    this.totalSlots = 0,
    this.availableSlots = 0,
    this.bookedSlots = 0,
    this.blockedSlots = 0,
    this.slots,
  });

  @override
  factory VetShiftResponse.fromJson(Map<String, dynamic> json) {
    return VetShiftResponse(
      shiftId: json['shiftId'],
      vetId: json['vetId'],
      vetName: json['vetName'],
      vetAvatar: json['vetAvatar'],
      clinicId: json['clinicId'],
      workDate: json['workDate'],
      startTime: json['startTime'],
      endTime: json['endTime'],
      breakStart: json['breakStart'],
      breakEnd: json['breakEnd'],
      isOvernight: json['isOvernight'] ?? false,
      isContinuation: json['isContinuation'] ?? false,
      displayDate: json['displayDate'],
      notes: json['notes'],
      createdAt: json['createdAt'],
      totalSlots: json['totalSlots'] ?? 0,
      availableSlots: json['availableSlots'] ?? 0,
      bookedSlots: json['bookedSlots'] ?? 0,
      blockedSlots: json['blockedSlots'] ?? 0,
      slots: json['slots'] != null
          ? (json['slots'] as List)
              .map((i) => SlotResponse.fromJson(i))
              .toList()
          : null,
    );
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'shiftId': shiftId,
      'vetId': vetId,
      'vetName': vetName,
      'vetAvatar': vetAvatar,
      'clinicId': clinicId,
      'workDate': workDate,
      'startTime': startTime,
      'endTime': endTime,
      'breakStart': breakStart,
      'breakEnd': breakEnd,
      'isOvernight': isOvernight,
      'isContinuation': isContinuation,
      'displayDate': displayDate,
      'notes': notes,
      'createdAt': createdAt,
      'totalSlots': totalSlots,
      'availableSlots': availableSlots,
      'bookedSlots': bookedSlots,
      'blockedSlots': blockedSlots,
    };
  }
}

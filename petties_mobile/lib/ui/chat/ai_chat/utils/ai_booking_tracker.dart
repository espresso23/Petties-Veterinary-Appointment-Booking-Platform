import '../../../../data/models/ai_chat.dart';

class AiBookingTrackerSnapshot {
  final String? petId;
  final String? petName;
  final String? clinicId;
  final String? clinicName;
  final String? bookingDate;
  final String? startTime;
  final List<String> serviceIds;
  final List<String> serviceNames;
  final String? bookingType;

  const AiBookingTrackerSnapshot({
    this.petId,
    this.petName,
    this.clinicId,
    this.clinicName,
    this.bookingDate,
    this.startTime,
    this.serviceIds = const <String>[],
    this.serviceNames = const <String>[],
    this.bookingType,
  });

  static const empty = AiBookingTrackerSnapshot();

  bool get hasData =>
      _hasValue(petName) ||
      _hasValue(clinicName) ||
      _hasValue(bookingDate) ||
      _hasValue(startTime) ||
      serviceNames.isNotEmpty ||
      _hasValue(bookingType);

  AiBookingTrackerSnapshot copyWith({
    String? petId,
    String? petName,
    String? clinicId,
    String? clinicName,
    String? bookingDate,
    String? startTime,
    List<String>? serviceIds,
    List<String>? serviceNames,
    String? bookingType,
  }) {
    return AiBookingTrackerSnapshot(
      petId: petId ?? this.petId,
      petName: petName ?? this.petName,
      clinicId: clinicId ?? this.clinicId,
      clinicName: clinicName ?? this.clinicName,
      bookingDate: bookingDate ?? this.bookingDate,
      startTime: startTime ?? this.startTime,
      serviceIds: serviceIds ?? this.serviceIds,
      serviceNames: serviceNames ?? this.serviceNames,
      bookingType: bookingType ?? this.bookingType,
    );
  }

  AiBookingTrackerSnapshot mergeSummary(AiBookingSummaryPayload summary) {
    return copyWith(
      petId: _pick(summary.petId, petId),
      petName: _pick(summary.petName, petName),
      clinicId: _pick(summary.clinicId, clinicId),
      clinicName: _pick(summary.clinicName, clinicName),
      bookingDate: _pick(summary.bookingDate, bookingDate),
      startTime: _pick(summary.startTime, startTime),
      bookingType: _pick(summary.bookingType, bookingType),
      serviceIds: _mergeList(summary.serviceIds, serviceIds),
      serviceNames: _mergeList(summary.serviceNames, serviceNames),
    );
  }

  AiBookingTrackerSnapshot mergeClinic(AiClinic clinic) {
    return copyWith(
      clinicId: _pick(clinic.id, clinicId),
      clinicName: _pick(clinic.name, clinicName),
    );
  }

  AiBookingTrackerSnapshot mergeServices(
      List<AiBookingServiceOption> services) {
    final ids = services
        .map((service) => service.id.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    final names = services
        .map((service) => service.name.trim())
        .where((value) => value.isNotEmpty)
        .toList();

    return copyWith(
      serviceIds: ids.isNotEmpty ? ids : serviceIds,
      serviceNames: names.isNotEmpty ? names : serviceNames,
    );
  }

  AiBookingTrackerSnapshot mergeSlot(
    AiSlotGridPayload slotGrid,
    AiBookingSlotOption? slot,
  ) {
    return copyWith(
      clinicId: _pick(slotGrid.clinicId, clinicId),
      bookingDate: _pick(slotGrid.bookingDate, bookingDate),
      startTime: _pick(slot?.startTime, startTime),
      serviceIds: _mergeList(slotGrid.serviceIds, serviceIds),
      serviceNames: _mergeList(slotGrid.serviceNames, serviceNames),
    );
  }

  static bool _hasValue(String? value) =>
      value != null && value.trim().isNotEmpty;

  static String? _pick(String? incoming, String? fallback) {
    final trimmed = incoming?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return fallback;
    }
    return trimmed;
  }

  static List<String> _mergeList(List<String> incoming, List<String> fallback) {
    final normalized = incoming
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    return normalized.isNotEmpty ? normalized : fallback;
  }
}

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

  Map<String, dynamic> toJson() => {
        'pet_id': petId,
        'pet_name': petName,
        'clinic_id': clinicId,
        'clinic_name': clinicName,
        'booking_date': bookingDate,
        'start_time': startTime,
        'service_ids': serviceIds,
        'service_names': serviceNames,
        'booking_type': bookingType,
      };

  factory AiBookingTrackerSnapshot.fromJson(Map<String, dynamic> json) {
    return AiBookingTrackerSnapshot(
      petId: json['pet_id']?.toString(),
      petName: json['pet_name']?.toString(),
      clinicId: json['clinic_id']?.toString(),
      clinicName: json['clinic_name']?.toString(),
      bookingDate: json['booking_date']?.toString(),
      startTime: json['start_time']?.toString(),
      serviceIds: _normalizeList(json['service_ids']),
      serviceNames: _normalizeList(json['service_names']),
      bookingType: json['booking_type']?.toString(),
    );
  }

  AiBookingTrackerSnapshot mergeSummary(AiBookingSummaryPayload summary) {
    return mergeSummaryData({
      'pet_id': summary.petId,
      'pet_name': summary.petName,
      'clinic_id': summary.clinicId,
      'clinic_name': summary.clinicName,
      'booking_date': summary.bookingDate,
      'start_time': summary.startTime,
      'service_ids': summary.serviceIds,
      'service_names': summary.serviceNames,
      'booking_type': summary.bookingType,
    });
  }

  AiBookingTrackerSnapshot mergeClinic(AiClinic clinic) {
    return mergeClinicSelection(
      clinicId: clinic.id,
      clinicName: clinic.name,
    );
  }

  AiBookingTrackerSnapshot mergeServices(List<AiBookingServiceOption> services) {
    final ids = services
        .map((service) => service.id.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    final names = services
        .map((service) => service.name.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    return mergeServiceSelection(
      serviceIds: ids,
      serviceNames: names,
    );
  }

  AiBookingTrackerSnapshot mergeSlot(
    AiSlotGridPayload slotGrid,
    AiBookingSlotOption? slot,
  ) {
    return mergeSlotSelection(
      clinicId: slotGrid.clinicId,
      bookingDate: slotGrid.bookingDate,
      startTime: slot?.startTime,
      serviceIds: slotGrid.serviceIds,
      serviceNames: slotGrid.serviceNames,
    );
  }

  AiBookingTrackerSnapshot mergeClinicSelection({
    required String clinicId,
    required String clinicName,
  }) {
    return copyWith(
      clinicId: _pick(clinicId, this.clinicId),
      clinicName: _pick(clinicName, this.clinicName),
    );
  }

  AiBookingTrackerSnapshot mergePetSelection({
    required String petId,
    required String petName,
  }) {
    return copyWith(
      petId: _pick(petId, this.petId),
      petName: _pick(petName, this.petName),
    );
  }

  AiBookingTrackerSnapshot mergeServiceSelection({
    required List<String> serviceIds,
    required List<String> serviceNames,
    String? clinicId,
  }) {
    return copyWith(
      clinicId: _pick(clinicId, this.clinicId),
      serviceIds: _mergeList(serviceIds, this.serviceIds),
      serviceNames: _mergeList(serviceNames, this.serviceNames),
    );
  }

  AiBookingTrackerSnapshot mergeSlotSelection({
    String? clinicId,
    String? bookingDate,
    String? startTime,
    List<String>? serviceIds,
    List<String>? serviceNames,
  }) {
    return copyWith(
      clinicId: _pick(clinicId, this.clinicId),
      bookingDate: _pick(bookingDate, this.bookingDate),
      startTime: _pick(startTime, this.startTime),
      serviceIds: serviceIds == null
          ? this.serviceIds
          : _mergeList(serviceIds, this.serviceIds),
      serviceNames: serviceNames == null
          ? this.serviceNames
          : _mergeList(serviceNames, this.serviceNames),
    );
  }

  AiBookingTrackerSnapshot mergeSummaryData(Map<String, dynamic> data) {
    final summaryServiceNames =
        _normalizeList(data['service_names'] ?? data['services']);
    return copyWith(
      petId: _pick(data['pet_id']?.toString(), petId),
      petName: _pick(data['pet_name']?.toString(), petName),
      clinicId: _pick(data['clinic_id']?.toString(), clinicId),
      clinicName: _pick(data['clinic_name']?.toString(), clinicName),
      bookingDate: _pick(data['booking_date']?.toString(), bookingDate),
      startTime: _pick(data['start_time']?.toString(), startTime),
      bookingType: _pick(data['booking_type']?.toString(), bookingType),
      serviceIds: _mergeList(_normalizeList(data['service_ids']), serviceIds),
      serviceNames: _mergeList(summaryServiceNames, serviceNames),
    );
  }

  AiBookingTrackerSnapshot mergeUiSchema(UiSchemaV1? uiSchema) {
    if (uiSchema == null) {
      return this;
    }

    var next = this;
    for (final component in uiSchema.components) {
      switch (component.type) {
        case 'booking_summary':
          next = next.mergeSummaryData(component.data);
          break;
        case 'slot_button':
          next = next.mergeSlotSelection(
            clinicId: component.data['clinic_id']?.toString(),
            bookingDate: component.data['booking_date']?.toString(),
            serviceIds: _normalizeList(component.data['service_ids']),
            serviceNames: _normalizeList(component.data['service_names']),
          );
          break;
        default:
          break;
      }
    }
    return next;
  }

  AiBookingTrackerSnapshot mergeAction({
    required UiAction action,
    UiComponentV1? component,
    List<String>? selectedServiceIds,
    List<String>? selectedServiceNames,
  }) {
    final payload = action.payload ?? const <String, dynamic>{};
    final itemType = payload['item_type']?.toString();
    final data = component?.data ?? const <String, dynamic>{};

    if (action.type == 'select_services') {
      return mergeServiceSelection(
        clinicId: payload['clinic_id']?.toString(),
        serviceIds: selectedServiceIds ?? _normalizeList(payload['service_ids']),
        serviceNames:
            selectedServiceNames ?? _normalizeList(payload['service_names']),
      );
    }

    if (action.type == 'open_native_confirm') {
      return mergeSummaryData(payload);
    }

    if (action.type == 'select_item' && itemType == 'clinic') {
      return mergeClinicSelection(
        clinicId: payload['item_id']?.toString() ?? '',
        clinicName: data['name']?.toString() ?? '',
      );
    }

    if (action.type == 'select_item' && itemType == 'pet') {
      return mergePetSelection(
        petId: payload['item_id']?.toString() ?? '',
        petName: data['name']?.toString() ?? '',
      );
    }

    if (action.type == 'select_item' && itemType == 'slot') {
      return mergeSlotSelection(
        clinicId: payload['clinic_id']?.toString() ?? data['clinic_id']?.toString(),
        bookingDate:
            payload['booking_date']?.toString() ?? data['booking_date']?.toString(),
        startTime:
            payload['start_time']?.toString() ?? data['start_time']?.toString(),
        serviceIds: _normalizeList(payload['service_ids'] ?? data['service_ids']),
        serviceNames:
            _normalizeList(payload['service_names'] ?? data['service_names']),
      );
    }

    return this;
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

  static List<String> _normalizeList(dynamic raw) {
    return (raw as List<dynamic>? ?? const <dynamic>[])
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
}

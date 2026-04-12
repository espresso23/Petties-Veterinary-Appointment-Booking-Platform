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
  final String? status;
  final String? notes;
  final Map<String, dynamic> metadata;

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
    this.status,
    this.notes,
    this.metadata = const <String, dynamic>{},
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
    String? status,
    String? notes,
    Map<String, dynamic>? metadata,
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
      status: status ?? this.status,
      notes: notes ?? this.notes,
      metadata: metadata ?? this.metadata,
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
        'status': status,
        'notes': notes,
        'metadata': metadata,
      };

  factory AiBookingTrackerSnapshot.fromJson(Map<String, dynamic> json) {
    final draft = json['draft'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(json['draft'] as Map)
        : json['draft'] is Map
            ? Map<String, dynamic>.from(json['draft'] as Map)
            : json;
    final rootMetadata = json['metadata'] is Map
        ? Map<String, dynamic>.from(json['metadata'] as Map)
        : const <String, dynamic>{};
    final trackerMetadata = <String, dynamic>{
      ...rootMetadata,
      if (json['active'] != null) 'active': json['active'],
      if (json['intent'] != null) 'intent': json['intent'],
      if (json['interruption_reason'] != null)
        'interruption_reason': json['interruption_reason'],
      if (json['updated_at'] != null) 'updated_at': json['updated_at'],
    };

    return AiBookingTrackerSnapshot(
      petId: _firstText(draft, const ['pet_id', 'petId']),
      petName: _firstText(draft, const ['pet_name', 'petName']),
      clinicId: _firstText(draft, const ['clinic_id', 'clinicId']),
      clinicName: _firstText(draft, const ['clinic_name', 'clinicName']),
      bookingDate: _normalizeBookingDate(
        _firstText(draft, const ['booking_date', 'bookingDate']),
      ),
      startTime: _normalizeStartTime(
        _firstText(draft, const ['start_time', 'startTime']),
      ),
      serviceIds: _firstList(
        draft,
        const ['service_ids', 'serviceIds'],
      ),
      serviceNames: _firstList(
        draft,
        const ['service_names', 'serviceNames', 'services'],
      ),
      bookingType: _firstText(draft, const ['booking_type', 'bookingType']),
      status: json['status']?.toString(),
      notes: draft['notes']?.toString() ?? json['notes']?.toString(),
      metadata: trackerMetadata,
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
      bookingDate: _pick(_normalizeBookingDate(bookingDate), this.bookingDate),
      startTime: _pick(_normalizeStartTime(startTime), this.startTime),
      serviceIds: serviceIds == null
          ? this.serviceIds
          : _mergeList(serviceIds, this.serviceIds),
      serviceNames: serviceNames == null
          ? this.serviceNames
          : _mergeList(serviceNames, this.serviceNames),
    );
  }

  AiBookingTrackerSnapshot mergeSummaryData(Map<String, dynamic> data) {
    final summaryServiceNames = _firstList(
      data,
      const ['service_names', 'serviceNames', 'services'],
    );
    return copyWith(
      petId: _pick(_firstText(data, const ['pet_id', 'petId']), petId),
      petName: _pick(_firstText(data, const ['pet_name', 'petName']), petName),
      clinicId:
          _pick(_firstText(data, const ['clinic_id', 'clinicId']), clinicId),
      clinicName: _pick(
        _firstText(data, const ['clinic_name', 'clinicName']),
        clinicName,
      ),
      bookingDate: _pick(
          _normalizeBookingDate(
            _firstText(data, const ['booking_date', 'bookingDate']),
          ),
          bookingDate),
      startTime: _pick(
        _normalizeStartTime(
            _firstText(data, const ['start_time', 'startTime'])),
        startTime,
      ),
      bookingType: _pick(
        _firstText(data, const ['booking_type', 'bookingType']),
        bookingType,
      ),
      serviceIds: _mergeList(
        _firstList(data, const ['service_ids', 'serviceIds']),
        serviceIds,
      ),
      serviceNames: _mergeList(summaryServiceNames, serviceNames),
      status: _pick(data['status']?.toString(), status),
      notes: _pick(data['notes']?.toString(), notes),
      metadata: data['metadata'] is Map
          ? Map<String, dynamic>.from(data['metadata'] as Map)
          : metadata,
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
            clinicId:
                _firstText(component.data, const ['clinic_id', 'clinicId']),
            bookingDate: _firstText(
                component.data, const ['booking_date', 'bookingDate']),
            serviceIds: _firstList(
              component.data,
              const ['service_ids', 'serviceIds'],
            ),
            serviceNames: _firstList(
              component.data,
              const ['service_names', 'serviceNames'],
            ),
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
        clinicId: _firstText(payload, const ['clinic_id', 'clinicId']),
        serviceIds: selectedServiceIds ??
            _firstList(payload, const ['service_ids', 'serviceIds']),
        serviceNames: selectedServiceNames ??
            _firstList(payload, const ['service_names', 'serviceNames']),
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
        clinicId: _firstText(
              payload,
              const ['clinic_id', 'clinicId'],
            ) ??
            _firstText(data, const ['clinic_id', 'clinicId']),
        bookingDate: _firstText(
              payload,
              const ['booking_date', 'bookingDate'],
            ) ??
            _firstText(data, const ['booking_date', 'bookingDate']),
        startTime: _firstText(payload, const ['start_time', 'startTime']) ??
            _firstText(data, const ['start_time', 'startTime']),
        serviceIds: _firstList(
          payload,
          const ['service_ids', 'serviceIds'],
        ).isNotEmpty
            ? _firstList(payload, const ['service_ids', 'serviceIds'])
            : _firstList(data, const ['service_ids', 'serviceIds']),
        serviceNames: _firstList(
          payload,
          const ['service_names', 'serviceNames'],
        ).isNotEmpty
            ? _firstList(payload, const ['service_names', 'serviceNames'])
            : _firstList(data, const ['service_names', 'serviceNames']),
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

  static String? _firstText(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      final value = data[key];
      if (value == null) {
        continue;
      }
      final text = value.toString().trim();
      if (text.isNotEmpty) {
        return text;
      }
    }
    return null;
  }

  static List<String> _firstList(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      final value = data[key];
      if (value is List<dynamic>) {
        final normalized = _normalizeList(value);
        if (normalized.isNotEmpty) {
          return normalized;
        }
      }
    }
    return const <String>[];
  }

  static String? _normalizeBookingDate(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }

    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
      return value;
    }

    final slashIso = RegExp(r'^(\d{4})/(\d{2})/(\d{2})$').firstMatch(value);
    if (slashIso != null) {
      return '${slashIso.group(1)}-${slashIso.group(2)}-${slashIso.group(3)}';
    }

    final local = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(value);
    if (local != null) {
      return '${local.group(3)}-${local.group(2)}-${local.group(1)}';
    }

    final lower = value.toLowerCase();
    final now = DateTime.now();
    if (lower == 'hôm nay' || lower == 'hom nay' || lower == 'today') {
      return _toIsoDate(now);
    }
    if (lower == 'ngày mai' ||
        lower == 'ngay mai' ||
        lower == 'mai' ||
        lower == 'tomorrow') {
      return _toIsoDate(now.add(const Duration(days: 1)));
    }

    return value;
  }

  static String? _normalizeStartTime(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }

    final hhmm = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value);
    if (hhmm != null) {
      final hour = int.tryParse(hhmm.group(1) ?? '');
      final minute = int.tryParse(hhmm.group(2) ?? '');
      if (hour != null &&
          minute != null &&
          hour >= 0 &&
          hour <= 23 &&
          minute >= 0 &&
          minute <= 59) {
        return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
      }
    }

    final byHour = RegExp(r'^(\d{1,2})h(?:(\d{2}))?$', caseSensitive: false)
        .firstMatch(value.replaceAll(' ', ''));
    if (byHour != null) {
      final hour = int.tryParse(byHour.group(1) ?? '');
      final minute = int.tryParse(byHour.group(2) ?? '0') ?? 0;
      if (hour != null &&
          hour >= 0 &&
          hour <= 23 &&
          minute >= 0 &&
          minute <= 59) {
        return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
      }
    }

    return value;
  }

  static String _toIsoDate(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }
}

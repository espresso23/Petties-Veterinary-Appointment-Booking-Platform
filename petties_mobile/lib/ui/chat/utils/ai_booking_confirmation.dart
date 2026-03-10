class AiBookingConfirmationDraft {
  final String? petName;
  final String? clinicId;
  final String? clinicName;
  final String? bookingDate;
  final String? startTime;
  final List<String> services;
  final List<String> serviceIds;

  const AiBookingConfirmationDraft({
    this.petName,
    this.clinicId,
    this.clinicName,
    this.bookingDate,
    this.startTime,
    this.services = const [],
    this.serviceIds = const [],
  });

  bool get isReady =>
      bookingDate != null && startTime != null && services.isNotEmpty;
}

AiBookingConfirmationDraft? extractBookingConfirmationDraft({
  required String content,
  List<dynamic>? reactTrace,
}) {
  final normalizedContent = content.toLowerCase();
  final asksForConfirmation = normalizedContent.contains('xác nhận đặt lịch') ||
      normalizedContent.contains('bạn có muốn tôi đặt lịch') ||
      normalizedContent.contains('hãy xác nhận') ||
      normalizedContent.contains('nếu đồng ý') ||
      normalizedContent.contains('nếu bạn xác nhận');

  if (!asksForConfirmation) {
    return null;
  }

  String? clinicId;
  String? clinicName;
  String? bookingDate;
  String? startTime;
  List<String> services = const [];
  List<String> serviceIds = const [];

  final clinicNamesById = <String, String>{};

  for (final step in reactTrace ?? const <dynamic>[]) {
    if (step is! Map) {
      continue;
    }

    final toolName = step['tool_name']?.toString();
    final toolParams = step['tool_params'];
    final toolResult = step['tool_result'];

    if (toolName == 'search_clinics_nearby' && toolResult is Map) {
      final clinics = toolResult['clinics'];
      if (clinics is List) {
        for (final clinic in clinics) {
          if (clinic is Map) {
            final id = clinic['id']?.toString();
            final name = clinic['name']?.toString();
            if (id != null && id.isNotEmpty && name != null && name.isNotEmpty) {
              clinicNamesById[id] = name;
            }
          }
        }
      }
    }

    if (toolName == 'check_available_slots') {
      if (toolParams is Map) {
        clinicId ??= toolParams['clinic_id']?.toString();
        bookingDate ??= toolParams['date']?.toString();
        serviceIds = (toolParams['service_ids'] as List<dynamic>? ?? const [])
            .map((item) => item.toString())
            .toList();
      }

      if (toolResult is Map) {
        services = (toolResult['services'] as List<dynamic>? ?? const [])
            .map((item) => item.toString())
            .toList();
      }
    }
  }

  clinicName ??= clinicId != null ? clinicNamesById[clinicId] : null;

  bookingDate ??= _extractDate(content);
  startTime ??= _extractTime(content);
  clinicName ??= _extractClinicName(content);

  final petName = _extractPetName(content);

  final draft = AiBookingConfirmationDraft(
    petName: petName,
    clinicId: clinicId,
    clinicName: clinicName,
    bookingDate: bookingDate,
    startTime: startTime,
    services: services,
    serviceIds: serviceIds,
  );

  return draft.isReady ? draft : null;
}

String? _extractDate(String content) {
  final iso = RegExp(r'\b\d{4}-\d{2}-\d{2}\b').firstMatch(content)?.group(0);
  if (iso != null) {
    return iso;
  }

  final local = RegExp(r'\b\d{2}/\d{2}/\d{4}\b').firstMatch(content)?.group(0);
  if (local == null) {
    return null;
  }

  final parts = local.split('/');
  return '${parts[2]}-${parts[1]}-${parts[0]}';
}

String? _extractTime(String content) {
  return RegExp(r'\b\d{1,2}:\d{2}\b').firstMatch(content)?.group(0);
}

String? _extractClinicName(String content) {
  final match = RegExp(r'tại\s+([^,\n\.]+)', caseSensitive: false)
      .firstMatch(content)
      ?.group(1)
      ?.trim();
  return (match == null || match.isEmpty) ? null : match;
}

String? _extractPetName(String content) {
  final match = RegExp(r'cho\s+([A-ZÀ-Ỹ][^,\n\.]*)')
      .firstMatch(content)
      ?.group(1)
      ?.trim();
  return (match == null || match.isEmpty) ? null : match;
}

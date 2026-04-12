import '../../../../data/models/ai_chat.dart';

class AiBookingQuickAction {
  final String key;
  final String label;
  final String userMessage;
  final Map<String, dynamic> uiAction;

  const AiBookingQuickAction({
    required this.key,
    required this.label,
    required this.userMessage,
    required this.uiAction,
  });
}

List<AiBookingQuickAction> buildBookingSummaryQuickActions(
  AiBookingSummaryPayload summary,
) {
  final actions = <AiBookingQuickAction>[];
  final missingFields = summary.missingFields
      .map((value) => value.trim().toLowerCase())
      .where((value) => value.isNotEmpty)
      .toSet();
  final clinicId = _clean(summary.clinicId);
  final clinicName = _clean(summary.clinicName);
  final petId = _clean(summary.petId);
  final petName = _clean(summary.petName);
  final bookingDate = _clean(summary.bookingDate);
  final startTime = _clean(summary.startTime);
  final bookingType = _clean(summary.bookingType);
  final serviceIds = summary.serviceIds
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toList();
  final serviceNames = summary.serviceNames
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toList();

  Map<String, dynamic> basePayload() => <String, dynamic>{
        if (petId != null) 'pet_id': petId,
        if (petName != null) 'pet_name': petName,
        if (clinicId != null) 'clinic_id': clinicId,
        if (clinicName != null) 'clinic_name': clinicName,
        if (bookingDate != null) 'booking_date': bookingDate,
        if (startTime != null) 'start_time': startTime,
        if (bookingType != null) 'booking_type': bookingType,
        if (serviceIds.isNotEmpty) 'service_ids': serviceIds,
        if (serviceNames.isNotEmpty) 'service_names': serviceNames,
      };

  if (petId != null || petName != null) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_pet',
        label: 'Đổi thú cưng',
        userMessage: 'Đổi thú cưng',
        uiAction: <String, dynamic>{
          'type': 'change_pet',
          ...basePayload(),
        },
      ),
    );
  }

  if (clinicId != null ||
      clinicName != null ||
      missingFields.contains('clinic_id')) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_clinic',
        label: clinicId == null && clinicName == null
            ? 'Chọn phòng khám'
            : 'Đổi phòng khám',
        userMessage: clinicId == null && clinicName == null
            ? 'Chọn phòng khám'
            : 'Đổi phòng khám',
        uiAction: <String, dynamic>{
          'type': 'change_clinic',
          ...basePayload(),
        },
      ),
    );
  }

  if (serviceIds.isNotEmpty ||
      serviceNames.isNotEmpty ||
      missingFields.contains('service_ids')) {
    final isMissingServices = serviceIds.isEmpty && serviceNames.isEmpty;
    actions.add(
      AiBookingQuickAction(
        key: 'change_service',
        label: isMissingServices ? 'Thêm dịch vụ' : 'Đổi dịch vụ',
        userMessage: isMissingServices ? 'Thêm dịch vụ' : 'Đổi dịch vụ',
        uiAction: <String, dynamic>{
          'type': 'change_service',
          ...basePayload(),
        },
      ),
    );
  }

  if (bookingDate != null || missingFields.contains('booking_date')) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_date',
        label: bookingDate == null ? 'Chọn ngày' : 'Đổi ngày',
        userMessage: bookingDate == null ? 'Chọn ngày khám' : 'Đổi ngày khám',
        uiAction: <String, dynamic>{
          'type': 'change_date',
          ...basePayload(),
        },
      ),
    );
  }

  if (bookingDate != null ||
      startTime != null ||
      missingFields.contains('start_time')) {
    final isMissingTime = startTime == null;
    actions.add(
      AiBookingQuickAction(
        key: 'change_time',
        label: isMissingTime ? 'Chọn giờ' : 'Đổi giờ',
        userMessage: isMissingTime ? 'Chọn giờ khám' : 'Đổi giờ khám',
        uiAction: <String, dynamic>{
          'type': 'change_time',
          ...basePayload(),
        },
      ),
    );
  }

  return actions;
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }
  return trimmed;
}

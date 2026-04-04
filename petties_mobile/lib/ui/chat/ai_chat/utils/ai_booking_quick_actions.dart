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

  if (clinicId != null || clinicName != null) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_clinic',
        label: 'Đổi phòng khám',
        userMessage: 'Đổi phòng khám',
        uiAction: <String, dynamic>{
          'type': 'change_clinic',
          ...basePayload(),
        },
      ),
    );
  }

  if (serviceIds.isNotEmpty || serviceNames.isNotEmpty) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_service',
        label: 'Đổi dịch vụ',
        userMessage: 'Đổi dịch vụ',
        uiAction: <String, dynamic>{
          'type': 'change_service',
          ...basePayload(),
        },
      ),
    );
  }

  if (bookingDate != null) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_date',
        label: 'Đổi ngày',
        userMessage: 'Đổi ngày khám',
        uiAction: <String, dynamic>{
          'type': 'change_date',
          ...basePayload(),
        },
      ),
    );
  }

  if (bookingDate != null || startTime != null) {
    actions.add(
      AiBookingQuickAction(
        key: 'change_time',
        label: 'Đổi giờ',
        userMessage: 'Đổi giờ khám',
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

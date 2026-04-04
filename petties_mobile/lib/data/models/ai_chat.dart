import 'package:flutter/foundation.dart';

class AiChatMessage {
  final String? messageId;
  final String role;
  final String content;
  final DateTime? timestamp;
  final List<dynamic>? reactTrace;
  final Map<String, dynamic>? metadata;
  final UiSchemaV1? uiSchema;

  const AiChatMessage({
    this.messageId,
    required this.role,
    required this.content,
    this.timestamp,
    this.reactTrace,
    this.metadata,
    this.uiSchema,
  });

  factory AiChatMessage.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'] is Map
        ? Map<String, dynamic>.from(json['metadata'] as Map)
        : null;
    final uiSchemaJson = json['ui_schema'] is Map<String, dynamic>
        ? json['ui_schema'] as Map<String, dynamic>
        : (json['ui_schema'] is Map
            ? Map<String, dynamic>.from(json['ui_schema'] as Map)
            : (metadata?['ui_schema'] is Map<String, dynamic>
                ? metadata!['ui_schema'] as Map<String, dynamic>
                : (metadata?['ui_schema'] is Map
                    ? Map<String, dynamic>.from(metadata!['ui_schema'] as Map)
                    : null)));

    return AiChatMessage(
      messageId: json['message_id']?.toString(),
      role: json['role']?.toString() ?? 'assistant',
      content: json['content']?.toString() ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString())
          : null,
      reactTrace: json['react_trace'] as List<dynamic>?,
      metadata: metadata,
      uiSchema: uiSchemaJson != null ? UiSchemaV1.fromJson(uiSchemaJson) : null,
    );
  }
}

class AiClinic {
  final String id;
  final String name;
  final String address;
  final double? distanceKm;
  final double? rating;
  final int? totalReviews;
  final List<AiClinicService> services;
  final bool hasSos;
  final bool supportsHomeVisit;
  final String? operatingHours;
  final String? serviceError;
  final String? imageUrl;
  final String? logoUrl;
  final double? estimatedPriceFrom;
  final String? reasonMatched;

  const AiClinic({
    required this.id,
    required this.name,
    required this.address,
    this.distanceKm,
    this.rating,
    this.totalReviews,
    this.services = const [],
    this.hasSos = false,
    this.supportsHomeVisit = false,
    this.operatingHours,
    this.serviceError,
    this.imageUrl,
    this.logoUrl,
    this.estimatedPriceFrom,
    this.reasonMatched,
  });

  factory AiClinic.fromJson(Map<String, dynamic> json) {
    return AiClinic(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      distanceKm: json['distance_km'] is num
          ? (json['distance_km'] as num).toDouble()
          : null,
      rating: json['rating'] is num ? (json['rating'] as num).toDouble() : null,
      totalReviews: json['total_reviews'] is num
          ? (json['total_reviews'] as num).toInt()
          : null,
      services: (json['services'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AiClinicService.fromJson)
          .toList(),
      hasSos: json['has_sos'] == true,
      supportsHomeVisit: json['supports_home_visit'] == true,
      operatingHours: json['operating_hours']?.toString(),
      serviceError: json['service_error']?.toString(),
      imageUrl: json['image_url']?.toString(),
      logoUrl: json['logo_url']?.toString(),
      estimatedPriceFrom: json['estimated_price_from'] is num
          ? (json['estimated_price_from'] as num).toDouble()
          : null,
      reasonMatched: json['reason_matched']?.toString(),
    );
  }
}

class AiClinicService {
  final String name;
  final String? category;
  final double? basePrice;
  final String? description;
  final bool isVaccination;

  const AiClinicService({
    required this.name,
    this.category,
    this.basePrice,
    this.description,
    this.isVaccination = false,
  });

  factory AiClinicService.fromJson(Map<String, dynamic> json) {
    return AiClinicService(
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString(),
      basePrice: json['base_price'] is num
          ? (json['base_price'] as num).toDouble()
          : null,
      description: json['description']?.toString(),
      isVaccination: json['is_vaccination'] == true,
    );
  }
}

class AiChatSession {
  final String sessionId;
  final String? title;
  final String contextType;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final Map<String, dynamic>? bookingState;
  final List<AiChatMessage> messages;

  const AiChatSession({
    required this.sessionId,
    this.title,
    required this.contextType,
    this.createdAt,
    this.updatedAt,
    this.bookingState,
    this.messages = const [],
  });

  factory AiChatSession.fromJson(Map<String, dynamic> json) {
    return AiChatSession(
      sessionId: json['session_id']?.toString() ?? '',
      title: json['title']?.toString(),
      contextType: json['context_type']?.toString() ?? 'BUSINESS_CHAT',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
      bookingState: json['booking_state'] is Map
          ? Map<String, dynamic>.from(json['booking_state'] as Map)
          : null,
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AiChatMessage.fromJson)
          .toList(),
    );
  }
}

enum AiChatSocketEventType {
  connected,
  history,
  ack,
  thinking,
  thinkingStream,
  toolCall,
  toolResult,
  stream,
  complete,
  error,
  clinicSuggestion,
  info,
  suggestedPrompts,
  petCards,
  quickReplies,
  clinicCarousel,
  serviceChips,
  dateChips,
  slotGrid,
  bookingSummary,
  bookingCreated,
  multiPetBookingCreated,
  uiSchema,
  bookingStateUpdate,
  unknown;

  static AiChatSocketEventType fromString(String? value) {
    switch (value) {
      case 'connected':
        return AiChatSocketEventType.connected;
      case 'history':
        return AiChatSocketEventType.history;
      case 'ack':
        return AiChatSocketEventType.ack;
      case 'thinking':
        return AiChatSocketEventType.thinking;
      case 'thinking_stream':
        return AiChatSocketEventType.thinkingStream;
      case 'tool_call':
        return AiChatSocketEventType.toolCall;
      case 'tool_result':
        return AiChatSocketEventType.toolResult;
      case 'stream':
        return AiChatSocketEventType.stream;
      case 'complete':
        return AiChatSocketEventType.complete;
      case 'error':
        return AiChatSocketEventType.error;
      case 'clinic_suggestion':
        return AiChatSocketEventType.clinicSuggestion;
      case 'info':
        return AiChatSocketEventType.info;
      case 'suggested_prompts':
        return AiChatSocketEventType.suggestedPrompts;
      case 'pet_cards':
        return AiChatSocketEventType.petCards;
      case 'quick_replies':
        return AiChatSocketEventType.quickReplies;
      case 'clinic_carousel':
        return AiChatSocketEventType.clinicCarousel;
      case 'service_chips':
        return AiChatSocketEventType.serviceChips;
      case 'date_chips':
        return AiChatSocketEventType.dateChips;
      case 'slot_grid':
        return AiChatSocketEventType.slotGrid;
      case 'booking_summary':
        return AiChatSocketEventType.bookingSummary;
      case 'booking_created':
        return AiChatSocketEventType.bookingCreated;
      case 'multi_pet_booking_created':
        return AiChatSocketEventType.multiPetBookingCreated;
      case 'ui_schema':
        return AiChatSocketEventType.uiSchema;
      case 'booking_state_update':
        return AiChatSocketEventType.bookingStateUpdate;
      default:
        return AiChatSocketEventType.unknown;
    }
  }
}

class AiClinicSuggestion {
  final List<AiClinic> clinics;
  final int totalFound;
  final double? latitude;
  final double? longitude;

  const AiClinicSuggestion({
    required this.clinics,
    required this.totalFound,
    this.latitude,
    this.longitude,
  });

  factory AiClinicSuggestion.fromJson(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>?;
    return AiClinicSuggestion(
      clinics: (json['clinics'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AiClinic.fromJson)
          .toList(),
      totalFound:
          json['total_found'] is num ? (json['total_found'] as num).toInt() : 0,
      latitude:
          location?['lat'] is num ? (location!['lat'] as num).toDouble() : null,
      longitude:
          location?['lng'] is num ? (location!['lng'] as num).toDouble() : null,
    );
  }
}

class AiBookingServiceOption {
  final String id;
  final String name;
  final String? category;
  final double? basePrice;

  const AiBookingServiceOption({
    required this.id,
    required this.name,
    this.category,
    this.basePrice,
  });

  factory AiBookingServiceOption.fromJson(Map<String, dynamic> json) {
    return AiBookingServiceOption(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString(),
      basePrice: json['base_price'] is num
          ? (json['base_price'] as num).toDouble()
          : null,
    );
  }
}

class AiBookingSlotOption {
  final String startTime;
  final String? endTime;
  final int? durationMinutes;
  final int? staffAvailable;

  const AiBookingSlotOption({
    required this.startTime,
    this.endTime,
    this.durationMinutes,
    this.staffAvailable,
  });

  factory AiBookingSlotOption.fromJson(Map<String, dynamic> json) {
    return AiBookingSlotOption(
      startTime: json['start_time']?.toString() ?? '',
      endTime: json['end_time']?.toString(),
      durationMinutes: json['duration_minutes'] is num
          ? (json['duration_minutes'] as num).toInt()
          : null,
      staffAvailable: json['staff_available'] is num
          ? (json['staff_available'] as num).toInt()
          : null,
    );
  }
}

class AiSlotGridPayload {
  final String? clinicId;
  final String? bookingDate;
  final List<String> serviceIds;
  final List<String> serviceNames;
  final List<AiBookingSlotOption> recommendedSlots;
  final List<AiBookingSlotOption> alternativeSlots;
  final int totalSlots;
  final String? message;

  const AiSlotGridPayload({
    this.clinicId,
    this.bookingDate,
    this.serviceIds = const [],
    this.serviceNames = const [],
    this.recommendedSlots = const [],
    this.alternativeSlots = const [],
    this.totalSlots = 0,
    this.message,
  });

  factory AiSlotGridPayload.fromJson(Map<String, dynamic> json) {
    return AiSlotGridPayload(
      clinicId: json['clinic_id']?.toString(),
      bookingDate: json['booking_date']?.toString(),
      serviceIds: (json['service_ids'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      serviceNames: (json['service_names'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      recommendedSlots:
          (json['recommended_slots'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(AiBookingSlotOption.fromJson)
              .toList(),
      alternativeSlots:
          (json['alternative_slots'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(AiBookingSlotOption.fromJson)
              .toList(),
      totalSlots:
          json['total_slots'] is num ? (json['total_slots'] as num).toInt() : 0,
      message: json['message']?.toString(),
    );
  }
}

class AiBookingSummaryPayload {
  final String? petId;
  final String? petName;
  final String? clinicId;
  final String? clinicName;
  final String? bookingDate;
  final String? startTime;
  final List<String> serviceIds;
  final List<String> serviceNames;
  final String? bookingType;
  final String? notes;
  final String? homeAddress;
  final double? homeLat;
  final double? homeLong;
  final String? message;
  final List<String> missingFields;
  final bool? readyToCreate;
  final String? nextBestAction;

  const AiBookingSummaryPayload({
    this.petId,
    this.petName,
    this.clinicId,
    this.clinicName,
    this.bookingDate,
    this.startTime,
    this.serviceIds = const [],
    this.serviceNames = const [],
    this.bookingType,
    this.notes,
    this.homeAddress,
    this.homeLat,
    this.homeLong,
    this.message,
    this.missingFields = const [],
    this.readyToCreate,
    this.nextBestAction,
  });

  factory AiBookingSummaryPayload.fromJson(Map<String, dynamic> json) {
    final readyToCreate = json['ready_to_create'] is bool
        ? json['ready_to_create'] as bool
        : (json['ready_for_review'] is bool
            ? json['ready_for_review'] as bool
            : null);

    return AiBookingSummaryPayload(
      petId: json['pet_id']?.toString(),
      petName: json['pet_name']?.toString(),
      clinicId: json['clinic_id']?.toString(),
      clinicName: json['clinic_name']?.toString(),
      bookingDate: json['booking_date']?.toString(),
      startTime: json['start_time']?.toString(),
      serviceIds: (json['service_ids'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      serviceNames: (json['service_names'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      bookingType: json['booking_type']?.toString(),
      notes: json['notes']?.toString(),
      homeAddress: json['home_address']?.toString(),
      homeLat:
          json['home_lat'] is num ? (json['home_lat'] as num).toDouble() : null,
      homeLong: json['home_long'] is num
          ? (json['home_long'] as num).toDouble()
          : null,
      message: json['message']?.toString(),
      missingFields: (json['missing_fields'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      readyToCreate: readyToCreate,
      nextBestAction: json['next_best_action']?.toString(),
    );
  }
}

class AiBookingCreatedPayload {
  final String? bookingId;
  final String? bookingCode;
  final String? status;
  final String? petName;
  final String? clinicName;
  final String? date;
  final String? time;
  final String? bookingType;
  final List<String> services;
  final double? estimatedTotal;
  final String? homeAddress;
  final double? distanceKm;
  final bool managerWillConfirm;
  final String? message;
  final Map<String, dynamic>? multiPetSummary;
  final List<Map<String, dynamic>>? bookings;

  const AiBookingCreatedPayload({
    this.bookingId,
    this.bookingCode,
    this.status,
    this.petName,
    this.clinicName,
    this.date,
    this.time,
    this.bookingType,
    this.services = const [],
    this.estimatedTotal,
    this.homeAddress,
    this.distanceKm,
    this.managerWillConfirm = true,
    this.message,
    this.multiPetSummary,
    this.bookings,
  });

  factory AiBookingCreatedPayload.fromJson(Map<String, dynamic> json) {
    final booking = json['booking'] is Map<String, dynamic>
        ? json['booking'] as Map<String, dynamic>
        : (json['booking'] is Map
            ? Map<String, dynamic>.from(json['booking'] as Map)
            : json);
    return AiBookingCreatedPayload(
      bookingId: booking['id']?.toString(),
      bookingCode: booking['booking_code']?.toString(),
      status: booking['status']?.toString(),
      petName: booking['pet_name']?.toString(),
      clinicName: booking['clinic_name']?.toString(),
      date: booking['date']?.toString(),
      time: booking['time']?.toString(),
      bookingType: booking['type']?.toString(),
      services: (booking['services'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      estimatedTotal: booking['estimated_total'] is num
          ? (booking['estimated_total'] as num).toDouble()
          : null,
      homeAddress: booking['home_address']?.toString(),
      distanceKm: booking['distance_km'] is num
          ? (booking['distance_km'] as num).toDouble()
          : null,
      managerWillConfirm: booking['manager_will_confirm'] != false,
      message: json['message']?.toString(),
      multiPetSummary: json['multi_pet_summary'] is Map<String, dynamic>
          ? json['multi_pet_summary'] as Map<String, dynamic>
          : null,
      bookings: (json['bookings'] as List<dynamic>?)
          ?.map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
    );
  }
}

class UiAction {
  final String type;
  final String label;
  final Map<String, dynamic>? payload;

  UiAction({
    required this.type,
    required this.label,
    this.payload,
  });

  factory UiAction.fromJson(Map<String, dynamic> json) {
    return UiAction(
      type: json['type']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      payload: json['payload'] is Map
          ? Map<String, dynamic>.from(json['payload'] as Map)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'type': type,
        'label': label,
        if (payload != null) 'payload': payload,
      };
}

class UiComponentV1 {
  final String type;
  final String id;
  final Map<String, dynamic> data;
  final List<UiAction>? actions;

  UiComponentV1({
    required this.type,
    required this.id,
    required this.data,
    this.actions,
  });

  factory UiComponentV1.fromJson(Map<String, dynamic> json) {
    return UiComponentV1(
      type: json['type']?.toString() ?? 'text',
      id: json['id']?.toString() ?? UniqueKey().toString(),
      data: json['data'] is Map
          ? Map<String, dynamic>.from(json['data'] as Map)
          : <String, dynamic>{},
      actions: (json['actions'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(UiAction.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'data': data,
        if (actions != null)
          'actions': actions!.map((action) => action.toJson()).toList(),
      };
}

class UiSchemaV1 {
  final String version;
  final String layout;
  final List<UiComponentV1> components;
  final Map<String, dynamic>? metadata;

  const UiSchemaV1({
    required this.version,
    required this.layout,
    required this.components,
    this.metadata,
  });

  factory UiSchemaV1.fromJson(Map<String, dynamic> json) {
    return UiSchemaV1(
      version: json['version']?.toString() ?? '1.0',
      layout: json['layout']?.toString() ?? 'list',
      components: (json['components'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(UiComponentV1.fromJson)
          .toList(),
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'version': version,
        'layout': layout,
        'components':
            components.map((component) => component.toJson()).toList(),
        if (metadata != null) 'metadata': metadata,
      };
}

class AiChatSocketEvent {
  final AiChatSocketEventType type;
  final String? message;
  final String? content;
  final String? fullResponse;
  final String? error;
  final String? errorCode;
  final bool? recoverable;
  final String? suggestion;
  final String? stage;
  final UiSchemaV1? uiSchema;
  final List<AiChatMessage> messages;
  final List<dynamic>? reactTrace;
  final String? toolName;
  final int? stepIndex;
  final Map<String, dynamic>? reactStep;
  final Map<String, dynamic>? toolParams;
  final dynamic result;
  final AiClinicSuggestion? clinicSuggestion;
  final List<AiBookingServiceOption> serviceOptions;
  final AiSlotGridPayload? slotGrid;
  final AiBookingSummaryPayload? bookingSummary;
  final AiBookingCreatedPayload? bookingCreated;
  final AiBookingCreatedPayload? multiPetBookingCreated;
  final Map<String, dynamic>? bookingState;
  final Map<String, dynamic> raw;

  const AiChatSocketEvent({
    required this.type,
    this.message,
    this.content,
    this.fullResponse,
    this.error,
    this.errorCode,
    this.recoverable,
    this.suggestion,
    this.stage,
    this.uiSchema,
    this.messages = const [],
    this.reactTrace,
    this.toolName,
    this.stepIndex,
    this.reactStep,
    this.toolParams,
    this.result,
    this.clinicSuggestion,
    this.serviceOptions = const [],
    this.slotGrid,
    this.bookingSummary,
    this.bookingCreated,
    this.multiPetBookingCreated,
    this.bookingState,
    this.raw = const {},
  });

  factory AiChatSocketEvent.fromJson(Map<String, dynamic> json) {
    final type = AiChatSocketEventType.fromString(json['type']?.toString());
    final uiSchema = json['ui_schema'] is Map<String, dynamic>
        ? UiSchemaV1.fromJson(json['ui_schema'] as Map<String, dynamic>)
        : (json['ui_schema'] is Map
            ? UiSchemaV1.fromJson(
                Map<String, dynamic>.from(json['ui_schema'] as Map),
              )
            : null);
    AiClinicSuggestion? clinicSuggestion;
    if (json['clinics'] != null || json['total_found'] != null) {
      clinicSuggestion = AiClinicSuggestion.fromJson(json);
    }
    final serviceOptions = type == AiChatSocketEventType.serviceChips
        ? (json['services'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AiBookingServiceOption.fromJson)
            .toList()
        : const <AiBookingServiceOption>[];
    final slotGrid = type == AiChatSocketEventType.slotGrid
        ? AiSlotGridPayload.fromJson(json)
        : null;
    final bookingSummary =
        type == AiChatSocketEventType.bookingSummary && json['summary'] is Map
            ? AiBookingSummaryPayload.fromJson(
                Map<String, dynamic>.from(json['summary'] as Map),
              )
            : null;
    final bookingCreated = type == AiChatSocketEventType.bookingCreated
        ? AiBookingCreatedPayload.fromJson(json)
        : null;
    final multiPetBookingCreated =
        type == AiChatSocketEventType.multiPetBookingCreated
            ? AiBookingCreatedPayload.fromJson(json)
            : null;

    return AiChatSocketEvent(
      type: type,
      message: json['message']?.toString(),
      content: json['content']?.toString(),
      fullResponse: json['full_response']?.toString(),
      error: json['error']?.toString(),
      errorCode: json['error_code']?.toString(),
      recoverable:
          json['recoverable'] is bool ? json['recoverable'] as bool : null,
      suggestion: json['suggestion']?.toString(),
      stage: json['stage']?.toString(),
      uiSchema: uiSchema,
      toolName: json['tool_name']?.toString(),
      stepIndex: json['step_index'] is num
          ? (json['step_index'] as num).toInt()
          : null,
      reactStep: json['react_step'] is Map
          ? Map<String, dynamic>.from(json['react_step'] as Map)
          : null,
      toolParams: json['tool_params'] is Map
          ? Map<String, dynamic>.from(json['tool_params'] as Map)
          : null,
      result: json['result'],
      reactTrace: json['react_trace'] as List<dynamic>?,
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AiChatMessage.fromJson)
          .toList(),
      clinicSuggestion: clinicSuggestion,
      serviceOptions: serviceOptions,
      slotGrid: slotGrid,
      bookingSummary: bookingSummary,
      bookingCreated: bookingCreated,
      multiPetBookingCreated: multiPetBookingCreated,
      bookingState: json['booking_state'] is Map
          ? Map<String, dynamic>.from(json['booking_state'] as Map)
          : null,
      raw: json.map((key, value) => MapEntry(key.toString(), value)),
    );
  }
}

import 'package:flutter/foundation.dart';

const String bookingTypeInClinic = 'IN_CLINIC';
const String bookingTypeHomeVisit = 'HOME_VISIT';

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
    String _pickString(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        final text = value?.toString().trim() ?? '';
        if (text.isNotEmpty) {
          return text;
        }
      }
      return '';
    }

    double? _pickDouble(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) {
          return value.toDouble();
        }
      }
      return null;
    }

    int? _pickInt(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) {
          return value.toInt();
        }
      }
      return null;
    }

    return AiClinic(
      id: _pickString(['id', 'clinic_id', 'clinicId', 'item_id']),
      name: _pickString(['name', 'clinic_name', 'clinicName', 'title']),
      address: _pickString(['address', 'clinic_address', 'clinicAddress']),
      distanceKm: _pickDouble(['distance_km', 'distanceKm']),
      rating: _pickDouble(['rating']),
      totalReviews: _pickInt(['total_reviews', 'totalReviews']),
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
  final String id;
  final String name;
  final String? category;
  final double? basePrice;
  final String? description;
  final bool isVaccination;

  const AiClinicService({
    required this.id,
    required this.name,
    this.category,
    this.basePrice,
    this.description,
    this.isVaccination = false,
  });

  factory AiClinicService.fromJson(Map<String, dynamic> json) {
    String _pickString(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        final text = value?.toString().trim() ?? '';
        if (text.isNotEmpty) {
          return text;
        }
      }
      return '';
    }

    double? _pickDouble(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) {
          return value.toDouble();
        }
      }
      return null;
    }

    return AiClinicService(
      id: _pickString(['id', 'service_id', 'serviceId', 'item_id']),
      name: _pickString(['name', 'service_name', 'serviceName', 'label']),
      category:
          _pickString(['category']).isEmpty ? null : _pickString(['category']),
      basePrice: _pickDouble(['base_price', 'basePrice', 'price']),
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
  final String? clinicId;
  final String? category;
  final double? basePrice;

  const AiBookingServiceOption({
    required this.id,
    required this.name,
    this.clinicId,
    this.category,
    this.basePrice,
  });

  factory AiBookingServiceOption.fromJson(Map<String, dynamic> json) {
    String _pickString(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        final text = value?.toString().trim() ?? '';
        if (text.isNotEmpty) {
          return text;
        }
      }
      return '';
    }

    String? _pickNullableString(List<String> keys) {
      final value = _pickString(keys);
      return value.isEmpty ? null : value;
    }

    double? _pickDouble(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) {
          return value.toDouble();
        }
      }
      return null;
    }

    return AiBookingServiceOption(
      id: _pickString(['id', 'service_id', 'serviceId', 'item_id']),
      name: _pickString(['name', 'service_name', 'serviceName', 'label']),
      clinicId: _pickNullableString(['clinic_id', 'clinicId']),
      category: _pickNullableString(['category']),
      basePrice: _pickDouble(['base_price', 'basePrice', 'price']),
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
    String? _pickString(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value == null) continue;
        final text = value.toString().trim();
        if (text.isNotEmpty) {
          return text;
        }
      }
      return null;
    }

    List<String> _pickStringList(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is List) {
          return value
              .map((item) => item.toString().trim())
              .where((item) => item.isNotEmpty)
              .toList();
        }
      }
      return const <String>[];
    }

    int _pickInt(List<String> keys, {int fallback = 0}) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) {
          return value.toInt();
        }
      }
      return fallback;
    }

    return AiSlotGridPayload(
      clinicId: _pickString(['clinic_id', 'clinicId']),
      bookingDate: _pickString(['booking_date', 'bookingDate', 'date']),
      serviceIds: _pickStringList(['service_ids', 'serviceIds']),
      serviceNames: _pickStringList(['service_names', 'serviceNames']),
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
      totalSlots: _pickInt(['total_slots', 'totalSlots']),
      message: _pickString(['message']),
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
  final double? distanceKm;
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
    this.distanceKm,
    this.message,
    this.missingFields = const [],
    this.readyToCreate,
    this.nextBestAction,
  });

  factory AiBookingSummaryPayload.fromJson(Map<String, dynamic> json) {
    String? _pickString(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value == null) continue;
        final text = value.toString().trim();
        if (text.isNotEmpty) {
          return text;
        }
      }
      return null;
    }

    List<String> _pickStringList(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is List) {
          return value
              .map((item) => item.toString().trim())
              .where((item) => item.isNotEmpty)
              .toList();
        }
      }
      return const <String>[];
    }

    double? _pickDouble(List<String> keys) {
      for (final key in keys) {
        final value = json[key];
        if (value is num) {
          return value.toDouble();
        }
      }
      return null;
    }

    final readyToCreate = json['ready_to_create'] is bool
        ? json['ready_to_create'] as bool
        : (json['ready_for_review'] is bool
            ? json['ready_for_review'] as bool
            : (json['readyToCreate'] is bool
                ? json['readyToCreate'] as bool
                : (json['readyForReview'] is bool
                    ? json['readyForReview'] as bool
                    : null)));

    return AiBookingSummaryPayload(
      petId: _pickString(['pet_id', 'petId']),
      petName: _pickString(['pet_name', 'petName']),
      clinicId: _pickString(['clinic_id', 'clinicId']),
      clinicName: _pickString(['clinic_name', 'clinicName']),
      bookingDate: _pickString(['booking_date', 'bookingDate', 'date']),
      startTime: _pickString(['start_time', 'startTime']),
      serviceIds: _pickStringList(['service_ids', 'serviceIds']),
      serviceNames: _pickStringList(['service_names', 'serviceNames']),
      bookingType: _pickString(['booking_type', 'bookingType', 'type']),
      notes: _pickString(['notes']),
      homeAddress: _pickString(['home_address', 'homeAddress']),
      homeLat: _pickDouble(['home_lat', 'homeLat']),
      homeLong: _pickDouble(['home_long', 'homeLong']),
      distanceKm: _pickDouble(['distance_km', 'distanceKm']),
      message: _pickString(['message']),
      missingFields: _pickStringList(['missing_fields', 'missingFields']),
      readyToCreate: readyToCreate,
      nextBestAction: _pickString(['next_best_action', 'nextBestAction']),
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
    Map<String, dynamic>? bookingSummaryPayload;
    if (type == AiChatSocketEventType.bookingSummary) {
      if (json['summary'] is Map) {
        bookingSummaryPayload =
            Map<String, dynamic>.from(json['summary'] as Map);
      } else if (json['data'] is Map) {
        bookingSummaryPayload = Map<String, dynamic>.from(json['data'] as Map);
      } else {
        bookingSummaryPayload = Map<String, dynamic>.from(json);
      }
    }
    final bookingSummary = bookingSummaryPayload == null
        ? null
        : AiBookingSummaryPayload.fromJson(bookingSummaryPayload);
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

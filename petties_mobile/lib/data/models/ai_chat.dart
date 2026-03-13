class AiChatMessage {
  final String? messageId;
  final String role;
  final String content;
  final DateTime? timestamp;
  final List<dynamic>? reactTrace;

  const AiChatMessage({
    this.messageId,
    required this.role,
    required this.content,
    this.timestamp,
    this.reactTrace,
  });

  factory AiChatMessage.fromJson(Map<String, dynamic> json) {
    return AiChatMessage(
      messageId: json['message_id']?.toString(),
      role: json['role']?.toString() ?? 'assistant',
      content: json['content']?.toString() ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString())
          : null,
      reactTrace: json['react_trace'] as List<dynamic>?,
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
  final String? operatingHours;
  final String? serviceError;

  const AiClinic({
    required this.id,
    required this.name,
    required this.address,
    this.distanceKm,
    this.rating,
    this.totalReviews,
    this.services = const [],
    this.hasSos = false,
    this.operatingHours,
    this.serviceError,
  });

  factory AiClinic.fromJson(Map<String, dynamic> json) {
    return AiClinic(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      distanceKm: json['distance_km'] is num ? (json['distance_km'] as num).toDouble() : null,
      rating: json['rating'] is num ? (json['rating'] as num).toDouble() : null,
      totalReviews: json['total_reviews'] is num ? (json['total_reviews'] as num).toInt() : null,
      services: (json['services'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AiClinicService.fromJson)
          .toList(),
      hasSos: json['has_sos'] == true,
      operatingHours: json['operating_hours']?.toString(),
      serviceError: json['service_error']?.toString(),
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
      basePrice: json['base_price'] is num ? (json['base_price'] as num).toDouble() : null,
      description: json['description']?.toString(),
      isVaccination: json['is_vaccination'] == true,
    );
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
      totalFound: json['total_found'] is num ? (json['total_found'] as num).toInt() : 0,
      latitude: location?['lat'] is num ? (location!['lat'] as num).toDouble() : null,
      longitude: location?['lng'] is num ? (location!['lng'] as num).toDouble() : null,
    );
  }
}

class AiChatSession {
  final String sessionId;
  final String? title;
  final String contextType;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final List<AiChatMessage> messages;

  const AiChatSession({
    required this.sessionId,
    this.title,
    required this.contextType,
    this.createdAt,
    this.updatedAt,
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
  toolCall,
  toolResult,
  stream,
  complete,
  error,
  clinicSuggestion,
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
      default:
        return AiChatSocketEventType.unknown;
    }
  }
}

class AiChatSocketEvent {
  final AiChatSocketEventType type;
  final String? message;
  final String? content;
  final String? fullResponse;
  final String? error;
  final List<AiChatMessage> messages;
  final List<dynamic>? reactTrace;
  final String? toolName;
  final int? stepIndex;
  final Map<String, dynamic>? reactStep;
  final Map<String, dynamic>? toolParams;
  final dynamic result;
  final AiClinicSuggestion? clinicSuggestion;

  const AiChatSocketEvent({
    required this.type,
    this.message,
    this.content,
    this.fullResponse,
    this.error,
    this.messages = const [],
    this.reactTrace,
    this.toolName,
    this.stepIndex,
    this.reactStep,
    this.toolParams,
    this.result,
    this.clinicSuggestion,
  });

  factory AiChatSocketEvent.fromJson(Map<String, dynamic> json) {
    AiClinicSuggestion? clinicSuggestion;
    if (json['clinics'] != null || json['total_found'] != null) {
      clinicSuggestion = AiClinicSuggestion.fromJson(json);
    }

    return AiChatSocketEvent(
      type: AiChatSocketEventType.fromString(json['type']?.toString()),
      message: json['message']?.toString(),
      content: json['content']?.toString(),
      fullResponse: json['full_response']?.toString(),
      error: json['error']?.toString(),
      toolName: json['tool_name']?.toString(),
      stepIndex: json['step_index'] is num ? (json['step_index'] as num).toInt() : null,
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
    );
  }
}

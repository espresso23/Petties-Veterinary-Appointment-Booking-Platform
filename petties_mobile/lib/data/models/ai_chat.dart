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

  const AiChatSocketEvent({
    required this.type,
    this.message,
    this.content,
    this.fullResponse,
    this.error,
    this.messages = const [],
    this.reactTrace,
    this.toolName,
  });

  factory AiChatSocketEvent.fromJson(Map<String, dynamic> json) {
    return AiChatSocketEvent(
      type: AiChatSocketEventType.fromString(json['type']?.toString()),
      message: json['message']?.toString(),
      content: json['content']?.toString(),
      fullResponse: json['full_response']?.toString(),
      error: json['error']?.toString(),
      toolName: json['tool_name']?.toString(),
      reactTrace: json['react_trace'] as List<dynamic>?,
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AiChatMessage.fromJson)
          .toList(),
    );
  }
}

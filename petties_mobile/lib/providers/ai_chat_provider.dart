import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:web_socket_channel/io.dart';
import 'package:loguru/loguru.dart';

import '../data/models/ai_chat.dart';
import '../data/services/ai_chat_service.dart';
import '../ui/chat/ai_chat/utils/ai_booking_tracker.dart';

class AiChatProvider with ChangeNotifier {
  final AiChatService _aiChatService = AiChatService();
  
  // Basic State
  List<AiChatMessage> _messages = [];
  String? _sessionId;
  bool _isInitializing = false;
  bool _isSending = false;
  String? _error;
  String? _agentStatus;
  
  // Connection Management
  IOWebSocketChannel? _channel;
  StreamSubscription? _socketSubscription;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 3;
  
  // Streaming Buffer
  String _streamBuffer = '';
  Timer? _streamFlushTimer;
  
  // Domain State (Booking Tracker)
  AiBookingTrackerSnapshot _bookingTracker = AiBookingTrackerSnapshot.empty;
  Map<String, dynamic>? _lastLocationPayload;
  
  // Getters
  List<AiChatMessage> get messages => _messages;
  String? get sessionId => _sessionId;
  bool get isInitializing => _isInitializing;
  bool get isSending => _isSending;
  String? get error => _error;
  String? get agentStatus => _agentStatus;
  AiBookingTrackerSnapshot get bookingTracker => _bookingTracker;

  // Initialization
  Future<void> initializeChat() async {
    _isInitializing = true;
    _error = null;
    notifyListeners();

    try {
      final session = await _aiChatService.getOrCreateSession();
      _messages = List.from(session.messages);
      _sessionId = session.sessionId;
      if (session.bookingState != null) {
          // Initialize tracker from session state if needed
      }
      await _connectToSocket(session.sessionId);
      _reconnectAttempts = 0;
    } catch (e) {
      _error = 'Không thể khởi tạo trợ lý AI';
    } finally {
      _isInitializing = false;
      notifyListeners();
    }
  }

  Future<void> _connectToSocket(String sessionId) async {
    await _socketSubscription?.cancel();
    await _channel?.sink.close();

    try {
      _channel = await _aiChatService.connectToSession(sessionId);
      _socketSubscription = _channel!.stream.listen(
        (payload) => _handleSocketEvent(_aiChatService.parseSocketEvent(payload)),
        onError: (err) => _handleConnectionInterrupted(),
        onDone: () => _handleConnectionInterrupted(),
      );
    } catch (e) {
      _handleError('Lỗi kết nối realtime');
    }
  }

  void _handleSocketEvent(AiChatSocketEvent event) {
    switch (event.type) {
      case AiChatSocketEventType.message:
        _flushStreamBuffer(); // Ensure buffer is empty before final message
        if (event.message != null) {
          _upsertAssistantMessage(event.message!);
          _isSending = false;
          _agentStatus = null;
        }
        break;
      case AiChatSocketEventType.chunk:
        _appendAssistantChunk(event.content ?? '');
        break;
      case AiChatSocketEventType.thinking:
        _agentStatus = event.content ?? 'Đang suy nghĩ...';
        break;
      case AiChatSocketEventType.uiSchema:
        _handleUiSchema(event.uiSchema);
        break;
      case AiChatSocketEventType.error:
        _handleError(event.error ?? 'Lỗi không xác định');
        break;
      default:
        break;
    }
    notifyListeners();
  }

  // Streaming Logic
  void _appendAssistantChunk(String chunk) {
    _streamBuffer += chunk;
    _scheduleStreamFlush();
  }

  void _scheduleStreamFlush() {
    if (_streamFlushTimer != null) return;
    _streamFlushTimer = Timer(const Duration(milliseconds: 50), () {
      _streamFlushTimer = null;
      _flushStreamBuffer();
    });
  }

  void _flushStreamBuffer() {
    if (_streamBuffer.isEmpty) return;
    final content = _streamBuffer;
    _streamBuffer = '';
    
    // Logic to update the last assistant message or create a new one for streaming
    _upsertStreamingMessage(content);
    notifyListeners();
  }

  void _upsertStreamingMessage(String chunk) {
    if (_messages.isNotEmpty && _messages.last.role == 'assistant' && _messages.last.isStreaming == true) {
      final last = _messages.removeLast();
      _messages.add(last.copyWith(content: last.content + chunk));
    } else {
      _messages.add(AiChatMessage(
        role: 'assistant',
        content: chunk,
        timestamp: DateTime.now(),
        isStreaming: true,
      ));
    }
  }

  void _upsertAssistantMessage(AiChatMessage message) {
     if (_messages.isNotEmpty && _messages.last.role == 'assistant') {
       _messages.removeLast(); // Remove streaming message
     }
     _messages.add(message);
  }

  // Domain Logic
  void _handleUiSchema(Map<String, dynamic>? schema) {
    if (schema == null) return;
    
    // Extract booking state if present in ui_schema event
    final dynamic state = schema['booking_state'];
    if (state is Map<String, dynamic>) {
      _syncBookingState(state);
    }
  }

  void _handleBookingStateUpdate(Map<String, dynamic>? state) {
    if (state == null) return;
    _syncBookingState(state);
  }

  void _syncBookingState(Map<String, dynamic> state) {
    // Source of Truth: Backend Draft
    final dynamic draft = state['draft'];
    if (draft is Map<String, dynamic>) {
       _bookingTracker = _bookingTracker.copyWith(
         petId: draft['pet_id']?.toString(),
         clinicId: draft['clinic_id']?.toString(),
         bookingDate: draft['booking_date']?.toString(),
         startTime: draft['start_time']?.toString(),
         bookingType: draft['booking_type']?.toString(),
         serviceIds: (draft['service_ids'] as List<dynamic>?)?.map((e) => e.toString()).toList(),
         notes: draft['notes']?.toString(),
       );
       notifyListeners();
    }
  }

  // GPS Logic
  Future<Map<String, dynamic>?> getCurrentLocation() async {
    if (_lastLocationPayload != null) return _lastLocationPayload;
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high
      );
      _lastLocationPayload = {
        'lat': position.latitude,
        'lng': position.longitude,
      };
      return _lastLocationPayload;
    } catch (e) {
      return null;
    }
  }

  // Sending Logic
  Future<void> sendMessage(String text, {Map<String, dynamic>? uiAction}) async {
    _isSending = true;
    _error = null;
    _messages.add(AiChatMessage(role: 'user', content: text, timestamp: DateTime.now()));
    notifyListeners();

    try {
      final location = await getCurrentLocation();
      final payload = _aiChatService.encodeOutgoingPayload(
        message: text,
        uiAction: uiAction,
        location: location,
      );
      _channel?.sink.add(payload);
    } catch (e) {
      _handleError('Lỗi gửi tin nhắn');
    }
  }

  void _handleConnectionInterrupted() {
     if (_reconnectAttempts < _maxReconnectAttempts) {
       _reconnectAttempts++;
       _agentStatus = 'Đang kết nối lại...';
       notifyListeners();
       Future.delayed(const Duration(seconds: 2), () => initializeChat());
     } else {
       _handleError('Kết nối thất bại sau nhiều lần thử');
     }
  }

  void _handleError(String message) {
    _error = message;
    _isSending = false;
    _agentStatus = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _streamFlushTimer?.cancel();
    _socketSubscription?.cancel();
    _channel?.sink.close();
    super.dispose();
  }
}

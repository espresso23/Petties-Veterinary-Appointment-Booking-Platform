import 'dart:async';
import 'dart:convert';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import 'package:logger/logger.dart';
import '../../config/env/environment.dart';
import '../models/chat.dart';

/// WebSocket message types from server
enum WsMessageType {
  message,
  typing,
  stopTyping,
  read,
  online,
  offline;

  static WsMessageType fromString(String value) {
    switch (value) {
      case 'MESSAGE':
        return WsMessageType.message;
      case 'TYPING':
        return WsMessageType.typing;
      case 'STOP_TYPING':
        return WsMessageType.stopTyping;
      case 'READ':
        return WsMessageType.read;
      case 'ONLINE':
        return WsMessageType.online;
      case 'OFFLINE':
        return WsMessageType.offline;
      default:
        return WsMessageType.message;
    }
  }
}

/// WebSocket message payload from server
class ChatWebSocketMessage {
  final WsMessageType type;
  final String conversationId;
  final ChatMessage? message;
  final String? senderId;
  final String? senderType;
  final DateTime timestamp;

  ChatWebSocketMessage({
    required this.type,
    required this.conversationId,
    this.message,
    this.senderId,
    this.senderType,
    required this.timestamp,
  });

  factory ChatWebSocketMessage.fromJson(Map<String, dynamic> json) {
    return ChatWebSocketMessage(
      type: WsMessageType.fromString(json['type'] ?? 'MESSAGE'),
      conversationId: json['conversationId'] ?? '',
      message: json['message'] != null
          ? ChatMessage.fromJson(json['message'])
          : null,
      senderId: json['senderId'],
      senderType: json['senderType'],
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'])
          : DateTime.now(),
    );
  }
}

/// Message handler callback type
typedef MessageHandler = void Function(ChatWebSocketMessage message);

/// WebSocket service for real-time chat using STOMP protocol
class ChatWebSocketService {
  static ChatWebSocketService? _instance;
  static ChatWebSocketService get instance =>
      _instance ??= ChatWebSocketService._internal();

  final Logger _logger = Logger();
  StompClient? _client;
  String? _accessToken;

  // Subscriptions management
  final Map<String, StompUnsubscribe?> _subscriptions = {};
  final Map<String, Set<MessageHandler>> _handlers = {};

  // Connection state
  bool _isConnecting = false;
  bool _isConnected = false;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;

  // Connection completer for async connect
  Completer<void>? _connectCompleter;

  ChatWebSocketService._internal();

  /// Get WebSocket URL from base API URL
  String get _wsUrl {
    // Priority 1: WS_URL passed via --dart-define
    final wsUrlFromEnv = Environment.wsUrl;
    if (wsUrlFromEnv.isNotEmpty) {
      return wsUrlFromEnv;
    }

    // Priority 2: Derive from baseUrl
    final baseUrl = Environment.baseUrl;
    _logger.i('Environment.baseUrl = $baseUrl');

    // Remove /api suffix to get base server URL
    String serverUrl = baseUrl.replaceAll('/api', '');

    // For production/staging (HTTPS), use wss://
    // For dev (HTTP), use ws://
    // Note: Mobile uses /api/ws-native endpoint (pure WebSocket, no SockJS)
    // Backend has context path /api, so WS endpoint is at /api/ws-native
    if (serverUrl.startsWith('https://')) {
      return serverUrl.replaceFirst('https://', 'wss://') + '/api/ws-native';
    } else if (serverUrl.startsWith('http://')) {
      return serverUrl.replaceFirst('http://', 'ws://') + '/api/ws-native';
    }

    // Fallback: assume http
    return 'ws://$serverUrl/ws-native';
  }

  /// Whether WebSocket is connected
  bool get isConnected => _isConnected;

  /// Set access token for authentication
  void setAccessToken(String? token) {
    _accessToken = token;
  }

  /// Connect to WebSocket server
  Future<void> connect() async {
    if (_isConnected || _isConnecting) {
      return _connectCompleter?.future ?? Future.value();
    }

    if (_accessToken == null || _accessToken!.isEmpty) {
      _logger.w('Cannot connect WebSocket: No access token');
      return;
    }

    _isConnecting = true;
    _connectCompleter = Completer<void>();

    final wsUrl = _wsUrl;
    _logger.i('Connecting to WebSocket: $wsUrl');

    _client = StompClient(
      config: StompConfig(
        url: wsUrl,
        stompConnectHeaders: {
          'Authorization': 'Bearer $_accessToken',
        },
        webSocketConnectHeaders: {
          'Authorization': 'Bearer $_accessToken',
        },
        onConnect: _onConnect,
        onDisconnect: _onDisconnect,
        onWebSocketError: _onWebSocketError,
        onStompError: _onStompError,
        reconnectDelay: const Duration(seconds: 5),
        heartbeatIncoming: const Duration(seconds: 4),
        heartbeatOutgoing: const Duration(seconds: 4),
      ),
    );

    _client!.activate();
    return _connectCompleter!.future;
  }

  /// Disconnect from WebSocket server
  void disconnect() {
    if (_client != null) {
      // Unsubscribe all
      for (final unsubscribe in _subscriptions.values) {
        unsubscribe?.call();
      }
      _subscriptions.clear();
      _handlers.clear();

      _client!.deactivate();
      _client = null;
    }
    _isConnected = false;
    _isConnecting = false;
  }

  /// Subscribe to a chat box
  void subscribeToChatBox(String chatBoxId, MessageHandler handler) {
    if (!_isConnected || _client == null) {
      _logger.w('Cannot subscribe: WebSocket not connected');
      return;
    }

    // Store handler
    if (!_handlers.containsKey(chatBoxId)) {
      _handlers[chatBoxId] = {};
    }
    _handlers[chatBoxId]!.add(handler);

    // Subscribe if not already
    if (!_subscriptions.containsKey(chatBoxId)) {
      final destination = '/topic/chat/$chatBoxId';
      _logger.d('Subscribing to $destination');

      final unsubscribe = _client!.subscribe(
        destination: destination,
        callback: (frame) {
          _handleMessage(chatBoxId, frame);
        },
      );
      _subscriptions[chatBoxId] = unsubscribe;
    }
  }

  /// Unsubscribe from a chat box
  void unsubscribeFromChatBox(String chatBoxId, MessageHandler? handler) {
    if (handler != null) {
      _handlers[chatBoxId]?.remove(handler);
    }

    // If no more handlers, unsubscribe
    if (_handlers[chatBoxId]?.isEmpty ?? true) {
      _subscriptions[chatBoxId]?.call();
      _subscriptions.remove(chatBoxId);
      _handlers.remove(chatBoxId);
    }
  }

  /// Send a message
  void sendMessage(String chatBoxId, String content) {
    if (!_isConnected || _client == null) {
      _logger.w('Cannot send: WebSocket not connected');
      return;
    }

    _client!.send(
      destination: '/app/chat/$chatBoxId/send',
      body: jsonEncode({'content': content}),
    );
  }

  /// Send typing indicator
  void sendTyping(String chatBoxId, bool typing) {
    if (!_isConnected || _client == null) return;

    _client!.send(
      destination: '/app/chat/$chatBoxId/typing',
      body: jsonEncode({'typing': typing}),
    );
  }

  /// Send read receipt
  void sendRead(String chatBoxId) {
    if (!_isConnected || _client == null) return;

    _client!.send(
      destination: '/app/chat/$chatBoxId/read',
      body: '{}',
    );
  }

  /// Send online status
  void sendOnlineStatus(String chatBoxId, bool online) {
    if (!_isConnected || _client == null) return;

    _client!.send(
      destination: '/app/chat/$chatBoxId/online',
      body: jsonEncode({'online': online}),
    );
  }

  // ======================== PRIVATE METHODS ========================

  void _onConnect(StompFrame frame) {
    _logger.i('WebSocket connected');
    _isConnected = true;
    _isConnecting = false;
    _reconnectAttempts = 0;
    _connectCompleter?.complete();
  }

  void _onDisconnect(StompFrame frame) {
    _logger.w('WebSocket disconnected');
    _isConnected = false;
    _isConnecting = false;
    _handleReconnect();
  }

  void _onWebSocketError(dynamic error) {
    _logger.e('WebSocket error: $error');
    _isConnected = false;
    _isConnecting = false;
    if (!(_connectCompleter?.isCompleted ?? true)) {
      _connectCompleter?.completeError(error);
    }
    _handleReconnect();
  }

  void _onStompError(StompFrame frame) {
    _logger.e('STOMP error: ${frame.body}');
    _isConnected = false;
    _isConnecting = false;
    if (!(_connectCompleter?.isCompleted ?? true)) {
      _connectCompleter?.completeError(Exception(frame.body));
    }
  }

  void _handleMessage(String chatBoxId, StompFrame frame) {
    try {
      if (frame.body == null) return;

      final json = jsonDecode(frame.body!);
      final wsMessage = ChatWebSocketMessage.fromJson(json);

      // Notify all handlers
      final handlers = _handlers[chatBoxId];
      if (handlers != null) {
        for (final handler in handlers) {
          handler(wsMessage);
        }
      }
    } catch (e) {
      _logger.e('Failed to parse WebSocket message: $e');
    }
  }

  void _handleReconnect() {
    if (_reconnectAttempts < _maxReconnectAttempts) {
      _reconnectAttempts++;
      _logger.i('Reconnecting... Attempt $_reconnectAttempts');
      Future.delayed(Duration(seconds: 5 * _reconnectAttempts), () {
        connect();
      });
    }
  }
}

// Singleton instance export
final chatWebSocket = ChatWebSocketService.instance;

import 'dart:async';
import 'dart:convert';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import 'package:logger/logger.dart';
import '../../config/env/environment.dart';

/// Location update model from server
class TrackingLocation {
  final String bookingId;
  final double latitude;
  final double longitude;
  final String? status;
  final DateTime timestamp;
  final String? vetPhone;
  final String? vetName;
  final int? etaMinutes;

  TrackingLocation({
    required this.bookingId,
    required this.latitude,
    required this.longitude,
    this.status,
    required this.timestamp,
    this.vetPhone,
    this.vetName,
    this.etaMinutes,
  });

  factory TrackingLocation.fromJson(Map<String, dynamic> json) {
    return TrackingLocation(
      bookingId: json['bookingId'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      status: json['status'],
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'])
          : DateTime.now(),
      vetPhone: json['vetPhone'],
      vetName: json['vetName'],
      etaMinutes: json['etaMinutes'] as int?,
    );
  }
}

/// Handler for tracking updates
typedef TrackingHandler = void Function(TrackingLocation location);

/// WebSocket service for real-time tracking using STOMP protocol
class TrackingWebsocketService {
  static TrackingWebsocketService? _instance;
  static TrackingWebsocketService get instance =>
      _instance ??= TrackingWebsocketService._internal();

  final Logger _logger = Logger();
  StompClient? _client;
  String? _accessToken;

  // Subscriptions management
  final Map<String, StompUnsubscribe?> _subscriptions = {};
  final Map<String, Set<TrackingHandler>> _handlers = {};

  // Connection state
  bool _isConnected = false;
  bool _isConnecting = false;
  Completer<void>? _connectionCompleter;

  TrackingWebsocketService._internal();

  /// Get WebSocket URL
  String get _wsUrl {
    final wsUrlFromEnv = Environment.wsUrl;
    if (wsUrlFromEnv.isNotEmpty) return wsUrlFromEnv;

    final baseUrl = Environment.baseUrl;
    String serverUrl = baseUrl.replaceAll('/api', '');

    if (serverUrl.startsWith('https://')) {
      return serverUrl.replaceFirst('https://', 'wss://') + '/api/ws-native';
    } else if (serverUrl.startsWith('http://')) {
      return serverUrl.replaceFirst('http://', 'ws://') + '/api/ws-native';
    }
    return 'ws://$serverUrl/ws-native';
  }

  void setAccessToken(String? token) {
    _accessToken = token;
  }

  Future<void> connect() async {
    if (_isConnected) return;
    if (_isConnecting) {
      // Đợi kết nối đang diễn ra hoàn tất
      await _connectionCompleter?.future;
      return;
    }
    if (_accessToken == null) {
      _logger.w('Cannot connect: access token is null');
      return;
    }

    _isConnecting = true;
    _connectionCompleter = Completer<void>();

    _client = StompClient(
      config: StompConfig(
        url: _wsUrl,
        stompConnectHeaders: {'Authorization': 'Bearer $_accessToken'},
        webSocketConnectHeaders: {'Authorization': 'Bearer $_accessToken'},
        onConnect: (frame) {
          _logger.i('Tracking WebSocket connected');
          _isConnected = true;
          _isConnecting = false;
          if (!(_connectionCompleter?.isCompleted ?? true)) {
            _connectionCompleter?.complete();
          }
        },
        onDisconnect: (frame) {
          _logger.w('Tracking WebSocket disconnected');
          _isConnected = false;
          _isConnecting = false;
        },
        onWebSocketError: (error) {
          _logger.e('WebSocket error: $error');
          _isConnecting = false;
          if (!(_connectionCompleter?.isCompleted ?? true)) {
            _connectionCompleter?.completeError(error);
          }
        },
        reconnectDelay: const Duration(seconds: 5),
      ),
    );
    _client!.activate();

    // Đợi kết nối hoàn tất với timeout
    try {
      await _connectionCompleter?.future.timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          _logger.w('WebSocket connection timed out');
          _isConnecting = false;
        },
      );
    } catch (e) {
      _logger.e('Error during WebSocket connection: $e');
    }
  }

  void disconnect() {
    for (final unsubscribe in _subscriptions.values) {
      unsubscribe?.call();
    }
    _subscriptions.clear();
    _handlers.clear();
    _client?.deactivate();
    _isConnected = false;
  }

  Future<void> subscribeToTracking(String bookingId, TrackingHandler handler) async {
    try {
      if (!_isConnected) {
        await connect();
      }

      // Safety check - nếu vẫn không connected hoặc client null
      if (!_isConnected || _client == null) {
        _logger.e('Cannot subscribe: WebSocket not connected');
        return;
      }

      if (!_handlers.containsKey(bookingId)) {
        _handlers[bookingId] = {};
      }
      _handlers[bookingId]!.add(handler);

      if (!_subscriptions.containsKey(bookingId)) {
        final destination = '/topic/booking/$bookingId/location';
        _logger.d('Subscribing to $destination');

        final unsubscribe = _client!.subscribe(
          destination: destination,
          callback: (frame) {
            if (frame.body != null) {
              final json = jsonDecode(frame.body!);
              final location = TrackingLocation.fromJson(json);
              for (final h in _handlers[bookingId] ?? {}) {
                h(location);
              }
            }
          },
        );
        _subscriptions[bookingId] = unsubscribe;
      }
    } catch (e) {
      _logger.e('Error subscribing to tracking: $e');
    }
  }

  void unsubscribeFromTracking(String bookingId, TrackingHandler handler) {
    _handlers[bookingId]?.remove(handler);
    if (_handlers[bookingId]?.isEmpty ?? true) {
      _subscriptions[bookingId]?.call();
      _subscriptions.remove(bookingId);
      _handlers.remove(bookingId);
    }
  }

  /// Update location (Staff side)
  void updateLocation(String bookingId, double lat, double lng,
      {String? status}) {
    if (!_isConnected || _client == null) return;

    _client!.send(
      destination: '/app/booking/$bookingId/track',
      body: jsonEncode({
        'latitude': lat,
        'longitude': lng,
        'status': status ?? 'MOVING',
      }),
    );
  }
}

final trackingWebsocket = TrackingWebsocketService.instance;

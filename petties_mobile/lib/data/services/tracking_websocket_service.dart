import 'dart:async';
import 'dart:convert';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import 'package:logger/logger.dart';
import '../../config/env/environment.dart';

/// Location update model from server
/// Maps to backend LocationUpdateResponse DTO
class TrackingLocation {
  final String bookingId;
  final double latitude;
  final double longitude;
  final int? etaMinutes;
  final double? distanceKm;
  final DateTime lastUpdated;
  final String? statusMessage;
  final bool arrived;

  TrackingLocation({
    required this.bookingId,
    required this.latitude,
    required this.longitude,
    this.etaMinutes,
    this.distanceKm,
    required this.lastUpdated,
    this.statusMessage,
    this.arrived = false,
  });

  factory TrackingLocation.fromJson(Map<String, dynamic> json) {
    return TrackingLocation(
      bookingId: json['bookingId'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      etaMinutes: json['etaMinutes'] as int?,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      lastUpdated: json['lastUpdated'] != null
          ? DateTime.parse(json['lastUpdated'])
          : DateTime.now(),
      statusMessage: json['statusMessage'],
      arrived: json['arrived'] as bool? ?? false,
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

  void _resubscribeAllActiveBookings() {
    if (!_isConnected || _client == null) return;

    // When the WebSocket reconnects, all previous STOMP subscriptions are lost.
    // We must re-subscribe for any bookingId that still has active handlers.
    final bookingIds = _handlers.keys.toList(growable: false);
    for (final bookingId in bookingIds) {
      final handlers = _handlers[bookingId];
      if (handlers == null || handlers.isEmpty) continue;

      final destination = '/topic/booking.$bookingId.location';
      _logger.d('Re-subscribing to $destination after reconnect');

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

      // Overwrite any stale unsubscribe function (from previous connection)
      _subscriptions[bookingId] = unsubscribe;
    }
  }

  /// Get WebSocket URL from Environment (handles port 443 explicitly)
  String get _wsUrl => Environment.wsUrl;

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
        stompConnectHeaders: {
          'Authorization': 'Bearer $_accessToken',
          'ngrok-skip-browser-warning': 'true',
        },
        webSocketConnectHeaders: {
          'Authorization': 'Bearer $_accessToken',
          'ngrok-skip-browser-warning': 'true',
        },
        onConnect: (frame) {
          _logger.i('Tracking WebSocket connected');
          _isConnected = true;
          _isConnecting = false;
          _resubscribeAllActiveBookings();
          if (!(_connectionCompleter?.isCompleted ?? true)) {
            _connectionCompleter?.complete();
          }
        },
        onDisconnect: (frame) {
          _logger.w('Tracking WebSocket disconnected');
          _isConnected = false;
          _isConnecting = false;
          // Force re-subscribe after reconnect (STOMP subscriptions do not persist)
          _subscriptions.clear();
        },
        onWebSocketError: (error) {
          _logger.e('WebSocket error: $error');
          _isConnected = false;
          _isConnecting = false;
          // Force re-subscribe after reconnect (STOMP subscriptions do not persist)
          _subscriptions.clear();
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

  Future<void> subscribeToTracking(
      String bookingId, TrackingHandler handler) async {
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
        final destination = '/topic/booking.$bookingId.location';
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
  /// Sends to /app/tracking.update which matches backend @MessageMapping("/tracking.update")
  Future<void> updateLocation(String bookingId, double lat, double lng,
      {String? status}) async {
    try {
      if (!_isConnected) {
        _logger.w(
            'WebSocket not connected, attempting auto-connect before sending location...');
        await connect();
      }

      if (!_isConnected || _client == null) {
        _logger.e(
            'Cannot send location: WebSocket still not connected after auto-connect');
        return;
      }

      _client!.send(
        destination: '/app/tracking.update',
        body: jsonEncode({
          'bookingId': bookingId,
          'latitude': lat,
          'longitude': lng,
        }),
      );
      _logger.d('Location sent: booking=$bookingId, lat=$lat, lng=$lng');
    } catch (e) {
      _logger.e('Error sending location update: $e');
    }
  }
}

final trackingWebsocket = TrackingWebsocketService.instance;

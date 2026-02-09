import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import 'package:logger/logger.dart';
import '../../config/env/environment.dart';
import 'api_client.dart';

/// SOS Matching status update from server
class SosMatchingStatus {
  final String bookingId;
  final String status;
  final String? clinicId;
  final String? clinicName;
  final String? clinicPhone;
  final String? clinicAddress;
  final double? clinicLat;
  final double? clinicLng;
  final double? distance;
  final String? message;
  final int? currentClinicIndex;
  final int? totalClinics;

  SosMatchingStatus({
    required this.bookingId,
    required this.status,
    this.clinicId,
    this.clinicName,
    this.clinicPhone,
    this.clinicAddress,
    this.clinicLat,
    this.clinicLng,
    this.distance,
    this.message,
    this.currentClinicIndex,
    this.totalClinics,
  });

  factory SosMatchingStatus.fromJson(Map<String, dynamic> json) {
    return SosMatchingStatus(
      bookingId: json['bookingId'] ?? '',
      status: json['status'] ?? 'SEARCHING',
      clinicId: json['clinicId'],
      clinicName: json['clinicName'],
      clinicPhone: json['clinicPhone'],
      clinicAddress: json['clinicAddress'],
      clinicLat: (json['clinicLat'] as num?)?.toDouble(),
      clinicLng: (json['clinicLng'] as num?)?.toDouble(),
      distance: (json['distance'] as num?)?.toDouble(),
      message: json['message'],
      currentClinicIndex: json['currentClinicIndex'] as int?,
      totalClinics: json['totalClinics'] as int?,
    );
  }

  bool get isSearching => status == 'SEARCHING';
  bool get isPendingConfirm => status == 'PENDING_CLINIC_CONFIRM';
  bool get isConfirmed => status == 'CONFIRMED';
  bool get isCancelled => status == 'CANCELLED' || status == 'NO_CLINIC';
}

/// SOS Match Request DTO
class SosMatchRequest {
  final String petId;
  final double latitude;
  final double longitude;
  final String? symptoms;

  SosMatchRequest({
    required this.petId,
    required this.latitude,
    required this.longitude,
    this.symptoms,
  });

  Map<String, dynamic> toJson() => {
        'petId': petId,
        'latitude': latitude,
        'longitude': longitude,
        'symptoms': symptoms,
      };
}

/// SOS Match Response DTO
class SosMatchResponse {
  final String bookingId;
  final String status;
  final String? clinicId;
  final String? clinicName;
  final String? wsTopicUrl;
  final String? message;
  final String? petId;
  final String? petName;

  SosMatchResponse({
    required this.bookingId,
    required this.status,
    this.clinicId,
    this.clinicName,
    this.wsTopicUrl,
    this.message,
    this.petId,
    this.petName,
  });

  factory SosMatchResponse.fromJson(Map<String, dynamic> json) {
    return SosMatchResponse(
      bookingId: json['bookingId'] ?? '',
      status: json['status'] ?? 'SEARCHING',
      clinicId: json['clinicId'],
      clinicName: json['clinicName'],
      wsTopicUrl: json['wsTopicUrl'],
      message: json['message'],
      petId: json['petId'],
      petName: json['petName'],
    );
  }
}

/// Handler for SOS matching updates
typedef SosMatchingHandler = void Function(SosMatchingStatus status);

/// Service for SOS Auto-Match functionality
/// Handles REST API calls and WebSocket subscriptions
class SosMatchingService extends ChangeNotifier {
  static SosMatchingService? _instance;
  static SosMatchingService get instance =>
      _instance ??= SosMatchingService._internal();

  final Logger _logger = Logger();
  final ApiClient _apiClient = ApiClient();
  StompClient? _client;
  String? _accessToken;

  // Subscription management
  final Map<String, StompUnsubscribe?> _subscriptions = {};
  final Map<String, Set<SosMatchingHandler>> _handlers = {};

  // Connection state
  bool _isConnected = false;
  bool _isConnecting = false;

  // Current matching state
  SosMatchingStatus? _currentStatus;
  String? _currentBookingId;
  bool _isLoading = false;
  String? _error;

  SosMatchingService._internal();

  // Getters
  SosMatchingStatus? get currentStatus => _currentStatus;
  String? get currentBookingId => _currentBookingId;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isConnected => _isConnected;

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

  /// Check if user has an active SOS booking
  /// Returns active booking info or null if none exists
  Future<SosMatchResponse?> getActiveSosBooking() async {
    try {
      final response = await _apiClient.get('/sos/active');
      if (response.statusCode == 200) {
        return SosMatchResponse.fromJson(response.data);
      }
      // 204 No Content - no active booking
      return null;
    } catch (e) {
      _logger.e('Error checking active SOS booking: $e');
      return null;
    }
  }

  /// Start SOS matching process
  /// First checks if there's an active booking, then creates new if not
  Future<SosMatchResponse?> startMatching(SosMatchRequest request) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for existing active SOS booking first
      final activeBooking = await getActiveSosBooking();
      if (activeBooking != null) {
        _logger.w('User already has active SOS booking: ${activeBooking.bookingId}');
        _currentBookingId = activeBooking.bookingId;
        _currentStatus = SosMatchingStatus(
          bookingId: activeBooking.bookingId,
          status: activeBooking.status,
          clinicId: activeBooking.clinicId,
          clinicName: activeBooking.clinicName,
        );
        _error = 'Bạn đã có yêu cầu SOS đang hoạt động';
        _isLoading = false;
        notifyListeners();
        return activeBooking;
      }

      final response = await _apiClient.post(
        '/sos/match',
        data: request.toJson(),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final result = SosMatchResponse.fromJson(response.data);
        _currentBookingId = result.bookingId;
        _currentStatus = SosMatchingStatus(
          bookingId: result.bookingId,
          status: result.status,
          clinicId: result.clinicId,
          clinicName: result.clinicName,
        );

        // Subscribe to WebSocket updates
        if (result.wsTopicUrl != null) {
          await subscribeToMatching(result.bookingId, (status) {
            _currentStatus = status;
            notifyListeners();
          });
        }

        _isLoading = false;
        notifyListeners();
        return result;
      }
    } catch (e) {
      _logger.e('Error starting SOS match: $e');
      _error = 'Không thể kết nối. Vui lòng thử lại.';
      _isLoading = false;
      notifyListeners();
    }
    return null;
  }

  /// Cancel SOS matching
  Future<bool> cancelMatching(String bookingId) async {
    try {
      _logger.d('Cancelling SOS booking: $bookingId');
      final response = await _apiClient.delete('/sos/$bookingId');
      _logger.d('Cancel response status: ${response.statusCode}');
      if (response.statusCode == 204 || response.statusCode == 200) {
        unsubscribeFromMatching(bookingId);
        _currentStatus = null;
        _currentBookingId = null;
        notifyListeners();
        return true;
      }
      _logger.w('Cancel failed with status: ${response.statusCode}');
    } catch (e) {
      _logger.e('Error cancelling SOS match: $e');
    }
    return false;
  }

  /// Get current matching status
  Future<SosMatchingStatus?> getMatchingStatus(String bookingId) async {
    try {
      final response = await _apiClient.get('/sos/$bookingId/status');
      if (response.statusCode == 200) {
        return SosMatchingStatus.fromJson(response.data);
      }
    } catch (e) {
      _logger.e('Error getting SOS status: $e');
    }
    return null;
  }

  /// Connect to WebSocket
  Future<void> connect() async {
    if (_isConnected || _isConnecting) return;
    if (_accessToken == null) return;

    _isConnecting = true;
    _client = StompClient(
      config: StompConfig(
        url: _wsUrl,
        stompConnectHeaders: {'Authorization': 'Bearer $_accessToken'},
        webSocketConnectHeaders: {'Authorization': 'Bearer $_accessToken'},
        onConnect: (frame) {
          _logger.i('SOS Matching WebSocket connected');
          _isConnected = true;
          _isConnecting = false;
        },
        onDisconnect: (frame) {
          _logger.w('SOS Matching WebSocket disconnected');
          _isConnected = false;
          _isConnecting = false;
        },
        onStompError: (frame) {
          _logger.e('STOMP error: ${frame.body}');
        },
        reconnectDelay: const Duration(seconds: 5),
      ),
    );
    _client!.activate();
  }

  /// Disconnect from WebSocket
  void disconnect() {
    for (final unsubscribe in _subscriptions.values) {
      unsubscribe?.call();
    }
    _subscriptions.clear();
    _handlers.clear();
    _client?.deactivate();
    _isConnected = false;
  }

  /// Subscribe to SOS matching updates
  Future<void> subscribeToMatching(
      String bookingId, SosMatchingHandler handler) async {
    if (!_isConnected) {
      await connect();
      // Wait for connection
      await Future.delayed(const Duration(seconds: 1));
    }

    if (!_handlers.containsKey(bookingId)) {
      _handlers[bookingId] = {};
    }
    _handlers[bookingId]!.add(handler);

    if (!_subscriptions.containsKey(bookingId)) {
      final destination = '/topic/sos-matching/$bookingId';
      _logger.d('Subscribing to $destination');

      final unsubscribe = _client!.subscribe(
        destination: destination,
        callback: (frame) {
          if (frame.body != null) {
            try {
              final json = jsonDecode(frame.body!);
              final status = SosMatchingStatus.fromJson(json);
              _currentStatus = status;
              for (final h in _handlers[bookingId] ?? {}) {
                h(status);
              }
              notifyListeners();
            } catch (e) {
              _logger.e('Error parsing SOS status: $e');
            }
          }
        },
      );
      _subscriptions[bookingId] = unsubscribe;
    }
  }

  /// Unsubscribe from SOS matching updates
  void unsubscribeFromMatching(String bookingId) {
    _subscriptions[bookingId]?.call();
    _subscriptions.remove(bookingId);
    _handlers.remove(bookingId);
  }

  /// Clear current matching state
  void clear() {
    if (_currentBookingId != null) {
      unsubscribeFromMatching(_currentBookingId!);
    }
    _currentStatus = null;
    _currentBookingId = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}

/// Global instance
final sosMatchingService = SosMatchingService.instance;

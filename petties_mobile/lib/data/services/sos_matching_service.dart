import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import 'package:logger/logger.dart';
import '../../config/env/environment.dart';
import 'api_client.dart';

/// SOS Matching status update from server
class SosMatchingStatus {
  final String bookingId;
  final String status;
  final String? event;
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
  final String? staffId;
  final String? staffName;
  final String? staffPhone;
  final String? staffAvatarUrl;
  final int? remainingSeconds;

  SosMatchingStatus({
    required this.bookingId,
    required this.status,
    this.event,
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
    this.staffId,
    this.staffName,
    this.staffPhone,
    this.staffAvatarUrl,
    this.remainingSeconds,
  });

  factory SosMatchingStatus.fromJson(Map<String, dynamic> json) {
    int? parseInt(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value.toString());
    }

    double? parseDouble(dynamic value) {
      if (value == null) return null;
      if (value is num) return value.toDouble();
      return double.tryParse(value.toString());
    }

    return SosMatchingStatus(
      bookingId: json['bookingId']?.toString() ?? '',
      status: json['status']?.toString() ?? 'SEARCHING',
      event: json['event']?.toString(),
      clinicId: json['clinicId'],
      clinicName: json['clinicName'],
      clinicPhone: json['clinicPhone'],
      clinicAddress: json['clinicAddress'],
      clinicLat: parseDouble(json['clinicLat']),
      clinicLng: parseDouble(json['clinicLng']),
      distance: parseDouble(json['distance'] ?? json['distanceKm']),
      message: json['message'],
      currentClinicIndex: parseInt(json['currentClinicIndex']),
      totalClinics:
          parseInt(json['totalClinics'] ?? json['totalClinicsInRange']),
      staffId: json['staffId'],
      staffName: json['staffName'],
      staffPhone: json['staffPhone'],
      staffAvatarUrl: json['staffAvatarUrl'],
      remainingSeconds: parseInt(json['remainingSeconds']),
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
  final String? address;

  SosMatchRequest({
    required this.petId,
    required this.latitude,
    required this.longitude,
    this.symptoms,
    this.address,
  });

  Map<String, dynamic> toJson() => {
        'petId': petId,
        'latitude': latitude,
        'longitude': longitude,
        'symptoms': symptoms,
        'address': address,
      };
}

/// SOS Match Response DTO
class SosMatchResponse {
  final String bookingId;
  final String status;
  final String? clinicId;
  final String? clinicName;
  final String? clinicPhone;
  final String? clinicAddress;
  final double? clinicLat;
  final double? clinicLng;
  final double? distanceKm;
  final int? estimatedMinutes;
  final DateTime? createdAt;
  final DateTime? expiresAt;
  final String? wsTopicUrl;
  final String? message;
  final String? petId;
  final String? petName;
  final String? staffId;
  final String? staffName;
  final String? staffPhone;
  final String? staffAvatarUrl;

  SosMatchResponse({
    required this.bookingId,
    required this.status,
    this.clinicId,
    this.clinicName,
    this.clinicPhone,
    this.clinicAddress,
    this.clinicLat,
    this.clinicLng,
    this.distanceKm,
    this.estimatedMinutes,
    this.createdAt,
    this.expiresAt,
    this.wsTopicUrl,
    this.message,
    this.petId,
    this.petName,
    this.staffId,
    this.staffName,
    this.staffPhone,
    this.staffAvatarUrl,
  });

  factory SosMatchResponse.fromJson(Map<String, dynamic> json) {
    double? parseDouble(dynamic value) {
      if (value == null) return null;
      if (value is num) return value.toDouble();
      return double.tryParse(value.toString());
    }

    int? parseInt(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value.toString());
    }

    return SosMatchResponse(
      bookingId: json['bookingId'] ?? '',
      status: json['status'] ?? 'SEARCHING',
      message: json['message'],
      petId: json['petId'],
      petName: json['petName'],
      wsTopicUrl: json['wsTopicUrl'],
      clinicId: json['clinicId'],
      clinicName: json['clinicName'],
      clinicPhone: json['clinicPhone'],
      clinicAddress: json['clinicAddress'],
      clinicLat: parseDouble(json['clinicLat']),
      clinicLng: parseDouble(json['clinicLng']),
      distanceKm: parseDouble(json['distanceKm'] ?? json['distance']),
      estimatedMinutes: parseInt(json['estimatedMinutes']),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'].toString())
          : null,
      staffId: json['staffId'],
      staffName: json['staffName'],
      staffPhone: json['staffPhone'],
      staffAvatarUrl: json['staffAvatarUrl'],
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
  Completer<void>? _connectCompleter;

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

  /// Get WebSocket URL from Environment (handles port 443 explicitly)
  String get _wsUrl => Environment.wsUrl;

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
        _logger.w(
            'User already has active SOS booking: ${activeBooking.bookingId}');
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

      // Parse error message from server response
      String errorMessage = 'Không thể kết nối. Vui lòng thử lại.';
      if (e is DioException) {
        final responseData = e.response?.data;
        if (responseData is Map<String, dynamic>) {
          // Extract message from server error response
          final serverMessage = responseData['message'] as String?;
          if (serverMessage != null && serverMessage.isNotEmpty) {
            errorMessage = serverMessage;
          }
        }

        // Handle specific status codes
        if (e.response?.statusCode == 409) {
          // Conflict - likely duplicate SOS booking
          errorMessage = responseData?['message'] ??
              'Bạn đã có yêu cầu SOS đang hoạt động. Vui lòng hủy yêu cầu cũ trước.';
        }
      }

      _error = errorMessage;
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
      String errorMsg = e.toString();
      if (e is DioException && e.response?.data is Map) {
        errorMsg = e.response?.data['message'] ?? errorMsg;
      }
      _logger.e('Error cancelling SOS match: $errorMsg');
      _error = errorMsg;
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
    if (_isConnected) return;
    if (_isConnecting) {
      // Wait for existing connection attempt
      await _connectCompleter?.future;
      return;
    }
    if (_accessToken == null) return;

    _isConnecting = true;
    _connectCompleter = Completer<void>();

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
          _logger.i('SOS Matching WebSocket connected');
          _isConnected = true;
          _isConnecting = false;
          if (!_connectCompleter!.isCompleted) {
            _connectCompleter!.complete();
          }
        },
        onDisconnect: (frame) {
          _logger.w('SOS Matching WebSocket disconnected');
          _isConnected = false;
          _isConnecting = false;
        },
        onStompError: (frame) {
          _logger.e('STOMP error: ${frame.body}');
          _isConnecting = false;
          if (_connectCompleter != null && !_connectCompleter!.isCompleted) {
            _connectCompleter!.completeError('STOMP connection error');
          }
        },
        reconnectDelay: const Duration(seconds: 5),
      ),
    );
    _client!.activate();

    // Wait up to 5 seconds for connection
    try {
      await _connectCompleter!.future.timeout(const Duration(seconds: 5));
    } catch (e) {
      _logger.w('WebSocket connect timeout/error: $e');
    }
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
    }

    if (!_handlers.containsKey(bookingId)) {
      _handlers[bookingId] = {};
    }
    _handlers[bookingId]!.add(handler);

    if (_isConnected &&
        _client != null &&
        !_subscriptions.containsKey(bookingId)) {
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
    } else {
      _logger.w(
          'WebSocket not connected, will rely on HTTP polling fallback for booking $bookingId');
    }

    // Start HTTP polling fallback to catch status changes even if WebSocket fails
    _startStatusPolling(bookingId);
  }

  /// Unsubscribe from SOS matching updates
  void unsubscribeFromMatching(String bookingId) {
    _subscriptions[bookingId]?.call();
    _subscriptions.remove(bookingId);
    _handlers.remove(bookingId);
  }

  // Active polling timers
  final Map<String, Timer> _pollingTimers = {};

  /// Start HTTP polling fallback to catch CONFIRMED status
  void _startStatusPolling(String bookingId) {
    _pollingTimers[bookingId]?.cancel();
    _pollingTimers[bookingId] =
        Timer.periodic(const Duration(seconds: 5), (timer) async {
      try {
        final status = await getMatchingStatus(bookingId);
        if (status != null) {
          final hasChanged = _currentStatus?.status != status.status ||
              _currentStatus?.event != status.event ||
              _currentStatus?.clinicId != status.clinicId ||
              _currentStatus?.message != status.message ||
              _currentStatus?.currentClinicIndex != status.currentClinicIndex ||
              _currentStatus?.totalClinics != status.totalClinics ||
              _currentStatus?.remainingSeconds != status.remainingSeconds;

          if (hasChanged) {
            _logger.i('Polling detected status change: ${status.status}');
            _currentStatus = status;
            for (final h in _handlers[bookingId] ?? {}) {
              h(status);
            }
            notifyListeners();
          }
          // Stop polling once confirmed, in-progress, completed, or cancelled
          if (status.isConfirmed ||
              status.isCancelled ||
              status.status == 'IN_PROGRESS' ||
              status.status == 'COMPLETED') {
            timer.cancel();
            _pollingTimers.remove(bookingId);
          }
        }
      } catch (e) {
        _logger.e('Polling error: $e');
      }
    });
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
    // Cancel all polling timers
    for (final timer in _pollingTimers.values) {
      timer.cancel();
    }
    _pollingTimers.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    for (final timer in _pollingTimers.values) {
      timer.cancel();
    }
    _pollingTimers.clear();
    disconnect();
    super.dispose();
  }
}

/// Global instance
final sosMatchingService = SosMatchingService.instance;

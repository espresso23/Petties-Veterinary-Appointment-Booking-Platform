import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/io.dart';

import '../../config/constants/app_constants.dart';
import '../../config/env/environment.dart';
import '../../utils/storage_service.dart';
import '../models/ai_chat.dart';

const String _wsReasonAuthRequired = 'CHAT_AUTH_REQUIRED';
const String _wsReasonInvalidAuth = 'CHAT_INVALID_AUTH';
const String _wsReasonSessionForbidden = 'CHAT_SESSION_FORBIDDEN';
const String _wsReasonPlaygroundForbidden = 'CHAT_PLAYGROUND_FORBIDDEN';

enum AiChatErrorType {
  unauthorized,
  forbidden,
  sessionNotFound,
  endpointNotFound,
  network,
  unknown,
}

enum AiFeedbackType {
  thumbsUp,
  thumbsDown,
}

class AiChatException implements Exception {
  final AiChatErrorType type;
  final String message;

  const AiChatException({
    required this.type,
    required this.message,
  });

  factory AiChatException.fromDio(DioException error) {
    final statusCode = error.response?.statusCode;
    final responseData = error.response?.data;
    final detail = responseData is Map<String, dynamic>
        ? responseData['detail']?.toString() ?? responseData['message']?.toString()
        : null;

    if (statusCode == 401) {
      return const AiChatException(
        type: AiChatErrorType.unauthorized,
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để dùng trợ lý AI.',
      );
    }

    if (statusCode == 403) {
      return AiChatException(
        type: AiChatErrorType.forbidden,
        message: detail == 'Bạn không có quyền truy cập session này'
            ? 'Phiên chat AI này không thuộc về bạn. Hệ thống sẽ tạo phiên mới.'
            : 'Bạn không có quyền truy cập trợ lý AI ở ngữ cảnh hiện tại.',
      );
    }

    if (statusCode == 404) {
      if (detail == 'Not Found' || detail == '404 Not Found') {
        return const AiChatException(
          type: AiChatErrorType.endpointNotFound,
          message:
              'Không tìm thấy API trợ lý AI. Vui lòng kiểm tra cấu hình AI service.',
        );
      }

      return const AiChatException(
        type: AiChatErrorType.sessionNotFound,
        message: 'Không tìm thấy phiên chat AI. Hệ thống sẽ tạo lại phiên mới.',
      );
    }

    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const AiChatException(
        type: AiChatErrorType.network,
        message: 'Không kết nối được tới AI service. Vui lòng thử lại sau.',
      );
    }

    return AiChatException(
      type: AiChatErrorType.unknown,
      message: detail ?? 'Trợ lý AI đang tạm thời gặp sự cố.',
    );
  }

  factory AiChatException.fromWebSocket({
    int? closeCode,
    String? closeReason,
  }) {
    final reason = (closeReason ?? '').trim();

    if (reason == _wsReasonAuthRequired ||
        reason == _wsReasonInvalidAuth ||
        reason.contains('Authentication required') ||
        reason.contains('Invalid authentication')) {
      return const AiChatException(
        type: AiChatErrorType.unauthorized,
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục dùng trợ lý AI.',
      );
    }

    if (reason == _wsReasonSessionForbidden || reason.contains('Session does not belong')) {
      return const AiChatException(
        type: AiChatErrorType.forbidden,
        message: 'Phiên chat AI hiện tại không hợp lệ với tài khoản của bạn.',
      );
    }

    if (reason == _wsReasonPlaygroundForbidden) {
      return const AiChatException(
        type: AiChatErrorType.forbidden,
        message: 'Bạn không có quyền truy cập trợ lý AI ở ngữ cảnh hiện tại.',
      );
    }

    if (closeCode == 1008) {
      return AiChatException(
        type: AiChatErrorType.forbidden,
        message: reason.isNotEmpty
            ? reason
            : 'Kết nối AI chat bị từ chối do quyền truy cập không hợp lệ.',
      );
    }

    return const AiChatException(
      type: AiChatErrorType.network,
      message: 'Kết nối trợ lý AI bị gián đoạn. Vui lòng thử lại.',
    );
  }
}

class AiChatService {
  AiChatService({StorageService? storage}) : _storage = storage ?? StorageService();

  static const String _contextType = 'BUSINESS_CHAT';
  static const String _lastSessionKey = 'ai_chat_last_session_id';

  final StorageService _storage;

  String _normalizeServiceRoot(String rawUrl) {
    final trimmed = rawUrl.trim().replaceFirst(RegExp(r'/+$'), '');
    return trimmed.replaceFirst(RegExp(r'/(api(?:/v1)?)$'), '');
  }

  String get _rootUrl {
    return _normalizeServiceRoot(Environment.aiServiceUrl);
  }

  String get _apiBaseUrl => '$_rootUrl/api/v1';

  Dio _buildDio(String token) {
    debugPrint('[AiChat] REST baseUrl=$_apiBaseUrl (root=$_rootUrl, raw=${Environment.aiServiceUrl})');
    return Dio(
      BaseOptions(
        baseUrl: _apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ),
    );
  }

  Future<String> _requireToken() async {
    final token = await _storage.getString(AppConstants.accessTokenKey);
    if (token == null || token.isEmpty) {
      throw Exception('Bạn chưa đăng nhập để dùng trợ lý AI');
    }
    return token;
  }

  Future<AiChatSession> getOrCreateSession() async {
    final token = await _requireToken();
    final dio = _buildDio(token);
    final storedSessionId = await _storage.getString(_lastSessionKey);

    if (storedSessionId != null && storedSessionId.isNotEmpty) {
      try {
        final session = await getSession(storedSessionId);
        if (session.sessionId.isNotEmpty) {
          return session;
        }
      } on AiChatException catch (error) {
        if (error.type == AiChatErrorType.sessionNotFound ||
            error.type == AiChatErrorType.forbidden) {
          await clearStoredSession();
        } else {
          rethrow;
        }
      }
    }

    Response sessionsResponse;
    try {
      sessionsResponse = await dio.get(
        '/chat/sessions',
        queryParameters: {
          'limit': 1,
          'context_type': _contextType,
        },
      );
    } on DioException catch (error) {
      throw AiChatException.fromDio(error);
    }

    final sessions = (sessionsResponse.data['sessions'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(AiChatSession.fromJson)
        .toList();

    if (sessions.isNotEmpty) {
      for (final session in sessions) {
        if (session.sessionId.isEmpty) {
          continue;
        }

        await _storage.setString(_lastSessionKey, session.sessionId);

        try {
          return await getSession(session.sessionId);
        } on AiChatException catch (error) {
          if (error.type == AiChatErrorType.sessionNotFound ||
              error.type == AiChatErrorType.forbidden) {
            await clearStoredSession();
            continue;
          }
          rethrow;
        }
      }
    }

    return createSession();
  }

  Future<AiChatSession> createSession() async {
    final token = await _requireToken();
    final dio = _buildDio(token);
    Response response;
    try {
      response = await dio.post(
        '/chat/sessions',
        data: {
          'title': 'Trợ lý AI',
          'context_type': _contextType,
        },
      );
    } on DioException catch (error) {
      throw AiChatException.fromDio(error);
    }

    final sessionId = response.data['session_id']?.toString() ?? '';
    if (sessionId.isEmpty) {
      throw Exception('Không tạo được phiên chat AI');
    }

    await _storage.setString(_lastSessionKey, sessionId);
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return AiChatSession(
        sessionId: sessionId,
        title: data['title']?.toString() ?? 'Trợ lý AI',
        contextType: data['context_type']?.toString() ?? _contextType,
        createdAt: data['created_at'] != null
            ? DateTime.tryParse(data['created_at'].toString())
            : null,
        messages: const [],
      );
    }

    return AiChatSession(
      sessionId: sessionId,
      title: 'Trợ lý AI',
      contextType: _contextType,
      messages: const [],
    );
  }

  Future<AiChatSession> createFreshSession() async {
    await clearStoredSession();
    return createSession();
  }

  Future<List<AiChatSession>> listSessions({int limit = 20}) async {
    final token = await _requireToken();
    final dio = _buildDio(token);
    Response response;
    try {
      response = await dio.get(
        '/chat/sessions',
        queryParameters: {
          'limit': limit,
          'context_type': _contextType,
        },
      );
    } on DioException catch (error) {
      throw AiChatException.fromDio(error);
    }

    final rawSessions =
        (response.data['sessions'] as List<dynamic>? ?? const []);

    return rawSessions
        .whereType<Map<String, dynamic>>()
        .map(AiChatSession.fromJson)
        .where((session) => session.sessionId.isNotEmpty)
        .toList();
  }

  Future<AiChatSession> getSession(String sessionId) async {
    final token = await _requireToken();
    final dio = _buildDio(token);
    Response response;
    try {
      response = await dio.get('/chat/sessions/$sessionId');
    } on DioException catch (error) {
      throw AiChatException.fromDio(error);
    }
    final session = AiChatSession.fromJson(response.data as Map<String, dynamic>);
    if (session.sessionId.isNotEmpty) {
      await _storage.setString(_lastSessionKey, session.sessionId);
    }
    return session;
  }

  Future<void> clearStoredSession() async {
    await _storage.remove(_lastSessionKey);
  }

  Future<void> deleteSession(String sessionId) async {
    final token = await _requireToken();
    final dio = _buildDio(token);

    try {
      await dio.delete('/chat/sessions/$sessionId');
    } on DioException catch (error) {
      throw AiChatException.fromDio(error);
    }

    final storedSessionId = await _storage.getString(_lastSessionKey);
    if (storedSessionId == sessionId) {
      await clearStoredSession();
    }
  }

  Future<void> sendFeedback({
    required String messageId,
    required String sessionId,
    required AiFeedbackType type,
    String? feedbackText,
  }) async {
    final token = await _requireToken();
    final dio = _buildDio(token);

    final feedbackType = switch (type) {
      AiFeedbackType.thumbsUp => 'thumbs_up',
      AiFeedbackType.thumbsDown => 'thumbs_down',
    };

    final Map<String, dynamic> payload = {
      'message_id': messageId,
      'session_id': sessionId,
      'feedback_type': feedbackType,
    };

    if (feedbackText != null && feedbackText.trim().isNotEmpty) {
      payload['feedback_text'] = feedbackText.trim();
    }

    try {
      await dio.post('/chat/feedback', data: payload);
    } on DioException catch (error) {
      throw AiChatException.fromDio(error);
    }
  }

  Future<IOWebSocketChannel> connectToSession(String sessionId) async {
    final token = await _requireToken();
    final wsBase = _rootUrl.startsWith('https://')
        ? _rootUrl.replaceFirst('https://', 'wss://')
        : _rootUrl.replaceFirst('http://', 'ws://');

    final uri = Uri.parse(
      '$wsBase/ws/chat/$sessionId?token=${Uri.encodeComponent(token)}&context_type=$_contextType',
    );
    debugPrint('[AiChat] WebSocket uri=$uri');

    try {
      return IOWebSocketChannel.connect(
        uri,
        pingInterval: const Duration(seconds: 20),
        connectTimeout: const Duration(seconds: 15),
      );
    } catch (_) {
      throw const AiChatException(
        type: AiChatErrorType.network,
        message: 'Không thể mở kết nối realtime tới trợ lý AI.',
      );
    }
  }

  String encodeOutgoingPayload({
    String? message,
    Map<String, dynamic>? uiAction,
    Map<String, dynamic>? location,
    List<String>? images,
  }) {
    final payload = <String, dynamic>{};
    if (message != null) {
      payload['message'] = message;
    }
    if (uiAction != null) {
      payload['ui_action'] = uiAction;
    }
    if (location != null) {
      payload['location'] = location;
    }
    if (images != null && images.isNotEmpty) {
      payload['images'] = images;
    }
    return jsonEncode(payload);
  }

  String encodeOutgoingMessage(String message) {
    return encodeOutgoingPayload(message: message);
  }

  AiChatSocketEvent parseSocketEvent(dynamic payload) {
    try {
      if (payload is String) {
        final decoded = jsonDecode(payload);
        if (decoded is Map<String, dynamic>) {
          return AiChatSocketEvent.fromJson(decoded);
        }
      }

      if (payload is Map<String, dynamic>) {
        return AiChatSocketEvent.fromJson(payload);
      }
    } catch (_) {
      return const AiChatSocketEvent(
        type: AiChatSocketEventType.error,
        error: 'Không đọc được dữ liệu phản hồi từ trợ lý AI',
      );
    }

    return const AiChatSocketEvent(
      type: AiChatSocketEventType.unknown,
      error: 'Không đọc được dữ liệu từ trợ lý AI',
    );
  }
}


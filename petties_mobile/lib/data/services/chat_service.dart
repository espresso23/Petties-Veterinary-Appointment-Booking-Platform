import 'dart:io';
import 'package:dio/dio.dart';
import '../models/chat.dart';
import 'api_client.dart';

/// Chat Service - API client for chat operations
class ChatService {
  final ApiClient _apiClient = ApiClient.instance;

  Future<ChatConversation> createOrGetConversation(String clinicId) async {
    final response = await _apiClient.post(
      '/chat/conversations',
      data: {'clinicId': clinicId},
    );
    return ChatConversation.fromJson(response.data);
  }

  /// Lấy danh sách conversations của user
  Future<List<ChatConversation>> getConversations() async {
    final response = await _apiClient.get('/chat/conversations');
    final data = response.data;
    
    // DEBUG LOGGING
    print('DEBUG: getConversations Raw Data Type: ${data.runtimeType}');
    if (data is Map && data.containsKey('content')) {
      final list = data['content'] as List;
      if (list.isNotEmpty) {
        print('DEBUG: First Item clinicLogo: ${list[0]['clinicLogo']}');
        print('DEBUG: First Item clinic_logo: ${list[0]['clinic_logo']}');
      }
    }

    List<dynamic> conversations;

    if (data is Map && data.containsKey('content')) {
      conversations = data['content'] ?? [];
    } else if (data is List) {
      conversations = data;
    } else {
      conversations = [];
    }

    return conversations
        .map((json) => ChatConversation.fromJson(json))
        .toList();
  }

  Future<ChatConversation> getConversation(String conversationId) async {
    final response =
        await _apiClient.get('/chat/conversations/$conversationId');
    final data = response.data;
    
    // DEBUG SINGULAR
    print('DEBUG: Single Conv Raw: $data');
    if (data is Map) {
       print('DEBUG: Single Conv clinicLogo: ${data['clinicLogo']}');
       print('DEBUG: Single Conv clinic_logo: ${data['clinic_logo']}');
       print('DEBUG: Single Conv clinicId: ${data['clinicId']}');
    }

    return ChatConversation.fromJson(response.data);
  }

  /// Lấy tin nhắn trong conversation
  Future<List<ChatMessage>> getMessages(
    String conversationId, {
    int page = 0,
    int size = 50,
  }) async {
    final response = await _apiClient.get(
      '/chat/conversations/$conversationId/messages',
      queryParameters: {'page': page, 'size': size},
    );

    // Handle paginated response
    final data = response.data;
    List<dynamic> messages;

    if (data is Map && data.containsKey('content')) {
      messages = data['content'] ?? [];
    } else if (data is List) {
      messages = data;
    } else {
      messages = [];
    }

    return messages.map((json) => ChatMessage.fromJson(json)).toList();
  }

  /// Gửi tin nhắn
  Future<ChatMessage> sendMessage(String conversationId, String content, {String? imageUrl, File? imageFile}) async {
    print('DEBUG: ChatService.sendMessage called with content: "$content", imageUrl: $imageUrl, imageFile: ${imageFile?.path}');
    
    if (imageFile != null) {
      // Send as multipart form data
      final formData = FormData.fromMap({
        'content': content,
        'file': await MultipartFile.fromFile(imageFile.path),
      });

      final response = await _apiClient.post(
        '/chat/conversations/$conversationId/messages',
        data: formData,
      );
      print('DEBUG: ChatService.sendMessage multipart response: ${response.data}');
      return ChatMessage.fromJson(response.data);
    } else {
      // Send as JSON
      final data = {'content': content};
      if (imageUrl != null) {
        data['imageUrl'] = imageUrl;
      }

      final response = await _apiClient.post(
        '/chat/conversations/$conversationId/messages',
        data: data,
      );
      print('DEBUG: ChatService.sendMessage JSON response: ${response.data}');
      return ChatMessage.fromJson(response.data);
    }
  }

  /// Gửi hình ảnh
  Future<ChatMessage> uploadImage(String conversationId, File imageFile) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(imageFile.path),
    });

    final response = await _apiClient.post(
      '/chat/conversations/$conversationId/images',
      data: formData,
    );

    // Debug: In ra response data
    print('Upload image response: ${response.data}');

    // API trả về MessageResponse
    return ChatMessage.fromJson(response.data);
  }

  /// Đánh dấu đã đọc tin nhắn
  Future<void> markAsRead(String conversationId) async {
    await _apiClient.put('/chat/conversations/$conversationId/read');
  }

  /// Lấy số tin nhắn chưa đọc
  Future<int> getUnreadCount() async {
    final response = await _apiClient.get('/chat/unread-count');
    return response.data['totalUnreadConversations'] ??
        response.data['count'] ??
        0;
  }

  // ======================== BACKWARD COMPATIBILITY ========================
  // Deprecated: Use methods with Conversation naming instead

  @Deprecated('Use createOrGetConversation instead')
  Future<ChatConversation> createOrGetChatBox(String clinicId) =>
      createOrGetConversation(clinicId);

  @Deprecated('Use getConversations instead')
  Future<List<ChatConversation>> getChatBoxes() => getConversations();

  @Deprecated('Use getConversation instead')
  Future<ChatConversation> getChatBox(String id) => getConversation(id);
}

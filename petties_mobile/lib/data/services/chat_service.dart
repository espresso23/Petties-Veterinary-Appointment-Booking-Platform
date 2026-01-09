import '../models/chat.dart';
import 'api_client.dart';

/// Chat Service - API client for chat operations
class ChatService {
  final ApiClient _apiClient = ApiClient.instance;

  /// Tạo hoặc lấy chat box với clinic
  Future<ChatBox> createOrGetChatBox(String clinicId) async {
    final response = await _apiClient.post(
      '/chat/chat-boxes',
      data: {'clinicId': clinicId},
    );
    return ChatBox.fromJson(response.data);
  }

  /// Lấy danh sách chat boxes của user
  Future<List<ChatBox>> getChatBoxes() async {
    final response = await _apiClient.get('/chat/chat-boxes');
    final data = response.data;
    List<dynamic> chatBoxes;

    if (data is Map && data.containsKey('content')) {
      chatBoxes = data['content'] ?? [];
    } else if (data is List) {
      chatBoxes = data;
    } else {
      chatBoxes = [];
    }

    return chatBoxes.map((json) => ChatBox.fromJson(json)).toList();
  }

  /// Lấy chi tiết chat box
  Future<ChatBox> getChatBox(String chatBoxId) async {
    final response = await _apiClient.get('/chat/chat-boxes/$chatBoxId');
    return ChatBox.fromJson(response.data);
  }

  /// Lấy tin nhắn trong chat box
  Future<List<ChatMessage>> getMessages(
    String chatBoxId, {
    int page = 0,
    int size = 50,
  }) async {
    final response = await _apiClient.get(
      '/chat/chat-boxes/$chatBoxId/messages',
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
  Future<ChatMessage> sendMessage(String chatBoxId, String content) async {
    final response = await _apiClient.post(
      '/chat/chat-boxes/$chatBoxId/messages',
      data: {'content': content},
    );
    return ChatMessage.fromJson(response.data);
  }

  /// Đánh dấu đã đọc tin nhắn
  Future<void> markAsRead(String chatBoxId) async {
    await _apiClient.put('/chat/chat-boxes/$chatBoxId/read');
  }

  /// Lấy số tin nhắn chưa đọc
  Future<int> getUnreadCount() async {
    final response = await _apiClient.get('/chat/unread-count');
    return response.data['count'] ?? 0;
  }
}

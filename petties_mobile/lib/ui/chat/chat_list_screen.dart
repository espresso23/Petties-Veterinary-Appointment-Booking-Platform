import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import '../../data/models/chat.dart';
import '../../data/services/chat_service.dart';
import '../../data/services/chat_websocket_service.dart';
import '../../routing/app_routes.dart';
import 'widgets/chat_conversation_item.dart';

/// Màn hình danh sách tin nhắn - Pet Owner
class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final ChatService _chatService = ChatService();
  final TextEditingController _searchController = TextEditingController();

  List<ChatConversation> _conversations = [];
  List<ChatConversation> _filteredConversations = [];
  bool _isLoading = true;
  String? _error;

  // Track subscribed conversation IDs for cleanup
  final Set<String> _subscribedIds = {};

  @override
  void initState() {
    super.initState();
    _fetchConversations();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _unsubscribeAll();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  /// Subscribe to all conversations for realtime updates
  Future<void> _subscribeToConversations() async {
    debugPrint('📱 [ChatList] Starting WebSocket subscription...');

    // Get access token from storage
    final prefs = await SharedPreferences.getInstance();
    final accessToken = prefs.getString(AppConstants.accessTokenKey);

    if (accessToken == null || accessToken.isEmpty) {
      debugPrint('📱 [ChatList] No access token available');
      return;
    }

    // Set access token and connect WebSocket
    chatWebSocket.setAccessToken(accessToken);

    try {
      await chatWebSocket.connect();
      debugPrint('📱 [ChatList] WebSocket connected successfully');
    } catch (e) {
      debugPrint('📱 [ChatList] WebSocket connect error: $e');
      return;
    }

    // Subscribe to each conversation
    for (final conversation in _conversations) {
      if (!_subscribedIds.contains(conversation.id)) {
        chatWebSocket.subscribeToChatBox(
            conversation.id, _handleWebSocketMessage);
        _subscribedIds.add(conversation.id);
        debugPrint('📱 [ChatList] Subscribed to: ${conversation.id}');
      }
    }
    debugPrint('📱 [ChatList] Total subscribed: ${_subscribedIds.length}');
  }

  /// Unsubscribe from all conversations
  void _unsubscribeAll() {
    for (final id in _subscribedIds) {
      chatWebSocket.unsubscribeFromChatBox(id, _handleWebSocketMessage);
    }
    _subscribedIds.clear();
  }

  /// Handle incoming WebSocket messages
  void _handleWebSocketMessage(ChatWebSocketMessage wsMessage) {
    debugPrint(
        '📱 [ChatList] Received message: type=${wsMessage.type}, conversationId=${wsMessage.conversationId}');

    if (wsMessage.type == WsMessageType.message && wsMessage.message != null) {
      debugPrint(
          '📱 [ChatList] Processing MESSAGE: ${wsMessage.message!.content}');
      // Update the conversation in the list
      setState(() {
        final index =
            _conversations.indexWhere((c) => c.id == wsMessage.conversationId);
        debugPrint('📱 [ChatList] Found conversation at index: $index');
        if (index != -1) {
          final conversation = _conversations[index];
          final msg = wsMessage.message!;
          // Update last message and increment unread count
          _conversations[index] = conversation.copyWith(
            lastMessage: msg.content,
            lastMessageSender: msg.senderType.value,
            lastMessageAt: msg.createdAt,
            // Increment unread if message is from CLINIC (partner for PET_OWNER)
            unreadCount: msg.senderType == SenderType.clinic
                ? conversation.unreadCount + 1
                : conversation.unreadCount,
          );
          // Re-sort to bring updated conversation to top
          _conversations.sort((a, b) => (b.lastMessageAt ?? DateTime(1970))
              .compareTo(a.lastMessageAt ?? DateTime(1970)));
          _onSearchChanged(); // Update filtered list
          debugPrint('📱 [ChatList] Updated conversation with new message');
        }
      });
    }
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredConversations = _conversations;
      } else {
        _filteredConversations = _conversations
            .where((c) =>
                (c.clinicName?.toLowerCase().contains(query) ?? false) ||
                (c.lastMessage?.toLowerCase().contains(query) ?? false))
            .toList();
      }
    });
  }

  Future<void> _fetchConversations() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final conversations = await _chatService.getConversations();
      setState(() {
        _conversations = conversations;
        _filteredConversations = conversations;
        _isLoading = false;
      });
      // Subscribe to WebSocket after fetching conversations
      _subscribeToConversations();
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách tin nhắn';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.primary,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: AppColors.white),
        onPressed: () => context.pop(),
      ),
      title: const Text(
        'TIN NHẮN',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          letterSpacing: 2,
          color: AppColors.white,
          fontSize: 18,
        ),
      ),
      centerTitle: true,
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: AppColors.white,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.stone100,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
          ],
        ),
        child: TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Tìm kiếm phòng khám...',
            hintStyle: TextStyle(color: AppColors.stone400),
            prefixIcon: const Icon(Icons.search, color: AppColors.stone600),
            border: InputBorder.none,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: AppColors.stone400),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: TextStyle(color: AppColors.stone600, fontSize: 16),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchConversations,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
              ),
              child: const Text('THỬ LẠI'),
            ),
          ],
        ),
      );
    }

    if (_filteredConversations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline,
                size: 80, color: AppColors.stone300),
            const SizedBox(height: 16),
            Text(
              _searchController.text.isEmpty
                  ? 'Chưa có tin nhắn nào'
                  : 'Không tìm thấy kết quả',
              style: TextStyle(
                color: AppColors.stone600,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchController.text.isEmpty
                  ? 'Hãy liên hệ với phòng khám để bắt đầu trò chuyện'
                  : 'Thử tìm kiếm với từ khóa khác',
              style: TextStyle(color: AppColors.stone400, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchConversations,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _filteredConversations.length,
        itemBuilder: (context, index) {
          final conversation = _filteredConversations[index];
          return ChatConversationItem(
            conversation: conversation,
            onTap: () => _openChat(conversation),
          );
        },
      ),
    );
  }

  Future<void> _openChat(ChatConversation conversation) async {
    await context.push(
      '${AppRoutes.chatDetail}?conversationId=${conversation.id}',
    );
    // Refresh conversations when returning from chat detail
    // This updates unread counts and last messages
    _fetchConversations();
  }
}

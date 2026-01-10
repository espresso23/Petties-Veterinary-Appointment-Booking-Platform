import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import '../../data/models/chat.dart';
import '../../data/services/chat_service.dart';
import '../../data/services/chat_websocket_service.dart';
import 'widgets/message_bubble.dart';
import 'widgets/message_input.dart';

/// Màn hình chi tiết chat - Pet Owner
class ChatDetailScreen extends StatefulWidget {
  final String? chatBoxId;
  final String? clinicId;

  const ChatDetailScreen({
    super.key,
    this.chatBoxId,
    this.clinicId,
  });

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final ChatService _chatService = ChatService();
  final ScrollController _scrollController = ScrollController();

  ChatBox? _chatBox;
  List<ChatMessage> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  bool _isPartnerTyping = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initializeChat();
  }

  @override
  void dispose() {
    // Unsubscribe from WebSocket when leaving
    if (_chatBox != null) {
      chatWebSocket.unsubscribeFromChatBox(
          _chatBox!.id, _handleWebSocketMessage);
      chatWebSocket.sendOnlineStatus(_chatBox!.id, false);
    }
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initializeChat() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      ChatBox chatBox;

      if (widget.chatBoxId != null) {
        // Lấy chat box có sẵn
        chatBox = await _chatService.getChatBox(widget.chatBoxId!);
      } else if (widget.clinicId != null) {
        // Tạo mới hoặc lấy chat box với clinic
        chatBox = await _chatService.createOrGetChatBox(widget.clinicId!);
      } else {
        throw Exception('Cần có chatBoxId hoặc clinicId');
      }

      // Load messages
      final messages = await _chatService.getMessages(chatBox.id);

      // Mark as read
      await _chatService.markAsRead(chatBox.id);

      setState(() {
        _chatBox = chatBox;
        _messages = messages.reversed.toList(); // Newest at bottom
        _isLoading = false;
      });

      // Connect WebSocket and subscribe
      _connectAndSubscribe(chatBox.id);

      _scrollToBottom();
    } catch (e) {
      setState(() {
        _error = 'Không thể tải tin nhắn';
        _isLoading = false;
      });
    }
  }

  /// Connect to WebSocket and subscribe to chat box
  Future<void> _connectAndSubscribe(String chatBoxId) async {
    try {
      // Get access token from storage
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString(AppConstants.accessTokenKey);

      if (accessToken != null) {
        chatWebSocket.setAccessToken(accessToken);
        await chatWebSocket.connect();
        chatWebSocket.subscribeToChatBox(chatBoxId, _handleWebSocketMessage);
        chatWebSocket.sendOnlineStatus(chatBoxId, true);
      }
    } catch (e) {
      debugPrint('WebSocket connection failed: $e');
    }
  }

  /// Handle incoming WebSocket messages
  void _handleWebSocketMessage(ChatWebSocketMessage wsMessage) {
    if (!mounted) return;

    switch (wsMessage.type) {
      case WsMessageType.message:
        if (wsMessage.message != null) {
          // Check if message already exists to avoid duplicate
          // This happens because we add message after API response,
          // then receive it again via WebSocket broadcast
          final messageExists =
              _messages.any((m) => m.id == wsMessage.message!.id);
          if (!messageExists) {
            setState(() {
              _messages.add(wsMessage.message!);
            });
            _scrollToBottom();
          }
        }
        break;

      case WsMessageType.typing:
        if (wsMessage.senderType == 'CLINIC') {
          setState(() => _isPartnerTyping = true);
        }
        break;

      case WsMessageType.stopTyping:
        if (wsMessage.senderType == 'CLINIC') {
          setState(() => _isPartnerTyping = false);
        }
        break;

      case WsMessageType.read:
        // Update message status to SEEN
        setState(() {
          _messages = _messages.map((msg) {
            if (msg.senderType == SenderType.petOwner &&
                msg.status != MessageStatus.seen) {
              return msg.copyWith(status: MessageStatus.seen, isRead: true);
            }
            return msg;
          }).toList();
        });
        break;

      case WsMessageType.online:
        if (wsMessage.senderType == 'CLINIC') {
          setState(() {
            _chatBox = _chatBox?.copyWith(isClinicOnline: true);
          });
        }
        break;

      case WsMessageType.offline:
        if (wsMessage.senderType == 'CLINIC') {
          setState(() {
            _chatBox = _chatBox?.copyWith(isClinicOnline: false);
          });
        }
        break;
    }
  }

  Future<void> _sendMessage(String content) async {
    if (_chatBox == null || _isSending) return;

    setState(() => _isSending = true);

    try {
      // Send via REST API - message will be added via WebSocket broadcast
      // DO NOT add message to state here to avoid duplicate
      // WebSocket will broadcast the message back to us
      await _chatService.sendMessage(
        _chatBox!.id,
        content,
      );

      setState(() {
        _isSending = false;
      });
    } catch (e) {
      setState(() => _isSending = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Không thể gửi tin nhắn'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone100,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          Expanded(child: _buildBody()),
          if (_chatBox != null)
            MessageInput(
              onSend: _sendMessage,
              onTyping: (typing) =>
                  chatWebSocket.sendTyping(_chatBox!.id, typing),
              isLoading: _isSending,
            ),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: AppColors.stone900),
        onPressed: () => context.pop(),
      ),
      title: _chatBox != null
          ? Row(
              children: [
                // Avatar
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.stone900, width: 1.5),
                    color: AppColors.stone100,
                  ),
                  child: ClipOval(
                    child: _chatBox!.clinicLogo != null &&
                            _chatBox!.clinicLogo!.isNotEmpty
                        ? Image.network(
                            _chatBox!.clinicLogo!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _buildDefaultAvatar(),
                          )
                        : _buildDefaultAvatar(),
                  ),
                ),
                const SizedBox(width: 10),
                // Name & Status
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _chatBox!.clinicName ?? 'Phòng khám',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone900,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _chatBox!.isClinicOnline
                                  ? AppColors.success
                                  : AppColors.stone400,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _chatBox!.isClinicOnline
                                ? 'Đang hoạt động'
                                : 'Không hoạt động',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.stone500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            )
          : const Text(
              'Đang tải...',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.stone900,
              ),
            ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          color: AppColors.stone200,
          height: 1,
        ),
      ),
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: AppColors.primarySurface,
      child: Center(
        child: Text(
          (_chatBox?.clinicName ?? 'C')[0].toUpperCase(),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
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
              onPressed: _initializeChat,
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

    if (_messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline,
              size: 80,
              color: AppColors.stone300,
            ),
            const SizedBox(height: 16),
            Text(
              'Bắt đầu cuộc trò chuyện',
              style: TextStyle(
                color: AppColors.stone600,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Gửi tin nhắn để liên hệ với phòng khám',
              style: TextStyle(color: AppColors.stone400, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(vertical: 16),
            itemCount: _messages.length,
            itemBuilder: (context, index) {
              final message = _messages[index];
              final prevMessage = index > 0 ? _messages[index - 1] : null;

              // Show avatar if first message or different sender
              final showAvatar = prevMessage == null ||
                  prevMessage.senderType != message.senderType;

              return MessageBubble(
                message: message,
                showAvatar: showAvatar,
              );
            },
          ),
        ),
        // Typing indicator
        if (_isPartnerTyping)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.stone200,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildTypingDot(0),
                      const SizedBox(width: 4),
                      _buildTypingDot(1),
                      const SizedBox(width: 4),
                      _buildTypingDot(2),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Đang nhập...',
                  style: TextStyle(
                    color: AppColors.stone500,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  /// Build animated typing dot with staggered animation
  Widget _buildTypingDot(int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 600 + (index * 200)),
      builder: (context, value, child) {
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.stone500
                .withValues(alpha: 0.4 + (0.6 * (1 - value).abs())),
          ),
        );
      },
      onEnd: () {
        // Trigger rebuild to restart animation
        if (mounted && _isPartnerTyping) {
          setState(() {});
        }
      },
    );
  }
}

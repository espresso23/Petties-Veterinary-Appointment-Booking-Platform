import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import '../../config/constants/app_colors.dart';
import '../../config/constants/app_constants.dart';
import '../../data/models/chat.dart';
import '../../data/services/chat_service.dart';
import '../../data/services/chat_websocket_service.dart';
import 'widgets/message_bubble.dart';
import 'widgets/message_input.dart';
import '../../utils/fcm_service.dart';

/// Màn hình chi tiết chat - Pet Owner
class ChatDetailScreen extends StatefulWidget {
  final String? conversationId;
  final String? clinicId;

  const ChatDetailScreen({
    super.key,
    this.conversationId,
    this.clinicId,
  });

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final ChatService _chatService = ChatService();
  final ScrollController _scrollController = ScrollController();

  ChatConversation? _conversation;
  List<ChatMessage> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  bool _isPartnerTyping = false;
  String? _error;

  // Image gallery pagination
  List<ChatMessage> _galleryImages = [];
  int _galleryPage = 0;
  bool _galleryHasMore = false;
  bool _galleryLoading = false;
  final int _galleryImagesPerPage = 20;

  @override
  void initState() {
    super.initState();
    _initializeChat();
  }

  @override
  void dispose() {
    // Unsubscribe from WebSocket when leaving
    if (_conversation != null) {
      // Stop typing indicator when leaving
      chatWebSocket.sendTyping(_conversation!.id, false);
      chatWebSocket.unsubscribeFromChatBox(
          _conversation!.id, _handleWebSocketMessage);
      chatWebSocket.sendOnlineStatus(_conversation!.id, false);
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
      ChatConversation conversation;

      if (widget.conversationId != null) {
        // Lấy conversation có sẵn
        conversation =
            await _chatService.getConversation(widget.conversationId!);
      } else if (widget.clinicId != null) {
        // Tạo mới hoặc lấy conversation với clinic
        conversation =
            await _chatService.createOrGetConversation(widget.clinicId!);
      } else {
        throw Exception('Cần có conversationId hoặc clinicId');
      }

      // Load messages
      final messages = await _chatService.getMessages(conversation.id);

      // Mark as read
      await _chatService.markAsRead(conversation.id);

      setState(() {
        _conversation = conversation;
        _messages = messages.reversed.toList(); // Newest at bottom
        _isLoading = false;
      });

      // Connect WebSocket and subscribe
      _connectAndSubscribe(conversation.id);

      _scrollToBottom();
    } catch (e) {
      setState(() {
        _error = 'Không thể tải tin nhắn';
        _isLoading = false;
      });
    }
  }

  /// Connect to WebSocket and subscribe to chat box
  Future<void> _connectAndSubscribe(String conversationId) async {
    try {
      // Get access token from storage
      final prefs = await SharedPreferences.getInstance();
      final accessToken = prefs.getString(AppConstants.accessTokenKey);

      if (accessToken != null) {
        chatWebSocket.setAccessToken(accessToken);
        await chatWebSocket.connect();
        chatWebSocket.subscribeToChatBox(
            conversationId, _handleWebSocketMessage);
        chatWebSocket.sendOnlineStatus(conversationId, true);
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

            // Show push notification if app is not in foreground
            _showChatNotification(wsMessage.message!);
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
            _conversation = _conversation?.copyWith(isClinicOnline: true);
          });
        }
        break;

      case WsMessageType.offline:
        if (wsMessage.senderType == 'CLINIC') {
          setState(() {
            _conversation = _conversation?.copyWith(isClinicOnline: false);
          });
        }
        break;
    }
  }

  Future<void> _sendMessage(String content) async {
    if (_conversation == null || _isSending) return;

    setState(() => _isSending = true);

    try {
      // Send via REST API - message will be added via WebSocket broadcast
      // DO NOT add message to state here to avoid duplicate
      // WebSocket will broadcast the message back to us
      await _chatService.sendMessage(
        _conversation!.id,
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

  Future<ChatMessage> _uploadImage(File imageFile) async {
    if (_conversation == null) throw Exception('No conversation');

    setState(() => _isSending = true);

    try {
      // Upload image to server - message will be added via WebSocket broadcast
      // DO NOT add message to state here to avoid duplicate
      // WebSocket will broadcast the message back to us
      final imageMessage = await _chatService.uploadImage(_conversation!.id, imageFile);
      return imageMessage;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Không thể tải lên hình ảnh'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      rethrow;
    } finally {
      setState(() => _isSending = false);
    }
  }

  Future<void> _sendCombinedMessage(String content, File imageFile) async {
    print('DEBUG: _sendCombinedMessage called with content: "$content", imageFile: ${imageFile.path}');
    if (_conversation == null || _isSending) return;

    setState(() => _isSending = true);

    try {
      // Send combined message with text and image file
      print('DEBUG: Calling _chatService.sendMessage with file...');
      await _chatService.sendMessage(
        _conversation!.id,
        content,
        imageFile: imageFile,
      );
      print('DEBUG: _chatService.sendMessage completed');

      setState(() {
        _isSending = false;
      });
    } catch (e) {
      print('DEBUG: _sendCombinedMessage error: $e');
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

  // Get all images from messages
  List<ChatMessage> _getConversationImages() {
    return _messages
        .where((message) =>
            (message.messageType == MessageType.image || message.messageType == MessageType.imageText) &&
            message.imageUrl != null &&
            message.imageUrl!.isNotEmpty)
        .toList()
        .reversed
        .toList(); // Show oldest first
  }

  // ...existing code...

  // Load images for gallery with pagination
  void _loadGalleryImages(int page, {bool append = false}) {
    final allImages = _getConversationImages();
    final startIndex = page * _galleryImagesPerPage;
    final endIndex = startIndex + _galleryImagesPerPage;
    final pageImages = allImages.sublist(
      startIndex,
      endIndex > allImages.length ? allImages.length : endIndex,
    );

    setState(() {
      if (append) {
        _galleryImages.addAll(pageImages);
      } else {
        _galleryImages = pageImages;
      }
      _galleryHasMore = endIndex < allImages.length;
      _galleryPage = page;
    });
  }

  // Handle gallery scroll for infinite loading
  void _handleGalleryScroll(ScrollNotification scrollInfo) {
    if (scrollInfo.metrics.pixels >= scrollInfo.metrics.maxScrollExtent - 100 &&
        _galleryHasMore &&
        !_galleryLoading) {
      setState(() => _galleryLoading = true);

      // Simulate loading delay
      Future.delayed(const Duration(milliseconds: 500), () {
        _loadGalleryImages(_galleryPage + 1, append: true);
        setState(() => _galleryLoading = false);
      });
    }
  }

  void _showImageGallery() {
    // Load first page of images
    _loadGalleryImages(0, append: false);

    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: AppColors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.stone900, width: 2),
        ),
        child: Container(
          constraints: const BoxConstraints(maxHeight: 600, maxWidth: 400),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: AppColors.stone200, width: 1),
                  ),
                ),
                child: Row(
                  children: [
                    Text(
                      'Ảnh đã gửi',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close, color: AppColors.stone500),
                    ),
                  ],
                ),
              ),

              // Content
              Flexible(
                child: _galleryImages.isEmpty
                    ? Container(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.photo,
                              size: 48,
                              color: AppColors.stone300,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Chưa có file nào được gửi',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppColors.stone500,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      )
                    : NotificationListener<ScrollNotification>(
                        onNotification: (scrollInfo) {
                          _handleGalleryScroll(scrollInfo);
                          return false;
                        },
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _galleryImages.length +
                              (_galleryLoading ? 1 : 0) +
                              (_galleryHasMore ? 0 : 1),
                          itemBuilder: (context, index) {
                            if (index < _galleryImages.length) {
                              final message = _galleryImages[index];
                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    GestureDetector(
                                      onTap: () {
                                        final index = _galleryImages.indexOf(message);
                                        _showFullScreenImage(index);
                                      },
                                      child: Container(
                                        constraints: const BoxConstraints(
                                          maxHeight: 200,
                                        ),
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          border: Border.all(
                                              color: AppColors.stone900,
                                              width: 2),
                                          boxShadow: [
                                            BoxShadow(
                                              color: AppColors.stone900,
                                              offset: const Offset(2, 2),
                                            ),
                                          ],
                                        ),
                                        child: ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(10),
                                          child: Image.network(
                                            message.imageUrl!,
                                            width: double.infinity,
                                            fit: BoxFit.cover,
                                            loadingBuilder: (context, child,
                                                loadingProgress) {
                                              if (loadingProgress == null)
                                                return child;
                                              return Container(
                                                height: 150,
                                                color: AppColors.stone100,
                                                child: const Center(
                                                  child:
                                                      CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                    valueColor:
                                                        AlwaysStoppedAnimation<
                                                                Color>(
                                                            AppColors.primary),
                                                  ),
                                                ),
                                              );
                                            },
                                            errorBuilder:
                                                (context, error, stackTrace) {
                                              return Container(
                                                height: 150,
                                                color: AppColors.stone100,
                                                child: const Center(
                                                  child: Icon(
                                                    Icons.broken_image,
                                                    color: AppColors.stone400,
                                                    size: 32,
                                                  ),
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _formatMessageDate(message.createdAt),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.stone500,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            } else if (index == _galleryImages.length &&
                                _galleryLoading) {
                              return Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                child: const Center(
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                        AppColors.primary),
                                  ),
                                ),
                              );
                            } else {
                              return Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                child: const Center(
                                  child: Text(
                                    'Đã tải hết ảnh',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: AppColors.stone500,
                                    ),
                                  ),
                                ),
                              );
                            }
                          },
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFullScreenImage(int initialIndex) {
    // Filter out messages without valid image URLs
    final validMessages = _galleryImages.where((msg) =>
      msg.messageType == MessageType.image &&
      msg.imageUrl != null &&
      msg.imageUrl!.isNotEmpty
    ).toList();

    if (validMessages.isEmpty) return;

    // Find the correct initial index in valid messages
    int currentIndex = 0;
    if (initialIndex < _galleryImages.length) {
      final initialMessage = _galleryImages[initialIndex];
      // Find index in valid messages by matching with original message
      for (int i = 0; i < validMessages.length; i++) {
        if (validMessages[i].id == initialMessage.id) {
          currentIndex = i;
          break;
        }
      }
    }

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Dialog(
          backgroundColor: Colors.black,
          insetPadding: EdgeInsets.zero,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // PageView for swipeable images
              PageView.builder(
                controller: PageController(initialPage: currentIndex),
                itemCount: validMessages.length,
                onPageChanged: (index) {
                  setState(() => currentIndex = index);
                },
                itemBuilder: (context, index) {
                  return InteractiveViewer(
                    child: Image.network(
                      validMessages[index].imageUrl ?? '',
                      fit: BoxFit.contain,
                      width: double.infinity,
                      height: double.infinity,
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) return child;
                        return const Center(
                          child: CircularProgressIndicator(
                            color: Colors.white,
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        return const Center(
                          child: Icon(
                            Icons.broken_image,
                            color: Colors.white,
                            size: 64,
                          ),
                        );
                      },
                    ),
                  );
                },
              ),

              // Close button
              Positioned(
                top: 16,
                right: 16,
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
                ),
              ),

              // Image counter
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${currentIndex + 1} / ${validMessages.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showChatNotification(ChatMessage message) async {
    // Only show notification if app is not currently active/visible
    // This prevents showing notifications when user is already in the chat
    final appLifecycleState = WidgetsBinding.instance.lifecycleState;
    if (appLifecycleState == AppLifecycleState.resumed) {
      // App is in foreground, don't show notification
      return;
    }

    final fcmService = FcmService();

    // Create notification data for navigation
    final notificationData = {
      'type': 'chat_message',
      'conversationId': _conversation?.id,
      'clinicId': _conversation?.clinicId,
      'clinicName': _conversation?.clinicName,
    };

    // Show local notification
    await fcmService.showLocalNotification(
      title: _conversation?.clinicName ?? 'Petties',
      body: (message.messageType == MessageType.image || message.messageType == MessageType.imageText)
          ? 'Đã gửi một hình ảnh'
          : message.content ?? 'Tin nhắn mới',
      data: notificationData,
    );
  }

  String _formatMessageDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return 'Hôm nay ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return 'Hôm qua ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else {
      return '${date.day}/${date.month}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone100,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          Expanded(child: _buildBody()),
          if (_conversation != null)
            MessageInput(
              onSend: _sendMessage,
              onImageUpload: _uploadImage,
              onSendCombined: _sendCombinedMessage,
              onTyping: (typing) =>
                  chatWebSocket.sendTyping(_conversation!.id, typing),
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
      title: _conversation != null
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
                    child: _conversation!.clinicLogo != null &&
                            _conversation!.clinicLogo!.isNotEmpty
                        ? Image.network(
                            _conversation!.clinicLogo!,
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
                        _conversation!.clinicName ?? 'Phòng khám',
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
                              color: _conversation!.isClinicOnline
                                  ? AppColors.success
                                  : AppColors.stone400,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _conversation!.isClinicOnline
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
      actions: [
        IconButton(
          icon: const Icon(Icons.more_vert, color: AppColors.stone900),
          onPressed: _showImageGallery,
          tooltip: 'Xem ảnh đã gửi',
        ),
      ],
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
          (_conversation?.clinicName ?? 'C')[0].toUpperCase(),
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

    // Group consecutive image messages
    final groupedItems = _groupMessages(_messages);

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(vertical: 16),
            itemCount: groupedItems.length,
            itemBuilder: (context, index) {
              final item = groupedItems[index];

              if (item is List<ChatMessage>) {
                // Image group
                return _buildImageGroup(item);
              } else {
                // Single message
                final message = item as ChatMessage;
                final prevItem = index > 0 ? groupedItems[index - 1] : null;
                final prevMessage = prevItem is ChatMessage ? prevItem : null;

                final showAvatar = prevMessage == null ||
                    prevMessage.senderType != message.senderType;

                return MessageBubble(
                  message: message,
                  showAvatar: showAvatar,
                  onImageTap: (tappedMessage) {
                    // Always show counter in total conversation images
                    final allImages = _messages
                        .where((msg) => msg.messageType == MessageType.image || msg.messageType == MessageType.imageText)
                        .toList();
                    
                    // Find the index of the tapped message in all images
                    final imageIndex = allImages.indexOf(tappedMessage);
                    
                    if (imageIndex >= 0) {
                      _showImageGroupCarousel(allImages, imageIndex);
                    }
                  },
                );
              }
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

  /// Group consecutive image messages from same sender within 30 seconds
  List<dynamic> _groupMessages(List<ChatMessage> messages) {
    final groups = <dynamic>[];
    final currentGroup = <ChatMessage>[];

    for (var i = 0; i < messages.length; i++) {
      final message = messages[i];

      if ((message.messageType == MessageType.image || message.messageType == MessageType.imageText) &&
          message.imageUrl != null &&
          message.imageUrl!.isNotEmpty) {
        // Check if we can add to current group
        if (currentGroup.isNotEmpty) {
          final lastMessage = currentGroup.last;
          final timeDiff = message.createdAt
              .difference(lastMessage.createdAt)
              .inMilliseconds;
          final isSameSender = message.senderId == lastMessage.senderId;
          final isWithinTimeWindow = timeDiff < 30000; // 30 seconds

          if (isSameSender && isWithinTimeWindow) {
            currentGroup.add(message);
            continue;
          }
        }

        // Start new group or add single image
        if (currentGroup.isNotEmpty) {
          groups.add(List<ChatMessage>.from(currentGroup));
          currentGroup.clear();
        }

        // Check if next messages can be grouped with this one
        final nextMessages = <ChatMessage>[];
        for (var j = i + 1; j < messages.length; j++) {
          final nextMsg = messages[j];
          final timeDiff =
              nextMsg.createdAt.difference(message.createdAt).inMilliseconds;
          final isSameSender = nextMsg.senderId == message.senderId;
          final isWithinTimeWindow = timeDiff < 30000;
          final isImage = (nextMsg.messageType == MessageType.image || nextMsg.messageType == MessageType.imageText) &&
              nextMsg.imageUrl != null &&
              nextMsg.imageUrl!.isNotEmpty;

          if (isImage && isSameSender && isWithinTimeWindow) {
            nextMessages.add(nextMsg);
            i = j; // Skip these messages in main loop
          } else {
            break;
          }
        }

        if (nextMessages.isNotEmpty) {
          currentGroup.addAll([message, ...nextMessages]);
          groups.add(List<ChatMessage>.from(currentGroup));
          currentGroup.clear();
        } else {
          groups.add(message);
        }
      } else {
        // Non-image message
        if (currentGroup.isNotEmpty) {
          groups.add(List<ChatMessage>.from(currentGroup));
          currentGroup.clear();
        }
        groups.add(message);
      }
    }

    if (currentGroup.isNotEmpty) {
      groups.add(List<ChatMessage>.from(currentGroup));
    }

    return groups;
  }

  /// Build image group widget like Messenger
  Widget _buildImageGroup(List<ChatMessage> messages) {
    final isMine = messages.first.isMine;

    return Padding(
      padding: EdgeInsets.only(
        left: isMine ? 48 : 8,
        right: isMine ? 8 : 48,
        top: 4,
        bottom: 4,
      ),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Avatar (chỉ hiển thị cho tin nhắn từ clinic)
          if (!isMine) _buildAvatar(messages.first),
          if (!isMine) const SizedBox(width: 8),

          // Image grid
          Flexible(
            child: _buildImageGrid(messages),
          ),
        ],
      ),
    );
  }

  /// Build image grid for grouped images
  Widget _buildImageGrid(List<ChatMessage> messages) {
    final count = messages.length;

    if (count == 1) {
      return _buildSingleImage(messages[0]);
    }

    return Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.75,
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          childAspectRatio: 1, // Fixed 1:1 aspect ratio for uniform sizing like Messenger
        ),
        itemCount: count > 3 ? 3 : count,
        itemBuilder: (context, index) {
          if (index == 2 && count > 3) {
            // Show overlay with +1 on 3rd image when there are more than 3
            return GestureDetector(
              onTap: () => _showImageGroupCarousel(messages, 0),
              child: _buildImageWithOverlay(messages[index], 1),
            );
          }
          return GestureDetector(
            onTap: () => _showImageGroupCarousel(messages, index),
            child: _buildGridImage(messages[index], index, count, messages),
          );
        },
      ),
    );
  }

  /// Build single image
  Widget _buildSingleImage(ChatMessage message) {
    // Check if image URL is valid
    if (message.imageUrl == null || message.imageUrl!.isEmpty) {
      return Container(
        constraints: const BoxConstraints(maxWidth: 120, maxHeight: 120),
        child: Container(
          color: AppColors.stone100,
          child: const Center(
            child: Icon(
              Icons.broken_image,
              color: AppColors.stone400,
              size: 32,
            ),
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: () => _showImageGroupCarousel([message], 0),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 120, maxHeight: 120),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            message.imageUrl!,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return Container(
                width: 100,
                height: 100,
                color: AppColors.stone100,
                child: const Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(AppColors.primary),
                  ),
                ),
              );
            },
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: 100,
                height: 100,
                color: AppColors.stone100,
                child: const Center(
                  child: Icon(
                    Icons.broken_image,
                    color: AppColors.stone400,
                    size: 32,
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  /// Build grid image
  Widget _buildGridImage(ChatMessage message, int index, int total, List<ChatMessage> messages) {
    // Check if image URL is valid
    if (message.imageUrl == null || message.imageUrl!.isEmpty) {
      return Container(
        width: double.infinity,
        height: double.infinity,
        color: AppColors.stone100,
        child: const Center(
          child: Icon(
            Icons.broken_image,
            color: AppColors.stone400,
            size: 24,
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: () => _showImageGroupCarousel(messages, index),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1C1917),
              offset: const Offset(2, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: double.infinity,
            height: double.infinity,
            child: Image.network(
              message.imageUrl!,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return Container(
                  color: AppColors.stone100,
                  child: const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                  ),
                );
              },
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  color: AppColors.stone100,
                  child: const Center(
                    child: Icon(
                      Icons.broken_image,
                      color: AppColors.stone400,
                      size: 24,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  /// Show carousel view for all images in a group
  void _showImageGroupCarousel(List<ChatMessage> messages, int initialIndex) {
    // Get all images in conversation for global counting
    final allImages = _messages.where((msg) =>
      msg.messageType == MessageType.image &&
      msg.imageUrl != null &&
      msg.imageUrl!.isNotEmpty
    ).toList();

    // Filter out messages without valid image URLs for the group
    final validMessages = messages.where((msg) =>
      (msg.messageType == MessageType.image || msg.messageType == MessageType.imageText) &&
      msg.imageUrl != null &&
      msg.imageUrl!.isNotEmpty
    ).toList();

    if (validMessages.isEmpty) return;

    // Find the correct initial index in valid messages
    int currentIndex = 0;
    if (initialIndex < messages.length) {
      final initialMessage = messages[initialIndex];
      // Find index in valid messages by matching with original message
      for (int i = 0; i < validMessages.length; i++) {
        if (validMessages[i].id == initialMessage.id) {
          currentIndex = i;
          break;
        }
      }
    }

    // Calculate global position
    int getGlobalPosition(int groupIndex) {
      final currentMessage = validMessages[groupIndex];
      return allImages.indexWhere((msg) => msg.id == currentMessage.id) + 1; // 1-based
    }

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Dialog(
          backgroundColor: Colors.black,
          insetPadding: EdgeInsets.zero,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // PageView for swipeable images
              PageView.builder(
                controller: PageController(initialPage: currentIndex),
                itemCount: validMessages.length,
                onPageChanged: (index) {
                  setState(() => currentIndex = index);
                },
                itemBuilder: (context, index) {
                  return InteractiveViewer(
                    child: Image.network(
                      validMessages[index].imageUrl ?? '',
                      fit: BoxFit.contain,
                      width: double.infinity,
                      height: double.infinity,
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) return child;
                        return const Center(
                          child: CircularProgressIndicator(
                            color: Colors.white,
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        return const Center(
                          child: Icon(
                            Icons.broken_image,
                            color: Colors.white,
                            size: 64,
                          ),
                        );
                      },
                    ),
                  );
                },
              ),

              // Close button
              Positioned(
                top: 16,
                right: 16,
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
                ),
              ),

              // Image counter
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${getGlobalPosition(currentIndex)} / ${allImages.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Build image with overlay showing remaining count
  Widget _buildImageWithOverlay(ChatMessage message, int remainingCount) {
    // Check if image URL is valid
    if (message.imageUrl == null || message.imageUrl!.isEmpty) {
      return Container(
        color: AppColors.stone100,
        child: const Center(
          child: Icon(
            Icons.broken_image,
            color: AppColors.stone400,
            size: 24,
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            message.imageUrl!,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return Container(
                color: AppColors.stone100,
                child: const Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                  ),
                ),
              );
            },
            errorBuilder: (context, error, stackTrace) {
              return Container(
                color: AppColors.stone100,
                child: const Center(
                  child: Icon(
                    Icons.broken_image,
                    color: AppColors.stone400,
                    size: 24,
                  ),
                ),
              );
            },
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.6),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              '+$remainingCount',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Build avatar for image groups
  Widget _buildAvatar(ChatMessage message) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.stone900, width: 1.5),
        color: AppColors.stone100,
      ),
      child: ClipOval(
        child: message.senderAvatar != null && message.senderAvatar!.isNotEmpty
            ? Image.network(
                message.senderAvatar!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildDefaultAvatar(),
              )
            : _buildDefaultAvatar(),
      ),
    );
  }

  /// Build message timestamp
  Widget _buildMessageTimestamp(ChatMessage message) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          DateFormat('HH:mm').format(message.createdAt),
          style: TextStyle(
            fontSize: 11,
            color: message.isMine ? AppColors.white : AppColors.stone500,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (message.isMine && message.status == MessageStatus.seen)
          const Padding(
            padding: EdgeInsets.only(left: 4),
            child: Icon(
              Icons.done_all,
              size: 12,
              color: Colors.blue,
            ),
          ),
      ],
    );
  }

  /// Scroll to a specific message
  void _scrollToMessage(String messageId) {
    final messageIndex = _messages.indexWhere((msg) => msg.id == messageId);
    if (messageIndex != -1) {
      // Calculate approximate position
      final estimatedHeight = messageIndex * 80.0; // Rough estimate per message
      _scrollController.animateTo(
        estimatedHeight.clamp(0, _scrollController.position.maxScrollExtent),
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOut,
      );
    }
  }
}

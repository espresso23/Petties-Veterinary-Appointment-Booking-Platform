import 'package:flutter/material.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/chat.dart';
import 'package:intl/intl.dart';
import '../chat_detail_screen.dart';

/// Widget hiển thị một tin nhắn trong chat
class MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final bool showAvatar;
  final Function(ChatMessage)? onImageTap;

  const MessageBubble({
    super.key,
    required this.message,
    this.showAvatar = true,
    this.onImageTap,
  });

  @override
  Widget build(BuildContext context) {
    final isMine = message.isMine;

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
          if (!isMine && showAvatar) _buildAvatar(),
          if (!isMine && !showAvatar) const SizedBox(width: 40),

          const SizedBox(width: 8),

          // Message bubble
          Flexible(child: _buildBubble(isMine)),
        ],
      ),
    );
  }

  Widget _buildAvatar() {
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

  Widget _buildDefaultAvatar() {
    return Container(
      color: AppColors.primarySurface,
      child: Center(
        child: Text(
          (message.senderName ?? 'C')[0].toUpperCase(),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
          ),
        ),
      ),
    );
  }

  Widget _buildBubble(bool isMine) {
    // Special rendering for IMAGE_TEXT: image without bubble, text WITH colored bubble
    if (message.messageType == MessageType.imageText && message.imageUrl != null && message.imageUrl!.isNotEmpty) {
      return Column(
        crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Image without colored bubble (just border)
          GestureDetector(
            onTap: () {
              onImageTap?.call(message);
            },
            child: Container(
              constraints: const BoxConstraints(maxWidth: 220, maxHeight: 180),
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(isMine ? -2 : 2, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
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
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
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
          ),
          // Text WITH colored bubble (like normal text messages)
          if (message.content.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isMine ? AppColors.primary : AppColors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isMine ? 16 : 4),
                  bottomRight: Radius.circular(isMine ? 4 : 16),
                ),
                border: Border.all(
                  color: AppColors.stone900,
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(isMine ? -2 : 2, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    message.content,
                    style: TextStyle(
                      fontSize: 15,
                      color: isMine ? AppColors.white : AppColors.stone900,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Time & Status
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _formatTime(message.createdAt),
                        style: TextStyle(
                          fontSize: 10,
                          color: isMine
                              ? AppColors.white.withValues(alpha: 0.7)
                              : AppColors.stone400,
                        ),
                      ),
                      if (isMine) ...[
                        const SizedBox(width: 4),
                        _buildStatusIcon(),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ] else ...[
            // Only timestamp if no text
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(message.createdAt),
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.stone400,
                  ),
                ),
                if (isMine) ...[
                  const SizedBox(width: 4),
                  _buildStatusIcon(),
                ],
              ],
            ),
          ],
        ],
      );
    }

    // Special rendering for IMAGE only (no text): image without colored bubble
    if (message.messageType == MessageType.image && message.imageUrl != null && message.imageUrl!.isNotEmpty) {
      return Column(
        crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Image without colored bubble (just border)
          GestureDetector(
            onTap: () {
              onImageTap?.call(message);
            },
            child: Container(
              constraints: const BoxConstraints(maxWidth: 220, maxHeight: 180),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(isMine ? -2 : 2, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
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
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
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
          ),
          const SizedBox(height: 4),
          // Timestamp
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _formatTime(message.createdAt),
                style: TextStyle(
                  fontSize: 10,
                  color: AppColors.stone400,
                ),
              ),
              if (isMine) ...[
                const SizedBox(width: 4),
                _buildStatusIcon(),
              ],
            ],
          ),
        ],
      );
    }

    // Default: TEXT messages with colored bubble
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isMine ? AppColors.primary : AppColors.white,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(16),
          topRight: const Radius.circular(16),
          bottomLeft: Radius.circular(isMine ? 16 : 4),
          bottomRight: Radius.circular(isMine ? 4 : 16),
        ),
        border: Border.all(
          color: AppColors.stone900,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.stone900,
            offset: Offset(isMine ? -2 : 2, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Image content (only for IMAGE type now)
          if (message.messageType == MessageType.image && message.imageUrl != null && message.imageUrl!.isNotEmpty) ...[
            GestureDetector(
              onTap: () {
                // Call the callback to show image carousel
                onImageTap?.call(message);
              },
              child: Container(
                constraints: const BoxConstraints(maxWidth: 220, maxHeight: 180),
                margin: const EdgeInsets.only(bottom: 8),
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
                            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
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
            ),
          ],
          // Text content (only show if there's actual text content)
          if (message.content.isNotEmpty) ...[
            Text(
              message.content,
              style: TextStyle(
                fontSize: 15,
                color: isMine ? AppColors.white : AppColors.stone900,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 4),
          ],
          // Time & Status
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _formatTime(message.createdAt),
                style: TextStyle(
                  fontSize: 10,
                  color: isMine
                      ? AppColors.white.withValues(alpha: 0.7)
                      : AppColors.stone400,
                ),
              ),
              if (isMine) ...[
                const SizedBox(width: 4),
                _buildStatusIcon(),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIcon() {
    IconData icon;
    Color color;

    switch (message.status) {
      case MessageStatus.seen:
        icon = Icons.done_all;
        color = AppColors.infoLight;
        break;
      case MessageStatus.delivered:
        icon = Icons.done_all;
        color = AppColors.white.withValues(alpha: 0.7);
        break;
      case MessageStatus.sent:
      default:
        icon = Icons.done;
        color = AppColors.white.withValues(alpha: 0.7);
        break;
    }

    return Icon(icon, size: 14, color: color);
  }

  String _formatTime(DateTime time) {
    return DateFormat('HH:mm').format(time);
  }
}

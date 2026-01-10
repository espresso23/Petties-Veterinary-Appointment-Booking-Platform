import 'package:flutter/material.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/chat.dart';
import 'package:intl/intl.dart';

/// Widget hiển thị một chat box trong danh sách
class ChatBoxItem extends StatelessWidget {
  final ChatBox chatBox;
  final VoidCallback onTap;

  const ChatBoxItem({
    super.key,
    required this.chatBox,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Avatar
                _buildAvatar(),
                const SizedBox(width: 12),
                // Content
                Expanded(child: _buildContent()),
                // Time & Badge
                _buildMeta(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    return Stack(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.stone900, width: 2),
            color: AppColors.stone100,
          ),
          child: ClipOval(
            child: chatBox.clinicLogo != null && chatBox.clinicLogo!.isNotEmpty
                ? Image.network(
                    chatBox.clinicLogo!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _buildDefaultAvatar(),
                  )
                : _buildDefaultAvatar(),
          ),
        ),
        // Online indicator (use == true for null safety)
        if (chatBox.isClinicOnline == true)
          Positioned(
            right: 2,
            bottom: 2,
            child: Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.white, width: 2),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: AppColors.primarySurface,
      child: Center(
        child: Text(
          (chatBox.clinicName ?? 'C')[0].toUpperCase(),
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.primary,
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Clinic name
        Text(
          chatBox.clinicName ?? 'Phòng khám',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.stone900,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        // Last message
        Text(
          _getLastMessagePreview(),
          style: TextStyle(
            fontSize: 13,
            color: chatBox.myUnreadCount > 0
                ? AppColors.stone700
                : AppColors.stone500,
            fontWeight:
                chatBox.myUnreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  String _getLastMessagePreview() {
    if (chatBox.lastMessage == null || chatBox.lastMessage!.isEmpty) {
      return 'Bắt đầu trò chuyện...';
    }

    final prefix = chatBox.lastMessageSender == 'PET_OWNER' ? 'Bạn: ' : '';
    return '$prefix${chatBox.lastMessage}';
  }

  Widget _buildMeta() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Time
        Text(
          _formatTime(chatBox.lastMessageAt),
          style: TextStyle(
            fontSize: 11,
            color: AppColors.stone400,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 6),
        // Unread badge
        if (chatBox.myUnreadCount > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone900, width: 1.5),
            ),
            child: Text(
              chatBox.myUnreadCount > 99
                  ? '99+'
                  : chatBox.myUnreadCount.toString(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.white,
              ),
            ),
          ),
      ],
    );
  }

  String _formatTime(DateTime? time) {
    if (time == null) return '';

    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inMinutes < 1) {
      return 'Vừa xong';
    } else if (diff.inHours < 1) {
      return '${diff.inMinutes} phút';
    } else if (diff.inDays < 1) {
      return DateFormat('HH:mm').format(time);
    } else if (diff.inDays < 7) {
      return DateFormat('E', 'vi').format(time);
    } else {
      return DateFormat('dd/MM').format(time);
    }
  }
}

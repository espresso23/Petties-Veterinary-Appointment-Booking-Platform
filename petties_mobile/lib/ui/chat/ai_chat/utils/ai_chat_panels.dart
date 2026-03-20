import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/ai_chat.dart';
import 'ai_booking_tracker.dart';

Future<void> showAiChatSessionListSheet({
  required BuildContext context,
  required List<AiChatSession> sessions,
  required String? currentSessionId,
  required String Function(AiChatSession session) formatSessionTime,
  required VoidCallback onStartNewSession,
  required ValueChanged<AiChatSession> onSelectSession,
  required ValueChanged<AiChatSession> onDeleteSession,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        builder: (context, scrollController) {
          return Container(
            decoration: BoxDecoration(
              color: AppColors.primaryBackground,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
              border: const Border(
                top: BorderSide(color: AppColors.stone900, width: 2),
                left: BorderSide(color: AppColors.stone900, width: 2),
                right: BorderSide(color: AppColors.stone900, width: 2),
              ),
              boxShadow: const [
                BoxShadow(
                  color: AppColors.stone900,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 8),
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.stone400,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Lịch sử phiên chat',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.stone900,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Expanded(
                  child: sessions.isEmpty
                      ? const Center(
                          child: Text(
                            'Chưa có phiên chat AI nào.',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.stone600,
                            ),
                          ),
                        )
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: sessions.length,
                          itemBuilder: (context, index) {
                            final session = sessions[index];
                            final isCurrent =
                                session.sessionId == currentSessionId;
                            return ListTile(
                              leading: Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: AppColors.primarySurface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: AppColors.stone900,
                                    width: 1.5,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.chat_bubble_outline,
                                  size: 18,
                                  color: AppColors.primary,
                                ),
                              ),
                              title: Text(
                                session.title ?? 'Trợ lý AI',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.stone900,
                                ),
                              ),
                              subtitle: Text(
                                formatSessionTime(session),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.stone600,
                                ),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (isCurrent)
                                    const Padding(
                                      padding: EdgeInsets.only(right: 8),
                                      child: Text(
                                        'Đang mở',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primaryDark,
                                        ),
                                      ),
                                    ),
                                  IconButton(
                                    icon: const Icon(
                                      Icons.delete_outline,
                                      size: 20,
                                      color: AppColors.error,
                                    ),
                                    tooltip: 'Xóa phiên chat',
                                    onPressed: () {
                                      Navigator.of(context).pop();
                                      onDeleteSession(session);
                                    },
                                  ),
                                ],
                              ),
                              onTap: () {
                                Navigator.of(context).pop();
                                onSelectSession(session);
                              },
                            );
                          },
                        ),
                ),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: SizedBox(
                    width: double.infinity,
                    height: 40,
                    child: ElevatedButton.icon(
                      onPressed: onStartNewSession,
                      icon: const Icon(Icons.add_comment_outlined, size: 16),
                      label: const Text(
                        'PHIÊN CHAT MỚI',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(
                            color: AppColors.stone900,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}

Future<bool> showAiDeleteSessionDialog(BuildContext context) async {
  final shouldDelete = await showDialog<bool>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text(
          'Xóa phiên chat AI',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: AppColors.stone900,
          ),
        ),
        content: const Text(
          'Bạn có chắc muốn xóa phiên chat AI này? Bạn sẽ không xem lại được hội thoại cũ nữa.',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.stone700,
            height: 1.4,
          ),
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.stone900, width: 2),
        ),
        actionsPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(
              'HỦY',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.stone700,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: AppColors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: AppColors.stone900, width: 2),
              ),
            ),
            child: const Text(
              'XÓA',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      );
    },
  );

  return shouldDelete == true;
}

class AiBookingTrackerCard extends StatelessWidget {
  final AiBookingTrackerSnapshot tracker;

  const AiBookingTrackerCard({
    super.key,
    required this.tracker,
  });

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[
      if ((tracker.petName ?? '').trim().isNotEmpty)
        _AiTrackerChip(
          icon: Icons.pets_outlined,
          label: tracker.petName ?? '',
        ),
      if ((tracker.clinicName ?? '').trim().isNotEmpty)
        _AiTrackerChip(
          icon: Icons.local_hospital_outlined,
          label: tracker.clinicName ?? '',
        ),
      if ((tracker.bookingDate ?? '').trim().isNotEmpty)
        _AiTrackerChip(
          icon: Icons.calendar_month,
          label: _formatBookingDateLabel(tracker.bookingDate),
        ),
      if ((tracker.startTime ?? '').trim().isNotEmpty)
        _AiTrackerChip(
          icon: Icons.schedule,
          label: tracker.startTime ?? '',
        ),
      if (tracker.serviceNames.isNotEmpty)
        _AiTrackerChip(
          icon: Icons.medical_services_outlined,
          label: tracker.serviceNames.join(', '),
        ),
    ];

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Đang hiểu lịch hẹn của bạn',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.stone700,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: chips,
          ),
        ],
      ),
    );
  }
}

class AiChatComposerSuggestions extends StatelessWidget {
  final List<String> suggestions;
  final ValueChanged<String> onSuggestionTap;

  const AiChatComposerSuggestions({
    super.key,
    required this.suggestions,
    required this.onSuggestionTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: suggestions
            .map(
              (suggestion) => GestureDetector(
                onTap: () => onSuggestionTap(suggestion),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primarySurface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.stone900, width: 1.5),
                  ),
                  child: Text(
                    suggestion,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone900,
                    ),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class AiChatComposer extends StatelessWidget {
  final double horizontalPadding;
  final AiBookingTrackerSnapshot tracker;
  final List<String> suggestions;
  final String? errorText;
  final TextEditingController controller;
  final ValueChanged<String> onSuggestionTap;
  final VoidCallback onSend;
  final bool isSending;
  final bool isReconnecting;

  const AiChatComposer({
    super.key,
    required this.horizontalPadding,
    required this.tracker,
    required this.suggestions,
    required this.errorText,
    required this.controller,
    required this.onSuggestionTap,
    required this.onSend,
    required this.isSending,
    required this.isReconnecting,
  });

  @override
  Widget build(BuildContext context) {
    final isBusy = isSending || isReconnecting;

    return Container(
      padding: EdgeInsets.fromLTRB(horizontalPadding, 8, horizontalPadding, 8),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (tracker.hasData) AiBookingTrackerCard(tracker: tracker),
            if (suggestions.isNotEmpty)
              AiChatComposerSuggestions(
                suggestions: suggestions,
                onSuggestionTap: onSuggestionTap,
              ),
            if (errorText != null) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.error, width: 1.5),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: AppColors.error,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        errorText!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.errorDark,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Container(
                    constraints: const BoxConstraints(maxHeight: 100),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(
                          color: AppColors.stone900,
                          offset: Offset(2, 2),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: controller,
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => onSend(),
                      style: const TextStyle(fontSize: 14),
                      decoration: const InputDecoration(
                        hintText: 'Nhập câu hỏi cho trợ lý AI...',
                        hintStyle: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone400,
                        ),
                        border: InputBorder.none,
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: isBusy ? null : onSend,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: isBusy ? AppColors.stone300 : AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: isSending
                          ? null
                          : const [
                              BoxShadow(
                                color: AppColors.stone900,
                                offset: Offset(2, 2),
                              ),
                            ],
                    ),
                    child: Icon(
                      isReconnecting
                          ? Icons.sync
                          : isSending
                              ? Icons.hourglass_top
                              : Icons.send_rounded,
                      color: AppColors.white,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AiTrackerChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _AiTrackerChip({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.stone900, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 220),
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatBookingDateLabel(String? value) {
  if (value == null || value.isEmpty) {
    return 'Chưa rõ';
  }

  final parts = value.split('-');
  if (parts.length == 3) {
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }

  return value;
}

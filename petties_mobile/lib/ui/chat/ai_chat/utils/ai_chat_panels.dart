import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:convert';
import 'dart:io';

import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/ai_chat.dart';
import 'ai_booking_tracker.dart';

const double _composerRadius = 18;
const double _composerBorderWidth = 1.6;
const double _composerActionSize = 34;
const double _composerActionSizeCompact = 32;
const double _composerSendSize = 42;
const double _composerSendSizeCompact = 39;

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
      if ((tracker.status ?? '').trim().isNotEmpty)
        _AiTrackerChip(
          icon: Icons.info_outline,
          label: _mapStatusToVietnamese(tracker.status!),
          backgroundColor: _getStatusColor(tracker.status!),
        ),
      if (tracker.serviceNames.isNotEmpty)
        _AiTrackerChip(
          icon: Icons.medical_services_outlined,
          label: tracker.serviceNames.join(', '),
        ),
      if ((tracker.notes ?? '').trim().isNotEmpty)
        _AiTrackerChip(
          icon: Icons.note_alt_outlined,
          label: tracker.notes!,
          backgroundColor: AppColors.infoLight,
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
  final Color backgroundColor;
  final Color borderColor;
  final Color textColor;

  const AiChatComposerSuggestions({
    super.key,
    required this.suggestions,
    required this.onSuggestionTap,
    this.backgroundColor = AppColors.primarySurface,
    this.borderColor = AppColors.stone900,
    this.textColor = AppColors.stone900,
  });

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final maxChipWidth = screenWidth * 0.65;

    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 72),
      child: SingleChildScrollView(
        child: Wrap(
          spacing: 8,
          runSpacing: 6,
          children: suggestions.map((suggestion) {
            final displayText = suggestion.length > 55
                ? '${suggestion.substring(0, 55)}...'
                : suggestion;
            return GestureDetector(
              onTap: () => onSuggestionTap(suggestion),
              child: Container(
                constraints: BoxConstraints(maxWidth: maxChipWidth),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: borderColor, width: 1.5),
                ),
                child: Text(
                  displayText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: textColor,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class AiChatComposer extends StatelessWidget {
  final double horizontalPadding;
  final AiBookingTrackerSnapshot tracker;
  final bool showTracker;
  final List<String> suggestions;
  final String? errorText;
  final TextEditingController controller;
  final ValueChanged<String> onSuggestionTap;
  final VoidCallback onSend;
  final bool isSending;
  final bool isReconnecting;
  final ValueChanged<List<String>>? onImagesSelected;
  final List<String>? selectedImages;
  final String hintText;
  final Color accentColor;
  final Color suggestionBackgroundColor;
  final Color suggestionTextColor;
  final VoidCallback? onSettingsTap;
  final FocusNode? focusNode;

  const AiChatComposer({
    super.key,
    required this.horizontalPadding,
    required this.tracker,
    this.showTracker = true,
    required this.suggestions,
    required this.errorText,
    required this.controller,
    required this.onSuggestionTap,
    required this.onSend,
    required this.isSending,
    required this.isReconnecting,
    this.onImagesSelected,
    this.selectedImages,
    this.hintText = 'Nhập câu hỏi cho trợ lý AI...',
    this.accentColor = AppColors.primary,
    this.suggestionBackgroundColor = AppColors.primarySurface,
    this.suggestionTextColor = AppColors.stone900,
    this.onSettingsTap,
    this.focusNode,
  });

  Future<void> _pickImages(BuildContext context) async {
    if (onImagesSelected == null) return;

    final picker = ImagePicker();
    final pickedFiles = await picker.pickMultiImage(
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );

    if (pickedFiles.isEmpty) return;

    final imagePaths = <String>[];
    for (final file in pickedFiles) {
      final bytes = await File(file.path).readAsBytes();
      final base64 = base64Encode(bytes);
      imagePaths.add('data:image/jpeg;base64,$base64');
    }

    onImagesSelected!(imagePaths);
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isCompact = screenWidth <= 360;
    final isBusy = isSending || isReconnecting;
    final hasDraftToSend = controller.text.trim().isNotEmpty ||
        (selectedImages?.isNotEmpty ?? false);
    final canSend = !isBusy && hasDraftToSend;
    final hasImages = selectedImages != null && selectedImages!.isNotEmpty;
    final isKeyboardVisible = MediaQuery.of(context).viewInsets.bottom > 0;
    final shouldShowSuggestions = suggestions.isNotEmpty && !isKeyboardVisible;
    final shouldShowTracker =
        showTracker && tracker.hasData && !isKeyboardVisible;
    final shouldShowError = errorText != null && !isKeyboardVisible;
    final shouldShowImages = hasImages && !isKeyboardVisible;
    // Khi bàn phím mở, giảm maxLines / khung để tránh overflow cột cha trên màn nhỏ.
    final composerMaxLines = isKeyboardVisible ? (isCompact ? 4 : 5) : 9;
    final textFieldBoxMaxHeight = isKeyboardVisible
        ? (isCompact ? 160.0 : 180.0)
        : (isCompact ? 200.0 : 220.0);
    final verticalPadding = isKeyboardVisible ? 6.0 : 8.0;

    return Container(
      padding: EdgeInsets.fromLTRB(
        horizontalPadding,
        verticalPadding,
        horizontalPadding,
        verticalPadding + 4,
      ),
      decoration: BoxDecoration(
        color:
            AppColors.white.withValues(alpha: isKeyboardVisible ? 0.9 : 0.94),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (shouldShowTracker) AiBookingTrackerCard(tracker: tracker),
          if (shouldShowSuggestions)
            AiChatComposerSuggestions(
              suggestions: suggestions,
              onSuggestionTap: onSuggestionTap,
              backgroundColor: suggestionBackgroundColor,
              borderColor: AppColors.stone900,
              textColor: suggestionTextColor,
            ),
          if (shouldShowError) ...[
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
          if (shouldShowImages) ...[
            SizedBox(
              height: 80,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: selectedImages!.length,
                itemBuilder: (context, index) {
                  final imageData = selectedImages![index];
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.memory(
                            Uri.parse(imageData).data!.contentAsBytes(),
                            width: 60,
                            height: 60,
                            fit: BoxFit.cover,
                          ),
                        ),
                        Positioned(
                          top: 0,
                          right: 0,
                          child: GestureDetector(
                            onTap: () {
                              final newList = List<String>.from(selectedImages!)
                                ..removeAt(index);
                              onImagesSelected!(newList);
                            },
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close,
                                size: 14,
                                color: AppColors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
          Container(
            constraints: BoxConstraints(maxHeight: textFieldBoxMaxHeight),
            decoration: BoxDecoration(
              color: AppColors.white.withValues(alpha: 0.98),
              borderRadius: BorderRadius.circular(_composerRadius),
              border: Border.all(
                color: AppColors.stone900,
                width: _composerBorderWidth,
              ),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (onImagesSelected != null) ...[
                  _ComposerActionButton(
                    icon: Icons.add,
                    tooltip: 'Đính kèm ảnh',
                    onTap: isBusy ? null : () => _pickImages(context),
                    accentColor: accentColor,
                  ),
                ],
                _ComposerActionButton(
                  icon: Icons.tune,
                  tooltip: 'Tùy chọn phản hồi',
                  onTap: isBusy ? null : onSettingsTap,
                  accentColor: accentColor,
                ),
                Expanded(
                  child: Scrollbar(
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      onTapOutside: (_) =>
                          FocusManager.instance.primaryFocus?.unfocus(),
                      keyboardType: TextInputType.multiline,
                      textCapitalization: TextCapitalization.sentences,
                      minLines: 1,
                      maxLines: composerMaxLines,
                      scrollPadding: const EdgeInsets.symmetric(vertical: 8),
                      textInputAction: TextInputAction.newline,
                      style: TextStyle(
                        fontSize: isCompact ? 13 : 14,
                        fontWeight: FontWeight.w500,
                        color: AppColors.stone900,
                      ),
                      decoration: InputDecoration(
                        hintText: hintText,
                        hintStyle: TextStyle(
                          fontSize: isCompact ? 12 : 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone400,
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: isCompact ? 6 : 8,
                          vertical: isCompact ? 10 : 12,
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.only(
                    right: isCompact ? 5 : 6,
                    bottom: isCompact ? 5 : 6,
                    left: 4,
                  ),
                  child: GestureDetector(
                    onTap: canSend ? onSend : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: isCompact
                          ? _composerSendSizeCompact
                          : _composerSendSize,
                      height: isCompact
                          ? _composerSendSizeCompact
                          : _composerSendSize,
                      decoration: BoxDecoration(
                        color: isBusy
                            ? AppColors.stone300
                            : (hasDraftToSend
                                ? accentColor
                                : AppColors.stone500.withValues(alpha: 0.7)),
                        borderRadius: BorderRadius.circular(13),
                        border:
                            Border.all(color: AppColors.stone900, width: 1.8),
                        boxShadow: isSending
                            ? null
                            : const [
                                BoxShadow(
                                  color: AppColors.stone900,
                                  offset: Offset(1.5, 1.5),
                                ),
                              ],
                      ),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 160),
                        switchInCurve: Curves.easeOutCubic,
                        switchOutCurve: Curves.easeInCubic,
                        child: Icon(
                          isReconnecting
                              ? Icons.sync
                              : isSending
                                  ? Icons.hourglass_top
                                  : Icons.arrow_upward_rounded,
                          key: ValueKey<String>(
                            isReconnecting
                                ? 'reconnecting'
                                : isSending
                                    ? 'sending'
                                    : 'idle',
                          ),
                          color: AppColors.white,
                          size: isCompact ? 17 : 18,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ComposerActionButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final Color accentColor;

  const _ComposerActionButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isCompact = screenWidth <= 360;
    return Padding(
      padding: EdgeInsets.only(
        left: isCompact ? 4 : 6,
        right: 2,
        bottom: isCompact ? 5 : 6,
      ),
      child: Tooltip(
        message: tooltip,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(isCompact ? 10 : 11),
            onTap: onTap,
            child: Container(
              width:
                  isCompact ? _composerActionSizeCompact : _composerActionSize,
              height:
                  isCompact ? _composerActionSizeCompact : _composerActionSize,
              decoration: BoxDecoration(
                color: AppColors.stone100,
                borderRadius: BorderRadius.circular(isCompact ? 10 : 11),
                border: Border.all(color: AppColors.stone300, width: 1.2),
              ),
              child: Icon(
                icon,
                size: isCompact ? 17 : 18,
                color: onTap == null ? AppColors.stone400 : accentColor,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AiTrackerChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? backgroundColor;

  const _AiTrackerChip({
    required this.icon,
    required this.label,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.white,
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

String _mapStatusToVietnamese(String status) {
  switch (status.toUpperCase()) {
    case 'DRAFT':
      return 'Đang dự thảo';
    case 'PENDING':
      return 'Chờ xác nhận';
    case 'SUSPENDED':
      return 'Chờ thêm thông tin';
    case 'COMPLETED':
      return 'Hoàn tất';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

Color _getStatusColor(String status) {
  switch (status.toUpperCase()) {
    case 'DRAFT':
      return AppColors.primarySurface;
    case 'PENDING':
      return AppColors.successLight;
    case 'SUSPENDED':
      return AppColors.infoLight;
    case 'COMPLETED':
      return AppColors.success;
    case 'CANCELLED':
      return AppColors.errorLight;
    default:
      return AppColors.white;
  }
}

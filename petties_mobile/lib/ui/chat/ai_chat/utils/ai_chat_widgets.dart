import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/ai_chat.dart';

class AiChatMessageAvatar extends StatelessWidget {
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;

  const AiChatMessageAvatar({
    super.key,
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: Icon(icon, size: 18, color: iconColor),
    );
  }
}

class AiBookingMetaPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  const AiBookingMetaPill({
    super.key,
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.stone900, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foregroundColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: foregroundColor,
            ),
          ),
        ],
      ),
    );
  }
}

class AiBookingReadyBadge extends StatelessWidget {
  const AiBookingReadyBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.successDark, width: 1.5),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.check_circle_outline,
            size: 13,
            color: AppColors.successDark,
          ),
          SizedBox(width: 5),
          Text(
            'SẴN SÀNG BOOKING',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: AppColors.successDark,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class AiBookingReadyBanner extends StatelessWidget {
  const AiBookingReadyBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.successDark, width: 1.5),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.auto_awesome, color: AppColors.successDark, size: 16),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'AI đã chuẩn bị đủ thông tin để mở màn xác nhận đặt lịch chuẩn.',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.successDark,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AiChatLoadingHero extends StatefulWidget {
  const AiChatLoadingHero({super.key});

  @override
  State<AiChatLoadingHero> createState() => _AiChatLoadingHeroState();
}

class _AiChatLoadingHeroState extends State<AiChatLoadingHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final scale = 0.94 + (_controller.value * 0.08);

        return Transform.scale(
          scale: scale,
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
              ],
            ),
            child: const Icon(
              Icons.auto_awesome,
              color: AppColors.primary,
              size: 34,
            ),
          ),
        );
      },
    );
  }
}

class AiChatFeedbackIconButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback? onTap;

  const AiChatFeedbackIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bgColor =
        isSelected ? color.withValues(alpha: 0.12) : Colors.transparent;
    final borderColor =
        isSelected ? color : AppColors.stone300.withValues(alpha: 0.9);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: borderColor,
            width: 1.3,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: AppColors.stone800,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AiChatTypingDots extends StatefulWidget {
  const AiChatTypingDots({super.key});

  @override
  State<AiChatTypingDots> createState() => _AiChatTypingDotsState();
}

class _AiChatTypingDotsState extends State<AiChatTypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          children: List.generate(3, (index) {
            final phase = (_controller.value + (index * 0.18)) % 1.0;
            final isActive = phase > 0.2 && phase < 0.7;

            return Container(
              width: 8,
              height: 8,
              margin: EdgeInsets.only(right: index == 2 ? 0 : 4),
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : AppColors.stone300,
                shape: BoxShape.circle,
              ),
            );
          }),
        );
      },
    );
  }
}

class AiChatTracePanel extends StatelessWidget {
  final List<dynamic> trace;
  final bool initiallyExpanded;

  const AiChatTracePanel({
    super.key,
    required this.trace,
    this.initiallyExpanded = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.stone100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200, width: 1.5),
      ),
      child: ExpansionTile(
        initiallyExpanded: initiallyExpanded,
        tilePadding: EdgeInsets.zero,
        childrenPadding: EdgeInsets.zero,
        collapsedIconColor: AppColors.stone500,
        iconColor: AppColors.stone700,
        title: const Text(
          'Chi tiết xử lý',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.stone700,
          ),
        ),
        children: trace.take(6).map((step) {
          if (step is! Map) {
            return const SizedBox.shrink();
          }

          final rawStepType = step['step_type']?.toString() ??
              step['type']?.toString() ??
              'step';
          final stepType = rawStepType.toLowerCase();
          final content = step['content']?.toString() ?? '';
          final toolName = step['tool_name']?.toString();

          var label = rawStepType.toUpperCase();
          if (stepType == 'thought') label = 'SUY LUẬN';
          if (stepType == 'action') label = 'GỌI CÔNG CỤ';
          if (stepType == 'observation') label = 'NHẬN KẾT QUẢ';

          return Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone600,
                  ),
                ),
                if (toolName != null && toolName.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    toolName,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                    ),
                  ),
                ],
                if (content.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    content,
                    style: const TextStyle(
                      fontSize: 11,
                      height: 1.4,
                      color: AppColors.stone700,
                    ),
                  ),
                ],
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class AiChatThinkingBubble extends StatelessWidget {
  final String label;
  final List<Map<String, dynamic>> trace;
  final bool isExpanded;
  final VoidCallback? onToggleExpanded;
  final String? Function(String? toolName, dynamic result)? summarizeToolResult;

  const AiChatThinkingBubble({
    super.key,
    required this.label,
    required this.trace,
    required this.isExpanded,
    required this.onToggleExpanded,
    this.summarizeToolResult,
  });

  @override
  Widget build(BuildContext context) {
    final canExpand = trace.isNotEmpty;
    final width = MediaQuery.of(context).size.width;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const AiChatMessageAvatar(
            icon: Icons.smart_toy_outlined,
            backgroundColor: AppColors.primarySurface,
            iconColor: AppColors.primary,
          ),
          const SizedBox(width: 10),
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: width < 390 ? width * 0.76 : width * 0.8,
              ),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(14),
                    topRight: Radius.circular(14),
                    bottomLeft: Radius.circular(4),
                    bottomRight: Radius.circular(14),
                  ),
                  border: Border.all(
                    color: AppColors.stone900,
                    width: 2,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: AppColors.stone900,
                      offset: Offset(2, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        AiChatTypingDots(),
                      ],
                    ),
                    if (label.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        label.trim(),
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone700,
                        ),
                      ),
                    ],
                    if (canExpand) ...[
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: onToggleExpanded,
                        borderRadius: BorderRadius.circular(10),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isExpanded ? 'ẨN CHI TIẾT' : 'XEM CHI TIẾT',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.stone700,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Icon(
                                isExpanded
                                    ? Icons.expand_less
                                    : Icons.expand_more,
                                size: 18,
                                color: AppColors.stone600,
                              ),
                            ],
                          ),
                        ),
                      ),
                      AnimatedCrossFade(
                        duration: const Duration(milliseconds: 180),
                        crossFadeState: isExpanded
                            ? CrossFadeState.showSecond
                            : CrossFadeState.showFirst,
                        firstChild: const SizedBox.shrink(),
                        secondChild: _AiChatInlineThinkingTrace(
                          trace: trace,
                          summarizeToolResult: summarizeToolResult,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AiClinicSuggestionCard extends StatelessWidget {
  final AiClinic clinic;
  final VoidCallback onBookingTap;
  final bool isBusy;

  const AiClinicSuggestionCard({
    super.key,
    required this.clinic,
    required this.onBookingTap,
    this.isBusy = false,
  });

  @override
  Widget build(BuildContext context) {
    final previewImage = (clinic.imageUrl ?? clinic.logoUrl ?? '').trim();
    final servicePreview = clinic.services
        .map((service) => service.name.trim())
        .where((name) => name.isNotEmpty)
        .take(3)
        .toList();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(
            color: AppColors.stone900,
            offset: Offset(2, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (previewImage.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(10),
                topRight: Radius.circular(10),
              ),
              child: SizedBox(
                width: double.infinity,
                height: 118,
                child: Image.network(
                  previewImage,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: AppColors.primarySurface,
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.pets_outlined,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        clinic.name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.stone900,
                        ),
                      ),
                    ),
                    if (clinic.hasSos)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.coral,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'CẤP CỨU',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.white,
                          ),
                        ),
                      ),
                    if (clinic.supportsHomeVisit) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: AppColors.primary,
                            width: 1.2,
                          ),
                        ),
                        child: const Text(
                          'TẠI NHÀ',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  clinic.address,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.stone600,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (clinic.distanceKm != null) ...[
                      const Icon(
                        Icons.location_on,
                        size: 14,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${clinic.distanceKm!.toStringAsFixed(1)} km',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    if (clinic.rating != null) ...[
                      const Icon(
                        Icons.star,
                        size: 14,
                        color: Color(0xFFFBBF24),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${clinic.rating!.toStringAsFixed(1)} (${clinic.totalReviews ?? 0})',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone700,
                        ),
                      ),
                    ],
                    if (clinic.operatingHours != null) ...[
                      const SizedBox(width: 12),
                      const Icon(
                        Icons.access_time,
                        size: 14,
                        color: AppColors.stone500,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        clinic.operatingHours!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.stone500,
                        ),
                      ),
                    ],
                  ],
                ),
                if (clinic.reasonMatched != null &&
                    clinic.reasonMatched!.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    clinic.reasonMatched!.trim(),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone700,
                    ),
                  ),
                ],
                if (clinic.estimatedPriceFrom != null ||
                    servicePreview.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if (clinic.estimatedPriceFrom != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primarySurface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppColors.primary,
                              width: 1.4,
                            ),
                          ),
                          child: Text(
                            'Từ ${clinic.estimatedPriceFrom!.toStringAsFixed(0)}đ',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ...servicePreview.map(
                        (serviceName) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.stone100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppColors.stone300,
                              width: 1.2,
                            ),
                          ),
                          child: Text(
                            serviceName,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.stone700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: isBusy ? null : onBookingTap,
              style: TextButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(10),
                    bottomRight: Radius.circular(10),
                  ),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.calendar_today, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'CHỌN PHÒNG KHÁM',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiChatInlineThinkingTrace extends StatelessWidget {
  final List<Map<String, dynamic>> trace;
  final String? Function(String? toolName, dynamic result)? summarizeToolResult;

  const _AiChatInlineThinkingTrace({
    required this.trace,
    this.summarizeToolResult,
  });

  @override
  Widget build(BuildContext context) {
    final steps = trace.length <= 8 ? trace : trace.sublist(trace.length - 8);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.stone100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: steps.map((step) {
          final stepType = (step['step_type']?.toString() ?? '').toLowerCase();
          final toolName = step['tool_name']?.toString();
          final content = step['content']?.toString() ?? '';
          final result = step['tool_result'];

          var icon = Icons.bolt;
          var title = 'Đang xử lý';
          String? detail;

          if (stepType == 'thought') {
            icon = Icons.psychology_alt_outlined;
            title = 'Suy luận';
            detail = content.isNotEmpty ? content : null;
          } else if (stepType == 'action') {
            icon = Icons.play_arrow_rounded;
            title = 'Gọi công cụ';
            detail = toolName;
          } else if (stepType == 'observation') {
            icon = Icons.check_circle_outline;
            title = 'Nhận kết quả';
            detail = summarizeToolResult?.call(toolName, result) ??
                (content.isNotEmpty ? content : null);
          }

          final hasDetail = detail != null && detail.trim().isNotEmpty;

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 16, color: AppColors.stone700),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: AppColors.stone900,
                        ),
                      ),
                      if (hasDetail) ...[
                        const SizedBox(height: 2),
                        Text(
                          detail!,
                          style: const TextStyle(
                            fontSize: 11,
                            height: 1.35,
                            fontWeight: FontWeight.w600,
                            color: AppColors.stone700,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
